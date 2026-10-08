# English corpus

The app ships two word tiers (300 common, 1,000 extended) and 100 passages. The word tiers combine TurtleType's original words with frequent lowercase words from the editions below. Each passage is one source paragraph, 28–150 words, with a stable ID, work metadata, source file, paragraph number, and length tier. The selected paragraphs were screened for complete sentence endings, ordinary keyboard characters, and repeated text. The source text is normalized to straight quotes, single spaces, and hyphenated dashes for typing.

| Work | Source repository | Pinned commit |
| --- | --- | --- |
| Pride and Prejudice — Jane Austen | [Standard Ebooks](https://github.com/standardebooks/jane-austen_pride-and-prejudice) | `ed94a32be3e875c0814568050c7544e03aad3ef5` |
| The Adventures of Sherlock Holmes — Arthur Conan Doyle | [Standard Ebooks](https://github.com/standardebooks/arthur-conan-doyle_the-adventures-of-sherlock-holmes) | `48ec456ea50987a81f564821457b9fb32cc2bfc6` |
| Alice's Adventures in Wonderland — Lewis Carroll | [Standard Ebooks](https://github.com/standardebooks/lewis-carroll_alices-adventures-in-wonderland) | `9ecdf2ffa23098e7cb3c72157d7c3031b6f59903` |
| The Wonderful Wizard of Oz — L. Frank Baum | [Standard Ebooks](https://github.com/standardebooks/l-frank-baum_the-wonderful-wizard-of-oz) | `36104f0b9ace47debd6ac19cec9dc91b3858e83a` |
| The Secret Garden — Frances Hodgson Burnett | [Standard Ebooks](https://github.com/standardebooks/frances-hodgson-burnett_the-secret-garden) | `17f754b0b3637bf63c8d13ebb4f0b4f3d19eb2e1` |

Each repository's `LICENSE.md` says the source text is believed to be in the U.S. public domain and Standard Ebooks contributors dedicate their contributions under CC0. Public-domain status can differ outside the U.S. See [Standard Ebooks' public-domain policy](https://standardebooks.org/about/standard-ebooks-and-the-public-domain).

To regenerate, clone these repositories at the pinned commits under `.corpus-source/{austen,doyle,carroll,baum,burnett}`, then run `node scripts/build-corpus.mjs`. The script updates `src/data/corpora/words-en.json` and `src/data/corpora/passages-en.json`. Review the resulting passages before changing the corpus version or publishing them. The checked-in word file seeds its next regeneration, preserving previously reviewed words.
