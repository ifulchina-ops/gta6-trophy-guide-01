/**
 * Leonida Trophy Atlas — tracker logic for the GTA VI checklist.
 *
 * Kept as a single module on purpose: one data file, one stylesheet, this file.
 * Nothing is bundled, nothing is compiled, and no request leaves the page except
 * the one for the trophy JSON, which is served from the app's own directory.
 * Everything the player touches — ticks, the finale checklist, the spoiler
 * switch — is written to localStorage and only ever leaves through the export
 * button.
 *
 * Reading order below:
 *   constants   — storage keys, grade order, labels, source table, missable hints
 *   markup      — the small DOM builders every renderer shares
 *   state       — the in-memory truth, hydrated from storage once
 *   storage     — Set <-> localStorage helpers
 *   predicate   — the single filter used by both the list and its counts
 *   header      — progress figure, bar and per-grade line
 *   checklist   — cards, then the detail pane beside them
 *   roadmap     — six phases plus the time strip above them
 *   missables   — the five missable cards and the before-the-finale list
 *   sources     — the source table rendered as links
 *   views       — tab switching and the full repaint
 *   wiring      — event listeners for tick, filter, spoiler, export/import/reset
 *   boot        — fetch once, paint everything
 *
 * Each renderer recomputes from the arrays rather than patching the DOM, so a
 * tick in one place cannot leave the header, the cards and the roadmap totals
 * disagreeing with each other. The shell is left untouched until the data has
 * arrived, so a failed fetch shows an empty frame rather than a half-drawn one.
 */

const STORE = {
  earned: 'leonida-atlas.earned.v3',
  finale: 'leonida-atlas.finale.v3',
  spoilers: 'leonida-atlas.spoilers.v3',
};

const GRADE_SEQUENCE = ['platinum', 'gold', 'silver', 'bronze'];

const KIND_TEXT = {
  story: 'Story',
  side: 'Side strand',
  collectible: 'Collectible',
  activity: 'Activity',
  combat: 'Combat & heist',
  exploration: 'Exploration',
  economy: 'Money & property',
  misc: 'Odd & rare',
};

// Link targets for the source keys the JSON cites. These are only ever rendered
// as anchors — no page here is ever fetched by this app. `series` has no page of
// its own because it is a body of precedent rather than a document.
const SOURCE_TABLE = {
  exophase: ['Exophase — GTA VI trophy list', 'https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/'],
  psnprofiles: ['PSNProfiles — GTA VI trophies', 'https://psnprofiles.com/trophies/43531-grand-theft-auto-vi'],
  official: ['Rockstar Games — GTA VI official site', 'https://www.rockstargames.com/VI'],
  trailer1: ['Rockstar Games — GTA VI Trailer 1 (Dec 2023)', 'https://www.rockstargames.com/VI'],
  trailer2: ['Rockstar Games — GTA VI Trailer 2 (May 2025)', 'https://www.rockstargames.com/VI'],
  series: ['GTA V / GTA Online — series patterns', null],
};

// One sentence per missable trophy saying when the window closes. Shown on the
// missable card and again as the warning at the head of that trophy's guide.
const MISSABLE_HINT = new Map([
  [20, 'Take it the moment Cal offers it — a refused challenge may not come back.'],
  [29, 'Only inside Bret’s hunt — never shoot the animal before it starts.'],
  [33, 'Before the final mission, with your partner in free roam.'],
  [34, 'Before the final mission, with your partner in free roam.'],
  [39, 'Retryable, but a spotted attempt fails — go in clean.'],
]);

// ---------------------------------------------------------------------------
// markup helpers
// ---------------------------------------------------------------------------

const nodeById = (id) => document.getElementById(id);

function mk(tag, cls, text) {
  const built = document.createElement(tag);
  if (cls) built.className = cls;
  if (text !== undefined) built.textContent = text;
  return built;
}

const titleCase = (word) => word.charAt(0).toUpperCase() + word.slice(1);

function gradeTag(t) {
  return mk('span', `pill ${t.grade}`, titleCase(t.grade));
}

function tagSpan(text, cls) {
  return mk('span', `tag ${cls}`.trim(), text);
}

