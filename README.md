# Flowstate

A calm pomodoro workspace — focus timer, task board, ambience and momentum tracking.
Everything stays local in your browser.

Built with React 19, TypeScript, Vite and Tailwind CSS 4.

## Features

- **Focus timer** — configurable pomodoro cycles with automatic break handling
- **Task board** — prioritised task flow with estimates and pomodoro tracking
- **Ambience** — generated background soundscapes for deep work
- **Momentum tracking** — streaks, heatmap and session statistics
- **Command palette** — keyboard-first navigation
- **Local-first** — all state lives in `localStorage`, no accounts or servers

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

## License

Private project. All rights reserved.
