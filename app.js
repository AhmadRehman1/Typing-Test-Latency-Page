'use strict';

/* ============================================================
   Shared: tabs
   ============================================================ */

const tabBtns = document.querySelectorAll('.tab-btn');
const panels = {
  typing: document.getElementById('panel-typing'),
  latency: document.getElementById('panel-latency'),
  history: document.getElementById('panel-history'),
};

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    Object.values(panels).forEach((p) => p.classList.remove('active'));
    panels[btn.dataset.tab].classList.add('active');

    if (btn.dataset.tab === 'latency') {
      latency.stopKeyListener(); // stage is inactive until Start pressed
    } else if (btn.dataset.tab === 'typing') {
      typeInput.focus();
    } else if (btn.dataset.tab === 'history') {
      renderHistoryView();
    }
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
  if (activeTab === 'typing') startNewTypingTest();
  else if (activeTab === 'latency') resetLatencyTest();
});

/* ============================================================
   Shared: Session History
   ============================================================ */

const HISTORY_TYPING_KEY = 'typingTester.history.typing';
const HISTORY_LATENCY_KEY = 'typingTester.history.latency';
const HISTORY_MAX_ENTRIES = 200;

function loadHistory(key) {
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function appendHistory(key, entry) {
  const list = loadHistory(key);
  list.push(entry);
  if (list.length > HISTORY_MAX_ENTRIES) list.splice(0, list.length - HISTORY_MAX_ENTRIES);
  localStorage.setItem(key, JSON.stringify(list));
}

function computeStreak() {
  // entries are stored as UTC ISO timestamps, so the streak walk stays in UTC
  // calendar days throughout — mixing in local-time day boundaries here would
  // drop or duplicate a day for anyone not at UTC+0.
  const dates = [...loadHistory(HISTORY_TYPING_KEY), ...loadHistory(HISTORY_LATENCY_KEY)]
    .map((e) => e.date.slice(0, 10));
  const daySet = new Set(dates);
  if (daySet.size === 0) return 0;

  const msPerDay = 86400000;
  const toKey = (ms) => new Date(ms).toISOString().slice(0, 10);
  let cursor = Date.parse(toKey(Date.now()) + 'T00:00:00Z');
  if (!daySet.has(toKey(cursor))) cursor -= msPerDay;

  let streak = 0;
  while (daySet.has(toKey(cursor))) {
    streak++;
    cursor -= msPerDay;
  }
  return streak;
}

function renderTrendChart(svgEl, values, lowerIsBetter) {
  if (values.length < 2) {
    svgEl.innerHTML = '';
    return;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 300;
      const normalized = lowerIsBetter ? (max - v) / range : (v - min) / range;
      const y = 76 - normalized * 68;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  svgEl.innerHTML = `<polyline class="wpm-line" points="${points}" />`;
}

const streakValueEl = document.getElementById('streakValue');
const historySessionCountEl = document.getElementById('historySessionCount');
const historyBestWpmEl = document.getElementById('historyBestWpm');
const historyBestLatencyEl = document.getElementById('historyBestLatency');
const historyWpmChartEl = document.getElementById('historyWpmChart');
const historyLatencyChartEl = document.getElementById('historyLatencyChart');
const historyLogEl = document.getElementById('historyLog');
const exportHistoryBtn = document.getElementById('exportHistory');
const clearHistoryBtn = document.getElementById('clearHistory');

function renderHistoryView() {
  const typingHist = loadHistory(HISTORY_TYPING_KEY);
  const latencyHist = loadHistory(HISTORY_LATENCY_KEY);

  streakValueEl.textContent = computeStreak();
  historySessionCountEl.textContent = typingHist.length + latencyHist.length;

  const bestWpm = loadBestWpm();
  const bestLatency = loadBestLatency();
  historyBestWpmEl.textContent = bestWpm === null ? '–' : Math.round(bestWpm);
  historyBestLatencyEl.textContent = bestLatency === null ? '–' : Math.round(bestLatency);

  renderTrendChart(historyWpmChartEl, typingHist.slice(-30).map((e) => e.wpm), false);
  renderTrendChart(historyLatencyChartEl, latencyHist.slice(-30).map((e) => e.avgMs), true);

  const combined = [
    ...typingHist.map((e) => ({ ...e, kind: 'Typing' })),
    ...latencyHist.map((e) => ({ ...e, kind: 'Latency' })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 25);

  historyLogEl.innerHTML = combined.length === 0
    ? '<li><span>No sessions logged yet — finish a test to start your history.</span></li>'
    : combined
        .map((e) => {
          const when = new Date(e.date).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          const summary = e.kind === 'Typing' ? `${e.wpm} WPM · ${e.accuracy}%` : `${e.avgMs}ms avg`;
          return `<li><span>${when} · ${e.kind}</span><span class="lat-ms">${summary}</span></li>`;
        })
        .join('');
}

function exportHistoryData() {
  const data = {
    exportedAt: new Date().toISOString(),
    typing: loadHistory(HISTORY_TYPING_KEY),
    latency: loadHistory(HISTORY_LATENCY_KEY),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `typing-latency-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearHistoryData() {
  if (!confirm('Clear all saved session history? This cannot be undone.')) return;
  localStorage.removeItem(HISTORY_TYPING_KEY);
  localStorage.removeItem(HISTORY_LATENCY_KEY);
  renderHistoryView();
}

exportHistoryBtn.addEventListener('click', exportHistoryData);
clearHistoryBtn.addEventListener('click', clearHistoryData);

/* ============================================================
   Typing Speed Test
   ============================================================ */

const SENTENCES = [
  'The quick brown fox jumps over the lazy dog.',
  'A gentle breeze drifted through the open window.',
  'She smiled and closed the book before turning off the light.',
  'Practice does not make perfect, but it does make progress.',
  'The old clock on the wall ticked steadily through the night.',
  'He poured a cup of coffee and watched the rain fall.',
  'Learning to type quickly takes patience and consistent practice.',
  'The mountain trail wound upward through tall pine trees.',
  'Somewhere in the city, a train rumbled across the bridge.',
  'Good habits are built one small decision at a time.',
  'The garden was full of color after the spring rain.',
  'A calm mind often leads to clearer decisions.',
  'They walked along the shore as the sun began to set.',
  'Every keystroke brings you closer to mastering the keyboard.',
  'The library was quiet except for the turning of pages.',
  'Simple tools, used well, can solve complicated problems.',
  'The chef added a pinch of salt and stirred the soup.',
  'Clouds gathered slowly over the valley before the storm.',
  'He typed the report twice to make sure it was correct.',
  'A small dog barked at the mail carrier down the street.',
  'The scientist recorded every result in a small notebook.',
  'Music drifted from the open door of the old cafe.',
  'Consistency matters more than speed when you are learning.',
  'The bridge stretched far across the wide, quiet river.',
  'She checked her watch and hurried toward the station.',
  'New ideas often come from asking simple questions.',
  'The bakery smelled of fresh bread every single morning.',
  'A well organized desk can make the whole day easier.',
  'Rain tapped gently against the window as they talked.',
  'The team reviewed the plan one more time before lunch.',
  'The morning fog lifted slowly over the quiet fields.',
  'He checked his email twice before leaving for the office.',
  'The old bookstore on the corner still smelled of paper and dust.',
  'A soft rain began just as the game ended.',
  'She tied her shoes and stepped out into the cold air.',
  'The recipe called for more sugar than she expected.',
  'Traffic slowed to a crawl near the construction site.',
  'The children built a small fort out of couch cushions.',
  'His phone buzzed twice before he finally answered it.',
  'The museum was nearly empty on a weekday afternoon.',
  'A warm cup of tea helped calm her nerves before the meeting.',
  'The printer jammed again right before the deadline.',
  'They planted tomatoes and peppers along the back fence.',
  'The subway was delayed, so she read another chapter of her book.',
  'He tightened the last bolt and stepped back to check his work.',
  'The lake was perfectly still in the early evening light.',
  'She organized her notes before the exam started.',
  'A gentle wind carried the smell of fresh cut grass.',
  'The waiter brought the check without being asked twice.',
  'He practiced the same piano piece until it felt effortless.',
  'The hikers reached the summit just before the clouds rolled in.',
  'Her desk was covered in sticky notes and half finished lists.',
  'The bus arrived exactly on time for once.',
  'A single lamp lit the room while the storm passed outside.',
  'He saved the file twice, just to be safe.',
  'The bread rose slowly on the counter overnight.',
  'She adjusted the thermostat and settled back into her chair.',
  'The dog waited patiently by the door for its evening walk.',
  'New employees spent their first week learning the software.',
  'The bridge lights reflected off the calm water below.',
  'He double checked the address before leaving the house.',
  'The classroom fell quiet as the teacher began to speak.',
  'A late season storm knocked out power for a few hours.',
  'She folded the laundry while listening to an old podcast.',
  'The engineers reviewed the blueprint one final time.',
  'Morning traffic gave way to a quiet afternoon.',
  'He replaced the batteries and the remote worked again.',
  'The orchard was full of ripe apples by early autumn.',
  'She whispered the answer so only her friend could hear.',
  'The airport announcement echoed through the crowded terminal.',
  'A thin layer of frost covered the windshield at dawn.',
  'He sorted the mail into three separate piles.',
  'The coach called a timeout with two minutes left.',
  'Her handwriting grew neater the more she practiced.',
  'The ferry crossed the bay just as the sun was setting.',
  'They repainted the fence a pale shade of blue.',
  'The office was silent except for the hum of the printer.',
  'A curious cat watched from the windowsill all afternoon.',
  'He measured the room twice before ordering the carpet.',
  'The candles flickered as someone opened the front door.',
  'She reviewed her notes one last time before the interview.',
  'The farmers market opened early on Saturday mornings.',
  'A narrow trail wound through the dense forest.',
  'He backed up his files before updating the software.',
  'The choir rehearsed the same song for nearly an hour.',
  'Snow began to fall just as the shops were closing.',
  'She sketched the skyline from the rooftop cafe.',
  'The engine sputtered once before finally starting.',
  'A quiet street lamp lit the empty sidewalk.',
  'He labeled each box before loading the moving truck.',
  'The tide slowly crept up over the smooth sand.',
  'She set three alarms just in case she overslept.',
  'The library extended its hours during exam season.',
  'A flock of geese flew low over the open field.',
  'He compared prices at three different stores before buying.',
  'The kettle whistled just as the phone started to ring.',
  'Her umbrella barely survived the sudden gust of wind.',
  'The team celebrated quietly after a long week of work.',
  'A narrow beam of light cut through the dusty attic.',
  'He rewound the tape to listen to the interview again.',
];

const PASSAGE_LENGTHS = { short: 12, medium: 24, long: 45 };

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generatePassage(length) {
  const target = PASSAGE_LENGTHS[length] || PASSAGE_LENGTHS.medium;
  const pool = shuffle(SENTENCES.slice());
  const chosen = [];
  let wordCount = 0;
  for (const sentence of pool) {
    if (wordCount >= target) break;
    chosen.push(sentence);
    wordCount += sentence.trim().split(/\s+/).length;
  }
  if (chosen.length === 0) chosen.push(pool[0]);
  return chosen.join(' ');
}

const passageEl = document.getElementById('passage');
const typeInput = document.getElementById('typeInput');
const wpmLiveEl = document.getElementById('wpmLive');
const accLiveEl = document.getElementById('accLive');
const timeLiveEl = document.getElementById('timeLive');
const wpmBestEl = document.getElementById('wpmBest');
const restartTypingBtn = document.getElementById('restartTyping');
const passageLengthSelect = document.getElementById('passageLength');
const typingResultsEl = document.getElementById('typingResults');
const tryAgainBtn = document.getElementById('tryAgain');
const resWpm = document.getElementById('resWpm');
const resAcc = document.getElementById('resAcc');
const resTime = document.getElementById('resTime');
const resErrors = document.getElementById('resErrors');
const wpmChartEl = document.getElementById('wpmChart');

const BEST_WPM_KEY = 'typingTester.bestWpm';

const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

const typing = {
  passage: '',
  startTime: null,
  finished: false,
  tickInterval: null,
  prevValue: '',
  totalKeystrokes: 0,
  errorKeystrokes: 0,
  wpmSamples: [],
};

function loadBestWpm() {
  const v = parseFloat(localStorage.getItem(BEST_WPM_KEY));
  return isNaN(v) ? null : v;
}

function saveBestWpmIfBetter(wpm) {
  const best = loadBestWpm();
  if (best === null || wpm > best) {
    localStorage.setItem(BEST_WPM_KEY, String(wpm));
    return wpm;
  }
  return best;
}

function renderBestWpm() {
  const best = loadBestWpm();
  wpmBestEl.textContent = best === null ? '–' : Math.round(best);
}

function renderPassage() {
  passageEl.innerHTML = typing.passage
    .split('')
    .map((ch, i) => `<span class="char-pending" data-i="${i}">${escapeHtml(ch)}</span>`)
    .join('');
  passageEl.querySelector('span').classList.add('char-current');
  passageEl.querySelector('span').classList.remove('char-pending');
}

function escapeHtml(ch) {
  if (ch === '&') return '&amp;';
  if (ch === '<') return '&lt;';
  if (ch === '>') return '&gt;';
  return ch;
}

function startNewTypingTest() {
  clearInterval(typing.tickInterval);
  typing.passage = generatePassage(passageLengthSelect.value);
  typing.startTime = null;
  typing.finished = false;
  typing.prevValue = '';
  typing.totalKeystrokes = 0;
  typing.errorKeystrokes = 0;
  typing.wpmSamples = [];
  typeInput.value = '';
  typeInput.disabled = false;
  typingResultsEl.classList.add('hidden');
  wpmChartEl.innerHTML = '';
  wpmLiveEl.textContent = '0';
  accLiveEl.textContent = '100%';
  timeLiveEl.textContent = '0s';
  renderPassage();
  renderBestWpm();
  typeInput.focus();
}

function computeStats(elapsedMs) {
  const typed = typeInput.value;
  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === typing.passage[i]) correct++;
  }
  const minutes = Math.max(elapsedMs / 60000, 1 / 60); // floor of 1 second, avoids absurd WPM on paste/instant input
  const wpm = (correct / 5) / minutes;
  const accuracy = typing.totalKeystrokes === 0
    ? 100
    : ((typing.totalKeystrokes - typing.errorKeystrokes) / typing.totalKeystrokes) * 100;
  return { correct, typedLen: typed.length, wpm, accuracy, elapsedMs };
}

function updateLiveStats() {
  if (!typing.startTime) return;
  const elapsedMs = performance.now() - typing.startTime;
  const stats = computeStats(elapsedMs);
  wpmLiveEl.textContent = Math.round(stats.wpm);
  accLiveEl.textContent = Math.round(stats.accuracy) + '%';
  timeLiveEl.textContent = Math.round(elapsedMs / 1000) + 's';
}

function recordWpmSample() {
  if (!typing.startTime) return;
  const elapsedMs = performance.now() - typing.startTime;
  const stats = computeStats(elapsedMs);
  typing.wpmSamples.push({ t: elapsedMs, wpm: stats.wpm });
}

function renderWpmChart() {
  const samples = typing.wpmSamples;
  if (samples.length < 2) {
    wpmChartEl.innerHTML = '';
    return;
  }
  const maxWpm = Math.max(...samples.map((s) => s.wpm), 1);
  const maxT = samples[samples.length - 1].t || 1;
  const points = samples
    .map((s) => {
      const x = (s.t / maxT) * 300;
      const y = 76 - (s.wpm / maxWpm) * 68;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  wpmChartEl.innerHTML = `<polyline class="wpm-line" points="${points}" />`;
}

function updatePassageHighlight() {
  const typed = typeInput.value;
  const spans = passageEl.children;
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    span.className = '';
    if (i < typed.length) {
      span.classList.add(typed[i] === typing.passage[i] ? 'char-correct' : 'char-incorrect');
    } else if (i === typed.length) {
      span.classList.add('char-current');
    } else {
      span.classList.add('char-pending');
    }
  }
}

function finishTypingTest() {
  typing.finished = true;
  clearInterval(typing.tickInterval);
  typeInput.disabled = true;

  const elapsedMs = performance.now() - typing.startTime;
  const stats = computeStats(elapsedMs);
  const wpmRounded = Math.round(stats.wpm);

  resWpm.textContent = wpmRounded;
  resAcc.textContent = Math.round(stats.accuracy) + '%';
  resTime.textContent = (elapsedMs / 1000).toFixed(1) + 's';
  resErrors.textContent = typing.errorKeystrokes;

  saveBestWpmIfBetter(stats.wpm);
  renderBestWpm();
  renderWpmChart();

  appendHistory(HISTORY_TYPING_KEY, {
    date: new Date().toISOString(),
    wpm: wpmRounded,
    accuracy: Math.round(stats.accuracy),
    errors: typing.errorKeystrokes,
    timeMs: Math.round(elapsedMs),
  });

  typingResultsEl.classList.remove('hidden');
}

typeInput.addEventListener('paste', (e) => e.preventDefault());

typeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    startNewTypingTest();
    return;
  }
  if (NAV_KEYS.includes(e.key)) {
    e.preventDefault(); // keep the cursor pinned to the end so raw accuracy tracking stays valid
  }
});

typeInput.addEventListener('click', () => {
  const len = typeInput.value.length;
  typeInput.setSelectionRange(len, len);
});

typeInput.addEventListener('input', () => {
  if (typing.finished) return;

  if (typing.startTime === null) {
    typing.startTime = performance.now();
    typing.tickInterval = setInterval(() => {
      updateLiveStats();
      recordWpmSample();
    }, 250);
  }

  let newValue = typeInput.value;

  // prevent typing past passage length
  if (newValue.length > typing.passage.length) {
    newValue = newValue.slice(0, typing.passage.length);
    typeInput.value = newValue;
  }

  // raw accuracy tracks every keystroke made, including ones later fixed with backspace
  if (newValue.length > typing.prevValue.length) {
    for (let i = typing.prevValue.length; i < newValue.length; i++) {
      typing.totalKeystrokes++;
      if (newValue[i] !== typing.passage[i]) typing.errorKeystrokes++;
    }
  }
  typing.prevValue = newValue;

  updatePassageHighlight();
  updateLiveStats();

  if (newValue.length === typing.passage.length) {
    finishTypingTest();
  }
});

restartTypingBtn.addEventListener('click', startNewTypingTest);
tryAgainBtn.addEventListener('click', startNewTypingTest);
passageLengthSelect.addEventListener('change', startNewTypingTest);

/* ============================================================
   Keyboard Latency Test
   ============================================================ */

const LATENCY_KEYS = ['A', 'S', 'D', 'F', 'J', 'K', 'L', 'W', 'E', 'R', 'U', 'I', 'O', 'P'];
const TOTAL_ATTEMPTS = 20;
const MIN_DELAY_MS = 800;
const MAX_DELAY_MS = 3200;

const latencyIdleEl = document.getElementById('latencyIdle');
const latencyPromptEl = document.getElementById('latencyPrompt');
const latencyWaitEl = document.getElementById('latencyWait');
const latencyEarlyEl = document.getElementById('latencyEarly');
const keyGlyphEl = document.getElementById('keyGlyph');
const attemptCountEl = document.getElementById('attemptCount');
const progressFillEl = document.getElementById('progressFill');
const startLatencyBtn = document.getElementById('startLatency');
const restartLatencyBtn = document.getElementById('restartLatency');
const latAvgEl = document.getElementById('latAvg');
const latMinEl = document.getElementById('latMin');
const latMaxEl = document.getElementById('latMax');
const latBestEl = document.getElementById('latBest');
const histogramEl = document.getElementById('histogram');
const latencyLogEl = document.getElementById('latencyLog');

const BEST_LATENCY_KEY = 'typingTester.bestLatencyAvg';

const latency = {
  results: [],
  currentKey: null,
  promptTime: null,
  running: false,
  waitingForPrompt: false,
  timeoutId: null,
  keydownHandler: null,
};

function loadBestLatency() {
  const v = parseFloat(localStorage.getItem(BEST_LATENCY_KEY));
  return isNaN(v) ? null : v;
}

function saveBestLatencyIfBetter(avg) {
  const best = loadBestLatency();
  if (best === null || avg < best) {
    localStorage.setItem(BEST_LATENCY_KEY, String(avg));
    return avg;
  }
  return best;
}

function renderBestLatency() {
  const best = loadBestLatency();
  latBestEl.textContent = best === null ? '–' : Math.round(best);
}

function showStage(which) {
  [latencyIdleEl, latencyPromptEl, latencyWaitEl, latencyEarlyEl].forEach((el) => el.classList.add('hidden'));
  which.classList.remove('hidden');
}

function startKeyListener() {
  if (latency.keydownHandler) return;
  latency.keydownHandler = (e) => handleKeydown(e);
  window.addEventListener('keydown', latency.keydownHandler);
}

latency.stopKeyListener = function stopKeyListener() {
  if (latency.keydownHandler) {
    window.removeEventListener('keydown', latency.keydownHandler);
    latency.keydownHandler = null;
  }
};

function handleKeydown(e) {
  if (!latency.running) return;
  const key = e.key.toUpperCase();

  if (latency.waitingForPrompt) {
    // pressed too early
    if (LATENCY_KEYS.includes(key)) {
      showStage(latencyEarlyEl);
      setTimeout(() => {
        if (latency.running && latency.waitingForPrompt) showStage(latencyWaitEl);
      }, 500);
    }
    return;
  }

  if (latency.currentKey && key === latency.currentKey) {
    const elapsed = performance.now() - latency.promptTime;
    recordAttempt(elapsed);
  }
}

function recordAttempt(ms) {
  latency.results.push(ms);
  latency.currentKey = null;

  renderLog();
  renderSummary();
  renderHistogram();

  const done = latency.results.length >= TOTAL_ATTEMPTS;
  attemptCountEl.textContent = `${latency.results.length} / ${TOTAL_ATTEMPTS} attempts`;
  progressFillEl.style.width = `${(latency.results.length / TOTAL_ATTEMPTS) * 100}%`;

  if (done) {
    finishLatencyTest();
  } else {
    scheduleNextPrompt();
  }
}

function scheduleNextPrompt() {
  latency.waitingForPrompt = true;
  showStage(latencyWaitEl);
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  latency.timeoutId = setTimeout(() => {
    latency.waitingForPrompt = false;
    latency.currentKey = LATENCY_KEYS[Math.floor(Math.random() * LATENCY_KEYS.length)];
    keyGlyphEl.textContent = latency.currentKey;
    latency.promptTime = performance.now();
    showStage(latencyPromptEl);
  }, delay);
}

function finishLatencyTest() {
  latency.running = false;
  latency.stopKeyListener();
  clearTimeout(latency.timeoutId);

  const avg = latency.results.reduce((a, b) => a + b, 0) / latency.results.length;
  saveBestLatencyIfBetter(avg);
  renderBestLatency();

  appendHistory(HISTORY_LATENCY_KEY, {
    date: new Date().toISOString(),
    avgMs: Math.round(avg),
    minMs: Math.round(Math.min(...latency.results)),
    maxMs: Math.round(Math.max(...latency.results)),
    attempts: latency.results.length,
  });

  latencyIdleEl.innerHTML = `<p>Done! Average latency: <strong>${Math.round(avg)}ms</strong> over ${latency.results.length} attempts. Press Start to try again.</p>`;
  showStage(latencyIdleEl);
  startLatencyBtn.textContent = 'Start';
}

function renderSummary() {
  if (latency.results.length === 0) {
    latAvgEl.textContent = '–';
    latMinEl.textContent = '–';
    latMaxEl.textContent = '–';
    return;
  }
  const sum = latency.results.reduce((a, b) => a + b, 0);
  const avg = sum / latency.results.length;
  latAvgEl.textContent = Math.round(avg);
  latMinEl.textContent = Math.round(Math.min(...latency.results));
  latMaxEl.textContent = Math.round(Math.max(...latency.results));
}

function renderLog() {
  latencyLogEl.innerHTML = latency.results
    .slice()
    .reverse()
    .map((ms, idx) => {
      const attemptNum = latency.results.length - idx;
      return `<li><span>Attempt ${attemptNum}</span><span class="lat-ms">${Math.round(ms)}ms</span></li>`;
    })
    .join('');
}

function renderHistogram() {
  if (latency.results.length === 0) {
    histogramEl.innerHTML = '<div class="empty-msg">Complete a few attempts to see the distribution.</div>';
    return;
  }
  const min = Math.min(...latency.results);
  const max = Math.max(...latency.results);
  const bucketCount = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(latency.results.length))));
  const range = Math.max(max - min, 1);
  const bucketSize = range / bucketCount;

  const buckets = new Array(bucketCount).fill(0);
  latency.results.forEach((ms) => {
    let idx = Math.floor((ms - min) / bucketSize);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx]++;
  });

  const maxCount = Math.max(...buckets);
  histogramEl.innerHTML = buckets
    .map((count) => {
      const heightPct = maxCount === 0 ? 0 : (count / maxCount) * 100;
      return `<div class="bar" style="height:${Math.max(heightPct, count > 0 ? 4 : 0)}%">${count > 0 ? `<span class="bar-count">${count}</span>` : ''}</div>`;
    })
    .join('');
}

function startLatencyTest() {
  clearTimeout(latency.timeoutId);
  latency.results = [];
  latency.currentKey = null;
  latency.waitingForPrompt = false;
  latency.running = true;

  attemptCountEl.textContent = `0 / ${TOTAL_ATTEMPTS} attempts`;
  progressFillEl.style.width = '0%';
  latAvgEl.textContent = '–';
  latMinEl.textContent = '–';
  latMaxEl.textContent = '–';
  histogramEl.innerHTML = '<div class="empty-msg">Complete a few attempts to see the distribution.</div>';
  latencyLogEl.innerHTML = '';
  renderBestLatency();

  startKeyListener();
  scheduleNextPrompt();
  startLatencyBtn.textContent = 'Restart';
}

function resetLatencyTest() {
  latency.running = false;
  latency.waitingForPrompt = false;
  latency.stopKeyListener();
  clearTimeout(latency.timeoutId);
  latency.results = [];

  attemptCountEl.textContent = `0 / ${TOTAL_ATTEMPTS} attempts`;
  progressFillEl.style.width = '0%';
  latAvgEl.textContent = '–';
  latMinEl.textContent = '–';
  latMaxEl.textContent = '–';
  histogramEl.innerHTML = '<div class="empty-msg">Complete a few attempts to see the distribution.</div>';
  latencyLogEl.innerHTML = '';
  latencyIdleEl.innerHTML = '<p>Press <strong>Start</strong>, then press the key shown as fast as you can when it appears.</p>';
  showStage(latencyIdleEl);
  startLatencyBtn.textContent = 'Start';
  renderBestLatency();
}

startLatencyBtn.addEventListener('click', startLatencyTest);
restartLatencyBtn.addEventListener('click', resetLatencyTest);

/* ============================================================
   Init
   ============================================================ */

startNewTypingTest();
resetLatencyTest();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
