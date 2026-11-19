/* Grand Chronicle — bandeiras no estilo heráldico do Armoria, sempre retangulares (3:2), em SVG.
   Modelo: { d: partição, t: [esmalte 1, 2, 3], o: peça honrosa { k, t } | null, c: móvel { k, t, n, at } | null }.
   Esmaltes seguem a regra heráldica: metal (prata, ouro) sobre cor e cor sobre metal. */
'use strict';

const TINCT = {
  argent: { n: 'Prata', c: '#fafafa', metal: 1 }, or: { n: 'Ouro', c: '#ffd43b', metal: 1 },
  gules: { n: 'Vermelho', c: '#d7374a' }, azure: { n: 'Azul', c: '#2f6fc9' }, vert: { n: 'Verde', c: '#26a65b' },
  purpure: { n: 'Púrpura', c: '#5e2d79' }, sable: { n: 'Negro', c: '#2b2b2b' }, tenne: { n: 'Laranja', c: '#d9822b' },
  celeste: { n: 'Celeste', c: '#74b9e8' }, sanguine: { n: 'Sanguíneo', c: '#7b2b2b' }, murrey: { n: 'Amora', c: '#8c1c5a' },
};
const T_IDS = Object.keys(TINCT), T_METAL = T_IDS.filter(t => TINCT[t].metal), T_COLOR = T_IDS.filter(t => !TINCT[t].metal);

const DIVS = { plain: 'Lisa', pale: 'Partida em pala', fess: 'Cortada', bend: 'Fendida em banda', bendsin: 'Fendida em barra', quarterly: 'Esquartelada', saltire: 'Em aspa', tpale: 'Terciada em pala', tfess: 'Terciada em faixa', chevron: 'Em asna', gyronny: 'Gironada', barry: 'Burelada', paly: 'Palada', checky: 'Xadrezada', hoist: 'Com tralha', triangle: 'Com triângulo' };
const ORDS = { none: 'Nenhuma', cross: 'Cruz', nordic: 'Cruz nórdica', saltire: 'Aspa', pale: 'Pala', fess: 'Faixa', bend: 'Banda', bendsin: 'Barra', chief: 'Chefe', bordure: 'Bordadura', canton: 'Cantão', chevron: 'Asna', pall: 'Pairle', triangle: 'Triângulo', bars: 'Duas faixas' };
const CHARGES = { none: 'Nenhum', star5: 'Estrela', star6: 'Estrela de seis', star8: 'Estrela de oito', crescent: 'Crescente', sun: 'Sol', roundel: 'Besante', annulet: 'Anel', lozenge: 'Losango', cross_patty: 'Cruz pátea', crown: 'Coroa', tower: 'Torre', sword: 'Espada', anchor: 'Âncora', hammer: 'Martelo', gear: 'Engrenagem', atom: 'Átomo', tree: 'Árvore', fleur: 'Flor-de-lis', key: 'Chave', eye: 'Olho', heart: 'Coração', mountain: 'Montanha', bolt: 'Raio', wheat: 'Trigo', skull: 'Caveira', wing: 'Asa', chip: 'Circuito' };
const CPOS = { center: 'Centro', canton: 'Cantão', hoist: 'Tralha', row: 'Em faixa', chief: 'No chefe', circle: 'Em círculo' };

