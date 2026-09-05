(() => {
  'use strict';

  const LENGTHS = [5, 7, 9];
 const TYPES = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
  const PROMOTABLE = ['R', 'B', 'S', 'N', 'L', 'P'];
  const LABELS = { K:'\u7389', R:'\u98db', B:'\u89d2', G:'\u91d1', S:'\u9280', N:'\u6842', L:'\u9999', P:'\u6b69' };
  const PROMOTED = { R:'\u9f8d', B:'\u99ac', S:'\u5168', N:'\u572d', L:'\u674f', P:'\u3068' };
  const RANKS = ['', '\u4E00','\u4E8C','\u4E09','\u56DB','\u4E94','\u516D','\u4E03','\u516B','\u4E5D'];
  const HOSHI = new Set(['3,3','7,3','3,7','7,7']);
  const USI_RANKS = ['', 'a','b','c','d','e','f','g','h','i'];
  const STORAGE = 'tsume-training-v4';
  const BRIDGE = location.protocol === 'http:' && (location.hostname === '127.0.0.1' || location.hostname === 'localhost');
  const sourcePuzzles = typeof CURATED_PUZZLES === 'undefined' ? null : CURATED_PUZZLES;

  if (!Array.isArray(sourcePuzzles) || !sourcePuzzles.length) {
    document.body.innerHTML = '<main class="shell"><section class="card"><h1>\u9898\u5E93\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D</h1><p class="subtitle">\u8BF7\u786E\u8BA4 TsumeLauncher.html\u3001launcher.js \u548C puzzle-data.js \u5728\u540C\u4E00\u4E2A\u6587\u4EF6\u5939\u4E2D\u3002</p><p class="note">\u8BAD\u7EC3\u8BB0\u5F55\u4E0D\u4F1A\u56E0\u9898\u5E93\u52A0\u8F7D\u5931\u8D25\u800C\u4E22\u5931\u3002</p></section></main>';
    return;
  }

  const puzzles = sourcePuzzles
    .filter(p => LENGTHS.includes(Number(p.mateLength)))
    .sort((a, b) => Number(a.mateLength) - Number(b.mateLength) || Number(a.id) - Number(b.id));

  const TEXT = {
    choose: '\u8BF7\u9009\u62E9\u653B\u65B9\u7740\u624B\u3002',
    correct: '\u6B63\u89E3\uFF1A',
    wrong: '\u4E0D\u6B63\u89E3\u3002',
    engineThinking: '\u7389\u65B9\u5E94\u624B\u4E2D\u2026',
    engineOff: '\u7389\u65B9\u5E94\u624B\u5F15\u64CE\u4E0D\u53EF\u7528\u3002',
    noMarked: '\u6682\u65E0\u6807\u8BB0\u9898\u3002',
    noWrong: '\u6682\u65E0\u9519\u9898\u3002',
    overLimit: '\u624B\u6570\u8D85\u9650\uFF0C\u91CD\u65B0\u5F00\u59CB\u3002'
  };

  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
  const coord = xy => `${xy[0]}${RANKS[xy[1]]}`;
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const makeProgress = () => ({ records:{}, streak:0, lastSolvedDate:'', history:[], activity:[], settings:{ bank:'curated', engineEnabled:true, strictSteps:false, statsPeriod:'day' } });

  function loadProgress() {
    const base = makeProgress();
    try {
      const raw = localStorage.getItem(STORAGE) || localStorage.getItem('tsume-training-v3');
      if (!raw) return base;
      const value = JSON.parse(raw);
      const merged = { ...base, ...value, records:value.records || {}, history:Array.isArray(value.history) ? value.history : [], activity:Array.isArray(value.activity) ? value.activity : [], settings:{ ...base.settings, ...(value.settings || {}) } };
      if (!Array.isArray(value.activity) && merged.history.length) merged.activity = merged.history.map(item => ({ type:item.result, key:item.key, at:Number(item.at || 0), seconds:Number(item.seconds || 0) })).filter(item => item.at);
      return merged;
    } catch (_) { return base; }
  }

  function saveProgress() { try { localStorage.setItem(STORAGE, JSON.stringify(progress)); } catch (_) {} }
  function key(p) { return `${p.mateLength}:${p.id}`; }
  function record(p) {
    const k = key(p);
    const defaults = { attempts:0, wrong:0, solved:false, marked:false, skipped:0, seconds:0, bestSeconds:0, failed:0, hints:0, answerShown:0, engineFallbacks:0 };
    if (!progress.records[k]) progress.records[k] = { ...defaults };
    progress.records[k] = { ...defaults, ...progress.records[k] };
    return progress.records[k];
  }

  function logActivity(type, p, extra={}) {
    if (!p) return;
    if (!Array.isArray(progress.activity)) progress.activity = [];
    progress.activity.push({ type, key:key(p), length:Number(p.mateLength), at:Date.now(), ...extra });
    if (progress.activity.length > 2000) progress.activity.splice(0, progress.activity.length - 2000);
  }
  function activityEvents() {
    if (Array.isArray(progress.activity) && progress.activity.length) return progress.activity;
    return (progress.history || []).map(item => ({ type:item.result, key:item.key, at:Number(item.at || 0), seconds:Number(item.seconds || 0) })).filter(item => item.at);
  }
  function periodStart(period, now=Date.now()) {
    const date = new Date(now);
    date.setHours(0,0,0,0);
    if (period === 'week') date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    if (period === 'month') date.setDate(1);
    return date.getTime();
  }
  function periodName(period) {
    return period === 'week' ? '\u672C\u5468' : period === 'month' ? '\u672C\u6708' : '\u4ECA\u65E5';
  }
  function renderPeriodStats() {
    const period = ['day','week','month'].includes(settings.statsPeriod) ? settings.statsPeriod : 'day';
    document.querySelectorAll('#statPeriods button').forEach(button => button.classList.toggle('active', button.dataset.period === period));
    const start = periodStart(period);
    const events = activityEvents().filter(item => Number(item.at || 0) >= start && Number(item.at || 0) <= Date.now());
    const solved = events.filter(item => item.type === 'solved').length;
    const attempts = events.filter(item => item.type === 'attempt').length;
    const wrong = events.filter(item => item.type === 'wrong').length;
    const failed = events.filter(item => item.type === 'failed').length;
    const seconds = events.reduce((total, item) => total + (item.type === 'solved' ? Number(item.seconds || 0) : 0), 0);
    const date = new Date(start);
    let range = dateKey(date);
    if (period === 'week') {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      range += ' — ' + dateKey(end);
    } else if (period === 'month') {
      range = String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2,'0');
    }
    $('periodCaption').textContent = periodName(period) + ' · ' + range;
    $('periodSolved').textContent = solved;
    $('periodAttempts').textContent = attempts;
    $('periodWrong').textContent = wrong;
    $('periodFailed').textContent = failed;
    $('periodRate').textContent = attempts ? Math.round(solved / attempts * 100) + '%' : '—';
    $('periodAverage').textContent = solved ? Math.round(seconds / solved) + 's' : '—';
  }

  let progress = loadProgress();
  const settings = progress.settings;
  let engineAvailable = false;
  let engineChecked = false;
  let state = {
    length:5,
    bank:['curated','expanded','all'].includes(settings.bank) ? settings.bank : 'curated',
    puzzle:null, board:null, hands:null, solutionIndex:0,
    selectedFrom:null, selectedDrop:null, pendingMove:null,
    startedAt:0, pausedAt:0, pausedMs:0, paused:false, timer:null,
    solved:false, locked:false, enginePending:false, answerShown:false,
    markedOnly:false, wrongOnly:false, attemptedMoves:0, failTimer:null, undoStack:[], token:0
  };

  function expected() { return state.puzzle && state.puzzle.solution[state.solutionIndex]; }
  function formatMove(move) {
    if (move.drop) return `${move.drop}*${coord(move.to)}`;
    return `${coord(move.from)}${coord(move.to)}${move.promote ? '+' : ''}`;
  }
  function allMoves() { return state.puzzle ? state.puzzle.solution.map(formatMove).join('  ') : ''; }
  function setFeedback(text, kind='') { const el=$('feedback'); el.className='feedback' + (kind ? ` ${kind}` : ''); el.innerHTML=text; }
  function collectionName(p) { return (p.collection || 'curated') === 'expanded' ? '\u6269\u5C55\u96C6' : '\u7CBE\u9009\u96C6'; }
  function qualityName(p) { return p.quality === 'validated' ? '\u5DF2\u6821\u9A8C' : '\u6269\u5C55\u9898'; }
  function bankMatches(p) { return state.bank === 'all' || (p.collection || 'curated') === state.bank; }
  function filteredPuzzles() { return puzzles.filter(p => Number(p.mateLength) === state.length && bankMatches(p) && (!state.markedOnly || record(p).marked) && (!state.wrongOnly || Number(record(p).wrong || 0) > 0)); }
  function attackLimit(p) { return Math.ceil(Number(p.mateLength) / 2); }

  function elapsedSeconds() {
    if (!state.startedAt) return 0;
    const end = state.paused ? state.pausedAt : Date.now();
    return Math.max(0, Math.floor((end - state.startedAt - state.pausedMs) / 1000));
  }
  function resetTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(renderTimer, 1000);
    renderTimer();
  }
  function renderTimer() {
    const seconds = elapsedSeconds();
    const value = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    $('timer').textContent = state.paused ? `\u23F8 ${value}` : value;
  }
  function pauseTimer() {
    if (!state.startedAt || state.paused) return;
    state.paused = true; state.pausedAt = Date.now(); renderTimer();
  }
  function resumeTimer() {
    if (!state.paused) return;
    state.pausedMs += Date.now() - state.pausedAt; state.paused = false; state.pausedAt = 0; renderTimer();
  }

  function setEngineStatus(mode, text) {
    const status = $('engineStatus');
    const pill = $('enginePill');
    status.classList.remove('engine-status-ok','engine-status-off');
    pill.classList.remove('engine-status-ok','engine-status-off','engine-status-thinking');
    if (mode === 'ok') { status.classList.add('engine-status-ok'); pill.classList.add('engine-status-ok'); }
    if (mode === 'off') { status.classList.add('engine-status-off'); pill.classList.add('engine-status-off'); }
    if (mode === 'thinking') pill.classList.add('engine-status-thinking');
    status.textContent = text;
    pill.textContent = text;
  }
  function renderSettings() {
    $('engineToggle').checked = settings.engineEnabled !== false;
    $('strictSteps').checked = Boolean(settings.strictSteps);
    $('limitHint').textContent = settings.strictSteps
      ? '\u624B\u6570\u9650\u5236\uFF1A\u6700\u591A ' + attackLimit(state.puzzle || { solution:[], mateLength:state.length }) + ' \u624B\uFF0C\u8D85\u9650\u91CD\u5F00\u3002'
      : '\u5224\u5B9A\uFF1A\u738B\u624B\uFF0B\u624B\u6570\u3002\u5F15\u64CE\u4EC5\u8D1F\u8D23\u7389\u65B9\u5E94\u624B\u3002';
  }

  function updateBankUI() {
    document.querySelectorAll('#banks button').forEach(button => button.classList.toggle('active', button.dataset.bank === state.bank));
    const counts = { curated:0, expanded:0, all:0 };
    puzzles.filter(p => Number(p.mateLength) === state.length).forEach(p => { counts[p.collection === 'expanded' ? 'expanded' : 'curated']++; counts.all++; });
    const selected = counts[state.bank] || 0;
    $('bankSummary').textContent = `${state.bank === 'curated' ? '\u7CBE\u9009' : state.bank === 'expanded' ? '\u6269\u5C55' : '\u5168\u90E8'} \u00B7 ${selected} \u9898`;
   $('bankNote').textContent = `5 \u624B ${puzzles.filter(p => Number(p.mateLength)===5 && (p.collection || 'curated')==='curated').length} \u9898\u7CBE\u9009 \u00B7 7 \u624B ${puzzles.filter(p => Number(p.mateLength)===7 && (p.collection || 'curated')==='expanded').length} \u9898\u6269\u5C55 \u00B7 9 \u624B ${puzzles.filter(p => Number(p.mateLength)===9 && (p.collection || 'curated')==='expanded').length} \u9898\u6269\u5C55`;
    const curatedTotal = puzzles.filter(p => (p.collection || 'curated') === 'curated').length;
    const expandedTotal = puzzles.filter(p => p.collection === 'expanded').length;
    $('bankNote').textContent = `\u9898\u5E93\u603B\u91CF\uFF1A\u7CBE\u9009 ${curatedTotal} \u9898 \u00B7 \u6269\u5C55 ${expandedTotal} \u9898 \u00B7 \u5168\u90E8 ${puzzles.length} \u9898`;
  }

  function prepare(p, countAttempt=true) {
    if (!p) return;
    if (state.failTimer) { clearTimeout(state.failTimer); state.failTimer = null; }
    state.token++;
    state.puzzle = p; state.length = Number(p.mateLength); state.solutionIndex = 0;
    state.selectedFrom = null; state.selectedDrop = null; state.pendingMove = null;
   state.solved = false; state.locked = false; state.enginePending = false; state.answerShown = false;
    state.attemptedMoves = 0; state.undoStack = []; state.paused = false; state.pausedAt = 0; state.pausedMs = 0;
    state.board = Array.from({length:10}, () => Array(10).fill(null));
    for (const piece of p.initial.pieces) {
      const promoted = String(piece.type).startsWith('+');
      state.board[piece.y][piece.x] = { owner:piece.owner, type:promoted ? piece.type.slice(1) : piece.type, promoted };
    }
    state.hands = { attacker:{}, defender:{} };
    for (const owner of ['attacker','defender']) for (const type of TYPES) state.hands[owner][type] = Number(p.initial.hands?.[owner]?.[type] || 0);
    const rec = record(p);
    if (countAttempt) { rec.attempts++; logActivity('attempt', p); }
    rec.lastPlayed = Date.now();
    state.startedAt = Date.now();
    saveProgress(); resetTimer();
    $('problemTitle').textContent = `${p.mateLength}\u624B\u9898\u76EE #${p.id}`;
    $('problemMeta').textContent = `${collectionName(p)} · ${qualityName(p)} · \u96BE\u5EA6\u5206 ${p.score ?? '-'}`;
    $('problemStatus').textContent = rec.solved ? '\u5DF2\u5B8C\u6210\u00B7\u53EF\u91CD\u5237' : '\u672A\u5B8C\u6210';
    $('turnHint').textContent = '\u653B\u65B9\u56DE\u5408'; $('answerLine').textContent = '';
    updateMarkButton(); updateBankUI(); renderSettings(); setFeedback(TEXT.choose); populateList(); renderAll();
  }

  function poolForMode() { return filteredPuzzles(); }
  function randomPuzzle() {
    const pool = poolForMode();
    if (!pool.length) {
      setFeedback(state.wrongOnly ? TEXT.noWrong : state.markedOnly ? TEXT.noMarked : '\u5F53\u524D\u624B\u6570\u6682\u65E0\u9898\u76EE\u3002', 'bad');
      return null;
    }
    let p = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && state.puzzle && p.id === state.puzzle.id && Number(p.mateLength) === Number(state.puzzle.mateLength)) p = pool[(pool.indexOf(p)+1) % pool.length];
    prepare(p); return p;
  }

  function populateList() {
    const select = $('puzzleSelect'); select.innerHTML = '';
    const pool = poolForMode();
    for (const p of pool) {
      const rec = record(p); const option = document.createElement('option'); option.value = key(p);
      option.textContent = `${rec.marked ? '\u2605 ' : ''}#${p.id} \u00B7 ${(p.collection || 'curated') === 'expanded' ? '\u6269\u5C55' : '\u7CBE\u9009'}${rec.solved ? '  \u2713' : ''}`;
      select.appendChild(option);
    }
    if (state.puzzle) select.value = key(state.puzzle);
  }

  function setLength(length) {
    state.length = Number(length); state.markedOnly = false; state.wrongOnly = false;
    document.querySelectorAll('#lengths button').forEach(b => b.classList.toggle('active', Number(b.dataset.length) === state.length));
    updateBankUI(); populateList(); randomPuzzle(); renderStats();
  }
  function setBank(bank) {
    state.bank = bank; state.markedOnly = false; state.wrongOnly = false; settings.bank = bank; saveProgress();
    updateBankUI(); populateList(); randomPuzzle(); renderStats();
  }

  function renderBoard() {
    const el = $('board'); el.innerHTML = '';
    for (let y=1; y<=9; y++) for (let x=9; x>=1; x--) {
      const cell = document.createElement('div'); cell.className='cell'; cell.dataset.x=x; cell.dataset.y=y;
      if (HOSHI.has(String(x) + ',' + String(y))) cell.classList.add('hoshi');
      if (same(state.selectedFrom, [x,y])) cell.classList.add('selected');
      const e = expected();
      if (e && !state.locked && state.solutionIndex % 2 === 0 && ((e.drop && same(e.to,[x,y])) || (!e.drop && (same(e.from,[x,y]) || same(e.to,[x,y]))))) cell.classList.add('hint');
      cell.addEventListener('click', () => cellClick(x,y));
      if (y === 1) {
        const fileCoord = document.createElement('span'); fileCoord.className='coord file'; fileCoord.textContent=String(x); cell.appendChild(fileCoord);
      }
      if (x === 1) {
        const rankCoord = document.createElement('span'); rankCoord.className='coord rank'; rankCoord.textContent=RANKS[y]; cell.appendChild(rankCoord);
      }
      const piece = state.board?.[y]?.[x];
      if (piece) {
        const text = document.createElement('span'); text.className='piece' + (piece.owner === 'defender' ? ' gote' : '') + (piece.promoted ? ' promoted' : '');
        text.textContent = piece.promoted ? (PROMOTED[piece.type] || LABELS[piece.type]) : LABELS[piece.type];
        cell.appendChild(text);
      }
      el.appendChild(cell);
    }
  }

  function renderHands() {
    for (const owner of ['attacker','defender']) {
      const el = $(owner === 'attacker' ? 'attackerHand' : 'defenderHand'); el.innerHTML=''; let any=false;
      for (const type of TYPES) {
        const count = state.hands?.[owner]?.[type] || 0; if (count <= 0) continue; any=true;
        const button = document.createElement('button'); button.className='hand-piece' + (owner === 'attacker' && state.selectedDrop === type ? ' active' : ''); button.textContent=LABELS[type];
        button.title = owner === 'attacker' ? '\u9009\u62E9\u540E\u70B9\u51FB\u76EE\u6807\u683C' : '\u7389\u65B9\u6301\u99D2';
        const countEl=document.createElement('span'); countEl.className='count'; countEl.textContent=count; button.appendChild(countEl);
        if (owner === 'attacker') button.addEventListener('click', () => { if (state.locked || state.solved) return; state.selectedDrop = state.selectedDrop === type ? null : type; state.selectedFrom=null; setFeedback(state.selectedDrop ? '已选' + LABELS[type] + '，请点目标格。' : '已取消持駒。'); renderAll(); });
        else button.disabled=true;
        el.appendChild(button);
      }
      if (!any) el.textContent='\u65E0';
    }
  }

  function renderMoveProgress() {
    const el=$('moveProgress'); if (!el) return;
    if (!state.puzzle) { el.textContent=''; return; }
    const total=attackLimit(state.puzzle), done=Math.min(total,Math.ceil((state.solutionIndex||0)/2));
    el.textContent=`进度 ${done} / ${total}`;
  }
  function renderAll(list=false) { renderBoard(); renderHands(); renderStats(); renderMoveProgress(); updateUndoButton(); if (list) populateList(); }

  function renderStats() {
    const all = puzzles.map(p => ({p, r:record(p)}));
    const solved = all.filter(x => x.r.solved).length;
    const attempts = all.reduce((n,x) => n + Number(x.r.attempts || 0), 0);
    const marked = all.filter(x => x.r.marked).length;
    const markedSolved = all.filter(x => x.r.marked && x.r.solved).length;
    const wrong = all.filter(x => Number(x.r.wrong || 0) > 0).length;
    const failed = all.reduce((n,x) => n + Number(x.r.failed || 0), 0);
    const best = all.map(x => Number(x.r.bestSeconds || 0)).filter(Boolean).sort((a,b) => a-b)[0];
    $('solvedCount').textContent=solved; $('attemptCount').textContent=attempts; $('markedCount').textContent=marked; $('markedSolvedCount').textContent=markedSolved; $('wrongCount').textContent=wrong; $('failedCount').textContent=failed; $('streakCount').textContent=progress.streak || 0; $('bestTime').textContent=best ? `${best}s` : '\u2014';
    const current=all.filter(x => Number(x.p.mateLength)===state.length && bankMatches(x.p));
    const currentSolved=current.filter(x => x.r.solved).length;
    $('lengthProgress').max=Math.max(1,current.length); $('lengthProgress').value=currentSolved; $('lengthProgressText').textContent=`${currentSolved} / ${current.length}`;
    const recovered=all.filter(x => Number(x.r.wrong||0)>0 && x.r.solved).length;
    renderPeriodStats();
    const badges=[
      ['\u521D\u6B21\u7834\u9898',solved>=1], ['\u5C0F\u8BD5\u725B\u5200 \u00B7 \u5B8C\u621010\u9898',solved>=10], ['\u575A\u6301\u8BAD\u7EC3 \u00B7 \u5B8C\u621025\u9898',solved>=25],
      ['\u4E94\u624B\u5165\u95E8',all.some(x => Number(x.p.mateLength)===5 && x.r.solved)], ['\u4E03\u624B\u7A81\u7834',all.some(x => Number(x.p.mateLength)===7 && x.r.solved)], ['\u4E5D\u624B\u6311\u6218',all.some(x => Number(x.p.mateLength)===9 && x.r.solved)],
      ['\u6807\u8BB0\u6E05\u5355\u7A81\u7834',markedSolved>=1], ['\u9519\u9898\u56DE\u6536 \u00B7 \u5B8C\u62105\u9053',recovered>=5], ['\u4E09\u8FDE\u6B63\u786E',Number(progress.streak||0)>=3]
    ];
    $('achievements').innerHTML=badges.map(([name,earned]) => `<div class="achievement ${earned?'earned':''}"><span class="badge">${earned?'✓':'○'}</span><span>${name}</span></div>`).join('');
    updateBankUI();
  }

  function isInside(x,y) { return Number.isInteger(x) && Number.isInteger(y) && x>=1 && x<=9 && y>=1 && y<=9; }
  function promotionZone(owner,y) { return owner === 'attacker' ? y<=3 : y>=7; }
  function pathClear(board,from,to) {
    const sx=Math.sign(to[0]-from[0]), sy=Math.sign(to[1]-from[1]); let x=from[0]+sx, y=from[1]+sy;
    while (x!==to[0] || y!==to[1]) { if (board[y]?.[x]) return false; x+=sx; y+=sy; }
    return true;
  }
  function goldLike(dx,dy,forward) { return (dy===forward && Math.abs(dx)<=1) || (dy===0 && Math.abs(dx)===1) || (dy===-forward && dx===0); }
  function pieceAttacksSquare(piece,from,to,board) {
    if (!piece || !isInside(from[0],from[1]) || !isInside(to[0],to[1]) || (from[0]===to[0] && from[1]===to[1])) return false;
    const dx=to[0]-from[0], dy=to[1]-from[1], adx=Math.abs(dx), ady=Math.abs(dy), forward=piece.owner==='attacker' ? -1 : 1;
    if (piece.promoted && ['P','L','N','S'].includes(piece.type)) return goldLike(dx,dy,forward);
    if (piece.type==='K') return adx<=1 && ady<=1;
    if (piece.type==='G') return goldLike(dx,dy,forward);
    if (piece.type==='S') return (dy===forward && adx<=1) || (dy===-forward && adx===1);
    if (piece.type==='N') return dy===2*forward && adx===1;
    if (piece.type==='P') return dx===0 && dy===forward;
    if (piece.type==='L') return dx===0 && dy*forward>0 && pathClear(board,from,to);
    if (piece.type==='R') return ((dx===0 || dy===0) && pathClear(board,from,to)) || (piece.promoted && adx===1 && ady===1);
    if (piece.type==='B') return (adx===ady && pathClear(board,from,to)) || (piece.promoted && adx+ady===1);
    return false;
  }
  function findKing(board,owner) {
    for (let y=1; y<=9; y++) for (let x=1; x<=9; x++) if (board[y]?.[x]?.owner===owner && board[y][x].type==='K') return [x,y];
    return null;
  }
  function isKingAttacked(board,owner) {
    const king=findKing(board,owner); if (!king) return false;
    const enemy=owner==='attacker' ? 'defender' : 'attacker';
    for (let y=1; y<=9; y++) for (let x=1; x<=9; x++) { const piece=board[y]?.[x]; if (piece?.owner===enemy && pieceAttacksSquare(piece,[x,y],king,board)) return true; }
    return false;
  }
  function promotionOption(move) {
    if (!move || move.drop || !Array.isArray(move.from) || !Array.isArray(move.to)) return 'none';
    const piece=state.board?.[move.from[1]]?.[move.from[0]];
    if (!piece || piece.owner!=='attacker' || piece.promoted || !PROMOTABLE.includes(piece.type)) return 'none';
    if (!promotionZone('attacker',move.from[1]) && !promotionZone('attacker',move.to[1])) return 'none';
    const forced=(piece.type==='P' || piece.type==='L') && move.to[1]===1 || piece.type==='N' && move.to[1]<=2;
    return forced ? 'force' : 'choice';
  }
  function validateAttack(move) {
    const bad=message => ({ok:false,message:message});
    if (!move || !Array.isArray(move.to) || !isInside(move.to[0],move.to[1])) return bad('目标格无效。');
    const board=state.board, hands=state.hands, target=board[move.to[1]]?.[move.to[0]];
    if (move.drop) {
      if (!TYPES.includes(move.drop) || Number(hands.attacker?.[move.drop]||0)<=0) return bad('持駒不足。');
      if (target) return bad('打駒必须落在空格。');
      if ((move.drop==='P' || move.drop==='L') && move.to[1]===1 || move.drop==='N' && move.to[1]<=2) return bad('歩・香・桂はこの段に打てません。');
      if (move.drop==='P') for (let y=1; y<=9; y++) if (board[y]?.[move.to[0]]?.owner==='attacker' && board[y][move.to[0]].type==='P' && !board[y][move.to[0]].promoted) return bad('二歩。');
    } else {
      if (!Array.isArray(move.from) || !isInside(move.from[0],move.from[1])) return bad('起点无效。');
      const piece=board[move.from[1]]?.[move.from[0]];
      if (!piece || piece.owner!=='attacker') return bad('请选攻方棋子。');
      if (target?.owner==='attacker') return bad('不能走到己方棋子上。');
      if (target?.owner==='defender' && target.type==='K') return bad('玉不能直接取。');
      if (!pieceAttacksSquare(piece,move.from,move.to,board)) return bad('この駒は指せません。');
      const inZone=promotionZone('attacker',move.from[1]) || promotionZone('attacker',move.to[1]);
      if (move.promote && (piece.promoted || !PROMOTABLE.includes(piece.type) || !inZone)) return bad('成れません。');
      if (!piece.promoted && !move.promote && ((piece.type==='P' || piece.type==='L') && move.to[1]===1 || piece.type==='N' && move.to[1]<=2)) return bad('成りが必要です。');
    }
    const savedBoard=state.board, savedHands=state.hands;
    state.board=clone(board); state.hands=clone(hands);
    try {
      applyMove(move,'attacker');
      if (isKingAttacked(state.board,'attacker')) return bad('攻方玉が王手です。');
      if (!isKingAttacked(state.board,'defender')) return bad('王手ではありません。');
      return {ok:true};
    } finally { state.board=savedBoard; state.hands=savedHands; }
  }
  function isValidDefenderReply(move) {
    if (!move || !Array.isArray(move.to) || !isInside(move.to[0],move.to[1])) return false;
    const board=state.board, hands=state.hands, target=board[move.to[1]]?.[move.to[0]];
    if (move.drop) {
      if (!TYPES.includes(move.drop) || Number(hands.defender?.[move.drop]||0)<=0 || target) return false;
      if ((move.drop==='P' || move.drop==='L') && move.to[1]===9 || move.drop==='N' && move.to[1]>=8) return false;
      if (move.drop==='P') for (let y=1; y<=9; y++) if (board[y]?.[move.to[0]]?.owner==='defender' && board[y][move.to[0]].type==='P' && !board[y][move.to[0]].promoted) return false;
    } else {
      if (!Array.isArray(move.from) || !isInside(move.from[0],move.from[1])) return false;
      const piece=board[move.from[1]]?.[move.from[0]];
      if (!piece || piece.owner!=='defender') return false;
      if (target?.owner==='defender' || target?.type==='K') return false;
      if (!pieceAttacksSquare(piece,move.from,move.to,board)) return false;
      const inZone=promotionZone('defender',move.from[1]) || promotionZone('defender',move.to[1]);
      if (move.promote && (piece.promoted || !PROMOTABLE.includes(piece.type) || !inZone)) return false;
      if (!piece.promoted && !move.promote && ((piece.type==='P' || piece.type==='L') && move.to[1]===9 || piece.type==='N' && move.to[1]>=8)) return false;
    }
    const savedBoard=state.board, savedHands=state.hands;
    state.board=clone(board); state.hands=clone(hands);
    try {
      applyMove(move,'defender');
      return !isKingAttacked(state.board,'defender');
    } finally { state.board=savedBoard; state.hands=savedHands; }
  }
  function cellClick(x,y) {
    if (!state.puzzle || state.solved || state.locked) return;
    if (state.selectedDrop) { attempt({drop:state.selectedDrop,to:[x,y],promote:false}); return; }
    const piece=state.board[y][x];
    if (!state.selectedFrom) { if (piece?.owner === 'attacker') { state.selectedFrom=[x,y]; setFeedback('已选' + LABELS[piece.type] + '，请选目标格。'); renderBoard(); } return; }
    if (piece?.owner === 'attacker') { state.selectedFrom=[x,y]; setFeedback('已选' + LABELS[piece.type] + '，请选目标格。'); renderBoard(); return; }
    state.pendingMove={from:state.selectedFrom,to:[x,y]}; state.selectedFrom=null;
    const option=promotionOption(state.pendingMove); if (option==='choice') showPromotion(); else attempt({...state.pendingMove,promote:option==='force'});
 }
  function showPromotion() { $('promotionModal').classList.add('show'); }
  function closePromotion() { $('promotionModal').classList.remove('show'); state.pendingMove=null; }
  function tryPromotion(value) { const move=state.pendingMove; closePromotion(); if (move) attempt({...move,promote:value}); }
  function flashWrong(move) { const x=move.to?.[0], y=move.to?.[1]; if (!x || !y) return; requestAnimationFrame(() => { const c=document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`); if (c) { c.classList.add('wrong'); setTimeout(() => c.classList.remove('wrong'),500); } }); }

  function applyMove(move, owner) {
    if (move.drop) {
      state.hands[owner][move.drop]=Math.max(0,(state.hands[owner][move.drop]||0)-1);
      state.board[move.to[1]][move.to[0]]={owner,type:move.drop,promoted:false}; return;
    }
    const piece=state.board[move.from[1]][move.from[0]]; const captured=state.board[move.to[1]][move.to[0]];
    if (captured && captured.owner!==owner && captured.type!=='K') state.hands[owner][captured.type]=(state.hands[owner][captured.type]||0)+1;
    state.board[move.from[1]][move.from[0]]=null;
    if (piece) { piece.promoted=piece.promoted||Boolean(move.promote); state.board[move.to[1]][move.to[0]]=piece; }
  }

  function sfenPiece(piece) {
    let symbol = piece.type;
    if (piece.owner === 'defender') symbol = symbol.toLowerCase();
    return piece.promoted ? `+${symbol}` : symbol;
  }
  function currentSfen() {
    const rows=[];
    for (let y=1; y<=9; y++) {
      let row='', empty=0;
      for (let x=9; x>=1; x--) {
        const piece=state.board[y][x];
        if (!piece) { empty++; continue; }
        if (empty) { row+=empty; empty=0; }
        row+=sfenPiece(piece);
      }
      if (empty) row+=empty;
      rows.push(row);
    }
    const handParts=[];
    const handLetters={R:'R',B:'B',G:'G',S:'S',N:'N',L:'L',P:'P'};
    for (const owner of ['attacker','defender']) for (const type of TYPES) {
      const count=Number(state.hands[owner][type]||0); if (!count) continue;
      const letter=owner==='attacker' ? handLetters[type] : handLetters[type].toLowerCase();
      handParts.push(`${count>1?count:''}${letter}`);
    }
    const side=state.solutionIndex%2===0 ? 'b' : 'w';
    return `${rows.join('/')} ${side} ${handParts.join('') || '-'} ${1+state.solutionIndex}`;
  }
  function formatUsi(move) {
    if (move.drop) return `${move.drop}*${move.to[0]}${USI_RANKS[move.to[1]]}`;
    return `${move.from[0]}${USI_RANKS[move.from[1]]}${move.to[0]}${USI_RANKS[move.to[1]]}${move.promote?'+':''}`;
  }
  function parseUsi(token) {
    if (typeof token !== 'string') return null;
    const value=token.trim();
    if (/^[RBGSLNP]\*[1-9][a-i]$/.test(value)) return {drop:value[0],to:[Number(value[2]),USI_RANKS.indexOf(value[3])],promote:false};
    if (/^[1-9][a-i][1-9][a-i]\+?$/.test(value)) return {from:[Number(value[0]),USI_RANKS.indexOf(value[1])],to:[Number(value[2]),USI_RANKS.indexOf(value[3])],promote:value.endsWith('+')};
    return null;
  }

  function updateUndoButton() {
    const button=$('undoButton'); if (!button) return;
    button.disabled=!state.puzzle || state.locked || state.solved || !state.undoStack.length;
     button.title=button.disabled ? '\u6682\u65E0\u53EF\u6094\u7740\u6CD5' : '\u64A4\u56DE\u6700\u8FD1\u7EC4\u653B\u65B9\u7740\u624B\u4E0E\u7389\u65B9\u5E94\u624B';
  }
  function undo() {
    if (!state.puzzle || state.solved || state.locked || !state.undoStack.length) return;
    const snapshot=state.undoStack.pop();
    state.board=snapshot.board; state.hands=snapshot.hands; state.solutionIndex=snapshot.solutionIndex;
    state.answerShown=Boolean(snapshot.answerShown); state.selectedFrom=null; state.selectedDrop=null; state.pendingMove=null; state.enginePending=false; state.token++;
    $('problemStatus').textContent=record(state.puzzle).solved ? '\u5DF2\u5B8C\u6210\u00B7\u53EF\u91CD\u5237' : '\u672A\u5B8C\u6210';
    $('turnHint').textContent='\u653B\u65B9\u56DE\u5408';
    $('answerLine').textContent=state.answerShown ? '\u53C2\u8003\u624B\u987A\uFF1A' + allMoves() : '';
     setFeedback('\u5DF2\u6094\u68CB\u3002');
    renderAll();
  }
  function finishReply(move, usedEngine, puzzle, token, detail='') {
    if (state.puzzle !== puzzle || state.token !== token || state.solved) return;
    if (!isValidDefenderReply(move)) {
      state.locked=true; state.enginePending=false; $('turnHint').textContent='\u9700\u8981\u7389\u65B9\u5E94\u624B';
      setFeedback('\u7389\u65B9\u5E94\u624B\u65E0\u6548\uFF0C\u8BF7\u91CD\u5F00\u3002','bad'); renderAll(); return;
    }
    applyMove(move,'defender'); state.solutionIndex++; state.locked=false; state.enginePending=false;
   $('turnHint').textContent='\u653B\u65B9\u56DE\u5408';
   const suffix=detail ? ` ${detail}` : '';
   setFeedback(usedEngine ? `\u7389\u65B9\u5E94\u624B\uFF08\u5F15\u64CE\uFF09\uFF1A${formatMove(move)}\u3002${suffix}` : `\u7389\u65B9\u5E94\u624B\uFF1A${formatMove(move)}\u3002${suffix}`);
    if (usedEngine) setEngineStatus('ok','\u7389\u65B9\u5E94\u624B\u5C31\u7EEA');
    renderAll();
  }
  function fallbackReply(move, puzzle, token, detail='') {
    if (!isValidDefenderReply(move)) {
      state.locked=true; state.enginePending=false; $('turnHint').textContent='\u9700\u8981\u7389\u65B9\u5E94\u624B';
       setFeedback((detail || TEXT.engineOff) + ' \u9898\u5E93\u5E94\u624B\u4E0D\u9002\u7528\uFF0C\u8BF7\u91CD\u5F00\u3002','bad'); renderAll(); return;
    }
    state.locked=true; state.enginePending=false; $('turnHint').textContent='\u7389\u65B9\u5E94\u624B'; renderAll();
    setTimeout(() => finishReply(move,false,puzzle,token,detail), 60);
 }

  function requestDefenderReply(sfen) {
    const controller=new AbortController();
    const timeout=setTimeout(() => controller.abort(), 1500);
    return fetch('/api/engine/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sfen:sfen}),signal:controller.signal})
     .then(async response => {
       let data;
       try { data=await response.json(); } catch (_) { throw new Error('invalid-responder-response'); }
       if (!response.ok || !data.ok) throw new Error(data.reason || 'responder-failed');
       return {ok:true,data:data};
      })
     .catch(error => ({ok:false,error:error}))
     .finally(() => clearTimeout(timeout));
  }

  async function engineReply(sfen, fallbackReplyMove, puzzle, token) {
    if (state.puzzle !== puzzle || state.token !== token || state.solved) return;
    if (state.solutionIndex>=Number(puzzle.mateLength)) { complete(); return; }
    const useFallback = detail => {
      if (state.puzzle !== puzzle || state.token !== token || state.solved) return;
      const rec=record(puzzle); rec.engineFallbacks++; rec.lastPlayed=Date.now(); saveProgress();
      if (!fallbackReplyMove) {
        state.locked=true; state.enginePending=false; $('turnHint').textContent='\u9700\u8981\u7389\u65B9\u5E94\u624B';
        setEngineStatus('off','\u9898\u5E93\u5E94\u624B'); setFeedback((detail || TEXT.engineOff) + ' \u4F7F\u7528\u9898\u5E93\u5E94\u624B\uFF0C\u8BF7\u91CD\u5F00\u3002','bad'); renderAll();
        return;
      }
      fallbackReply(fallbackReplyMove,puzzle,token,detail);
    };
    if (!BRIDGE || settings.engineEnabled === false) {
      useFallback('\u5F53\u524D\u5DF2\u5173\u95ED\u5E94\u624B\u5F15\u64CE\u3002');
      return;
    }
    state.locked=true; state.enginePending=true; $('turnHint').textContent='\u7389\u65B9\u5E94\u624B\u4E2D'; setEngineStatus('thinking','\u5E94\u624B\u4E2D'); setFeedback(TEXT.engineThinking,'pending'); renderAll();
    const result=await requestDefenderReply(sfen);
    if (state.puzzle !== puzzle || state.token !== token || state.solved) return;
    if (!result.ok) { engineAvailable=false; engineChecked=true; setEngineStatus('off','\u4F7F\u7528\u9898\u5E93\u5E94\u624B'); useFallback(TEXT.engineOff); return; }
    const data=result.data; engineAvailable=true; engineChecked=true; setEngineStatus('ok','\u7389\u65B9\u5E94\u624B\u5C31\u7EEA');
    const reply=parseUsi(data.reply);
    if (!reply || !isValidDefenderReply(reply)) { useFallback(TEXT.engineOff); return; }
    finishReply(reply,true,puzzle,token,data.engineMs ? ('\u7528\u65F6 ' + data.engineMs + 'ms') : '');
  }
  function pushHistory(p, result) {
    if (!Array.isArray(progress.history)) progress.history=[];
    progress.history.unshift({key:key(p), result, seconds:elapsedSeconds(), at:Date.now()});
    progress.history=progress.history.slice(0,40);
  }
  function failPuzzle(reason) {
    if (!state.puzzle || state.solved || state.failTimer) return;
    const p=state.puzzle, rec=record(p); rec.failed++; rec.lastFailedAt=Date.now(); progress.failures=Number(progress.failures||0)+1; pushHistory(p,'failed'); logActivity('failed',p,{seconds:elapsedSeconds()}); saveProgress();
    pauseTimer(); state.locked=true; state.enginePending=false; $('problemStatus').textContent='\u5224\u5B9A\u5931\u8D25'; $('turnHint').textContent='\u5373\u5C06\u91CD\u5F00'; setFeedback(`${reason} <strong>\u91CD\u5F00\u4E2D\u2026</strong>`,'fail'); renderAll();
    const token=state.token; state.failTimer=setTimeout(() => { state.failTimer=null; if (state.puzzle===p && state.token===token) prepare(p,true); },900);
  }

  function attempt(move) {
    if (!state.puzzle || state.solved || state.locked) return;
    const puzzle=state.puzzle; state.attemptedMoves++;
    if (settings.strictSteps && state.attemptedMoves > attackLimit(puzzle)) { failPuzzle(TEXT.overLimit); return; }
    state.selectedFrom=null; state.selectedDrop=null;
    const rule=validateAttack(move);
    if (!rule.ok) {
      const rec=record(puzzle); rec.wrong++; rec.lastPlayed=Date.now(); logActivity('wrong', puzzle); saveProgress();
      const lastChance=settings.strictSteps && state.attemptedMoves===attackLimit(puzzle) ? ' <strong>\u6700\u540E\u4E00\u6B21\u3002</strong>' : '';
      setFeedback(rule.message + lastChance,'bad'); flashWrong(move); renderAll(); return;
    }
    const snapshot={board:clone(state.board), hands:clone(state.hands), solutionIndex:state.solutionIndex, answerShown:state.answerShown};
    state.undoStack.push(snapshot);
    applyMove(move,'attacker'); state.solutionIndex++; setFeedback(TEXT.correct + formatMove(move) + '\u3002','good');
    const fallback=state.solutionIndex<Number(puzzle.mateLength) ? clone(expected()) : null;
    const token=state.token;
    engineReply(currentSfen(),fallback,puzzle,token);
  }

  function complete() {
    const p=state.puzzle, rec=record(p); if (state.solved) return;
    const seconds=elapsedSeconds(); state.solved=true; state.locked=false; state.enginePending=false; rec.solved=true; rec.solvedAt=Date.now(); rec.seconds=seconds; rec.bestSeconds=rec.bestSeconds ? Math.min(rec.bestSeconds,seconds) : seconds;
    const today=dateKey(); if (progress.lastSolvedDate!==today) { const yesterday=dateKey(new Date(Date.now()-86400000)); progress.streak=progress.lastSolvedDate===yesterday ? Number(progress.streak||0)+1 : 1; progress.lastSolvedDate=today; }
    pushHistory(p,'solved'); logActivity('solved',p,{seconds:seconds}); saveProgress(); pauseTimer();
    $('problemStatus').textContent='\u5DF2\u5B8C\u6210'; $('turnHint').textContent='\u5B8C\u6210'; $('answerLine').textContent='\u53C2\u8003\u624B\u987A\uFF1A' + allMoves(); setFeedback('\u5B8C\u6210\uFF01 #' + p.id + ' \u00B7 ' + p.mateLength + '\u624B\u3002','good'); renderAll();
  }

  function hint() {
    const e=expected(); if (!e || state.solved || state.locked) return;
    const rec=record(state.puzzle); rec.hints++; rec.lastPlayed=Date.now(); saveProgress();
    setFeedback(e.drop ? '提示：' + coord(e.to) + ' 打。' : '提示：' + coord(e.from) + ' → ' + coord(e.to) + (e.promote ? '（成）' : '')); renderBoard();
  }
  function answer() {
    if (!state.puzzle) return; const rec=record(state.puzzle); rec.answerShown++; rec.lastPlayed=Date.now(); state.answerShown=true; pauseTimer(); saveProgress(); $('answerLine').textContent='参考手顺：' + allMoves(); setFeedback('参考手顺已显示，计时暂停。'); renderAll();
  }
  function toggleMark() {
    if (!state.puzzle) return; const rec=record(state.puzzle); rec.marked=!rec.marked; saveProgress(); updateMarkButton(); populateList(); renderStats(); setFeedback(rec.marked ? '\u5DF2\u6807\u8BB0\u3002\u53EF\u4ECE\u6807\u8BB0\u91CD\u5237\u8FDB\u5165\u3002' : '\u5DF2\u53D6\u6D88\u6807\u8BB0\u3002');
  }
  function updateMarkButton() { const marked=state.puzzle && record(state.puzzle).marked; $('markButton').textContent=marked ? '★ \u5DF2\u6807\u8BB0' : '☆ \u6807\u8BB0'; }
  function restart() { if (state.puzzle) prepare(state.puzzle,true); }
  function skip() {
    if (!state.puzzle) return; const p=state.puzzle, rec=record(p); rec.skipped++; rec.lastPlayed=Date.now(); pushHistory(p,'skipped'); logActivity('skipped',p); saveProgress(); state.markedOnly=false; state.wrongOnly=false; const next=randomPuzzle(); if (next) setFeedback('\u5DF2\u8DF3\u8FC7\u3002');
  }
  function markedRandom() { state.markedOnly=true; state.wrongOnly=false; populateList(); if (!filteredPuzzles().length) { state.markedOnly=false; populateList(); setFeedback(TEXT.noMarked,'bad'); return; } randomPuzzle(); }
  function wrongRandom() { state.wrongOnly=true; state.markedOnly=false; populateList(); if (!filteredPuzzles().length) { state.wrongOnly=false; populateList(); setFeedback(TEXT.noWrong,'bad'); return; } randomPuzzle(); }
  function daily() {
    state.markedOnly=false; state.wrongOnly=false; const pool=puzzles.filter(p => Number(p.mateLength)===state.length && bankMatches(p)); if (!pool.length) return;
    const text=dateKey(), hash=[...text].reduce((n,c) => (n*31+c.charCodeAt(0))|0,0); const p=pool[Math.abs(hash)%pool.length]; prepare(p); setFeedback('今日题：' + p.mateLength + '手 #' + p.id + '。');
  }

  async function checkEngine() {
    if (!BRIDGE) { engineChecked=true; setEngineStatus('off','\u8BF7\u7528 Start.bat'); return; }
    try {
      const response=await fetch('/api/health',{cache:'no-store'}); const data=await response.json();
      engineAvailable=Boolean(response.ok && (data.responder || data.engine)); engineChecked=true;
      setEngineStatus(engineAvailable ? 'ok' : 'off', engineAvailable ? '\u7389\u65B9\u5E94\u624B\u5C31\u7EEA' : '\u672A\u627E\u5230\u5E94\u624B\u5F15\u64CE');
    } catch (_) { engineAvailable=false; engineChecked=true; setEngineStatus('off','\u8BF7\u91CD\u65B0\u542F\u52A8'); }
  }
  function reset() {
    if (!confirm('\u786E\u5B9A\u6E05\u9664\u6240\u6709\u672C\u5730\u8BAD\u7EC3\u8BB0\u5F55\u5417\uFF1F')) return;
    const savedSettings={...settings}; progress={records:{},streak:0,lastSolvedDate:'',history:[],activity:[],settings:savedSettings}; saveProgress();
    if (state.puzzle) prepare(state.puzzle,false); renderAll(true);
  }
  function saveSetting() { progress.settings=settings; saveProgress(); }

  document.querySelectorAll('#banks button').forEach(button => button.addEventListener('click', () => setBank(button.dataset.bank)));
  document.querySelectorAll('#lengths button').forEach(button => button.addEventListener('click', () => setLength(button.dataset.length)));
  document.querySelectorAll('#statPeriods button').forEach(button => button.addEventListener('click', () => { settings.statsPeriod=button.dataset.period; saveSetting(); renderPeriodStats(); }));
  $('randomButton').addEventListener('click', () => { state.markedOnly=false; state.wrongOnly=false; populateList(); randomPuzzle(); });
  $('markedButton').addEventListener('click', markedRandom); $('wrongButton').addEventListener('click', wrongRandom); $('dailyButton').addEventListener('click', daily);
  $('onlineButton').addEventListener('click', () => window.open('https://tokuhirom.github.io/tanuki-tsume-shogi/','_blank','noopener'));
  $('puzzleSelect').addEventListener('change', event => { const p=puzzles.find(item => key(item)===event.target.value); if (p) { state.markedOnly=false; state.wrongOnly=false; prepare(p,true); } });
  $('nextButton').addEventListener('click', () => { state.markedOnly=false; state.wrongOnly=false; populateList(); randomPuzzle(); });
  $('restartButton').addEventListener('click', restart); $('undoButton').addEventListener('click', undo); $('skipButton').addEventListener('click', skip); $('hintButton').addEventListener('click', hint); $('answerButton').addEventListener('click', answer); $('markButton').addEventListener('click', toggleMark); $('resetButton').addEventListener('click', reset);
  $('noPromoteButton').addEventListener('click', () => tryPromotion(false)); $('promoteButton').addEventListener('click', () => tryPromotion(true));
  $('engineToggle').addEventListener('change', event => { settings.engineEnabled=event.target.checked; saveSetting(); if (!settings.engineEnabled) setEngineStatus('off','\u5DF2\u5173\u95ED'); else { checkEngine(); } });
  $('strictSteps').addEventListener('change', event => { settings.strictSteps=event.target.checked; saveSetting(); renderSettings(); });
  document.addEventListener('keydown', event => {
    if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const k=event.key.toLowerCase(); if (k==='h') hint(); else if (k==='n') randomPuzzle(); else if (k==='m') toggleMark(); else if (k==='r') restart(); else if (k==='u' || (event.ctrlKey && k==='z')) undo();
  });

  updateBankUI(); renderSettings(); populateList(); prepare(puzzles.find(p => Number(p.mateLength)===5 && bankMatches(p)) || puzzles[0], true); checkEngine();
})();
