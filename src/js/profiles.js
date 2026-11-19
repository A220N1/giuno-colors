// "Qui colorie ?": one profile per child, each with its own progress and drawings.
import { $, el, showScreen, face, onLongPress, confirmDialog } from './util.js';
import { profiles, addProfile, updateProfile, removeProfile } from './store.js';
import { deleteArtOf } from './artstore.js';

const COLORS = ['#e8483b', '#fb8c00', '#f2b531', '#43a047', '#3088c4', '#7e57c2', '#ec6fa5', '#6d4c41'];

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
  add.append(el('span', 'face', '+'), el('span', null, 'Ajouter'));
  add.addEventListener('click', () => editProfile(null, (created) => (created ? onPick(created.id) : showProfiles(onPick))));
  list.append(add);
  $('#profiles-note').hidden = profiles().length === 0;
}

// Create (p = null) or edit a profile; done(created) runs after any change.
function editProfile(p, done) {
  const dialog = $('#profile-dialog');
  const name = $('#profile-name');
  let color = p ? p.color : COLORS[profiles().length % COLORS.length];
  $('#profile-title').textContent = p ? 'Modifier le profil' : 'Nouveau profil';
  name.value = p ? p.name : '';
  const row = $('#profile-colors');
  const drawColors = () => {
    row.replaceChildren(...COLORS.map((c) => {
      const b = el('button', c === color ? 'sel' : '');
      b.type = 'button';
      b.style.background = c;
      b.setAttribute('aria-label', 'Couleur ' + c);
      b.onclick = () => { color = c; drawColors(); };
      return b;
    }));
  };
  drawColors();
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
    if (p) { updateProfile(p.id, { name: value, color }); done(null); } else done(addProfile(value, color));
  };
  $('#profile-delete').onclick = async () => {
    close();
    if (await confirmDialog(`Supprimer le profil de ${p.name}, sa progression et ses dessins ?`, 'Supprimer')) {
      removeProfile(p.id);
      deleteArtOf(p.id).catch((e) => console.error('drawings not deleted:', e));
    }
    done(null);
  };
}