function outLink(label, href) {
  const anchor = mk('a', '', label);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

/** The tag row under a trophy name: grade, kind, count and the three flags. */
function metaRow(t, longCount) {
  const meta = mk('div', 'meta');
  meta.append(gradeTag(t));
  meta.append(tagSpan(KIND_TEXT[t.kind] ?? t.kind, ''));
  if (t.count) meta.append(tagSpan(longCount ? `PSN target: ${t.count}` : t.count, 'count'));
  if (t.missable) meta.append(tagSpan('MISSABLE', 'missable'));
  if (t.hidden) meta.append(tagSpan('HIDDEN', 'hidden'));
  meta.append(tagSpan(t.status.toUpperCase(), t.status));
  return meta;
}

// ---------------------------------------------------------------------------
// state and its storage
// ---------------------------------------------------------------------------

/** Read a stored integer list, ignoring anything else that may be in the slot. */
function readIds(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n) => Number.isInteger(n)));
  } catch {
    return new Set();
  }
}

function writeIds(key, ids) {
  localStorage.setItem(key, JSON.stringify([...ids].sort((a, b) => a - b)));
}

const state = {
  trophies: [],
  earned: readIds(STORE.earned),
  finale: readIds(STORE.finale),
  spoilers: localStorage.getItem(STORE.spoilers) === '1',
  selected: null,
};

const persistEarned = () => writeIds(STORE.earned, state.earned);
const persistFinale = () => writeIds(STORE.finale, state.finale);
const persistSpoilers = () => localStorage.setItem(STORE.spoilers, state.spoilers ? '1' : '0');

/** True while this trophy's name, description and guide must stay covered. */
function concealed(t) {
  return state.spoilers && t.kind === 'story' && !state.earned.has(t.id);
}

const trophyById = (id) => state.trophies.find((t) => t.id === id);

// ---------------------------------------------------------------------------
// the one filter behind the list and its counts
// ---------------------------------------------------------------------------

function passes(t) {
  const needle = nodeById('search').value.trim().toLowerCase();
  if (needle) {
    const hay = concealed(t)
      ? `${KIND_TEXT[t.kind] ?? ''} hidden story trophy`
      : [t.name, t.description, t.guide, (t.steps ?? []).join(' '), KIND_TEXT[t.kind] ?? ''].join(' ');
    if (!hay.toLowerCase().includes(needle)) return false;
  }

  const grade = nodeById('grade').value;
  if (grade !== 'all' && t.grade !== grade) return false;

  const kind = nodeById('kind').value;
  if (kind !== 'all' && t.kind !== kind) return false;

  const status = nodeById('status').value;
  if (status === 'earned' && !state.earned.has(t.id)) return false;
  if (status === 'remaining' && state.earned.has(t.id)) return false;
  if (status === 'missable' && !t.missable) return false;

  return true;
}

// ---------------------------------------------------------------------------
// header
// ---------------------------------------------------------------------------

function renderProgress() {
  const total = state.trophies.length;
  const done = state.earned.size;
  const pct = total ? Math.round((done / total) * 100) : 0;

  nodeById('earnedCount').textContent = String(done);
  nodeById('barFill').style.width = `${total ? (done / total) * 100 : 0}%`;
  nodeById('pctLine').textContent = total && done === total
    ? 'Platinum earned — a Leonida Legend.'
    : `${pct}% of the way to the platinum`;

  nodeById('gradeLine').textContent = GRADE_SEQUENCE.map((grade) => {
    const band = state.trophies.filter((t) => t.grade === grade);
    const got = band.filter((t) => state.earned.has(t.id)).length;
    return `${titleCase(grade)} ${got}/${band.length}`;
  }).join('  ·  ');
}

function renderCountLine(shown) {
  const bits = [
    `Showing ${shown} of ${state.trophies.length} trophies`,
    `${state.earned.size} earned`,
    `${state.trophies.filter((t) => t.missable).length} missable`,
    `${state.trophies.filter((t) => t.hidden).length} hidden on PSN`,
  ];
  if (state.spoilers) bits.push('spoilers on: unearned story trophies are hidden');
  nodeById('countLine').textContent = bits.join(' · ');
}

