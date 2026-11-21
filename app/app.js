// Leonida Trophy Atlas — tracker and guide logic. Trophy data lives in
// data/trophies.json; progress lives in localStorage and never leaves the
// browser except in an export file the player downloads on purpose. No
// network requests at run time: the only fetch is the local data file.
const PROGRESS_KEY = 'leonida-trophy-atlas-v2';
const SPOILER_KEY = 'leonida-trophy-atlas-spoilers-v2';
const FINALE_KEY = 'leonida-trophy-atlas-finale-v2';
const $ = (id) => document.getElementById(id);
const cardsEl = $('cards');
const detailEl = $('detail');
const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;

let earned = new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]'));
let finaleDone = new Set(JSON.parse(localStorage.getItem(FINALE_KEY) ?? '[]'));
let selectedId = null;
let spoilers = localStorage.getItem(SPOILER_KEY) === '1';

const gradeLabel = (g) => g[0].toUpperCase() + g.slice(1);
const kindLabel = {
  story: 'Story', side: 'Side strand', collectible: 'Collectible',
  activity: 'Activity', combat: 'Combat & heist', exploration: 'Exploration',
  economy: 'Money & property', misc: 'Odd & rare',
};
const SOURCE_URLS = {
  exophase: ['Exophase — GTA VI trophy list', 'https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/'],
  psnprofiles: ['PSNProfiles — GTA VI trophies', 'https://psnprofiles.com/trophies/43531-grand-theft-auto-vi'],
  trailer1: ['Rockstar Games — GTA VI Trailer 1 (Dec 2023)', 'https://www.rockstargames.com/VI'],
  trailer2: ['Rockstar Games — GTA VI Trailer 2 (May 2025)', 'https://www.rockstargames.com/VI'],
  official: ['Rockstar Games — GTA VI official site', 'https://www.rockstargames.com/VI'],
  series: ['GTA V / GTA Online — series patterns', null],
};
// When each missable trophy can pass, in one line, shown on its card and in its guide.
const MISSABLE_WHEN = {
  20: 'Take it the moment Cal offers it — a refused challenge may not repeat.',
  29: 'Only inside Bret\u2019s hunt — do not shoot the animal first.',
  33: 'Before the final mission, with your partner beside you.',
  34: 'Before the final mission, with your partner beside you.',
  39: 'Retryable, but a spotted attempt fails — go in clean.',
};

