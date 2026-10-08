export const SPRINT_LEVELS = {
  easy: { minLength: 3, maxLength: 5 },
  medium: { minLength: 5, maxLength: 7 },
  hard: { minLength: 7, maxLength: 20 },
};

// Convert the standard five-character word into the time allowed for a sprint.
export function sprintTargetMs(word, targetWpm) {
  if (!Number.isFinite(targetWpm) || targetWpm <= 0) throw new RangeError('Target WPM must be positive');
  return Math.round((word.length / 5) * (60000 / targetWpm));
}

export function chooseSprintWord(difficulty, analysis, wordBank, previous = null, random = Math.random) {
  const level = SPRINT_LEVELS[difficulty];
  if (!level) throw new RangeError(`Unknown sprint difficulty: ${difficulty}`);
  const eligible = (word) => /^[a-z]+$/i.test(word) && word.length >= level.minLength && word.length <= level.maxLength;
  const difficult = [
    ...analysis.words.filter((item) => item.errors > 0).map((item) => item.text),
    ...analysis.longPatterns.flatMap((item) => item.words),
  ];
  const priority = [...new Set(difficult.filter(eligible))];
  const general = [...new Set(wordBank.filter(eligible))];
  // Favor words tied to observed mistakes, but keep enough random vocabulary
  // to prevent every sprint from repeating the same targets.
  const source = priority.length && random() < 0.7 ? priority : general;
  const choices = source.filter((word) => word !== previous);
  const alternatives = general.filter((word) => word !== previous);
  const pool = choices.length ? choices : alternatives.length ? alternatives : source;
  return pool[Math.floor(random() * pool.length)] || null;
}