// ---------------------------------------------------------------------------
// checklist cards
// ---------------------------------------------------------------------------

/** One row of the checklist: tick box, name, official description, tag row. */
function buildCard(t, onOpen) {
  const card = mk('button', 'card');
  card.type = 'button';
  card.classList.toggle('earned', state.earned.has(t.id));
  card.classList.toggle('selected', state.selected === t.id);
  card.setAttribute('aria-pressed', state.earned.has(t.id) ? 'true' : 'false');

  const head = mk('div', 'row1');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = state.earned.has(t.id);
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('click', (event) => {
    event.stopPropagation();
    if (box.checked) state.earned.add(t.id);
    else state.earned.delete(t.id);
    persistEarned();
    renderAll();
  });

  head.append(box, mk('span', 'name', concealed(t) ? 'Hidden story trophy' : t.name));

  const summary = mk('div', 'desc', concealed(t)
    ? 'Its name and description stay hidden until you earn it, while the spoiler setting is on.'
    : t.description);

  card.append(head, summary, metaRow(t, false));
  card.addEventListener('click', () => onOpen(t));
  return card;
}

function openTrophy(t) {
  state.selected = t.id;
  renderCards();
  renderDetail();
  nodeById('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderCards() {
  const shown = state.trophies.filter(passes);
  renderCountLine(shown.length);

  const list = nodeById('cards');
  list.replaceChildren();

  shown.forEach((t) => {
    const row = document.createElement('li');
    row.append(buildCard(t, openTrophy));
    list.append(row);
  });

  if (shown.length === 0) {
    const row = document.createElement('li');
    row.append(mk('p', 'hint', 'No trophy matches those filters. Clear the search or set the selects back to All.'));
    list.append(row);
  }
}

// ---------------------------------------------------------------------------
// detail pane
// ---------------------------------------------------------------------------

function renderDetail() {
  const pane = nodeById('detail');
  pane.replaceChildren();
  const t = trophyById(state.selected);

  if (!t) {
    pane.append(mk('p', 'empty', 'Pick a trophy on the left to read its guide, its steps and the sources behind every fact in it.'));
    return;
  }

  if (concealed(t)) {
    pane.append(mk('h2', '', 'Hidden story trophy'));
    pane.append(mk('p', '', 'This one is part of the story and the spoiler setting is on, so its name, description and guide are hidden. Earn it in the game — the tick box on its card — or turn the spoiler setting off in the filter bar.'));
    return;
  }

  pane.append(mk('h2', '', t.name));
  pane.append(metaRow(t, true));
  pane.append(mk('p', 'official', `Official description: “${t.description}”`));

  if (t.missable) {
    const warning = mk('p', 'warn');
    warning.textContent = `⚠ Missable — ${MISSABLE_HINT.get(t.id) ?? 'this one needs the right moment.'} Do it before it can pass, and save first.`;
    pane.append(warning);
  }

  pane.append(mk('h3', '', 'How to unlock it'));
  pane.append(mk('p', '', t.guide));

  if ((t.steps ?? []).length) {
    const steps = document.createElement('ol');
    t.steps.forEach((step) => steps.append(mk('li', '', step)));
    pane.append(steps);
  }

  pane.append(mk('h3', '', 'Sources'));
  const sources = mk('p', 'sources');
  (t.sources ?? []).forEach((key, index) => {
    const [label, url] = SOURCE_TABLE[key] ?? [key, null];
    if (index > 0) sources.append(mk('span', 'sep', ' · '));
    sources.append(url ? outLink(label, url) : document.createTextNode(label));
  });
  sources.append(mk('span', 'srcNote', t.status === 'confirmed'
    ? 'The requirement itself is the official description; the steps above are this atlas’s own reading of it.'
    : 'Reasoned from the official description plus series precedent and the GTA VI trailers — not played and checked in the retail game.'));
  pane.append(sources);

  pane.append(mk('h3', '', 'Your progress'));
  const ticked = state.earned.has(t.id);
  pane.append(mk('p', ticked ? 'earnedNote' : '', ticked
    ? 'Earned and ticked in this browser. Untick it on the card if that was a misclick.'
    : 'Not earned yet. Tick the box on its card when the trophy pops in the game.'));
}

// ---------------------------------------------------------------------------
// roadmap
// ---------------------------------------------------------------------------
//
// Six phases in the order a first run should take them. Each one lists the
// chapters, missions and counts it covers (all of them taken from the official
// descriptions), an honest first-run time, and the trophy ids it should earn.
// The ids are the same ids the JSON uses, so a phase can never name a trophy the
// data does not contain.

const PHASES = [
  {
    title: 'Phase 1 — play the story',
    short: 'Story',
    when: 'Chapters 1–4 and the final mission · ≈30–40 hours',
    maps: 'Gone Fishing · Breakfast Run · The Cartel Heist · Child’s Play · Headliners · VCIA Takedown · Operation Savage Glory · the four chapter trophies · the finale',
    text: 'The story goes first because it unlocks everything else: the map, the contacts, the venues and the stranger markers the later phases need. Gone Fishing opens the game, the named-mission trophies follow in story order, and each chapter trophy pops at its chapter-complete screen. Before you start the final mission, stop and clear the Before the Finale checklist — the two partner trophies need your partner in free roam, and no official source says who is still around after the ending.',
    ids: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 33, 34],
  },
  {
    title: 'Phase 2 — stranger strands',
    short: 'Strangers',
    when: 'Free roam between chapters and after the story · ≈8–12 hours',
    maps: 'Andy · Kenton · Billy · Randy · Tyrone · Bret · Cal · three more strands · 8 strands for the silver',
    text: 'Five strangers carry a trophy for finishing their strand, and the silver wants eight strands in all, so three more come off the map. New markers appear as the story advances, so sweep the map after each chapter rather than saving them all for the end. Take Cal’s fishing challenge the first time it is offered and never shoot Bret’s unique animal outside his hunt — those two are the phase’s missable moments.',
    ids: [22, 23, 24, 25, 26, 27, 20, 29],
  },
  {
    title: 'Phase 3 — activities and skill checks',
    short: 'Activities',
    when: 'One focused session each · ≈6–10 hours',
    maps: '42 Shooting Range challenges · 14 drone race locations · 20 different races · 9 activity types · an arcade game · the bowling alley',
    text: 'These are skill and variety checks with no story gate, so do them when you want a break from missions. The shooting range is the hard one — 42 gold medals — so run every course once to learn it, then go for gold class by class with a controller. Master of None wants one of each of the 9 activity types, and bowling and the arcade each tick one of those nine while earning their own trophy.',
    ids: [16, 17, 18, 19, 21, 46],
  },
  {
    title: 'Phase 4 — heists, robberies and combat',
    short: 'Heists',
    when: 'Free-roam jobs, one at a time · ≈6–8 hours',
    maps: '5 bank vaults · an armored truck · one illegal operation per gang (9) · a clean jewelry robbery · the Rhino · 5 kills in one Combat Focus · a melee drive-by',
    text: 'Everything here pays in Marked Bills, which feed the laundering trophy in the last phase, so do the robberies before you go shopping. Plan each exit before you go in and keep a fast car outside. Sneakthief is the fiddly one: one jewelry robbery with no alarm at all — if you are spotted, leave and come back clean, because that attempt is wasted but the store is not.',
    ids: [36, 38, 39, 40, 41, 43, 51],
  },
  {
    title: 'Phase 5 — collectibles and the map sweep',
    short: 'Map sweep',
    when: 'One long route around Leonida · ≈8–12 hours',
    maps: '52 areas · 18 meditation spots · 100 WAiNK locations · 3 card sets · 100 vehicles · Ocean Beach · the showroom smash',
    text: 'Do this as one sweep, not five: the map is the same map. Drive, boat and fly into every grey area for the 52, meditate at the 18 spots you pass, WAiNK It at every landmark and beach you stop at, and pick up cards in interiors as you go. Take a different vehicle at every opportunity — 100 distinct vehicles is discovered, not driven. The Ocean Beach cocktail and the showroom smash are stops on the route.',
    ids: [28, 30, 31, 35, 42, 44, 45],
  },
  {
    title: 'Phase 6 — money, property and the long counters',
    short: 'Money & counters',
    when: 'The tail, after everything else · ≈6–10 hours',
    maps: '8 garages · 10 vehicles registered · $100,000 spent · $250,000 laundered · 250 stunts · 50 challenges · 500 choices · 100% completion',
    text: 'Buy the 8 garages first — they hold the cars you register for Scooter Bros — then spend, launder and let the counters finish. The 250 stunts, 50 challenges and 500 choices climb on their own while you do the rest, so only grind them at the end, and grind stunts by repeating one reliable jump loop in a fast car. A Long Road (100% completion) is the last gold for most players, and the platinum pops with it.',
    ids: [14, 15, 32, 48, 52, 53, 54, 55, 37, 47, 49, 50, 1],
  },
];

