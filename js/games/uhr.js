/* ============================================================
   SPIEL: Uhr lesen
   Eine gezeichnete Zeigeruhr, immer in 5-Minuten-Schritten.

   Zwei Antwortarten (in den Einstellungen wählbar):
     "tippen"  — Zeit als Ziffern eingeben (7 3 5 -> 7:35)
     "auswahl" — vier Antworten zum Antippen, gemischt aus
                 digitaler Zeit und Sprechweise ("Viertel nach Sieben")

   Einstellungen: Stundenzahlen / Minutenzahlen / Minutenstriche
   einzeln ausblendbar.
   ============================================================ */
(function () {
  'use strict';

  var CX = 110, CY = 110;
  var R_RAND     = 104;        // Zifferblatt-Rand
  var R_TICK_IN  = 98;         // kleine Minutenstriche
  var R_TICK5_IN = 95;         // dicke 5-Minuten-Striche
  var R_MIN_NUM  = 88;         // Minutenzahlen (ganz außen)
  var F_MIN_NUM  = 10;

  /* Wo die Stundenzahlen stehen, hängt davon ab, ob außen noch
     Minutenzahlen liegen. Ohne sie rücken die Stunden nach außen —
     sonst wirkt das Zifferblatt in der Mitte zusammengedrängt. */
  var R_STD_INNEN = 64,  F_STD_INNEN = 17;   // mit Minutenzahlen
  var R_STD_AUSSEN = 80, F_STD_AUSSEN = 21;  // ohne Minutenzahlen

  var L_ZEIGER_H = 38;
  var L_ZEIGER_M = 72;

  // Punkt auf dem Kreis: 0° = oben (12 Uhr), im Uhrzeigersinn
  function punkt(grad, radius) {
    var rad = (grad - 90) * Math.PI / 180;
    return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
  }

  function zifferblatt(stunde, minute, s) {
    var teile = [];
    var zeigeMin = !s.hideMinuteNumbers;
    var rStd = zeigeMin ? R_STD_INNEN : R_STD_AUSSEN;
    var fStd = zeigeMin ? F_STD_INNEN : F_STD_AUSSEN;

    teile.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R_RAND +
               '" fill="#ffffff" stroke="#d8e0ec" stroke-width="4"/>');

    // Minutenstriche (60 Stück, jeder 5. dicker)
    if (!s.hideTicks) {
      for (var i = 0; i < 60; i++) {
        var grad = i * 6;
        var dick = (i % 5 === 0);
        var a = punkt(grad, dick ? R_TICK5_IN : R_TICK_IN);
        var b = punkt(grad, R_RAND - 3);
        teile.push('<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) +
                   '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) +
                   '" stroke="' + (dick ? '#8fa3bd' : '#ccd6e4') +
                   '" stroke-width="' + (dick ? 3 : 1.5) + '" stroke-linecap="round"/>');
      }
    }

    // Minutenzahlen 5,10,…,60 — ganz außen
    if (zeigeMin) {
      for (var m = 5; m <= 60; m += 5) {
        var pm = punkt(m * 6, R_MIN_NUM);
        teile.push('<text x="' + pm.x.toFixed(1) + '" y="' + pm.y.toFixed(1) +
                   '" text-anchor="middle" dominant-baseline="central" font-size="' + F_MIN_NUM +
                   '" font-weight="700" fill="#F08A2C">' + m + '</text>');
      }
    }

    // Stundenzahlen 1–12
    if (!s.hideHourNumbers) {
      for (var h = 1; h <= 12; h++) {
        var ph = punkt(h * 30, rStd);
        teile.push('<text x="' + ph.x.toFixed(1) + '" y="' + ph.y.toFixed(1) +
                   '" text-anchor="middle" dominant-baseline="central" font-size="' + fStd +
                   '" font-weight="800" fill="#2d3436">' + h + '</text>');
      }
    }

    // Zeiger: der Stundenzeiger wandert mit den Minuten weiter
    var zh = punkt((stunde % 12) * 30 + minute * 0.5, L_ZEIGER_H);
    var zm = punkt(minute * 6, L_ZEIGER_M);
    teile.push('<line x1="' + CX + '" y1="' + CY + '" x2="' + zh.x.toFixed(1) + '" y2="' + zh.y.toFixed(1) +
               '" stroke="#2f6fed" stroke-width="8" stroke-linecap="round"/>');
    teile.push('<line x1="' + CX + '" y1="' + CY + '" x2="' + zm.x.toFixed(1) + '" y2="' + zm.y.toFixed(1) +
               '" stroke="#F08A2C" stroke-width="5" stroke-linecap="round"/>');
    teile.push('<circle cx="' + CX + '" cy="' + CY + '" r="5" fill="#2d3436"/>');

    /* Ohne Minutenzahlen darf die Uhr größer sein. Beim Eintippen braucht
       das Numpad viel Platz, dann bleibt die Uhr kleiner — sonst müsste
       man auf kleinen Handys scrollen. */
    var cls = 'clock' + (zeigeMin ? '' : ' clock-big') +
              (s.modus === 'tippen' ? ' clock-type' : '');
    return '<svg class="' + cls + '" viewBox="0 0 220 220" role="img" aria-label="Zeigeruhr">' +
           teile.join('') + '</svg>';
  }

  // ---------- Sprechweise ----------
  var WORT = ['Zwölf','Eins','Zwei','Drei','Vier','Fünf','Sechs','Sieben',
              'Acht','Neun','Zehn','Elf','Zwölf'];

  function naechsteStunde(h) { return h === 12 ? 1 : h + 1; }

  /* Deutsche Sprechweise. "halb acht" heißt 7:30 — genau die Stelle,
     an der Kinder oft durcheinanderkommen, deshalb üben wir sie mit. */
  function alsWorte(h, m) {
    var jetzt = WORT[h], naechste = WORT[naechsteStunde(h)];
    switch (m) {
      case 0:  return jetzt + ' Uhr';
      case 5:  return 'Fünf nach ' + jetzt;
      case 10: return 'Zehn nach ' + jetzt;
      case 15: return 'Viertel nach ' + jetzt;
      case 20: return 'Zwanzig nach ' + jetzt;
      case 25: return 'Fünf vor halb ' + naechste;
      case 30: return 'Halb ' + naechste;
      case 35: return 'Fünf nach halb ' + naechste;
      case 40: return 'Zwanzig vor ' + naechste;
      case 45: return 'Viertel vor ' + naechste;
      case 50: return 'Zehn vor ' + naechste;
      case 55: return 'Fünf vor ' + naechste;
    }
    return jetzt + ' Uhr ' + m;
  }

  function alsZiffern(h, m) { return h + ':' + ('0' + m).slice(-2); }

  // 735 -> "7:35", "73" -> "7:3"  (während des Tippens)
  function alsUhrzeit(str) {
    var s = String(str);
    if (s.length <= 2) return s;
    return s.slice(0, s.length - 2) + ':' + s.slice(-2);
  }

  // ---------- Antwortmöglichkeiten für die Auswahl ----------
  /* Vier Antworten: die richtige plus drei typische Verwechslungen.
     Absichtlich gemischt aus Ziffern und Sprechweise, damit beides
     gelesen werden muss. */
  function baueAuswahl(h, m) {
    var richtigAlsWort = Math.random() < 0.5;
    var richtig = richtigAlsWort ? alsWorte(h, m) : alsZiffern(h, m);

    var kandidaten = [];
    function add(text) {
      if (text !== richtig && kandidaten.indexOf(text) === -1) kandidaten.push(text);
    }

    var vor = (h === 1) ? 12 : h - 1;
    var nach = naechsteStunde(h);

    // 1) Stunde daneben (der häufigste Fehler bei "halb")
    add(Math.random() < 0.5 ? alsWorte(nach, m) : alsZiffern(nach, m));
    add(Math.random() < 0.5 ? alsZiffern(vor, m) : alsWorte(vor, m));
    // 2) Zeiger verwechselt / Minuten daneben
    var mPlus  = (m + 15) % 60;
    var mMinus = (m + 45) % 60;
    add(Math.random() < 0.5 ? alsZiffern(h, mPlus) : alsWorte(h, mPlus));
    add(Math.random() < 0.5 ? alsWorte(h, mMinus) : alsZiffern(h, mMinus));
    // 3) Die jeweils andere Schreibweise der richtigen Zeit NICHT anbieten
    //    (die wäre ja auch richtig) — stattdessen Auffüller
    add(alsZiffern(nach, mPlus));
    add(alsWorte(vor, mMinus));

    var auswahl = [richtig].concat(LernApp.shuffle(kandidaten).slice(0, 3));
    return { choices: LernApp.shuffle(auswahl), answerLabel: richtig };
  }

  LernApp.registerGame({
    id: 'uhr',
    title: 'Uhr lesen',
    emoji: '🕐',
    subtitle: 'Zeiger-Uhr ablesen',
    color: 'purple',
    ready: true,

    // Uhr ablesen braucht mehr Bedenkzeit als reines Rechnen
    timers: [180, 180, 120, 60, 30, 30, 30, 30],

    defaultSettings: function () {
      return {
        modus:             'auswahl',  // 'auswahl' oder 'tippen'
        hideMinuteNumbers: false,
        hideHourNumbers:   false,
        hideTicks:         false
      };
    },

    settingsSummary: function (s) {
      var off = [];
      if (s.hideHourNumbers)   off.push('Stundenzahlen');
      if (s.hideMinuteNumbers) off.push('Minutenzahlen');
      if (s.hideTicks)         off.push('Striche');
      return (s.modus === 'tippen' ? 'Eintippen' : 'Auswahl') +
             (off.length ? ', ohne ' + off.join(', ') : '');
    },

    // Alle Uhrzeiten in 5-Minuten-Schritten: 12 Stunden x 12 Minutenwerte
    allFacts: function () {
      var out = [];
      for (var h = 1; h <= 12; h++) {
        for (var m = 0; m < 60; m += 5) out.push(h + ':' + m);
      }
      return out;
    },

    taskFromFact: function (key, settings) {
      var p = key.split(':');
      var stunde = parseInt(p[0], 10), minute = parseInt(p[1], 10);
      var uhr = zifferblatt(stunde, minute, settings) +
                '<div class="clock-hint">Wie spät ist es?</div>';

      if (settings.modus === 'tippen') {
        return {
          answer: stunde * 100 + minute,     // 7:35 -> 735
          digits: 2,
          minDigits: 3, maxDigits: 4,
          placeholder: '?:??',
          formatInput: alsUhrzeit,
          html: uhr + '<div class="task-answer"><span class="slot slot-time" id="answer-slot">?:??</span></div>'
        };
      }

      var a = baueAuswahl(stunde, minute);
      return {
        answer: stunde * 100 + minute,
        choices: a.choices,
        answerLabel: a.answerLabel,
        html: uhr
      };
    },

    renderSettings: function (container, settings, save) {
      var rows = [
        ['hideHourNumbers',   'Stundenzahlen ausblenden', '1, 2, 3 … 12'],
        ['hideMinuteNumbers', 'Minutenzahlen ausblenden', '5, 10, 15 … 60'],
        ['hideTicks',         'Minutenstriche ausblenden', 'die kleinen Striche am Rand']
      ];

      container.innerHTML =
        '<p class="set-hint"><b>Wie soll geantwortet werden?</b></p>' +
        '<div class="mode-chips">' +
          '<button type="button" class="chip' + (settings.modus === 'auswahl' ? ' on' : '') +
            '" data-modus="auswahl">Auswahl<br><span class="chip-sub">4 Antworten antippen</span></button>' +
          '<button type="button" class="chip' + (settings.modus === 'tippen' ? ' on' : '') +
            '" data-modus="tippen">Eintippen<br><span class="chip-sub">Zeit selbst eingeben</span></button>' +
        '</div>' +
        '<p class="set-hint" style="margin-top:14px">Bei <b>Auswahl</b> kommen auch Sprechweisen ' +
        'wie „Viertel nach Sieben“ oder „Halb Acht“ vor.</p>' +
        '<hr class="set-trenner">' +
        '<p class="set-hint">Je mehr du ausblendest, desto schwieriger wird das Ablesen.</p>' +
        rows.map(function (r) {
          return '<div class="switch-row">' +
            '<span class="slabel">' + r[1] +
              '<br><span style="font-weight:400;font-size:.82em;color:var(--muted)">' + r[2] + '</span></span>' +
            '<button type="button" class="switch' + (settings[r[0]] ? ' on' : '') +
              '" data-key="' + r[0] + '"></button>' +
          '</div>';
        }).join('');

      container.querySelectorAll('[data-modus]').forEach(function (el) {
        el.addEventListener('click', function () {
          settings.modus = el.getAttribute('data-modus');
          container.querySelectorAll('[data-modus]').forEach(function (c) {
            c.classList.toggle('on', c.getAttribute('data-modus') === settings.modus);
          });
          save();
        });
      });

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
