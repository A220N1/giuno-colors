// The gallery for the current child: free drawings first, then the colouring pages with their progress.
// Coming back to it must be instant: the card of a colouring page is built once and kept, then only
// brought up to date with the child's progress, and the picture of a free drawing is kept until that
// drawing changes.
import { $, el, svgEl, showScreen, face, onLongPress, confirmDialog } from './util.js';
import { forgetPage } from './importer.js';
import { drawings, instantiate, paint } from './drawings.js';
import { getProgress, storageOk } from './store.js';
import { listArt, newArtId } from './artstore.js';
import { renderFlat } from './art.js';
import { prepareArt } from './images.js';
import { t, titleOf, categoryOf, lang } from './i18n.js';
import { perfStart, perfStop, count } from './perf.js';

const LEVELS = ['', 'Facile', 'Moyen', 'Difficile'];

let shown = null;   // the latest gallery, so a slow drawing list does not land in a newer one
let now = null;     // what the kept cards act on: the child and the ways out of the gallery
const kept = new Map();    // drawing key and language -> its card
const thumbs = new Map();  // free drawing id -> { profile, updated, canvas }

function unpaint(zone) {
  zone.classList.remove('done');
  zone.style.removeProperty('--c');
  zone.style.removeProperty('--s');
}

function makeCard(d) {
  const { g, zones, colors } = instantiate(d);
  const thumb = svgEl('svg', { viewBox: d.vb.join(' '), class: 'thumb' });
  thumb.style.aspectRatio = `${d.vb[2]} / ${d.vb[3]}`;
  thumb.append(g);
  const title = el('b'), info = el('span', null, `${LEVELS[d.level] ? t(LEVELS[d.level]) : ''} · ${zones.length}`);
  const meta = el('div', 'meta');
  meta.append(title, info);
  const bar = el('div', 'bar'), fill = el('i');
  bar.append(fill);
  const card = el('button', 'card');
  card.append(thumb, meta, bar);
  card.addEventListener('click', () => now.onOpen(d));
  if (d.imported) {
    onLongPress(card, 600, async () => {
      if (!(await confirmDialog(t('Retirer « {title} » de ce téléphone ?', { title: titleOf(d) }), t('Retirer')))) return;
      await forgetPage(d.id);
      showGallery(now.profile, now.onOpen, now.onWho, now.onArt);
    });
  }
  return { card, thumb, zones, colors, title, bar, fill, painted: new Set(), state: '' };
}

// The card of a drawing, as the child has coloured it so far.
function cardOf(d, profile) {
  const key = d.key + '|' + lang();
  let c = kept.get(key);
  if (!c) { c = makeCard(d); kept.set(key, c); }
  const list = getProgress(profile.id, d.key).filter((i) => i < c.zones.length);
  const state = profile.id + ':' + list.join(',');
  if (state !== c.state) {
    const filled = new Set(list);
    for (const i of c.painted) if (!filled.has(i)) unpaint(c.zones[i]);
    for (const i of filled) if (!c.painted.has(i)) paint(c.zones[i], d.palette[c.colors[i]]);
    c.painted = filled;
    c.state = state;
    // a mystery page keeps its picture and its name to itself until it is finished
    const hidden = d.mystery && filled.size < c.zones.length;
    c.thumb.setAttribute('class', hidden ? 'thumb mystery' : 'thumb');
    c.card.className = hidden ? 'card secret' : 'card';
    c.title.textContent = hidden ? t('Coloriage mystère') : titleOf(d);
    c.bar.className = 'bar' + (filled.size === c.zones.length ? ' full' : '');
    c.fill.style.width = (100 * filled.size / c.zones.length) + '%';
  }
  return c.card;
}

export function showGallery(profile, onOpen, onWho, onArt) {
  const t0 = perfStart();
  now = { profile, onOpen, onWho, onArt };
  showScreen('gallery');
  const who = $('#who');
  who.replaceChildren(face(profile), el('span', null, profile.name));
  who.onclick = onWho;

  const list = $('#cards');
  list.replaceChildren();
  const row = el('div', 'art-row');
  const add = el('button', 'card art-new');
  add.append(el('span', 'page', '+'), el('b', null, t('Nouveau dessin')));
  add.addEventListener('click', () => onArt(newArtId()));
  row.append(add);
  list.append(el('h2', 'section', t('Mes dessins')), row);
  const token = shown = {};
  listArt(profile.id).then(async (records) => {
    if (shown !== token) return;
    const t1 = perfStart();
    let drawn = 0;
    for (const r of records) {
      const card = el('button', 'card art-card');
      card.addEventListener('click', () => onArt(r.id));
      row.append(card);
      const had = thumbs.get(r.id);
      if (had && had.updated === r.updated) { card.append(had.canvas); continue; }
      try {
        const base = await prepareArt(r.ops, r.base);  // its stickers and colouring page, if any
        if (shown !== token) return;
        const thumb = renderFlat(r.ops, 360, base);
        thumb.className = 'thumb';
        thumbs.set(r.id, { profile: profile.id, updated: r.updated, canvas: thumb });
        card.append(thumb);
        drawn++;
      } catch (e) {
        console.error('thumbnail not drawn:', e);  // one drawing must not stop the gallery
      }
    }
    for (const [id, th] of [...thumbs]) if (th.profile === profile.id && !records.some((r) => r.id === id)) thumbs.delete(id);
    perfStop('vignettes des dessins libres', t1, `${count(records.length, 'dessin')}, ${drawn} redessinés`);
  }).catch((e) => console.error('drawings not listed:', e));

  let category = null, cards = null;
  for (const d of drawings) {
    if (d.category !== category || !cards) {  // drawings arrive grouped by category
      category = d.category;
      if (category) list.append(el('h2', 'section', categoryOf(d)));
      cards = el('div', 'cards');
      list.append(cards);
    }
    cards.append(cardOf(d, profile));
  }
  $('#storage-note').hidden = storageOk();
  perfStop('galerie', t0, count(drawings.length, 'coloriage'));
}
