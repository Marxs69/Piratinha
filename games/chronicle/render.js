/* Grand Chronicle — desenho do mapa num canvas: imagem-base do mundo (refeita quando muda dono, modo ou exploração),
   câmera com zoom e arraste, rótulos, exércitos, frotas, cercos e seleção. */
'use strict';

const K = 2;                                                 // pixels por célula na imagem-base
const R = { cv: null, cx: null, base: null, bctx: null, img: null, mode: 'pol', cam: { x: 0, y: 0, z: 1 }, dirty: true, labels: [], sel: null, selArmies: [], selFleet: null, box: null, hl: null, view: -1 };
let terrRGB = null;

function initRender(cv) {
  R.cv = cv; R.cx = cv.getContext('2d');
  R.base = document.createElement('canvas'); R.base.width = MAP_W * K; R.base.height = MAP_H * K; R.bctx = R.base.getContext('2d');
  R.img = R.bctx.createImageData(R.base.width, R.base.height);
  resize(); addEventListener('resize', resize);
}
function resize() { const d = devicePixelRatio || 1; R.cv.width = innerWidth * d; R.cv.height = innerHeight * d; R.cv.style.width = innerWidth + 'px'; R.cv.style.height = innerHeight + 'px'; R.dpr = d; R.dirty = true; }
function fitCam() { const z = Math.min(innerWidth / R.base.width, innerHeight / R.base.height) * 1.05; R.cam = { z, x: R.base.width / 2 - innerWidth / 2 / z, y: R.base.height / 2 - innerHeight / 2 / z }; R.dirty = true; }
function clampCam() {
  const c = R.cam, zmin = Math.min(innerWidth / R.base.width, innerHeight / R.base.height) * .8; c.z = clamp(c.z, zmin, 14);
  const vw = innerWidth / c.z, vh = innerHeight / c.z, m = 60;
  c.x = clamp(c.x, -m - Math.max(0, (vw - R.base.width) / 2) * 2, R.base.width - vw + m + Math.max(0, (vw - R.base.width) / 2) * 2);
  c.y = clamp(c.y, -m - Math.max(0, (vh - R.base.height) / 2) * 2, R.base.height - vh + m + Math.max(0, (vh - R.base.height) / 2) * 2);
}
const toWorld = (sx, sy) => [sx / R.cam.z + R.cam.x, sy / R.cam.z + R.cam.y];
const toScreen = (wx, wy) => [(wx - R.cam.x) * R.cam.z, (wy - R.cam.y) * R.cam.z];
function cellAt(sx, sy) { const [wx, wy] = toWorld(sx, sy), x = Math.floor(wx / K), y = Math.floor(wy / K); if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return -1; return y * MAP_W + x; }

function buildTerrain() {                                    // cores de terreno e de água, feitas uma vez por mundo
  const N = MAP_W * MAP_H; terrRGB = new Uint8ClampedArray(N * 3);
  for (let i = 0; i < N; i++) {
    let c;
    if (WD.land[i]) { const t = TERRAIN[TER_IDS[WD.terr[i]]].col, s = 1 + WD.shade[i]; c = [t[0] * s, t[1] * s, t[2] * s]; }
    else if (WD.water[i] === 2) c = [92, 150, 196];
    else { const d = Math.min(1, WD.odist[i] / 30); c = [44 - d * 22, 96 - d * 40, 150 - d * 46]; }
    terrRGB[i * 3] = c[0]; terrRGB[i * 3 + 1] = c[1]; terrRGB[i * 3 + 2] = c[2];
  }
}

