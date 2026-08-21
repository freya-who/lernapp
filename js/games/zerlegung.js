/* ============================================================
   SPIEL: Zahlzerlegung (bis 10)
   Oben die große Zahl, darunter "=", darunter zwei Felder.
   Ein Teil ist vorgegeben (mal links, mal rechts), der andere
   wird per Numpad (0–9) eingetippt.
   ============================================================ */
(function () {
  'use strict';

  LernApp.registerGame({
    id: 'zerlegung',
    title: 'Zahlzerlegung',
    emoji: '➕',
    subtitle: 'Zerlegen bis 10',
    color: 'orange',
    ready: true,

    // Zerlegen geht schneller als Malnehmen -> etwas knackigere Zeiten
    timers: [180, 180, 120, 30, 15, 15, 15, 15],

    defaultSettings: function () { return {}; },
    settingsSummary: function () { return 'Zerlegungen bis 10'; },

    /* Alle Zerlegungen der Zahlen 2 bis 10.
       Der gesuchte Teil muss einstellig bleiben (Numpad 0–9),
       deshalb bei der 10 kein "0 + 10". */
    allFacts: function () {
      var out = [];
      for (var ziel = 2; ziel <= 10; ziel++) {
        var min = Math.max(0, ziel - 9);
        for (var geg = min; geg <= ziel; geg++) out.push(ziel + '-' + geg);
      }
      return out;
    },

    taskFromFact: function (key) {
      var p = key.split('-');
      var ziel = parseInt(p[0], 10), geg = parseInt(p[1], 10);
      var slot = '<span class="slot" id="answer-slot">?</span>';
      var teil = '<span class="zer-part">' + geg + '</span>';
      var linksVorgegeben = Math.random() < 0.5;    // mal links, mal rechts leer
      var row = linksVorgegeben
        ? teil + '<span class="zer-plus">+</span>' + slot
        : slot + '<span class="zer-plus">+</span>' + teil;

      return {
        answer: ziel - geg,
        digits: 1,
        html: '<div class="zer-target">' + ziel + '</div>' +
              '<div class="zer-eq">=</div>' +
              '<div class="zer-row">' + row + '</div>'
      };
    },

    renderSettings: function (container) {
      container.innerHTML =
        '<p class="set-hint" style="margin:0;text-align:center">' +
        'Hier gibt es noch nichts einzustellen 🙂<br>' +
        'Geübt werden alle Zerlegungen der Zahlen 2 bis 10.</p>';
    }
  });

}());
