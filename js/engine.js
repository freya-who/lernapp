/* ============================================================
   MOTOR der Lern-App
   Kümmert sich um: Speichern, Profile, Level, Timer, Numpad,
   Leben, Sammlung (welche Aufgaben sitzen schon) und den
   Ablauf einer Runde (20 Fragen).
   Die einzelnen Spiele stehen in js/games/ und melden sich hier an.
   ============================================================ */
(function (global) {
  'use strict';

  // ============================================================
  //  GRUNDEINSTELLUNGEN
  // ============================================================
  var STORE_KEY   = 'lernapp.v2';
  var OLD_KEY     = 'lernapp.v1';
  var ROUND_SIZE  = 20;    // eine Runde = 20 Fragen
  var PASS_L0     = 10;    // Level 0 -> 1 schafft man mit 10 von 20
  var MAX_STRIKES = 2;     // erst nach 2 verpatzten Runden geht es abwärts

  // Die Level-Leiter. Die ZEIT steht beim jeweiligen Spiel (game.timers),
  // weil 20 Sekunden beim Einmaleins etwas anderes bedeuten als beim Uhr-Lesen.
  var LEVELS = [
    { n:0, name:'Zahlen-Ei',      emoji:'🥚' },
    { n:1, name:'Rechen-Küken',   emoji:'🐣' },
    { n:2, name:'Grübel-Schnecke',emoji:'🐌' },
    { n:3, name:'Flitze-Hase',    emoji:'🐇' },
    { n:4, name:'Blitz-Fuchs',    emoji:'🦊' },
    { n:5, name:'Raketen-Hirn',   emoji:'🚀' },
    { n:6, name:'Zahlen-Drache',  emoji:'🐉' },
    { n:7, name:'Zahlen-Zauberer',emoji:'🧙' }
  ];
  var MAX_LEVEL = LEVELS.length - 1;

  // Ersatz-Zeiten, falls ein Spiel keine eigenen angibt (Sekunden pro Frage)
  var DEFAULT_TIMERS = [180, 180, 120, 30, 20, 20, 20, 20];

  /* AB LEVEL 4 zählt nicht mehr nur Tempo, sondern Vollständigkeit:
     Es reicht nicht, 20 von 20 zu schaffen — man muss auch genügend
     verschiedene Aufgaben sicher können.
       von Level 4 -> 5:  50 % aller Aufgaben mind. 1x richtig
       von Level 5 -> 6: 100 % aller Aufgaben mind. 1x richtig
       von Level 6 -> 7: 100 % aller Aufgaben mind. 2x richtig          */
  var COVERAGE_REQ = {
    4: { min:1, pct:0.50 },
    5: { min:1, pct:1.00 },
    6: { min:2, pct:1.00 }
  };
  var MASTER_MAX = 2;            // höher als 2 wird nicht gezählt
  var WEIGHT_FROM_LEVEL = 4;     // ab hier werden schwache Aufgaben bevorzugt

  var AVATARS = ['🦊','🐰','🐼','🦁','🐨','🐸','🦄','🐧'];

  // ============================================================
  //  SPIELE-VERZEICHNIS
  // ============================================================
  var GAMES = [];
  var GAME_BY_ID = {};

  function registerGame(def) { GAMES.push(def); GAME_BY_ID[def.id] = def; }
  function getGame(id) { return GAME_BY_ID[id]; }

  function timersFor(game) { return (game && game.timers) || DEFAULT_TIMERS; }
  function timerSeconds(game, level) {
    var t = timersFor(game);
    return t[Math.max(0, Math.min(t.length - 1, level))];
  }

  // ============================================================
  //  SPEICHERN  (localStorage — bleibt auf dem Gerät)
  // ============================================================
  var data = null;

  function freshData() { return { version:2, lastProfileId:null, sound:true, profiles:{} }; }

  function load() {
    var d;
    try { d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !d.profiles) {
      d = freshData();
      d = takeOverOldPrototype(d);
    }
    if (!d.profiles || typeof d.profiles !== 'object') d.profiles = {};
    if (typeof d.sound !== 'boolean') d.sound = true;
    data = d;
    return data;
  }

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

  // ---------- Ton an/aus (gilt für die ganze App) ----------
  function soundOn() { return !data || data.sound !== false; }
  function toggleSound() { data.sound = !soundOn(); save(); return soundOn(); }

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
      games: {}
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

  function currentProfile() { return data.profiles[data.lastProfileId] || null; }
  function selectProfile(id) { data.lastProfileId = id; save(); }

  /* Stand EINES Spiels für EIN Profil. Legt ihn beim ersten Mal an —
     andere Spiele bleiben unberührt. Das macht die App erweiterbar. */
  function gameState(profile, gameId) {
    if (!profile.games || typeof profile.games !== 'object') profile.games = {};
    var g = getGame(gameId);
    var st = profile.games[gameId];
    if (!st || typeof st !== 'object') {
      st = { level:0, strikes:0, rounds:0, bestCorrect:0, lastPlayed:null, settings:null, mastery:{} };
      profile.games[gameId] = st;
    }
    if (typeof st.level !== 'number') st.level = 0;
    if (typeof st.strikes !== 'number') st.strikes = 0;
    if (typeof st.rounds !== 'number') st.rounds = 0;
    if (typeof st.bestCorrect !== 'number') st.bestCorrect = 0;
    if (!st.mastery || typeof st.mastery !== 'object') st.mastery = {};

    var def = (g && g.defaultSettings) ? g.defaultSettings() : {};
    if (!st.settings || typeof st.settings !== 'object') st.settings = {};
    for (var k in def) { if (!(k in st.settings)) st.settings[k] = def[k]; }
    // "Freie Patzer" gibt es in jedem Spiel — der Motor ergänzt sie selbst.
    if (typeof st.settings.lives !== 'number') st.settings.lives = 1;
    return st;
  }

  // ============================================================
  //  SAMMLUNG: welche Aufgaben sitzen schon?
  //  mastery[aufgabe] = 0..2   (2 = zweimal richtig gehabt)
  // ============================================================
  function bumpMastery(st, key, delta) {
    if (!key) return;
    if (!st.mastery) st.mastery = {};
    var c = (st.mastery[key] || 0) + delta;
    if (c <= 0) delete st.mastery[key];
    else st.mastery[key] = Math.min(MASTER_MAX, c);
  }

  // Wie viele der aktuell eingestellten Aufgaben sitzen mindestens `min` mal?
  function coverage(st, game, min) {
    var facts = (game && game.allFacts) ? game.allFacts(st.settings) : [];
    var m = st.mastery || {};
    var have = 0;
    for (var i = 0; i < facts.length; i++) if ((m[facts[i]] || 0) >= min) have++;
    return { have:have, total:facts.length, pct: facts.length ? have / facts.length : 1 };
  }

  /* RUNDENPLAN: welche 20 Aufgaben kommen dran?

     Solange die Sammlung zählt (ab Level 4), werden die noch FEHLENDEN
     Aufgaben garantiert eingestreut — bis zu 12 pro Runde. Sonst würde
     man am Ende ewig auf die letzten drei fehlenden Aufgaben warten.
     Die restlichen Plätze füllen sich gewichtet: was noch nicht sitzt,
     kommt häufiger. */
  var NEW_PER_ROUND = 12;

  function shuffleArr(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function weightedPick(facts, st) {
    var m = st.mastery || {};
    var weighted = st.level >= WEIGHT_FROM_LEVEL;
    if (!weighted) return facts[Math.floor(Math.random() * facts.length)];
    var total = 0, w = [];
    for (var i = 0; i < facts.length; i++) {
      var c = m[facts[i]] || 0;
      var x = (c === 0) ? 6 : (c === 1 ? 3 : 1);
      w.push(x); total += x;
    }
    var r = Math.random() * total;
    for (var j = 0; j < facts.length; j++) { r -= w[j]; if (r <= 0) return facts[j]; }
    return facts[facts.length - 1];
  }

  // Gleiche Aufgabe nicht direkt hintereinander
  function spreadDuplicates(plan) {
    for (var i = 1; i < plan.length; i++) {
      if (plan[i] === plan[i - 1]) {
        for (var j = i + 1; j < plan.length; j++) {
          if (plan[j] !== plan[i] && (j + 1 >= plan.length || plan[j + 1] !== plan[i])) {
            var t = plan[i]; plan[i] = plan[j]; plan[j] = t;
            break;
          }
        }
      }
    }
    return plan;
  }

  function buildPlan(game, st) {
    var facts = game.allFacts(st.settings);
    if (!facts.length) return [];
    var plan = [];
    var req = COVERAGE_REQ[st.level];
    var m = st.mastery || {};

    if (req) {
      var fehlend = facts.filter(function (f) { return (m[f] || 0) < req.min; });
      plan = shuffleArr(fehlend).slice(0, Math.min(fehlend.length, NEW_PER_ROUND));
    }
    while (plan.length < ROUND_SIZE) plan.push(weightedPick(facts, st));
    return spreadDuplicates(shuffleArr(plan).slice(0, ROUND_SIZE));
  }

  // ============================================================
  //  LEVEL-LOGIK
  // ============================================================
  function levelInfo(n) { return LEVELS[Math.max(0, Math.min(MAX_LEVEL, n))]; }

  /* Bewertet eine fertige Runde.
     Rauf:   20/20 richtig (auf Level 0 reichen 10/20 für Level 1,
             20/20 bringt dort direkt Level 2).
             AB Level 4 zusätzlich: genug Aufgaben gesammelt.
     Runter: erst nach ZWEI nicht perfekten Runden, dann ein Level,
             nie unter Level 1. */
  function evaluateRound(st, correct, game) {
    var from = st.level;
    var perfect = (correct === ROUND_SIZE);
    var res = { from:from, to:from, kind:'stay', strikes:st.strikes, need:null, cov:null };

    if (from === 0) {
      if (perfect)                 { st.level = 2; res.kind = 'up'; }
      else if (correct >= PASS_L0) { st.level = 1; res.kind = 'up'; }
      st.strikes = 0;

    } else if (perfect) {
      var req = COVERAGE_REQ[from];
      if (req) {
        var cov = coverage(st, game, req.min);
        if (cov.pct + 1e-9 < req.pct) {
          // Perfekt gespielt, aber die Sammlung ist noch nicht voll genug.
          res.kind = 'needcoverage';
          res.need = req;
          res.cov  = cov;
          st.strikes = 0;                 // perfekt = keine Verwarnung
          res.to = st.level; res.strikes = 0;
          return res;
        }
      }
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
        res.kind = 'warn';
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
    if (!soundOn()) return;
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
  function soundOops() { tone(320, .12, 'triangle', .07); }   // Leben verbraucht
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
  var round = null;
  var input = '';
  var locked = false;
  var rafId = null;
  var roundToken = 0;

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
      factKey: null,
      plan: null,
      usedLife: false,
      livesLeft: Math.max(0, Math.min(3, st.settings.lives || 0)),
      livesTotal: Math.max(0, Math.min(3, st.settings.lives || 0)),
      secondsPerQuestion: timerSeconds(game, st.level),
      timerTotal: 0,
      deadline: 0,
      paused: null
    };
    round.plan = buildPlan(game, st);
    showScreen('play');
    renderLevelBar();
    renderLives();
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

  function renderLives() {
    var el = $('lives');
    if (!el) return;
    if (!round || round.livesTotal === 0) { el.textContent = ''; return; }
    var s = '';
    for (var i = 0; i < round.livesTotal; i++) s += (i < round.livesLeft) ? '❤️' : '🤍';
    el.textContent = s;
  }

  function nextQuestion() {
    if (round.idx >= ROUND_SIZE) { endRound(); return; }

    var key = round.plan[round.idx];
    if (!key) { endRound(); return; }
    round.factKey = key;
    round.task = round.game.taskFromFact(key, round.settings);
    round.usedLife = false;

    input = '';
    locked = false;
    $('feedback').textContent = '';
    $('feedback').className = 'feedback';

    $('task').innerHTML = round.task.html;
    renderNumpad(round.task.digits === 1 ? 'single' : 'multi');
    updateSlot();
    updateQProgress();
    startTimer();
  }

  function updateQProgress() {
    var n = round.idx + 1;
    $('q-fill').style.width = ((round.idx / ROUND_SIZE) * 100) + '%';
    $('q-label').textContent = 'Frage ' + n + ' von ' + ROUND_SIZE + '   ·   ✓ ' + round.correct;
  }

  function updateSlot() {
    var slot = $('answer-slot');
    if (!slot || !round) return;
    var t = round.task;
    if (input === '') {
      slot.textContent = t.placeholder || '?';
      slot.classList.remove('filled');
    } else {
      slot.textContent = t.formatInput ? t.formatInput(input) : input;
      slot.classList.add('filled');
    }
    var ok = $('numpad') ? $('numpad').querySelector('.key-ok') : null;
    if (ok) ok.disabled = (input.length < minDigits());
  }

  function minDigits() { return (round && round.task.minDigits) || 1; }
  function maxDigits() { return (round && round.task.maxDigits) || 3; }

  function answerText() {
    var t = round.task;
    return t.formatInput ? t.formatInput(String(t.answer)) : String(t.answer);
  }

  // "Nein"-Schütteln des Antwortfeldes, danach ist es wieder leer
  function shakeSlot() {
    var slot = $('answer-slot');
    if (!slot) return;
    slot.classList.remove('shake');
    void slot.offsetWidth;          // Animation neu starten
    slot.classList.add('shake');
    setTimeout(function () { slot.classList.remove('shake'); }, 500);
  }

  // ---------- Timer ----------
  function startTimer() {
    stopTimer();
    round.timerTotal = round.secondsPerQuestion * 1000;
    setHourglass(1);
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
    function frame(now) {
      if (!round) return;
      var left = round.deadline - now;
      var frac = Math.max(0, left / total);
      setHourglass(frac);
      $('timer-label').textContent = secsText(left / 1000);
      if (left <= 0) { timeUp(); return; }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  // Sanduhr: oben rinnt der Sand weg, unten sammelt er sich
  var HG_TOP_Y = 4, HG_BOT_Y = 28, HG_H = 11.5;
  function setHourglass(frac) {
    var top = $('hg-top'), bot = $('hg-bot'), box = $('timer-box');
    if (!top || !bot) return;
    top.setAttribute('y', (HG_TOP_Y + (1 - frac) * HG_H).toFixed(2));
    top.setAttribute('height', (frac * HG_H).toFixed(2));
    bot.setAttribute('y', (HG_BOT_Y - (1 - frac) * HG_H).toFixed(2));
    bot.setAttribute('height', ((1 - frac) * HG_H).toFixed(2));
    var col = frac <= 0.05 ? '#EF4444' : (frac <= 0.20 ? '#F5B700' : '#22C55E');
    top.setAttribute('fill', col);
    bot.setAttribute('fill', col);
    if (box) {
      box.classList.toggle('warn',   frac <= 0.20 && frac > 0.05);
      box.classList.toggle('danger', frac <= 0.05);
    }
  }

  function secsText(s) {
    var secs = Math.max(0, Math.ceil(s));
    return secs >= 60
      ? Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2)
      : secs + 's';
  }

  function stopTimer() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  /* Verlässt das Kind die App (Anruf, anderes Programm), hält die Zeit an. */
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
    bumpMastery(round.st, round.factKey, -1);      // Aufgabe rutscht in der Sammlung zurück
    var fb = $('feedback');
    fb.className = 'feedback time';
    fb.textContent = '⏰ Zeit um! Richtig wäre: ' + answerText();
    advance(1400);
  }

  // ---------- Numpad ----------
  function renderNumpad(mode) {
    var pad = $('numpad');
    pad.innerHTML = '';
    ['1','2','3','4','5','6','7','8','9'].forEach(function (k) {
      pad.appendChild(makeKey(k, 'key', function () { press(k); }));
    });
    if (mode === 'single') {
      pad.appendChild(document.createElement('div'));
      pad.appendChild(makeKey('0', 'key', function () { press('0'); }));
      pad.appendChild(document.createElement('div'));
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

  function press(d) {
    if (locked || !round) return;
    soundTick();
    if (round.task.digits === 1) {
      input = d;
      updateSlot();
      submit();
    } else {
      if (input.length >= maxDigits()) return;
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
    if (input.length < minDigits()) return;

    var ok = (parseInt(input, 10) === round.task.answer);

    /* Falsch, aber noch ein Leben übrig?
       -> Antwortfeld schüttelt sich leer, gleiche Frage nochmal.
       Die Zeit läuft dabei WEITER, sonst wäre Raten belohnt. */
    if (!ok && round.livesLeft > 0) {
      round.livesLeft--;
      round.usedLife = true;
      soundOops();
      shakeSlot();
      input = '';
      updateSlot();
      renderLives();
      return;
    }

    stopTimer();
    locked = true;
    var fb = $('feedback');
    if (ok) {
      round.correct++;
      fb.className = 'feedback ok';
      // Mit Leben gerettet? Dann zählt die Frage als richtig,
      // die Sammlung bleibt aber unverändert (weder rauf noch runter).
      if (round.usedLife) {
        fb.textContent = '✓ Richtig! (mit Joker)';
      } else {
        fb.textContent = '✓ Richtig!';
        bumpMastery(round.st, round.factKey, +1);
      }
      soundOk();
    } else {
      fb.className = 'feedback no';
      fb.textContent = '✗ Richtig wäre: ' + answerText();
      bumpMastery(round.st, round.factKey, -1);
      soundNo();
    }
    advance(ok ? 620 : 1400);
  }

  function advance(delay) {
    updateQProgress();
    var token = round.token;
    setTimeout(function () {
      if (!round || round.token !== token) return;
      round.idx++;
      nextQuestion();
    }, delay);
  }

  // ---------- Runde beenden ----------
  function endRound() {
    stopTimer();
    var st = round.st, game = round.game, correct = round.correct;
    var res = evaluateRound(st, correct, game);

    st.rounds++;
    st.lastPlayed = Date.now();
    if (correct > st.bestCorrect) st.bestCorrect = correct;
    save();

    showResult(res, correct, game, st);
    round = null;
  }

  function showResult(res, correct, game, st) {
    var lvTo = levelInfo(res.to);
    $('result-score').textContent = correct + ' von ' + ROUND_SIZE;

    var emoji, title, msg;
    if (res.kind === 'up') {
      emoji = '🎉'; title = 'Level geschafft!';
      msg = 'Du bist jetzt ' + lvTo.emoji + ' ' + lvTo.name + '. Ab jetzt hast du ' +
            prettyTime(timerSeconds(game, res.to)) + ' pro Aufgabe.';
      soundLevelUp(); confetti();

    } else if (res.kind === 'master') {
      emoji = '👑'; title = 'Alles gemeistert!';
      msg = 'Perfekt auf der höchsten Stufe — du bist ein echter ' + lvTo.name + '!';
      soundLevelUp(); confetti();

    } else if (res.kind === 'needcoverage') {
      emoji = '🔎'; title = 'Perfekte Runde!';
      msg = 'Alle 20 richtig! Für das nächste Level zählt jetzt aber die Sammlung: ' +
            'du brauchst ' + Math.round(res.need.pct * 100) + ' % aller Aufgaben ' +
            (res.need.min === 2 ? 'zweimal' : 'mindestens einmal') + ' richtig.';
      soundOk();

    } else if (res.kind === 'down') {
      emoji = '💪'; title = 'Ein Level zurück';
      msg = 'Kein Problem — du übst jetzt wieder als ' + lvTo.emoji + ' ' + lvTo.name +
            ' mit ' + prettyTime(timerSeconds(game, res.to)) + ' pro Aufgabe.';

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

    // Sammlung immer zeigen, sobald sie eine Rolle spielt
    var cEl = $('result-coverage');
    if (cEl) {
      var req = COVERAGE_REQ[res.to];
      if (req || res.to >= WEIGHT_FROM_LEVEL) {
        var need = req || { min:1, pct:1 };
        var cov = coverage(st, game, need.min);
        var pct = Math.round(cov.pct * 100);
        cEl.innerHTML =
          '<div class="cov-title">📚 Sammlung' +
            (need.min === 2 ? ' (zweimal richtig)' : ' (einmal richtig)') + '</div>' +
          '<div class="cov-track"><div class="cov-fill" style="width:' + pct + '%"></div>' +
            (req ? '<div class="cov-goal" style="left:' + Math.round(req.pct * 100) + '%"></div>' : '') +
          '</div>' +
          '<div class="cov-text">' + cov.have + ' von ' + cov.total + ' Aufgaben' +
            (req ? '   ·   Ziel: ' + Math.round(req.pct * 100) + ' %' : '') + '</div>';
        cEl.style.display = '';
      } else {
        cEl.style.display = 'none';
      }
    }

    var hearts = '';
    if (res.to >= 1 && res.kind !== 'needcoverage') {
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

  function abortRound() { stopTimer(); round = null; }

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
    COVERAGE_REQ: COVERAGE_REQ,
    registerGame: registerGame,
    getGame: getGame,
    games: function () { return GAMES.slice(); },
    load: load, save: save,
    listProfiles: listProfiles, createProfile: createProfile,
    deleteProfile: deleteProfile, currentProfile: currentProfile,
    selectProfile: selectProfile, gameState: gameState,
    levelInfo: levelInfo, prettyTime: prettyTime,
    timerSeconds: timerSeconds,
    coverage: coverage,
    buildPlan: buildPlan,      // nützlich zum Nachschauen/Prüfen
    soundOn: soundOn, toggleSound: toggleSound,
    startRound: startRound, abortRound: abortRound,
    showScreen: showScreen,
    confetti: confetti,
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
