const MAX_PATTERN_LENGTH = 5;

// Timing and ranking use medians so one unusually slow keypress does not
// dominate a user's baseline.
export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function addError(map, key, incorrect) {
  const record = map.get(key) || { attempts: 0, errors: 0 };
  record.attempts++;
  if (incorrect) record.errors++;
  map.set(key, record);
}

function addWord(map, item) {
  if (!item?.word) return;
  const key = item.word.toLowerCase();
  const record = map.get(key) || { attempts: 0, errors: 0, totalMs: 0 };
  record.attempts++;
  record.errors += item.errors || 0;
  record.totalMs += item.ms || 0;
  map.set(key, record);
}

function collectDetailedPatterns(session, patterns, baselineIntervals, words) {
  if (!session.prompt || !Array.isArray(session.actions)) return;
  // Group retries by prompt position. This lets the analysis distinguish a
  // mistake from a later corrected attempt at the same character.
  const attemptsByIndex = new Map();
  for (const action of session.actions) {
    if (action.type !== 'type' || !Number.isInteger(action.index)) continue;
    const attempts = attemptsByIndex.get(action.index) || [];
    attempts.push(action);
    attemptsByIndex.set(action.index, attempts);
  }

  for (const match of session.prompt.matchAll(/[a-z]+/gi)) {
    const word = match[0].toLowerCase();
    const offset = match.index;
    const firstWordAction = attemptsByIndex.get(offset)?.[0];
    const lastWordAction = attemptsByIndex.get(offset + word.length - 1)?.at(-1);
    if (lastWordAction) {
      let errors = 0;
      for (let index = offset; index < offset + word.length; index++) {
        errors += attemptsByIndex.get(index)?.filter((attempt) => !attempt.correct).length || 0;
      }
      addWord(words, { word, errors, ms: firstWordAction ? Math.max(1, lastWordAction.atMs - firstWordAction.atMs) : 0 });
    }
    for (let position = 1; position < word.length; position++) {
      const previous = attemptsByIndex.get(offset + position - 1)?.[0];
      const current = attemptsByIndex.get(offset + position)?.[0];
      if (!previous?.correct || !current?.correct) continue;
      const interval = current.atMs - previous.atMs;
      if (interval >= 20 && interval <= 1500) baselineIntervals.push(interval);
    }
    for (let length = 2; length <= Math.min(MAX_PATTERN_LENGTH, word.length); length++) {
      for (let start = 0; start <= word.length - length; start++) {
        const absoluteStart = offset + start;
        const absoluteEnd = absoluteStart + length - 1;
        if (!attemptsByIndex.has(absoluteEnd)) continue;
        const pattern = word.slice(start, start + length);
        const record = patterns.get(pattern) || { attempts: 0, errors: 0, intervals: [], words: new Set() };
        record.attempts++;
        record.words.add(word);
        let incorrect = false;
        for (let index = absoluteStart; index <= absoluteEnd; index++) {
          if (attemptsByIndex.get(index)?.some((attempt) => !attempt.correct)) incorrect = true;
        }
        if (incorrect) record.errors++;
        const first = attemptsByIndex.get(absoluteStart)?.[0];
        const last = attemptsByIndex.get(absoluteEnd)?.at(-1);
        if (first && last) {
          const perTransition = (last.atMs - first.atMs) / (length - 1);
          if (perTransition >= 20 && perTransition <= 1500) record.intervals.push(perTransition);
        }
        patterns.set(pattern, record);
      }
    }
  }
}

function summarizePatterns(patterns, baselineMs) {
  return [...patterns.entries()].map(([text, record]) => {
    const medianMs = median(record.intervals);
    const slowdown = medianMs !== null && baselineMs !== null
      ? Math.round((medianMs / baselineMs - 1) * 100)
      : null;
    const wordCount = record.words.size;
    // Require repeated evidence from multiple words before labeling a pattern
    // as supported.
    const status = record.attempts >= 8 && wordCount >= 2 ? 'supported' : 'early';
    const errorRate = record.errors / record.attempts;
    const evidence = Math.min(1, record.attempts / 12) * Math.min(1, wordCount / 2);
    const errorSignal = (record.errors + 1) / (record.attempts + 8);
    const paceSignal = Math.min(1, Math.max(0, slowdown || 0) / 100);
    const score = evidence * (errorSignal * 0.72 + paceSignal * 0.28) * (1 + (text.length - 2) * 0.04);
    return { text, attempts: record.attempts, errors: record.errors, errorRate, medianMs, slowdown, words: [...record.words], wordCount, status, score };
  });
}

