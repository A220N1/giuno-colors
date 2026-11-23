// A short journal of what the Back button and the browser history did, kept on this device: it goes
// with the fluidity report of the grown-ups' corner, to understand a Back that went wrong on a phone.
const KEY = 'giuno.navlog', MAX = 60;

export function navlog(what) {
  try {
    const lines = JSON.parse(localStorage.getItem(KEY) || '[]');
    const t = new Date(), two = (n) => String(n).padStart(2, '0');
    lines.push(`${two(t.getHours())}:${two(t.getMinutes())}:${two(t.getSeconds())} ${what} | ${location.hash || '(galerie)'} `
      + `| historique ${history.length}, état ${JSON.stringify(history.state)}`);
    localStorage.setItem(KEY, JSON.stringify(lines.slice(-MAX)));
  } catch (e) { /* no storage, no journal */ }
}

export function navlogText() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]').join('\n'); } catch (e) { return ''; }
}

addEventListener('pagehide', (e) => navlog(`page quittée${e.persisted ? ' (gardée en mémoire)' : ''}`));
addEventListener('pageshow', (e) => { if (e.persisted) navlog('page revenue de la mémoire'); });
document.addEventListener('visibilitychange', () => navlog(document.hidden ? 'appli cachée' : 'appli visible'));
