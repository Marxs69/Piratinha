/* Grand Chronicle — gerador do mundo (sem DOM): continentes, oceanos e mares, lagos, relevo, biomas,
   províncias → estados → regiões → continentes, zonas de mar, recursos e nomes. O mesmo seed gera sempre o mesmo mundo. */
'use strict';

const MAP_W = 768, MAP_H = 432;
const TER_IDS = Object.keys(TERRAIN);

function mkRng(seed) {                                       // mulberry32
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[r() * a.length | 0];

function mkNoise(r) {                                        // ruído de valor 2D suave, com fbm
  const P = new Uint8Array(512), V = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = r() * (i + 1) | 0, t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const f = t => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = V[P[P[X] + Y]], b = V[P[P[X + 1] + Y]], c = V[P[P[X] + Y + 1]], d = V[P[P[X + 1] + Y + 1]], u = f(xf), v = f(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 5) => { let s = 0, amp = 1, fr = 1, tot = 0; for (let o = 0; o < oct; o++) { s += n(x * fr, y * fr) * amp; tot += amp; amp *= .5; fr *= 2.03; } return s / tot; };
}

class Heap {                                                 // fila de prioridade mínima (custo, valor)
  constructor() { this.k = []; this.v = []; }
  push(k, v) { const K = this.k, V = this.v; let i = K.length; K.push(k); V.push(v); while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= k) break; K[i] = K[p]; V[i] = V[p]; i = p; } K[i] = k; V[i] = v; }
  pop() {
    const K = this.k, V = this.v, top = V[0], k = K.pop(), v = V.pop(), n = K.length; if (!n) return top;
    let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= k) break; K[i] = K[c]; V[i] = V[c]; i = c; }
    K[i] = k; V[i] = v; this.lastK = 0; return top;
  }
  get size() { return this.k.length; }
}

function nameGen(cul, r, used) {                             // nome no estilo da cultura, sem repetir
  for (let t = 0; t < 30; t++) {
    let s = pick(r, cul.a); if (r() < .55) s += pick(r, cul.a); s += pick(r, cul.b);
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (s.length > 3 && s.length < 13 && !used.has(s)) { used.add(s); return s; }
  }
  return pick(r, cul.a).toUpperCase() + (used.size % 97);
}

