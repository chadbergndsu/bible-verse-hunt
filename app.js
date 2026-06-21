const API_BASE = 'https://bible-api.com/data';
const RING_CIRCUMFERENCE = 97.4;
const WORD_COUNT = 3;

const state = {
  translation: 'kjv',
  pool: '',
  timerSeconds: 60,
  timeLeft: 60,
  timerId: null,
  target: null,
  expectedWords: [],
  score: 0,
  streak: 0,
  playing: false,
};

const $ = (id) => document.getElementById(id);

const elements = {
  menuScreen: $('menuScreen'),
  gameScreen: $('gameScreen'),
  headerStats: $('headerStats'),
  totalScore: $('totalScore'),
  streak: $('streak'),
  startBtn: $('startBtn'),
  timerSelect: $('timerSelect'),
  poolSelect: $('poolSelect'),
  translationSelect: $('translationSelect'),
  targetReference: $('targetReference'),
  timerDisplay: $('timerDisplay'),
  timerRing: $('timerRing'),
  answerForm: $('answerForm'),
  answerInput: $('answerInput'),
  submitBtn: $('submitBtn'),
  answerFeedback: $('answerFeedback'),
  wordProgress: $('wordProgress'),
  translationNote: $('translationNote'),
  resultOverlay: $('resultOverlay'),
  resultCard: $('resultCard'),
  resultIcon: $('resultIcon'),
  resultTitle: $('resultTitle'),
  resultReference: $('resultReference'),
  resultVerse: $('resultVerse'),
  resultAnswer: $('resultAnswer'),
  resultScore: $('resultScore'),
  nextBtn: $('nextBtn'),
  menuBtn: $('menuBtn'),
};

const TRANSLATION_NAMES = {
  kjv: 'King James Version',
  web: 'World English Bible',
  asv: 'American Standard Version',
};