const phaseHits = (phase) => phase.ids.filter((id) => state.earned.has(id)).length;

/** The hour estimate is lifted out of the phase's `when` line, not retyped. */
const hoursIn = (when) => /(≈[\d–.-]+ ?hours)/.exec(when);

function renderRoadmap() {
  const list = nodeById('phases');
  list.replaceChildren();

  PHASES.forEach((phase, index) => {
    const row = document.createElement('li');
    const body = mk('div');

    body.append(mk('h3', '', phase.title));
    body.append(mk('p', 'when', phase.when));
    body.append(mk('p', 'maps', phase.maps));
    body.append(mk('p', '', phase.text));

    const chips = mk('ul', 'tlist');
    phase.ids.forEach((id) => {
      const t = trophyById(id);
      if (!t) return;
      const mark = state.earned.has(t.id) ? '✓ ' : '○ ';
      chips.append(mk('li', state.earned.has(t.id) ? 'done' : '', `${mark}${t.name} (${titleCase(t.grade)})`));
    });
    body.append(chips);

    row.append(mk('div', 'num', String(index + 1)), body, mk('div', 'count', `${phaseHits(phase)}/${phase.ids.length} done`));
    list.append(row);
  });

  renderPhaseStrip();
}

/**
 * The plan as a single row of cells — number, short name, hours, done-count —
 * built from the same PHASES array as the cards, so the two cannot disagree.
 */
