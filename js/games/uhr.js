/* ============================================================
   SPIEL: Uhr lesen  —  kommt noch!
   Das Spiel selbst bauen wir später. Die Einstellungen gibt es
   aber schon: sie werden pro Profil gespeichert und bleiben
   erhalten, wenn das Spiel dazukommt.
   ============================================================ */
(function () {
  'use strict';

  LernApp.registerGame({
    id: 'uhr',
    title: 'Uhr lesen',
    emoji: '🕐',
    subtitle: 'Zeiger-Uhr lesen',
    color: 'purple',
    ready: false,                 // -> Kachel zeigt "kommt bald"

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

    newTask: function () {
      return { key:'x', answer:0, digits:1, html:'' };   // noch ungenutzt
    },

    renderSettings: function (container, settings, save) {
      var rows = [
        ['hideHourNumbers',   'Stundenzahlen ausblenden', '1, 2, 3 … 12'],
        ['hideMinuteNumbers', 'Minutenzahlen ausblenden', '5, 10, 15 … 60'],
        ['hideTicks',         'Minutenstriche ausblenden', 'die kleinen Striche am Rand']
      ];

      container.innerHTML =
        '<p class="set-hint">Je mehr du ausblendest, desto schwieriger wird das Ablesen. ' +
        'Diese Einstellungen werden schon gespeichert — das Spiel selbst kommt als Nächstes.</p>' +
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
