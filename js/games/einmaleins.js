/* ============================================================
   SPIEL: Einmaleins
   Einstellungen: welche Reihen geübt werden (Standard: alle).
   ============================================================ */
(function () {
  'use strict';

  var ALL_ROWS = [1,2,3,4,5,6,7,8,9,10];

  LernApp.registerGame({
    id: 'einmaleins',
    title: 'Einmaleins',
    emoji: '✖️',
    subtitle: 'Mal-Aufgaben üben',
    color: 'blue',
    ready: true,

    // Standard-Einstellungen: alle Reihen an
    defaultSettings: function () {
      return { reihen: ALL_ROWS.slice() };
    },

    // Kurztext auf der Spiel-Kachel
    settingsSummary: function (s) {
      var r = s.reihen || [];
      if (r.length === ALL_ROWS.length) return 'alle Reihen';
      if (r.length === 0) return 'keine Reihe gewählt';
      return 'Reihen: ' + r.slice().sort(function (a, b) { return a - b; }).join(', ');
    },

    // Neue Aufgabe bauen
    newTask: function (settings, lastKey) {
      var rows = (settings.reihen && settings.reihen.length) ? settings.reihen : ALL_ROWS;
      var a, b, key, guard = 0;
      do {
        a = rows[Math.floor(Math.random() * rows.length)];
        b = LernApp.randInt(1, 10);
        key = a + 'x' + b;
        guard++;
      } while (key === lastKey && guard < 30);   // nicht zweimal dasselbe

      return {
        key: key,
        answer: a * b,
        digits: 2,                                // mehrstellig -> Numpad mit ⌫ und ✓
        html:
          '<div class="task-question">' + a + ' × ' + b + '</div>' +
          '<div class="task-answer"><span class="slot" id="answer-slot">?</span></div>'
      };
    },

    // Einstellungs-Bildschirm
    renderSettings: function (container, settings, save) {
      var chips = ALL_ROWS.map(function (n) {
        var on = settings.reihen.indexOf(n) !== -1;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-row="' + n + '">' + n + '</button>';
      }).join('');

      container.innerHTML =
        '<p class="set-hint">Welche Reihen möchtest du üben? Tippe eine Zahl an, um sie ein- oder auszuschalten. ' +
        'Mindestens eine Reihe muss anbleiben.</p>' +
        '<div class="chips">' + chips + '</div>' +
        '<div class="chip-actions">' +
          '<button type="button" class="btn" id="rows-all">Alle an</button>' +
          '<button type="button" class="btn" id="rows-none">Nur die 1er</button>' +
        '</div>';

      function redraw() {
        var all = container.querySelectorAll('.chip');
        for (var i = 0; i < all.length; i++) {
          var n = parseInt(all[i].getAttribute('data-row'), 10);
          all[i].classList.toggle('on', settings.reihen.indexOf(n) !== -1);
        }
        save();
      }

      container.querySelectorAll('.chip').forEach(function (el) {
        el.addEventListener('click', function () {
          var n = parseInt(el.getAttribute('data-row'), 10);
          var i = settings.reihen.indexOf(n);
          if (i === -1) settings.reihen.push(n);
          else if (settings.reihen.length > 1) settings.reihen.splice(i, 1);  // nie alle abwählen
          redraw();
        });
      });

      container.querySelector('#rows-all').addEventListener('click', function () {
        settings.reihen = ALL_ROWS.slice(); redraw();
      });
      container.querySelector('#rows-none').addEventListener('click', function () {
        settings.reihen = [1]; redraw();
      });
    }
  });

}());
