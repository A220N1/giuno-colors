// The gallery for the current child: free drawings first, then the colouring pages with their progress.
import { $, el, svgEl, showScreen, face } from './util.js';
import { drawings, instantiate, paint } from './drawings.js';
import { getProgress, storageOk } from './store.js';
import { listArt, newArtId } from './artstore.js';
import { renderFlat } from './art.js';

const LEVELS = ['', 'Facile', 'Moyen', 'Difficile'];

let shown = null;  // the latest gallery, so a slow drawing list does not land in a newer one

export function showGallery(profile, onOpen, onWho, onArt) {
  showScreen('gallery');
  const who = $('#who');
  who.replaceChildren(face(profile), el('span', null, profile.name));
  who.onclick = onWho;

  const list = $('#cards');
  list.replaceChildren();
  const row = el('div', 'art-row');
  const add = el('button', 'card art-new');
  add.append(el('span', 'page', '+'), el('b', null, 'Nouveau dessin'));
  add.addEventListener('click', () => onArt(newArtId()));
  row.append(add);
  list.append(el('h2', 'section', 'Mes dessins'), row);
  const token = shown = {};
  listArt(profile.id).then((records) => {
    if (shown !== token) return;
    for (const r of records) {
      const card = el('button', 'card art-card');
      const thumb = renderFlat(r.ops, 360);
      thumb.className = 'thumb';
      card.append(thumb);
      card.addEventListener('click', () => onArt(r.id));
      row.append(card);
    }
  }).catch((e) => console.error('drawings not listed:', e));

  let category = null, cards = null;
  for (const d of drawings) {
    if (d.category !== category || !cards) {  // drawings arrive grouped by category
      category = d.category;
      if (category) list.append(el('h2', 'section', category));
      cards = el('div', 'cards');
      list.append(cards);
    }
    const { g, zones, colors } = instantiate(d);
    const filled = new Set(getProgress(profile.id, d.key).filter((i) => i < zones.length));
    zones.forEach((z, i) => { if (filled.has(i)) paint(z, d.palette[colors[i]]); });
    const thumb = svgEl('svg', { viewBox: d.vb.join(' '), class: 'thumb' });
    thumb.style.aspectRatio = `${d.vb[2]} / ${d.vb[3]}`;
    thumb.append(g);

    const meta = el('div', 'meta');
    meta.append(el('b', null, d.title), el('span', null, `${LEVELS[d.level] || ''} · ${zones.length}`));
    const bar = el('div', 'bar' + (filled.size === zones.length ? ' full' : ''));
    const fill = el('i');
    fill.style.width = (100 * filled.size / zones.length) + '%';
    bar.append(fill);

    const card = el('button', 'card');
    card.append(thumb, meta, bar);
    card.addEventListener('click', () => onOpen(d));
    cards.append(card);
  }
  $('#storage-note').hidden = storageOk();
}
