/* ============================================================
   START — verbindet die Bildschirme mit dem Motor
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  LernApp.load();

  // ============================================================
  //  1. PROFIL-AUSWAHL
  // ============================================================
  function renderProfiles() {
    var list = $('profile-list');
    var profiles = LernApp.listProfiles();
    list.innerHTML = '';

    if (profiles.length === 0) {
      var hint = document.createElement('p');
      hint.className = 'empty-hint';
      hint.textContent = 'Noch niemand da — trag unten einen Namen ein 👇';
      list.appendChild(hint);
    }

    profiles.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'profile-card';

      var av = document.createElement('div');
      av.className = 'avatar';
      av.textContent = p.avatar || '🙂';

      var info = document.createElement('div');
      info.className = 'pinfo';
      var nm = document.createElement('div');
      nm.className = 'pname';
      nm.textContent = p.name;                 // textContent = sicher gegen komische Zeichen
      var meta = document.createElement('div');
      meta.className = 'pmeta';
      meta.textContent = summarizeProfile(p);
      info.appendChild(nm); info.appendChild(meta);

      var del = document.createElement('button');
      del.className = 'pdel';
      del.type = 'button';
      del.textContent = '✕';
      del.title = 'Spieler löschen';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('"' + p.name + '" mit allem Fortschritt löschen?')) {
          LernApp.deleteProfile(p.id);
          renderProfiles();
        }
      });

      card.appendChild(av); card.appendChild(info); card.appendChild(del);
      card.addEventListener('click', function () {
        LernApp.selectProfile(p.id);
        openGames();
      });
      list.appendChild(card);
    });
  }

  // Kurzer Überblick: höchstes Level über alle Spiele
  function summarizeProfile(p) {
    var parts = [];
    LernApp.games().forEach(function (g) {
      var st = (p.games && p.games[g.id]) ? p.games[g.id] : null;
      if (st && st.level > 0) {
        parts.push(g.emoji + ' Lvl ' + st.level);
      }
    });
    return parts.length ? parts.join('   ') : 'noch nicht gestartet';
  }

  $('btn-create-profile').addEventListener('click', createFromInput);
  $('new-profile-name').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') createFromInput();
  });

  function createFromInput() {
    var el = $('new-profile-name');
    var name = el.value.trim();
    if (!name) { el.focus(); return; }
    LernApp.createProfile(name);
    el.value = '';
    el.blur();
    openGames();
  }

  // ============================================================
  //  2. SPIEL-AUSWAHL
  // ============================================================
  function openGames() {
    var p = LernApp.currentProfile();
    if (!p) { openProfiles(); return; }
    $('who-name').textContent = (p.avatar || '🙂') + '  ' + p.name;
    renderGames();
    LernApp.showScreen('games');
  }

  function renderGames() {
    var p = LernApp.currentProfile();
    var list = $('game-list');
    list.innerHTML = '';

    LernApp.games().forEach(function (g) {
      var st = LernApp.gameState(p, g.id);
      var lv = LernApp.levelInfo(st.level);

      var card = document.createElement('div');
      card.className = 'game-card c-' + g.color + (g.ready ? '' : ' soon');

      // linker Teil: spielen
      var main = document.createElement('button');
      main.className = 'game-main';
      main.type = 'button';
      main.innerHTML =
        '<span class="emoji">' + g.emoji + '</span>' +
        '<span class="ginfo">' +
          '<span class="gtitle">' + g.title +
            (g.ready ? '' : '<span class="badge-soon">kommt bald</span>') + '</span>' +
          '<span class="glevel">' +
            (g.ready
              ? ('Level ' + lv.n + ' · ' + lv.emoji + ' ' + lv.name)
              : g.subtitle) +
          '</span>' +
        '</span>';
      main.addEventListener('click', function () {
        if (!g.ready) {
          alert('„' + g.title + '“ bauen wir als Nächstes! 🚧\n\n' +
                'Die Einstellungen dafür kannst du über das Zahnrad aber schon festlegen.');
          return;
        }
        LernApp.startRound(g.id);
      });

      // rechter Teil: Zahnrad = Einstellungen
      var gear = document.createElement('button');
      gear.className = 'game-gear';
      gear.type = 'button';
      gear.textContent = '⚙️';
      gear.title = 'Einstellungen';
      gear.addEventListener('click', function (e) {
        e.stopPropagation();
        openSettings(g.id);
      });

      card.appendChild(main);
      card.appendChild(gear);
      list.appendChild(card);
    });
  }

  function openProfiles() {
    renderProfiles();
    LernApp.showScreen('profiles');
  }

  $('btn-switch-profile').addEventListener('click', openProfiles);

  // ============================================================
  //  3. EINSTELLUNGEN
  // ============================================================
  function openSettings(gameId) {
    var p = LernApp.currentProfile();
    var g = LernApp.getGame(gameId);
    var st = LernApp.gameState(p, gameId);

    $('settings-title').textContent = g.emoji + ' ' + g.title;
    var body = $('settings-body');
    body.innerHTML = '';

    // Das Spiel baut seine Einstellungen selbst und ruft save() bei Änderungen.
    g.renderSettings(body, st.settings, function () { LernApp.save(); });

    LernApp.showScreen('settings');
  }

  $('btn-settings-back').addEventListener('click', openGames);
  $('btn-settings-done').addEventListener('click', openGames);

  // ============================================================
  //  4. SPIELEN / ERGEBNIS
  // ============================================================
  $('btn-play-back').addEventListener('click', function () {
    if (confirm('Runde abbrechen? Der Fortschritt dieser Runde geht verloren.')) {
      LernApp.abortRound();
      openGames();
    }
  });

  $('btn-again').addEventListener('click', function () {
    if (lastGameId) LernApp.startRound(lastGameId);
  });
  $('btn-to-games').addEventListener('click', openGames);

  // merken, welches Spiel zuletzt lief (für "Nochmal spielen")
  var lastGameId = null;
  var origStart = LernApp.startRound;
  LernApp.startRound = function (id) { lastGameId = id; origStart(id); };

  // ============================================================
  //  LOSLEGEN
  // ============================================================
  if (LernApp.currentProfile()) openGames();
  else openProfiles();

}());
