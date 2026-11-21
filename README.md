# Leonida Trophy Atlas

[![gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Rank](https://make.fun/badge/gta6-trophy-guide-01/ifulchina-ops/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Reward](https://make.fun/badge/gta6-trophy-guide-01/ifulchina-ops/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

A guide and tracker that runs entirely offline, covering all **55 Grand Theft Auto VI trophies** on PlayStation 5 — 1 platinum, 2 gold, 6 silver, 46 bronze, with 28 of them hidden on PSN. For every trophy you get its official name, description and grade, a guide to unlocking it, numbered steps, and the sources standing behind each fact. Wrapped around that are a six-phase roadmap to the platinum with hour estimates, the five missable trophies and their timing, and a before-the-finale checklist you can tick off.

Because GTA VI's list went public before the game shipped, every guide is labelled honestly:

- **CONFIRMED** — the official trophy description itself states the requirement (the mission, the chapter, the count).
- **EXPECTED** — the method is worked out from that official description together with GTA V / GTA Online series patterns and what Rockstar showed in the two GTA VI trailers. Where a description stays vague, the guide admits it instead of inventing detail.

No other guide has been copied. Each trophy cites its sources next to the guide text: the official list as Exophase and PSNProfiles publish it, Rockstar's GTA VI site and trailers, and series precedent. Every count quoted (42 Shooting Range challenges, 14 drone race locations, 18 meditation spots, 52 areas, 100 vehicles, 100 WAiNK locations, 250 stunts, 500 choices, 8 strands, 8 garages, 9 gangs) is the figure PSN tracks itself.

## What it does

- **Checklist** — every one of the 55 trophies with name, official description, grade pill, kind, PSN count target, and a HIDDEN badge wherever PSN hides it. Tick one and the header counts it; the platinum bar, the per-grade counters and the roadmap done-counts all move with it.
- **Search and filters** — free-text search over names, descriptions, guides and kinds; filter by grade, by kind (story, side strands, collectibles, activities, combat and heists, exploration, money and property, odd and rare) and by status (earned, not yet earned, missable only).
- **Spoiler setting** — a single tick hides the name, description and guide of every unearned story trophy, both in the list and in the detail pane. Earn the trophy (or untick the box) and it comes back.
- **Detail pane** — the whole guide for whichever trophy is selected: what to do, numbered steps, the exact moment it can be missed, and a SOURCES block naming where each fact came from.
- **Roadmap to the platinum** — six phases in playing order, each with a time estimate, the chapters and missions it spans, its trophies and a live done-count. Roughly 30–40 hours of story inside a 65–90 hour platinum.
- **Missables and finale prep** — the five timing-critical trophies, a red warning to earn the partner trophies before the final mission, and a seven-item Before the Finale checklist kept in the browser.
- **Progress that stays put** — earned trophies, the spoiler setting and the finale checklist all live in `localStorage`. Export writes them out to a JSON file; import reads one back in; reset clears them once you confirm.

## Run it

There is no build step, no network, no account and no dependencies. Point any static file server at `app/` and open `index.html`:

```sh
node serve.ts
# then open http://localhost:8080
```

Or hand it in the same way the grader does — `main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` into the output directory, then writes `dossier.json` through the kit's `vendor/makefun-frontend.ts`:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `app/index.html` — the page itself: header progress, the four tabs, the filter bar, the four views
- `app/style.css` — the whole look in one stylesheet, no images, no fonts, no requests made
- `app/app.js` — a single ES module covering data load, filters, rendering, localStorage, export/import
- `app/data/trophies.json` — all 55 trophies, each with name, description, grade, hidden/missable flags, kind, status, PSN count, guide, steps and source keys
- `screenshots/` — four desktop-browser renders of the app at 1280×800
- `main.ts` — the hand-in program, with `serve.ts` beside it as the local static server
- `vendor/makefun-frontend.ts` — the kit's dossier library, left unchanged

## License

0BSD — see [LICENSE](LICENSE).

---

Built for [make.fun](https://make.fun) — [gta6-trophy-guide-01: Build the best GTA 6 trophy guide](https://make.fun/bounty/gta6-trophy-guide-01).
