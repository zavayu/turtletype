const node = (tag, className = '', text = '') => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
};

export function createRun(mode, words, track, surface, input, handlers = {}) {
  return {
    mode, words, target: words.join(' '), track, surface, input, handlers,
    charEls: [], caret: null, typed: [], cursor: 0, events: [], actions: [],
    wordsSeen: [], wordStart: null, wordErrors: 0, startedAt: null,
    startedAtIso: null, timer: null, idleTimer: null, targetPattern: null,
    finished: false, saved: false,
  };
}

export function renderPrompt(run) {
  const fragment = document.createDocumentFragment();
  run.charEls = [];
  run.words.forEach((word, wordIndex) => {
    const wordElement = node('span', 'word');
    for (const letter of word) {
      const character = node('span', 'char', letter);
      run.charEls.push(character);
      wordElement.append(character);
    }
    if (wordIndex < run.words.length - 1) {
      const space = node('span', 'char space', ' ');
      run.charEls.push(space);
      wordElement.append(space);
    }
    fragment.append(wordElement);
  });
  run.caret = node('span', 'caret');
  run.caret.setAttribute('aria-hidden', 'true');
  fragment.append(run.caret);
  run.track.replaceChildren(fragment);
  run.track.style.transform = 'translateY(0px)';
  requestAnimationFrame(() => positionCaret(run));
}

export function positionCaret(run) {
  if (run.finished) { run.caret.hidden = true; return; }
  const character = run.charEls[Math.min(run.cursor, run.charEls.length - 1)];
  if (!character) return;
  const lineHeight = Number.parseFloat(getComputedStyle(run.track).lineHeight);
  const row = Math.max(0, Math.round(character.offsetTop / lineHeight));
  run.track.style.transform = `translateY(${-Math.max(0, row - 1) * lineHeight}px)`;
  const y = character.offsetTop + Math.max(0, (character.offsetHeight - run.caret.offsetHeight) / 2);
  run.caret.style.transform = `translate3d(${character.offsetLeft}px, ${y}px, 0)`;
}

export function correctPositions(run) {
  return run.typed.reduce((total, char, index) => total + Number(char === run.target[index]), 0);
}

export function elapsedSeconds(run) {
  return run.startedAt === null ? 0 : (performance.now() - run.startedAt) / 1000;
}

export function completedWords(run) {
  if (!run.cursor) return 0;
  return (run.target.slice(0, run.cursor).match(/ /g) || []).length + Number(run.cursor === run.target.length);
}

export function stopRun(run) {
  clearInterval(run.timer);
  clearTimeout(run.idleTimer);
  run.surface.classList.remove('is-typing');
}

function markTyping(run) {
  run.surface.classList.add('is-typing');
  clearTimeout(run.idleTimer);
  run.idleTimer = setTimeout(() => {
    run.surface.classList.remove('is-typing');
    run.idleTimer = null;
  }, 650);
}

function updateCharacter(run, index) {
  const character = run.charEls[index];
  if (!character) return;
  character.classList.toggle('correct', index < run.cursor && run.typed[index] === run.target[index]);
  character.classList.toggle('incorrect', index < run.cursor && run.typed[index] !== run.target[index]);
}

function recordWord(run, now) {
  if (run.wordStart === null) return;
  const start = run.target.lastIndexOf(' ', run.cursor - 1) + 1;
  const word = run.target.slice(start, run.cursor);
  if (word) run.wordsSeen.push({ word, errors: run.wordErrors, ms: Math.max(1, now - run.wordStart) });
  run.wordStart = null;
  run.wordErrors = 0;
}

function typeCharacter(run, char) {
  if (run.finished || run.cursor >= run.target.length || char.length !== 1 || char === '\n') return;
  markTyping(run);
  const now = performance.now();
  if (run.startedAt === null) {
    run.startedAt = now;
    run.startedAtIso = new Date().toISOString();
    run.surface.classList.add('has-started');
    run.handlers.onStart?.(run);
  }
  const expected = run.target[run.cursor];
  if (run.wordStart === null && expected !== ' ') run.wordStart = now;
  const correct = char === expected;
  run.events.push({ expected, actual: char, previous: run.cursor > 0 ? run.target[run.cursor - 1] : null, correct });
  run.actions.push({ type: 'type', index: run.cursor, expected, actual: char, correct, atMs: Math.round(now - run.startedAt) });
  if (!correct) run.wordErrors++;
  run.typed.push(char);
  if (expected === ' ') recordWord(run, now);
  run.cursor++;
  updateCharacter(run, run.cursor - 1);
  positionCaret(run);
  run.handlers.onChange?.(run);
  if (run.cursor === run.target.length) run.handlers.onComplete?.(run);
}

function backspace(run) {
  if (run.finished) return;
  markTyping(run);
  if (run.cursor === 0) return;
  const removed = run.typed[run.cursor - 1];
  run.cursor--;
  run.typed.pop();
  run.actions.push({ type: 'backspace', index: run.cursor, removed, atMs: Math.round(performance.now() - run.startedAt) });
  if (run.target[run.cursor] === ' ' && run.wordsSeen.length) {
    run.wordsSeen.pop();
    run.wordStart = performance.now();
    run.wordErrors = 0;
  }
  updateCharacter(run, run.cursor);
  positionCaret(run);
  run.handlers.onChange?.(run);
}

export function bindInput(run) {
  run.input.value = '';
  run.input.addEventListener('paste', (event) => {
    if (run.practiceKind === 'sprint') event.preventDefault();
  });
  run.input.addEventListener('beforeinput', (event) => {
    if (run.practiceKind === 'sprint' && event.inputType === 'insertFromPaste') { event.preventDefault(); return; }
    if (event.inputType === 'deleteContentBackward') { event.preventDefault(); backspace(run); return; }
    if (event.inputType.startsWith('insert') && event.data) {
      event.preventDefault();
      for (const char of event.data) typeCharacter(run, char);
    }
  });
  run.input.addEventListener('input', () => {
    // Some virtual keyboards do not send beforeinput.
    const value = run.input.value;
    for (const char of value) typeCharacter(run, char);
    run.input.value = '';
  });
  run.input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); run.handlers.onEscape?.(run); }
  });
}
