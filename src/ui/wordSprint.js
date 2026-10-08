import { COMMON_WORDS } from '../data/wordBank.js';
import { chooseSprintWord, SPRINT_LEVELS, sprintTargetMs } from '../practice/wordSprint.js';
import { bindInput, createRun, positionCaret, renderPrompt, stopRun } from '../typing/engine.js';

const node = (tag, className = '', text = '') => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
};
const seconds = (ms) => `${(ms / 1000).toFixed(2)}s`;

export function createWordSprint(root, getAnalysis, saveRun) {
  let difficulty = 'easy';
  let targetWpm = 60;
  let run = null;
  let currentWord = null;
  let nextTimer = null;
  let active = false;
  let attempts = 0;
  let cleared = 0;
  let surface, track, input, elapsed, goal, feedback, count, levelButtons;

  // Stop timers and preserve an unfinished attempt before replacing the UI.
  function stop() {
    active = false;
    clearTimeout(nextTimer);
    if (run && !run.finished) saveRun(run, false);
    if (run) stopRun(run);
    run = null;
  }

  function finishWord(finishedRun, timedOut = false) {
    if (finishedRun !== run || run.finished) return;
    run.finished = true;
    stopRun(run);
    run.caret.hidden = true;
    const elapsedMs = Math.max(1, Math.round(performance.now() - run.startedAt));
    // A sprint only clears when every character is correct before the target
    // time; misses are saved so the history reflects all attempts.
    const clean = run.events.every((event) => event.correct);
    const passed = !timedOut && clean && elapsedMs <= run.targetMs;
    run.sprint = { difficulty, targetWpm, word: currentWord, targetMs: run.targetMs, elapsedMs, passed, timedOut };
    saveRun(run, true);
    attempts++;
    if (passed) cleared++;
    count.textContent = `${cleared} cleared · ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}`;
    elapsed.textContent = seconds(elapsedMs);
    feedback.textContent = timedOut ? 'time · repeat' : passed
      ? `${seconds(elapsedMs)} · clear`
      : clean ? `${seconds(elapsedMs)} · repeat` : 'mistake · repeat';
    feedback.classList.toggle('success', passed);
    surface.classList.toggle('sprint-missed', !passed);
    nextTimer = setTimeout(() => {
      if (active) showWord(passed ? null : currentWord);
    }, 850);
  }

  function showWord(requestedWord = null, focus = true) {
    if (!active) return;
    clearTimeout(nextTimer);
    if (run && !run.finished) saveRun(run, false);
    if (run) stopRun(run);
    currentWord = requestedWord || chooseSprintWord(difficulty, getAnalysis(), COMMON_WORDS, currentWord);
    if (!currentWord) return;
    // Replacing the textarea removes listeners from the previous word.
    const freshInput = input.cloneNode();
    input.replaceWith(freshInput);
    input = freshInput;
    surface.classList.remove('has-started', 'sprint-missed');
    feedback.textContent = '';
    feedback.classList.remove('success');
    elapsed.textContent = '0.00s';
    const targetMs = sprintTargetMs(currentWord, targetWpm);
    goal.textContent = `target ${seconds(targetMs)}`;
    run = createRun('practice', [currentWord], track, surface, input, {
      onStart: (startedRun) => {
        startedRun.timer = setInterval(() => {
          if (startedRun.finished) return;
          const currentMs = performance.now() - startedRun.startedAt;
          elapsed.textContent = seconds(currentMs);
          if (currentMs > startedRun.targetMs) finishWord(startedRun, true);
        }, 25);
      },
      onComplete: finishWord,
      onEscape: () => showWord(currentWord),
    });
    run.targetPattern = `word sprint · ${difficulty} · ${targetWpm} wpm`;
    run.practiceKind = 'sprint';
    run.targetMs = targetMs;
    renderPrompt(run);
    bindInput(run);
    if (focus) input.focus();
  }

  function start() {
    stop();
    active = true;
    attempts = 0;
    cleared = 0;
    currentWord = null;
    const container = node('div', 'sprint');
    const intro = node('p', 'sprint-intro', 'Set a target WPM. The clock starts on your first key.');
    const controls = node('div', 'sprint-controls');
    const levels = node('div', 'sprint-levels');
    levels.setAttribute('role', 'group');
    levels.setAttribute('aria-label', 'Word sprint difficulty');
    levelButtons = Object.keys(SPRINT_LEVELS).map((level) => {
      const button = node('button', `mode-option${level === difficulty ? ' selected' : ''}`, level);
      button.type = 'button';
      button.addEventListener('click', () => {
        if (level === difficulty) return;
        difficulty = level;
        attempts = 0;
        cleared = 0;
        count.textContent = '0 cleared · 0 attempts';
        for (const item of levelButtons) item.classList.toggle('selected', item.textContent === level);
        showWord();
      });
      levels.append(button);
      return button;
    });
    const wpmLabel = node('label', 'sprint-wpm', 'target wpm');
    const wpmInput = node('input', 'sprint-wpm-input');
    wpmInput.type = 'number';
    wpmInput.min = '20';
    wpmInput.max = '200';
    wpmInput.step = '5';
    wpmInput.value = String(targetWpm);
    wpmInput.addEventListener('change', () => {
      const value = Number(wpmInput.value);
      if (!Number.isFinite(value) || value <= 0) { wpmInput.value = String(targetWpm); return; }
      const nextWpm = Math.max(20, Math.min(200, Math.round(value)));
      wpmInput.value = String(nextWpm);
      if (nextWpm === targetWpm) return;
      targetWpm = nextWpm;
      showWord(currentWord, false);
    });
    wpmLabel.append(wpmInput);
    controls.append(levels, wpmLabel);
    const status = node('div', 'sprint-status');
    elapsed = node('strong', 'sprint-elapsed', '0.00s');
    goal = node('span', 'sprint-goal');
    status.append(elapsed, goal);
    surface = node('div', 'typing-surface sprint-surface');
    const viewport = node('div', 'words-viewport');
    track = node('div', 'words-track sprint-track');
    viewport.append(track);
    input = node('textarea', 'typing-input');
    input.setAttribute('aria-label', 'Type the word on screen');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    surface.append(viewport, input, node('span', 'focus-prompt', 'click to focus'));
    feedback = node('div', 'sprint-feedback');
    feedback.setAttribute('role', 'status');
    count = node('div', 'sprint-count', '0 cleared · 0 attempts');
    container.append(intro, controls, status, surface, feedback, count);
    root.replaceChildren(container);
    showWord();
  }

  return { start, stop, resize: () => { if (run) positionCaret(run); } };
}
