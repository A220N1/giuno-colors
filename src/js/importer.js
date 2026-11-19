// Colouring pages imported from SVG files: kept on this phone only, never sent anywhere.
// A file is cleaned before use: only shapes, groups, gradients and their drawing attributes stay, so a
// file cannot run code in the app.
import { allPages, putPage, deletePage } from './artstore.js';
import { addImported, removeImported } from './drawings.js';

const MAX_BYTES = 4 * 1024 * 1024;
const NS = 'http://www.w3.org/2000/svg';
const ZONE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon']);
const TAGS = new Set([...ZONE_TAGS, 'svg', 'g', 'polyline', 'line', 'defs', 'linearGradient', 'radialGradient', 'stop',
  'clipPath', 'title', 'desc']);
const ATTRS = new Set(['viewBox', 'width', 'height', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2',
  'points', 'd', 'transform', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linejoin',
  'stroke-linecap', 'stroke-miterlimit', 'stroke-opacity', 'opacity', 'clip-rule', 'clip-path', 'id', 'class', 'offset',
  'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'fx', 'fy', 'fr', 'spreadMethod', 'clipPathUnits',
  'xmlns', 'version']);
// paint and clip references may only point inside the file
const LOCAL_URL = /^\s*(url\(\s*#[\w.-]+\s*\)|[^()]*)\s*$/;

// The cleaned SVG text of a colouring page, or an Error saying what is wrong with it.
export function cleanPage(text, title = '') {
  if (text.length > MAX_BYTES) return new Error('fichier trop gros');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root.localName !== 'svg' || root.namespaceURI !== NS) return new Error('pas un fichier SVG');
  const walk = (el) => {
    for (const child of [...el.children]) {
      if (child.namespaceURI !== NS || !TAGS.has(child.localName)) { child.remove(); continue; }
      walk(child);
    }
    for (const a of [...el.attributes]) {
      const keep = (ATTRS.has(a.name) || /^data-[\w-]+$/.test(a.name)) && !/^on/i.test(a.name)
        && !/javascript:|expression\(/i.test(a.value) && (!/url\(/i.test(a.value) || LOCAL_URL.test(a.value));
      if (!keep) el.removeAttribute(a.name);
    }
  };
  walk(root);
  const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((v) => !Number.isFinite(v)) || vb[2] <= 0 || vb[3] <= 0) return new Error('viewBox manquant');
  const palette = (root.getAttribute('data-palette') || '').trim().split(/[\s,]+/).filter(Boolean);
  if (!palette.length || palette.some((c) => !/^#[0-9a-fA-F]{6}$/.test(c))) return new Error('palette data-palette manquante');
  const zones = [...root.querySelectorAll('[data-c]')];
  if (!zones.length) return new Error('aucune zone data-c');
  for (const z of zones) {
    const c = Number(z.getAttribute('data-c'));
    if (!ZONE_TAGS.has(z.localName) || !Number.isInteger(c) || c < 1 || c > palette.length) return new Error('zone data-c invalide');
  }
  if (!root.getAttribute('data-title') && title) root.setAttribute('data-title', title);
  return new XMLSerializer().serializeToString(root);
}

export async function loadImported() {
  const pages = (await allPages()) || [];
  pages.sort((a, b) => a.added - b.added).forEach((p) => addImported(p));
}

// Import one file's text; returns the new drawing, or an Error.
export async function importPage(text, fileName = '') {
  const svg = cleanPage(text, fileName.replace(/\.svg$/i, '').slice(0, 40));
  if (svg instanceof Error) return svg;
  const page = { id: 'import-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), svg, added: Date.now(), name: fileName };
  const d = addImported(page);
  if (!d) return new Error('pas un fichier SVG');
  await putPage(page);
  return d;
}

export async function forgetPage(id) {
  removeImported(id);
  await deletePage(id);
}
