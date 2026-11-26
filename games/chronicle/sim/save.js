/* Grand Chronicle — simulação: salvar e carregar. */
'use strict';

/* ---------- salvar / carregar ---------- */
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s, T = Uint8Array) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
const NET_MK0 = { sup: {}, dem: {}, sat: {}, imp: {}, exp: {} };
/* empacota o estado para texto (save e rede). net = mantém as pendências de cada jogador (no save elas são descartadas) */
const f64b = a => a ? b64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)) : undefined;
function packState(net) {
  return Object.assign({}, S, net ? { stSpd: undefined, stS: undefined, stD: undefined, stHas: undefined, stInfo: undefined } : { stSpd: f64b(S.stSpd), stS: f64b(S.stS), stD: f64b(S.stD), stHas: f64b(S.stHas), stInfo: S.stInfo }, { /* save leva os insumos do mês anterior por estado (carregar não muda a partida); a rede não */ relg: S.relg ? b64(S.relg) : undefined, culg: S.culg ? b64(S.culg) : undefined, own: b64(new Uint8Array(S.own.buffer)), ctrl: b64(new Uint8Array(S.ctrl.buffer)), pop: b64(new Uint8Array(S.pop.buffer)), news: [], mapDirty: undefined, _mine: net || !S._mine ? undefined : S._mine.map(l => l.map(st => st.id)), _threat: undefined,   /* _mine (estados de cada país no mês) vai no save: carregar não muda a partida */
    nations: S.nations.map(n => Object.assign({}, n, Object.assign({ exP: b64(n.exP), exZ: b64(n.exZ), fx: undefined }, net ? { m: undefined, up: undefined, eff: undefined } : { m0: n.m, up0: n.up, m: undefined, up: undefined, eff: undefined }), net && !isHuman(n.id) ? { mk: NET_MK0 } : {})),   // rede: mercado detalhado só dos jogadores (a interface só mostra o do próprio país)
    pend: net ? S.pend : undefined, calls: net ? S.calls : [], dipOffers: net ? S.dipOffers : [], evq: (S.evq || []).filter(e => net || e.ev), offer: undefined, conf: undefined, leadPick: undefined });
}
/* desempacota um estado. net = retrato vindo do anfitrião: não refaz o mundo se a semente é a mesma e não roda a economia (quem simula é o anfitrião) */
function unpackState(o, net) {
  if (!o || o.v !== 3) return false;
  if (!net || !WD || WD.seed !== o.seed) { WD = generateWorld(o.seed); WD.seed = o.seed; } resetCaches();
  o.own = unb64(o.own, Int16Array); o.ctrl = unb64(o.ctrl, Int16Array); o.pop = unb64(o.pop, Float32Array);
  o.nations.forEach(n => { n.exP = unb64(n.exP); n.exZ = unb64(n.exZ); });
  const mine = o._mine; S = o; if (!Number.isInteger(S.rs)) S.rs = (S.seed ^ S.t) | 0;
  relinkChars();
  (S.wars || []).forEach(w => { if (w.nc == null) w.nc = S.t; if (w.lc == null) w.lc = S.t; });   // saves antigos (antes da R1a): contato e controle contam do mês da carga
  S.news = []; S.rebels = S.rebels || {}; S.battles = S.battles || {}; S.fronts = S.fronts || []; S.pands = S.pands || []; S.pandDone = S.pandDone || {}; S.epis = S.epis || [];
  S.armies.forEach(a => { if (a.xp == null) a.xp = .2; a.fat = a.fat || 0; a.st = a.st || 'bal'; a.sup = a.sup || {}; });
  if (!S.faith) S.faith = rollFaiths(S.seed); if (!S.culx) S.culx = rollCultures(S.seed);
  if (o.culg) S.culg = unb64(o.culg); else initCul(); if (o.relg) S.relg = unb64(o.relg); else initRelig();
  if (!net) S.humans = null;   // save de partida multijogador abre sozinho; ao reabrir a sala, os outros escolhem de novo (o lobby mostra quem era dono: S.mpNames)
  if (net) { ownChanged(); warsChanged(); S.nations.forEach(n => { if (n.alive) calcMods(n); }); S.mapDirty = true; return true; }
  GOOD_IDS.forEach(g => { if (!(S.wp[g] > 0)) S.wp[g] = GOODS[g].p; });   // saves antigos: bens novos sem preço davam −NaN/mês
  for (const g in S.wp) if (!GOODS[g]) delete S.wp[g]; if (S.wacc && (!S.wacc.ev || GOOD_IDS.some(g => S.wacc.sup[g] == null))) S.wacc = null;   // lista de bens mudou: somas do mês recomeçam
  const gone = sanitizeIds(); if (gone) log('O conteúdo do jogo mudou desde este save: ' + gone + ' referência(s) a itens removidos foram limpas.', 'info');
  const st = typeof o.stS === 'string' && typeof o.stD === 'string';
  if (st) { S.stS = unb64(o.stS, Float64Array); S.stD = unb64(o.stD, Float64Array); S.stHas = unb64(o.stHas); S.stSpd = unb64(o.stSpd, Float32Array); }
  else { S.stS = S.stD = S.stHas = S.stSpd = null; }
  ownChanged(); warsChanged(); strC = null; supC = null; epC = null; nbC.clear(); S.nations.forEach(n => { if (n.alive) calcMods(n); if (n.m0) { n.m = n.m0; n.up = n.up0 ?? n.up; } delete n.m0; delete n.up0; });   // modificadores do último calcMods (o save não muda a partida)
  if (!st) econAll(true);   // save antigo sem os insumos por estado: recalcula o derivado sem mexer em dinheiro
  if (Array.isArray(mine)) S._mine = mine.map(l => l.map(id => WD.states[id])); else mineStates(); return true;
}
/* o mesmo personagem em dois lugares (regente = chanceler, general = conselheiro…) vira dois objetos no JSON: religa pelo id para que continue um só */
function relinkChars() {
  const by = new Map(), one = c => { if (!c || c.id == null) return c; const k = c.id; if (!by.has(k)) by.set(k, c); return by.get(k); };
  for (const n of S.nations) { if (n.council) for (const k in n.council) n.council[k] = one(n.council[k]); n.ruler = one(n.ruler); n.spouse = one(n.spouse); if (n.kids) n.kids = n.kids.map(one); n.regent = one(n.regent); }
  for (const a of S.armies) a.gen = one(a.gen);
  for (const n of S.nations) { for (const k in n.cands || {}) if (n.cands[k] && n.cands[k].list) n.cands[k].list = n.cands[k].list.map(one); if (n.gcands && n.gcands.list) n.gcands.list = n.gcands.list.map(one); }   // candidatos também apontam para os mesmos personagens
}
function saveGame() { try { localStorage.setItem('chronicle-save', JSON.stringify(packState(false))); return true; } catch (e) { return false; } }
function loadGame() { let o; try { o = JSON.parse(localStorage.getItem('chronicle-save')); } catch (e) { return false; } return unpackState(o, false); }
/* conteúdo editado (content/*.js) entre um save e outro: tira do save o que não existe mais, troca por um padrão e conta.
   O save guarda só ids e estado; as definições vêm sempre dos arquivos de conteúdo. */