/* cor de cada província no modo atual */
function provColors() {
  const P = WD.provs.length, col = new Uint8ClampedArray(P * 3), me = S.player >= 0 ? nat(S.player) : null, mode = R.mode;
  const regCol = WD.regions.map((g, k) => hsl((k * .618) % 1, .45, .55)), contCol = WD.conts.map((c, k) => c.main ? [214, 170, 80] : hsl((k * .29 + .5) % 1, .4, .5));
  let maxPop = 1; if (mode === 'pop') for (let p = 0; p < P; p++) maxPop = Math.max(maxPop, S.pop[p] / WD.provs[p].size);
  for (let p = 0; p < P; p++) {
    const o = S.own[p]; let c = null;
    if (mode === 'pol') c = o >= 0 ? nat(o).col : null;
    else if (mode === 'dip') { if (o < 0) c = null; else if (!me) c = [150, 150, 150]; else if (o === me.id) c = [70, 170, 90]; else if (atWar(me.id, o)) c = [200, 60, 60]; else if (me.truce[o] > S.t) c = [220, 150, 60]; else c = [150, 150, 150]; }
    else if (mode === 'pop') { const v = Math.pow(S.pop[p] / WD.provs[p].size / maxPop, .5); c = [40 + v * 215, 40 + v * 170, 90 - v * 60]; }
    else if (mode === 'reg') c = regCol[WD.provs[p].region].map((v, i) => v * (.85 + (WD.provs[p].state % 3) * .08));
    else if (mode === 'cont') c = contCol[WD.provs[p].cont];
    else if (mode.startsWith('svc:')) { const st = WD.provs[p].state, cv = S.scov && S.scov[st] && stateOwnerOf(st) === o ? S.scov[st][mode.slice(4)] : 0; c = o < 0 ? null : [200 - cv * 160, 70 + cv * 150, 70 + cv * 40]; }
    else if (mode === 'plague') { const P = S.plague, D = P ? P.done : (S.plagueDone || {}).done || {}; c = P && P.inf[p] != null ? [30, 70, 20] : D[p] ? [150, 150, 140] : o >= 0 ? [205, 200, 180] : null; }
    else if (mode === 'res') c = stateTone(WD.provs[p].state);   // todas as províncias do estado com a mesma cor
    else if (mode === 'cul') c = hsl(((S.culg ? S.culg[p] : WD.provs[p].cul) * .17) % 1, .45, .55);
    else if (mode === 'rel') { const R0 = RELIGIONS[REL_IDS[S.relg ? S.relg[p] : 0]]; c = R0 ? hexRGB(R0.col) : null; }
    if (c) { col[p * 3] = c[0]; col[p * 3 + 1] = c[1]; col[p * 3 + 2] = c[2]; } else { col[p * 3] = 255; col[p * 3 + 1] = 0; col[p * 3 + 2] = 255; }   // magenta = sem cor (mostra terreno)
  }
  return col;
}

