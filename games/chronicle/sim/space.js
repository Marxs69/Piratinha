/* Grand Chronicle — simulação: espaço (fim de jogo). */
'use strict';

/* ---------- espaço (fim de jogo): satélites, sonda, pouso, base lunar e, com sorte, vida inteligente na lua ---------- */
function generateMoon(seed) {
  const r = mkRng(seed ^ 0x3007), [type, col] = MOON_TYPES[r() * MOON_TYPES.length | 0], cul = CULTURES[r() * CUL_MAJOR | 0], used = new Set();
  const x = r(), life = x < .72 ? 'none' : x < .86 ? 'micro' : x < .95 ? 'complex' : 'intel';
  const civs = life === 'intel' ? Array.from({ length: 1 + (r() * 3 | 0) }, () => { const era = r() * ALIEN_ERAS.length | 0; return { n: nameGen(CULTURES[r() * CUL_MAJOR | 0], r, used), era, aggro: r() < .45, pow: Math.round((era + 1) ** 2 * (20 + r() * 40)), rel: {} }; }) : [];
  const craters = Array.from({ length: 14 }, () => [r() * 2 - 1, r() * 2 - 1, .05 + r() * .18]);
  return { n: nameGen(cul, r, used), type, col, grav: Math.round((.1 + r() * .3) * 100) / 100, life, civs, craters, known: {}, landed: {}, base: {} };
}
const launchOk = n => (n.bfx || {}).launch > 0;
const SPACE = {
  sat: { n: 'Satélite', tech: 'spc_sat', c: 300, m: 4 }, probe: { n: 'Sonda lunar', tech: 'spc_probe', c: 600, m: 8 },
  land: { n: 'Pouso tripulado', tech: 'spc_landing', c: 1200, m: 12 }, base: { n: 'Base lunar', tech: 'spc_base', c: 2000, m: 18 },
};
const spaceCost = k => Math.round(SPACE[k].c * eraScale());
function canSpace(n, k) {
  const d = SPACE[k], M = S.moon; if (!hasT(n, d.tech)) return 'Exige ' + TECH[d.tech].n; if (!launchOk(n)) return 'Exige centro de lançamento';
  if (n.sproj) return 'Já há uma missão em andamento'; if (n.money < spaceCost(k)) return 'Sem dinheiro';
  if (k === 'sat' && (n.sats || 0) >= 20) return 'Órbita cheia (20)'; if (k === 'probe' && M.known[n.id]) return 'A lua já foi sondada';
  if (k === 'land' && (!M.known[n.id] || M.landed[n.id])) return M.landed[n.id] ? 'Já pousou' : 'Sonde a lua antes';
  if (k === 'base' && (!M.landed[n.id] || M.base[n.id])) return M.base[n.id] ? 'Base já construída' : 'Pouse antes';
  return '';
}
function spaceGo(n, k) { const e = canSpace(n, k); if (e) return e; n.money -= spaceCost(k); n.sproj = { k, m: SPACE[k].m, tot: SPACE[k].m }; return ''; }
function spaceDone(n, k) {
  const M = S.moon, first = k !== 'sat' && !Object.keys(k === 'probe' ? M.known : k === 'land' ? M.landed : M.base).length, rk = ROCKETS[n.vert || 'none'];
  if (k === 'sat') n.sats = (n.sats || 0) + 1;
  if (k === 'probe') { M.known[n.id] = 1; const lifeT = { none: 'sem vida', micro: 'com vida microscópica', complex: 'com fauna e flora complexas', intel: 'com vida inteligente: ' + M.civs.length + ' civilização' + (M.civs.length > 1 ? 'ões' : '') }[M.life]; notify(n.id, '🌑 ' + M.n, 'A sonda (' + rk + ') chegou a ' + M.n + ': lua ' + M.type.toLowerCase() + ', gravidade ' + M.grav + 'g, ' + lifeT + '.'); }
  if (k === 'land') { M.landed[n.id] = 1; n.stab = Math.min(100, n.stab + 10); }
  if (k === 'base') M.base[n.id] = 1;
  log((k === 'sat' ? natName(n) + ' pôs um satélite em órbita' : (first ? 'Pela primeira vez na história, ' : '') + natName(n) + ' concluiu: ' + SPACE[k].n + ' em ' + M.n) + ' (' + rk + ').', isHuman(n.id) ? 'good' : first ? 'world' : 'none', [n.id]);
}
function alienAct(n, ci, kind) {                             // contato, comércio, presente ou guerra com uma civilização da lua
  const c = S.moon.civs[ci]; if (!c) return 'Inválido'; if (!hasT(n, 'spc_contact') || !S.moon.known[n.id]) return 'Exige Protocolos de contato e sondar a lua';
  c.rel[n.id] = c.rel[n.id] || 0;
  if (kind === 'gift') { const cost = Math.round(200 * eraScale()); if (n.money < cost) return 'Sem dinheiro'; n.money -= cost; c.rel[n.id] += 25; return ''; }
  if (kind === 'trade') { if (c.rel[n.id] < (c.aggro ? 40 : 0)) return 'Eles não confiam em você'; if (c.trade && c.trade.includes(n.id)) return 'Já há comércio'; (c.trade = c.trade || []).push(n.id); n.alienTrade = (n.alienTrade || 0) + 1; log(natName(n) + ' abriu comércio com ' + c.n + '.', 'world', [n.id]); return ''; }
  if (kind === 'war') {
    if (!S.moon.base[n.id]) return 'Exige base lunar'; const mine = strength(n) * (1 + (n.sats || 0) * .02);
    if (mine * (.6 + rnd() * .8) > c.pow * 5) { c.subj = n.id; c.aggro = false; n.alienTrade = (n.alienTrade || 0) + 2; n.stab = Math.min(100, n.stab + 15); log(natName(n) + ' subjugou ' + c.n + '!', 'world', [n.id]); return ''; }
    S.moon.base[n.id] = 0; n.stab = Math.max(0, n.stab - 15); log(c.n + ' destruiu a base lunar de ' + natName(n) + '.', 'world', [n.id]); return 'A ofensiva falhou: a base foi destruída';
  }
  return '';
}
function alienTick() {                                        // civilizações agressivas atacam bases e, se avançadas, a própria Terra
  const M = S.moon; if (!M || M.life !== 'intel') return;
  M.civs.forEach(c => {
    if (!c.aggro || c.era < 4 || c.subj != null) return;
    S.nations.forEach(n => {
      if (!n.alive) return;
      if (M.base[n.id] && chance(.01)) { const def = strength(n) * (1 + (n.sats || 0) * .02); if (def * rnd() < c.pow * 3) { M.base[n.id] = 0; log(c.n + ' atacou e destruiu a base lunar de ' + natName(n) + '.', isHuman(n.id) ? 'bad' : 'world', [n.id]); notify(n.id, '👽 Ataque à base lunar', c.n + ' destruiu sua base em ' + M.n + '.'); } }
      if (c.era >= 7 && M.known[n.id] && chance(.003)) { const ps = provsOf(n.id); if (ps.length) { const p = pickR(ps); S.pop[p] *= .9; n.stab = Math.max(0, n.stab - 5); log(c.n + ' atacou ' + WD.provs[p].n + ' vindo da lua!', isHuman(n.id) ? 'bad' : 'world', [n.id]); } }
    });
  });
}
