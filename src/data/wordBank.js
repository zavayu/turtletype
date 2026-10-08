import corpus from './corpora/words-en.json' with { type: 'json' };

export const COMMON_WORDS = corpus.common;
export const EXTENDED_WORDS = corpus.extended;
export const WORD_CORPUS_VERSION = corpus.version;

export const KEY_WORDS = { q: ['quick', 'quiet', 'question'], w: ['world', 'would', 'while'], e: ['every', 'people', 'between'], r: ['right', 'around', 'through'], t: ['thought', 'little', 'better'], y: ['years', 'your', 'yet'], u: ['under', 'public', 'upon'], i: ['first', 'might', 'which'], o: ['other', 'around', 'course'], p: ['people', 'part', 'place'], a: ['again', 'always', 'against'], s: ['since', 'system', 'school'], d: ['down', 'did', 'during'], f: ['first', 'fact', 'focus'], g: ['going', 'great', 'general'], h: ['through', 'thought', 'house'], j: ['just', 'jump'], k: ['know', 'keyboard'], l: ['little', 'still', 'learn'], z: ['size', 'zero'], x: ['next', 'fox'], c: ['could', 'course', 'called'], v: ['very', 'even', 'never'], b: ['between', 'better', 'build'], n: ['never', 'nothing', 'known'], m: ['measure', 'make', 'common'] };