const RES_COL = { iron: [120, 140, 190], coal: [40, 40, 44], gold: [250, 205, 40], oil: [70, 20, 90], copper: [214, 110, 40], uranium: [110, 235, 60], rare: [225, 70, 200] };
const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/* mapa de recursos: cada estado tem um tom próprio tirado da cor do país dono (estados vizinhos variam o tom) */
const TONES = [.62, 1.3, .82, 1.12, .7, 1.22, .94];
function stateTone(sid) {
  const o = stateOwnerOf(sid), base = o >= 0 ? nat(o).col : [196, 186, 158], k = TONES[(sid * 5 + (sid >> 3)) % TONES.length];
  return base.map(v => clamp(k >= 1 ? v + (255 - v) * (k - 1) * 1.1 : v * k, 0, 255));
}
function rebuildMap() {
  if (!terrRGB) buildTerrain();
  const W = MAP_W, H = MAP_H, BW = W * K, d = R.img.data, pc = provColors(), me = R.view >= 0 ? nat(R.view) : (S.player >= 0 ? nat(S.player) : null), terrOnly = R.mode === 'ter';
  const exP = me ? me.exP : null, exZ = me ? me.exZ : null, prov = WD.prov, sea = WD.sea, own = S.own, ctrl = S.ctrl;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = prov[i];
    let r = terrRGB[i * 3], g = terrRGB[i * 3 + 1], b = terrRGB[i * 3 + 2], fog = false;
    if (p >= 0) {
      if (exP && !exP[p]) fog = true;
      else if (!terrOnly && !(pc[p * 3] === 255 && pc[p * 3 + 1] === 0 && pc[p * 3 + 2] === 255)) {
        const lum = (r * .3 + g * .59 + b * .11) / 150, k = .78, tint = R.mode === 'pol' ? .93 + (WD.provs[p].state * 7 % 5) * .035 : 1;
        r = pc[p * 3] * (k + (1 - k) * lum) * tint; g = pc[p * 3 + 1] * (k + (1 - k) * lum) * tint; b = pc[p * 3 + 2] * (k + (1 - k) * lum) * tint;
      }
    } else if (sea[i] >= 0 && exZ && !exZ[sea[i]]) fog = true;
    else if (WD.water[i] === 2 && exP) { const nb = prov[i + 1] >= 0 ? prov[i + 1] : prov[i - 1] >= 0 ? prov[i - 1] : prov[i + W] >= 0 ? prov[i + W] : prov[i - W]; if (nb >= 0 && !exP[nb]) fog = true; }
    if (fog) { const n = ((x * 7 + y * 13) % 11) * 2; r = 196 - n; g = 178 - n; b = 136 - n; }
    // bordas: província, estado, nação e costa
    const right = x < W - 1 ? i + 1 : i, down = y < H - 1 ? i + W : i;
    let eR = 0, eD = 0;
    if (!fog) {
      const edge = j => { const q = prov[j]; if (p < 0 && q < 0) return sea[i] >= 0 && sea[j] >= 0 && sea[i] !== sea[j] && !(exZ && !exZ[sea[j]]) ? 5 : 0; if ((p < 0) !== (q < 0)) return 4; if (p === q) return 0; if (own[p] !== own[q] && R.mode !== 'ter') return 3; if (WD.provs[p].state !== WD.provs[q].state) return 2; return 1; };
      eR = edge(right); eD = edge(down);
    }
    const occ = p >= 0 && !fog && own[p] >= 0 && ctrl[p] !== own[p] && R.mode === 'pol';
    for (let dy = 0; dy < K; dy++) for (let dx = 0; dx < K; dx++) {
      const px = x * K + dx, py = y * K + dy, o = (py * BW + px) * 4;
      let R0 = r, G0 = g, B0 = b;
      if (occ && ((px + py) >> 2) % 2 === 0) { const c = ctrl[p] >= 0 ? nat(ctrl[p]).col : [170, 25, 25]; R0 = c[0]; G0 = c[1]; B0 = c[2]; }   // ocupada (cor do ocupante) ou rebelde (vermelho)
      let a = 0;
      if (dx === K - 1 && eR) a = Math.max(a, eR); if (dy === K - 1 && eD) a = Math.max(a, eD);
      if (a === 1) { R0 *= .84; G0 *= .84; B0 *= .84; } else if (a === 2) { R0 *= .45; G0 *= .45; B0 *= .45; } else if (a === 3) { R0 *= .25; G0 *= .25; B0 *= .25; } else if (a === 4) { R0 = R0 * .45; G0 = G0 * .45; B0 = B0 * .5; } else if (a === 5) { R0 = R0 * .35 + 120; G0 = G0 * .35 + 150; B0 = B0 * .35 + 180; }
      d[o] = R0; d[o + 1] = G0; d[o + 2] = B0; d[o + 3] = 255;
    }
  }
  // fronteira entre nações mais grossa: escurece também o pixel do outro lado
  if (R.mode !== 'ter') for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const i = y * W + x, p = prov[i]; if (p < 0 || (exP && !exP[p])) continue;
    let q = prov[i + 1], s = prov[i + W]; if (exP && q >= 0 && !exP[q]) q = -1; if (exP && s >= 0 && !exP[s]) s = -1;
    if (q >= 0 && own[q] !== own[p]) { const o = ((y * K) * BW + (x + 1) * K) * 4; for (let dy = 0; dy < K; dy++) { const oo = o + dy * BW * 4; d[oo] *= .35; d[oo + 1] *= .35; d[oo + 2] *= .35; } }
    if (s >= 0 && own[s] !== own[p]) { const o = (((y + 1) * K) * BW + x * K) * 4; for (let dx = 0; dx < K; dx++) { const oo = o + dx * 4; d[oo] *= .35; d[oo + 1] *= .35; d[oo + 2] *= .35; } }
  }
  R.bctx.putImageData(R.img, 0, 0);
  computeLabels(); computeLinks();
  S.mapDirty = false; R.dirty = true;
}

