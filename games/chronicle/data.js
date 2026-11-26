/* Grand Chronicle — dados derivados: índices e tabelas montadas a partir do conteúdo (content/*.js).
   As tabelas em si ficam em content/ (só dados, editáveis); a lógica fica em sim/. Para equilibrar, mexa nos números de content/. */
'use strict';
const { TECH_BASE, TECH_TAU, TECH_AHEAD, TECH_DIFF, ERA_FRAC, REFUSE_STAB, ALIENS, NEW_NATION, CRISIS, SEPAR, STAB_SOFT, WEX, START_YEAR, END_YEAR, YEAR_CAP, FUTURE_START, VERT_DECLINE, BUILD_SLOW, WIDTH_BASE, LOGI_BASE, SHIP_CAP, COUNCIL_TRAIT_W, HOARD_MONTHS, HOARD_MIN, HOARD_LEAK, APPOINT_CD, APPOINT_CD_DEATH, PRICE_BASE, PRICE_EXP, PRICE_LAG } = CONTENT.DEFINES;
const FLAVOR = CONTENT.FLAVOR || {};
const { NAV_DOCS, VERT_DOC, EXPLORE_ERA, FAITH_RULES, GOODS, SUBSIST, CLASSES, JOBS, JOB_N, BFX_CAP, REQS, BUILDINGS, BGROUPS, SVC, CATS, VERTS, VUNITS, NEEDS, VERT_SUF, VERT_SUF_TECHS, VERT_UPFX, GOVS, RANK_N, RANK_CAP, RANK_REQ, DOMAIN, RANK_SLOTS, RANKSET, IDEOS, MODS, LAWS, LAW_DEF, CPOL, RPOL_N, CUL_SLOTS, REL_SLOTS, DIPLO, DIP_ACC, DIP_DRIFT, INTERACT, PLOT, SPY, PEACE, WAR_END, COUP_GOVS, ELECT_FORMS, COUNCIL_MODE, ENACT, GOV_TR, SLAVE_REB, SUBJECTS, SUBJ_PROG, SUBJ_ACTS, SUBJ_BACK, SUBJ_LAWS, SUBJ_LAW_DEF, UNITS, UNIT_BASE, UNIT_ERA, UNIT_NEEDS, VERT_UNIT_NEED, VET, SUPPORT, STANCES, AI_FRONT, PURSUIT, SHIPS, TERRAIN, ERAS, ERA_LIM, DISEASES, PANDEMICS, INVASIONS, WORLD_EVENTS, ROCKETS, MOON_TYPES, ALIEN_ERAS, TRAITS, STATS, ROLE_NAMES, SECRETS, SCHEMES, TUTOR_TR, TRAIT_OPP, COUNCIL, LANGS, COLD_FAMS, CUL_LIST, RELIGIONS, FAITH_GRP, DOC_POOL, HEAD_POOL, HOLY_POOL, GRP_D, DOCTRINES, TENETS, REFORMS, FERV } = CONTENT;
/* embaralha uma cópia com o sorteio dado (Fisher–Yates): mesma ordem em qualquer navegador. Nunca usar sort(() => r() - .5), que muda de motor para motor */
const shuffleR = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r() * (i + 1) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
const EVENTS = CONTENT.EVENTS, EVENT = Object.fromEntries(EVENTS.map(e => [e.id, e]));

/* faixa da agressividade (pm.war) dos traços, para a cautela do avanço da IA (sim/ai.js advCaution): menor e maior valor isolado, contando o neutro 1 */
const TRAIT_WAR = (() => { let lo = 1, hi = 1; for (const k in TRAITS) { const w = TRAITS[k].pm && TRAITS[k].pm.war; if (w != null) { lo = Math.min(lo, w); hi = Math.max(hi, w); } } return { lo, hi }; })();
const GOOD_IDS = Object.keys(GOODS);

const CLASS_IDS = Object.keys(CLASSES);
function classNeeds(year, k) {
  const t = Math.max(0, Math.min(1, (year - 860) / 900)), ti = Math.max(0, Math.min(1, (year - 1760) / 200)), t2 = Math.max(0, Math.min(1, (year - 1950) / 250));
  const pw = year < 1890 ? 0 : .01 + .05 * Math.min(1, (year - 1890) / 110) + .12 * t2, el = year < 1950 ? 0 : .01 + .12 * t2, rt = year < 1830 ? 0 : Math.min(1, (year - 1830) / 120);   // rt: viagens de trem
  if (k === 'slave') return { staple: .85 };
  if (k === 'low') return { staple: 1, clothes: .025 + .015 * t + .04 * ti, goods: .01 + .012 * t + .06 * ti + .08 * t2, pfood: .03 * ti + .1 * t2, power: pw * .7, elec: el * .6, transit: .008 * rt };
  if (k === 'mid') return { staple: .8, pfood: .12 + .1 * t + .2 * ti, clothes: .07 + .04 * t + .08 * ti, goods: .06 + .05 * t + .15 * ti + .15 * t2, lux: .002 + .004 * t + .01 * ti, tools: .01, power: pw * 1.4, elec: el * 1.6, transit: .03 * rt, svc: 1 };
  return { staple: .6, pfood: .35 + .2 * ti, clothes: .18 + .1 * ti, goods: .2 + .2 * ti + .2 * t2, lux: .04 + .07 * t + .12 * ti, power: pw * 2.5, elec: el * 3, transit: .05 * rt, svc: 1 };
}

