/* Adventure: modelos de região para o editor. gen(modelo, largura, altura, semente) devolve um mapa pronto para pintar por cima.
   Cada modelo é uma função em GEN que recebe um "pincel" (grid + utilidades) e desenha; para criar outro, acrescente uma entrada. */

const GEN_INFO = {
  vazio: 'Vazio', vila: 'Vila', campo: 'Campo', floresta: 'Floresta', pantano: 'Pântano',
  cripta: 'Cripta', caverna: 'Caverna', deserto: 'Deserto', neve: 'Neve', vulcao: 'Vulcão',
};
// tipo (cidade/campo/masmorra) e bioma de cada modelo
const GEN_META = {
  vazio: ['campo', 'campo'], vila: ['cidade', 'vila'], campo: ['campo', 'campo'], floresta: ['campo', 'floresta'], pantano: ['campo', 'pantano'],
  cripta: ['masmorra', 'cripta'], caverna: ['masmorra', 'caverna'], deserto: ['campo', 'deserto'], neve: ['campo', 'neve'], vulcao: ['masmorra', 'vulcao'],
};

function genTools(w, h, seed) {
  let s = (seed >>> 0) || 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const at = (x, y) => g[y] && g[y][x], set = (x, y, c) => { if (g[y] && g[y][x] != null) g[y][x] = c; };
  const T = {
    g, w, h, rnd, ri, at, set,
    fill: c => g.forEach(r => r.fill(c)),
    rect: (x, y, ww, hh, c) => { for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) set(i, j, c); },
    blob: (cx, cy, r, c, only) => { for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) { const d = Math.hypot(i, j) + rnd() * 1.2; if (d < r && (!only || only.includes(at(cx + i, cy + j)))) set(cx + i, cy + j, c); } },
    sprinkle: (from, to, p) => g.forEach(r => r.forEach((c, i) => { if (from.includes(c) && rnd() < p) r[i] = to; })),
    border: c => { for (let i = 0; i < w; i++) { set(i, 0, c); set(i, h - 1, c); } for (let j = 0; j < h; j++) { set(0, j, c); set(w - 1, j, c); } },
    path: (pts, c, wd = 2) => { for (let k = 0; k < pts.length - 1; k++) { let [x, y] = pts[k]; const [x2, y2] = pts[k + 1]; while (x !== x2 || y !== y2) { T.rect(x, y, wd, wd, c); if (x !== x2 && (y === y2 || rnd() < .5)) x += Math.sign(x2 - x); else y += Math.sign(y2 - y); } T.rect(x, y, wd, wd, c); } },
    cave: (wall, floor, fillP, steps) => {     // autômato celular: cavernas orgânicas
      g.forEach((r, y) => r.forEach((_, x) => { r[x] = x === 0 || y === 0 || x === w - 1 || y === h - 1 || rnd() < fillP ? wall : floor; }));
      for (let k = 0; k < steps; k++) {
        const n = g.map(r => r.slice());
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { let c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (g[y + j][x + i] === wall) c++; n[y][x] = c >= 5 ? wall : floor; }
        g.forEach((r, y) => r.splice(0, w, ...n[y]));
      }
    },
    connect: (floor, wd = 2) => T.path([[3, h >> 1], [w >> 1, h >> 1], [w - 4, h >> 1]], floor, wd),   // garante passagem de lado a lado
    scatter: (n, c, on) => { for (let k = 0; k < n; k++) { const x = ri(1, w - 2), y = ri(1, h - 2); if (!on || on.includes(at(x, y))) set(x, y, c); } },
    clearCenter: (c, r = 3) => T.blob(w >> 1, h >> 1, r, c),
  };
  return T;
}

