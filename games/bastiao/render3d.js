/* Bastião: renderizador 3D no estilo 32 bits (PS1), em WebGL puro e sem texturas.
   Tudo é polígono de cor chapada montado por código: caixas, prismas e vigas. O visual vem de quatro truques:
   resolução interna baixa ampliada sem filtro, vértices grudados na grade de pixels (o "tremor" do PS1),
   cor de 15 bits com pontilhado e neblina ao longe.

   UNIDADES: 1 = distância entre duas casas vizinhas. x cresce para o leste, z para o sul (na direção da câmera), y é a altura.
   MODELOS: cada peça é uma função que desenha num MB (montador de malha), com os pés na origem e a frente virada para +z.
   Para trocar uma peça, edite a função dela em DEFS; o jogo só conhece o nome do modelo.
   O jogo usa apenas o objeto R3D (no fim do arquivo). */

const C = {
  wood: '#a36b36', woodL: '#d9a566', woodD: '#6b3f1d', log: '#84552c', stone: '#aaa39b', stoneL: '#c6c0b8', stoneD: '#7c766f',
  dark: '#5b6272', steel: '#c0c8d4', iron: '#3b3f4a', leaf: '#4f9e3a', leafL: '#6dbb4a', pine: '#3a7a4c', pineD: '#2a5e3c',
  red: '#d93a3a', blue: '#4a8fe0', gold: '#e3a92f', thatch: '#d6b24e', soil: '#6b4a2f', crop: '#8fd45e', wheat: '#d9c24a',
  skin: '#e8b88a', tunic: '#9a7e56', boot: '#3a3040', zomb: '#86b85a', rag: '#77634a', purple: '#9a5ad6', purpleL: '#c6a2ee',
  orange: '#f0803a', brute: '#557244', black: '#1a1720', eye: '#ff3030', glow: '#ffe9a0', ore: '#f0a24a', snow: '#f4f6fa', white: '#ffffff',
};
const WALL_C = [[C.woodL, C.wood], [C.log, C.woodD], [C.stoneL, C.stone]];   // paliçada · troncos · pedra: [topo, corpo]
const TIER_C = [C.blue, C.steel, C.gold];                                     // T1 · T2 · T3
const RGB = {};
const rgb = h => RGB[h] || (RGB[h] = [1, 3, 5].map(k => parseInt(h.substr(k, 2), 16) / 255));

