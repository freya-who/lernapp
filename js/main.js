/* ============================================================
   START — verbindet die Bildschirme mit dem Motor
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  LernApp.load();

  // ============================================================
  //  TON AN / AUS  (gilt überall, wird mitgespeichert)
  // ============================================================
  function paintSoundButtons() {
    var on = LernApp.soundOn();
    ['btn-sound-play', 'btn-sound-games'].forEach(function (id) {
      var b = $(id);
      if (!b) return;
      b.textContent = on ? '🔊' : '🔇';
      b.classList.toggle('off', !on);
      b.title = on ? 'Ton ausschalten' : 'Ton einschalten';
    });
  }
  ['btn-sound-play', 'btn-sound-games'].forEach(function (id) {
    var b = $(id);
    if (b) b.addEventListener('click', function () { LernApp.toggleSound(); paintSoundButtons(); });
  });
  paintSoundButtons();

  // ============================================================
  //  NACHFRAGE-DIALOG (eigener statt Browser-Fenster, damit die
  //  Knöpfe sinnvoll beschriftet sind)
  // ============================================================
  function zeigeDialog(o) {
    $('modal-icon').textContent  = o.icon || '⚠️';
    $('modal-icon').hidden       = (o.icon === false);
    $('modal-title').textContent = o.titel;
    $('modal-text').textContent  = o.text || '';
    $('modal-text').hidden       = !o.text;
    // Optionaler eigener Inhalt (z.B. das Raster mit den Tier-Symbolen)
    var body = $('modal-body');
    body.innerHTML = '';
    if (o.inhalt) body.appendChild(o.inhalt);
    var ok = $('modal-ok'), zurueck = $('modal-back');
    ok.hidden = (o.okText === false);
    ok.textContent = o.okText || 'OK';
    zurueck.textContent = o.zurueckText || 'Zurück';
    zurueck.hidden = !o.aufZurueck;

    function schliessen() {
      $('modal').hidden = true;
      ok.removeEventListener('click', jaKlick);
      zurueck.removeEventListener('click', neinKlick);
    }
    function jaKlick()   { schliessen(); if (o.aufOk) o.aufOk(); }
    function neinKlick() { schliessen(); if (o.aufZurueck) o.aufZurueck(); }

    ok.addEventListener('click', jaKlick);
    zurueck.addEventListener('click', neinKlick);
    $('modal').hidden = false;
    (ok.hidden ? zurueck : ok).focus();
    return schliessen;
  }

  /* SPIELER-SYMBOL WÄHLEN
     Tippt man auf das Tier neben dem Namen, öffnet sich eine kleine
     Auswahl. Nur die Symbole aus LernApp.AVATARS sind möglich. */
  function oeffneAvatarWahl(profil, danach) {
    var raster = document.createElement('div');
    raster.className = 'avatar-grid';

    var schliessen = null;
    LernApp.AVATARS.forEach(function (emoji) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'avatar-pick' + (emoji === profil.avatar ? ' on' : '');
      b.textContent = emoji;
      b.setAttribute('aria-label', 'Symbol ' + emoji + ' wählen');
      b.addEventListener('click', function () {
        LernApp.setAvatar(profil.id, emoji);
        if (schliessen) schliessen();
        if (danach) danach();
      });
      raster.appendChild(b);
    });

    schliessen = zeigeDialog({
      icon: profil.avatar,
      titel: 'Symbol für ' + profil.name,
      inhalt: raster,
      okText: false,                 // kein OK nötig — Antippen wählt direkt
      zurueckText: 'Abbrechen',
      aufZurueck: function () {}
    });
  }

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

      var av = document.createElement('button');
      av.type = 'button';
      av.className = 'avatar';
      av.title = 'Symbol ändern';
      av.innerHTML = '<span class="avatar-emoji">' + (p.avatar || '🙂') + '</span>' +
                     '<span class="avatar-edit">✏️</span>';
      av.addEventListener('click', function (e) {
        e.stopPropagation();                 // nicht das Profil starten
        oeffneAvatarWahl(p, renderProfiles);
      });

      var info = document.createElement('div');
      info.className = 'pinfo';
      var nm = document.createElement('div');
      nm.className = 'pname';
      nm.textContent = p.name;               // textContent = sicher
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

  function summarizeProfile(p) {
    var parts = [];
    LernApp.games().forEach(function (g) {
      var st = (p.games && p.games[g.id]) ? p.games[g.id] : null;
      if (st && st.level > 0) parts.push(g.emoji + ' Lvl ' + st.level);
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
    var who = $('who-name');
    who.innerHTML = '';
    var wav = document.createElement('button');
    wav.type = 'button';
    wav.className = 'who-avatar';
    wav.textContent = p.avatar || '🙂';
    wav.title = 'Symbol ändern';
    wav.addEventListener('click', function () { oeffneAvatarWahl(p, openGames); });
    who.appendChild(wav);
    who.appendChild(document.createTextNode(p.name));
    renderGames();
    paintSoundButtons();
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

      // Zusatzzeile: gemeisterte Reihen bzw. Stand der Sammlung
      var covLine = '';
      if (g.reihenUebersicht) {
        var fertig = g.reihenUebersicht(st.mastery).filter(function (r) { return r.fertig; });
        if (fertig.length) {
          covLine = '<span class="gcov">⭐ Gemeistert: ' +
                    fertig.map(function (r) { return r.reihe + 'er'; }).join(', ') + '</span>';
        }
      }
      if (!covLine && st.level >= 4) {
        var need = LernApp.COVERAGE_REQ[st.level] || { min:1 };
        var cov = LernApp.coverage(st, g, need.min);
        covLine = '<span class="gcov">📚 Sammlung: ' + cov.have + ' von ' + cov.total + '</span>';
      }

      var main = document.createElement('button');
      main.className = 'game-main';
      main.type = 'button';
      main.innerHTML =
        '<span class="emoji">' + g.emoji + '</span>' +
        '<span class="ginfo">' +
          '<span class="gtitle">' + g.title +
            (g.ready ? '' : '<span class="badge-soon">kommt bald</span>') + '</span>' +
          '<span class="glevel">' +
            (g.ready ? ('Level ' + lv.n + ' · ' + lv.emoji + ' ' + lv.name) : g.subtitle) +
          '</span>' + covLine +
        '</span>';
      main.addEventListener('click', function () {
        if (!g.ready) {
          alert('„' + g.title + '“ bauen wir als Nächstes! 🚧');
          return;
        }
        LernApp.startRound(g.id);
        paintSoundButtons();
      });

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
  //  ERKLÄRUNG (per ℹ️)
  // ============================================================
  var infoZurueck = 'profiles';   // wohin "Zurück" führt

  function openInfo(von) {
    infoZurueck = von;
    fuelleLevelTabelle();
    LernApp.showScreen('info');
  }

  // Die Level-Tabelle aus den echten Daten bauen (Zeiten vom Einmaleins)
  function fuelleLevelTabelle() {
    var g = LernApp.getGame('einmaleins');
    var weiter = {
      0: '5 von 10',
      1: '2\u00d7 fehlerfrei',
      2: '2\u00d7 fehlerfrei',
      3: '2\u00d7 fehlerfrei',
      4: '2\u00d7 fehlerfrei + \u00bd Sammlung',
      5: '+ ganze Sammlung',
      6: '+ alles 2\u00d7',
      7: 'Endstufe'
    };
    $('info-level-rows').innerHTML = LernApp.LEVELS.map(function (lv) {
      var t = LernApp.timerSeconds(g, lv.n);
      var zeit = t >= 60 ? (Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2)) : (t + ' s');
      return '<tr' + (lv.n >= 5 ? ' class="phase-b"' : '') + '>' +
        '<td class="il-lvl">' + lv.emoji + ' ' + lv.n + ' <small>' + lv.name + '</small></td>' +
        '<td class="il-num">' + zeit + '</td>' +
        '<td class="il-up">' + weiter[lv.n] + '</td>' +
      '</tr>';
    }).join('');
  }

  $('btn-info-profiles').addEventListener('click', function () { openInfo('profiles'); });
  $('btn-info-games').addEventListener('click', function () { openInfo('games'); });
  $('btn-info-back').addEventListener('click', function () {
    if (infoZurueck === 'games') openGames(); else openProfiles();
  });

  // ============================================================
  //  3. EINSTELLUNGEN
  // ============================================================
  var offenesSpiel = null;

  function openSettings(gameId) {
    offenesSpiel = gameId;
    var p = LernApp.currentProfile();
    var g = LernApp.getGame(gameId);
    var st = LernApp.gameState(p, gameId);

    $('settings-title').textContent = g.emoji + ' ' + g.title;

    // (a) Für JEDES Spiel gleich: freie Patzer pro Runde
    renderLivesSetting($('settings-common'), st.settings);

    // (b) Das Spiel baut seinen eigenen Teil
    var body = $('settings-body');
    body.innerHTML = '';
    g.renderSettings(body, st.settings, function () { LernApp.save(); }, st);

    LernApp.showScreen('settings');
  }

  /* Leben = "kostenfreie Patzer". Ist noch ein Leben übrig, schüttelt sich
     das Antwortfeld leer und man darf es nochmal versuchen. */
  function renderLivesSetting(container, settings) {
    container.innerHTML =
      '<p class="set-hint">❤️ <b>Freie Patzer pro Runde</b><br>' +
      'Bei einer falschen Antwort schüttelt sich das Feld leer und du darfst es ' +
      'nochmal versuchen — die Frage zählt dann trotzdem als richtig. Die Zeit läuft weiter.</p>' +
      '<div class="lives-chips">' +
        [0,1,2,3].map(function (n) {
          return '<button type="button" class="chip' + (settings.lives === n ? ' on' : '') +
                 '" data-lives="' + n + '">' + (n === 0 ? '0' : '❤️'.repeat(n)) + '</button>';
        }).join('') +
      '</div>';

    container.querySelectorAll('.chip').forEach(function (el) {
      el.addEventListener('click', function () {
        settings.lives = parseInt(el.getAttribute('data-lives'), 10);
        container.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('on', parseInt(c.getAttribute('data-lives'), 10) === settings.lives);
        });
        LernApp.save();
      });
    });
  }

  /* Beim Verlassen der Einstellungen prüfen, ob neue Aufgaben dazugekommen
     sind. Falls das Level dadurch sinkt, erst fragen — und die Änderung
     erst übernehmen, wenn "OK" gedrückt wurde. */
  function closeSettings() {
    var p = LernApp.currentProfile();
    if (!p || !offenesSpiel) { openGames(); return; }

    var g  = LernApp.getGame(offenesSpiel);
    var st = LernApp.gameState(p, offenesSpiel);
    var v  = LernApp.previewFactSet(st, g);

    if (v.dazu > 0 && v.wuerdeSinken) {
      var lv = LernApp.levelInfo(v.auf);
      var zurueck = Math.max(v.auf + 1,
                    Math.min(LernApp.natuerlichesLevel(st, g), st.bestLevel || 0));
      zeigeDialog({
        icon: '📚',
        titel: v.dazu + ' neue Aufgaben kommen dazu',
        text: 'Zum Üben sinkt das Level von ' + v.von + ' auf ' + v.auf + ' — ' +
              lv.emoji + ' ' + lv.name + ', ' +
              LernApp.prettyTime(LernApp.timerSeconds(g, v.auf)) + ' pro Aufgabe.\n\n' +
              'Nach zwei fehlerfreien Runden geht es direkt wieder auf Level ' + zurueck + '.\n\n' +
              'Alles bisher Gelernte bleibt gespeichert.',
        okText: 'OK, los geht\u2019s',
        zurueckText: 'Zurück zur Auswahl',
        aufOk: function () {
          LernApp.syncFactSet(st, g);
          LernApp.save();
          openGames();
        },
        aufZurueck: function () { /* im Einstellungsbildschirm bleiben */ }
      });
      return;
    }

    LernApp.syncFactSet(st, g);
    LernApp.save();
    openGames();
  }
  $('btn-settings-back').addEventListener('click', closeSettings);
  $('btn-settings-done').addEventListener('click', closeSettings);

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
    if (lastGameId) { LernApp.startRound(lastGameId); paintSoundButtons(); }
  });
  $('btn-to-games').addEventListener('click', openGames);

  var lastGameId = null;
  var origStart = LernApp.startRound;
  LernApp.startRound = function (id) { lastGameId = id; origStart(id); };

  // ============================================================
  //  LOSLEGEN
  // ============================================================
  if (LernApp.currentProfile()) openGames();
  else openProfiles();

}());