const r3 = x => Math.round(x * 100) / 100;
const starPts = (k, ri) => { const p = []; for (let i = 0; i < k * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / k, rr = i % 2 ? ri : 1; p.push(r3(Math.cos(a) * rr) + ',' + r3(Math.sin(a) * rr)); } return p.join(' '); };
const gearPath = () => { let d = ''; const n = 10; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + .5) / n * Math.PI * 2, w = Math.PI / n * .45; [[a - w, .72], [a - w * .6, 1], [a + w * .6, 1], [a + w, .72], [b - w, .72], [b + w, .72]].forEach(([t, rr], k) => { d += (i === 0 && k === 0 ? 'M' : 'L') + r3(Math.cos(t) * rr) + ' ' + r3(Math.sin(t) * rr); }); } return d + 'Z M0.32 0 A0.32 0.32 0 1 0 -0.32 0 A0.32 0.32 0 1 0 0.32 0Z'; };
const sunRays = () => { let d = ''; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, w = .13; d += `M${r3(Math.cos(a - w) * .55)} ${r3(Math.sin(a - w) * .55)}L${r3(Math.cos(a) * 1)} ${r3(Math.sin(a) * 1)}L${r3(Math.cos(a + w) * .55)} ${r3(Math.sin(a + w) * .55)}Z`; } return d; };
/* móveis num quadrado de -1 a 1; f = preenchido, s = traço (largura relativa) */
const CHG = {
  star5: { f: `<polygon points="${starPts(5, .4)}"/>` }, star6: { f: `<polygon points="${starPts(6, .5)}"/>` }, star8: { f: `<polygon points="${starPts(8, .55)}"/>` },
  crescent: { f: '<path fill-rule="evenodd" d="M0.3 -0.92A0.95 0.95 0 1 0 0.3 0.92A0.74 0.74 0 1 1 0.3 -0.92Z"/>' },
  sun: { f: `<circle r="0.45"/><path d="${sunRays()}"/>` }, roundel: { f: '<circle r="0.8"/>' },
  annulet: { f: '<path fill-rule="evenodd" d="M0.8 0A0.8 0.8 0 1 0 -0.8 0A0.8 0.8 0 1 0 0.8 0ZM0.5 0A0.5 0.5 0 1 0 -0.5 0A0.5 0.5 0 1 0 0.5 0Z"/>' },
  lozenge: { f: '<polygon points="0,-1 0.65,0 0,1 -0.65,0"/>' },
  cross_patty: { f: '<path d="M-0.18 -0.25L-0.42 -0.95H0.42L0.18 -0.25L0.95 -0.42V0.42L0.18 0.18L0.42 0.95H-0.42L-0.18 0.18L-0.95 0.42V-0.42Z"/>' },
  crown: { f: '<path d="M-0.85 0.55L-0.95 -0.45L-0.45 -0.05L0 -0.7L0.45 -0.05L0.95 -0.45L0.85 0.55Z"/><rect x="-0.85" y="0.62" width="1.7" height="0.25"/><circle cx="-0.95" cy="-0.55" r="0.12"/><circle cx="0" cy="-0.82" r="0.12"/><circle cx="0.95" cy="-0.55" r="0.12"/>' },
  tower: { f: '<path d="M-0.6 0.95V-0.45H-0.75V-0.95H-0.45V-0.7H-0.15V-0.95H0.15V-0.7H0.45V-0.95H0.75V-0.45H0.6V0.95H0.2V0.45A0.2 0.2 0 0 0 -0.2 0.45V0.95Z"/>' },
  sword: { f: '<path d="M-0.08 0.45V-0.95L0 -1.05L0.08 -0.95V0.45Z"/><rect x="-0.45" y="0.45" width="0.9" height="0.12"/><rect x="-0.07" y="0.57" width="0.14" height="0.32"/><circle cy="0.95" r="0.1"/>' },
  anchor: { s: '<path d="M0 -0.7V0.9M-0.45 -0.35H0.45M-0.8 0.3Q-0.6 0.9 0 0.9Q0.6 0.9 0.8 0.3"/><circle cy="-0.82" r="0.15"/>', w: .16 },
  hammer: { f: '<path d="M-0.75 -0.9H0.55L0.75 -0.65V-0.4H-0.75Z"/><rect x="-0.1" y="-0.4" width="0.22" height="1.35"/>' },
  gear: { f: `<path fill-rule="evenodd" d="${gearPath()}"/>` },
  atom: { s: '<ellipse rx="0.95" ry="0.35"/><ellipse rx="0.95" ry="0.35" transform="rotate(60)"/><ellipse rx="0.95" ry="0.35" transform="rotate(-60)"/>', w: .09, f: '<circle r="0.16"/>' },
  tree: { f: '<polygon points="0,-1 0.55,-0.25 0.3,-0.25 0.75,0.4 -0.75,0.4 -0.3,-0.25 -0.55,-0.25"/><rect x="-0.13" y="0.4" width="0.26" height="0.55"/>' },
  fleur: { f: '<path d="M0 -1C0.25 -0.7 0.3 -0.4 0.12 0.05H-0.12C-0.3 -0.4 -0.25 -0.7 0 -1ZM0.15 0.05C0.25 -0.45 0.95 -0.55 0.85 0C0.8 0.3 0.45 0.25 0.45 0.05ZM-0.15 0.05C-0.25 -0.45 -0.95 -0.55 -0.85 0C-0.8 0.3 -0.45 0.25 -0.45 0.05ZM-0.55 0.08H0.55V0.25H-0.55ZM-0.12 0.25H0.12L0.2 0.95H-0.2Z"/>' },
  key: { s: '<circle cy="-0.55" r="0.3"/><path d="M0 -0.25V0.95M0 0.6H0.35M0 0.85H0.3"/>', w: .16 },
  eye: { f: '<path fill-rule="evenodd" d="M-1 0Q0 -0.8 1 0Q0 0.8 -1 0ZM0.32 0A0.32 0.32 0 1 0 -0.32 0A0.32 0.32 0 1 0 0.32 0Z"/><circle r="0.15"/>' },
  heart: { f: '<path d="M0 0.9C-0.9 0.25 -1 -0.3 -0.7 -0.65C-0.4 -0.95 -0.05 -0.75 0 -0.45C0.05 -0.75 0.4 -0.95 0.7 -0.65C1 -0.3 0.9 0.25 0 0.9Z"/>' },
  mountain: { f: '<polygon points="-1,0.75 -0.45,-0.35 -0.15,0.1 0.25,-0.75 1,0.75"/>' },
  bolt: { f: '<polygon points="0.25,-1 -0.55,0.12 -0.05,0.12 -0.3,1 0.6,-0.2 0.08,-0.2 0.35,-1"/>' },
  wheat: { f: '<rect x="-0.05" y="-0.6" width="0.1" height="1.55"/><ellipse cx="0" cy="-0.78" rx="0.12" ry="0.22"/><ellipse cx="-0.2" cy="-0.42" rx="0.12" ry="0.22" transform="rotate(-30 -0.2 -0.42)"/><ellipse cx="0.2" cy="-0.42" rx="0.12" ry="0.22" transform="rotate(30 0.2 -0.42)"/><ellipse cx="-0.2" cy="-0.05" rx="0.12" ry="0.22" transform="rotate(-30 -0.2 -0.05)"/><ellipse cx="0.2" cy="-0.05" rx="0.12" ry="0.22" transform="rotate(30 0.2 -0.05)"/>' },
  skull: { f: '<path fill-rule="evenodd" d="M0 -0.95C0.6 -0.95 0.85 -0.55 0.8 -0.1C0.78 0.15 0.6 0.3 0.45 0.35V0.7H-0.45V0.35C-0.6 0.3 -0.78 0.15 -0.8 -0.1C-0.85 -0.55 -0.6 -0.95 0 -0.95ZM-0.32 -0.2A0.17 0.17 0 1 0 -0.32 0.14A0.17 0.17 0 1 0 -0.32 -0.2ZM0.32 -0.2A0.17 0.17 0 1 0 0.32 0.14A0.17 0.17 0 1 0 0.32 -0.2Z"/><rect x="-0.4" y="0.75" width="0.8" height="0.2"/>' },
  wing: { f: '<path d="M-0.9 0.8C-0.9 -0.2 -0.3 -0.85 0.95 -0.9C0.6 -0.65 0.85 -0.55 0.55 -0.35C0.75 -0.25 0.55 -0.1 0.35 0.05C0.5 0.15 0.25 0.3 0.05 0.35C0.1 0.5 -0.3 0.6 -0.9 0.8Z"/>' },
  chip: { f: '<rect x="-0.55" y="-0.55" width="1.1" height="1.1" rx="0.1"/><path d="M-0.35 -0.55V-0.95M0 -0.55V-0.95M0.35 -0.55V-0.95M-0.35 0.55V0.95M0 0.55V0.95M0.35 0.55V0.95M-0.55 -0.35H-0.95M-0.55 0H-0.95M-0.55 0.35H-0.95M0.55 -0.35H0.95M0.55 0H0.95M0.55 0.35H0.95" stroke-width="0.12" stroke="currentColor"/>' },
};

