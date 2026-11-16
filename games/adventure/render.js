/* Adventure: desenho. Sprites em texto (cada letra é uma cor da paleta), ladrilhos pintados por código e guardados num canvas por região.
   Para mudar a arte de um bicho, edite o desenho em SPR e as cores em PAL. */

const SPR = {
  // herói e NPCs: cabeça (varia) + corpo (comum). H = chapéu/cabelo, s = pele, b = roupa, a = detalhe, l = calça, w = bota, k = contorno
  head_elmo:  ['...kkkk...', '..kHHHHk..', '.kHHHHHHk.', '.kHkHHkHk.', '.kssssssk.', '.kskssksk.', '.kssssssk.'],
  head_chapeu: ['.....k....', '....kHk...', '...kHHHk..', '..kHHHHHk.', 'kkHHaaHHHk', '.kssssssk.', '.kskssksk.', '.kssssssk.'],
  head_capuz: ['...kkkk...', '..kHHHHk..', '.kHHHHHHk.', '.kHssssHk.', '.kHkssksk.', '.kHssssHk.', '..kHHHHk..'],
  head_cabelo: ['...kkkk...', '..kHHHHk..', '.kHHHHHHk.', '.kHssssHk.', '.kskssksk.', '.kHssssHk.', '.kH....Hk.'],
  head_coque: ['....kk....', '...kHHk...', '..kHHHHk..', '.kHHHHHHk.', '.kHssssHk.', '.kskssksk.', '.kssssssk.'],
  body:  ['..kbbbbk..', '.kbbaabbk.', 'ksbbbbbbsk', 'ksbbbbbbsk', '.kbbbbbbk.', '..kllllk..', '..kwkkwk..', '..kk..kk..'],
  body2: ['..kbbbbk..', '.kbbaabbk.', 'ksbbbbbbsk', 'ksbbbbbbsk', '.kbbbbbbk.', '..kllllk..', '.kwk..kwk.', '.kk....kk.'],
  robe:  ['..kbbbbk..', '.kbbaabbk.', 'ksbbbbbbsk', 'ksbbbbbbsk', '.kbbbbbbk.', '.kbbbbbbk.', 'kbbbbbbbbk', '.kkkkkkkk.'],
  geleia:  ['...kkkk...', '..kggggk..', '.kgGggggk.', '.kgGggggk.', 'kggkggkggk', 'kggggggggk', 'kggggggggk', '.kkkkkkkk.'],
  geleia2: ['..........', '...kkkk...', '.kkggggkk.', 'kgGgggggGk', 'kggkggkggk', 'kggggggggk', 'kggggggggk', '.kkkkkkkk.'],
  lobo:  ['...........kk.', 'k.........kggk', 'kk..kkkkkkggek', '.kkgggggggggk.', '.kgggggggggkk.', '..kgggggggk...', '..kgk...kgk...', '..kk....kk....'],
  lobo2: ['...........kk.', 'k.........kggk', 'kk..kkkkkkggek', '.kkgggggggggk.', '.kgggggggggkk.', '..kgggggggk...', '.kgk.....kgk..', '.kk.......kk..'],
  goblin: ['k..kkkk..k', 'kgkggggkgk', '.kggggggk.', '.kgrggrgk.', '.kggggggk.', '..kbbbbk..', '.kbbbbbbk.', 'kgbbbbbbgk', '..kbbbbk..', '..kl..lk..', '..kk..kk..'],
  goblin2: ['k..kkkk..k', 'kgkggggkgk', '.kggggggk.', '.kgrggrgk.', '.kggggggk.', '..kbbbbk..', '.kbbbbbbk.', 'kgbbbbbbgk', '..kbbbbk..', '.kl....lk.', '.kk....kk.'],
  esqueleto: ['..kkkkkk..', '.kggggggk.', '.kgrggrgk.', '.kggggggk.', '..kgkgkk..', '...kggk...', '.kkggggkk.', 'kg.kggk.gk', '..kggggk..', '..kg..gk..', '..kg..gk..', '.kgk..kgk.'],
  esqueleto2: ['..kkkkkk..', '.kggggggk.', '.kgrggrgk.', '.kggggggk.', '..kgkgkk..', '...kggk...', '.kkggggkk.', 'kg.kggk.gk', '..kggggk..', '.kg....gk.', '.kg....gk.', 'kgk....kgk'],
  coroa: ['k.k.k.k', 'kakakak', 'kaaaaak', 'kkkkkkk'],
  bau: ['.kkkkkk.', 'kaaaaaak', 'kkkkkkkk', 'kaakkaak', 'kaaaaaak', 'kkkkkkkk'],
  bau_aberto: ['kkkkkkkk', 'kaaaaaak', '.kkkkkk.', 'kkkkkkkk', 'kaaeeaak', 'kaaaaaak', 'kkkkkkkk'],
  placa: ['kkkkkkkk', 'kaaaaaak', 'kakkkkak', 'kaaaaaak', 'kkkkkkkk', '...ka...', '...ka...', '...ka...'],
  caveira: ['..kkkkkk..', '.kggggggk.', 'kggggggggk', 'kggggggggk', 'kgkkggkkgk', 'kgkkggkkgk', 'kggggggggk', '.kggkkggk.', '..kggggk..', '..kgkgkk..', '...kkkk...'],
};
const PAL = {
  k: '#1b1620', s: '#f0c49a', l: '#4a3a30', w: '#2e2420', r: '#e04040', e: '#e8d040',
  guerreiro: { H: '#a8b0ba', b: '#3a5ea8', a: '#e0b040' },
  mago: { H: '#6a3aa8', b: '#5a3090', a: '#e0b040' },
  ladino: { H: '#3a3048', b: '#4a4058', a: '#c0a060' },
  mercadora: { H: '#8a4a2a', b: '#b84050', a: '#f0e0b0' },
  ferreiro: { H: '#3a2a20', b: '#6a4a30', a: '#9a9a9a', s: '#d8a070' },
  capita: { H: '#c03030', b: '#7a8898', a: '#3a5ea8' },
  ancia: { H: '#d8d8d8', b: '#5a4a7a', a: '#c0a0e0' },
  aldeao: { H: '#b07a3a', b: '#7a8a50', a: '#c8b080' },
  geleia: { g: '#6cc84c', G: '#c8f0a0' },
  lobo: { g: '#7a7a86', e: '#f0d040' },
  goblin: { g: '#6aa040', b: '#7a5030', l: '#4a3020' },
  arqueiro_g: { g: '#5a9050', b: '#3a5030', l: '#2a3020' },
  esqueleto: { g: '#e8e2d0', r: '#e05030' },
  rei: { g: '#d8d0b8', r: '#40d0f0', a: '#e0b040' },
  coroa: { a: '#e8c040' }, bau: { a: '#a87038' }, placa: { a: '#a87a48' }, caveira: { g: '#e8e2d0' },
};
const LOOK = {                       // cabeça, corpo e paleta de cada personagem
  guerreiro: ['head_elmo', 'body', 'guerreiro'], mago: ['head_chapeu', 'robe', 'mago'], ladino: ['head_capuz', 'body', 'ladino'],
  mercadora: ['head_coque', 'robe', 'mercadora'], ferreiro: ['head_cabelo', 'body', 'ferreiro'], capita: ['head_elmo', 'body', 'capita'],
  ancia: ['head_coque', 'robe', 'ancia'], aldeao: ['head_cabelo', 'body', 'aldeao'],
};

