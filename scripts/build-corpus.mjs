import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Run after cloning the pinned Standard Ebooks repositories listed in README.md.
const sources = [
  { key: 'austen', slug: 'jane-austen/pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen' },
  { key: 'doyle', slug: 'arthur-conan-doyle/the-adventures-of-sherlock-holmes', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { key: 'carroll', slug: 'lewis-carroll/alices-adventures-in-wonderland', title: 'Alice’s Adventures in Wonderland', author: 'Lewis Carroll' },
  { key: 'baum', slug: 'l-frank-baum/the-wonderful-wizard-of-oz', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum' },
  { key: 'burnett', slug: 'frances-hodgson-burnett/the-secret-garden', title: 'The Secret Garden', author: 'Frances Hodgson Burnett' },
];

const decode = (text) => text.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi, (_, code, named) => {
  if (code) return String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[named.toLowerCase()];
});
function clean(html) {
  return decode(html.replace(/<[^>]+>/g, ''))
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, ' - ')
    .replace(/…/g, '...').replace(/[\u00a0\u2060]/g, ' ').replace(/\s+/g, ' ').trim();
}
const count = (text) => text.split(/\s+/).length;
const files = [];
const frequency = new Map();
for (const source of sources) {
  const dir = join('.corpus-source', source.key, 'src', 'epub', 'text');
  for (const file of (await readdir(dir)).filter(name => /^(chapter|part|story|the-|a-).*\.xhtml$/.test(name)).sort()) {
    const html = await readFile(join(dir, file), 'utf8');
    const paragraphs = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)].map(match => /<br\b/i.test(match[1]) ? '' : clean(match[1]));
    paragraphs.forEach(text => {
      for (const word of text.matchAll(/(?<![A-Za-z'])\b[a-z]{2,15}\b(?![A-Za-z'])/g)) frequency.set(word[0], (frequency.get(word[0]) || 0) + 1);
    });
    files.push({ source, file, paragraphs });
  }
}

const initial = JSON.parse(await readFile('src/data/corpora/words-en.json', 'utf8')).common;
const ranked = [...frequency].filter(([word, uses]) => uses >= 5 && /^[a-z]+$/.test(word) && !new Set(['tha', 'thy', 'thee', 'thou', 'tis', 'yer']).has(word))
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([word]) => word);
const common = [...new Set([...initial, ...ranked])].slice(0, 300);
const extended = [...new Set([...common, ...ranked])].slice(0, 1000);
if (extended.length !== 1000) throw new Error(`Only ${extended.length} eligible words`);

const eligible = files.flatMap(({ source, file, paragraphs }) => paragraphs.map((text, index) => {
  const wordCount = count(text);
  const length = wordCount >= 28 && wordCount <= 52 ? 'short' : wordCount >= 53 && wordCount <= 90 ? 'medium' : wordCount >= 91 && wordCount <= 150 ? 'long' : null;
  if (!length || !/^[A-Z"']/.test(text) || !/[.!?]$/.test(text) || /[\[\]{}<>\d]/.test(text) || /\s-\s-/.test(text)) return null;
  return { source, file, index, text, length, wordCount };
}).filter(Boolean));

const passages = [];
for (const source of sources) for (const [length, quota] of [['short', 8], ['medium', 7], ['long', 5]]) {
  const pool = eligible.filter(item => item.source.key === source.key && item.length === length);
  if (pool.length < quota) throw new Error(`${source.key} has only ${pool.length} ${length} passages`);
  for (let n = 0; n < quota; n++) {
    const item = pool[Math.floor((n + 0.5) * pool.length / quota)];
    const hash = createHash('sha256').update(`${item.file}:${item.index}:${item.text}`).digest('hex').slice(0, 10);
    passages.push({ id: `${source.key}-${hash}`, title: source.title, author: source.author,
      sourceUrl: `https://standardebooks.org/ebooks/${source.slug}`,
      sourceFile: item.file, paragraph: item.index + 1, length, wordCount: item.wordCount, text: item.text });
  }
}
await mkdir('src/data/corpora', { recursive: true });
await writeFile('src/data/corpora/words-en.json', JSON.stringify({ version: 1, source: 'Standard Ebooks editions plus original TurtleType words', common, extended }, null, 2) + '\n');
await writeFile('src/data/corpora/passages-en.json', JSON.stringify({ version: 1, rights: 'Source texts believed US public domain; Standard Ebooks editorial contributions CC0. Check local law outside the US.', passages }, null, 2) + '\n');
console.log(`Wrote ${common.length} common words, ${extended.length} extended words, ${passages.length} passages`);
