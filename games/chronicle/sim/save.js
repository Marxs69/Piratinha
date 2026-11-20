/* Grand Chronicle — simulação: salvar e carregar. */
'use strict';

/* ---------- salvar / carregar ---------- */
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s, T = Uint8Array) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
const NET_MK0 = { sup: {}, dem: {}, sat: {}, imp: {}, exp: {} };
/* empacota o estado para texto (save e rede). net = mantém as pendências de cada jogador (no save elas são descartadas) */
function packState(net) {
  return Object.assign({}, S, { stSpd: undefined, stS: undefined, stD: undefined, stHas: undefined, stInfo: undefined, relg: S.relg ? b64(S.relg) : undefined, culg: S.culg ? b64(S.culg) : undefined, own: b64(new Uint8Array(S.own.buffer)), ctrl: b64(new Uint8Array(S.ctrl.buffer)), pop: b64(new Uint8Array(S.pop.buffer)), news: [], mapDirty: undefined, _mine: undefined, _threat: undefined,
    nations: S.nations.map(n => Object.assign({}, n, { exP: b64(n.exP), exZ: b64(n.exZ), m: undefined, fx: undefined, up: undefined, eff: undefined }, net && !isHuman(n.id) ? { mk: NET_MK0 } : {})),   // rede: mercado detalhado só dos jogadores (a interface só mostra o do próprio país)
    pend: net ? S.pend : undefined, calls: net ? S.calls : [], dipOffers: net ? S.dipOffers : [], evq: (S.evq || []).filter(e => net || e.ev), offer: undefined, conf: undefined, leadPick: undefined });
}
/* desempacota um estado. net = retrato vindo do anfitrião: não refaz o mundo se a semente é a mesma e não roda a economia (quem simula é o anfitrião) */
function unpackState(o, net) {
  if (!o || o.v !== 3) return false;
  if (!net || !WD || WD.seed !== o.seed) { WD = generateWorld(o.seed); WD.seed = o.seed; } resetCaches();
  o.own = unb64(o.own, Int16Array); o.ctrl = unb64(o.ctrl, Int16Array); o.pop = unb64(o.pop, Float32Array);
  o.nations.forEach(n => { n.exP = unb64(n.exP); n.exZ = unb64(n.exZ); });
  S = o; if (!Number.isInteger(S.rs)) S.rs = (S.seed ^ S.t) | 0;
  S.news = []; S.rebels = S.rebels || {}; S.battles = S.battles || {}; S.fronts = S.fronts || []; S.pands = S.pands || []; S.pandDone = S.pandDone || {}; S.epis = S.epis || [];
  S.armies.forEach(a => { if (a.xp == null) a.xp = .2; a.fat = a.fat || 0; a.st = a.st || 'bal'; a.sup = a.sup || {}; });
  if (!S.faith) S.faith = rollFaiths(S.seed); if (!S.culx) S.culx = rollCultures(S.seed);
  if (o.culg) S.culg = unb64(o.culg); else initCul(); if (o.relg) S.relg = unb64(o.relg); else initRelig();
  if (!net) S.humans = null;   // save de partida multijogador abre sozinho; ao reabrir a sala, os outros escolhem de novo (o lobby mostra quem era dono: S.mpNames)
  if (net) { ownChanged(); warsChanged(); S.nations.forEach(n => { if (n.alive) calcMods(n); }); S.mapDirty = true; return true; }
  GOOD_IDS.forEach(g => { if (!(S.wp[g] > 0)) S.wp[g] = GOODS[g].p; });   // saves antigos: bens novos sem preço davam −NaN/mês
  for (const g in S.wp) if (!GOODS[g]) delete S.wp[g]; if (S.wacc) S.wacc = null;   // bem removido do conteúdo; somas do mês recomeçam
  const gone = sanitizeIds(); if (gone) log('O conteúdo do jogo mudou desde este save: ' + gone + ' referência(s) a itens removidos foram limpas.', 'info');
  ownChanged(); warsChanged(); strC = null; supC = null; epC = null; nbC.clear(); S.nations.forEach(n => { if (n.alive) calcMods(n); }); econAll(); mineStates(); return true;
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