const TECHS = [];
const T = (id, c, y, n, req, fx) => TECHS.push({ id, c, y, n, req: req || [], fx: fx || {} });
CONTENT.TECHS.forEach(a => T(...a));
const TECH = Object.fromEntries(TECHS.map(t => [t.id, t]));

/* vertentes: índice, técnicas de entrada, versões das técnicas comuns e melhorias próprias (montadas de CONTENT.VERTS) */
const VERT = Object.fromEntries(VERTS.map(v => [v.id, v]));
/* sufixo da vertente só nas técnicas da lista (armas, navios, transporte, indústria), e nunca repetido ("Navio a vapor a vapor") */
const SUF_OK = new Set(VERT_SUF_TECHS), sufName = (n, v) => n.toLowerCase().includes(VERT_SUF[v].toLowerCase()) ? n : n + ' ' + VERT_SUF[v];
VERTS.forEach(v => {
  const add = t => { TECHS.push(t); TECH[t.id] = t; };
  add({ id: 'v_' + v.id, c: v.entry.c, v: v.id, entry: true, y: v.entry.y, n: v.entry.n, req: v.entry.req, fx: {}, src: [] });
  const base = TECHS.filter(t => !t.v && t.y > v.entry.y), cid = id => 'vr_' + v.id + '_' + id;
  base.forEach(t => add({ id: cid(t.id), c: t.c, v: v.id, vr: t.id, y: t.y, n: SUF_OK.has(t.id) ? sufName(t.n, v.id) : t.n, req: t.req.map(q => TECH[q] && !TECH[q].v && TECH[q].y > v.entry.y ? cid(q) : q), fx: {}, src: [t.id] }));
  v.rep = new Set(base.map(t => t.id)); v.len = v.tree.length;
  let last = 'v_' + v.id;
  v.tree.forEach(([y, c, n], k) => { const id = 'v_' + v.id + '_' + k; add({ id, c: 'vert', area: c, v: v.id, vt: true, y, n, req: [last], fx: VERT_UPFX[c] || {}, src: [] }); last = id; });
});
/* efeitos de uma técnica (a versão da vertente usa os da técnica comum que substitui) */
const techFx = t => t.vr ? TECH[t.vr].fx : t.fx;

const eraOf = y => { let e = ERAS[0][1]; for (const [a, n] of ERAS) if (y >= a) e = n; return e; };
/* era do país (índice em ERAS): avança com ERA_FRAC (80%) das técnicas comuns da era seguinte feitas (as da vertente contam pela versão dela) */
let ERA_CORE = null;
function natEra(n) {
  if (!ERA_CORE) ERA_CORE = ERAS.map((e, k) => k ? TECHS.filter(t => !t.v && t.y < e[0] && (k === 1 || t.y >= ERAS[k - 1][0])).map(t => t.id) : []);
  let k = 0; while (k + 1 < ERAS.length && ERA_CORE[k + 1].filter(id => hasT(n, id)).length >= ERA_CORE[k + 1].length * ERA_FRAC) k++; return k;
}
const eraLim = (n, k) => ERA_LIM[k][Math.min(ERA_LIM[k].length - 1, n.era || 0)];
const isSvcB = d => !!(d.fx && (d.fx.svc || d.fx.svcP)) && !d.max;
const capY = y => Math.min(y, YEAR_CAP);   // ano das fórmulas: depois de YEAR_CAP nada cresce com o calendário
const SVC_CAP = y => 30 * (1 + (capY(y) - 860) / 250);
/* quem presta o serviço no país: o prédio próprio (nome da época) ou, antes dele, os substitutos parciais (templo, paço) */
const svcSrc = (n, k) => n.fx.b.has(SVC[k].b) ? svcName(k, curYear()) : Object.keys(BUILDINGS).filter(b => ((BUILDINGS[b].fx || {}).svcP || {})[k]).map(b => BUILDINGS[b].n + ' (' + Math.round(BUILDINGS[b].fx.svcP[k] * 100) + '%)').join(' / ') + ' · ' + BUILDINGS[SVC[k].b].n + ' mais tarde';
const svcName = (k, y) => { let n = SVC[k].names[0][1]; for (const [a, x] of SVC[k].names) if (y >= a) n = x; return n; };

