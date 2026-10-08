const SENTENCES = [
  'The small turtle crossed the path before the rain began.',
  'A quiet morning gave everyone time to think clearly.',
  'She found a smooth stone beside the old bridge.',
  'The garden looked brighter after three days of rain.',
  'We took the longer road and reached home before sunset.',
  'His first question was simple, but the answer took time.',
  'Every good idea begins with a little curiosity.',
  'The train arrived early, so we stopped for coffee.',
  'I kept the note because it made me smile.',
  'The wind moved through the trees as night fell.',
  'Our neighbor brought fresh bread to the table.',
  'They watched the clouds gather over the distant hills.',
  'A careful reader noticed the detail in the final line.',
  'The new keyboard felt strange for the first hour.',
  'You can start again whenever the rhythm feels wrong.',
  'After lunch, the children asked for one more story.',
  'The clock was slow, yet nobody seemed to mind.',
  'We left the window open to hear the birds.',
  'Her message arrived just as the meeting ended.',
  'Some words are harder to say than to write.',
  'The path turned sharply near the edge of town.',
  'He waited a moment, then opened the heavy door.',
  'On Tuesday, we found the book behind the desk.',
  'The recipe called for salt, pepper, and fresh herbs.',
  'I asked, "Could we try a different route?"',
  'It was late; the lights were still on.',
  'She did not expect such a warm welcome.',
  'The little boat moved slowly across the water.',
];

export const countWords = (text) => text.trim() ? text.trim().split(/\s+/).length : 0;

function sentencePrompt(wordCount, random) {
  const lengths = SENTENCES.map(countWords);
  const reachable = Array(wordCount + 1).fill(false);
  reachable[0] = true;
  for (let remaining = 1; remaining <= wordCount; remaining++) {
    reachable[remaining] = lengths.some((length) => length <= remaining && reachable[remaining - length]);
  }
  if (!reachable[wordCount]) throw new RangeError(`No complete sentence combination for ${wordCount} words`);
  const chosen = [];
  let remaining = wordCount;
  while (remaining) {
    const feasible = SENTENCES.filter((sentence, index) => lengths[index] <= remaining && reachable[remaining - lengths[index]]);
    const unused = feasible.filter((sentence) => !chosen.includes(sentence));
    const alternatives = feasible.filter((sentence) => sentence !== chosen.at(-1));
    const candidates = unused.length ? unused : alternatives.length ? alternatives : feasible;
    const sentence = candidates[Math.floor(random() * candidates.length)];
    chosen.push(sentence);
    remaining -= countWords(sentence);
  }
  return chosen.join(' ');
}

export function makePrompt(style, wordCount, wordBank, random = Math.random) {
  if (!Number.isInteger(wordCount) || wordCount < 1) throw new RangeError('wordCount must be positive');
  if (style === 'sentences') return sentencePrompt(wordCount, random);
  if (!Array.isArray(wordBank) || !wordBank.length) throw new Error('A word bank is required');
  const words = Array.from({ length: wordCount }, () => wordBank[Math.floor(random() * wordBank.length)]);
  if (style === 'punctuation') {
    for (let index = 0; index < words.length; index++) {
      if (index === 0 || index % 12 === 0) words[index] = words[index][0].toUpperCase() + words[index].slice(1);
      if (index % 12 === 11 || index === words.length - 1) words[index] += index % 36 === 35 ? '?' : '.';
      else if (index % 12 === 5) words[index] += ',';
      else if (index % 12 === 8) words[index] += ';';
    }
  }
  return words.join(' ');
}
