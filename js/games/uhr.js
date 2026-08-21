/* ============================================================
   SPIEL: Uhr lesen
   Eine gezeichnete Zeigeruhr wird gezeigt, das Kind tippt die
   Zeit digital ein (z.B. 7 3 5  ->  7:35). Immer 5-Minuten-Schritte.
   Einstellungen: Stundenzahlen / Minutenzahlen / Minutenstriche
   einzeln ausblendbar.
   ============================================================ */
(function () {
  'use strict';

  var CX = 110, CY = 110;      // Mittelpunkt
  var R_RAND     = 104;        // Zifferblatt-Rand
  var R_TICK_IN  = 98;         // kleine Minutenstriche
  var R_TICK5_IN = 95;         // dicke 5-Minuten-Striche
  var R_MIN_NUM  = 86;         // Minutenzahlen (aussen, klein)
  var R_STD_NUM  = 64;         // Stundenzahlen (innen, gross)
  var F_MIN_NUM  = 10;         // Schriftgroesse Minutenzahlen
  var F_STD_NUM  = 17;         // Schriftgroesse Stundenzahlen
  var L_ZEIGER_H = 38;         // Länge Stundenzeiger
  var L_ZEIGER_M = 72;         // Länge Minutenzeiger

  // Punkt auf dem Kreis: 0° = oben (12 Uhr), im Uhrzeigersinn
  function punkt(grad, radius) {
    var rad = (grad - 90) * Math.PI / 180;
    return {
      x: CX + radius * Math.cos(rad),
      y: CY + radius * Math.sin(rad)
    };
  }

  function zifferblatt(stunde, minute, s) {
    var teile = [];

    // Ziffernblatt
    teile.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R_RAND + '" fill="#ffffff" stroke="#d8e0ec" stroke-width="4"/>');

    // Minutenstriche (60 Stück, jeder 5. dicker)
    if (!s.hideTicks) {
      for (var i = 0; i < 60; i++) {
        var grad = i * 6;
        var dick = (i % 5 === 0);
        var a = punkt(grad, dick ? R_TICK5_IN : R_TICK_IN);
        var b = punkt(grad, R_RAND - 3);
        teile.push('<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) +
                   '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) +
                   '" stroke="' + (dick ? '#8fa3bd' : '#ccd6e4') + '" stroke-width="' + (dick ? 3 : 1.5) +
                   '" stroke-linecap="round"/>');
      }
    }

    // Minutenzahlen 5,10,...,60  (60 steht oben)
    if (!s.hideMinuteNumbers) {
      for (var m = 5; m <= 60; m += 5) {
        var pm = punkt(m * 6, R_MIN_NUM);
        teile.push('<text x="' + pm.x.toFixed(1) + '" y="' + pm.y.toFixed(1) +
                   '" text-anchor="middle" dominant-baseline="central" ' +
                   'font-size="' + F_MIN_NUM + '" font-weight="700" fill="#F08A2C">' + m + '</text>');
      }
    }

    // Stundenzahlen 1–12
    if (!s.hideHourNumbers) {
      for (var h = 1; h <= 12; h++) {
        var ph = punkt(h * 30, R_STD_NUM);
        teile.push('<text x="' + ph.x.toFixed(1) + '" y="' + ph.y.toFixed(1) +
                   '" text-anchor="middle" dominant-baseline="central" ' +
                   'font-size="' + F_STD_NUM + '" font-weight="800" fill="#2d3436">' + h + '</text>');
      }
    }

    // Zeiger: Stunde wandert mit den Minuten weiter (7:35 -> zwischen 7 und 8)
    var gradH = (stunde % 12) * 30 + minute * 0.5;
    var gradM = minute * 6;
    var zh = punkt(gradH, L_ZEIGER_H);
    var zm = punkt(gradM, L_ZEIGER_M);

    teile.push('<line x1="' + CX + '" y1="' + CY + '" x2="' + zh.x.toFixed(1) + '" y2="' + zh.y.toFixed(1) +
               '" stroke="#2f6fed" stroke-width="8" stroke-linecap="round"/>');
    teile.push('<line x1="' + CX + '" y1="' + CY + '" x2="' + zm.x.toFixed(1) + '" y2="' + zm.y.toFixed(1) +
               '" stroke="#F08A2C" stroke-width="5" stroke-linecap="round"/>');
    teile.push('<circle cx="' + CX + '" cy="' + CY + '" r="5" fill="#2d3436"/>');

    return '<svg class="clock" viewBox="0 0 220 220" role="img" aria-label="Zeigeruhr">' +
           teile.join('') + '</svg>';
  }

  // 735 -> "7:35",  1230 -> "12:30",  "73" -> "7:3"
  function alsUhrzeit(str) {
    var s = String(str);
    if (s.length <= 2) return s;
    return s.slice(0, s.length - 2) + ':' + s.slice(-2);
  }

  LernApp.registerGame({
    id: 'uhr',
    title: 'Uhr lesen',
    emoji: '🕐',
    subtitle: 'Zeiger-Uhr ablesen',
    color: 'purple',
    ready: true,

    defaultSettings: function () {
      return {
        hideMinuteNumbers: false, // Minutenzahlen (5,10,15…) ausblenden
        hideHourNumbers:   false, // Stundenzahlen (1–12) ausblenden
        hideTicks:         false  // Minutenstriche ausblenden
      };
    },

    settingsSummary: function (s) {
      var off = [];
      if (s.hideHourNumbers)   off.push('Stundenzahlen');
      if (s.hideMinuteNumbers) off.push('Minutenzahlen');
      if (s.hideTicks)         off.push('Striche');
      return off.length ? ('ohne ' + off.join(', ')) : 'volles Zifferblatt';
    },

    newTask: function (settings, lastKey) {
      var stunde, minute, key, guard = 0;
      do {
        stunde = LernApp.randInt(1, 12);
        minute = LernApp.randInt(0, 11) * 5;   // nur 5er-Schritte
        key = stunde + ':' + minute;
        guard++;
      } while (key === lastKey && guard < 30);

      return {
        key: key,
        // 7:35 -> 735, 12:30 -> 1230
        answer: stunde * 100 + minute,
        digits: 2,            // mehrstellig -> Numpad mit ⌫ und ✓
        minDigits: 3,         // mindestens H+MM
        maxDigits: 4,         // höchstens HH+MM
        placeholder: '?:??',
        formatInput: alsUhrzeit,
        html:
          zifferblatt(stunde, minute, settings) +
          '<div class="clock-hint">Wie spät ist es?</div>' +
          '<div class="task-answer"><span class="slot slot-time" id="answer-slot">?:??</span></div>'
      };
    },

    renderSettings: function (container, settings, save) {
      var rows = [
        ['hideHourNumbers',   'Stundenzahlen ausblenden', '1, 2, 3 … 12'],
        ['hideMinuteNumbers', 'Minutenzahlen ausblenden', '5, 10, 15 … 60'],
        ['hideTicks',         'Minutenstriche ausblenden', 'die kleinen Striche am Rand']
      ];

      container.innerHTML =
        '<p class="set-hint">Je mehr du ausblendest, desto schwieriger wird das Ablesen.</p>' +
        rows.map(function (r) {
          return '<div class="switch-row">' +
            '<span class="slabel">' + r[1] + '<br><span style="font-weight:400;font-size:.82em;color:var(--muted)">' + r[2] + '</span></span>' +
            '<button type="button" class="switch' + (settings[r[0]] ? ' on' : '') + '" data-key="' + r[0] + '"></button>' +
          '</div>';
        }).join('');

      container.querySelectorAll('.switch').forEach(function (el) {
        el.addEventListener('click', function () {
          var k = el.getAttribute('data-key');
          settings[k] = !settings[k];
          el.classList.toggle('on', settings[k]);
          save();
        });
      });
    }
  });

}());
