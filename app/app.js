// Leonida Trophy Atlas — the tracker's single module.
//
// One file on purpose: the whole app is this module plus a stylesheet and a
// JSON data file, so there is nothing to bundle and nothing to version.
//
// Trophy facts are read once from data/trophies.json, a file of the app's own
// origin; nothing else is fetched. What the player does — trophy ticks, the
// before-the-finale checklist, the spoiler switch — is kept in localStorage and
// only leaves the browser in an export the player asks for. No libraries, no
// build step, no network.
//
// The file is laid out in the order the page uses it:
//   storage     — loadIds/saveIds over the three KEYS declared just below
//   filtering   — the search/filter predicate shared by the list and the counts
//   renderers   — one per view: checklist cards, the six-phase roadmap with its
//                 time strip, missables with the finale checklist, sources, and
//                 the detail pane with its guide, numbered steps and SOURCES
//   events      — tick, filter, spoiler, export/import/reset, tab switching
//   boot        — one fetch of the trophy data, then the first render
// All four views read the same in-memory state, so a tick anywhere updates the
// header counts, the cards and the per-phase done totals together.
// Rendering is re-run from state rather than patched in place: a tick rebuilds
// the counts and the cards from the same arrays, so the list, the header and
// the roadmap cannot drift apart. Nothing in this module writes to the DOM
// before the data has arrived, so a failed fetch leaves the shell visible
// rather than half-drawn.


const KEYS = {
  earned: 'leonida-atlas.earned.v3',
  finale: 'leonida-atlas.finale.v3',
  spoilers: 'leonida-atlas.spoilers.v3',
};

const GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

const KIND_LABEL = {
  story: 'Story',
  side: 'Side strand',
  collectible: 'Collectible',
  activity: 'Activity',
  combat: 'Combat & heist',
  exploration: 'Exploration',
  economy: 'Money & property',
  misc: 'Odd & rare',
};

// Where each guide's facts come from. The app links out to these; it never
// loads anything from them. `series` is a body of precedent, so it has no page.
const SOURCES = {
  exophase: ['Exophase — GTA VI trophy list', 'https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/'],
  psnprofiles: ['PSNProfiles — GTA VI trophies', 'https://psnprofiles.com/trophies/43531-grand-theft-auto-vi'],
  official: ['Rockstar Games — GTA VI official site', 'https://www.rockstargames.com/VI'],
  trailer1: ['Rockstar Games — GTA VI Trailer 1 (Dec 2023)', 'https://www.rockstargames.com/VI'],
  trailer2: ['Rockstar Games — GTA VI Trailer 2 (May 2025)', 'https://www.rockstargames.com/VI'],
  series: ['GTA V / GTA Online — series patterns', null],
};

// The one line that says when a missable can pass. Keyed by trophy id, shown on
// the card in the missables view and in the warning at the top of its guide.
const MISSABLE_WHEN = {
  20: 'Take it the moment Cal offers it — a refused challenge may not come back.',
  29: 'Only inside Bret\u2019s hunt — never shoot the animal before it starts.',
  33: 'Before the final mission, with your partner in free roam.',
  34: 'Before the final mission, with your partner in free roam.',
  39: 'Retryable, but a spotted attempt fails — go in clean.',
};

const state = {
  trophies: [],
  earned: loadIds(KEYS.earned),
  finale: loadIds(KEYS.finale),
  spoilers: localStorage.getItem(KEYS.spoilers) === '1',
  selected: null,
};

// ---- storage -------------------------------------------------------------

/** Read a stored array of integers, tolerating anything else. */
function loadIds(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((n) => Number.isInteger(n)));
  } catch {
    return new Set();
  }
}

function storeIds(key, ids) {
  localStorage.setItem(key, JSON.stringify([...ids].sort((a, b) => a - b)));
}

function saveEarned() {
  storeIds(KEYS.earned, state.earned);
}

function saveFinale() {
  storeIds(KEYS.finale, state.finale);
}

