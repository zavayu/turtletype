import './styles.css';
import { accuracyFromEvents, formatAccuracy } from './analytics/metrics.js';
import { analyzeSessions } from './analytics/analysis.js';
import { loadSessions, saveSession } from './data/storage.js';
import { COMMON_WORDS, EXTENDED_WORDS, KEY_WORDS, WORD_CORPUS_VERSION } from './data/wordBank.js';
import { choosePassage, PASSAGE_CORPUS_VERSION } from './data/passages.js';
import { renderInsights } from './ui/insights.js';
import { createWordSprint } from './ui/wordSprint.js';
import { buildPracticeSet } from './practice/buildPracticeSet.js';
import { countWords, makePrompt } from './typing/prompts.js';
import { bindInput, completedWords, correctPositions, createRun, elapsedSeconds, positionCaret, renderPrompt, stopRun } from './typing/engine.js';

const $ = (selector) => document.querySelector(selector);
const node = (tag, className = '', text = '') => { const el = document.createElement(tag); el.className = className; el.textContent = text; return el; };
const testConfig = { kind: 'time', amount: 30, style: 'words', bank: 'common', passageLength: 'short' };
const recentPassages = [];
let testRun;
let practiceRun;
let practiceMode = 'focus';
let sprintMounted = false;
let sessionsCache = [];
let analysisCache = null;
const currentAnalysis = () => analysisCache || (analysisCache = analyzeSessions(sessionsCache));

// Keep the live display independent from the final session record so it can
// update frequently without rebuilding the rest of the interface.
function updateLive() {
  if (!testRun || testRun.finished) return;
  const elapsed = elapsedSeconds(testRun);
  $('#live-time').textContent = testRun.testKind === 'time'
    ? String(Math.max(0, Math.ceil(testRun.limit - elapsed)))
    : `${completedWords(testRun)} / ${testRun.limit}`;
  $('#live-wpm').textContent = `${Math.round((correctPositions(testRun) / 5) / (Math.max(elapsed, 1) / 60))} wpm`;
  if (testRun.testKind === 'time' && elapsed >= testRun.limit) finishTest();
}
function persistRun(run, completed) {
  if (!run || run.saved || !run.actions.length) return null;
  run.saved = true;
  const elapsedMs = Math.max(1, performance.now() - run.startedAt);
  // Store raw actions as well as summary values so later analysis can inspect
  // timing, retries, and character positions.
  const session = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    schemaVersion: 3,
    mode: run.mode,
    completed,
    date: new Date().toISOString(),
    startedAt: run.startedAtIso,
    prompt: run.target,
    actions: run.actions,
    words: run.wordsSeen,
    duration: elapsedMs / 1000,
    wpm: Math.round((correctPositions(run) / 5) / (elapsedMs / 60000)),
    accuracy: Math.round(accuracyFromEvents(run.events) * 10) / 10,
    targetPattern: run.targetPattern,
    testKind: run.testKind || null,
    testLimit: run.limit || null,
    textStyle: run.textStyle || null,
    corpusTier: run.corpusTier || null,
    corpusVersion: run.corpusVersion || null,
    passageId: run.passage?.id || null,
    passageTitle: run.passage?.title || null,
    passageAuthor: run.passage?.author || null,
    passageSourceUrl: run.passage?.sourceUrl || null,
    passageLength: run.passage?.length || null,
    promptWordCount: countWords(run.target),
    practiceKind: run.practiceKind || null,
    sprint: run.sprint || null,
  };
  sessionsCache.push(session);
  analysisCache = null;
  void saveSession(session);
  return session;
}
function resetTest(focus = false) {
  if (testRun && !testRun.finished) persistRun(testRun, false);
  if (testRun) stopRun(testRun);
  const input = $('#test-input');
  // The test input is reused, so replace it to remove listeners from the previous run.
  const freshInput = input.cloneNode();
  input.replaceWith(freshInput);
  const isPassage = testConfig.style === 'passage';
  const passage = isPassage ? choosePassage(testConfig.passageLength, [...sessionsCache.map(session => session.passageId), ...recentPassages].filter(Boolean)) : null;
  if (passage) recentPassages.push(passage.id);
  const prompt = passage?.text || makePrompt(testConfig.style, testConfig.kind === 'time' ? 320 : testConfig.amount, testConfig.bank === 'extended' ? EXTENDED_WORDS : COMMON_WORDS);
  testRun = createRun('test', prompt.split(' '), $('#test-words'), $('#test-surface'), freshInput, {
    onStart: (run) => { if (run.testKind === 'time') run.timer = setInterval(updateLive, 100); },
    onChange: updateLive,
    onComplete: finishTest,
    onEscape: () => resetTest(true),
  });
  testRun.testKind = isPassage ? 'passage' : testConfig.kind;
  testRun.limit = isPassage ? passage.wordCount : testConfig.amount;
  testRun.textStyle = testConfig.style;
  testRun.corpusTier = isPassage ? null : testConfig.bank;
  testRun.corpusVersion = isPassage ? PASSAGE_CORPUS_VERSION : WORD_CORPUS_VERSION;
  testRun.passage = passage;
  testRun.surface.classList.remove('has-started');
  renderPrompt(testRun);
  bindInput(testRun);
  $('#live-time').textContent = testRun.testKind === 'time' ? String(testConfig.amount) : `0 / ${testRun.limit}`;
  $('#live-wpm').textContent = '0 wpm';
  $('#test-running').hidden = false;
  $('#test-result').hidden = true;
  if (focus) freshInput.focus();
}
function finishTest() {
  if (!testRun || testRun.finished) return;
  const run = testRun;
  run.finished = true;
  stopRun(run);
  const session = persistRun(run, true);
  const result = $('#test-result');
  result.replaceChildren();
  const stats = node('div', 'result-stats');
  for (const [value, label] of [[session.wpm, 'wpm'], [formatAccuracy(run.events), 'key accuracy']]) {
    const stat = node('div', 'result-stat');
    stat.append(node('strong', '', String(value)), node('span', '', label));
    stats.append(stat);
  }
  const actions = node('div', 'result-actions');
  const again = node('button', 'text-button', 'next test ↻');
  again.type = 'button'; again.onclick = () => resetTest(true);
  const insights = node('button', 'text-button', 'view insights →');
  insights.type = 'button'; insights.onclick = () => switchView('insights');
  actions.append(again, insights);
  result.append(stats, actions);
  if (run.passage) {
    const source = node('a', 'passage-source', `${run.passage.title} · ${run.passage.author} ↗`);
    source.href = run.passage.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    result.append(source);
  }
  $('#test-running').hidden = true;
  result.hidden = false;
}

