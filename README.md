# LIFEFORM

A cellular focus studio — pomodoro timer, task board, ambience and momentum tracking.
Everything stays local in your browser.

Built with React 19, TypeScript, Vite and Tailwind CSS 4.

## Features

- **Focus timer** — configurable pomodoro cycles with automatic break handling
- **Task board** — prioritised task flow with estimates and pomodoro tracking
- **Ambience** — generated background soundscapes for deep work
- **Momentum tracking** — streaks, heatmap and session statistics
- **Command palette** — keyboard-first navigation
- **Local-first** — all state lives in `localStorage`, no accounts or servers

## Live site

https://dr-skaragiannis.github.io/Lifeform/

The published page is the single-file build committed to `docs/`, served by
GitHub Pages (branch `main`, folder `/docs`).

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # produce a single self-contained dist/index.html
npm run preview  # preview the production build
```

The production build is bundled into **one HTML file** via
[`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile) —
all JavaScript and CSS are inlined, so `dist/index.html` can be opened directly
from disk or dropped on any static host.

### Publishing

`docs/index.html` is the shipped build. After changing the app, regenerate and
commit it:

```bash
npm run build
Copy-Item dist/index.html docs/index.html -Force
git add docs/index.html && git commit -m "Rebuild single-file bundle" && git push
```

## License

All rights reserved.