const GEN = {
  vazio(T) { T.fill('.'); T.border('T'); },
  campo(T) {
    const { w, h, ri } = T; T.fill('.'); T.sprinkle('.', ',', .15); T.sprinkle('.', 'F', .02); T.border('T');
    for (let k = 0; k < w * h / 220; k++) T.blob(ri(3, w - 4), ri(3, h - 4), ri(2, 3), 'T', '.,F');
    for (let k = 0; k < w * h / 300; k++) T.blob(ri(3, w - 4), ri(3, h - 4), ri(1, 2), '#', '.,');
    const lx = ri(w / 2, w - 8), ly = ri(6, h - 7); T.blob(lx, ly, 4, '~'); T.blob(lx, ly, 6, 's', '.,F');
    T.path([[1, h >> 1], [w >> 1, ri(4, h - 5)], [w - 2, h >> 1]], '=');
  },
  floresta(T) {
    const { w, h, ri } = T; T.fill('.'); T.sprinkle('.', 'T', .25); T.sprinkle('.', ',', .25); T.border('T');
    for (let k = 0; k < w * h / 120; k++) T.blob(ri(3, w - 4), ri(3, h - 4), ri(2, 4), 'T', '.,');
    for (let k = 0; k < 4; k++) T.blob(ri(6, w - 7), ri(6, h - 7), ri(3, 5), '.', 'T,');
    T.blob(ri(6, w - 7), ri(6, h - 7), 3, '~'); T.scatter(w * h / 150, 'Q', '.,');
    T.path([[1, h >> 1], [ri(8, w - 9), ri(5, h - 6)], [w - 2, h >> 1]], '=');
  },
  pantano(T) {
    const { w, h, ri } = T; T.fill('m'); T.sprinkle('m', 'j', .12); T.border('T');
    for (let k = 0; k < w * h / 90; k++) T.blob(ri(2, w - 3), ri(2, h - 3), ri(1, 3), 'v', 'mj');
    for (let k = 0; k < w * h / 200; k++) T.blob(ri(2, w - 3), ri(2, h - 3), ri(1, 2), 'T', 'mj');
    T.scatter(w * h / 160, 'Z', 'm');
    const before = T.g.map(r => r.slice()); T.path([[1, h >> 1], [w >> 1, ri(4, h - 5)], [w - 2, h >> 1]], '=', 2);
    T.g.forEach((r, y) => r.forEach((c, x) => { if (c === '=' && before[y][x] === 'v') r[x] = 'b'; }));   // trilha vira ponte sobre a água
  },
  vila(T) {
    const { w, h, ri } = T; T.fill('.'); T.sprinkle('.', ',', .12); T.sprinkle('.', 'F', .02); T.border('W');
    const cx = w >> 1, cy = h >> 1;
    T.path([[2, cy], [w - 3, cy]], '='); T.path([[cx, 2], [cx, h - 3]], '=');
    T.rect(cx - 5, cy - 4, 11, 9, '_'); T.rect(cx - 1, cy - 1, 3, 3, '~');
    const house = (x, y, ww, hh) => { T.rect(x, y, ww, hh - 2, 'R'); T.rect(x, y + hh - 2, ww, 2, 'H'); T.set(x + (ww >> 1), y + hh - 1, 'd'); };
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x0 = qx ? cx + 7 : 3, x1 = qx ? w - 4 : cx - 7, y0 = qy ? cy + 6 : 3, y1 = qy ? h - 4 : cy - 6;
      for (let x = x0; x + 5 <= x1; x += ri(7, 9)) { const ww = ri(5, 7), hh = ri(5, 6); if (x + ww <= x1 && y0 + hh <= y1) house(x, y0 + ri(0, Math.max(0, y1 - y0 - hh)), ww, hh); }
    }
    T.scatter(w * h / 90, 'T', '.,'); T.rect(1, cy, 1, 2, '='); T.rect(w - 2, cy, 1, 2, '=');
  },
  cripta(T) {
    const { w, h, ri } = T; T.fill('x'); const rooms = [];
    for (let k = 0; k < 40 && rooms.length < Math.max(4, w * h / 180); k++) {
      const rw = ri(6, 11), rh = ri(5, 8), x = ri(2, w - rw - 2), y = ri(2, h - rh - 2);
      if (rooms.some(r => x < r.x + r.w + 2 && x + rw + 2 > r.x && y < r.y + r.h + 2 && y + rh + 2 > r.y)) continue;
      rooms.push({ x, y, w: rw, h: rh }); T.rect(x, y, rw, rh, 'o');
      T.set(x, y, 'l'); T.set(x + rw - 1, y, 'l');
      if (T.rnd() < .5) { T.set(x + 2, y + 2, 'p'); T.set(x + rw - 3, y + rh - 3, 'p'); }
    }
    rooms.sort((a, b) => a.x - b.x);
    for (let k = 1; k < rooms.length; k++) { const a = rooms[k - 1], b = rooms[k]; T.path([[a.x + (a.w >> 1), a.y + (a.h >> 1)], [b.x + (b.w >> 1), b.y + (b.h >> 1)]], 'o'); }
    T.scatter(rooms.length * 2, 'Z', 'o');
  },
  caverna(T) { T.cave('k', 'u', .45, 5); T.connect('u'); T.scatter(T.w * T.h / 120, 'Q', 'u'); T.scatter(T.w * T.h / 200, '#', 'u'); T.scatter(T.w * T.h / 300, 'l', 'k'); },
  deserto(T) {
    const { w, h, ri } = T; T.fill('s'); T.sprinkle('s', 'D', .2); T.border('#');
    T.scatter(w * h / 60, 'K', 'sD'); for (let k = 0; k < w * h / 300; k++) T.blob(ri(3, w - 4), ri(3, h - 4), ri(1, 2), '#', 'sD');
    const ox = ri(8, w - 9), oy = ri(6, h - 7); T.blob(ox, oy, 3, '~'); T.blob(ox, oy, 5, '.', 'sD'); T.blob(ox, oy, 6, 'T', 's');
    T.blob(ox, oy, 3, '~');
  },
  neve(T) {
    const { w, h, ri } = T; T.fill('n'); T.border('P'); T.sprinkle('n', 'P', .08);
    for (let k = 0; k < w * h / 160; k++) T.blob(ri(3, w - 4), ri(3, h - 4), ri(2, 3), 'P', 'n');
    T.blob(ri(8, w - 9), ri(6, h - 7), 5, 'i'); T.scatter(w * h / 250, '#', 'n'); T.connect('n');
  },
  vulcao(T) { T.cave('k', 'u', .42, 4); T.connect('u'); for (let k = 0; k < T.w * T.h / 260; k++) T.blob(T.ri(3, T.w - 4), T.ri(3, T.h - 4), T.ri(1, 3), 'L', 'u'); T.connect('u', 2); },
};
function gen(model, w, h, seed) {
  const T = genTools(w, h, seed || Math.floor(Math.random() * 1e9));
  (GEN[model] || GEN.vazio)(T);
  const [kind, bio] = GEN_META[model] || GEN_META.vazio;
  let start = [w >> 1, h >> 1];                    // início: o ponto livre mais perto do centro
  for (let r = 0; r < Math.max(w, h); r++) { const c = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]].map(([i, j]) => [start[0] + i, start[1] + j]).find(([x, y]) => TILES[T.at(x, y)] && !TILES[T.at(x, y)].s); if (c) { start = c; break; } }
  return { map: T.g.map(r => r.join('')), kind, bio, start };
}
