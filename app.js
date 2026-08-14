'use strict';

/* ============================================================
   Shared: tabs
   ============================================================ */

const tabBtns = document.querySelectorAll('.tab-btn');
const panels = {
  typing: document.getElementById('panel-typing'),
  latency: document.getElementById('panel-latency'),
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
    }
  });
});

/* ============================================================
   Typing Speed Test
   ============================================================ */

const WORD_BANK = (
  'the of and to a in is you that it he was for on are as with his they I ' +
  'at be this have from or one had by word but not what all were we when ' +
  'your can said there use an each which she do how their if will up other ' +
  'about out many then them these so some her would make like him into time ' +
  'has look two more write go see number no way could people my than first ' +
  'water been call who oil its now find long down day did get come made may ' +
  'part over new sound take only little work know place year live me back ' +
  'give most very after thing our just name good sentence man think say ' +
  'great where help through much before line right too mean old any same ' +
  'tell boy follow came want show also around form three small set put end ' +
  'does another well large must big even such because turn here why ask ' +
  'went men read need land different home us move try kind hand picture ' +
  'again change off play spell air away animal house point page letter ' +
  'mother answer found study still learn should world high every near add ' +
  'food between own below country plant last school father keep tree never ' +
  'start city earth eye light thought head under story saw left dont few ' +
  'while along might close something seem next hard open example begin life'
).split(/\s+/);

const PASSAGE_LENGTHS = { short: 10, medium: 25, long: 45 };

function generatePassage(length) {
  const count = PASSAGE_LENGTHS[length] || PASSAGE_LENGTHS.medium;
  const words = [];
  for (let i = 0; i < count; i++) {
    words.push(WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)]);
  }
  return words.join(' ');
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
const resChars = document.getElementById('resChars');

const BEST_WPM_KEY = 'typingTester.bestWpm';

const typing = {
  passage: '',
  startTime: null,
  finished: false,
  tickInterval: null,
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
  typeInput.value = '';
  typeInput.disabled = false;
  typingResultsEl.classList.add('hidden');
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
  const accuracy = typed.length === 0 ? 100 : (correct / typed.length) * 100;
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
  resChars.textContent = stats.typedLen;

  saveBestWpmIfBetter(stats.wpm);
  renderBestWpm();

  typingResultsEl.classList.remove('hidden');
}

typeInput.addEventListener('paste', (e) => e.preventDefault());

typeInput.addEventListener('input', () => {
  if (typing.finished) return;

  if (typing.startTime === null) {
    typing.startTime = performance.now();
    typing.tickInterval = setInterval(updateLiveStats, 250);
  }

  // prevent typing past passage length
  if (typeInput.value.length > typing.passage.length) {
    typeInput.value = typeInput.value.slice(0, typing.passage.length);
  }

  updatePassageHighlight();
  updateLiveStats();

  if (typeInput.value.length === typing.passage.length) {
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
