/* Onde cada item aparece: área de trabalho, taskbar, dock ou em lugar nenhum ('none': só na Loja ou, para jogos, no app Jogos) */

$('#taskbar').addEventListener('contextmenu', e => e.preventDefault());       // o botão direito na taskbar nunca abre as configurações

const BTN = new Map();
function btnOf(l, w) {
  const id = idOf(l); let m = BTN.get(id); if (!m) BTN.set(id, m = {});
  if (!m[w]) {
    const b = document.createElement('button'); b.className = w === 'dock' ? 'dk' : 'pin'; b.dataset.label = l.n; b.dataset.id = id; b.setAttribute('aria-label', l.n); b.append(tile(l));
    b.onclick = () => toggleApp(l); b.addEventListener('contextmenu', e => itemMenu(e, l, w)); b.draggable = true;
    (w === 'dock' ? $('#dock') : $('#tools')).append(b); m[w] = b;
  }
  return m[w];
}
function syncItem(l) {
  const id = idOf(l), p = placeOf(l), on = !OFF.has(id), m = BTN.get(id) || {}, key = l.win || l.u;
  ['taskbar', 'dock'].forEach(w => { if (p === w && on) btnOf(l, w).hidden = false; else if (m[w]) m[w].hidden = true; });
  const cur = on && (p === 'taskbar' || p === 'dock') ? BTN.get(id)[p] : null, old = pinBtns.get(key);
  if (old && old !== cur) old.classList.remove('open', 'active');
  if (cur) pinBtns.set(key, cur); else pinBtns.delete(key);
  const w = wins.get(key); if (w && cur && !w.btn.classList.contains('task')) { cur.classList.add('open'); w.btn = cur; }
}
function setPlace(l, w) {
  PLACE[idOf(l)] = w; store.set('piratinha-place', PLACE); delete saved[l.u];
  if (w === 'dock' && !pref.dk) { pref.dk = true; applyPrefs(); }
  syncItem(l);
  if (PINBOX[w] && !OFF.has(idOf(l))) { const b = BTN.get(idOf(l))[w]; b.parentNode.append(b); PINBOX[w](); }   // recém-chegado entra no fim da fila
  updateDock(); layoutAll();
}
function itemMenu(e, l, where) {
  const w = wins.get(l.win || l.u), items = [w ? ['✕ Fechar', () => w.el.querySelector('.close').click()] : ['📂 Abrir', () => openApp(l)]];
  [['taskbar', '📌 Mover para a taskbar'], ['dock', '🧷 Mover para a dock'], ['desktop', '🖥️ Mover para a área de trabalho'], ['none', l.cat === 'jogos' ? '🙈 Esconder (continua em Jogos)' : '🙈 Esconder (continua na Loja)']].forEach(([k, t]) => { if (k !== where && (k !== 'none' || (l.app && l.id !== 'sys:store'))) items.push([t, () => setPlace(l, k)]); });
  showCtx(e, items);
}
function setInst(l, on) {
  const id = idOf(l);
  if (on) OFF.delete(id); else { OFF.add(id); const w = wins.get(l.win || l.u); if (w) w.el.querySelector('.close').click(); trashed.delete(l.u); delete saved[l.u]; persistTrash(); }
  store.set('piratinha-off', [...OFF]); syncItem(l); updateDock(); layoutAll();
}
function updateDock(relayout) {
  const d = $('#dock'), z = { p: 66, m: 74, g: 84 }[pref.dz] || 74, tb = 58 + (pref.ts === 'd' ? 10 : 20);
  d.hidden = !pref.dk || ![...d.children].some(b => !b.hidden); $('#dockzone').hidden = d.hidden || !pref.da;
  let t = 0, b = 0, l = 0, r = 0; if (pref.tb === 't') t = tb; else b = tb;
  if (!d.hidden && !pref.da) { if (pref.dp === 'b') b += z; else if (pref.dp === 't') t += z; else if (pref.dp === 'l') l += z; else r += z; }
  [['t', t], ['b', b], ['l', l], ['r', r]].forEach(([k, n]) => os.style.setProperty('--ins-' + k, n + 'px'));
  os.style.setProperty('--dk-off', (pref.dp === pref.tb ? tb : 10) + 'px');
  if (relayout) layoutAll();
}
LINKS.forEach(syncItem);
/* Fixados da taskbar e da dock: arrastar reordena; soltar no outro lado (taskbar ↔ dock) move o item para lá */
const PINBOX = {}; let dragBtn = null;                           // PINBOX[lugar]() salva a ordem; dragBtn = botão sendo arrastado
function sortable(box, zone, where, key, def) {                   // zone = área que aceita soltar itens vindos do outro lado
  const cls = where === 'dock' ? '.dk' : '.pin', save = PINBOX[where] = () => store.set(key, [...box.children].map(b => b.dataset.id));
  [...store.get(key, def)].reverse().forEach(n => { const b = [...box.children].find(x => x.dataset.id === n); if (b) box.prepend(b); });   // ordem salva na frente; o resto depois
  box.addEventListener('dragstart', e => { dragBtn = e.target.closest(cls); box.classList.add('sorting'); });
  zone.addEventListener('dragover', e => {
    if (!dragBtn) return; e.preventDefault();
    const t = e.target.closest(cls); if (dragBtn.parentNode !== box || !t || t === dragBtn || t.parentNode !== box) return;
    const r = t.getBoundingClientRect(), col = getComputedStyle(box).flexDirection.startsWith('column');   // dock na lateral: compara na vertical
    box.insertBefore(dragBtn, (col ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2) ? t : t.nextSibling);
  });
  zone.addEventListener('drop', e => {
    if (!dragBtn || dragBtn.parentNode === box) return; e.preventDefault();
    const l = LINKS.find(x => idOf(x) === dragBtn.dataset.id), from = dragBtn.parentNode; dragBtn = null; from.classList.remove('sorting');   // o botão de origem some: não depende do dragend dele
    if (l) setPlace(l, where);
  });
  box.addEventListener('dragend', () => { dragBtn = null; box.classList.remove('sorting'); save(); if (!box.matches(':hover')) box.dispatchEvent(new Event('pointerleave')); });   // dock com ocultar automático: volta a se esconder
}
sortable($('#tools'), $('#taskbar'), 'taskbar', 'piratinha-tools', []);
sortable($('#dock'), $('#dock'), 'dock', 'piratinha-dock', ['sys:store', 'sys:browser', 'sys:term', 'sys:games']);
{ const d = $('#dock'), z = $('#dockzone'); let t;                // dock com ocultar automático
  const show = () => { clearTimeout(t); d.classList.add('show'); }, hide = () => { clearTimeout(t); t = setTimeout(() => { if (!d.classList.contains('sorting')) d.classList.remove('show'); }, 450); };
  [z, d].forEach(x => { x.addEventListener('pointerenter', show); x.addEventListener('pointerleave', hide); }); }
