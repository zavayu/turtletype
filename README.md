# TurtleType

TurtleType is a browser-based typing test with insights for keys, words, punctuation, capitalization, and 2–5 letter patterns. It uses completed tests to create targeted practice lines.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Use `npm run build` for a production build.
Use `node scripts/validate-corpus.mjs` to check corpus counts, uniqueness, and provenance.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds the site for the repository path and deploys it on every push to `main`.

1. In the GitHub repository, open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**.
2. Push this workflow to `main`. The **Deploy to GitHub Pages** workflow will run automatically. You can also start it from the **Actions** tab.
3. After the workflow succeeds, visit <https://zavayu.github.io/turtletype/>.

The build uses Vite's `/turtletype/` base path so scripts and styles load from the GitHub Pages project URL. If the repository is renamed or a custom domain is added, update the `--base` value in the workflow.

Results are stored locally in IndexedDB, with a local-storage fallback. No account or backend is required.

Accuracy counts correct character attempts. Backspace is not counted and does not erase mistakes. Completed tests drive insights; practice data stays separate.

Tests support timed or exact word-count runs with common and extended word tiers, punctuation, and sourced short, medium, or long passages. Passage runs finish on the final character. Sessions store the corpus version and passage attribution. Insights compare speed for matching test settings while all completed tests contribute to key and pattern analysis. See [corpus sources and regeneration](docs/corpus.md).

Practice has two modes:

- **Focus** targets difficult patterns and words.
- **Word sprint** repeats one word until it is typed correctly within its target-WPM time limit.

## Code layout

- `src/main.js` connects the three views and handles test and practice lifecycles.
- `src/typing/` contains the shared typing engine and generated word prompts.
- `src/analytics/` computes typing metrics and analyzes saved runs.
- `src/practice/` selects focused practice words and defines word sprint difficulty.
- `src/data/` holds versioned word and passage corpora and browser storage.
- `src/ui/` renders the insights view.
- `src/styles.css` styles the app.