/* ======================= Montador de malha ======================= */
// Vértice = posição (3) + normal (3) + cor (3). Sem índice: cada face tem a própria normal (sombreamento chapado).
class MB {
  constructor() { this.d = []; this.st = [[0, 0, 0, 0, 1]]; }
  at(x, y, z, yaw, s, fn) {                              // desenha fn() deslocado, girado em y e escalado
    const t = this.st[this.st.length - 1], o = this.P([x, y, z]);
    this.st.push([o[0], o[1], o[2], t[3] + yaw, t[4] * s]); fn(); this.st.pop(); return this;
  }
  P(p) { const [ox, oy, oz, a, k] = this.st[this.st.length - 1], c = Math.cos(a), s = Math.sin(a), x = p[0] * k, z = p[2] * k; return [ox + x * c + z * s, oy + p[1] * k, oz - x * s + z * c]; }
  tri(a, b, c, col, ref, cb, cc) {                       // ref = ponto de dentro do sólido: a normal aponta para fora dele
    a = this.P(a); b = this.P(b); c = this.P(c);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    if (ref) { ref = this.P(ref); if (nx * (a[0] - ref[0]) + ny * (a[1] - ref[1]) + nz * (a[2] - ref[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; } }
    else if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const ca = rgb(col); cb = cb ? rgb(cb) : ca; cc = cc ? rgb(cc) : ca;
    this.d.push(a[0], a[1], a[2], nx, ny, nz, ca[0], ca[1], ca[2], b[0], b[1], b[2], nx, ny, nz, cb[0], cb[1], cb[2], c[0], c[1], c[2], nx, ny, nz, cc[0], cc[1], cc[2]);
    return this;
  }
  quad(a, b, c, d, col, ref) { return this.tri(a, b, c, col, ref).tri(a, c, d, col, ref); }
  box(x, y, z, w, h, d, col, top) {                      // centrada em (x, z), de y até y + h
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h, r = [x, y + h / 2, z];
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top || col, r);
    this.quad([x0, y, z1], [x1, y, z1], [x1, y1, z1], [x0, y1, z1], col, r).quad([x0, y, z0], [x1, y, z0], [x1, y1, z0], [x0, y1, z0], col, r);
    this.quad([x0, y, z0], [x0, y, z1], [x0, y1, z1], [x0, y1, z0], col, r).quad([x1, y, z0], [x1, y, z1], [x1, y1, z1], [x1, y1, z0], col, r);
    return this;
  }
  prism(x, y, z, r, h, n, col, r2 = r, rot = 0, top) {   // tronco de n lados: r2 = raio do topo (0 = cone ou pirâmide)
    const ref = [x, y + h / 2, z], pt = (k, rr, yy) => { const a = rot + k / n * Math.PI * 2; return [x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr]; };
    for (let k = 0; k < n; k++) {
      if (r2 > 0) { this.quad(pt(k, r, y), pt(k + 1, r, y), pt(k + 1, r2, y + h), pt(k, r2, y + h), col, ref); this.tri([x, y + h, z], pt(k, r2, y + h), pt(k + 1, r2, y + h), top || col, ref); }
      else this.tri(pt(k, r, y), pt(k + 1, r, y), [x, y + h, z], col, ref);
    }
    return this;
  }
  beam(a, b, t, col, t2 = t) {                           // caixa ao longo do segmento a→b (para vigas inclinadas)
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    let ux = Math.abs(dy) > .95 ? 1 : -dz, uy = 0, uz = Math.abs(dy) > .95 ? 0 : dx; const ul = Math.hypot(ux, uz); ux /= ul; uz /= ul;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux, ref = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const c = (p, s, q) => [p[0] + ux * s * t / 2 + vx * q * t2 / 2, p[1] + uy * s * t / 2 + vy * q * t2 / 2, p[2] + uz * s * t / 2 + vz * q * t2 / 2];
    for (const [s, q, s2, q2] of [[1, 1, 1, -1], [-1, 1, -1, -1], [1, 1, -1, 1], [1, -1, -1, -1]]) this.quad(c(a, s, q), c(a, s2, q2), c(b, s2, q2), c(b, s, q), col, ref);
    this.quad(c(a, 1, 1), c(a, 1, -1), c(a, -1, -1), c(a, -1, 1), col, ref).quad(c(b, 1, 1), c(b, 1, -1), c(b, -1, -1), c(b, -1, 1), col, ref);
    return this;
  }
}

/* ======================= Modelos ======================= */
const flag = (m, x, y, z, h, col) => m.box(x, y, z, .025, h, .025, C.woodD).box(x + .08, y + h - .1, z, .15, .09, .015, col);
const pine = (m, x, z, s) => m.at(x, 0, z, 0, s, () => m.prism(0, 0, 0, .04, .14, 4, C.woodD).prism(0, .12, 0, .2, .3, 5, C.pine, 0).prism(0, .3, 0, .15, .28, 5, C.pineD, 0, .6));
const leafy = (m, x, z, s) => m.at(x, 0, z, 0, s, () => m.prism(0, 0, 0, .04, .2, 4, C.woodD).prism(0, .16, 0, .12, .16, 5, C.leaf, .2).prism(0, .32, 0, .2, .18, 5, C.leafL, 0, .5));
const peak = (m, x, z, r, h, snow, rot = 0) => { m.prism(x, 0, z, r, h, 5, C.stone, 0, rot); if (snow) m.prism(x, h * .66, z, r * .36, h * .36, 5, C.snow, 0, rot); return m; };
function person(m, o) {                                  // boneco de caixas: pés na origem, 0,5 de altura, olhando para +z
  const w = o.w || 1, sk = o.skin || C.skin;
  m.box(-.055 * w, 0, 0, .07, .16, .08, o.legs || C.boot).box(.055 * w, 0, 0, .07, .16, .08, o.legs || C.boot);
  m.box(0, .16, 0, .2 * w, .18, .12 * w, o.body).box(0, .16, 0, .21 * w, .03, .13 * w, o.belt || C.woodD);
  m.box(0, .34, 0, .15, .15, .15, sk);
  for (const s of [-1, 1]) m.box(s * .035, .41, .076, .03, .03, .01, o.eye || C.black);
  if (o.reach) for (const s of [-1, 1]) m.box(s * .13 * w, .25, .09, .06, .06, .22, o.arm || sk);     // braços esticados (zumbi)
  else for (const s of [-1, 1]) m.box(s * .13 * w, .17, 0, .06, .16, .07, o.arm || o.body);
  return m;
}
const helmet = (m, t) => { m.box(0, .46, 0, .17, .06, .17, C.steel); if (t) m.box(0, .52, 0, .04, .06, .1, t === 2 ? C.red : C.blue); };
function wallArm(m, t) {                                 // meio lance de muro: do centro da casa até a divisa, ao longo de +z
  const [top, body] = WALL_C[t];
  if (t === 0) for (let k = 0; k < 4; k++) m.prism(0, 0, .07 + k * .125, .075, .46 + (k & 1) * .05, 4, body, .03, Math.PI / 4, top);
  else if (t === 1) m.box(0, 0, .25, .2, .44, .5, body, top).box(0, .14, .25, .22, .03, .5, C.woodD).box(0, .3, .25, .22, .03, .5, C.woodD);
  else { m.box(0, 0, .25, .24, .46, .5, body, top); for (const z of [.1, .4]) for (const x of [-.09, .09]) m.box(x, .46, z, .07, .08, .12, top); }
}
function wallPost(m, t) {
  const [top, body] = WALL_C[t];
  if (t === 0) m.prism(0, 0, 0, .12, .5, 6, body).prism(0, .5, 0, .12, .14, 6, top, 0);
  else if (t === 1) m.prism(0, 0, 0, .14, .5, 6, body).prism(0, .5, 0, .17, .06, 6, top);
  else { m.prism(0, 0, 0, .16, .52, 6, body).prism(0, .52, 0, .2, .07, 6, top); for (let k = 0; k < 3; k++) m.box(Math.cos(k * 2.1) * .13, .59, Math.sin(k * 2.1) * .13, .08, .07, .08, top); }
}
function castle(m, bk, wk) {                             // bk = nível do quartel · wk = nível da oficina (alas que crescem com as ampliações)
  m.box(0, 0, 0, .8, .62, .7, C.stone, C.stoneL);
  for (const x of [-.32, -.11, .11, .32]) m.box(x, .62, .31, .1, .09, .08, C.stoneL).box(x, .62, -.31, .1, .09, .08, C.stoneL);
  m.box(0, 0, .355, .2, .34, .02, C.woodD).box(0, .34, .355, .24, .04, .02, C.stoneD);                // portão
  for (const [x, z] of [[-.4, .34], [.4, .34], [0, -.38]]) m.prism(x, 0, z, .13, 1.05, 6, C.stone).prism(x, 1.05, z, .17, .06, 6, C.stoneL).prism(x, 1.11, z, .17, .3, 6, C.red, 0);
  m.box(0, .62, -.02, .4, .78, .4, C.stoneL).prism(0, 1.4, -.02, .34, .38, 4, C.red, 0, Math.PI / 4);   // torre de menagem
  for (const x of [-.1, .1]) m.box(x, 1.02, .185, .05, .12, .01, C.black);
  flag(m, 0, 1.76, -.02, .3, C.gold);
  if (bk) {                                              // quartel: ala oeste com estandartes; nível 2 ganha torre de vigia
    m.box(-.56, 0, -.05, .3, .4, .5, C.stoneD, C.stone).box(-.56, .4, -.05, .34, .05, .54, C.red);
    for (const z of [-.2, .1]) m.box(-.715, .12, z, .01, .2, .1, C.red);
    if (bk > 1) { m.prism(-.6, 0, -.36, .12, .95, 6, C.stoneD).prism(-.6, .95, -.36, .16, .26, 6, C.blue, 0); flag(m, -.6, 1.2, -.36, .26, C.red); }
  }
  if (wk) {                                              // oficina: ala leste com chaminé; nível 2 ganha forja maior
    m.box(.56, 0, -.05, .3, .36, .5, C.wood, C.woodL).prism(.56, .36, -.05, .34, .2, 4, C.dark, 0, Math.PI / 4);
    m.box(.64, .3, -.22, .09, .42, .09, C.stoneD).box(.715, .08, .05, .01, .16, .14, C.black);
    if (wk > 1) m.box(.6, 0, .3, .24, .26, .2, C.stoneD, C.iron).box(.6, .26, .3, .1, .5, .1, C.stoneD).box(.6, .76, .3, .13, .04, .13, C.iron);
  }
}
const DEFS = {
  tile: m => m.prism(0, -.3, 0, .577, .3, 6, '#7d5a3a', .577, Math.PI / 6, '#5fa648'),
  oct: m => { for (const y of [1, -1]) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, b = a + Math.PI / 2; m.tri([Math.cos(a), 0, Math.sin(a)], [Math.cos(b), 0, Math.sin(b)], [0, y, 0], C.white, [0, 0, 0]); } },
  cube: m => m.box(0, -.5, 0, 1, 1, 1, C.white),
  arrow: m => m.box(0, -.012, 0, .025, .025, .3, '#f4e9c8').box(0, -.02, .15, .04, .04, .05, C.steel),
  forest0: m => { pine(m, -.2, -.12, 1); leafy(m, .2, -.05, 1.05); pine(m, 0, .22, .85); },
  forest1: m => { pine(m, .05, -.2, 1.1); pine(m, -.24, .1, .9); leafy(m, .22, .16, .95); },
  forest2: m => { leafy(m, -.18, -.08, 1.1); pine(m, .2, -.16, 1); leafy(m, .04, .24, .85); },
  rock0: m => { peak(m, -.12, .06, .3, .62, 0, .4); peak(m, .14, -.06, .36, 1, 1); },
  rock1: m => { peak(m, .12, .1, .3, .7, 0, 1); peak(m, -.1, -.08, .38, 1.15, 1, .5); },
  ore: m => { peak(m, 0, 0, .4, .5, 0, .3); for (const [x, y, z] of [[-.14, .1, .2], [.1, .2, .16], [.2, .06, .1], [-.02, .3, .08], [-.24, .04, -.02]]) m.box(x, y, z, .07, .07, .07, C.ore, C.glow); },
  site: m => {
    for (const [x, z] of [[-.3, -.25], [.3, -.25], [-.3, .25], [.3, .25]]) m.box(x, 0, z, .04, .55, .04, C.wood);
    for (const y of [.2, .45]) m.box(0, y, .25, .64, .04, .04, C.woodL).box(0, y, -.25, .64, .04, .04, C.woodL).box(-.3, y, 0, .04, .04, .5, C.woodL).box(.3, y, 0, .04, .04, .5, C.woodL);
    m.beam([-.3, .02, .25], [.3, .45, .25], .03, C.woodD).box(-.05, 0, 0, .18, .12, .16, C.stone, C.stoneL).box(.14, 0, -.08, .14, .07, .22, C.wood);
  },
  farm: m => {
    m.prism(0, 0, 0, .5, .03, 6, C.soil, .5, Math.PI / 6);
    for (let k = 0; k < 5; k++) m.box(-.06, .03, -.3 + k * .15, .5 - Math.abs(k - 2) * .09, .05, .06, k & 1 ? C.wheat : C.crop);
    m.box(.3, 0, -.02, .2, .18, .2, C.wood).prism(.3, .18, -.02, .2, .16, 4, C.thatch, 0, Math.PI / 4);
  },
  sawmill: m => {
    m.box(-.12, 0, -.06, .42, .28, .4, C.wood, C.woodL).box(-.12, .28, -.06, .5, .04, .48, C.pineD).prism(-.12, .32, -.06, .3, .2, 4, C.pine, 0, Math.PI / 4).box(-.12, 0, .145, .12, .2, .01, C.woodD);
    for (const [y, z] of [[0, .24], [0, .32], [.07, .28]]) m.beam([.12, y + .04, z], [.42, y + .04, z], .075, C.log);
    m.prism(.3, .02, -.2, .14, .03, 8, C.steel).box(.3, 0, -.2, .05, .06, .05, C.woodD);
  },
  quarry: m => {
    m.box(-.2, 0, .12, .28, .2, .26, C.stone, C.stoneL).box(.14, 0, .18, .26, .15, .22, C.stoneD, C.stone).box(-.04, 0, -.16, .3, .28, .26, C.stone, C.stoneL).box(-.12, .2, .1, .16, .12, .16, C.stoneL);
    m.box(.32, 0, -.2, .05, .8, .05, C.wood).beam([.32, .78, -.2], [-.05, .62, -.02], .04, C.woodD).box(-.05, .42, -.02, .01, .2, .01, C.black).box(-.05, .34, -.02, .1, .08, .1, C.stoneL);
  },
  mine: m => {
    peak(m, 0, -.08, .46, .78, 0, .3);
    m.box(0, 0, .24, .3, .3, .1, C.black).box(-.15, 0, .28, .04, .32, .06, C.wood).box(.15, 0, .28, .04, .32, .06, C.wood).box(0, .3, .28, .38, .05, .08, C.woodL);
    m.box(.3, 0, .32, .16, .1, .12, C.wood).box(.3, .1, .32, .12, .05, .09, C.ore);
  },
  market: m => {                                         // barraca de toldo listrado, balcão com mercadorias, caixote e barril
    m.box(0, 0, 0, .66, .04, .52, C.woodD);
    for (const x of [-.29, .29]) for (const z of [-.22, .22]) m.box(x, 0, z, .04, .46, .04, C.wood);
    for (let k = 0; k < 4; k++) m.box(-.24 + k * .16, .46 - .02 * (k & 1), 0, .16, .04, .58, k & 1 ? C.red : C.glow);
    m.box(0, .04, .14, .52, .17, .14, C.woodL).box(-.16, .21, .14, .1, .07, .1, C.ore).box(.02, .21, .14, .1, .06, .1, C.crop).box(.18, .21, .14, .08, .08, .08, C.stoneL);
    m.box(.4, 0, -.12, .15, .15, .15, C.wood, C.woodL).prism(-.42, 0, .08, .08, .18, 6, C.log, .08, 0, C.woodD).box(0, .5, .3, .12, .12, .02, C.gold);
  },
  cannon: m => {
    m.beam([0, .14, -.14], [0, .17, .24], .11, C.iron).beam([0, .17, .24], [0, .172, .27], .13, C.black).box(0, .04, -.02, .16, .06, .26, C.wood);
    for (const s of [-1, 1]) m.box(s * .11, 0, 0, .04, .18, .18, C.woodD);
  },
  catapult: m => {
    for (const s of [-1, 1]) { m.box(s * .14, .05, 0, .05, .05, .5, C.wood); m.box(s * .17, 0, -.18, .04, .12, .12, C.woodD).box(s * .17, 0, .18, .04, .12, .12, C.woodD); m.box(s * .14, .1, .05, .05, .26, .05, C.woodL); }
    m.box(0, .32, .05, .32, .04, .05, C.woodD).beam([0, .12, .16], [0, .5, -.22], .045, C.woodL).box(0, .47, -.25, .13, .05, .13, C.woodD).box(0, .52, -.25, .08, .07, .08, C.stone);
  },
  treb: m => {
    for (const s of [-1, 1]) { m.box(s * .2, 0, 0, .05, .05, .7, C.wood); m.beam([s * .2, .04, -.26], [s * .1, .72, 0], .045, C.wood).beam([s * .2, .04, .26], [s * .1, .72, 0], .045, C.woodD); }
    m.box(0, .7, 0, .26, .05, .05, C.woodD).beam([0, .5, .26], [0, 1.1, -.5], .05, C.woodL).box(0, .3, .28, .2, .22, .18, C.stone, C.stoneL).box(0, .82, -.5, .01, .28, .01, C.glow).box(0, .76, -.5, .09, .08, .09, C.stoneD);
  },
  villager: m => { person(m, { body: C.tunic, legs: '#4a3a2a' }); m.box(0, .47, 0, .26, .025, .26, C.thatch).box(0, .49, 0, .14, .06, .14, C.thatch).box(.17, .05, .05, .025, .46, .025, C.wood).box(.17, .47, .08, .09, .04, .03, C.steel); },
  z_normal: m => person(m, { body: C.rag, skin: C.zomb, eye: C.eye, legs: '#2c2a33', reach: 1 }),
  z_runner: m => m.at(0, 0, 0, 0, .95, () => { person(m, { body: C.thatch, skin: '#a8b85a', eye: C.eye, legs: '#2c2a33', reach: 1, w: .8 }); }),
  z_jumper: m => { person(m, { body: C.purple, skin: C.purpleL, eye: '#ffe14a', legs: C.purple, reach: 1, w: 1.25 }); m.box(0, .49, -.02, .05, .05, .16, C.purple); },
  z_boomer: m => { person(m, { body: C.orange, skin: C.zomb, eye: C.eye, legs: '#2c2a33', w: .9 }); m.prism(0, .13, 0, .2, .24, 6, C.orange, .15, 0, '#ffb060'); for (const [x, y, z] of [[.1, .22, .16], [-.12, .28, .13], [0, .18, .19], [.17, .26, -.04], [-.16, .2, -.08]]) m.box(x, y, z, .04, .04, .04, '#fff2a0'); },
  z_brute: m => m.at(0, 0, 0, 0, 1.55, () => { person(m, { body: C.brute, skin: C.zomb, eye: C.eye, legs: '#2c2a33', arm: C.brute, w: 1.35 }); m.box(0, .3, -.05, .34, .07, .16, C.brute); }),
};
for (const t of [0, 1, 2]) {
  DEFS['arm' + t] = m => wallArm(m, t);
  DEFS['post' + t] = m => wallPost(m, t);
  DEFS['wallicon' + t] = m => { wallPost(m, t); m.at(0, 0, 0, Math.PI / 2, 1, () => wallArm(m, t)).at(0, 0, 0, -Math.PI / 2, 1, () => wallArm(m, t)); };
  DEFS['gate' + t] = m => {                              // o vão corre ao longo de x; portas viradas para ±z
    const [top, body] = WALL_C[t];
    for (const s of [-1, 1]) m.box(s * .36, 0, 0, .28, .62, .3, body, top).box(s * .36, .62, 0, .12, .08, .3, top);
    m.box(0, .44, 0, .46, .18, .26, body, top).box(0, 0, 0, .44, .44, .06, C.woodD).box(0, .2, 0, .46, .04, .08, C.iron);
  };
  DEFS['tower' + t] = m => {
    const s = t === 2 ? C.dark : C.stone, s2 = t === 2 ? '#7d8597' : C.stoneL;
    m.prism(0, 0, 0, .26, 1, 8, s, .22).prism(0, 1, 0, .32, .1, 8, s2);
    for (let k = 0; k < 4; k++) m.box(Math.cos(k * Math.PI / 2 + .4) * .26, 1.1, Math.sin(k * Math.PI / 2 + .4) * .26, .11, .1, .11, s2);
    if (t) m.prism(0, .6, 0, .25, .06, 8, t === 2 ? C.red : C.blue, .245);
    m.box(0, .5, .245, .04, .14, .01, C.black).at(0, 1.1, 0, 0, .7, () => { person(m, { body: C.leaf }); m.box(0, .46, 0, .17, .05, .17, C.pineD); });
  };
  DEFS['house' + t] = m => {
    const w = t ? C.stoneL : C.woodL, k = 1 + t * .08;
    m.box(0, 0, 0, .52 * k, .3 + t * .06, .46 * k, w).prism(0, .3 + t * .06, 0, .44 * k, .3 + t * .04, 4, [C.thatch, C.red, C.blue][t], 0, Math.PI / 4);
    m.box(-.1, 0, .23 * k, .1, .2, .01, C.woodD).box(.12, .14, .23 * k, .09, .09, .01, C.glow);
    if (t === 2) m.box(.16, .4, -.08, .08, .3, .08, C.stoneD);
  };
  DEFS['sword' + t] = m => { person(m, { body: TIER_C[t] }); helmet(m, t); m.box(.17, .2, .08, .025, .3, .025, C.steel).box(.17, .2, .08, .08, .025, .04, C.gold).box(-.17, .18, .07, .03, .17, .15, C.red); };
  DEFS['spear' + t] = m => { person(m, { body: TIER_C[t] }); helmet(m, t); m.box(.17, .02, .06, .025, .68, .025, C.wood).prism(.17, .7, .06, .035, .1, 4, C.steel, 0); };
  DEFS['archer' + t] = m => { person(m, { body: TIER_C[t] }); m.box(0, .46, -.01, .18, .07, .18, C.pineD); m.box(.17, .14, .1, .02, .32, .025, C.wood).box(.17, .14, .075, .008, .32, .008, C.glow).box(-.08, .2, -.09, .07, .2, .05, C.woodD); };
  DEFS['rifle' + t] = m => { person(m, { body: TIER_C[t] }); m.box(0, .48, 0, .24, .02, .24, C.black).box(0, .5, 0, .14, .06, .14, C.black).box(0, .5, 0, .15, .02, .15, C.gold); m.beam([.15, .22, -.06], [.15, .36, .3], .03, C.woodD).beam([.15, .33, .22], [.15, .37, .34], .02, C.iron); };
}
for (let b = 0; b < 3; b++) for (let w = 0; w < 3; w++) DEFS['castle' + b + w] = m => castle(m, b, w);

