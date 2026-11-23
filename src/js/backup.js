// The grown-ups' corner: everything of this phone (profiles, progress, drawings, added pages and
// stickers, language) saved in one file, and put back from such a file, for instance on a new phone.
// Colouring pages and personal stickers are added from here too.
import { $, el, confirmDialog, onLongPress } from './util.js';
import { storageEntries, replaceStorage } from './store.js';
import { allArt, clearArt, putArt, allPages, clearPages, putPage, allStickers, clearStickers, putSticker } from './artstore.js';
import { shareFile } from './share.js';
import { t } from './i18n.js';
import { importPage } from './importer.js';
import { customStickers, importStickerFile, forgetSticker, validSticker } from './stickers.js';
import { preloadStamps } from './images.js';
import { route } from './main.js';

const APP = 'giuno-colors';

export async function makeBackup() {
  return { app: APP, version: 1, saved: new Date().toISOString(), storage: storageEntries(), art: await allArt(), pages: await allPages(),
    stickers: await allStickers() };
}

export async function saveBackup() {
  const data = await makeBackup();
  const day = data.saved.slice(0, 10);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  return shareFile(blob, `giuno-sauvegarde-${day}.json`, 'Giuno Colors', 'application/json');
}

// Checks a backup and puts it in place of what this phone holds. False if it is not one.
export async function restoreBackup(data) {
  if (!data || data.app !== APP || typeof data.storage !== 'object' || !Array.isArray(data.art)) return false;
  const records = data.art.filter((r) => r && typeof r.id === 'string' && Array.isArray(r.ops));
  replaceStorage(Object.fromEntries(Object.entries(data.storage).filter(([, v]) => typeof v === 'string')));
  await clearArt();
  for (const r of records) await putArt(r);
  await clearPages();
  for (const p of Array.isArray(data.pages) ? data.pages : []) {
    if (p && typeof p.id === 'string' && typeof p.svg === 'string') await putPage(p);
  }
  await clearStickers();
  for (const s of Array.isArray(data.stickers) ? data.stickers : []) {
    if (validSticker(s)) await putSticker(s);
  }
  return true;
}

// The personal stickers of this phone, under the button that adds them; holding one removes it.
export function showStickers() {
  const row = $('#sticker-list');
  row.replaceChildren();
  for (const s of customStickers()) {
    const b = el('button', 'sticker');
    const img = el('img');
    img.src = s.data;
    img.alt = s.name;
    img.draggable = false;
    b.append(img);
    b.dataset.sticker = s.id;
    onLongPress(b, 600, async () => {
      if (!(await confirmDialog(t('Retirer cet autocollant de ce téléphone ? Il disparaîtra des dessins où il est collé.'), t('Retirer')))) return;
      await forgetSticker(s.id);
      showStickers();
    });
    row.append(b);
  }
  row.hidden = !row.children.length;
}

async function pickAndRestore(file) {
  let data = null;
  try { data = JSON.parse(await file.text()); } catch (e) { data = null; }
  if (!data || data.app !== APP) {
    await confirmDialog(t("Ce fichier n'est pas une sauvegarde de Giuno Colors."));
    return;
  }
  const when = new Date(data.saved).toLocaleDateString();
  if (!(await confirmDialog(t('Remplacer les profils, la progression et les dessins de ce téléphone par la sauvegarde du {date} ?', { date: when }), t('Remplacer')))) return;
  if (await restoreBackup(data)) location.reload();
}

$('#backup-save').addEventListener('click', () => saveBackup().catch((e) => console.error('backup failed:', e)));
$('#backup-load').addEventListener('click', () => $('#backup-file').click());
$('#page-import').addEventListener('click', () => $('#page-file').click());
$('#page-file').addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])];
  e.target.value = '';
  const added = [], refused = [];
  for (const file of files) {
    const d = await importPage(await file.text(), file.name).catch((err) => err);
    if (d instanceof Error) refused.push(`${file.name} (${d.message})`); else added.push(d.title);
  }
  if (added.length) route();
  const lines = [];
  if (added.length) lines.push(t('Coloriage ajouté : {names}', { names: added.join(', ') }));
  if (refused.length) lines.push(t("Pas un coloriage à numéros : {names}", { names: refused.join(', ') }));
  if (lines.length) await confirmDialog(lines.join('\n'));
});
$('#sticker-import').addEventListener('click', () => $('#sticker-file').click());
$('#sticker-file').addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])];
  e.target.value = '';
  let added = 0, known = 0;
  const refused = [];
  for (const file of files) {
    const r = await importStickerFile(file).catch((err) => err);
    if (r instanceof Error) refused.push(`${file.name} (${r.message})`); else { added += r.added; known += r.known; }
  }
  preloadStamps();
  showStickers();
  const lines = [];
  if (added) lines.push(t('Autocollants ajoutés : {n}', { n: added }));
  if (known) lines.push(t('Déjà sur ce téléphone : {n}', { n: known }));
  if (refused.length) lines.push(t("Ni une image ni un pack d'autocollants : {names}", { names: refused.join(', ') }));
  if (lines.length) await confirmDialog(lines.join('\n'));
});
$('#backup-file').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) pickAndRestore(file).catch((err) => console.error('restore failed:', err));
});
