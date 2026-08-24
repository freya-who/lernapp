/* ============================================================
   SPIEL: Einmaleins
   Einstellungen: welche Reihen geübt werden (Standard: alle).
   ============================================================ */
(function () {
  'use strict';

  var ALL_ROWS = [1,2,3,4,5,6,7,8,9,10];

  /* Wie gut sitzt eine einzelne Reihe?
     einmal  = wie viele der 10 Aufgaben schon mindestens 1x richtig waren
     zweimal = wie viele schon 2x richtig waren  ->  das ist "gemeistert" */
  function reihenStand(mastery, reihe) {
    var einmal = 0, zweimal = 0;
    for (var b = 1; b <= 10; b++) {
      var c = mastery[reihe + 'x' + b] || 0;
      if (c >= 1) einmal++;
      if (c >= 2) zweimal++;
    }
    return { einmal: einmal, zweimal: zweimal, fertig: zweimal === 10 };
  }

  LernApp.registerGame({
    id: 'einmaleins',
    title: 'Einmaleins',
    emoji: '✖️',
    subtitle: 'Mal-Aufgaben üben',
    color: 'blue',
    ready: true,

    /* Sekunden pro Frage, Level 0 bis 7.
       Ab Level 4 bleibt es bei 30 Sekunden — schneller wird es nicht,
       stattdessen zählt ab dort die Vollständigkeit der Sammlung.
       (Hier kannst du das Tempo jederzeit anpassen.) */
    timers: [180, 180, 120, 60, 30, 30, 30, 30],

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

    // Für die Übersicht: wie viele Reihen sind komplett gemeistert?
    reihenUebersicht: function (mastery) {
      return ALL_ROWS.map(function (n) {
        var r = reihenStand(mastery || {}, n);
        return { reihe: n, einmal: r.einmal, zweimal: r.zweimal, fertig: r.fertig };
      });
    },

    renderSettings: function (container, settings, save, st) {
      var mastery = (st && st.mastery) || {};

      function chipHTML(n) {
        var r = reihenStand(mastery, n);
        var an = settings.reihen.indexOf(n) !== -1;
        return '<button type="button" class="chip rowchip' + (an ? ' on' : '') +
                 (r.fertig ? ' done' : '') + '" data-row="' + n + '">' +
                 (r.fertig ? '<span class="rowstar">⭐</span>' : '') +
                 '<span class="rownum">' + n + '</span>' +
                 '<span class="rowbar">' +
                   '<i class="b1" style="width:' + (r.einmal * 10) + '%"></i>' +
                   '<i class="b2" style="width:' + (r.zweimal * 10) + '%"></i>' +
                 '</span>' +
               '</button>';
      }

      var fertige = ALL_ROWS.filter(function (n) { return reihenStand(mastery, n).fertig; });

      container.innerHTML =
        '<p class="set-hint"><b>Welche Reihen sollen drankommen?</b><br>' +
        'Antippen schaltet eine Reihe ein oder aus. Mindestens eine bleibt an.</p>' +
        '<div class="chips">' + ALL_ROWS.map(chipHTML).join('') + '</div>' +
        '<div class="chip-actions">' +
          '<button type="button" class="btn" id="rows-all">Alle an</button>' +
          '<button type="button" class="btn" id="rows-none">Nur die 1er</button>' +
        '</div>' +
        '<div class="rowlegend">' +
          '<span><i class="dot d1"></i>1× richtig</span>' +
          '<span><i class="dot d2"></i>2× richtig</span>' +
          '<span>⭐&nbsp;= ganze Reihe sitzt</span>' +
        '</div>' +
        '<div class="rowsummary" id="rowsummary">' +
          (fertige.length
            ? '⭐ Gemeistert: ' + fertige.map(function(n){ return n + 'er'; }).join(', ')
            : 'Noch keine Reihe komplett gemeistert — dranbleiben!') +
        '</div>' +
        '<div class="rowwarn" id="rowwarn" hidden></div>';

      function redraw() {
        container.querySelector('.chips').innerHTML = ALL_ROWS.map(chipHTML).join('');
        binde();
        save();
        zeigeWarnung();
      }

      // Vorwarnung, falls durch neue Reihen das Level sinken würde
      function zeigeWarnung() {
        var box = container.querySelector('#rowwarn');
        if (!box || !st) return;
        var v = LernApp.previewFactSet(st, LernApp.getGame('einmaleins'));
        if (v.dazu > 0 && v.wuerdeSinken) {
          var spiel = LernApp.getGame('einmaleins');
          var lv = LernApp.levelInfo(v.auf);
          // Wohin geht es nach zwei sauberen Runden gleich wieder hoch?
          var zurueck = Math.max(v.auf + 1,
                        Math.min(LernApp.natuerlichesLevel(st, spiel), st.bestLevel || 0));
          box.hidden = false;
          box.innerHTML = '⚠️ <b>' + v.dazu + ' neue Aufgaben</b> kommen dazu. ' +
            'Zum Üben sinkt das Level kurz von ' + v.von + ' auf ' + v.auf + ' (' +
            lv.emoji + ' ' + lv.name + ', ' +
            LernApp.prettyTime(LernApp.timerSeconds(spiel, v.auf)) + ' pro Aufgabe).<br>' +
            'Nach zwei fehlerfreien Runden geht es direkt wieder auf <b>Level ' + zurueck +
            '</b> hoch. <b>Alles Gelernte bleibt erhalten.</b>';
        } else if (v.dazu > 0) {
          box.hidden = false;
          box.innerHTML = 'ℹ️ <b>' + v.dazu + ' neue Aufgaben</b> kommen dazu.';
        } else {
          box.hidden = true;
        }
      }

      function binde() {
        container.querySelectorAll('.rowchip').forEach(function (el) {
          el.addEventListener('click', function () {
            var n = parseInt(el.getAttribute('data-row'), 10);
            var i = settings.reihen.indexOf(n);
            if (i === -1) settings.reihen.push(n);
            else if (settings.reihen.length > 1) settings.reihen.splice(i, 1);
            redraw();
          });
        });
      }
      binde();

      container.querySelector('#rows-all').addEventListener('click', function () {
        settings.reihen = ALL_ROWS.slice(); redraw();
      });
      container.querySelector('#rows-none').addEventListener('click', function () {
        settings.reihen = [1]; redraw();
      });

      zeigeWarnung();
    }
  });

}());