/* ======================= WebGL ======================= */
const R3D = (() => {
  const VS = `attribute vec3 aP, aN, aC;
    uniform mat4 uVP; uniform vec3 uPos, uLight; uniform vec2 uRot, uRes, uFog; uniform float uScale, uUnlit;
    varying vec3 vC; varying float vF;
    void main() {
      vec3 p = aP * uScale; p = vec3(p.x * uRot.x + p.z * uRot.y, p.y, p.z * uRot.x - p.x * uRot.y) + uPos;
      vec3 n = vec3(aN.x * uRot.x + aN.z * uRot.y, aN.y, aN.z * uRot.x - aN.x * uRot.y);
      vC = aC * mix(.52 + .6 * max(dot(n, uLight), 0.), 1., uUnlit);
      vec4 c = uVP * vec4(p, 1.);
      c.xy = floor(c.xy / c.w * uRes + .5) / uRes * c.w;       // gruda o vértice na grade de pixels
      vF = clamp((c.w - uFog.x) / (uFog.y - uFog.x), 0., 1.);
      gl_Position = c;
    }`;
  const FS = `precision mediump float;
    varying vec3 vC; varying float vF; uniform vec3 uFogC, uTint, uAdd; uniform float uAlpha;
    float b2(vec2 a) { a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
    void main() {
      vec3 c = mix(vC * uTint + uAdd, uFogC, vF);
      vec2 q = mod(floor(gl_FragCoord.xy), 4.);                  // reduz antes da conta: precisão média de celular
      float d = b2(.5 * q) * .25 + b2(q);
      gl_FragColor = vec4(floor(c * 31. + d) / 31., uAlpha);      // 15 bits com pontilhado
    }`;
  const FOV = 30 * Math.PI / 180, TANF = Math.tan(FOV / 2), SKY = [.105, .13, .2], LIGHT = [-.42, .8, .43], STRIDE = 36, HEXR = 1 / Math.sqrt(3);
  const M = {}, U = {}, V = { w: 1, h: 1, cw: 1, ch: 1, vp: null, eye: [0, 0, 0], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0], asp: 1 };
  let gl = null, canvas = null, modelBuf = null, terrBuf = null, terrN = 0, statBuf = null, statN = 0, dynBuf = null, dyn = new Float32Array(9 * 18 * 256), bound = null;
  const fbos = {}, thumbs = {};

  function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function camera(eye, target, asp, near, far) {         // sem rolagem: a direita fica sempre na horizontal
    let f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]; const fl = Math.hypot(...f); f = f.map(v => v / fl);
    let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const view = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, eye), -dot(u, eye), dot(f, eye), 1];
    const k = 1 / TANF, proj = [k / asp, 0, 0, 0, 0, k, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
    return { vp: mul(proj, view), eye, f, r, u, asp };
  }
  function bind(buf) {
    if (bound === buf) return; bound = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, STRIDE, 24);
  }
  function xform(x, y, z, yaw, s) { gl.uniform3f(U.uPos, x, y, z); gl.uniform2f(U.uRot, Math.cos(yaw), Math.sin(yaw)); gl.uniform1f(U.uScale, s); }
  function look(tint, add, alpha, unlit) { gl.uniform3fv(U.uTint, tint); gl.uniform3fv(U.uAdd, add); gl.uniform1f(U.uAlpha, alpha); gl.uniform1f(U.uUnlit, unlit); }
  const ONE = [1, 1, 1], ZERO = [0, 0, 0];
  function blend(on) { if (on) { gl.enable(gl.BLEND); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); } }

  function init(cv) {
    canvas = cv;
    try { gl = cv.getContext('webgl', { antialias: false, alpha: false }) || cv.getContext('experimental-webgl', { antialias: false, alpha: false }); } catch (e) { gl = null; }
    if (!gl) return false;
    const prog = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); gl.attachShader(prog, s); }
    ['aP', 'aN', 'aC'].forEach((n, k) => gl.bindAttribLocation(prog, k, n));
    gl.linkProgram(prog); gl.useProgram(prog);
    for (const n of ['uVP', 'uPos', 'uLight', 'uRot', 'uRes', 'uFog', 'uScale', 'uUnlit', 'uFogC', 'uTint', 'uAdd', 'uAlpha']) U[n] = gl.getUniformLocation(prog, n);
    for (let k = 0; k < 3; k++) gl.enableVertexAttribArray(k);
    const ll = Math.hypot(...LIGHT); gl.uniform3f(U.uLight, LIGHT[0] / ll, LIGHT[1] / ll, LIGHT[2] / ll); gl.uniform3fv(U.uFogC, SKY);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    let off = 0; const parts = [];                         // todos os modelos num único buffer
    for (const name in DEFS) {
      const m = new MB(); DEFS[name](m);
      const v = new Float32Array(m.d), n = v.length / 9; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let k = 0; k < v.length; k += 9) { x0 = Math.min(x0, v[k]); x1 = Math.max(x1, v[k]); y0 = Math.min(y0, v[k + 1]); y1 = Math.max(y1, v[k + 1]); z0 = Math.min(z0, v[k + 2]); z1 = Math.max(z1, v[k + 2]); }
      M[name] = { v, n, start: off, c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], rad: Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 };
      off += n; parts.push(v);
    }
    const all = new Float32Array(off * 9); let p = 0; for (const v of parts) { all.set(v, p); p += v.length; }
    modelBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, modelBuf); gl.bufferData(gl.ARRAY_BUFFER, all, gl.STATIC_DRAW);
    terrBuf = gl.createBuffer(); statBuf = gl.createBuffer(); dynBuf = gl.createBuffer();
    return true;
  }
  function resize(cssW, cssH, px) {                      // px = tamanho do pixel "de 32 bits" na tela
    if (!gl) return;
    V.cw = cssW; V.ch = cssH; canvas.width = Math.max(1, Math.round(cssW / px)); canvas.height = Math.max(1, Math.round(cssH / px));
  }
  function upload(buf, arr) { bound = null; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); }

  // Chão: um prisma hexagonal por casa. top(i) = [altura, cor]; a lateral desce até o vizinho mais baixo (ou até a base, na borda).
  function setTerrain(n, px, pz, nb, top, side) {
    if (!gl) return;
    const m = new MB(), EDGE = [0, 4, 5, 1, 3, 2], cor = k => { const a = (k * 60 - 30) * Math.PI / 180; return [Math.cos(a) * HEXR, Math.sin(a) * HEXR]; };
    const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
    const tone = (c, f) => '#' + rgb(c).map(v => Math.max(0, Math.min(255, Math.round(v * f * 255))).toString(16).padStart(2, '0')).join('');
    for (let i = 0; i < n; i++) {
      const [h, col] = top(i), x = px[i], z = pz[i], P = [], Cc = [];
      for (let k = 0; k < 6; k++) { const [cx, cz] = cor(k); P.push([x + cx, h, z + cz]); Cc.push(tone(col, .8 + .2 * hash(Math.round((x + cx) * 8), Math.round((z + cz) * 8)))); }   // cantos vizinhos sorteiam o mesmo tom
      for (let k = 0; k < 6; k++) m.tri([x, h, z], P[k], P[(k + 1) % 6], tone(col, 1.07), null, Cc[k], Cc[(k + 1) % 6]);   // centro mais claro: a grade aparece sem linhas
      for (let k = 0; k < 6; k++) {
        const j = nb[i][EDGE[k]], hn = j < 0 ? -.7 : top(j)[0];
        if (hn < h - .001) { const a = P[k], b = P[(k + 1) % 6]; m.quad(a, b, [b[0], hn, b[2]], [a[0], hn, a[2]], side(i), [x, h - 1, z]); }
      }
    }
    terrN = m.d.length / 9; upload(terrBuf, new Float32Array(m.d));
  }
  // Peças paradas (natureza e construções) viram uma malha só; o jogo manda a lista de novo quando algo muda.
  function setStatics(list) {
    if (!gl) return;
    let n = 0; for (const it of list) n += M[it.m].n;
    const out = new Float32Array(n * 9); let o = 0;
    for (const it of list) {
      const v = M[it.m].v, c = Math.cos(it.yaw || 0), s = Math.sin(it.yaw || 0);
      for (let k = 0; k < v.length; k += 9, o += 9) {
        out[o] = it.x + v[k] * c + v[k + 2] * s; out[o + 1] = it.y + v[k + 1]; out[o + 2] = it.z + v[k + 2] * c - v[k] * s;
        out[o + 3] = v[k + 3] * c + v[k + 5] * s; out[o + 4] = v[k + 4]; out[o + 5] = v[k + 5] * c - v[k + 3] * s;
        out[o + 6] = v[k + 6]; out[o + 7] = v[k + 7]; out[o + 8] = v[k + 8];
      }
    }
    statN = n; upload(statBuf, out);
  }
  function setView(c, w, h, fog) {
    Object.assign(V, c); V.w = w; V.h = h;
    gl.viewport(0, 0, w, h); gl.uniformMatrix4fv(U.uVP, false, c.vp); gl.uniform2f(U.uRes, w / 2, h / 2); gl.uniform2f(U.uFog, fog[0], fog[1]);
  }
  function begin(cam) {                                  // cam = { x, z, d, p }: alvo no chão, distância e inclinação
    if (!gl) return;
    const eye = [cam.x, .3 + cam.d * Math.sin(cam.p), cam.z + cam.d * Math.cos(cam.p)];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    setView(camera(eye, [cam.x, .3, cam.z], V.cw / V.ch, Math.max(.5, cam.d * .2), cam.d + 90), canvas.width, canvas.height, [cam.d + 10, cam.d + 62]);
    gl.clearColor(SKY[0], SKY[1], SKY[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    blend(false); xform(0, 0, 0, 0, 1); look(ONE, ZERO, 1, 0);
    if (terrN) { bind(terrBuf); gl.drawArrays(gl.TRIANGLES, 0, terrN); }
    if (statN) { bind(statBuf); gl.drawArrays(gl.TRIANGLES, 0, statN); }
  }
  function inst(name, x, y, z, yaw = 0, s = 1, tint = ONE, add = ZERO) {
    const m = M[name]; if (!gl || !m) return;
    bind(modelBuf); xform(x, y, z, yaw, s); look(tint, add, 1, 0); gl.drawArrays(gl.TRIANGLES, m.start, m.n);
  }
  function blob(x, y, z, r, col, alpha) {                // efeito: octaedro translúcido, sem luz
    if (!gl) return;
    blend(true); bind(modelBuf); xform(x, y, z, 0, r); look(col, ZERO, alpha, 1); gl.drawArrays(gl.TRIANGLES, M.oct.start, M.oct.n); blend(false);
  }
  function hexes(pts, r, col, alpha) {                   // hexágonos chapados no chão: pts = [x, y, z, x, y, z…]
    const n = pts.length / 3; if (!gl || !n) return;
    if (dyn.length < n * 108) dyn = new Float32Array(n * 216);
    let o = 0; const R = r * HEXR, cx = [], cz = [];
    for (let k = 0; k < 6; k++) { const a = (k * 60 - 30) * Math.PI / 180; cx.push(Math.cos(a) * R); cz.push(Math.sin(a) * R); }
    for (let i = 0; i < pts.length; i += 3) for (let k = 1; k < 5; k++) for (const q of [0, k, k + 1]) {
      dyn[o] = pts[i] + cx[q]; dyn[o + 1] = pts[i + 1] + .035; dyn[o + 2] = pts[i + 2] + cz[q]; dyn[o + 3] = 0; dyn[o + 4] = 1; dyn[o + 5] = 0; dyn[o + 6] = col[0]; dyn[o + 7] = col[1]; dyn[o + 8] = col[2]; o += 9;
    }
    upload(dynBuf, dyn.subarray(0, o)); bind(dynBuf);
    blend(true); xform(0, 0, 0, 0, 1); look(ONE, ZERO, alpha, 1); gl.drawArrays(gl.TRIANGLES, 0, o / 9); blend(false);
  }
  function project(x, y, z) {                            // mundo → px da tela (CSS); null se ficou atrás da câmera
    const m = V.vp; if (!m) return null;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15]; if (w <= .01) return null;
    return [((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * .5 + .5) * V.cw, (.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * .5) * V.ch];
  }
  function ray(sx, sy) {                                 // px da tela → raio [origem, direção]
    const nx = (sx / V.cw * 2 - 1) * TANF * V.asp, ny = (1 - sy / V.ch * 2) * TANF;
    return [V.eye, [V.f[0] + V.r[0] * nx + V.u[0] * ny, V.f[1] + V.r[1] * nx + V.u[1] * ny, V.f[2] + V.r[2] * nx + V.u[2] * ny]];
  }
  // Desenha uma lista de peças [{ m, x, y, z, yaw, s }] fora da tela e devolve um canvas 2D (miniaturas e arte do menu).
  function shot(list, w, h, eye, target) {
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    if (!gl) return out;
    const key = w + 'x' + h; let f = fbos[key];
    if (!f) {
      f = fbos[key] = { fb: gl.createFramebuffer(), tex: gl.createTexture(), rb: gl.createRenderbuffer() };
      gl.bindTexture(gl.TEXTURE_2D, f.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindRenderbuffer(gl.RENDERBUFFER, f.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, f.rb);
    }
    const keep = { ...V };
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb);
    setView(camera(eye, target, w / h, .1, 200), w, h, [1e5, 1e6]);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); blend(false);
    for (const it of list) inst(it.m, it.x || 0, it.y || 0, it.z || 0, it.yaw || 0, it.s || 1);
    const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); Object.assign(V, keep);
    const g = out.getContext('2d'), img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    g.putImageData(img, 0, 0);
    return out;
  }
  function thumb(name) {                                 // miniatura da peça para os botões (data URL, guardada)
    if (name in thumbs) return thumbs[name];
    const m = M[name]; if (!gl || !m) return thumbs[name] = '';
    const d = m.rad / TANF * 1.05, c = m.c;
    return thumbs[name] = shot([{ m: name, yaw: -.6 }], 96, 96, [c[0], c[1] + d * .5, c[2] + d * .87], c).toDataURL();
  }
  return { init, resize, setTerrain, setStatics, begin, inst, blob, hexes, project, ray, shot, thumb, TANF, get ok() { return !!gl; } };
})();
