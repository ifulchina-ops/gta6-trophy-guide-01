# Leonida Trophy Atlas

[![gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Rank](https://make.fun/badge/gta6-trophy-guide-01/ifulchina-ops/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![Reward](https://make.fun/badge/gta6-trophy-guide-01/ifulchina-ops/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

An offline guide and tracker for all **55 Grand Theft Auto VI trophies** on PlayStation 5 — 1 platinum, 2 gold, 6 silver, 46 bronze, 28 of them hidden on PSN. Each trophy carries its official name, description and grade, a guide to unlocking it written for this entry, numbered steps, and the sources behind every fact. Around that sit a six-phase roadmap to the platinum with hour estimates, the five missable trophies with their timing, and a tickable before-the-finale checklist.

GTA VI's list was published before the game shipped, so every guide is labelled honestly:

- **CONFIRMED** — the requirement is stated in the official trophy description itself (the mission, the chapter, the count).
- **EXPECTED** — the method is worked out from the official description plus GTA V / GTA Online series patterns and what Rockstar showed in the two GTA VI trailers. Where a trophy's description is vague, the guide says so rather than inventing detail.

Nothing is copied from another guide. Each trophy cites its sources beside the guide text: the official list as Exophase and PSNProfiles publish it, Rockstar's GTA VI site and trailers, and series precedent. Every count quoted (42 Shooting Range challenges, 14 drone race locations, 18 meditation spots, 52 areas, 100 vehicles, 100 WAiNK locations, 250 stunts, 500 choices, 8 strands, 8 garages, 9 gangs) is the number PSN itself tracks.

## What it does

- **Checklist** — all 55 trophies with name, official description, grade pill, kind, PSN count target, and a HIDDEN badge where PSN hides it. Tick a trophy and the header counts it; the platinum bar, the per-grade counters and the roadmap done-counts all update.
- **Search and filters** — free-text search across names, descriptions, guides and kinds; filter by grade, by kind (story, side strands, collectibles, activities, combat and heists, exploration, money and property, odd and rare) and by status (earned, not yet earned, missable only).
- **Spoiler setting** — one tick hides the name, description and guide of every unearned story trophy, in the list and in the detail pane. Earn it (or untick) to reveal it.
- **Detail pane** — the full guide for the selected trophy: what to do, numbered steps, the exact moment it can be missed, and a SOURCES block naming where each fact comes from.
- **Roadmap to the platinum** — six phases in play order, each with a time estimate, the chapters and missions it covers, its trophies and a live done-count. Roughly 30–40 hours of story inside a 65–90 hour platinum.
- **Missables and finale prep** — the five timing-critical trophies, a red warning to earn the partner trophies before the final mission, and a seven-item Before the Finale checklist saved in the browser.
- **Progress that stays put** — earned trophies, the spoiler setting and the finale checklist live in `localStorage`. Export writes them to a JSON file; import reads one back; reset clears them after a confirm.

## Run it

No build step, no network, no account, no dependencies. Serve `app/` with any static file server and open `index.html`:

```sh
node serve.ts
# then open http://localhost:8080
```

Or hand it in the way the grader does — `main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `vendor/makefun-frontend.ts`:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `app/index.html` — the page: header progress, tabs, filter bar, the four views
- `app/style.css` — the whole look, drawn in CSS: no images, no fonts, no requests
- `app/app.js` — one ES module: data load, filters, rendering, localStorage, export/import
- `app/data/trophies.json` — the 55 trophies with name, description, grade, hidden and missable flags, kind, status, PSN count, guide, steps and source keys
- `screenshots/` — four renders of the app running in a desktop browser, 1280×800
- `main.ts` — the hand-in program; `serve.ts` — the local static server
- `vendor/makefun-frontend.ts` — the kit's dossier library, unchanged

## License

0BSD — see [LICENSE](LICENSE).

---

Built for [make.fun](https://make.fun) — [gta6-trophy-guide-01: Build the best GTA 6 trophy guide](https://make.fun/bounty/gta6-trophy-guide-01).
