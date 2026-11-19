// Interface language: French by default, English on request, remembered on this device.
// French text is the key; a missing English entry falls back to French.
import { getLang, setLang } from './store.js';

const EN = {
  // start page and gallery
  'Coloriages par numéros et dessin libre pour les enfants.': 'Color by number and free drawing for children.',
  'Qui colorie ?': 'Who is coloring?',
  'Appui long sur un prénom pour le modifier ou le supprimer.': 'Hold a name to change or delete it.',
  'Ajouter': 'Add',
  "Changer d'enfant": 'Change child',
  "Installer l'appli": 'Install the app',
  'Ce navigateur ne garde pas la progression : elle sera perdue en fermant la page.':
    'This browser does not keep progress: it will be lost when the page is closed.',
  'Version': 'Version',
  'Code source': 'Source code',
  'sous licence GPL-3.0, dessins sous licence CC BY-SA 4.0.': 'under the GPL-3.0 license, drawings under CC BY-SA 4.0.',
  'Emojis des scènes :': 'Emojis in the scenes:',
  ', licence CC BY-SA 4.0.': ', CC BY-SA 4.0 license.',
  'Mes dessins': 'My drawings',
  'Nouveau dessin': 'New drawing',
  'Facile': 'Easy',
  'Moyen': 'Medium',
  'Difficile': 'Hard',
  'Changer de langue': 'Change language',

  // colouring
  'Retour aux dessins': 'Back to the drawings',
  "Partager l'image": 'Share the picture',
  'Trouver une zone': 'Find a zone',
  'Recommencer': 'Start again',
  'Bravo !': 'Well done!',
  'Autres dessins': 'Other drawings',
  'Tout effacer et recommencer ce dessin ?': 'Clear everything and start this drawing again?',
  'Effacer': 'Clear',

  // free drawing
  'Annuler': 'Cancel',
  'Annuler le dernier geste': 'Undo',
  'Refaire': 'Redo',
  'Jeter le dessin': 'Throw the drawing away',
  'Jeter ce dessin ?': 'Throw this drawing away?',
  'Jeter': 'Throw away',
  'Pinceau': 'Brush',
  'Pot de peinture': 'Paint bucket',
  'Gomme': 'Eraser',
  'Formes': 'Shapes',
  'Formes : {name}': 'Shapes: {name}',
  'Épaisseur': 'Line size',
  'Épaisseur {n}': 'Line size {n}',
  'Couleur {c}': 'Color {c}',
  'Arc-en-ciel': 'Rainbow',
  'Rond': 'Circle',
  'Carré': 'Square',
  'Triangle': 'Triangle',
  'Étoile': 'Star',
  'Cœur': 'Heart',
  'Mon dessin': 'My drawing',
  'Miroir': 'Mirror',
  'Miroir : {name}': 'Mirror: {name}',
  'Sans miroir': 'No mirror',
  'Miroir gauche-droite': 'Left and right mirror',
  'Miroir en quatre': 'Four-way mirror',
  'Kaléidoscope': 'Kaleidoscope',

  // lock
  "Verrouiller l'écran": 'Lock the screen',
  'Déverrouiller : garder le doigt appuyé': 'Unlock: keep your finger down',
  'Garde le doigt sur le cadenas pour ouvrir': 'Keep your finger on the padlock to unlock',

  // profiles
  'Modifier le profil': 'Edit profile',
  'Nouveau profil': 'New profile',
  'Prénom': 'First name',
  'Supprimer': 'Delete',
  'OK': 'OK',
  'Supprimer le profil de {name}, sa progression et ses dessins ?': "Delete {name}'s profile, progress and drawings?",
  'Renard': 'Fox',
  'Chat': 'Cat',
  'Lapin': 'Rabbit',
  'Ours': 'Bear',
  'Chouette': 'Owl',
  'Hérisson': 'Hedgehog',
  'Faon': 'Fawn',
  'Écureuil': 'Squirrel',
  'Souris': 'Mouse',
  'Grenouille': 'Frog',
  'Panda roux': 'Red panda',
  'Chien': 'Dog',
  'Phoque': 'Seal',
  'Canard': 'Duck',
  'Agneau': 'Lamb',
};

let current = getLang();

export const lang = () => current;

export function t(fr, vars) {
  let s = (current === 'en' && EN[fr]) || fr;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

// Drawing titles and category names come with the drawings, in both languages when available.
export const titleOf = (d) => (current === 'en' && d.titleEn) || d.title;
export const categoryOf = (d) => (current === 'en' && d.categoryEn) || d.category;

// Static texts of the page: data-t translates the text, data-t-aria the label, data-t-ph the placeholder.
// The French originals are read once from the page.
const originals = new Map();
function original(node, what, read) {
  let o = originals.get(node);
  if (!o) originals.set(node, o = {});
  if (!(what in o)) o[what] = read();
  return o[what];
}

export function translatePage() {
  document.documentElement.lang = current;
  for (const n of document.querySelectorAll('[data-t]')) n.textContent = t(original(n, 'text', () => n.textContent));
  for (const n of document.querySelectorAll('[data-t-aria]')) {
    n.setAttribute('aria-label', t(original(n, 'aria', () => n.getAttribute('aria-label'))));
  }
  for (const n of document.querySelectorAll('[data-t-ph]')) {
    n.setAttribute('placeholder', t(original(n, 'ph', () => n.getAttribute('placeholder'))));
  }
  for (const b of document.querySelectorAll('.lang-switch span')) b.classList.toggle('on', b.dataset.lang === current);
}

export function setLanguage(l) {
  current = l === 'en' ? 'en' : 'fr';
  setLang(current);
  translatePage();
}