function saveProgress() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}
function saveSpoilers() {
  localStorage.setItem(SPOILER_KEY, spoilers ? '1' : '0');
}
function saveFinale() {
  localStorage.setItem(FINALE_KEY, JSON.stringify([...finaleDone].sort((a, b) => a - b)));
}
function spoilerHidden(t) {
  return spoilers && t.kind === 'story' && !earned.has(t.id);
}
function trophyMatches(t) {
  const q = $('search').value.trim().toLowerCase();
  if (q) {
    const hay = `${t.name} ${t.description} ${t.guide} ${kindLabel[t.kind] ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if ($('grade').value !== 'all' && t.grade !== $('grade').value) return false;
  if ($('kind').value !== 'all' && t.kind !== $('kind').value) return false;
  const st = $('status').value;
  if (st === 'earned' && !earned.has(t.id)) return false;
  if (st === 'remaining' && earned.has(t.id)) return false;
  if (st === 'missable' && !t.missable) return false;
  return true;
}
function pill(t) {
  const s = document.createElement('span');
  s.className = `pill ${t.grade}`;
  s.textContent = gradeLabel(t.grade);
  return s;
}
function tag(text, cls) {
  const s = document.createElement('span');
  s.className = `tag ${cls}`;
  s.textContent = text;
  return s;
}
function renderProgress() {
  const n = earned.size;
  $('earnedCount').textContent = n;
  $('barFill').style.width = `${(n / trophies.length) * 100}%`;
  $('pctLine').textContent = n === trophies.length
    ? 'Platinum earned — Leonida Legend!'
    : `${Math.round((n / trophies.length) * 100)}% to the platinum`;
  const byGrade = ['platinum', 'gold', 'silver', 'bronze'].map((g) => {
    const total = trophies.filter((t) => t.grade === g).length;
    const done = trophies.filter((t) => t.grade === g && earned.has(t.id)).length;
    return `${gradeLabel(g)} ${done}/${total}`;
  });
  $('gradeLine').textContent = byGrade.join('  ·  ');
}
function refreshAll() {
  renderProgress();
  renderCards();
  renderDetail();
  renderRoadmap();
  renderMissables();
  renderFinale();
}
function renderCards() {
  const shown = trophies.filter(trophyMatches);
  $('countLine').textContent =
    `Showing ${shown.length} of ${trophies.length} trophies · ${earned.size} earned · ` +
    `${trophies.filter((t) => t.missable).length} missable · ${trophies.filter((t) => t.hidden).length} hidden on PSN`;
  cardsEl.replaceChildren();
  for (const t of shown) {
    const li = document.createElement('li');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card' + (earned.has(t.id) ? ' earned' : '') + (selectedId === t.id ? ' selected' : '');
    card.setAttribute('aria-pressed', earned.has(t.id) ? 'true' : 'false');
    const row = document.createElement('div');
    row.className = 'row1';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earned.has(t.id);
    box.setAttribute('aria-label', `Mark ${t.name} as earned`);
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (box.checked) earned.add(t.id);
      else earned.delete(t.id);
      saveProgress();
      refreshAll();
    });
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = spoilerHidden(t) ? 'Hidden trophy — earn it to reveal' : t.name;
    row.append(box, name);
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = spoilerHidden(t)
      ? 'A story trophy. Its name and description stay hidden while spoilers are on.'
      : t.description;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.append(pill(t));
    meta.append(tag(kindLabel[t.kind], ''));
    if (t.count) meta.append(tag(t.count, 'count'));
    if (t.missable) meta.append(tag(`MISSABLE — ${MISSABLE_WHEN[t.id] ?? 'mind the timing'}`, 'missable'));
    if (t.hidden) meta.append(tag('HIDDEN', 'hidden'));
    meta.append(tag(t.status.toUpperCase(), t.status));
    card.append(row, desc, meta);
    card.addEventListener('click', () => {
      selectedId = t.id;
      renderCards();
      renderDetail();
      detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    li.append(card);
    cardsEl.append(li);
  }
}
function renderDetail() {
  const t = trophies.find((x) => x.id === selectedId);
  detailEl.replaceChildren();
  if (!t) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Select a trophy to see its step-by-step guide, sources and missable note.';
    detailEl.append(p);
    return;
  }
  if (spoilerHidden(t)) {
    const h = document.createElement('h2');
    h.textContent = 'Hidden trophy';
    const p = document.createElement('p');
    p.textContent = 'This is a story trophy and spoilers are on. Earn it in the game (or turn spoilers off) to see its name, description and guide.';
    detailEl.append(h, p);
    return;
  }
  const h = document.createElement('h2');
  h.textContent = t.name;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.append(pill(t));
  meta.append(tag(kindLabel[t.kind], ''));
  if (t.count) meta.append(tag(`PSN target: ${t.count}`, 'count'));
  if (t.missable) meta.append(tag('MISSABLE', 'missable'));
  if (t.hidden) meta.append(tag('HIDDEN ON PSN', 'hidden'));
  meta.append(tag(t.status.toUpperCase(), t.status));
  const off = document.createElement('p');
  off.className = 'official';
  off.textContent = `Official description: \u201c${t.description}\u201d`;
  detailEl.append(h, meta, off);
  if (t.missable) {
    const warn = document.createElement('p');
    warn.className = 'warn';
    warn.textContent = `\u26a0 Missable — ${MISSABLE_WHEN[t.id] ?? 'this one needs the right moment.'} See the steps below and do it before it can pass.`;
    detailEl.append(warn);
  }
  const gh = document.createElement('h3');
  gh.textContent = 'How to unlock it';
  const gp = document.createElement('p');
  gp.textContent = t.guide;
  const ol = document.createElement('ol');
  for (const step of t.steps) {
    const li = document.createElement('li');
    li.textContent = step;
    ol.append(li);
  }
  detailEl.append(gh, gp, ol);
  const sh = document.createElement('h3');
  sh.textContent = 'Sources';
  const sp = document.createElement('p');
  sp.className = 'srcs';
  for (const key of t.sources) {
    const [label, url] = SOURCE_URLS[key] ?? [key, null];
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = label;
      sp.append(a);
    } else {
      sp.append(document.createTextNode(label));
    }
    sp.append(document.createTextNode(' · '));
  }
  sp.append(document.createTextNode(
    t.status === 'confirmed'
      ? 'Requirement confirmed by the official description.'
      : 'Method is the author\u2019s own advice from the official description — not yet checked in the game.',
  ));
  detailEl.append(sh, sp);
  const eh = document.createElement('h3');
  eh.textContent = 'Your progress';
  const ep = document.createElement('p');
  ep.textContent = earned.has(t.id)
    ? 'Earned — ticked in this browser. Untick it on the card if that was a mistake.'
    : 'Not earned yet. Tick the checkbox on its card when it pops in the game.';
  detailEl.append(eh, ep);
}

// Roadmap phases, built from the official descriptions: which story chapters
// and missions, which collectibles and counts, in what order — each with an
// honest time estimate for a first playthrough. Whole run: roughly 65–90 hours.
const ROADMAP_PHASES = [
  {
    title: 'Phase 1 — Play the story',
    when: 'Chapters 1–4 in order, then the final mission · ≈30–40 hours',
    text: 'Gone Fishing opens the game; Breakfast Run, The Cartel Heist, Child\u2019s Play, Headliners, VCIA Takedown and Operation Savage Glory follow in the story flow, and the chapter trophies pop at each chapter-complete screen. This earns every story trophy and unlocks the map, the contacts and the activities the rest of the list needs. Do the two partner trophies before the finale.',
    ids: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 33, 34],
  },
  {
    title: 'Phase 2 — Strangers & side strands',
    when: 'Free roam after the story, sweeping the map · ≈8–12 hours',
    text: 'Finish the eight stranger strands — Andy, Kenton, Billy, Randy and Tyrone each have their own trophy, plus three more — and take Cal\u2019s fishing challenge and Bret\u2019s unique-animal hunt while their strands are open. New markers appear after each chapter, so sweep the map between phases.',
    ids: [22, 23, 24, 25, 26, 27, 29, 20],
  },
  {
    title: 'Phase 3 — Activities & skills',
    when: 'A focused session each · ≈6–10 hours',
    text: 'Gold all 42 Shooting Range challenges, win the 14 drone races and 20 different races, finish an arcade game and a bowling game, and try all 9 activity types. These are skill checks, not story gates — take them one at a time, easiest first.',
    ids: [16, 17, 18, 19, 21, 46],
  },
  {
    title: 'Phase 4 — Heists, robberies & combat',
    when: 'Free-roam mayhem, one job at a time · ≈6–8 hours',
    text: 'Rob 5 bank vaults, an armored truck and one illegal operation per gang; pull off the stealth jewelry robbery, the Rhino, the 5-kill Combat Focus and the melee drive-by. Bring a fast car, plan every exit, and bank the Marked Bills — they feed the laundering trophy.',
    ids: [36, 38, 39, 40, 41, 43, 51],
  },
  {
    title: 'Phase 5 — Collectibles & exploration',
    when: 'One big map sweep · ≈8–12 hours',
    text: 'Explore all 52 areas, meditate at all 18 spots, WAiNK at 100 locations, complete 3 card sets and discover 100 vehicles. Do this as one route: the spots overlap, so one sweep covers several trophies at once. The Ocean Beach cocktail and the showroom smash are stops on the way.',
    ids: [28, 30, 31, 35, 42, 44, 45],
  },
  {
    title: 'Phase 6 — Money, property & the long counts',
    when: 'The tail, after everything else · ≈6–10 hours',
    text: 'Launder $250,000 of Marked Bills, spend $100,000 in shops, buy all 8 garages, register 10 vehicles, and let the long counts finish: 250 stunts, 50 challenges, 500 choices. Then check the 100% stats page — A Long Road and the platinum are the last two to pop.',
    ids: [14, 1, 15, 32, 48, 52, 53, 54, 55, 37, 47, 49, 50],
  },
];
// The pre-finale checklist: everything that gets harder — or impossible —
// once the final mission is done. Saved beside trophy progress.
const FINALE_ITEMS = [
  'Hot Together — lose a 4-star wanted level with your partner and escape.',
  'Retail Therapy — rob 3 shops back-to-back with your partner.',
  'Cal\u2019s fishing challenge — accept it the moment it is offered.',
  'Bret\u2019s unique-animal hunt — done inside his strand, never before it.',
  'Sneakthief — one jewelry robbery with no detection at all.',
  'Save the game in a fresh slot before starting the final mission.',
  'Check the tracker: all 5 missable trophies ticked.',
];
function renderRoadmap() {
  const el = $('phases');
  el.replaceChildren();
  ROADMAP_PHASES.forEach((phase, i) => {
    const li = document.createElement('li');
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = String(i + 1);
    const body = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = phase.title;
    const when = document.createElement('p');
    when.className = 'when';
    when.textContent = phase.when;
    const p = document.createElement('p');
    p.textContent = phase.text;
    const list = document.createElement('ul');
    list.className = 'tlist';
    for (const id of phase.ids) {
      const t = trophies.find((x) => x.id === id);
      const item = document.createElement('li');
      if (earned.has(id)) item.className = 'done';
      item.textContent = `${earned.has(id) ? '\u2713 ' : '\u25cb '}${t.name} (${gradeLabel(t.grade)})`;
      list.append(item);
    }
    body.append(h, when, p, list);
    const count = document.createElement('div');
    count.className = 'count';
    const done = phase.ids.filter((id) => earned.has(id)).length;
    count.textContent = `${done}/${phase.ids.length} done`;
    li.append(num, body, count);
    el.append(li);
  });
}
function renderMissables() {
  const el = $('missableCards');
  el.replaceChildren();
  for (const t of trophies.filter((x) => x.missable)) {
    const li = document.createElement('li');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card' + (earned.has(t.id) ? ' earned' : '');
    const row = document.createElement('div');
    row.className = 'row1';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = t.name;
    row.append(name);
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = `${t.description} — ${MISSABLE_WHEN[t.id] ?? ''}`;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.append(pill(t));
    meta.append(tag('MISSABLE', 'missable'));
    meta.append(tag(t.status.toUpperCase(), t.status));
    card.append(row, desc, meta);
    card.addEventListener('click', () => {
      selectedId = t.id;
      switchView('checklist');
      renderCards();
      renderDetail();
      detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    li.append(card);
    el.append(li);
  }
}
function renderFinale() {
  const el = $('finaleList');
  el.replaceChildren();
  FINALE_ITEMS.forEach((text, i) => {
    const li = document.createElement('li');
    if (finaleDone.has(i)) li.className = 'done';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = finaleDone.has(i);
    box.setAttribute('aria-label', text);
    box.addEventListener('change', () => {
      if (box.checked) finaleDone.add(i);
      else finaleDone.delete(i);
      saveFinale();
      renderFinale();
    });
    const span = document.createElement('span');
    span.textContent = text;
    li.append(box, span);
    el.append(li);
  });
}
function renderSources() {
  const el = $('srcList');
  el.replaceChildren();
  for (const key of Object.keys(SOURCE_URLS)) {
    const [label, url] = SOURCE_URLS[key];
    const li = document.createElement('li');
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `${label} — ${url}`;
      li.append(a);
    } else {
      li.textContent = label;
    }
    el.append(li);
  }
}
function switchView(name) {
  for (const btn of document.querySelectorAll('.tabs button')) {
    const active = btn.dataset.view === name;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  for (const view of document.querySelectorAll('.view')) {
    view.hidden = view.id !== `view-${name}`;
  }
  $('main').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
for (const btn of document.querySelectorAll('.tabs button')) {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
}
for (const id of ['search', 'grade', 'kind', 'status']) {
  $(id).addEventListener(id === 'search' ? 'input' : 'change', renderCards);
}
$('spoilers').checked = spoilers;
$('spoilers').addEventListener('change', (e) => {
  spoilers = e.target.checked;
  saveSpoilers();
  renderCards();
  renderDetail();
});
$('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(
    [JSON.stringify({ game: 'Grand Theft Auto VI', earned: [...earned].sort((a, b) => a - b) }, null, 2)],
    { type: 'application/json' },
  ));
  a.download = 'leonida-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    const valid = ids.filter((id) => Number.isInteger(id) && id >= 1 && id <= 55);
    earned = new Set(valid);
    saveProgress();
    refreshAll();
  } catch {
    alert('That file could not be read as trophy progress.');
  }
  e.target.value = '';
});
$('reset').addEventListener('click', () => {
  if (!confirm('Clear all earned trophies? This cannot be undone.')) return;
  earned = new Set();
  saveProgress();
  refreshAll();
});
renderProgress();
renderCards();
renderDetail();
renderRoadmap();
renderMissables();
renderFinale();
renderSources();