function renderPhaseStrip() {
  const strip = nodeById('phaseTimes');
  strip.replaceChildren();

  PHASES.forEach((phase, index) => {
    const hours = hoursIn(phase.when);
    const cell = mk('div', 'pt');
    cell.append(mk('span', 'ptNum', String(index + 1)));
    cell.append(mk('span', 'ptName', phase.short));
    cell.append(mk('span', 'ptHours', hours ? hours[1] : ''));
    cell.append(mk('span', 'ptDone', `${phaseHits(phase)}/${phase.ids.length} done`));
    const row = mk('li');
    row.append(cell);
    strip.append(row);
  });
}

// ---------------------------------------------------------------------------
// missables and the before-the-finale checklist
// ---------------------------------------------------------------------------

const FINALE_ITEMS = [
  'Hot Together — lose a 4-star wanted level with your partner and both escape.',
  'Retail Therapy — rob 3 shops back-to-back with your partner, keeping the stars up.',
  'Cal’s fishing challenge — accept it the moment it is offered.',
  'Bret’s unique animal — hunted inside his strand, never shot before it.',
  'Sneakthief — one jewelry robbery with no alarm and no witness.',
  'Save the game in a fresh slot before you start the final mission.',
  'Open the tracker and confirm all five missable trophies are ticked.',
];

