# TurtleType

TurtleType is a browser-based typing test with insights for keys, words, punctuation, capitalization, and 2–5 letter patterns. It uses completed tests to create targeted practice lines.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Use `npm run build` for a production build.

Results are stored locally in IndexedDB, with a local-storage fallback. No account or backend is required.

Accuracy counts correct character attempts. Backspace is not counted and does not erase mistakes. Completed tests drive insights; practice data stays separate.

Practice has two modes:

- **Focus** targets difficult patterns and words.
- **Word sprint** repeats one word until it is typed correctly within its target-WPM time limit.

## Code layout

- `src/main.js` connects the three views and handles test and practice lifecycles.
- `src/typing/` contains the shared typing engine and prompt generation.
- `src/analytics/` computes typing metrics and analyzes saved runs.
- `src/practice/` selects focused practice words and defines word sprint difficulty.
- `src/data/` holds the word bank and browser storage.
- `src/ui/` renders the insights view.
- `src/styles.css` styles the app.
