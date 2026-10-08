export const countWords = (text) => text.trim() ? text.trim().split(/\s+/).length : 0;

// Generate a prompt from the selected word bank and add punctuation at a
// predictable cadence so the style can be measured consistently.
export function makePrompt(style, wordCount, wordBank, random = Math.random) {
  if (!Number.isInteger(wordCount) || wordCount < 1) throw new RangeError('wordCount must be positive');
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
