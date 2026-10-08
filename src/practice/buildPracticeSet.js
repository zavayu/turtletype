export function buildPracticeSet(analysis, wordBank, keyWords, requestedPattern = null) {
  // Prefer a requested or well-supported pattern, then fall back to the
  // strongest available signal and finally to general vocabulary.
  const focus = requestedPattern
    || analysis.longPatterns.find((pattern) => pattern.status === 'supported')
    || analysis.pairs.find((pattern) => pattern.status === 'supported')
    || analysis.longPatterns[0]
    || analysis.pairs[0]
    || null;
  const focusText = focus?.text || null;
  const focusWords = focusText ? [...new Set([...wordBank, ...(focus.words || [])].filter((word) => word.includes(focusText)))] : [];
  const difficultWords = analysis.words.slice(0, 6).map((item) => item.text);
  const difficultKeys = analysis.keys.slice(0, 3).flatMap((item) => keyWords[item.text] || []);
  const general = [...new Set([...difficultWords, ...difficultKeys, ...wordBank])];
  const warmup = ['steady', 'rhythm', 'practice', 'focus', 'typing', 'progress'];
  const fallback = general.length ? general : warmup;
  const fullFocus = requestedPattern || focus?.status === 'supported';
  const focusedSlots = focusWords.length >= 3 ? (fullFocus ? 16 : 8) : focusWords.length ? (fullFocus ? 10 : 5) : 0;
  // Reserve the first slots for focused words before shuffling the finished
  // line so practice remains targeted without feeling repetitive.
  const words = Array.from({ length: 24 }, (_, index) => {
    const pool = index < focusedSlots ? focusWords : fallback;
    return pool[Math.floor(Math.random() * pool.length)];
  });
  for (let index = words.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [words[index], words[swap]] = [words[swap], words[index]];
  }
  return { words, focusText, focusStatus: focus?.status || null, targets: [...new Set([focusText, ...difficultWords.slice(0, 2)].filter(Boolean))] };
}