/* obras ligando estados vizinhos do mesmo dono: estradas, ferrovias, rodovias… e oleodutos (desenhados por cima do mapa) */
function computeLinks() {
  if (!WD.stAdj) { WD.stAdj = WD.states.map(() => new Set()); WD.provs.forEach(p => p.adj.forEach(o => { const a = p.state, b = WD.provs[o].state; if (a < b) WD.stAdj[a].add(b); })); }
  const me = S.player >= 0 ? nat(S.player) : null, tier = WD.states.map(st => { let t = 0; const B = S.bld[st.id]; for (const k in B) { const f = BUILDINGS[k].fx; if (B[k] && f && f.infra) t = Math.max(t, f.infra); } return t; });
  R.links = []; R.pipes = [];
  WD.states.forEach(a => WD.stAdj[a.id].forEach(bi => {
    const b = WD.states[bi], o = stateOwnerOf(a.id); if (o < 0 || o !== stateOwnerOf(bi)) return; if (me && (!me.exP[a.cap] || !me.exP[b.cap])) return;
    const t = Math.min(tier[a.id], tier[bi]); if (t) R.links.push([a.cap, b.cap, t]);
    if (S.bld[a.id].pipeline && S.bld[bi].pipeline) R.pipes.push([a.cap, b.cap]);
  }));
}
const LINK_STYLE = { 1: ['#8b6b3a', 1.2, [4, 3]], 2: ['#2a2a2a', 2, []], 3: ['#d9d9d9', 2.6, []], 4: ['#ffffff', 2.2, [10, 3]], 5: ['#5ff2ff', 2.4, []], 6: ['#d38cff', 2.6, [2, 2]], 7: ['#fff6b0', 3, [1, 4]] };
function computeLabels() {                                   // rótulo de cada nação no centro de massa das suas províncias
  const acc = new Map(), me = S.player >= 0 ? nat(S.player) : null;
  WD.provs.forEach(p => { const o = S.own[p.id]; if (o < 0) return; if (me && !me.exP[p.id]) return; let a = acc.get(o); if (!a) acc.set(o, a = { x: 0, y: 0, n: 0, minx: 1e9, maxx: -1e9 }); a.x += p.cx * p.size; a.y += p.cy * p.size; a.n += p.size; a.minx = Math.min(a.minx, p.cx); a.maxx = Math.max(a.maxx, p.cx); });
  R.labels = []; acc.forEach((a, o) => { const n = nat(o); R.labels.push({ o, x: a.x / a.n * K + K / 2, y: a.y / a.n * K, s: Math.sqrt(a.n), w: (a.maxx - a.minx) * K, t: n.name.toUpperCase() }); });
}

/* posição de um exército na tela (interpola entre nós durante o movimento) */
function armyXY(a) {
  const [x0, y0] = nodeXY(a.p); if (!a.path.length || !a.need) return [x0 * K + K / 2, y0 * K + K / 2];
  const [x1, y1] = nodeXY(a.path[0]), f = Math.min(1, a.prog / a.need); return [(x0 + (x1 - x0) * f) * K + K / 2, (y0 + (y1 - y0) * f) * K + K / 2];
}
function fleetXY(f) { const z = WD.seas[f.z]; if (!f.path.length) return [z.cx * K, z.cy * K]; const z2 = WD.seas[f.path[0]], k = Math.min(1, f.prog / 5); return [(z.cx + (z2.cx - z.cx) * k) * K, (z.cy + (z2.cy - z.cy) * k) * K]; }

