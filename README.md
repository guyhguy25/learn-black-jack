# Strategy Table — Blackjack Trainer

Practice **basic strategy** and **Hi-Lo card counting** on a live-style blackjack table. Wrong decisions are called out against chart-correct play so you build habits that hold up under a real shoe.

**Live:** [learn-black-jack.vercel.app](https://learn-black-jack.vercel.app)

## What you can do

- Play multi-seat rounds with chip betting, deal animation, and a shared bankroll
- Train against basic strategy (hit / stand / double / split / surrender) with accuracy tracking
- Follow Hi-Lo running and true count with an optional hide-values mode
- Open an on-table strategy chart overlay while you play
- Tune table rules in Settings (decks, DAS, surrender, bankroll, chip set, and more)
- Persist settings and bankroll in the browser (`localStorage`)

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS v4
- Deployed on [Vercel](https://vercel.com)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm start       # serve the build
npm run lint    # ESLint
```

## Project layout

| Path | Role |
|------|------|
| `app/` | Next.js app shell, global styles |
| `components/` | Table UI (game, cards, chart/count panels, settings) |
| `lib/game.ts` | Round flow, seats, betting, dealer |
| `lib/strategy.ts` | Basic strategy decisions |
| `lib/counting.ts` | Hi-Lo counting helpers |
| `lib/cards.ts` | Deck / hand evaluation |
| `lib/persist.ts` | Browser persistence |

## Workflow

Feature work lands on a branch and opens a PR into `master` (see `.cursor/rules/branch-and-pr.mdc`). Do not push app changes straight to `master`.

## License

Private project — all rights reserved unless otherwise noted.