function formatReference(verse) {
  return `${verse.book} ${verse.chapter}:${verse.verse}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fetchRandomVerse() {
  const pool = state.pool ? `/${state.pool}` : '';
  const data = await fetchJSON(`${API_BASE}/${state.translation}/random${pool}`);
  return data.random_verse;
}

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function getExpectedWords(verseText) {
  const words = normalizeWords(verseText);
  const count = Math.min(WORD_COUNT, words.length);
  return words.slice(0, count);
}

function showScreen(name) {
  elements.menuScreen.classList.toggle('active', name === 'menu');
  elements.gameScreen.classList.toggle('active', name === 'game');
  elements.headerStats.hidden = name !== 'game';
}

function updateStats() {
  elements.totalScore.textContent = state.score;
  elements.streak.textContent = state.streak;
}

function updateTimerRing() {
  const fraction = state.timeLeft / state.timerSeconds;
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  elements.timerRing.style.strokeDashoffset = offset;

  elements.timerRing.classList.remove('warning', 'danger');
  if (fraction <= 0.2) elements.timerRing.classList.add('danger');
  else if (fraction <= 0.4) elements.timerRing.classList.add('warning');
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  stopTimer();
  state.timeLeft = state.timerSeconds;
  elements.timerDisplay.textContent = state.timeLeft;
  updateTimerRing();

  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    elements.timerDisplay.textContent = Math.max(0, state.timeLeft);
    updateTimerRing();

    if (state.timeLeft <= 0) {
      stopTimer();
      handleTimeUp();
    }
  }, 1000);
}

function setInputEnabled(enabled) {
  elements.answerInput.disabled = !enabled;
  elements.submitBtn.disabled = !enabled;
  if (enabled) {
    elements.answerInput.focus();
  }
}

function clearAnswerUI() {
  elements.answerInput.value = '';
  elements.answerFeedback.textContent = '';
  elements.answerFeedback.className = 'answer-feedback';
  updateWordProgress([]);
}

function updateWordProgress(typedWords) {
  const slots = elements.wordProgress.querySelectorAll('.word-slot');
  slots.forEach((slot, i) => {
    const expected = state.expectedWords[i];
    const typed = typedWords[i] || '';

    slot.textContent = typed || `Word ${i + 1}`;
    slot.classList.remove('filled', 'correct', 'wrong');

    if (typed) {
      slot.classList.add('filled');
      if (expected && typed === expected) {
        slot.classList.add('correct');
      } else if (expected) {
        slot.classList.add('wrong');
      }
    }
  });
}

function wordsMatch(input) {
  const typed = normalizeWords(input);
  const expected = state.expectedWords;

  if (typed.length < expected.length) return false;
  return expected.every((word, i) => typed[i] === word);
}

function partialMismatch(input) {
  const typed = normalizeWords(input);
  const expected = state.expectedWords;

  for (let i = 0; i < typed.length; i += 1) {
    if (i >= expected.length || typed[i] !== expected[i]) {
      return true;
    }
  }
  return false;
}

function checkAnswer() {
  if (!state.playing || !state.target) return;

  const input = elements.answerInput.value;

  if (wordsMatch(input)) {
    handleWin();
    return;
  }

  const typed = normalizeWords(input);
  if (typed.length >= state.expectedWords.length) {
    elements.answerFeedback.textContent = 'Not quite — check your translation and try again.';
    elements.answerFeedback.className = 'answer-feedback error';
    elements.answerInput.classList.add('shake');
    setTimeout(() => elements.answerInput.classList.remove('shake'), 450);
  } else if (partialMismatch(input)) {
    elements.answerFeedback.textContent = 'One of those words is off — keep going.';
    elements.answerFeedback.className = 'answer-feedback error';
  } else {
    elements.answerFeedback.textContent = `${typed.length} of ${state.expectedWords.length} words — keep typing.`;
    elements.answerFeedback.className = 'answer-feedback';
  }
}

function onInputChange() {
  if (!state.playing) return;

  const typed = normalizeWords(elements.answerInput.value);
  updateWordProgress(typed);

  if (wordsMatch(elements.answerInput.value)) {
    handleWin();
    return;
  }

  if (partialMismatch(elements.answerInput.value)) {
    elements.answerFeedback.textContent = 'Check your spelling — a word does not match yet.';
    elements.answerFeedback.className = 'answer-feedback error';
  } else if (typed.length > 0) {
    elements.answerFeedback.textContent = `${Math.min(typed.length, state.expectedWords.length)} of ${state.expectedWords.length} words`;
    elements.answerFeedback.className = 'answer-feedback';
  } else {
    elements.answerFeedback.textContent = '';
    elements.answerFeedback.className = 'answer-feedback';
  }
}

function calculatePoints() {
  const timeBonus = Math.round(state.timeLeft * 10);
  const streakBonus = state.streak * 25;
  return 100 + timeBonus + streakBonus;
}

function showResult(won) {
  const target = state.target;
  const expectedPhrase = state.expectedWords.join(' ');

  elements.resultCard.classList.toggle('lost', !won);
  elements.resultIcon.textContent = won ? '✓' : '✗';
  elements.resultTitle.textContent = won ? 'Got it!' : "Time's up!";
  elements.resultReference.textContent = formatReference(target);
  elements.resultVerse.textContent = target.text.trim();
  elements.resultAnswer.textContent = won
    ? `You typed: "${expectedPhrase}"`
    : `The first 3 words were: "${expectedPhrase}"`;

  if (won) {
    const points = calculatePoints();
    state.score += points;
    state.streak += 1;
    elements.resultScore.textContent = `+${points} points · ${state.timeLeft}s remaining · Streak: ${state.streak}`;
  } else {
    state.streak = 0;
    elements.resultScore.textContent = 'Streak reset. Look up the verse and try again!';
  }

  updateStats();
  setInputEnabled(false);
  elements.resultOverlay.hidden = false;
}

function handleWin() {
  state.playing = false;
  stopTimer();
  showResult(true);
}

function handleTimeUp() {
  state.playing = false;
  showResult(false);
}

async function startRound() {
  state.translation = elements.translationSelect.value;
  state.pool = elements.poolSelect.value;
  state.timerSeconds = parseInt(elements.timerSelect.value, 10);
  state.playing = true;

  showScreen('game');
  elements.resultOverlay.hidden = true;
  elements.targetReference.textContent = 'Loading…';
  clearAnswerUI();
  setInputEnabled(false);

  try {
    state.target = await fetchRandomVerse();
    state.expectedWords = getExpectedWords(state.target.text);

    elements.targetReference.textContent = formatReference(state.target);
    elements.translationNote.textContent =
      `Answers are checked against the ${TRANSLATION_NAMES[state.translation] || state.translation} text.`;

    setInputEnabled(true);
    startTimer();
  } catch (err) {
    console.error(err);
    elements.targetReference.textContent = 'Could not load verse. Try again.';
    elements.answerFeedback.textContent = 'Network error — check your connection and restart.';
    elements.answerFeedback.className = 'answer-feedback error';
    state.playing = false;
  }
}

function resetToMenu() {
  stopTimer();
  state.playing = false;
  elements.resultOverlay.hidden = true;
  setInputEnabled(false);
  showScreen('menu');
}

elements.startBtn.addEventListener('click', startRound);
elements.nextBtn.addEventListener('click', startRound);
elements.menuBtn.addEventListener('click', resetToMenu);
elements.answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  checkAnswer();
});
elements.answerInput.addEventListener('input', onInputChange);