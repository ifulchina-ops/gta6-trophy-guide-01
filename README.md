# Leonida Trophy Atlas

[![gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Rank](https://make.fun/badge/gta6-trophy-guide-01/ifulchina-ops/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Reward](https://make.fun/badge/gta6-trophy-guide-01/ifulchina-ops/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

An offline guide and tracker for all **55 Grand Theft Auto VI trophies** (PlayStation 5): every trophy with its official name, description and grade, a step-by-step unlock guide written in the author's own words with its sources named beside it, a timed roadmap to the platinum, and the missable trophies flagged with a pre-finale checklist.

GTA VI's trophy list was published before the game launched, so every method in this guide is labelled honestly: **CONFIRMED** where the official description itself states the requirement, **EXPECTED** where the method is worked out from the official description plus GTA V / GTA Online series patterns and what Rockstar showed in the GTA VI trailers. Nothing is copied from another guide — each trophy cites its sources (the official list on Exophase and PSNProfiles, Rockstar's trailers and official site, and series patterns). Every count a guide quotes (42 Shooting Range challenges, 14 drone locations, 18 meditation spots, 52 areas, 100 vehicles, 100 WAiNK locations, 250 stunts, 500 choices) is the number PSN itself tracks.

## What it does

- **Checklist** — all 55 trophies (1 platinum, 2 gold, 6 silver, 46 bronze, 28 hidden on PSN), ticked off as you earn them; progress is saved in the browser (localStorage) and never leaves it. Each card shows its PSN count target where one exists, and missable cards say exactly when they can pass.
- **Search & filters** — by name, mission or keyword; by grade, by kind (story, side strands, collectibles, activities, combat & heists, exploration, money & property, odd & rare); by earned / not yet earned / missable only.
- **Spoiler setting** — hides the names and descriptions of story trophies until they are earned.
- **Detail pane** — tap any trophy for its full guide: what to do, where, in what order, when it can be missed, the PSN target, and the sources each fact comes from.
- **Roadmap to the platinum** — six phases in play order with time estimates (roughly 65–90 hours in all) and chapter/mission mapping, each phase with its trophies and a live done-count.
- **Missables & finale prep** — the 5 trophies that need the right moment, a warning to do the partner trophies before the final mission, and a tickable Before the Finale checklist saved in the browser.
- **Export / import** — download your progress as JSON and import it back on any browser.

## Run it

No build step, no network, no account. Serve `app/` with any static file server and open `index.html`:

```sh
node serve.ts
# then open http://localhost:8080
```

The hand-in program is `main.ts` (Node 22): it copies `app/` and `screenshots/` to `/output` and writes `/output/dossier.json`.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `app/index.html`, `app/app.js`, `app/style.css` — the guide itself
- `app/data/trophies.json` — the 55 official trophies with a guide, steps, sources, kind, missable and hidden flags, and PSN count target for each
- `screenshots/` — renders of the guide running in a desktop browser
- `vendor/makefun-frontend.ts` — the kit's dossier library, unchanged
- `serve.ts` — a tiny static server for local use

## License

0BSD — see [LICENSE](LICENSE).

---

Built for [make.fun](https://make.fun) — [gta6-trophy-guide-01: Build the best GTA 6 trophy guide](https://make.fun/bounty/gta6-trophy-guide-01).
