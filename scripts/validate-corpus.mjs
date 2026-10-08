import { readFile } from 'node:fs/promises';

const words = JSON.parse(await readFile('src/data/corpora/words-en.json', 'utf8'));
const passages = JSON.parse(await readFile('src/data/corpora/passages-en.json', 'utf8')).passages;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(words.common.length === 300 && words.extended.length === 1000, 'Unexpected word tier sizes');
assert(new Set(words.common).size === 300 && new Set(words.extended).size === 1000, 'Duplicate words');
assert(words.extended.every(word => /^[a-z]+$/.test(word)), 'Invalid word');
assert(words.common.every(word => words.extended.includes(word)), 'Common word missing from extended tier');
assert(passages.length === 100 && new Set(passages.map(passage => passage.id)).size === 100, 'Invalid passage IDs');
assert(passages.every(passage => passage.wordCount === passage.text.trim().split(/\s+/).length), 'Passage word count mismatch');
assert(passages.every(passage => passage.title && passage.author && passage.sourceUrl && passage.sourceFile && passage.paragraph), 'Missing passage provenance');
assert(passages.every(passage => /^[\x20-\x7e]+$/.test(passage.text)), 'Unsupported passage characters');
console.log(`Validated ${words.common.length} common words, ${words.extended.length} extended words, and ${passages.length} passages.`);
