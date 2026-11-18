/* Amigos fictícios: trocam de jogo sozinhos de tempos em tempos e avisam por notificação, como no Steam */

const POOL = SHOP.concat(GAMES.map((g, i) => {   // jogos que os amigos jogam: os da Loja e os do sistema
  const k = (g.u.match(/games\/([^/]+)/) || [])[1]; return { n: g.n, e: g.e, c: GAMEC[k] || ['#4a6fa5', '#1b2838'], li: i };
}));
const pickGame = cur => { let g; do g = Math.random() < .3 ? POOL[SHOP.length + (Math.random() * GAMES.length | 0)] : SHOP[Math.random() * SHOP.length | 0]; while (g === cur); return g; };
const FS = FRIENDS.map(() => { const r = Math.random(); return r < .45 ? { s: 2, g: pickGame() } : { s: r < .7 ? 1 : 0 }; });   // s: 0 offline · 1 online · 2 jogando
let friendsDraw = null;
function friendTick() {
  const k = Math.random() * FRIENDS.length | 0, f = FS[k], r = Math.random();
  if (f.s === 0) Object.assign(f, r < .6 ? { s: 1, g: null } : { s: 2, g: pickGame() });
  else if (f.s === 1) Object.assign(f, r < .7 ? { s: 2, g: pickGame() } : { s: 0, g: null });
  else Object.assign(f, r < .5 ? { s: 2, g: pickGame(f.g) } : { s: r < .8 ? 1 : 0, g: null });
  if (f.s === 2 && pref.notif) pushNote({ i: f.g.e, t: FRIENDS[k].n, m: f.g.n, g: 1, gt: f.g });
  if (friendsDraw) friendsDraw();
  setTimeout(friendTick, (60 + Math.random() * 90) * 1000);
}
setTimeout(friendTick, 25000);