/* sorteia as peculiaridades das fés de uma partida (determinístico pela seed) */
function rollFaiths(seed) {
  const r = mkRng(seed ^ 0xfa17), gk = Object.keys(FAITH_GRP).filter(g => g !== 'nul'), tk = Object.keys(TENETS), out = {};
  const roll = D => { let x = r(); for (const k in D.o) { x -= D.o[k].p; if (x < 0) return k; } return Object.keys(D.o)[0]; };
  for (const k in RELIGIONS) { const g = gk[r() * gk.length | 0], dc = {}, doc = {}, add = m => { for (const x in m || {}) doc[x] = Math.round(((doc[x] || 0) + m[x]) * 100) / 100; };
    const FX = RELIGIONS[k].fixed; if (FX) { for (const d in DOCTRINES) { dc[d] = FX.dc[d]; add(DOCTRINES[d].o[dc[d]].m); } FX.tn.forEach(t => add(TENETS[t].m)); out[k] = { grp: FX.grp, dc, tn: FX.tn, doc, head: null, holy: null, d: GRP_D[FX.grp] + '.' }; continue; }   // fé de doutrina fixa (ateísmo)
    for (const d in DOCTRINES) { dc[d] = roll(DOCTRINES[d]); add(DOCTRINES[d].o[dc[d]].m); }
    const tn = shuffleR(tk, r).slice(0, 2); tn.forEach(t => add(TENETS[t].m));
    out[k] = { grp: g, dc, tn, doc, head: dc.head === 'none' ? null : HEAD_POOL[r() * HEAD_POOL.length | 0], holy: DOCTRINES.plural.o[dc.plural].noHoly ? null : HOLY_POOL[r() * HOLY_POOL.length | 0], d: GRP_D[g] + '.' }; }
  return out;
}
const docOpt = (r, d) => { const F = faithOf(r); return F.dc ? DOCTRINES[d].o[F.dc[d]] : {}; };
const faithOf = r => (S && S.faith && S.faith[REL_IDS[r]]) || { grp: 'nat', doc: {}, d: 'Fé local.' };
const REL_IDS = Object.keys(RELIGIONS);

const bGroupOf = b => (BGROUPS.find(g => g[2].includes(b)) || BGROUPS[6])[0];

const dataRng = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const CULTURES = CUL_LIST.map(([n, fam], i) => {
  const L = LANGS[fam], r = dataRng(7919 + i * 104729), pk = a => a[r() * a.length | 0], cap = x => x.charAt(0).toUpperCase() + x.slice(1);
  const a = [...new Set(Array.from({ length: 24 }, () => pk(L.on) + pk(L.vo) + pk(L.co)))].slice(0, 14), b = shuffleR(L.end, r).slice(0, 8);
  const V = /[aeiouyáéíóú]/, nm = E => { let st = pk(L.on) + pk(L.vo) + (r() < .6 ? pk(L.on) + pk(L.vo) : ''), e = pk(E);
    if (V.test(st.slice(-1)) && V.test(e[0])) st = st.slice(0, -1);   // sem vogal colada na junção
    return cap((st + e).replace(/([aeiouy])[aeiouy]([aeiouy]+)/g, '$1$2').replace(/(.)\1\1/g, '$1$1')); };
  const names = E => [...new Set(Array.from({ length: 40 }, () => nm(E)))].filter(x => x.length >= 4 && x.length <= 10).slice(0, 10);
  return { n, fam, a, b, m: names(L.me), f: names(L.fe) };
});
CULTURES.forEach((c, i) => { const p = CULTURES.findIndex(x => x.fam === c.fam); if (p !== i) c.par = p; });   // subculturas: a primeira de cada família é a raiz, as outras são filhas (irmãs entre si)
const culHeritage = c => CULTURES[CULTURES[c].par ?? c].n;
const culKin = (a, b) => a === b || CULTURES[a].fam === CULTURES[b].fam;           // aparentadas: pesam metade como minoria e se assimilam mais rápido
const CUL_MAJOR = CULTURES.length;
/* peculiaridades de cada povo nesta partida: 1–2 modificadores pequenos para o país que tem a cultura como principal */
function rollCultures(seed) {
  const r = mkRng(seed ^ 0xc0c0), dk = Object.keys(DOC_POOL);
  return CULTURES.map(() => { const m = {}; shuffleR(dk, r).slice(0, 1 + (r() < .5 ? 1 : 0)).forEach(k => { const [lo, hi] = DOC_POOL[k]; m[k] = Math.round((lo + r() * (hi - lo)) * 70) / 100; }); return { m }; });
}
