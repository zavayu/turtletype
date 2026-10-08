import corpus from './corpora/passages-en.json' with { type: 'json' };

export const PASSAGE_CORPUS_VERSION = corpus.version;
export const PASSAGES = corpus.passages;

export function choosePassage(length, recentIds = [], random = Math.random) {
  const matching = PASSAGES.filter(passage => passage.length === length);
  if (!matching.length) throw new RangeError(`No ${length} passages`);
  const recent = new Set(recentIds.slice(-15));
  const available = matching.filter(passage => !recent.has(passage.id));
  const pool = available.length ? available : matching;
  return pool[Math.floor(random() * pool.length)];
}