function showInsights() {
  renderInsights($('#insights-content'), currentAnalysis(), (pattern) => {
    activatePracticeMode('focus', pattern);
    switchView('practice');
    practiceRun.input.focus();
  });
}
function updatePracticeFeedback(run, completed = false) {
  const feedback = $('#practice-feedback');
  if (!feedback || !run.events.length) return;
  const errors = run.events.filter(event => !event.correct).length;
  feedback.textContent = `${formatAccuracy(run.events)} key accuracy · ${errors} ${errors === 1 ? 'error' : 'errors'}${completed ? ' · line complete' : ''}`;
  feedback.classList.toggle('success', completed && errors === 0);
}
function finishPractice() {
  if (!practiceRun || practiceRun.finished) return;
  practiceRun.finished = true;
  stopRun(practiceRun);
  practiceRun.caret.hidden = true;
  updatePracticeFeedback(practiceRun, true);
  persistRun(practiceRun, true);
}
function newPractice(focus = false, requestedPattern = null) {
  if (practiceRun && !practiceRun.finished) persistRun(practiceRun, false);
  if (practiceRun) stopRun(practiceRun);
  // Build a fresh line from cached analysis whenever the user starts over or
  // chooses a specific pattern from the insights view.
  const data = currentAnalysis();
  const set = buildPracticeSet(data, COMMON_WORDS, KEY_WORDS, requestedPattern);
  const root = $('#practice-content');
  root.replaceChildren();
  const targetLine = node('div', 'practice-topline');
  targetLine.append(node('span', '', !data.tests.length ? 'warmup' : set.focusStatus === 'early' ? 'exploring' : 'focus'));
  if (set.targets.length) for (const target of set.targets) targetLine.append(node('span', 'target-chip', target));
  else targetLine.append(node('span', 'target-chip', 'complete a test to personalize'));
  const area = node('div', 'practice-area');
  const surface = node('div', 'typing-surface');
  const viewport = node('div', 'words-viewport');
  const track = node('div', 'words-track');
  viewport.append(track);
  const input = node('textarea', 'typing-input');
  input.setAttribute('aria-label', 'Type the practice words');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  surface.append(viewport, input, node('span', 'focus-prompt', 'click to focus'));
  const feedback = node('div', 'practice-feedback');
  feedback.id = 'practice-feedback';
  const actions = node('div', 'practice-actions');
  const next = node('button', 'text-button', 'new line ↻');
  next.type = 'button'; next.onclick = () => newPractice(true);
  actions.append(next);
  area.append(surface, feedback, actions);
  root.append(targetLine, area);
  practiceRun = createRun('practice', set.words, track, surface, input, {
    onChange: updatePracticeFeedback,
    onComplete: finishPractice,
    onEscape: () => newPractice(true),
  });
  practiceRun.practiceKind = 'focus';
  practiceRun.targetPattern = set.focusText;
  renderPrompt(practiceRun);
  bindInput(practiceRun);
  if (focus) input.focus();
}
const sprint = createWordSprint($('#practice-content'), currentAnalysis, persistRun);
function activatePracticeMode(mode, requestedPattern = null) {
  if (practiceMode === mode && !requestedPattern && (mode === 'focus' ? practiceRun : sprintMounted)) return;
  if (practiceMode === 'focus' && practiceRun) {
    if (!practiceRun.finished) persistRun(practiceRun, false);
    stopRun(practiceRun);
    practiceRun = null;
  }
  if (sprintMounted) { sprint.stop(); sprintMounted = false; }
  practiceMode = mode;
  document.querySelectorAll('[data-practice-mode]').forEach(button => button.classList.toggle('selected', button.dataset.practiceMode === mode));
  if (mode === 'sprint') { sprint.start(); sprintMounted = true; }
  else newPractice(false, requestedPattern);
}
function switchView(view) {
  if (view !== 'practice' && sprintMounted) { sprint.stop(); sprintMounted = false; }
  document.querySelectorAll('.view').forEach(section => section.classList.toggle('active', section.id === `${view}-view`));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  if (view === 'insights') showInsights();
  if (view === 'practice' && practiceMode === 'focus' && !practiceRun) newPractice();
  if (view === 'practice' && practiceMode === 'sprint' && !sprintMounted) { sprint.start(); sprintMounted = true; }
  if (view === 'test' && testRun) requestAnimationFrame(() => positionCaret(testRun));
  if (view === 'practice' && practiceRun) requestAnimationFrame(() => positionCaret(practiceRun));
  history.replaceState(null, '', `#${view}`);
  window.scrollTo(0, 0);
}