function generateWorld(seed) {
  const r = mkRng(seed), W = MAP_W, H = MAP_H, N = W * H, noise = mkNoise(r), noise2 = mkNoise(r), noise3 = mkNoise(r);
  const height = new Float32Array(N), cont = new Int8Array(N).fill(-1);

  // 1. continentes: um principal grande no meio, um frio ao norte e outros espalhados sem se sobrepor
  const K = 5 + (r() * 3 | 0), C = [];
  C.push({ x: W * (.42 + r() * .16), y: H * (.5 + r() * .1), rx: W * (.17 + r() * .03), ry: H * (.24 + r() * .04), main: true });
  C.push({ x: W * (.3 + r() * .4), y: H * .1, rx: W * (.1 + r() * .04), ry: H * (.07 + r() * .02), cold: true });
  for (let t = 0; C.length < K && t < 400; t++) {
    const c = { x: W * (.08 + r() * .84), y: H * (.12 + r() * .78), rx: W * (.06 + r() * .07), ry: H * (.08 + r() * .1) };
    if (C.every(o => { const dx = (c.x - o.x) / (c.rx + o.rx), dy = (c.y - o.y) / (c.ry + o.ry); return dx * dx + dy * dy > 1.15; })) C.push(c);
  }
  C.forEach(c => { c.rot = r() * Math.PI; c.ox = r() * 99; c.oy = r() * 99; });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, wx = x + (noise2(x / 60, y / 60, 3) - .5) * 70, wy = y + (noise2(x / 60 + 40, y / 60 + 40, 3) - .5) * 70;
    let best = -9, bc = -1;
    for (let k = 0; k < C.length; k++) {
      const c = C[k], dx = wx - c.x, dy = wy - c.y, cs = Math.cos(c.rot), sn = Math.sin(c.rot);
      const u = (dx * cs + dy * sn) / c.rx, v = (-dx * sn + dy * cs) / c.ry, s = 1 - Math.sqrt(u * u + v * v);
      if (s > best) { best = s; bc = k; }
    }
    const edge = Math.min(x, W - 1 - x, y, H - 1 - y), fall = edge < 14 ? (14 - edge) / 14 : 0;
    height[i] = best * .9 + (noise(x / 48, y / 48, 6) - .5) * .75 - fall * .8;
    cont[i] = bc;
  }
  const land = new Uint8Array(N); for (let i = 0; i < N; i++) land[i] = height[i] > 0 ? 1 : 0;

  // 2. água: oceano = ligada à borda; o resto vira lago; mais alguns lagos espalhados no interior
  const water = new Uint8Array(N), nb = i => { const x = i % W, y = (i / W) | 0, o = []; if (x > 0) o.push(i - 1); if (x < W - 1) o.push(i + 1); if (y > 0) o.push(i - W); if (y < H - 1) o.push(i + W); return o; };
  const lakeBlob = (cx, cy, rad) => { for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) { if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue; const d = Math.hypot(x - cx, y - cy) + (noise3(x / 4, y / 4, 2) - .5) * 3; if (d < rad) land[y * W + x] = 0; } };
  for (let t = 0, made = 0; t < 600 && made < 28; t++) {
    const x = 20 + (r() * (W - 40) | 0), y = 20 + (r() * (H - 40) | 0), i = y * W + x;
    if (!land[i] || height[i] > .5) continue;
    let ok = true; for (let dy = -9; dy <= 9 && ok; dy += 3) for (let dx = -9; dx <= 9; dx += 3) if (!land[i + dy * W + dx]) { ok = false; break; }
    if (ok) { lakeBlob(x, y, 2 + (r() * 3.5 | 0)); made++; }
  }
  const q = []; for (let x = 0; x < W; x++) { q.push(x, (H - 1) * W + x); } for (let y = 0; y < H; y++) { q.push(y * W, y * W + W - 1); }
  q.forEach(i => { if (!land[i]) water[i] = 1; });
  for (let h = 0; h < q.length; h++) { const i = q[h]; if (water[i] !== 1) continue; for (const j of nb(i)) if (!land[j] && !water[j]) { water[j] = 1; q.push(j); } }
  for (let i = 0; i < N; i++) if (!land[i] && !water[i]) water[i] = 2;

  // 3. distância até a costa (profundidade do mar e umidade) e relevo/biomas
  const dist = new Uint8Array(N).fill(255), dq = [];
  for (let i = 0; i < N; i++) if (land[i] && nb(i).some(j => water[j] === 1)) { dist[i] = 0; dq.push(i); }
  for (let h = 0; h < dq.length; h++) { const i = dq[h]; for (const j of nb(i)) if (dist[j] === 255) { dist[j] = Math.min(254, dist[i] + 1); dq.push(j); } }
  const terr = new Uint8Array(N), shade = new Float32Array(N), temp = new Float32Array(N);
  const TI = Object.fromEntries(TER_IDS.map((t, k) => [t, k]));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!land[i]) continue;
    const h = height[i], ridge = 1 - Math.abs(noise3(x / 22, y / 22, 4) * 2 - 1), lat = Math.abs(y / H - .5) * 2;
    const t = 1 - lat * 1.2 - Math.max(0, h - .3) * .6 + (noise2(x / 80 + 9, y / 80, 2) - .5) * .25; temp[i] = t;
    const moist = noise2(x / 35 + 70, y / 35 + 70, 4) + Math.max(0, 12 - dist[i]) / 40;
    let b;
    if (lat > .9 || t < .02) b = 'ice';
    else if (h > .62 && ridge > .7 || h > .8) b = 'mountain';
    else if (h > .42 && ridge > .62) b = 'hills';
    else if (t < .2) b = moist > .55 ? 'taiga' : 'tundra';
    else if (t < .38) b = moist > .5 ? 'taiga' : moist > .4 ? 'forest' : 'plains';
    else if (t < .66) b = moist > .72 && h < .2 ? 'marsh' : moist > .54 ? 'forest' : moist > .4 ? 'plains' : 'grass';
    else b = moist < .36 ? 'desert' : moist < .48 ? 'savanna' : moist > .62 ? 'jungle' : 'grass';
    terr[i] = TI[b];
    const hx = height[Math.min(N - 1, i + 1)] - height[Math.max(0, i - 1)], hy = height[Math.min(N - 1, i + W)] - height[Math.max(0, i - W)];
    shade[i] = Math.max(-.35, Math.min(.35, (-hx - hy) * 3.2 + (b === 'mountain' ? (ridge - .5) * .5 : 0)));
  }
  const odist = new Uint8Array(N).fill(255), oq = [];   // distância do mar até a terra (profundidade)
  for (let i = 0; i < N; i++) if (water[i] === 1 && nb(i).some(j => land[j])) { odist[i] = 0; oq.push(i); }
  for (let h = 0; h < oq.length; h++) { const i = oq[h]; for (const j of nb(i)) if (water[j] === 1 && odist[j] === 255) { odist[j] = Math.min(254, odist[i] + 1); oq.push(j); } }

  // 4. províncias: sementes espaçadas na terra, crescimento por custo (relevo pesa) e fusão das muito pequenas
  const prov = new Int32Array(N).fill(-1), seeds = [], tooClose = new Uint8Array(N);
  const landCells = []; for (let i = 0; i < N; i++) if (land[i]) landCells.push(i);
  const target = Math.round(landCells.length / 30);
  for (let t = 0; t < target * 8 && seeds.length < target; t++) {
    const i = landCells[r() * landCells.length | 0]; if (tooClose[i]) continue;
    seeds.push(i); const x0 = i % W, y0 = (i / W) | 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < W && y < H && dx * dx + dy * dy <= 16) tooClose[y * W + x] = 1; }
  }
  const grow = list => {
    const hp = new Heap(), cost = new Float32Array(N).fill(1e9);
    list.forEach(([i, p]) => { prov[i] = p; cost[i] = 0; hp.push(0, i); });
    while (hp.size) {
      const i = hp.pop(), c = cost[i], p = prov[i];
      for (const j of nb(i)) {
        if (!land[j]) continue;
        const tc = TERRAIN[TER_IDS[terr[j]]].move, nc = c + tc + noise3(j % W / 6, (j / W | 0) / 6, 2) * 1.6;
        if (nc < cost[j] && (prov[j] === -1 || nc < cost[j])) { if (prov[j] !== -1 && prov[j] !== p && cost[j] < 1e9) continue; cost[j] = nc; prov[j] = p; hp.push(nc, j); }
      }
    }
  };
  grow(seeds.map((i, k) => [i, k]));
  let np = seeds.length;
  for (const i of landCells) if (prov[i] === -1) { grow([[i, np++]]); }   // ilhas sem semente
  // tamanhos e fusão das pequenas
  let size = new Int32Array(np); for (const i of landCells) size[prov[i]]++;
  for (let pass = 0; pass < 2; pass++) {
    const border = new Map();
    for (const i of landCells) { const p = prov[i]; if (size[p] >= 10) continue; for (const j of nb(i)) { const o = prov[j]; if (o >= 0 && o !== p) { const k = p * 100000 + o; border.set(k, (border.get(k) || 0) + 1); } } }
    const into = new Int32Array(np).fill(-1), bestB = new Int32Array(np);
    border.forEach((v, k) => { const p = Math.floor(k / 100000), o = k % 100000; if (v > bestB[p]) { bestB[p] = v; into[p] = o; } });
    for (const i of landCells) { const p = prov[i]; if (into[p] >= 0 && size[into[p]] >= 10) prov[i] = into[p]; }
    size = new Int32Array(np); for (const i of landCells) size[prov[i]]++;
  }
  // renumera sem buracos
  const remap = new Int32Array(np).fill(-1); let P = 0; for (let p = 0; p < np; p++) if (size[p]) remap[p] = P++;
  for (const i of landCells) prov[i] = remap[prov[i]];

  // 5. zonas de mar (mares e oceanos) por crescimento a partir de sementes no oceano
  const sea = new Int16Array(N).fill(-1), sseeds = [], oceanCells = []; for (let i = 0; i < N; i++) if (water[i] === 1) oceanCells.push(i);
  const sTarget = Math.max(40, Math.round(oceanCells.length / 1500)), sClose = new Uint8Array(N);
  for (let t = 0; t < sTarget * 10 && sseeds.length < sTarget; t++) {
    const i = oceanCells[r() * oceanCells.length | 0]; if (sClose[i]) continue; sseeds.push(i);
    const x0 = i % W, y0 = (i / W) | 0, rr = odist[i] < 12 ? 11 : 20;
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < W && y < H && dx * dx + dy * dy <= rr * rr) sClose[y * W + x] = 1; }
  }
  const sqq = []; sseeds.forEach((i, k) => { sea[i] = k; sqq.push(i); });
  for (let h = 0; h < sqq.length; h++) { const i = sqq[h]; for (const j of nb(i)) if (water[j] === 1 && sea[j] === -1) { sea[j] = sea[i]; sqq.push(j); } }
  let nz = sseeds.length; for (const i of oceanCells) if (sea[i] === -1) { const z = nz++; sea[i] = z; const qq = [i]; for (let h = 0; h < qq.length; h++) for (const j of nb(qq[h])) if (water[j] === 1 && sea[j] === -1) { sea[j] = z; qq.push(j); } }

  // 6. dados das províncias
  const provs = Array.from({ length: P }, (_, id) => ({ id, n: 0, sx: 0, sy: 0, tc: new Int32Array(TER_IDS.length), adj: new Set(), seas: new Set(), coast: false, lake: false, contV: new Int32Array(C.length), temp: 0 }));
  for (const i of landCells) {
    const p = provs[prov[i]], x = i % W, y = (i / W) | 0; p.n++; p.sx += x; p.sy += y; p.tc[terr[i]]++; p.contV[cont[i]]++; p.temp += temp[i];
    for (const j of nb(i)) { if (land[j]) { if (prov[j] !== p.id) p.adj.add(prov[j]); } else if (water[j] === 1) { p.coast = true; p.seas.add(sea[j]); } else p.lake = true; }
  }
  provs.forEach(p => {
    const mx = p.sx / p.n, my = p.sy / p.n; let bd = 1e9, bc = 0;
    p.terr = TER_IDS[p.tc.indexOf(Math.max(...p.tc))];
    p.cont = p.contV.indexOf(Math.max(...p.contV)); p.temp /= p.n;
    p.adj = [...p.adj]; p.seas = [...p.seas]; p._mx = mx; p._my = my; p._bd = bd; p._bc = bc; delete p.tc; delete p.contV; delete p.sx; delete p.sy;
  });
  for (const i of landCells) { const p = provs[prov[i]], x = i % W, y = (i / W) | 0, d = (x - p._mx) ** 2 + (y - p._my) ** 2; if (d < p._bd) { p._bd = d; p._bc = i; } }
  provs.forEach(p => { p.cx = p._bc % W; p.cy = (p._bc / W) | 0; delete p._mx; delete p._my; delete p._bd; delete p._bc; });

  const seas = Array.from({ length: nz }, (_, id) => ({ id, n: 0, sx: 0, sy: 0, adj: new Set(), provs: new Set(), deepN: 0 }));
  for (const i of oceanCells) {
    const z = seas[sea[i]], x = i % W, y = (i / W) | 0; z.n++; z.sx += x; z.sy += y; if (odist[i] > 10) z.deepN++;
    for (const j of nb(i)) { if (water[j] === 1 && sea[j] !== z.id) z.adj.add(sea[j]); else if (land[j]) z.provs.add(prov[j]); }
  }
  seas.forEach(z => { z.cx = Math.round(z.sx / z.n); z.cy = Math.round(z.sy / z.n); z.adj = [...z.adj]; z.provs = [...z.provs]; z.deep = !z.provs.length || z.deepN / z.n > .6; delete z.sx; delete z.sy; delete z.deepN; });
  seas.forEach(z => {   // ponto de ancoragem dentro da zona (o centro pode cair em terra)
    if (sea[z.cy * W + z.cx] === z.id) return; let bd = 1e9;
    for (const i of oceanCells) if (sea[i] === z.id) { const x = i % W, y = (i / W) | 0, d = (x - z.cx) ** 2 + (y - z.cy) ** 2; if (d < bd) { bd = d; z.ax = x; z.ay = y; } }
    z.cx = z.ax; z.cy = z.ay;
  });

  // 7. continentes: rótulo do continente pelo voto das províncias; principal e frio marcados
  const conts = C.map((c, id) => ({ id, main: !!c.main, cold: !!c.cold, provs: 0, cx: Math.round(c.x), cy: Math.round(c.y) }));
  provs.forEach(p => conts[p.cont].provs++);
  conts.forEach(c => { c.empty = c.provs < 6; });

  // 8. estados (~7 províncias) e regiões (~6 estados), sempre dentro do mesmo continente
  const cluster = (items, adjOf, contOf, size) => {
    const lab = new Int32Array(items).fill(-1), groups = []; const order = [...Array(items).keys()].sort(() => r() - .5);
    for (const s of order) {
      if (lab[s] !== -1) continue; const g = groups.length, mem = [s]; lab[s] = g;
      for (let h = 0; h < mem.length && mem.length < size; h++) for (const o of adjOf(mem[h])) if (lab[o] === -1 && contOf(o) === contOf(s) && mem.length < size) { lab[o] = g; mem.push(o); }
      groups.push(mem);
    }
    // grupos pequenos demais entram no vizinho
    groups.forEach((mem, g) => {
      if (mem.length > Math.max(1, size / 3)) return;
      for (const s of mem) { const o = adjOf(s).find(o => lab[o] !== g && contOf(o) === contOf(s) && groups[lab[o]].length < size * 1.6); if (o != null) { const to = lab[o]; mem.forEach(m => { lab[m] = to; groups[to].push(m); }); mem.length = 0; break; } }
    });
    const out = [], idx = new Int32Array(groups.length).fill(-1); groups.forEach((m, g) => { if (m.length) { idx[g] = out.length; out.push(m); } });
    for (let i = 0; i < items; i++) lab[i] = idx[lab[i]];
    return { lab, groups: out };
  };
  const st = cluster(P, p => provs[p].adj, p => provs[p].cont, 7);
  const states = st.groups.map((m, id) => ({ id, provs: m, cont: provs[m[0]].cont }));
  provs.forEach(p => { p.state = st.lab[p.id]; });
  const stAdj = states.map(() => new Set()); provs.forEach(p => p.adj.forEach(o => { if (provs[o].state !== p.state) stAdj[p.state].add(provs[o].state); }));
  const rg = cluster(states.length, s => [...stAdj[s]], s => states[s].cont, 6);
  const regions = rg.groups.map((m, id) => ({ id, states: m, cont: states[m[0]].cont }));
  states.forEach(s => { s.region = rg.lab[s.id]; });
  provs.forEach(p => { p.region = states[p.state].region; });

  // 9. culturas por região (núcleos por continente), recursos e nomes
  // cada partida sorteia quais povos vivem em cada continente (o frio só com famílias do frio); povos que sobram viram bolsões menores
  const ord = CULTURES.map((_, i) => i).sort(() => r() - .5), usedC = new Set();
  const take = (ok, k) => { const out = []; for (const i of ord) { if (out.length >= k) break; if (!usedC.has(i) && ok(CULTURES[i])) { out.push(i); usedC.add(i); } } return out; };
  conts.slice().sort((a, b) => (b.main - a.main) || (b.cold - a.cold)).forEach(c => { const k = Math.max(1, Math.min(c.main ? 6 : 4, 1 + Math.round(c.provs / 220)));
    c.cul = c.cold ? take(C => COLD_FAMS.includes(C.fam), 1) : take(C => !c.main || C.fam !== 'gut', k); if (!c.cul.length) c.cul = take(() => true, 1); c.culC = c.cul.map(() => null); });
  regions.forEach(g => {
    const c = conts[g.cont], p0 = provs[states[g.states[0]].provs[0]];
    if (!c.culC.every(Boolean)) { const k = c.culC.findIndex(v => !v); c.culC[k] = [p0.cx, p0.cy]; g.cul = c.cul[k]; return; }
    let bd = 1e9; c.culC.forEach(([x, y], k) => { const d = (x - p0.cx) ** 2 + (y - p0.cy) ** 2; if (d < bd) { bd = d; g.cul = c.cul[k]; } });
  });
  const used = new Set();
  provs.forEach(p => {
    p.cul = regions[p.region].cul; p.n = nameGen(CULTURES[p.cul], r, used);
    const t = p.terr, x = r();
    p.res = (t === 'hills' || t === 'mountain') ? (x < .25 ? 'iron' : x < .43 ? 'coal' : x < .49 ? 'gold' : x < .61 ? 'copper' : x < .65 ? 'uranium' : x < .68 ? 'rare' : null)
      : t === 'desert' ? (x < .14 ? 'oil' : x < .17 ? 'gold' : x < .21 ? 'uranium' : x < .24 ? 'rare' : null)
      : (t === 'tundra' || t === 'taiga') ? (x < .08 ? 'oil' : x < .2 ? 'coal' : x < .26 ? 'iron' : x < .29 ? 'uranium' : null)
      : (t === 'marsh' || t === 'jungle') ? (x < .07 ? 'oil' : x < .1 ? 'gold' : x < .13 ? 'rare' : null)
      : (x < .04 ? 'iron' : x < .06 ? 'oil' : x < .08 ? 'copper' : null);
    p.size = p.n;   // será sobrescrito abaixo pelo número de células
  });
  { const cnt = new Int32Array(P); for (const i of landCells) cnt[prov[i]]++; provs.forEach(p => { p.size = cnt[p.id]; }); }
  states.forEach(s => {
    const cap = s.provs.reduce((a, b) => provs[a].size >= provs[b].size ? a : b); s.cap = cap; s.n = provs[cap].n;
    const ps = s.provs.map(i => provs[i]), fert = ps.reduce((a, p) => a + TERRAIN[p.terr].food, 0);
    s.caps = {
      farm: Math.max(0, Math.round(fert * 1.6)), fishery: ps.filter(p => p.coast).length * 2, lumber: ps.filter(p => ['forest', 'taiga', 'jungle'].includes(p.terr)).length * 2,
      quarry: ps.filter(p => ['hills', 'mountain', 'desert'].includes(p.terr)).length + 1, iron_mine: ps.filter(p => p.res === 'iron').length * 3, coal_mine: ps.filter(p => p.res === 'coal').length * 3,
      gold_mine: ps.filter(p => p.res === 'gold').length * 2, oil_well: ps.filter(p => p.res === 'oil').length * 3,
      copper_mine: ps.filter(p => p.res === 'copper').length * 3, uranium_mine: ps.filter(p => p.res === 'uranium').length * 2, rare_mine: ps.filter(p => p.res === 'rare').length * 2,
      plantation: ps.filter(p => p.temp > .55 && TERRAIN[p.terr].food >= .7).length * 2,
    };
    s.coast = ps.some(p => p.coast);
  });
  regions.forEach(g => { g.n = nameGen(CULTURES[g.cul], r, used); });
  conts.forEach(c => { c.n = nameGen(CULTURES[c.cul[0]], r, used).replace(/[aeiou]?$/, 'ia'); });
  seas.forEach(z => { const cul = z.provs.length ? provs[z.provs[0]].cul : conts[0].cul[0]; z.n = (z.deep ? 'Oceano ' : pick(r, ['Mar de ', 'Mar de ', 'Golfo de ', 'Baía de '])) + nameGen(CULTURES[cul], r, used); });
  // lagos com nome
  const lakeId = new Int16Array(N).fill(-1), lakes = [];
  for (let i = 0; i < N; i++) if (water[i] === 2 && lakeId[i] === -1) {
    const id = lakes.length, qq = [i]; lakeId[i] = id; let sx = 0, sy = 0;
    for (let h = 0; h < qq.length; h++) { const c = qq[h]; sx += c % W; sy += (c / W) | 0; for (const j of nb(c)) if (water[j] === 2 && lakeId[j] === -1) { lakeId[j] = id; qq.push(j); } }
    const a = qq[0], adjP = nb(a).map(j => prov[j]).find(p => p >= 0);
    lakes.push({ id, n: 'Lago ' + nameGen(CULTURES[adjP != null ? provs[adjP].cul : conts[0].cul[0]], r, used), cx: Math.round(sx / qq.length), cy: Math.round(sy / qq.length), size: qq.length });
  }

  return { seed, W, H, height, land, water, terr, shade, prov, sea, odist, provs, states, regions, conts, seas, lakes, lakeId };
}
