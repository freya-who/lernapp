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

    /* Sekunden pro Frage, Level 0 bis 7.
       Ab Level 4 bleibt es bei 20 Sekunden — schneller wird es nicht,
       stattdessen zählt ab dort die Vollständigkeit der Sammlung. */
    timers: [180, 180, 120, 30, 20, 20, 20, 20],

    defaultSettings: function () { return { reihen: ALL_ROWS.slice() }; },

    settingsSummary: function (s) {
      var r = s.reihen || [];
      if (r.length === ALL_ROWS.length) return 'alle Reihen';
      return 'Reihen: ' + r.slice().sort(function (a, b) { return a - b; }).join(', ');
    },

    // Alle Aufgaben, die zu den eingestellten Reihen gehören
    allFacts: function (settings) {
      var rows = (settings.reihen && settings.reihen.length) ? settings.reihen : ALL_ROWS;
      var out = [];
      rows.slice().sort(function (a, b) { return a - b; }).forEach(function (a) {
        for (var b = 1; b <= 10; b++) out.push(a + 'x' + b);
      });
      return out;
    },

    // Aus "7x8" die konkrete Aufgabe bauen
    taskFromFact: function (key) {
      var p = key.split('x');
      var a = parseInt(p[0], 10), b = parseInt(p[1], 10);
      return {
        answer: a * b,
        digits: 2,
        html: '<div class="task-question">' + a + ' × ' + b + '</div>' +
              '<div class="task-answer"><span class="slot" id="answer-slot">?</span></div>'
      };
    },

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
        container.querySelectorAll('.chip').forEach(function (el) {
          var n = parseInt(el.getAttribute('data-row'), 10);
          el.classList.toggle('on', settings.reihen.indexOf(n) !== -1);
        });
        save();
      }

      container.querySelectorAll('.chip').forEach(function (el) {
        el.addEventListener('click', function () {
          var n = parseInt(el.getAttribute('data-row'), 10);
          var i = settings.reihen.indexOf(n);
          if (i === -1) settings.reihen.push(n);
          else if (settings.reihen.length > 1) settings.reihen.splice(i, 1);
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