function renderMissables() {
  const list = nodeById('missableCards');
  list.replaceChildren();

  state.trophies.filter((t) => t.missable).forEach((t) => {
    const card = mk('button', 'card');
    card.type = 'button';
    card.classList.toggle('earned', state.earned.has(t.id));

    const head = mk('div', 'row1');
    head.append(mk('span', 'name', `${t.name} — ${MISSABLE_HINT.get(t.id) ?? 'mind the timing'}`));

    const meta = mk('div', 'meta');
    meta.append(gradeTag(t));
    meta.append(tagSpan('MISSABLE', 'missable'));
    meta.append(tagSpan(t.status.toUpperCase(), t.status));

    card.append(head, mk('div', 'desc', t.description), meta);
    card.addEventListener('click', () => {
      state.selected = t.id;
      switchView('checklist');
      renderCards();
      renderDetail();
      nodeById('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    const row = document.createElement('li');
    row.append(card);
    list.append(row);
  });
}

function renderFinale() {
  const list = nodeById('finaleList');
  list.replaceChildren();

  FINALE_ITEMS.forEach((text, index) => {
    const row = mk('li');
    row.classList.toggle('done', state.finale.has(index));

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.finale.has(index);
    box.setAttribute('aria-label', text);
    box.addEventListener('change', () => {
      if (box.checked) state.finale.add(index);
      else state.finale.delete(index);
      persistFinale();
      renderFinale();
    });

    row.append(box, mk('span', '', text));
    list.append(row);
  });
}

// ---------------------------------------------------------------------------
// sources view
// ---------------------------------------------------------------------------

function renderSources() {
  const list = nodeById('srcList');
  list.replaceChildren();

  Object.keys(SOURCE_TABLE).forEach((key) => {
    const [label, url] = SOURCE_TABLE[key];
    const row = document.createElement('li');
    if (url) {
      row.append(outLink(label, url));
      row.append(document.createTextNode(` — ${url}`));
    } else {
      row.append(document.createTextNode(`${label} — precedent only, no page to link`));
    }
    list.append(row);
  });
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------

function switchView(name) {
  document.querySelectorAll('.tabs button').forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.id !== `view-${name}`;
  });
}

function renderAll() {
  renderProgress();
  renderCards();
  renderDetail();
  renderRoadmap();
  renderMissables();
}

// ---------------------------------------------------------------------------
// wiring
// ---------------------------------------------------------------------------

document.querySelectorAll('.tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    switchView(button.dataset.view);
    nodeById('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

['search', 'grade', 'kind', 'status'].forEach((id) => {
  nodeById(id).addEventListener(id === 'search' ? 'input' : 'change', renderCards);
});

nodeById('spoilers').checked = state.spoilers;
nodeById('spoilers').addEventListener('change', (event) => {
  state.spoilers = event.target.checked;
  persistSpoilers();
  renderCards();
  renderDetail();
});

nodeById('export').addEventListener('click', () => {
  const payload = {
    app: 'Leonida Trophy Atlas',
    game: 'Grand Theft Auto VI',
    exported: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
    finale: [...state.finale].sort((a, b) => a - b),
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = mk('a');
  link.href = url;
  link.download = 'leonida-trophy-progress.json';
  link.click();
  URL.revokeObjectURL(url);
});

nodeById('import').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(ids)) throw new Error('no earned list');
    const known = new Set(state.trophies.map((t) => t.id));
    state.earned = new Set(ids.filter((id) => Number.isInteger(id) && known.has(id)));
    persistEarned();
    if (!Array.isArray(data) && Array.isArray(data.finale)) {
      state.finale = new Set(data.finale.filter((n) => Number.isInteger(n) && n >= 0 && n < FINALE_ITEMS.length));
      persistFinale();
      renderFinale();
    }
    renderAll();
  } catch {
    window.alert('That file is not a progress export from this atlas.');
  }
  event.target.value = '';
});

nodeById('reset').addEventListener('click', () => {
  if (!window.confirm('Clear every earned trophy and the finale checklist? This cannot be undone.')) return;
  state.earned = new Set();
  state.finale = new Set();
  persistEarned();
  persistFinale();
  renderFinale();
  renderAll();
});

// ---------------------------------------------------------------------------
// boot — one fetch of the trophy data, then the first paint
// ---------------------------------------------------------------------------

const doc = await (await fetch('data/trophies.json')).json();
state.trophies = Array.isArray(doc) ? doc : doc.trophies;

renderProgress();
renderCards();
renderDetail();
renderRoadmap();
renderMissables();
renderFinale();
renderSources();