// Navigation and controls use data attributes so the same handlers work for
// the desktop and responsive layouts.
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => switchView(link.dataset.view)));
document.querySelectorAll('[data-practice-mode]').forEach(button => button.addEventListener('click', () => activatePracticeMode(button.dataset.practiceMode)));
function syncModeControls() {
  const isPassage = testConfig.style === 'passage';
  $('#generated-controls').hidden = isPassage;
  $('#bank-controls').hidden = isPassage;
  $('#passage-controls').hidden = !isPassage;
  document.querySelectorAll('[data-test-kind]').forEach(button => button.classList.toggle('selected', button.dataset.testKind === testConfig.kind));
  document.querySelectorAll('[data-text-style]').forEach(button => button.classList.toggle('selected', button.dataset.textStyle === testConfig.style));
  document.querySelectorAll('[data-bank]').forEach(button => button.classList.toggle('selected', button.dataset.bank === testConfig.bank));
  document.querySelectorAll('[data-passage-length]').forEach(button => button.classList.toggle('selected', button.dataset.passageLength === testConfig.passageLength));
  const amounts = testConfig.kind === 'time' ? [15, 30, 60] : [25, 50, 100];
  document.querySelectorAll('[data-test-amount]').forEach((button, index) => {
    button.dataset.testAmount = String(amounts[index]);
    button.textContent = String(amounts[index]);
    button.classList.toggle('selected', amounts[index] === testConfig.amount);
  });
}
document.querySelectorAll('[data-test-kind]').forEach(button => button.addEventListener('click', () => {
  testConfig.kind = button.dataset.testKind;
  testConfig.amount = testConfig.kind === 'time' ? 30 : 50;
  syncModeControls();
  resetTest(true);
}));
document.querySelectorAll('[data-test-amount]').forEach(button => button.addEventListener('click', () => {
  testConfig.amount = Number(button.dataset.testAmount);
  syncModeControls();
  resetTest(true);
}));
document.querySelectorAll('[data-text-style]').forEach(button => button.addEventListener('click', () => {
  testConfig.style = button.dataset.textStyle;
  syncModeControls();
  resetTest(true);
}));
document.querySelectorAll('[data-bank]').forEach(button => button.addEventListener('click', () => {
  testConfig.bank = button.dataset.bank;
  syncModeControls();
  resetTest(true);
}));
document.querySelectorAll('[data-passage-length]').forEach(button => button.addEventListener('click', () => {
  testConfig.passageLength = button.dataset.passageLength;
  syncModeControls();
  resetTest(true);
}));
$('#restart-test').addEventListener('click', () => resetTest(true));
window.addEventListener('resize', () => { if (testRun) positionCaret(testRun); if (practiceRun) positionCaret(practiceRun); if (sprintMounted) sprint.resize(); });
window.addEventListener('pagehide', () => {
  if (testRun && !testRun.finished) persistRun(testRun, false);
  if (practiceRun && !practiceRun.finished) persistRun(practiceRun, false);
  if (sprintMounted) sprint.stop();
});
async function initialize() {
  sessionsCache = await loadSessions();
  analysisCache = null;
  syncModeControls();
  resetTest();
  switchView(['test', 'insights', 'practice'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'test');
}
void initialize();
