// A drawing as a PNG image, shared through the phone's share sheet or saved as a download.
import { titleOf } from './i18n.js';

// Standalone SVG of the drawing as coloured so far: filled zones in their colour, the others white.
export function snapshotSvg(d, filled, width) {
  const root = d.root.cloneNode(true);
  const [, , vw, vh] = d.vb;
  const stroke = 3 * Math.max(vw, vh) / 1000;
  [...root.querySelectorAll('[data-c]')].forEach((z, i) => {
    const color = filled.has(i) ? d.palette[parseInt(z.getAttribute('data-c'), 10) - 1] : '#ffffff';
    const line = filled.has(i) ? color : '#6b6b6b';
    z.setAttribute('style', `fill:${color};stroke:${line};stroke-width:${stroke};stroke-linejoin:round`);
  });
  root.setAttribute('width', width);
  root.setAttribute('height', Math.round(width * vh / vw));
  return new XMLSerializer().serializeToString(root);
}

export async function renderPng(d, filled, width) {
  const height = Math.round(width * d.vb[3] / d.vb[2]);
  const url = URL.createObjectURL(new Blob([snapshotSvg(d, filled, width)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return await canvasPng(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasPng(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}

export async function shareDrawing(d, filled) {
  return sharePng(await renderPng(d, filled, 1200), `giuno-${d.id}.png`, titleOf(d));
}

export async function sharePng(blob, name, title) {
  return shareFile(blob, name, title, 'image/png');
}

// Through the share sheet when the phone offers one for this kind of file, else as a download.
export async function shareFile(blob, name, title, type) {
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