function drawFrame() {
  const c = R.cx, d = R.dpr, z = R.cam.z;
  c.setTransform(d, 0, 0, d, 0, 0);
  c.fillStyle = '#1b2433'; c.fillRect(0, 0, innerWidth, innerHeight);
  c.imageSmoothingEnabled = z < 3;
  c.drawImage(R.base, -R.cam.x * z, -R.cam.y * z, R.base.width * z, R.base.height * z);
  if (!S) return;
  const me = S.player >= 0 ? nat(S.player) : null, P = WD.provs.length;
  const vis = (wx, wy, m = 40) => { const [sx, sy] = toScreen(wx, wy); return sx > -m && sy > -m && sx < innerWidth + m && sy < innerHeight + m; };
  // seleção de província
  if (R.sel != null && R.sel >= 0 && R.sel < P) {
    const p = WD.provs[R.sel]; const [sx, sy] = toScreen(p.cx * K + K / 2, p.cy * K + K / 2);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, Math.max(6, Math.sqrt(p.size) * K * z * .55), 0, Math.PI * 2); c.stroke();
  }
  // rótulos
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (z < 4) for (const L of R.labels) {
    const fs = clamp(L.s * K * z * .18, 0, 60); if (fs < 7) continue; if (!vis(L.x, L.y, 200)) continue;
    const [sx, sy] = toScreen(L.x, L.y); c.font = '600 ' + fs + 'px Cinzel, serif';
    c.lineWidth = Math.max(2, fs / 7); c.strokeStyle = 'rgba(20,16,10,.55)'; c.fillStyle = 'rgba(255,248,230,.92)';
    c.strokeText(L.t, sx, sy); c.fillText(L.t, sx, sy);
  }
  if (R.mode === 'res' && z >= 1.1 && z < 2.2) {   // de média distância: nome de cada estado
    c.font = '10px "Alegreya Sans", sans-serif';
    for (const st of WD.states) { const p = WD.provs[st.cap]; if (me && !me.exP[p.id]) continue; const wx = p.cx * K + K / 2, wy = p.cy * K + K / 2; if (!vis(wx, wy)) continue; const [sx, sy] = toScreen(wx, wy);
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.5)'; c.fillStyle = '#f5e9c8'; c.strokeText(st.n, sx, sy + 4); c.fillText(st.n, sx, sy + 4); }
  }
  if (z >= 2.2) {
    c.font = (z >= 4 ? 12 : 10) + 'px "Alegreya Sans", sans-serif';
    for (const p of WD.provs) {
      if (me && !me.exP[p.id]) continue; const wx = p.cx * K + K / 2, wy = p.cy * K + K / 2; if (!vis(wx, wy)) continue;
      if (z < 4 && WD.states[p.state].cap !== p.id) continue;
      const [sx, sy] = toScreen(wx, wy), stCap = WD.states[p.state].cap === p.id, t = z < 4 ? WD.states[p.state].n : p.n;
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.5)'; c.fillStyle = z < 4 ? '#f5e9c8' : '#fff'; c.strokeText(t, sx, sy + 14); c.fillText(t, sx, sy + 14);
      if (stCap) { const tw = c.measureText(t).width; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.2; c.beginPath(); c.arc(sx - tw / 2 - 7, sy + 14, 3.2, 0, Math.PI * 2); c.fill(); c.stroke(); }
    }
    c.font = 'italic 11px "Alegreya Sans", sans-serif';
    for (const zz of WD.seas) { if (me && !me.exZ[zz.id]) continue; if (!vis(zz.cx * K, zz.cy * K)) continue; const [sx, sy] = toScreen(zz.cx * K, zz.cy * K); c.fillStyle = 'rgba(200,225,255,.55)'; c.fillText(zz.n, sx, sy); }
  }
  // obras e oleodutos
  if (R.links && z >= .9) {
    const line = (a, b) => { const pa = WD.provs[a], pb = WD.provs[b]; const [x0, y0] = toScreen(pa.cx * K + K / 2, pa.cy * K + K / 2), [x1, y1] = toScreen(pb.cx * K + K / 2, pb.cy * K + K / 2); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    c.lineCap = 'round';
    for (const [a, b, t] of R.links) { const [col, w, dash] = LINK_STYLE[t]; c.strokeStyle = col; c.lineWidth = w * Math.min(1.6, z / 1.5); c.setLineDash(dash); line(a, b); if (t === 2) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.setLineDash([2, 5]); line(a, b); } }
    c.strokeStyle = 'rgba(255,140,0,.85)'; c.lineWidth = 1.6; c.setLineDash([7, 4]); for (const [a, b] of R.pipes) line(a, b);
    c.setLineDash([]);
  }
  // capitais dos países: estrela amarela
  if (z >= .7) for (const n of S.nations) {
    if (!n.alive || n.capital < 0 || (me && !me.exP[n.capital])) continue; const p = WD.provs[n.capital], wx = p.cx * K + K / 2, wy = p.cy * K + K / 2; if (!vis(wx, wy)) continue;
    const [sx, sy] = toScreen(wx, wy), r = clamp(3 + z * 1.6, 4, 9), yy = sy + (z >= 2.2 ? 27 : 0);
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; c.lineTo(sx + Math.cos(a) * rr, yy + Math.sin(a) * rr); } c.closePath();
    c.fillStyle = S.ctrl[n.capital] === n.id ? '#ffd23f' : '#a33'; c.strokeStyle = 'rgba(0,0,0,.75)'; c.lineWidth = 1.2; c.fill(); c.stroke();
  }
  // cercos
  for (const k in S.sieges) {
    const p = WD.provs[k], sg = S.sieges[k]; if (me && !me.exP[p.id]) continue; const [sx, sy] = toScreen(p.cx * K + K / 2, p.cy * K - 10);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(sx - 14, sy - 3, 28, 6); c.fillStyle = '#ffcf4a'; c.fillRect(sx - 13, sy - 2, 26 * Math.min(1, sg.v), 4);
  }
  // frotas
  const far = z < 1.3;                                       // de longe só aparecem as suas tropas
  for (const f of S.fleets) {
    if (!me || (f.o !== me.id && (far || !me.exZ[f.z]))) continue; const [wx, wy] = fleetXY(f); if (!vis(wx, wy)) continue;
    const [sx, sy] = toScreen(wx, wy), mine = me && f.o === me.id;
    c.fillStyle = mine ? 'rgba(20,40,70,.9)' : 'rgba(40,30,30,.85)'; c.strokeStyle = R.selFleet === f ? '#ffd257' : mine ? '#9fd0ff' : '#ccc'; c.lineWidth = R.selFleet === f ? 2 : 1;
    rr(c, sx - 16, sy - 9, 40, 18, 4); c.fill(); c.stroke();
    const im = flagImg(nat(f.o).flag); if (im.complete) c.drawImage(im, sx - 14, sy - 6, 15, 10);
    c.fillStyle = '#fff'; c.font = '11px "Alegreya Sans", sans-serif'; c.textAlign = 'left'; c.fillText('⛵' + Math.ceil(f.ships), sx + 2, sy + 1); c.textAlign = 'center';
    if (mine && f.path.length) { c.strokeStyle = 'rgba(159,208,255,.6)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(sx, sy); f.path.forEach(zz => { const q = WD.seas[zz]; const [a, b] = toScreen(q.cx * K, q.cy * K); c.lineTo(a, b); }); c.stroke(); c.setLineDash([]); }
  }
  // exércitos (agrupados por província)
  const slot = new Map();
  for (const a of S.armies) {
    if (!me || (a.o !== me.id && (far || !(a.p < P ? me.exP[a.p] : me.exZ[a.p - P])))) continue;
    const [wx, wy] = armyXY(a); if (!vis(wx, wy)) continue;
    const k = Math.round(wx) + ',' + Math.round(wy), i = slot.get(k) || 0; slot.set(k, i + 1);
    let [sx, sy] = toScreen(wx, wy); sy -= 4 + i * 20;
    const mine = me && a.o === me.id, war = me && atWar(me.id, a.o), sel = R.selArmies.includes(a), ally = me && has(me, 'allies', a.o);
    if (mine && a.path.length) { c.strokeStyle = 'rgba(255,240,200,.7)'; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(sx, sy); a.path.forEach(v => { const [x, y] = nodeXY(v); const [a2, b2] = toScreen(x * K + K / 2, y * K + K / 2); c.lineTo(a2, b2); }); c.stroke(); c.setLineDash([]); }
    c.fillStyle = war ? 'rgba(110,20,20,.92)' : mine ? 'rgba(26,36,24,.92)' : ally ? 'rgba(20,34,60,.9)' : 'rgba(30,30,30,.85)'; c.strokeStyle = sel ? '#ffd257' : mine ? '#cfe8a0' : war ? '#ff8080' : ally ? '#8ec5ff' : '#999'; c.lineWidth = sel ? 2.2 : 1;
    rr(c, sx - 20, sy - 9, 46, 18, 4); c.fill(); c.stroke();
    const im = flagImg(nat(a.o).flag); if (im.complete) c.drawImage(im, sx - 18, sy - 6, 15, 10);
    c.fillStyle = '#fff'; c.font = '600 11px "Alegreya Sans", sans-serif'; c.textAlign = 'left'; c.fillText(fmtK(regs(a)), sx, sy + 1); c.textAlign = 'center';
    c.fillStyle = '#333'; c.fillRect(sx - 18, sy + 6, 40, 2); c.fillStyle = '#7fe08a'; c.fillRect(sx - 18, sy + 6, 40 * a.mor, 2);
    if (a.exp || a.gen) { c.font = '10px serif'; c.textAlign = 'left'; c.fillText(a.exp ? '🧭' : '★', sx + 27, sy + 1); c.textAlign = 'center'; }
  }
  // batalhas
  const bt = new Set(); for (const a of S.armies) if (a.inBattle && a.p < P) bt.add(a.p);
  bt.forEach(p => { const q = WD.provs[p]; const [sx, sy] = toScreen(q.cx * K + K / 2, q.cy * K + K / 2); c.font = '18px serif'; c.fillText('⚔️', sx + 30, sy - 4); });
  if (R.box) { const b = R.box; c.fillStyle = 'rgba(255,210,87,.12)'; c.strokeStyle = '#ffd257'; c.lineWidth = 1; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
}
/* minimapa: o mundo inteiro, o retângulo da câmera e as tropas como pontos */
function drawMini(mc) {
  const c = mc.getContext('2d'), w = mc.width, h = mc.height, sx = w / R.base.width, sy = h / R.base.height, me = S.player >= 0 ? nat(S.player) : null, P = WD.provs.length;
  c.imageSmoothingEnabled = true; c.drawImage(R.base, 0, 0, w, h);
  const dot = (wx, wy, col, r) => { c.fillStyle = col; c.fillRect(wx * sx - r, wy * sy - r, r * 2, r * 2); };
  for (const f of S.fleets) { if (!me || (f.o !== me.id && !me.exZ[f.z])) continue; const [x, y] = fleetXY(f); dot(x, y, f.o === me.id ? '#8ec5ff' : atWar(me.id, f.o) ? '#ff6b6b' : '#ccc', 1.5); }
  for (const a of S.armies) {
    if (!me) continue; const mine = a.o === me.id, war = atWar(me.id, a.o), ally = has(me, 'allies', a.o);
    if (!mine && !war && !ally) continue; if (!mine && !(a.p < P ? me.exP[a.p] : me.exZ[a.p - P])) continue;
    const [x, y] = armyXY(a); dot(x, y, '#000', 2.6); dot(x, y, mine ? '#9cff7a' : war ? '#ff4d4d' : '#6fb4ff', 1.8);
  }
  const [x0, y0] = toWorld(0, 0), [x1, y1] = toWorld(innerWidth, innerHeight);
  c.strokeStyle = '#ffd257'; c.lineWidth = 1.5; c.strokeRect(x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy);
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const fmtK = v => v >= 100 ? Math.round(v) + 'k' : (Math.round(v * 10) / 10) + 'k';

/* clique: exército/frota sob o cursor (em coordenadas de tela) */
function unitAt(sx, sy) {
  const me = S.player >= 0 ? nat(S.player) : null, P = WD.provs.length, slot = new Map(); let hit = null;
  for (const a of S.armies) {
    if (me && a.o !== me.id && !(a.p < P ? me.exP[a.p] : me.exZ[a.p - P])) continue;
    const [wx, wy] = armyXY(a), k = Math.round(wx) + ',' + Math.round(wy), i = slot.get(k) || 0; slot.set(k, i + 1);
    let [x, y] = toScreen(wx, wy); y -= 4 + i * 20; if (sx >= x - 20 && sx <= x + 26 && sy >= y - 9 && sy <= y + 9) hit = { a };
  }
  if (hit) return hit;
  for (const f of S.fleets) { if (me && f.o !== me.id && !me.exZ[f.z]) continue; const [wx, wy] = fleetXY(f), [x, y] = toScreen(wx, wy); if (sx >= x - 16 && sx <= x + 24 && sy >= y - 9 && sy <= y + 9) return { f }; }
  return null;
}