function saveSpoilers() {
  localStorage.setItem(KEYS.spoilers, state.spoilers ? '1' : '0');
}

// ---- lookups -------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const byId = (id) => state.trophies.find((t) => t.id === id);
const has = (t) => state.earned.has(t.id);
const gradeName = (g) => g.charAt(0).toUpperCase() + g.slice(1);

/** True while this trophy's name, description and guide must stay covered. */
function concealed(t) {
  return state.spoilers && t.kind === 'story' && !has(t);
}

// ---- element helpers, so the renderers read as markup --------------------

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function gradePill(t) {
  return el('span', `pill ${t.grade}`, gradeName(t.grade));
}

function chip(text, cls) {
  return el('span', `tag ${cls}`.trim(), text);
}

function externalLink(label, href) {
  const a = el('a', '', label);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

/** The tag row under a trophy name: grade, kind, count and the three flags. */
function tagRow(t, verboseCount) {
  const meta = el('div', 'meta');
  meta.append(gradePill(t));
  meta.append(chip(KIND_LABEL[t.kind] ?? t.kind, ''));
  if (t.count) meta.append(chip(verboseCount ? `PSN target: ${t.count}` : t.count, 'count'));
  if (t.missable) meta.append(chip('MISSABLE', 'missable'));
  if (t.hidden) meta.append(chip('HIDDEN', 'hidden'));
  meta.append(chip(t.status.toUpperCase(), t.status));
  return meta;
}

// ---- header progress -----------------------------------------------------

function renderProgress() {
  const total = state.trophies.length;
  const done = state.earned.size;
  const pct = total ? Math.round((done / total) * 100) : 0;

  $('earnedCount').textContent = String(done);
  $('barFill').style.width = `${total ? (done / total) * 100 : 0}%`;
  $('pctLine').textContent = total && done === total
    ? 'Platinum earned — a Leonida Legend.'
    : `${pct}% of the way to the platinum`;
  $('gradeLine').textContent = GRADE_ORDER.map((grade) => {
    const group = state.trophies.filter((t) => t.grade === grade);
    return `${gradeName(grade)} ${group.filter(has).length}/${group.length}`;
  }).join('  \u00b7  ');
}

// ---- filters -------------------------------------------------------------

function passes(t) {
  const query = $('search').value.trim().toLowerCase();
  if (query) {
    const haystack = concealed(t)
      ? `${KIND_LABEL[t.kind] ?? ''} hidden story trophy`
      : [t.name, t.description, t.guide, (t.steps ?? []).join(' '), KIND_LABEL[t.kind] ?? ''].join(' ');
    if (!haystack.toLowerCase().includes(query)) return false;
  }
  const grade = $('grade').value;
  if (grade !== 'all' && t.grade !== grade) return false;
  const kind = $('kind').value;
  if (kind !== 'all' && t.kind !== kind) return false;
  const status = $('status').value;
  if (status === 'earned' && !has(t)) return false;
  if (status === 'remaining' && has(t)) return false;
  if (status === 'missable' && !t.missable) return false;
  return true;
}

// ---- checklist -----------------------------------------------------------

function renderCountLine(shown) {
  const parts = [
    `Showing ${shown} of ${state.trophies.length} trophies`,
    `${state.earned.size} earned`,
    `${state.trophies.filter((t) => t.missable).length} missable`,
    `${state.trophies.filter((t) => t.hidden).length} hidden on PSN`,
  ];
  if (state.spoilers) parts.push('spoilers on: unearned story trophies are hidden');
  $('countLine').textContent = parts.join(' \u00b7 ');
}

/** One row of the checklist: tick box, name, official description, tag row. */
function cardFor(t, onOpen) {
  const card = el('button', 'card');
  card.type = 'button';
  card.classList.toggle('earned', has(t));
  card.classList.toggle('selected', state.selected === t.id);
  card.setAttribute('aria-pressed', has(t) ? 'true' : 'false');

  const top = el('div', 'row1');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = has(t);
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('click', (event) => {
    event.stopPropagation();
    if (box.checked) state.earned.add(t.id);
    else state.earned.delete(t.id);
    saveEarned();
    renderAll();
  });

  top.append(box, el('span', 'name', concealed(t) ? 'Hidden story trophy' : t.name));

  const desc = el('div', 'desc', concealed(t)
    ? 'Its name and description stay hidden until you earn it, while the spoiler setting is on.'
    : t.description);

  card.append(top, desc, tagRow(t, false));
  card.addEventListener('click', () => onOpen(t));
  return card;
}

function openTrophy(t) {
  state.selected = t.id;
  renderCards();
  renderDetail();
  $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderCards() {
  const shown = state.trophies.filter(passes);
  renderCountLine(shown.length);
  const list = $('cards');
  list.replaceChildren();
  for (const t of shown) {
    const li = document.createElement('li');
    li.append(cardFor(t, openTrophy));
    list.append(li);
  }
  if (!shown.length) {
    const li = document.createElement('li');
    li.append(el('p', 'hint', 'No trophy matches those filters. Clear the search or set the selects back to All.'));
    list.append(li);
  }
}

// ---- detail pane ---------------------------------------------------------

function renderDetail() {
  const pane = $('detail');
  pane.replaceChildren();
  const t = byId(state.selected);

  if (!t) {
    pane.append(el('p', 'empty', 'Pick a trophy on the left to read its guide, its steps and the sources behind every fact in it.'));
    return;
  }

  if (concealed(t)) {
    pane.append(el('h2', '', 'Hidden story trophy'));
    pane.append(el('p', '', 'This one is part of the story and the spoiler setting is on, so its name, description and guide are hidden. Earn it in the game — the tick box on its card — or turn the spoiler setting off in the filter bar.'));
    return;
  }

  pane.append(el('h2', '', t.name));
  pane.append(tagRow(t, true));
  pane.append(el('p', 'official', `Official description: \u201c${t.description}\u201d`));

  if (t.missable) {
    const warn = el('p', 'warn');
    warn.textContent = `\u26a0 Missable — ${MISSABLE_WHEN[t.id] ?? 'this one needs the right moment.'} Do it before it can pass, and save first.`;
    pane.append(warn);
  }

  pane.append(el('h3', '', 'How to unlock it'));
  pane.append(el('p', '', t.guide));

  if ((t.steps ?? []).length) {
    const steps = document.createElement('ol');
    for (const step of t.steps) steps.append(el('li', '', step));
    pane.append(steps);
  }

  pane.append(el('h3', '', 'Sources'));
  const sources = el('p', 'sources');
  (t.sources ?? []).forEach((key, index) => {
    const [label, url] = SOURCES[key] ?? [key, null];
    if (index > 0) sources.append(el('span', 'sep', ' \u00b7 '));
    sources.append(url ? externalLink(label, url) : document.createTextNode(label));
  });
  sources.append(el('span', 'srcNote', t.status === 'confirmed'
    ? 'The requirement itself is the official description; the steps above are this atlas\u2019s own reading of it.'
    : 'Reasoned from the official description plus series precedent and the GTA VI trailers — not played and checked in the retail game.'));
  pane.append(sources);

  pane.append(el('h3', '', 'Your progress'));
  pane.append(el('p', has(t) ? 'earnedNote' : '', has(t)
    ? 'Earned and ticked in this browser. Untick it on the card if that was a misclick.'
    : 'Not earned yet. Tick the box on its card when the trophy pops in the game.'));
}

// ---- roadmap -------------------------------------------------------------
//
// Six phases in play order. Each names the chapters, missions and counts it
// covers (all taken from the official descriptions), an honest first-run time
// estimate, and the trophy ids it should earn. The ids point into the JSON.

const PHASES = [
  {
    title: 'Phase 1 — play the story',
    short: 'Story',
    when: 'Chapters 1\u20134 and the final mission \u00b7 \u224830\u201340 hours',
    maps: 'Gone Fishing \u00b7 Breakfast Run \u00b7 The Cartel Heist \u00b7 Child\u2019s Play \u00b7 Headliners \u00b7 VCIA Takedown \u00b7 Operation Savage Glory \u00b7 the four chapter trophies \u00b7 the finale',
    text: 'The story comes first because it unlocks everything else: the map, the contacts, the venues and the stranger markers the later phases need. Gone Fishing opens the game, the named-mission trophies follow in story order, and each chapter trophy pops at its chapter-complete screen. Before you start the final mission, stop and clear the Before the Finale checklist — the two partner trophies need your partner in free roam, and who is around after the ending is not confirmed by any official source.',
    ids: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 33, 34],
  },
  {
    title: 'Phase 2 — stranger strands',
    short: 'Strangers',
    when: 'Free roam between chapters and after the story \u00b7 \u22488\u201312 hours',
    maps: 'Andy \u00b7 Kenton \u00b7 Billy \u00b7 Randy \u00b7 Tyrone \u00b7 Bret \u00b7 Cal \u00b7 three more strands \u00b7 8 strands for the silver',
    text: 'Five strangers have a trophy for finishing their strand, and the silver wants eight strands in all, so three more come from the map. New markers appear as the story advances, so sweep the map after each chapter rather than saving them all for the end. Take Cal\u2019s fishing challenge the first time it is offered and never shoot Bret\u2019s unique animal outside his hunt — those two are the phase\u2019s missable moments.',
    ids: [22, 23, 24, 25, 26, 27, 20, 29],
  },
  {
    title: 'Phase 3 — activities and skill checks',
    short: 'Activities',
    when: 'One focused session each \u00b7 \u22486\u201310 hours',
    maps: '42 Shooting Range challenges \u00b7 14 drone race locations \u00b7 20 different races \u00b7 9 activity types \u00b7 an arcade game \u00b7 the bowling alley',
    text: 'These are skill and variety checks with no story gate, so do them when you want a break from missions. The shooting range is the hard one — 42 gold medals — so run every course once to learn it, then go for gold class by class with a controller. Master of None wants one of each of the 9 activity types, and bowling and the arcade each tick one of those nine while earning their own trophy.',
    ids: [16, 17, 18, 19, 21, 46],
  },
  {
    title: 'Phase 4 — heists, robberies and combat',
    short: 'Heists',
    when: 'Free-roam jobs, one at a time \u00b7 \u22486\u20138 hours',
    maps: '5 bank vaults \u00b7 an armored truck \u00b7 one illegal operation per gang (9) \u00b7 a clean jewelry robbery \u00b7 the Rhino \u00b7 5 kills in one Combat Focus \u00b7 a melee drive-by',
    text: 'Everything here pays in Marked Bills, which feed the laundering trophy in the last phase, so do the robberies before you go shopping. Plan each exit before you go in and keep a fast car outside. Sneakthief is the fiddly one: one jewelry robbery with no alarm at all — if you are spotted, leave and come back clean, because that attempt is wasted but the store is not.',
    ids: [36, 38, 39, 40, 41, 43, 51],
  },
  {
    title: 'Phase 5 — collectibles and the map sweep',
    short: 'Map sweep',
    when: 'One long route around Leonida \u00b7 \u22488\u201312 hours',
    maps: '52 areas \u00b7 18 meditation spots \u00b7 100 WAiNK locations \u00b7 3 card sets \u00b7 100 vehicles \u00b7 Ocean Beach \u00b7 the showroom smash',
    text: 'Do this as one sweep, not five: the map is the same map. Drive, boat and fly into every grey area for the 52, meditate at the 18 spots you pass, WAiNK It at every landmark and beach you stop at, and pick up cards in interiors as you go. Grab a different vehicle at every opportunity — 100 distinct vehicles is discovered, not driven. The Ocean Beach cocktail and the showroom smash are stops on the route.',
    ids: [28, 30, 31, 35, 42, 44, 45],
  },
  {
    title: 'Phase 6 — money, property and the long counters',
    short: 'Money & counters',
    when: 'The tail, after everything else \u00b7 \u22486\u201310 hours',
    maps: '8 garages \u00b7 10 vehicles registered \u00b7 $100,000 spent \u00b7 $250,000 laundered \u00b7 250 stunts \u00b7 50 challenges \u00b7 500 choices \u00b7 100% completion',
    text: 'Buy the 8 garages first — they hold the cars you register for Scooter Bros — then spend, launder and let the counters finish. The 250 stunts, 50 challenges and 500 choices climb on their own while you do the rest, so only grind them at the end, and grind stunts by repeating one reliable jump loop in a fast car. A Long Road (100% completion) is the last gold for most players, and the platinum pops with it.',
    ids: [14, 15, 32, 48, 52, 53, 54, 55, 37, 47, 49, 50, 1],
  },
];

function renderRoadmap() {
  const list = $('phases');
  list.replaceChildren();
  PHASES.forEach((phase, index) => {
    const li = document.createElement('li');
    const body = el('div');

    body.append(el('h3', '', phase.title));
    body.append(el('p', 'when', phase.when));
    body.append(el('p', 'maps', phase.maps));
    body.append(el('p', '', phase.text));

    const chips = el('ul', 'tlist');
    for (const id of phase.ids) {
      const t = byId(id);
      if (!t) continue;
      chips.append(el('li', has(t) ? 'done' : '', `${has(t) ? '\u2713 ' : '\u25cb '}${t.name} (${gradeName(t.grade)})`));
    }
    body.append(chips);

    const done = phase.ids.filter((id) => state.earned.has(id)).length;
    li.append(el('div', 'num', String(index + 1)), body, el('div', 'count', `${done}/${phase.ids.length} done`));
    list.append(li);
  });
  renderPhaseStrip();
}

/**
 * The whole plan in one row: number, short name, hours, done-count. Built from
 * the same PHASES array as the cards, so the two can never drift apart.
 */
function renderPhaseStrip() {
  const strip = $('phaseTimes');
  strip.replaceChildren();
  PHASES.forEach((phase, index) => {
    const hours = /(\u2248[\d\u2013.-]+ ?hours)/.exec(phase.when);
    const done = phase.ids.filter((id) => state.earned.has(id)).length;
    const row = el('div', 'pt');
    row.append(el('span', 'ptNum', String(index + 1)));
    row.append(el('span', 'ptName', phase.short));
    row.append(el('span', 'ptHours', hours ? hours[1] : ''));
    row.append(el('span', 'ptDone', `${done}/${phase.ids.length} done`));
    const li = el('li');
    li.append(row);
    strip.append(li);
  });
}

// ---- missables and the before-the-finale checklist -----------------------

const FINALE_ITEMS = [
  'Hot Together — lose a 4-star wanted level with your partner and both escape.',
  'Retail Therapy — rob 3 shops back-to-back with your partner, keeping the stars up.',
  'Cal\u2019s fishing challenge — accept it the moment it is offered.',
  'Bret\u2019s unique animal — hunted inside his strand, never shot before it.',
  'Sneakthief — one jewelry robbery with no alarm and no witness.',
  'Save the game in a fresh slot before you start the final mission.',
  'Open the tracker and confirm all five missable trophies are ticked.',
];

function renderMissables() {
  const list = $('missableCards');
  list.replaceChildren();
  for (const t of state.trophies.filter((x) => x.missable)) {
    const card = el('button', 'card');
    card.type = 'button';
    card.classList.toggle('earned', has(t));

    const top = el('div', 'row1');
    top.append(el('span', 'name', `${t.name} — ${MISSABLE_WHEN[t.id] ?? 'mind the timing'}`));

    const meta = el('div', 'meta');
    meta.append(gradePill(t));
    meta.append(chip('MISSABLE', 'missable'));
    meta.append(chip(t.status.toUpperCase(), t.status));

    card.append(top, el('div', 'desc', t.description), meta);
    card.addEventListener('click', () => {
      state.selected = t.id;
      switchView('checklist');
      renderCards();
      renderDetail();
      $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    const li = document.createElement('li');
    li.append(card);
    list.append(li);
  }
}

function renderFinale() {
  const list = $('finaleList');
  list.replaceChildren();
  FINALE_ITEMS.forEach((text, index) => {
    const li = el('li');
    li.classList.toggle('done', state.finale.has(index));

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.finale.has(index);
    box.setAttribute('aria-label', text);
    box.addEventListener('change', () => {
      if (box.checked) state.finale.add(index);
      else state.finale.delete(index);
      saveFinale();
      renderFinale();
    });

    li.append(box, el('span', '', text));
    list.append(li);
  });
}

// ---- sources view --------------------------------------------------------

function renderSources() {
  const list = $('srcList');
  list.replaceChildren();
  for (const key of Object.keys(SOURCES)) {
    const [label, url] = SOURCES[key];
    const li = document.createElement('li');
    if (url) {
      li.append(externalLink(label, url));
      li.append(document.createTextNode(` — ${url}`));
    } else {
      li.append(document.createTextNode(`${label} — precedent only, no page to link`));
    }
    list.append(li);
  }
}

// ---- views ---------------------------------------------------------------

function switchView(name) {
  for (const button of document.querySelectorAll('.tabs button')) {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  for (const view of document.querySelectorAll('.view')) {
    view.hidden = view.id !== `view-${name}`;
  }
}

function renderAll() {
  renderProgress();
  renderCards();
  renderDetail();
  renderRoadmap();
  renderMissables();
}

// ---- wiring --------------------------------------------------------------

for (const button of document.querySelectorAll('.tabs button')) {
  button.addEventListener('click', () => {
    switchView(button.dataset.view);
    $('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

for (const id of ['search', 'grade', 'kind', 'status']) {
  $(id).addEventListener(id === 'search' ? 'input' : 'change', renderCards);
}

$('spoilers').checked = state.spoilers;
$('spoilers').addEventListener('change', (event) => {
  state.spoilers = event.target.checked;
  saveSpoilers();
  renderCards();
  renderDetail();
});

$('export').addEventListener('click', () => {
  const payload = {
    app: 'Leonida Trophy Atlas',
    game: 'Grand Theft Auto VI',
    exported: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
    finale: [...state.finale].sort((a, b) => a - b),
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  const link = el('a');
  link.href = url;
  link.download = 'leonida-trophy-progress.json';
  link.click();
  URL.revokeObjectURL(url);
});

$('import').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    if (!Array.isArray(ids)) throw new Error('no earned list');
    const known = new Set(state.trophies.map((t) => t.id));
    state.earned = new Set(ids.filter((id) => Number.isInteger(id) && known.has(id)));
    saveEarned();
    if (!Array.isArray(data) && Array.isArray(data.finale)) {
      state.finale = new Set(data.finale.filter((n) => Number.isInteger(n) && n >= 0 && n < FINALE_ITEMS.length));
      saveFinale();
      renderFinale();
    }
    renderAll();
  } catch {
    window.alert('That file is not a progress export from this atlas.');
  }
  event.target.value = '';
});

$('reset').addEventListener('click', () => {
  if (!window.confirm('Clear every earned trophy and the finale checklist? This cannot be undone.')) return;
  state.earned = new Set();
  state.finale = new Set();
  saveEarned();
  saveFinale();
  renderFinale();
  renderAll();
});

// ---- boot ----------------------------------------------------------------

const doc = await (await fetch('data/trophies.json')).json();
state.trophies = Array.isArray(doc) ? doc : doc.trophies;

renderProgress();
renderCards();
renderDetail();
renderRoadmap();
renderMissables();
renderFinale();
renderSources();
