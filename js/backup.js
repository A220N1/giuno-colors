// The grown-ups' corner: everything of this phone (profiles, progress, drawings, language) saved in
// one file, and put back from such a file, for instance on a new phone.
import { $, confirmDialog } from './util.js';
import { storageEntries, replaceStorage } from './store.js';
import { allArt, clearArt, putArt } from './artstore.js';
import { shareFile } from './share.js';
import { t } from './i18n.js';

const APP = 'giuno-colors';

export async function makeBackup() {
  return { app: APP, version: 1, saved: new Date().toISOString(), storage: storageEntries(), art: await allArt() };
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
  return true;
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
$('#backup-file').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) pickAndRestore(file).catch((err) => console.error('restore failed:', err));
});
