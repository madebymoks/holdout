# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build locally
npm run test.unit    # Run unit tests with Vitest
npm run test.e2e     # Run E2E tests with Cypress
npm run lint         # Run ESLint
```

Run a single unit test file:
```bash
npx vitest run src/path/to/file.test.tsx
```

## Stack

- **React 19** + **TypeScript** (strict mode) — `tsconfig.json` targets ESNext with no emit (Vite handles compilation)
- **Ionic Framework 8** — Mobile-first UI components; wraps the entire app in `<IonApp>`
- **Capacitor 8** — Native iOS/Android deployment layer (haptics, keyboard, status bar plugins)
- **Vite 5** — Dev server + bundler; Vitest for unit tests (jsdom environment)
- **React Router 5** via `IonReactRouter`

## Architecture

The app follows a page-based Ionic structure:

```
src/
  main.tsx              # React DOM bootstrap
  App.tsx               # Root: IonApp → IonReactRouter → Route definitions
  pages/                # One component per route (IonPage layout)
  components/           # Reusable UI components
  theme/variables.css   # CSS custom properties for theming
```

**Routing:** `App.tsx` defines all routes using `IonReactRouter` + `IonRouterOutlet`. Each page lives in `src/pages/` and uses Ionic layout components (`IonPage`, `IonHeader`, `IonContent`).

**Testing setup:** `src/setupTests.ts` mocks `window.matchMedia` — required for Ionic components in jsdom. Import this via `vitest.config` setupFiles (configured in `vite.config.ts`).

**Capacitor:** Native features are accessed through `@capacitor/*` plugin imports. Web fallbacks are handled automatically by Capacitor when running in a browser.