function sanitizeIds() {
  let k = 0; const drop = (o, ok) => { for (const id in o || {}) if (!ok(id)) { delete o[id]; k++; } };
  S.bld.forEach(B => drop(B, b => !!BUILDINGS[b]));
  const chars = n => [n.ruler, n.spouse, n.regent, ...Object.values(n.council || {}), ...(n.kids || [])].filter(Boolean);
  S.nations.forEach(n => {
    drop(n.techs, t => !!TECH[t]); drop(n.evd, e => !!EVENT[e]); drop(n.vdec, v => !!VERT[v]);
    if (!GOVS[n.gov]) { n.gov = GOVS.feudal ? 'feudal' : Object.keys(GOVS)[0]; k++; } if (!IDEOS[n.ideo]) { n.ideo = IDEOS.trad ? 'trad' : Object.keys(IDEOS)[0]; k++; }
    if (n.vert && !VERT[n.vert]) { n.vert = null; n.vlv = 0; k++; } if (n.vpend && !VERT[n.vpend]) { n.vpend = null; k++; } if (n.vpref && !VERT[n.vpref]) n.vpref = null;
    if (n.evWait && !EVENT[n.evWait]) { n.evWait = null; k++; } if (n.evNext) n.evNext = n.evNext.filter(x => EVENT[x.id] || !++k);
    if (n.res && !TECH[n.res]) { n.res = null; k++; }
    const c0 = (n.cons || []).length; n.cons = (n.cons || []).filter(c => BUILDINGS[c.b]); k += c0 - n.cons.length;
    chars(n).forEach(c => { const t0 = (c.tr || []).length; c.tr = (c.tr || []).filter(t => TRAITS[t]); k += t0 - c.tr.length; });
  });
  S.nations.forEach(n => chars(n).forEach(c => { if (c.id == null) c.id = S.id++; })); S.armies.forEach(a => { if (a.gen && a.gen.id == null) a.gen.id = S.id++; });   // pessoas sem id (saves antigos): comandos usam ids
  S.armies.forEach(a => { if (a.gen && a.gen.tr) a.gen.tr = a.gen.tr.filter(t => TRAITS[t]); for (const s in a.sup || {}) if (!SUPPORT[s]) { delete a.sup[s]; k++; } if (!STANCES[a.st]) a.st = 'bal'; });
  if (S.evq) S.evq = S.evq.filter(e => !e.ev || EVENT[e.ev]);
  return k;
}
const hasSave = () => { try { const s = localStorage.getItem('chronicle-save'); return !!s && s.startsWith('{"v":3'); } catch (e) { return false; } };