const sprCache = {};
function sprite(rows, pal, key) {               // texto → canvas (cache por chave)
  if (sprCache[key]) return sprCache[key];
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { const col = (pal && pal[ch]) || PAL[ch]; if (ch !== '.' && col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }));
  return (sprCache[key] = c);
}
function personSprite(look, frame) {
  const [hd, bd, pal] = LOOK[look] || LOOK.aldeao, body = bd === 'body' && frame ? 'body2' : bd;
  return sprite([...SPR[hd], ...SPR[body]], PAL[pal], 'p:' + look + ':' + body);
}
function mobSprite(k, frame) {                  // look/tint vêm dos monstros criados no editor
  const M = MOBS[k] || {}, look = M.look || k, base = look === 'arqueiro_g' ? 'goblin' : look === 'rei' ? 'esqueleto' : look;
  const name = frame && SPR[base + '2'] ? base + '2' : SPR[base] ? base : 'geleia', pal = { ...(PAL[look] || PAL.geleia), ...(M.tint ? { g: M.tint } : {}) };
  return sprite(SPR[name], pal, 'm:' + look + ':' + name + ':' + (M.tint || ''));
}
const mobSize = M => M.size || (M.boss ? 2 : 1);
// Variantes pintadas uma vez (filtros de canvas são lentos): flash = atingido (branco), warn = preparando o golpe (avermelhado).
const variantCache = new WeakMap();
function variant(spr, kind) {
  let m = variantCache.get(spr); if (!m) variantCache.set(spr, m = {});
  if (m[kind]) return m[kind];
  const c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height; const g = c.getContext('2d');
  g.drawImage(spr, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = kind === 'flash' ? 'rgba(255,255,255,.85)' : 'rgba(255,90,60,.4)'; g.fillRect(0, 0, c.width, c.height);
  return (m[kind] = c);
}

/* ---------- Ladrilhos ---------- */
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function shade(hex, f) { const n = parseInt(hex.slice(1), 16), c = i => clamp(Math.round(((n >> i) & 255) * f), 0, 255); return `rgb(${c(16)},${c(8)},${c(0)})`; }
function drawTile(g, ch, tx, ty, reg) {
  const T = TILES[ch] || TILES.x, x = tx * TILE, y = ty * TILE, px = (i, j, c) => { g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); };
  const R = (i, j, w, h, c) => { g.fillStyle = c; g.fillRect(x + i, y + j, w, h); };
  const speck = (n, cols, s = 0) => { for (let k = 0; k < n; k++) px(Math.floor(hash(tx, ty, k + s) * 16), Math.floor(hash(ty, tx, k + 7 + s) * 16), cols[k % cols.length]); };
  const ground = ch2 => { R(0, 0, 16, 16, TILES[ch2].c); speck(10, [shade(TILES[ch2].c, 1.12), shade(TILES[ch2].c, .88)]); };
  const under = reg.kind === 'masmorra' ? 'o' : (ch === 'l' || ch === 'p' ? 'o' : '.');
  switch (ch) {
    case '.': ground('.'); break;
    case ',': ground(','); for (let k = 0; k < 4; k++) { const i = 2 + Math.floor(hash(tx, ty, k) * 12), j = 3 + Math.floor(hash(ty, tx, k) * 11); R(i, j, 1, 2, '#3f7a34'); R(i + 1, j - 1, 1, 2, '#6ab052'); }
      if (hash(tx, ty, 99) < .25) { const i = 3 + Math.floor(hash(tx, ty, 98) * 10), j = 3 + Math.floor(hash(tx, ty, 97) * 10); R(i, j, 2, 2, ['#f0e060', '#f08ab0', '#f0f0f0'][Math.floor(hash(tx, ty, 96) * 3)]); } break;
    case '=': ground('='); speck(6, ['#8a7048', '#c8a878'], 3); break;
    case 's': ground('s'); break;
    case '_': R(0, 0, 16, 16, '#8a847a'); for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) R(i * 8 + (j % 2) * 4 + 1, j * 4 + 1, 6, 3, shade('#a29c90', .95 + hash(tx * 2 + i, ty * 4 + j) * .15)); break;
    case 'b': R(0, 0, 16, 16, '#3d78b8'); for (let j = 0; j < 4; j++) { R(0, j * 4, 16, 3, '#9a6a3a'); R(0, j * 4 + 3, 16, 1, '#5a3a20'); } break;
    case 'o': R(0, 0, 16, 16, '#3c3844'); R(1, 1, 7, 7, '#47434f'); R(9, 1, 6, 7, '#433f4b'); R(1, 9, 6, 6, '#433f4b'); R(8, 9, 7, 6, '#47434f'); if (hash(tx, ty) < .2) R(3, 4, 5, 1, '#2c2834'); break;
    case 'C': ground('.'); R(1, 2, 14, 14, '#4a4440'); R(3, 4, 10, 12, '#0e0a0e'); R(4, 3, 8, 2, '#0e0a0e'); break;
    case 'T': ground('.'); R(7, 11, 2, 4, '#5a3a20'); g.fillStyle = '#1e4a24'; g.beginPath(); g.arc(x + 8, y + 7, 7, 0, TAU); g.fill();
      g.fillStyle = '#2f6a34'; g.beginPath(); g.arc(x + 7.5, y + 6.5, 5.5, 0, TAU); g.fill(); g.fillStyle = '#4a8a44'; g.beginPath(); g.arc(x + 6, y + 5, 2.5, 0, TAU); g.fill(); break;
    case '~': R(0, 0, 16, 16, '#3a72b0'); speck(4, ['#4a86c4']); if (hash(tx, ty) < .5) R(3 + Math.floor(hash(tx, ty, 2) * 8), 5 + Math.floor(hash(tx, ty, 3) * 6), 4, 1, '#8ab8e8'); break;
    case '#': ground(under === 'o' ? 'o' : '.'); g.fillStyle = '#5a5650'; g.beginPath(); g.ellipse(x + 8, y + 9, 7, 6, 0, 0, TAU); g.fill(); g.fillStyle = '#8a857e'; g.beginPath(); g.ellipse(x + 7, y + 8, 5.5, 4.5, 0, 0, TAU); g.fill(); R(5, 6, 3, 1, '#a8a29a'); break;
    case 'W': R(0, 0, 16, 16, '#6a645a'); for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) R(((j % 2) * 3 + i * 6) % 16, j * 4, 5, 3, shade('#9a9284', .9 + hash(tx * 3 + i, ty * 4 + j) * .2)); break;
    case 'R': { R(0, 0, 16, 16, '#7a2f22'); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) R(i * 4 + (j % 2) * 2, j * 4, 3, 3, shade('#b04a32', .9 + hash(tx * 4 + i, ty * 4 + j) * .2)); const below = tileAt(reg, tx, ty + 1); if (below !== 'R') R(0, 13, 16, 3, '#5a2018'); break; }
    case 'H': R(0, 0, 16, 16, '#d6c3a0'); R(0, 0, 16, 2, '#8a6a40'); R(0, 14, 16, 2, '#8a6a40'); R(0, 0, 2, 16, '#8a6a40'); speck(6, ['#c8b490']); if (tileAt(reg, tx - 1, ty) === 'H' && tileAt(reg, tx + 1, ty) === 'H' && (tx + ty) % 3 === 0) { R(5, 4, 6, 6, '#3a4a6a'); R(5, 4, 6, 1, '#6a4a30'); R(7, 4, 1, 6, '#6a4a30'); } break;
    case 'd': R(0, 0, 16, 16, '#d6c3a0'); R(3, 2, 10, 14, '#5a3820'); R(4, 3, 8, 13, '#7a5030'); R(10, 9, 1, 1, '#e0c060'); break;
    case 'f': ground('.'); R(0, 6, 16, 2, '#8a6a40'); R(0, 11, 16, 2, '#8a6a40'); R(2, 4, 2, 11, '#6a4a2a'); R(12, 4, 2, 11, '#6a4a2a'); break;
    case 'x': R(0, 0, 16, 16, '#24202a'); for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) R(i * 8 + (j % 2) * 4, j * 4, 7, 3, shade('#363040', .85 + hash(tx * 2 + i, ty * 4 + j) * .3)); if (tileAt(reg, tx, ty + 1) !== 'x' && tileAt(reg, tx, ty + 1) !== 'l') R(0, 13, 16, 3, '#16121a'); break;
    case 'l': drawTile(g, bioOf(reg) === 'caverna' ? 'k' : 'x', tx, ty, reg); R(7, 6, 2, 6, '#6a4a2a'); R(6, 3, 4, 4, '#f0a030'); R(7, 2, 2, 3, '#f8e070'); break;
    case 'p': drawTile(g, 'o', tx, ty, reg); R(3, 0, 10, 16, '#5a5464'); R(4, 0, 3, 16, '#7a7486'); R(2, 13, 12, 3, '#4a4454'); R(2, 0, 12, 2, '#4a4454'); break;
    case 'F': ground('.'); for (let k = 0; k < 6; k++) { const i = 1 + Math.floor(hash(tx, ty, k) * 13), j = 1 + Math.floor(hash(ty, tx, k + 3) * 13); R(i, j + 1, 1, 2, '#3f7a34'); R(i - 1, j, 3, 1, ['#f0e060', '#f08ab0', '#f0f0f0', '#a0a0ff'][k % 4]); R(i, j - 1, 1, 3, ['#f0e060', '#f08ab0', '#f0f0f0', '#a0a0ff'][k % 4]); } break;
    case 'm': ground('m'); speck(6, ['#4a4228', '#6a5e3c'], 5); if (hash(tx, ty, 9) < .3) R(4 + Math.floor(hash(tx, ty, 8) * 7), 6, 4, 2, '#3f5a40'); break;
    case 'j': ground('m'); for (let k = 0; k < 5; k++) { const i = 2 + Math.floor(hash(tx, ty, k) * 12); R(i, 3 + Math.floor(hash(ty, tx, k) * 4), 1, 10, '#6a8a3a'); R(i, 2 + Math.floor(hash(ty, tx, k) * 4), 1, 3, '#8a6a3a'); } break;
    case 'v': R(0, 0, 16, 16, '#344a36'); speck(5, ['#3f5a40', '#2a3a2c']); if (hash(tx, ty) < .35) { R(3 + Math.floor(hash(tx, ty, 4) * 9), 4 + Math.floor(hash(tx, ty, 5) * 8), 3, 2, '#5a8a3a'); } break;
    case 'n': ground('n'); speck(6, ['#ffffff', '#d0dce8']); break;
    case 'i': R(0, 0, 16, 16, '#bcd8ec'); R(2, 3, 6, 1, '#e8f4ff'); R(9, 10, 5, 1, '#e8f4ff'); speck(3, ['#a0c4e0']); break;
    case 'P': ground('n'); g.fillStyle = '#1e3a2c'; g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x + 15, y + 13); g.lineTo(x + 1, y + 13); g.fill(); g.fillStyle = '#2f5a44'; g.beginPath(); g.moveTo(x + 8, y + 2); g.lineTo(x + 13, y + 11); g.lineTo(x + 3, y + 11); g.fill(); R(5, 4, 6, 1, '#f0f4f8'); R(3, 9, 4, 1, '#f0f4f8'); R(10, 8, 3, 1, '#f0f4f8'); R(7, 13, 2, 3, '#5a3a20'); break;
    case 'u': ground('u'); speck(6, ['#4a3e38', '#6a5c52'], 2); break;
    case 'k': R(0, 0, 16, 16, '#2c2420'); g.fillStyle = '#3e342e'; g.beginPath(); g.ellipse(x + 5, y + 6, 5, 4, 0, 0, TAU); g.ellipse(x + 11, y + 10, 5, 5, 0, 0, TAU); g.fill(); R(3, 4, 3, 1, '#5a4c44'); if (tileAt(reg, tx, ty + 1) !== 'k') R(0, 13, 16, 3, '#1a1412'); break;
    case 'L': R(0, 0, 16, 16, '#b03a10'); speck(8, ['#f08020', '#ffd040', '#801a08']); R(2 + Math.floor(hash(tx, ty, 2) * 8), 5, 5, 2, '#ffb030'); break;
    case 'Q': ground(reg && bioOf(reg) === 'caverna' ? 'u' : '.'); R(7, 8, 3, 7, '#e8dcc8'); g.fillStyle = '#9a3a5a'; g.beginPath(); g.ellipse(x + 8, y + 7, 7, 5, 0, Math.PI, 0); g.fill(); R(4, 4, 2, 2, '#f0d0e0'); R(10, 3, 2, 2, '#f0d0e0'); break;
    case 'D': ground('D'); g.strokeStyle = '#c8a868'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 9 + hash(tx, ty) * 3); g.quadraticCurveTo(x + 8, y + 4, x + 16, y + 9 + hash(tx + 1, ty) * 3); g.stroke(); break;
    case 'K': ground('s'); R(6, 2, 4, 13, '#3a7a30'); R(2, 6, 2, 5, '#3a7a30'); R(2, 10, 4, 2, '#3a7a30'); R(12, 4, 2, 5, '#3a7a30'); R(10, 8, 4, 2, '#3a7a30'); R(7, 3, 1, 11, '#5aa04a'); break;
    case 'Z': ground(reg && bioOf(reg) === 'cripta' ? 'o' : '.'); R(4, 3, 8, 11, '#6a6a70'); R(5, 2, 6, 1, '#6a6a70'); R(5, 4, 6, 9, '#8a8a92'); R(7, 5, 2, 6, '#5a5a62'); R(5, 7, 6, 2, '#5a5a62'); R(3, 14, 10, 2, '#4a4a50'); break;
    default: R(0, 0, 16, 16, T.c);
  }
}
function regionCanvas(reg) {
  const w = reg.map[0].length, h = reg.map.length, c = document.createElement('canvas'); c.width = w * TILE; c.height = h * TILE;
  const g = c.getContext('2d');
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) drawTile(g, reg.map[ty][tx], tx, ty, reg);
  return c;
}
function torchesOf(reg) { const a = []; reg.map.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'l') a.push([x * TILE + 8, y * TILE + 6, 48]); else if (ch === 'L') a.push([x * TILE + 8, y * TILE + 8, 30]); })); return a; }
const darkOf = reg => reg.dark != null ? reg.dark : BIOMES[bioOf(reg)].dark;
const weatherOf = reg => reg.weather != null ? reg.weather : BIOMES[bioOf(reg)].weather;

