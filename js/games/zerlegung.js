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

    // Noch keine Einstellungen nötig — der Platz ist aber vorbereitet.
    defaultSettings: function () { return {}; },

    settingsSummary: function () { return 'Zerlegungen bis 10'; },

    newTask: function (settings, lastKey) {
      var target, given, answer, key, guard = 0;
      do {
        target = LernApp.randInt(2, 10);           // alle Zerlegungen bis inkl. 10
        // Der gesuchte Teil muss einstellig bleiben (Numpad 0–9):
        var minGiven = Math.max(0, target - 9);
        given = LernApp.randInt(minGiven, target);
        answer = target - given;
        key = target + '-' + given;
        guard++;
      } while (key === lastKey && guard < 30);

      var slot = '<span class="slot" id="answer-slot">?</span>';
      var part = '<span class="zer-part">' + given + '</span>';
      var left  = Math.random() < 0.5;             // mal links, mal rechts leer
      var row = left
        ? part + '<span class="zer-plus">+</span>' + slot
        : slot + '<span class="zer-plus">+</span>' + part;

      return {
        key: key,
        answer: answer,
        digits: 1,                                  // einstellig -> tippen = sofort prüfen
        html:
          '<div class="zer-target">' + target + '</div>' +
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
