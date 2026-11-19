// "Qui colorie ?": one profile per child, each with its own progress and drawings.
import { $, el, showScreen, face, onLongPress, confirmDialog } from './util.js';
import { profiles, addProfile, updateProfile, removeProfile } from './store.js';
import { deleteArtOf } from './artstore.js';
import { t } from './i18n.js';

// Avatar file name in avatars/ and its French name.
export const ANIMALS = [
  ['fox', 'Renard'], ['cat', 'Chat'], ['rabbit', 'Lapin'], ['bear', 'Ours'], ['owl', 'Chouette'],
  ['hedgehog', 'Hérisson'], ['fawn', 'Faon'], ['squirrel', 'Écureuil'], ['mouse', 'Souris'], ['frog', 'Grenouille'],
  ['red-panda', 'Panda roux'], ['dog', 'Chien'], ['seal', 'Phoque'], ['duck', 'Canard'], ['lamb', 'Agneau'],
];

// The first animal no other child has yet.
function freeAnimal(except) {
  const taken = new Set(profiles().filter((p) => p !== except).map((p) => p.animal));
  return (ANIMALS.find(([k]) => !taken.has(k)) || ANIMALS[0])[0];
}

export function showProfiles(onPick) {
  showScreen('profiles');
  const list = $('#profile-list');
  list.replaceChildren();
  for (const p of profiles()) {
    const b = el('button', 'avatar');
    b.append(face(p), el('span', null, p.name));
    b.addEventListener('click', () => onPick(p.id));
    // editing is behind a long press so a child does not open it by accident
    onLongPress(b, 600, () => editProfile(p, () => showProfiles(onPick)));
    list.append(b);
  }
  const add = el('button', 'avatar add');
  add.append(el('span', 'face', '+'), el('span', null, t('Ajouter')));
  add.addEventListener('click', () => editProfile(null, (created) => (created ? onPick(created.id) : showProfiles(onPick))));
  list.append(add);
  $('#profiles-note').hidden = profiles().length === 0;
}

// Create (p = null) or edit a profile; done(created) runs after any change.
function editProfile(p, done) {
  const dialog = $('#profile-dialog');
  const name = $('#profile-name');
  let animal = (p && p.animal) || freeAnimal(p);
  $('#profile-title').textContent = t(p ? 'Modifier le profil' : 'Nouveau profil');
  name.value = p ? p.name : '';
  const grid = $('#profile-animals');
  grid.replaceChildren(...ANIMALS.map(([k, fr]) => {
    const b = el('button', k === animal ? 'sel' : '');
    b.type = 'button';
    b.dataset.animal = k;
    b.setAttribute('aria-label', t(fr));
    b.append(face({ animal: k }));
    b.onclick = () => {
      animal = k;
      for (const o of grid.children) o.classList.toggle('sel', o === b);
    };
    return b;
  }));
  $('#profile-delete').hidden = !p;
  dialog.hidden = false;
  if (!p) name.focus();

  const close = () => { dialog.hidden = true; };
  $('#profile-cancel').onclick = close;
  $('#profile-form').onsubmit = (e) => {
    e.preventDefault();
    const value = name.value.trim();
    if (!value) return;
    close();
    if (p) { updateProfile(p.id, { name: value, animal }); done(null); } else done(addProfile(value, { animal }));
  };
  $('#profile-delete').onclick = async () => {
    close();
    if (await confirmDialog(t('Supprimer le profil de {name}, sa progression et ses dessins ?', { name: p.name }), t('Supprimer'))) {
      removeProfile(p.id);
      deleteArtOf(p.id).catch((e) => console.error('drawings not deleted:', e));
    }
    done(null);
  };
}
