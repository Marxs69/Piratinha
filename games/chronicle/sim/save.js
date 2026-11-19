/* Grand Chronicle — simulação: salvar e carregar. */
'use strict';

/* ---------- salvar / carregar ---------- */
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s, T = Uint8Array) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); };
function saveGame() {
  const o = Object.assign({}, S, { stSpd: undefined, stS: undefined, stD: undefined, stInfo: undefined, relg: S.relg ? b64(S.relg) : undefined, culg: S.culg ? b64(S.culg) : undefined, own: b64(new Uint8Array(S.own.buffer)), ctrl: b64(new Uint8Array(S.ctrl.buffer)), pop: b64(new Uint8Array(S.pop.buffer)), news: [], offer: null, mapDirty: undefined,
    nations: S.nations.map(n => Object.assign({}, n, { exP: b64(n.exP), exZ: b64(n.exZ), m: undefined, fx: undefined, up: undefined, eff: undefined })), calls: [], dipOffers: [], evq: (S.evq || []).filter(e => e.ev), conf: null });
  try { localStorage.setItem('chronicle-save', JSON.stringify(o)); return true; } catch (e) { return false; }
}
function loadGame() {
  let o; try { o = JSON.parse(localStorage.getItem('chronicle-save')); } catch (e) { return false; }
  if (!o || o.v !== 2) return false;
  WD = generateWorld(o.seed);
  o.own = unb64(o.own, Int16Array); o.ctrl = unb64(o.ctrl, Int16Array); o.pop = unb64(o.pop, Float32Array);
  o.nations.forEach(n => { n.exP = unb64(n.exP); n.exZ = unb64(n.exZ); });
  S = o; if (!Number.isInteger(S.rs)) S.rs = (S.seed ^ S.t) | 0; if (S.plague !== undefined || S.plagueDone !== undefined) { S.pands = S.plague ? [Object.assign({ id: 'black', warned: {} }, S.plague)] : []; S.pandDone = S.plagueDone ? { black: S.plagueDone } : {}; delete S.plague; delete S.plagueDone; } (S.epis || []).forEach(E => { if (!E.d) E.d = 'fever'; });   // saves antigos S.news = []; S.rebels = S.rebels || {}; if (o.culg) S.culg = unb64(o.culg); else initCul(); if (o.relg) S.relg = unb64(o.relg); else initRelig();
  GOOD_IDS.forEach(g => { if (!(S.wp[g] > 0)) S.wp[g] = GOODS[g].p; });   // saves antigos: bens novos sem preço davam −NaN/mês
  ownChanged(); warsChanged(); S.nations.forEach(n => { if (n.alive) calcMods(n); }); econAll(); return true;
}
const hasSave = () => { try { const s = localStorage.getItem('chronicle-save'); return !!s && s.startsWith('{"v":2'); } catch (e) { return false; } };
