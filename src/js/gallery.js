// The list of drawings for the current child, with each one's progress.
import { $, el, svgEl, showScreen, face } from './util.js';
import { drawings, instantiate, paint } from './drawings.js';
import { getProgress, storageOk } from './store.js';

const LEVELS = ['', 'Facile', 'Moyen', 'Difficile'];

export function showGallery(profile, onOpen, onWho) {
  showScreen('gallery');
  const who = $('#who');
  who.replaceChildren(face(profile), el('span', null, profile.name));
  who.onclick = onWho;

  const list = $('#cards');
  list.replaceChildren();
  for (const d of drawings) {
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
    list.append(card);
  }
  $('#storage-note').hidden = storageOk();
}