function flagSVG(f, uid = '') {
  const c = t => TINCT[t] ? TINCT[t].c : '#888', [a, b, d] = f.t, out = [];
  out.push(`<rect width="300" height="200" fill="${c(a)}"/>`);
  const B = c(b), D = c(d || b);
  switch (f.d) {
    case 'pale': out.push(`<rect x="150" width="150" height="200" fill="${B}"/>`); break;
    case 'fess': out.push(`<rect y="100" width="300" height="100" fill="${B}"/>`); break;
    case 'bend': out.push(`<polygon points="0,0 300,200 0,200" fill="${B}"/>`); break;
    case 'bendsin': out.push(`<polygon points="300,0 300,200 0,200" fill="${B}"/>`); break;
    case 'quarterly': out.push(`<rect x="150" width="150" height="100" fill="${B}"/><rect y="100" width="150" height="100" fill="${B}"/>`); break;
    case 'saltire': out.push(`<polygon points="0,0 150,100 0,200" fill="${B}"/><polygon points="300,0 150,100 300,200" fill="${B}"/>`); break;
    case 'tpale': out.push(`<rect x="100" width="100" height="200" fill="${B}"/><rect x="200" width="100" height="200" fill="${D}"/>`); break;
    case 'tfess': out.push(`<rect y="66.7" width="300" height="66.7" fill="${B}"/><rect y="133.3" width="300" height="66.7" fill="${D}"/>`); break;
    case 'chevron': out.push(`<polygon points="0,200 150,85 300,200" fill="${B}"/>`); break;
    case 'gyronny': for (let i = 0; i < 8; i += 2) { const p = [[0, 0], [150, 0], [300, 0], [300, 100], [300, 200], [150, 200], [0, 200], [0, 100]]; out.push(`<polygon points="150,100 ${p[i]} ${p[(i + 1) % 8]}" fill="${B}"/>`); } break;
    case 'barry': { const n = f.k || 7, h = 200 / n; for (let i = 1; i < n; i += 2) out.push(`<rect y="${r3(i * h)}" width="300" height="${r3(h)}" fill="${B}"/>`); break; }
    case 'paly': { const n = f.k || 5, w = 300 / n; for (let i = 1; i < n; i += 2) out.push(`<rect x="${r3(i * w)}" width="${r3(w)}" height="200" fill="${B}"/>`); break; }
    case 'checky': for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2) out.push(`<rect x="${x * 50}" y="${y * 50}" width="50" height="50" fill="${B}"/>`); break;
    case 'hoist': out.push(`<rect width="100" height="200" fill="${B}"/>`); break;
    case 'triangle': out.push(`<polygon points="0,0 140,100 0,200" fill="${B}"/>`); break;
  }
  const o = f.o;
  if (o && o.k !== 'none') {
    const C = c(o.t);
    switch (o.k) {
      case 'cross': out.push(`<rect x="128" width="44" height="200" fill="${C}"/><rect y="78" width="300" height="44" fill="${C}"/>`); break;
      case 'nordic': out.push(`<rect x="82" width="40" height="200" fill="${C}"/><rect y="80" width="300" height="40" fill="${C}"/>`); break;
      case 'saltire': out.push(`<path d="M0 0L300 200M300 0L0 200" stroke="${C}" stroke-width="38"/>`); break;
      case 'pale': out.push(`<rect x="105" width="90" height="200" fill="${C}"/>`); break;
      case 'fess': out.push(`<rect y="68" width="300" height="64" fill="${C}"/>`); break;
      case 'bend': out.push(`<path d="M0 0L300 200" stroke="${C}" stroke-width="48"/>`); break;
      case 'bendsin': out.push(`<path d="M300 0L0 200" stroke="${C}" stroke-width="48"/>`); break;
      case 'chief': out.push(`<rect width="300" height="56" fill="${C}"/>`); break;
      case 'bordure': out.push(`<path fill-rule="evenodd" d="M0 0H300V200H0ZM18 18V182H282V18Z" fill="${C}"/>`); break;
      case 'canton': out.push(`<rect width="125" height="95" fill="${C}"/>`); break;
      case 'chevron': out.push(`<path d="M-10 200L150 70L310 200" fill="none" stroke="${C}" stroke-width="40"/>`); break;
      case 'pall': out.push(`<path d="M0 0L150 100L0 200M150 100H300" fill="none" stroke="${C}" stroke-width="34"/>`); break;
      case 'triangle': out.push(`<polygon points="0,0 130,100 0,200" fill="${C}"/>`); break;
      case 'bars': out.push(`<rect y="40" width="300" height="26" fill="${C}"/><rect y="134" width="300" height="26" fill="${C}"/>`); break;
    }
  }
  const ch = f.c;
  if (ch && ch.k !== 'none' && CHG[ch.k]) {
    const g = CHG[ch.k], C = c(ch.t), place = [];
    const n = Math.max(1, Math.min(3, ch.n || 1));
    switch (ch.at) {
      case 'canton': place.push([62, 47, 30]); break;
      case 'hoist': place.push([52, 100, 34]); break;
      case 'chief': [75, 150, 225].forEach(x => place.push([x, 28, 18])); break;
      case 'row': [75, 150, 225].slice(0, Math.max(2, n)).forEach((x, i, arr) => place.push([arr.length === 2 ? [100, 200][i] : x, 100, 30])); break;
      case 'circle': { const k = ch.k === 'star5' || ch.k === 'star6' ? 12 : 8; for (let i = 0; i < k; i++) { const a = i / k * Math.PI * 2; place.push([150 + Math.cos(a) * 55, 100 + Math.sin(a) * 55, 11]); } break; }
      default: if (n === 1) place.push([150, 100, 62]); else if (n === 2) place.push([105, 100, 38], [195, 100, 38]); else place.push([150, 62, 32], [105, 135, 32], [195, 135, 32]);
    }
    place.forEach(([x, y, s]) => {
      let inner = '';
      if (g.f) inner += `<g fill="${C}" color="${C}">${g.f}</g>`;
      if (g.s) inner += `<g fill="none" stroke="${C}" stroke-width="${g.w}" stroke-linecap="round">${g.s}</g>`;
      out.push(`<g transform="translate(${r3(x)} ${r3(y)}) scale(${r3(s)})">${inner}</g>`);
    });
  }
  const id = 'fg' + uid;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient><clipPath id="${id}c"><rect width="300" height="200"/></clipPath></defs><g clip-path="url(#${id}c)">${out.join('')}</g><rect width="300" height="200" fill="url(#${id})"/><rect x="1" y="1" width="298" height="198" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/></svg>`;
}

/* esmalte visível num ponto (x, y) da bandeira, contando partição e peça honrosa */
function tinctAt(f, x, y) {
  const o = f.o, [a, b, c] = f.t, dl = (x0, y0, x1, y1) => Math.abs((y1 - y0) * x - (x1 - x0) * y + x1 * y0 - y1 * x0) / Math.hypot(x1 - x0, y1 - y0);
  if (o && o.k !== 'none') {
    const hit = { cross: Math.abs(x - 150) < 22 || Math.abs(y - 100) < 22, nordic: Math.abs(x - 102) < 20 || Math.abs(y - 100) < 20, saltire: dl(0, 0, 300, 200) < 19 || dl(300, 0, 0, 200) < 19,
      pale: Math.abs(x - 150) < 45, fess: Math.abs(y - 100) < 32, bend: dl(0, 0, 300, 200) < 24, bendsin: dl(300, 0, 0, 200) < 24, chief: y < 56, bordure: x < 18 || x > 282 || y < 18 || y > 182,
      canton: x < 125 && y < 95, chevron: Math.abs(y - (200 - (1 - Math.abs(x - 150) / 160) * 130)) < 20, pall: (x < 150 && Math.abs(y - 100 - (x - 150) * 100 / 150 * (y < 100 ? 1 : -1)) < 17) || (x >= 150 && Math.abs(y - 100) < 17),
      triangle: x < 130 * (1 - Math.abs(y - 100) / 100), bars: (y > 40 && y < 66) || (y > 134 && y < 160) }[o.k];
    if (hit) return o.t;
  }
  switch (f.d) {
    case 'pale': return x < 150 ? a : b; case 'fess': return y < 100 ? a : b;
    case 'bend': return y > x * 2 / 3 ? b : a; case 'bendsin': return y > 200 - x * 2 / 3 ? b : a;
    case 'quarterly': return (x >= 150) !== (y >= 100) ? b : a; case 'saltire': return Math.abs(x - 150) / 150 > Math.abs(y - 100) / 100 ? b : a;
    case 'tpale': return x < 100 ? a : x < 200 ? b : (c || b); case 'tfess': return y < 66.7 ? a : y < 133.3 ? b : (c || b);
    case 'chevron': return y > 200 - (1 - Math.abs(x - 150) / 150) * 115 ? b : a;
    case 'gyronny': { const s = Math.floor((Math.atan2(y - 100, x - 150) + Math.PI) / (Math.PI / 4)); return s % 2 ? a : b; }
    case 'barry': return Math.floor(y / (200 / (f.k || 7))) % 2 ? b : a; case 'paly': return Math.floor(x / (300 / (f.k || 5))) % 2 ? b : a;
    case 'checky': return ((x / 50 | 0) + (y / 50 | 0)) % 2 ? b : a; case 'hoist': return x < 100 ? b : a;
    case 'triangle': return x < 140 * (1 - Math.abs(y - 100) / 100) ? b : a;
  }
  return a;
}
const CHARGE_AT = { center: [150, 100], canton: [62, 47], hoist: [52, 100], chief: [150, 28], row: [150, 100], circle: [205, 100] };

/* aleatória, respeitando a regra dos esmaltes; ideologia/época podem puxar certos móveis */
function flagRandom(r, hint) {
  const pk = a => a[r() * a.length | 0], wp = ws => { let s = 0; for (const k in ws) s += ws[k]; let x = r() * s; for (const k in ws) { x -= ws[k]; if (x <= 0) return k; } return Object.keys(ws)[0]; };
  const metalFirst = r() < .45, t0 = metalFirst ? pk(T_METAL) : pk(T_COLOR);
  const opp = t => TINCT[t].metal ? pk(T_COLOR) : pk(T_METAL), diff = (t, not) => { let x; do x = pk(T_COLOR); while (x === t || x === not); return x; };
  const d = wp({ plain: 8, pale: 3, fess: 4, bend: 2, bendsin: 1, quarterly: 2, saltire: 1, tpale: 6, tfess: 7, chevron: 1, gyronny: .6, barry: 2, paly: 1, checky: .4, hoist: 2, triangle: 2 });
  let t1 = d === 'tpale' || d === 'tfess' ? (r() < .5 ? opp(t0) : diff(t0)) : opp(t0), t2 = TINCT[t1].metal ? diff(t0, t1) : (r() < .5 ? pk(T_METAL) : diff(t0, t1));
  if ((d === 'tpale' || d === 'tfess') && t2 === t0) t2 = opp(t1);
  const f = { d, t: [t0, t1, t2], o: null, c: null };
  if (d === 'barry') f.k = pk([5, 7, 9, 11]); if (d === 'paly') f.k = pk([5, 7]);
  const busy = !['plain', 'pale', 'fess', 'hoist', 'triangle', 'tfess', 'tpale'].includes(d);
  if (!busy && r() < .55) {
    const k = wp({ cross: 2, nordic: 3, saltire: 1.5, pale: 1, fess: 1.5, bend: 1.5, bendsin: .5, chief: 2, bordure: 1, canton: 2.5, chevron: 1, pall: 1, triangle: 2, bars: 1.5 });
    f.o = { k, t: d === 'plain' ? opp(t0) : (r() < .5 ? pk(T_METAL) : diff(t0, t1)) };
  }
  const want = hint && hint.charge;
  if (want || r() < (busy ? .25 : .7)) {
    const k = want || wp({ star5: 5, star6: 2, star8: 1, crescent: 2.5, sun: 2.5, roundel: 1, annulet: .8, lozenge: 1, cross_patty: 2, crown: 2, tower: 1.5, sword: 1.5, anchor: 1, hammer: 1, gear: 1, tree: 1.5, fleur: 1.5, key: .7, eye: .6, heart: .4, mountain: 1, bolt: .5, wheat: 1, skull: .3, wing: .7 });
    let at = wp({ center: 6, canton: f.o && f.o.k === 'canton' ? 6 : 2, hoist: d === 'triangle' || (f.o && f.o.k === 'triangle') ? 6 : 1, row: 1, chief: f.o && f.o.k === 'chief' ? 6 : .3, circle: k === 'star5' ? .6 : .1 });
    const under = tinctAt(f, ...CHARGE_AT[at]);
    f.c = { k, t: TINCT[under].metal ? pk(T_COLOR.filter(t => t !== under)) : pk(T_METAL), n: at === 'center' ? (r() < .78 ? 1 : r() < .5 ? 2 : 3) : 1, at };
  }
  return f;
}

const flagCache = new Map();                                 // bandeira -> imagem pronta para o canvas
function flagImg(f) {
  const key = JSON.stringify(f); let im = flagCache.get(key);
  if (!im) { im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSVG(f, (flagCache.size % 9999) + 'i')); flagCache.set(key, im); }
  return im;
}
