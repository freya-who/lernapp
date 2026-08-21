/* ============================================================
   MOTOR der Lern-App
   Kümmert sich um: Speichern, Profile, Level, Timer, Numpad,
   und den Ablauf einer Runde (20 Fragen).
   Die einzelnen Spiele stehen in js/games/ und melden sich hier an.
   ============================================================ */
(function (global) {
  'use strict';

  // ============================================================
  //  GRUNDEINSTELLUNGEN
  // ============================================================
  var STORE_KEY  = 'lernapp.v2';   // hier liegt alles im Gerätespeicher
  var OLD_KEY    = 'lernapp.v1';   // der alte Prototyp (wird übernommen)
  var ROUND_SIZE = 20;             // eine Runde = 20 Fragen
  var PASS_L0    = 10;             // Level 0 -> 1 schafft man mit 10 von 20
  var MAX_STRIKES = 2;             // erst nach 2 verpatzten Runden geht's runter

  // Die Level-Leiter. Die Zeit gilt PRO FRAGE, solange man auf dem Level ist.
  var LEVELS = [
    { n:0, name:'Zahlen-Ei',        emoji:'🥚', timer:180 },
    { n:1, name:'Rechen-Küken',     emoji:'🐣', timer:180 },
    { n:2, name:'Grübel-Schnecke',  emoji:'🐌', timer:120 },
    { n:3, name:'Flitze-Hase',      emoji:'🐇', timer:30  },
    { n:4, name:'Blitz-Fuchs',      emoji:'🦊', timer:20  },
    { n:5, name:'Raketen-Hirn',     emoji:'🚀', timer:10  },
    { n:6, name:'Zahlen-Drache',    emoji:'🐉', timer:5   }
  ];
  var MAX_LEVEL = LEVELS.length - 1;

  var AVATARS = ['🦊','🐰','🐼','🦁','🐨','🐸','🦄','🐧'];

  // ============================================================
  //  SPIELE-VERZEICHNIS
  //  Jedes Spiel meldet sich mit LernApp.registerGame({...}) an.
  //  Neue Spiele hinzufügen ändert NICHTS an alten Ständen.
  // ============================================================
  var GAMES = [];
  var GAME_BY_ID = {};

  function registerGame(def) {
    GAMES.push(def);
    GAME_BY_ID[def.id] = def;
  }
  function getGame(id) { return GAME_BY_ID[id]; }

  // ============================================================
  //  SPEICHERN  (localStorage — bleibt auf dem Gerät)
  // ============================================================
  var data = null;

  function freshData() {
    return { version:2, lastProfileId:null, profiles:{} };
  }

  function load() {
    var d;
    try {
      d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    } catch (e) { d = null; }

    if (!d || typeof d !== 'object' || !d.profiles) {
      d = freshData();
      d = takeOverOldPrototype(d);
    }
    if (!d.profiles || typeof d.profiles !== 'object') d.profiles = {};
    data = d;
    return data;
  }

  // Falls noch der Stand vom allerersten Prototyp da ist: Namen übernehmen.
  function takeOverOldPrototype(d) {
    try {
      var old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
      if (old && old.name) {
        var p = makeProfile(old.name);
        d.profiles[p.id] = p;
        d.lastProfileId = p.id;
      }
    } catch (e) {}
    return d;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  // ============================================================
  //  PROFILE
  // ============================================================
  function makeProfile(name) {
    var id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var used = Object.keys(data ? data.profiles : {}).length;
    return {
      id: id,
      name: String(name).trim().slice(0, 14) || 'Spieler',
      avatar: AVATARS[used % AVATARS.length],
      created: Date.now(),
      games: {}          // wird pro Spiel bei Bedarf angelegt
    };
  }

  function listProfiles() {
    return Object.keys(data.profiles).map(function (k) { return data.profiles[k]; })
      .sort(function (a, b) { return a.created - b.created; });
  }

  function createProfile(name) {
    var p = makeProfile(name);
    data.profiles[p.id] = p;
    data.lastProfileId = p.id;
    save();
    return p;
  }

  function deleteProfile(id) {
    delete data.profiles[id];
    if (data.lastProfileId === id) data.lastProfileId = null;
    save();
  }

  function currentProfile() {
    return data.profiles[data.lastProfileId] || null;
  }

  function selectProfile(id) {
    data.lastProfileId = id;
    save();
  }

  /* Holt den Stand EINES Spiels für EIN Profil.
     Legt ihn beim ersten Mal an — andere Spiele bleiben unberührt.
     Genau das macht die App erweiterbar. */
  function gameState(profile, gameId) {
    if (!profile.games || typeof profile.games !== 'object') profile.games = {};
    var g = getGame(gameId);
    var st = profile.games[gameId];
    if (!st || typeof st !== 'object') {
      st = { level:0, strikes:0, rounds:0, bestCorrect:0, lastPlayed:null, settings:null };
      profile.games[gameId] = st;
    }
    // Fehlende Felder ergänzen (z.B. wenn später neue dazukommen)
    if (typeof st.level !== 'number') st.level = 0;
    if (typeof st.strikes !== 'number') st.strikes = 0;
    if (typeof st.rounds !== 'number') st.rounds = 0;
    if (typeof st.bestCorrect !== 'number') st.bestCorrect = 0;

    // Einstellungen: Standard holen und fehlende Schlüssel auffüllen
    var def = (g && g.defaultSettings) ? g.defaultSettings() : {};
    if (!st.settings || typeof st.settings !== 'object') st.settings = {};
    for (var k in def) {
      if (!(k in st.settings)) st.settings[k] = def[k];
    }
    return st;
  }

  // ============================================================
  //  LEVEL-LOGIK
  // ============================================================
  function levelInfo(n) {
    return LEVELS[Math.max(0, Math.min(MAX_LEVEL, n))];
  }

  /* Bewertet eine fertige Runde und passt das Level an.
     Rauf:  20/20 richtig  (auf Level 0 reichen 10/20 für Level 1,
                            20/20 bringt dort direkt Level 2)
     Runter: erst wenn ZWEI Runden hintereinander nicht perfekt waren,
             und dann immer nur EIN Level. Nie unter Level 1. */
  function evaluateRound(st, correct) {
    var from = st.level;
    var perfect = (correct === ROUND_SIZE);
    var res = { from:from, to:from, kind:'stay', strikes:st.strikes };

    if (from === 0) {
      if (perfect)            { st.level = 2; res.kind = 'up'; }
      else if (correct >= PASS_L0) { st.level = 1; res.kind = 'up'; }
      st.strikes = 0;
    } else if (perfect) {
      if (from < MAX_LEVEL) { st.level = from + 1; res.kind = 'up'; }
      else                  { res.kind = 'master'; }
      st.strikes = 0;
    } else {
      st.strikes++;
      if (st.strikes >= MAX_STRIKES) {
        st.strikes = 0;
        if (from > 1) { st.level = from - 1; res.kind = 'down'; }
        else          { res.kind = 'stay'; }
      } else {
        res.kind = 'warn';   // eine Verwarnung, noch kein Abstieg
      }
    }
    res.to = st.level;
    res.strikes = st.strikes;
    return res;
  }

  // ============================================================
  //  TÖNE & KONFETTI
  // ============================================================
  var actx = null;
  function tone(freq, dur, type, vol) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol == null ? 0.09 : vol;
      g.gain.exponentialRampToValueAtTime(0.0008, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }
  function soundOk()   { tone(660, .13); setTimeout(function(){ tone(880, .16); }, 90); }
  function soundNo()   { tone(180, .28, 'square', .07); }
  function soundTime() { tone(300, .18, 'triangle', .09); setTimeout(function(){ tone(220,.22,'triangle',.09); }, 150); }
  function soundTick() { tone(900, .04, 'sine', .05); }
  function soundLevelUp() {
    [523, 659, 784, 1047].forEach(function (f, i) {
      setTimeout(function () { tone(f, .22, 'sine', .11); }, i * 110);
    });
  }

  function confetti() {
    var colors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6B9D','#C084FC'];
    for (var i = 0; i < 46; i++) {
      var el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.left = (Math.random() * 100) + '%';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDelay = (Math.random() * .7) + 's';
      el.style.animationDuration = (2 + Math.random() * 1.4) + 's';
      document.body.appendChild(el);
      (function (n) { setTimeout(function () { n.remove(); }, 4200); }(el));
    }
  }

  // ============================================================
  //  BILDSCHIRM-WECHSEL
  // ============================================================
  function showScreen(name) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
    var el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
  }

  function $(id) { return document.getElementById(id); }

  // ============================================================
  //  EINE RUNDE SPIELEN
  // ============================================================
  var round = null;    // aktueller Rundenzustand
  var input = '';      // was gerade auf dem Numpad getippt wurde
  var locked = false;  // true während der Rückmeldung (blockt Doppelklicks)
  var rafId = null;
  var roundToken = 0;  // zählt Runden mit, damit alte Verzögerungen ins Leere laufen

  function startRound(gameId) {
    var profile = currentProfile();
    var game = getGame(gameId);
    if (!profile || !game) return;

    var st = gameState(profile, gameId);
    round = {
      token: ++roundToken,
      gameId: gameId,
      game: game,
      st: st,
      settings: st.settings,
      idx: 0,
      correct: 0,
      task: null,
      lastKey: null,
      secondsPerQuestion: levelInfo(st.level).timer,
      deadline: 0
    };
    showScreen('play');
    renderLevelBar();
    nextQuestion();
  }

  function renderLevelBar() {
    var lv = levelInfo(round.st.level);
    $('level-badge').textContent = lv.emoji + ' Level ' + lv.n + ' · ' + lv.name;

    var bar = $('level-bar');
    bar.innerHTML = '';
    for (var i = 0; i <= MAX_LEVEL; i++) {
      var seg = document.createElement('div');
      seg.className = 'level-seg' + (i < round.st.level ? ' done' : (i === round.st.level ? ' current' : ''));
      bar.appendChild(seg);
    }
  }

  function nextQuestion() {
    if (round.idx >= ROUND_SIZE) { endRound(); return; }

    // Aufgabe vom Spiel holen (nicht zweimal dieselbe hintereinander)
    var t = round.game.newTask(round.settings, round.lastKey);
    round.task = t;
    round.lastKey = t.key || null;

    input = '';
    locked = false;
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';

    // Aufgabe zeichnen — das Spiel baut das HTML, inkl. <span id="answer-slot">
    $('task').innerHTML = t.html;
    renderNumpad(t.digits === 1 ? 'single' : 'multi');
    updateSlot();
    updateQProgress();
    startTimer();
  }

  function updateQProgress() {
    var n = round.idx + 1;
    $('q-fill').style.width = ((round.idx / ROUND_SIZE) * 100) + '%';
    $('q-label').textContent = 'Frage ' + n + ' von ' + ROUND_SIZE +
      '   ·   ✓ ' + round.correct;
  }

  function updateSlot() {
    var slot = $('answer-slot');
    if (!slot) return;
    if (input === '') {
      slot.textContent = '?';
      slot.classList.remove('filled');
    } else {
      slot.textContent = input;
      slot.classList.add('filled');
    }
  }

  // ---------- Timer ----------
  function startTimer() {
    stopTimer();
    round.timerTotal = round.secondsPerQuestion * 1000;
    var fill = $('timer-fill');
    fill.className = 'timer-fill';
    fill.style.height = '100%';

    // App gerade im Hintergrund? Dann erst starten, wenn sie wieder sichtbar ist.
    if (document.hidden) {
      round.paused = round.timerTotal;
      $('timer-label').textContent = secsText(round.timerTotal / 1000);
      return;
    }
    round.deadline = performance.now() + round.timerTotal;
    round.paused = null;
    runTimer();
  }

  function runTimer() {
    stopTimer();
    var total = round.timerTotal;
    var fill = $('timer-fill'), label = $('timer-label');

    function frame(now) {
      if (!round) return;
      var left = round.deadline - now;
      var frac = Math.max(0, left / total);
      fill.style.height = (frac * 100) + '%';
      fill.className = 'timer-fill' + (frac <= 0.05 ? ' danger' : (frac <= 0.20 ? ' warn' : ''));
      label.textContent = secsText(left / 1000);

      if (left <= 0) { timeUp(); return; }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  function secsText(s) {
    var secs = Math.max(0, Math.ceil(s));
    return secs >= 60
      ? Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2)
      : secs + 's';
  }

  function stopTimer() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* Wenn das Kind zwischendurch aus der App geht (Anruf, anderes Programm),
     soll die Zeit ANHALTEN und nicht im Hintergrund weiterlaufen. */
  document.addEventListener('visibilitychange', function () {
    if (!round) return;
    if (document.hidden) {
      if (!locked && round.paused == null) {
        round.paused = Math.max(0, round.deadline - performance.now());
        stopTimer();
      }
    } else if (round.paused != null && !locked) {
      round.deadline = performance.now() + round.paused;
      round.paused = null;
      runTimer();
    }
  });

  function timeUp() {
    if (locked) return;
    stopTimer();
    locked = true;
    soundTime();
    var fb = $('feedback');
    fb.className = 'feedback time';
    fb.textContent = '⏰ Zeit um! Richtig wäre: ' + round.task.answer;
    advance(false, 1400);
  }

  // ---------- Numpad ----------
  function renderNumpad(mode) {
    var pad = $('numpad');
    pad.innerHTML = '';
    var keys = ['1','2','3','4','5','6','7','8','9'];

    keys.forEach(function (k) { pad.appendChild(makeKey(k, 'key', function () { press(k); })); });

    if (mode === 'single') {
      // 0 mittig, links und rechts leer
      pad.appendChild(makeSpacer());
      pad.appendChild(makeKey('0', 'key', function () { press('0'); }));
      pad.appendChild(makeSpacer());
    } else {
      pad.appendChild(makeKey('⌫', 'key key-del', backspace));
      pad.appendChild(makeKey('0', 'key', function () { press('0'); }));
      pad.appendChild(makeKey('✓', 'key key-ok', submit));
    }
  }

  function makeKey(label, cls, fn) {
    var b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }
  function makeSpacer() {
    var d = document.createElement('div');
    return d;
  }

  function press(d) {
    if (locked || !round) return;
    soundTick();
    if (round.task.digits === 1) {
      input = d;
      updateSlot();
      submit();                 // einstellig: sofort prüfen
    } else {
      if (input.length >= 3) return;
      input += d;
      updateSlot();
    }
  }

  function backspace() {
    if (locked || !round) return;
    input = input.slice(0, -1);
    updateSlot();
  }

  function submit() {
    if (locked || !round || input === '') return;
    stopTimer();
    locked = true;
    var given = parseInt(input, 10);
    var ok = (given === round.task.answer);
    var fb = $('feedback');
    if (ok) {
      round.correct++;
      fb.className = 'feedback ok';
      fb.textContent = '✓ Richtig!';
      soundOk();
    } else {
      fb.className = 'feedback no';
      fb.textContent = '✗ Richtig wäre: ' + round.task.answer;
      soundNo();
    }
    advance(ok, ok ? 620 : 1400);
  }

  function advance(wasOk, delay) {
    updateQProgress();
    var token = round.token;               // merkt sich, zu WELCHER Runde das gehört
    setTimeout(function () {
      // Runde abgebrochen oder schon eine neue gestartet? Dann nichts tun.
      if (!round || round.token !== token) return;
      round.idx++;
      nextQuestion();
    }, delay);
  }

  // ---------- Runde beenden ----------
  function endRound() {
    stopTimer();
    var st = round.st;
    var correct = round.correct;
    var res = evaluateRound(st, correct);

    st.rounds++;
    st.lastPlayed = Date.now();
    if (correct > st.bestCorrect) st.bestCorrect = correct;
    save();

    showResult(res, correct);
    round = null;
  }

  function showResult(res, correct) {
    var lvTo = levelInfo(res.to);
    $('result-score').textContent = correct + ' von ' + ROUND_SIZE;

    var emoji, title, msg;
    if (res.kind === 'up') {
      emoji = '🎉'; title = 'Level geschafft!';
      msg = 'Du bist jetzt ' + lvTo.emoji + ' ' + lvTo.name + '. Ab jetzt hast du ' +
            prettyTime(lvTo.timer) + ' pro Aufgabe.';
      soundLevelUp(); confetti();
    } else if (res.kind === 'master') {
      emoji = '👑'; title = 'Alles gemeistert!';
      msg = 'Perfekt auf der höchsten Stufe — du bist ein echter ' + lvTo.name + '!';
      soundLevelUp(); confetti();
    } else if (res.kind === 'down') {
      emoji = '💪'; title = 'Ein Level zurück';
      msg = 'Kein Problem — du übst jetzt wieder als ' + lvTo.emoji + ' ' + lvTo.name +
            ' mit ' + prettyTime(lvTo.timer) + ' pro Aufgabe.';
    } else if (res.kind === 'warn') {
      emoji = '🙂'; title = 'Fast!';
      msg = 'Für das nächste Level brauchst du alle 20 richtig. Noch ein Versuch!';
    } else {
      emoji = '🙂'; title = 'Weiter üben!';
      msg = res.from === 0
        ? 'Mit 10 von 20 richtigen Antworten kommst du auf Level 1.'
        : 'Für das nächste Level brauchst du alle 20 richtig.';
    }

    $('result-emoji').textContent = emoji;
    $('result-title').textContent = title;
    $('result-msg').textContent = msg;
    $('result-level').textContent = 'Level ' + lvTo.n + ' · ' + lvTo.emoji + ' ' + lvTo.name;

    // Verwarnungen als Herzen zeigen (nur ab Level 1 relevant)
    var hearts = '';
    if (res.to >= 1) {
      var left = MAX_STRIKES - res.strikes;
      hearts = 'Sicherheitsnetz: ' + '❤️'.repeat(left) + '🤍'.repeat(MAX_STRIKES - left);
      if (res.strikes > 0) hearts += ' — noch eine verpatzte Runde, dann geht es ein Level zurück.';
    }
    $('result-hearts').textContent = hearts;

    showScreen('result');
  }

  function prettyTime(secs) {
    if (secs >= 60) {
      var m = Math.round(secs / 60);
      return m + (m === 1 ? ' Minute' : ' Minuten');
    }
    return secs + ' Sekunden';
  }

  function abortRound() {
    stopTimer();
    round = null;
  }

  // ---------- Echte Tastatur (praktisch am Computer) ----------
  document.addEventListener('keydown', function (e) {
    var playing = document.getElementById('screen-play');
    if (!playing || !playing.classList.contains('active') || !round) return;
    if (e.key >= '0' && e.key <= '9') { press(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace')   { backspace(); e.preventDefault(); }
    else if (e.key === 'Enter')       { submit(); e.preventDefault(); }
  });

  // ============================================================
  //  NACH AUSSEN SICHTBAR
  // ============================================================
  global.LernApp = {
    ROUND_SIZE: ROUND_SIZE,
    LEVELS: LEVELS,
    MAX_LEVEL: MAX_LEVEL,
    // Spiele
    registerGame: registerGame,
    getGame: getGame,
    games: function () { return GAMES.slice(); },
    // Speicher & Profile
    load: load, save: save,
    listProfiles: listProfiles, createProfile: createProfile,
    deleteProfile: deleteProfile, currentProfile: currentProfile,
    selectProfile: selectProfile, gameState: gameState,
    // Level
    levelInfo: levelInfo, prettyTime: prettyTime,
    // Ablauf
    startRound: startRound, abortRound: abortRound,
    showScreen: showScreen,
    // Extras
    confetti: confetti, soundLevelUp: soundLevelUp,
    randInt: function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
  };

}(window));