/* ---------- Cena ---------- */
const View = {
  cv: null, g: null, scale: 3, cw: 0, ch: 0, cache: {}, fx: [], light: null,
  init(cv) { this.cv = cv; this.g = cv.getContext('2d'); this.resize(); addEventListener('resize', () => this.resize()); this.light = document.createElement('canvas'); },
  resize() {
    const dpr = devicePixelRatio || 1, W = this.cv.clientWidth, H = this.cv.clientHeight;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.scale = Math.max(2, Math.round(Math.min(W / 400, H / 260)));        // ~400×260 px do mundo na tela
    this.px = this.scale * dpr; this.cw = this.cv.width / this.px; this.ch = this.cv.height / this.px;
  },
  regionImg(id) { const reg = REGIONS[id]; let c = this.cache[id]; if (!c || c.reg !== reg) { c = this.cache[id] = { reg, img: regionCanvas(reg), torches: torchesOf(reg) }; } return c; },
  forget(id) { if (id) delete this.cache[id]; else this.cache = {}; },

  // st = estado do cliente (main.js): me, ents, etc.
  draw(st, now) {
    const g = this.g, reg = REGIONS[st.r]; if (!reg) return;
    const RC = this.regionImg(st.r), mw = RC.img.width, mh = RC.img.height;
    let cx = st.me.x - this.cw / 2, cy = st.me.y - this.ch / 2;
    cx = mw < this.cw ? (mw - this.cw) / 2 : clamp(cx, 0, mw - this.cw); cy = mh < this.ch ? (mh - this.ch) / 2 : clamp(cy, 0, mh - this.ch);
    cx = Math.round(cx * this.px) / this.px; cy = Math.round(cy * this.px) / this.px; this.cam = [cx, cy];
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.fillStyle = darkOf(reg) > .5 ? '#0a080c' : '#1a2a18'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(this.px, 0, 0, this.px, -cx * this.px, -cy * this.px);
    g.drawImage(RC.img, 0, 0);
    // água brilha
    const t = now / 1000;

    const list = [];
    for (const d of st.drops.values()) list.push({ y: d.y - 2, f: () => this.drop(d, t) });
    for (const n of reg.npcs) list.push({ y: n.y * TILE, f: () => this.npc(n, st, t) });
    for (const c of reg.chests || []) list.push({ y: c.y * TILE, f: () => this.thing(c, (st.me.chests || []).includes(c.id) ? 'bau_aberto' : 'bau', st, 'E — abrir') });
    for (const c of reg.signs || []) list.push({ y: c.y * TILE, f: () => this.thing(c, 'placa', st, 'E — ler') });
    for (const m of st.mobs.values()) list.push({ y: m.y, f: () => this.mob(m, t) });
    for (const o of st.others.values()) list.push({ y: o.y, f: () => this.hero(o, t, false) });
    if (!st.me.dead) list.push({ y: st.me.y, f: () => this.hero(st.me, t, true) });
    list.sort((a, b) => a.y - b.y).forEach(e => e.f());
    for (const p of st.projs.values()) this.proj(p);
    this.drawFx(now);
    this.weather(weatherOf(reg), t);
    if (darkOf(reg) > .03) this.lighting(st, RC, t, darkOf(reg));
    for (const m of st.mobs.values()) {
      const M = MOBS[m.k] || MOBS.geleia, top = m.y - M.r * mobSize(M) - 9, d = (m.lvl || 1) - st.me.lvl;
      if (m.hp < 100 && !M.boss) this.bar(m.x - 8, top, 16, m.hp / 100, '#e04040');
      this.label('Nv ' + (m.lvl || 1), m.x, top - 1.5, d >= 4 ? '#ff6a5a' : d >= 2 ? '#ffb050' : d <= -3 ? '#9a96a0' : '#e8e4f0');   // cor = perigo em relação ao seu nível
    }
    const boss = [...st.mobs.values()].find(m => MOBS[m.k] && MOBS[m.k].boss);
    if (boss) { const w = Math.min(160, this.cw * .6), [cx, cy] = this.cam; this.bar(cx + (this.cw - w) / 2, cy + 30, w, boss.hp / 100, '#d04040'); this.label(MOBS[boss.k].n + ' · Nv ' + boss.lvl, cx + this.cw / 2, cy + 28, '#ffd8a0'); }
    for (const o of st.others.values()) { this.label(o.name + ' ' + o.lvl, o.x, o.y - 23, '#fff'); this.bar(o.x - 9, o.y - 21, 18, o.hp / 100, '#50d060'); }
    this.label(st.me.name, st.me.x, st.me.y - 21, '#ffe9a0');
  },
  hero(h, t, mine) {
    const g = this.g, moving = h.mv, frame = moving ? Math.floor(t * 8) % 2 : 0, spr = personSprite(h.cls, frame), left = Math.cos(h.f) < 0;
    if (h.dead) { g.globalAlpha = .35; }
    if (h.roll) g.globalAlpha = .55;
    this.shadow(h.x, h.y + 1, 5);
    const bob = moving ? (frame ? -1 : 0) : 0, x = Math.round(h.x), y = Math.round(h.y) + bob;
    if (Math.sin(h.f) < 0) this.weapon(h, x, y);          // arma atrás quando mira para cima
    g.save(); g.translate(x, y); if (left) g.scale(-1, 1);
    g.drawImage(h.hurt && Math.floor(t * 20) % 2 ? variant(spr, 'flash') : spr, -5, -spr.height + 1); g.restore();
    if (Math.sin(h.f) >= 0) this.weapon(h, x, y);
    g.globalAlpha = 1;
  },
  weapon(h, x, y) {
    const g = this.g, a = h.f, ox = x + Math.cos(a) * 5, oy = y - 6 + Math.sin(a) * 4;
    g.save(); g.translate(ox, oy); g.rotate(a); g.lineCap = 'square';
    const wt = h.wt || 'punho', sw = h.swing > 0 ? (h.swing / .2 - .5) * 2.2 : 0;
    if (wt === 'espada') { g.rotate(sw); g.fillStyle = '#5a3a20'; g.fillRect(0, -1, 3, 2); g.fillStyle = '#d0d8e0'; g.fillRect(3, -1, 9, 2); g.fillStyle = '#e0b040'; g.fillRect(3, -2, 1, 4); }
    else if (wt === 'adaga') { g.translate(h.swing > 0 ? 3 : 0, 0); g.fillStyle = '#3a2a20'; g.fillRect(0, -1, 2, 2); g.fillStyle = '#e8eef4'; g.fillRect(2, -1, 5, 2); g.fillStyle = '#c0a060'; g.fillRect(2, -1.5, 1, 3); }
    else if (wt === 'punho') { g.fillStyle = '#f0c49a'; g.fillRect(h.swing > 0 ? 3 : 0, -1, 2, 2); }
    else if (wt === 'cajado') { g.fillStyle = '#6a4a2a'; g.fillRect(-2, -1, 13, 2); g.fillStyle = h.swing > 0 ? '#ffe080' : '#a060ff'; g.fillRect(10, -2, 3, 3); }
    else { g.strokeStyle = '#8a5a2a'; g.lineWidth = 1.5; g.beginPath(); g.arc(1, 0, 6, -1.2, 1.2); g.stroke(); g.strokeStyle = '#e0e0e0'; g.lineWidth = .5; g.beginPath(); g.moveTo(1 + Math.cos(-1.2) * 6, Math.sin(-1.2) * 6); g.lineTo(h.swing > 0 ? 1 : -2, 0); g.lineTo(1 + Math.cos(1.2) * 6, Math.sin(1.2) * 6); g.stroke(); }
    g.restore();
  },
  npc(n, st, t) {
    const g = this.g, x = n.x * TILE, y = n.y * TILE, N = NPCS[n.k] || NPCS.aldeao, spr = personSprite(N.look, 0);
    this.shadow(x, y + 1, 5);
    g.save(); g.translate(Math.round(x), Math.round(y + (Math.floor(t * 1.5 + x) % 2 ? 0 : -0.5))); if (st.me.x < x) g.scale(-1, 1); g.drawImage(spr, -5, -spr.height + 1); g.restore();
    const mark = questMark(n.k, st);
    if (mark) { g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#1b1620'; g.fillText(mark, x + .5, y - 22.5 + Math.sin(t * 4)); g.fillStyle = mark === '?' ? '#7af07a' : '#ffd84a'; g.fillText(mark, x, y - 23 + Math.sin(t * 4)); }
    if (st.near && st.near.o === n) this.label('E — ' + (n.n || N.n), x, y - (mark ? 32 : 22), '#fff');
  },
  thing(c, spr, st, hint) {                       // baús e placas
    const g = this.g, x = c.x * TILE, y = c.y * TILE, s = sprite(SPR[spr], PAL[spr === 'placa' ? 'placa' : 'bau'], spr);
    this.shadow(x, y + 1, 5); g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height + 1));
    if (st.near && st.near.o === c) this.label(hint, x, y - s.height - 3, '#fff');
  },
  weather(kind, t) {                              // partículas de clima, sem estado (posição sai do tempo e de um hash)
    if (!kind) return;
    const g = this.g, [cx, cy] = this.cam, W = this.cw, H = this.ch, wrap = (v, m) => ((v % m) + m) % m;
    const P = { chuva: [140, 0], neve: [90, 0], folhas: [26, 0], vagalumes: [30, 0], cinzas: [70, 0], nevoa: [0, 0] }[kind] || [0];
    for (let i = 0; i < P[0]; i++) {
      const h1 = hash(i, 1), h2 = hash(i, 2), h3 = hash(i, 3);
      let x, y;
      if (kind === 'chuva') { x = wrap(h1 * W * 1.3 - t * 60 - cx * .2, W); y = wrap(h2 * H + t * (260 + h3 * 80), H); g.strokeStyle = 'rgba(170,200,255,.45)'; g.lineWidth = .6; g.beginPath(); g.moveTo(cx + x, cy + y); g.lineTo(cx + x - 2, cy + y + 6); g.stroke(); }
      else if (kind === 'neve') { x = wrap(h1 * W + Math.sin(t + i) * 8 - t * 6, W); y = wrap(h2 * H + t * (18 + h3 * 14), H); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(cx + x, cy + y, h3 > .7 ? 1.5 : 1, h3 > .7 ? 1.5 : 1); }
      else if (kind === 'cinzas') { x = wrap(h1 * W + Math.sin(t * .7 + i) * 10, W); y = wrap(h2 * H - t * (10 + h3 * 10), H); g.fillStyle = h3 > .8 ? 'rgba(255,140,40,.8)' : 'rgba(90,80,80,.6)'; g.fillRect(cx + x, cy + y, 1, 1); }
      else if (kind === 'folhas') { x = wrap(h1 * W + t * (14 + h3 * 10) + Math.sin(t * 2 + i) * 6, W); y = wrap(h2 * H + t * (12 + h3 * 8), H); g.fillStyle = ['#c8a030', '#a85a20', '#6a9a30'][i % 3]; g.save(); g.translate(cx + x, cy + y); g.rotate(t * 2 + i); g.fillRect(-1.5, -.7, 3, 1.4); g.restore(); }
      else if (kind === 'vagalumes') { x = wrap(h1 * W + Math.sin(t * .5 + i * 2) * 20, W); y = wrap(h2 * H + Math.cos(t * .4 + i) * 14, H); const a = .4 + .6 * Math.max(0, Math.sin(t * 2 + i * 3)); g.fillStyle = `rgba(220,255,120,${a})`; g.fillRect(cx + x, cy + y, 1.2, 1.2); }
    }
    if (kind === 'nevoa') for (let i = 0; i < 6; i++) { const x = wrap(hash(i, 5) * W * 1.5 + t * (4 + i), W * 1.5) - W * .25, y = hash(i, 6) * H, gr = g.createRadialGradient(cx + x, cy + y, 0, cx + x, cy + y, 70); gr.addColorStop(0, 'rgba(200,220,200,.18)'); gr.addColorStop(1, 'rgba(200,220,200,0)'); g.fillStyle = gr; g.fillRect(cx + x - 70, cy + y - 70, 140, 140); }
  },
  mob(m, t) {
    const g = this.g, M = MOBS[m.k] || MOBS.geleia, frame = Math.floor(t * ((M.look || m.k) === 'geleia' ? 3 : 7) + m.id) % 2, spr = mobSprite(m.k, frame), sc = mobSize(M);
    this.shadow(m.x, m.y + 1, M.r * sc / (M.boss ? 2 : 1));
    g.save(); g.translate(Math.round(m.x), Math.round(m.y)); if (Math.cos(m.f) < 0) g.scale(-1, 1); g.scale(sc, sc);
    g.drawImage(m.hurt ? variant(spr, 'flash') : m.wind ? variant(spr, 'warn') : spr, -Math.floor(spr.width / 2), -spr.height + 1);
    if (M.boss && (M.look || m.k) === 'rei') { const c = sprite(SPR.coroa, PAL.coroa, 'coroa'); g.drawImage(c, -3, -spr.height - 3); }
    g.restore();
    if (m.wind) { g.fillStyle = '#fff'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText('!', m.x, m.y - M.r * sc - 12); }
  },
  drop(d, t) {
    const g = this.g, y = d.y - 3 + Math.sin(t * 3 + d.id) * 1.5;
    this.shadow(d.x, d.y + 1, 3);
    g.font = '8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ITEMS[d.it].e, d.x, y); g.textBaseline = 'alphabetic';
  },
  proj(p) {
    const g = this.g, a = Math.atan2(p.vy, p.vx);
    g.save(); g.translate(p.x, p.y - 6); g.rotate(a);
    if (p.k === 'faca') { g.rotate(performance.now() / 60); g.fillStyle = '#e8eef4'; g.fillRect(-1, -.5, 4, 1); g.fillStyle = '#3a2a20'; g.fillRect(-3, -.5, 2, 1); }
    else if (p.k === 'flecha' || p.k === 'flecha_m') { g.fillStyle = p.k === 'flecha' ? '#e8e0c8' : '#a07050'; g.fillRect(-5, -.5, 8, 1); g.fillStyle = '#c0c0c0'; g.fillRect(3, -1, 2, 2); }
    else if (p.k === 'faisca') { g.fillStyle = '#a0c8ff'; g.fillRect(-4, -1, 5, 2); g.fillStyle = '#fff'; g.fillRect(0, -1.5, 3, 3); }
    else if (p.k === 'fogo') { g.fillStyle = '#e04010'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill(); g.fillStyle = '#ffd040'; g.beginPath(); g.arc(1, 0, 2, 0, TAU); g.fill(); }
    else if (p.k === 'osso_m') { g.rotate(performance.now() / 80); g.fillStyle = '#e8e2d0'; g.fillRect(-3, -1, 6, 2); g.fillRect(-4, -2, 2, 4); g.fillRect(2, -2, 2, 4); }
    g.restore();
  },
  shadow(x, y, r) { const g = this.g; g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y, r, r * .4, 0, 0, TAU); g.fill(); },
  bar(x, y, w, f, col) { const g = this.g; g.fillStyle = '#1b1620'; g.fillRect(x - .5, y - .5, w + 1, 3); g.fillStyle = '#4a2020'; g.fillRect(x, y, w, 2); g.fillStyle = col; g.fillRect(x, y, w * clamp(f, 0, 1), 2); },
  label(s, x, y, col) { const g = this.g; g.font = '6px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillText(s, x + .4, y + .4); g.fillStyle = col; g.fillText(s, x, y); },

  /* efeitos de curta duração */
  addFx(e) { this.fx.push({ ...e, t0: performance.now() }); },
  drawFx(now) {
    const g = this.g;
    this.fx = this.fx.filter(e => {
      const age = (now - e.t0) / 1000, life = e.life || .4; if (age > life) return false;
      const k = age / life;
      switch (e.k) {
        case 'arc': g.strokeStyle = `rgba(255,255,240,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.arc(e.x, e.y - 6, 18, e.a - .7 + k * .4, e.a + .7 + k * .4); g.stroke(); break;
        case 'mswing': g.strokeStyle = `rgba(255,120,100,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y - 5, e.r || 14, e.a - .8, e.a + .8); g.stroke(); break;
        case 'spin': g.strokeStyle = `rgba(255,255,240,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.arc(e.x, e.y - 5, 10 + k * 28, 0, TAU); g.stroke(); break;
        case 'boom': g.fillStyle = `rgba(255,${160 - k * 120},40,${.8 * (1 - k)})`; g.beginPath(); g.arc(e.x, e.y - 4, e.r * (.4 + k * .6), 0, TAU); g.fill(); break;
        case 'heal': case 'lvl': g.strokeStyle = e.k === 'lvl' ? `rgba(255,220,80,${1 - k})` : `rgba(100,255,120,${1 - k})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(e.x, e.y - k * 14, 8, 3, 0, 0, TAU); g.stroke(); break;
        case 'die': case 'summon': for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.fillStyle = e.k === 'summon' ? `rgba(120,220,255,${1 - k})` : `rgba(240,240,240,${1 - k})`; g.fillRect(e.x + Math.cos(a) * k * 14, e.y - 4 + Math.sin(a) * k * 10, 2, 2); } break;
        case 'text': g.font = (e.big ? 'bold 9px' : 'bold 7px') + ' sans-serif'; g.textAlign = 'center'; g.fillStyle = `rgba(0,0,0,${1 - k})`; g.fillText(e.s, e.x + .5, e.y - k * 14 + .5); g.fillStyle = e.col; g.globalAlpha = 1 - k * k; g.fillText(e.s, e.x, e.y - k * 14); g.globalAlpha = 1; break;
      }
      return true;
    });
  },
  lighting(st, RC, t, dark) {                     // regiões escuras: luz em volta dos heróis, tochas e lava
    const L = this.light, w = Math.ceil(this.cw), h = Math.ceil(this.ch); if (L.width !== w || L.height !== h) { L.width = w; L.height = h; }
    const g = L.getContext('2d'), [cx, cy] = this.cam;
    g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(6,4,10,${dark})`; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => { const gr = g.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.6, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - cx - r, y - cy - r, r * 2, r * 2); };
    hole(st.me.x, st.me.y - 6, 80);
    for (const o of st.others.values()) hole(o.x, o.y - 6, 70);
    for (const [x, y, r] of RC.torches) hole(x, y, r + Math.sin(t * 9 + x) * 3);
    for (const p of st.projs.values()) if (p.k === 'fogo' || p.k === 'faisca') hole(p.x, p.y, 30);
    this.g.imageSmoothingEnabled = true; this.g.drawImage(L, cx, cy); this.g.imageSmoothingEnabled = false;
  },
};