export function chooseDistinctPatterns(patterns, minLength, maxLength, limit = 5) {
  const candidates = patterns
    .filter((pattern) => pattern.text.length >= minLength && pattern.text.length <= maxLength)
    .filter((pattern) => pattern.errors > 0 || (pattern.attempts >= 3 && (pattern.slowdown ?? 0) >= 15))
    .sort((a, b) => Number(b.status === 'supported') - Number(a.status === 'supported') || b.score - a.score);
  // Avoid showing nested patterns together, since they usually describe the
  // same typing problem.
  const chosen = [];
  for (const candidate of candidates) {
    if (chosen.some((item) => item.text.includes(candidate.text) || candidate.text.includes(item.text))) continue;
    chosen.push(candidate);
    if (chosen.length === limit) break;
  }
  return chosen;
}

export function analyzeSessions(sessions) {
  // Completed tests form the baseline; practice attempts are summarized
  // separately so training does not change test performance metrics.
  const tests = sessions.filter((session) => session.mode !== 'practice' && session.completed !== false)
    .map((session) => {
      const inputs = Array.isArray(session.actions)
        ? session.actions.filter((action) => action.type === 'type')
        : session.events || [];
      const accuracy = inputs.length ? inputs.filter((input) => input.correct).length / inputs.length * 100 : session.accuracy;
      return { ...session, accuracy };
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const practice = sessions.filter((session) => session.mode === 'practice' && session.completed !== false)
    .map((session) => {
      const inputs = Array.isArray(session.actions) ? session.actions.filter((action) => action.type === 'type') : session.events || [];
      const accuracy = inputs.length ? inputs.filter((input) => input.correct).length / inputs.length * 100 : session.accuracy;
      return { ...session, accuracy };
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const keys = new Map(), punctuation = new Map(), words = new Map(), patterns = new Map(), baselineIntervals = [];
  const capitals = { attempts: 0, errors: 0 };
  let correctAttempts = 0, totalAttempts = 0;

  for (const session of tests) {
    const inputs = Array.isArray(session.actions)
      ? session.actions.filter((action) => action.type === 'type')
      : session.events || [];
    for (const input of inputs) {
      totalAttempts++;
      if (input.correct) correctAttempts++;
      if (input.expected && input.expected !== ' ') addError(keys, input.expected.toLowerCase(), !input.correct);
      if (/[.,!?;:'"-]/.test(input.expected || '') && input.expected?.length === 1) addError(punctuation, input.expected, !input.correct);
      if (/^[A-Z]$/.test(input.expected || '')) {
        capitals.attempts++;
        if (!input.correct) capitals.errors++;
      }
    }
    if (!session.prompt || !Array.isArray(session.actions)) for (const item of session.words || []) addWord(words, item);
    collectDetailedPatterns(session, patterns, baselineIntervals, words);
  }

  const baselineMs = median(baselineIntervals);
  const patternStats = summarizePatterns(patterns, baselineMs);
  const keyStats = [...keys.entries()]
    .filter(([, record]) => record.errors > 0)
    .map(([text, record]) => ({ text, ...record, errorRate: record.errors / record.attempts, score: (record.errors + 1) / (record.attempts + 8) * Math.min(1, record.attempts / 12) }))
    .sort((a, b) => b.score - a.score || b.errors - a.errors);
  const wordStats = [...words.entries()]
    .map(([text, record]) => ({ text, ...record, msPerCharacter: record.totalMs / record.attempts / text.length }))
    .sort((a, b) => b.errors / b.attempts - a.errors / a.attempts || b.msPerCharacter - a.msPerCharacter);
  const practiceGroups = new Map();
  for (const session of practice) {
    const text = session.targetPattern || 'general';
    const group = practiceGroups.get(text) || { text, sessions: [] };
    group.sessions.push(session);
    practiceGroups.set(text, group);
  }
  return {
    tests,
    practice,
    totalAttempts,
    incorrectAttempts: totalAttempts - correctAttempts,
    accuracy: totalAttempts ? correctAttempts / totalAttempts * 100 : null,
    baselineMs,
    patterns: patternStats,
    longPatterns: chooseDistinctPatterns(patternStats, 3, 5),
    pairs: chooseDistinctPatterns(patternStats, 2, 2),
    keys: keyStats,
    punctuation: [...punctuation.entries()].map(([text, record]) => ({ text, ...record, errorRate: record.errors / record.attempts })).sort((a, b) => b.errors - a.errors || b.attempts - a.attempts),
    capitals,
    words: wordStats,
    practiceGroups: [...practiceGroups.values()].sort((a, b) => b.sessions.length - a.sessions.length),
    detailedTests: tests.filter((session) => Array.isArray(session.actions) && session.prompt).length,
  };
}
