/* Grand Chronicle — comandos do jogador.
   Toda ação humana passa por runCmd(país, nome, argumentos): os argumentos são só números, textos e objetos simples (ids, nunca referências),
   para que no multiplayer o cliente mande { c, a } ao anfitrião e ele execute como o país daquele jogador (anfitrião autoritativo).
   Sozinho, a interface chama act(nome, ...) e o comando roda na hora (o mesmo caminho). */
'use strict';

/* ---------- referências por id ---------- */
const armyById = id => S.armies.find(a => a.id === id) || null;
const fleetById = id => S.fleets.find(f => f.id === id) || null;
/* personagem do país pelo id: corte, conselho, candidatos (conselho, generais, eleição) e generais dos exércitos */
function charById(n, id) {
  const pool = [n.ruler, n.spouse, n.regent, ...(n.kids || []), ...Object.values(n.council || {}), ...Object.values(n.cands || {}).flatMap(x => x.list || []),
    ...((n.gcands || {}).list || []), ...((pendGet('lead', n.id) || {}).cands || []), ...S.armies.filter(a => a.o === n.id && a.gen).map(a => a.gen)];
  return pool.find(c => c && c.id === id) || null;
}
const myArmy = (n, id) => { const a = armyById(id); return a && a.o === n.id ? a : null; };
const myFleet = (n, id) => { const f = fleetById(id); return f && f.o === n.id ? f : null; };
const armiesIn = (n, ids) => (ids || []).map(id => myArmy(n, id)).filter(Boolean);

/* ---------- ações que antes a interface fazia mexendo direto no estado ---------- */
function setResearch(n, tid) { const t = TECH[tid]; if (!t) return 'Inválido'; if (techState(n, t)) return techState(n, t); n.res = tid; return ''; }
function setFront(n, ids, fid) { const f = fid == null ? null : frontById(fid); if (fid != null && !f) return 'Front inválido'; armiesIn(n, ids).forEach(a => { if (a.inv || a.exp) return; a.front = f ? f.id : null; a.path = []; }); return ''; }
function setDrill(n, ids, on) { armiesIn(n, ids).forEach(a => a.drill = !!on); return ''; }
function setExplore(n, id, on) { const a = myArmy(n, id); if (!a) return 'Inválido'; if (on) { const w = expWhy(a); if (w) return w; } a.exp = !!on; a.path = []; a.front = null; return ''; }
function setStanceCmd(n, ids, k) { if (!STANCES[k]) return 'Inválido'; armiesIn(n, ids).forEach(a => setStance(a, k)); return ''; }
function fleetAuto(n, id, on) { const f = myFleet(n, id); if (!f) return 'Inválido'; f.auto = !!on; if (!on) f.path = []; return ''; }
function fleetGo(n, id, z) { const f = myFleet(n, id); if (!f) return 'Inválido'; f.auto = false; return orderFleet(f, z) ? '' : 'Rota impossível'; }
function cancelScheme(n) { n.scheme = null; return ''; }
function abandonPlot(n) { n.plot = null; return ''; }
function setTutor(n, kidId, seat) { const k = (n.kids || []).find(c => c.id === kidId); if (!k || !COUNCIL.some(x => x[0] === seat)) return 'Inválido'; k.tut = seat; return ''; }
function mergeArmies(n, ids) { const L = armiesIn(n, ids); if (L.length < 2) return 'Selecione dois exércitos'; const a = L[0]; L.slice(1).forEach(b => { if (b.p !== a.p || b.inv || a.inv) return; mergeInto(a, b); a.exp = false; }); S.armies = S.armies.filter(b => regs(b) > .08); return ''; }

/* ---------- tabela de comandos: nome → (país, ...argumentos simples) ---------- */
const CMDS = {
  // governo, leis e conselho
  setLaw: (n, k, o) => setLaw(n, k, o), setGov: (n, g) => setGov(n, g), setIdeo: (n, i) => setIdeo(n, i), cancelEnact: n => cancelEnact(n),
  campaign: n => campaign(n), rankUp: n => rankUp(n), setFlag: (n, f) => setFlag(n, f), rename: (n, nm) => rename(n, nm), setCapital: (n, p) => setCapital(n, p),
  swapCouncil: (n, k, cid) => { const c = charById(n, cid); return c ? swapCouncil(n, k, c) : 'Candidato inválido'; },
  setLeader: (n, cid) => { if (!pendGet('lead', n.id)) return 'Nada a escolher'; const c = charById(n, cid); if (!c) return 'Candidato inválido'; pendDel('lead', n.id); setLeader(n, c); return ''; },
  dismiss: (n, k) => { if (!['offer', 'conf'].includes(k)) return 'Inválido'; pendDel(k, n.id); return ''; },   // fechou a janela sem decidir (proposta de paz recusada, paz adiada)
  ackNote: (n, id) => { S.evq = (S.evq || []).filter(e => !(e.nid === id && e.to === n.id)); return ''; },
  answerOffer: (n, fromId, kind, yes) => { const o = (S.dipOffers || []).find(x => x.from === fromId && x.kind === kind && (x.to ?? S.player) === n.id); if (!o) return 'Nada a responder'; S.dipOffers = S.dipOffers.filter(x => x !== o); if (!yes) { const f = nat(fromId); if (f) f.rel[n.id] = (f.rel[n.id] || 0) - 10; return ''; } return CMDS.acceptOffer(n, fromId, kind); },
  interact: (n, cid, k) => { const c = charById(n, cid); return c ? interact(n, c, k) : 'Pessoa inválida'; },
  useSecret: (n, cid, k) => { const c = charById(n, cid); return c ? useSecret(n, c, k) : 'Pessoa inválida'; },
  abandonPlot: n => abandonPlot(n), setTutor: (n, kid, seat) => setTutor(n, kid, seat),
  setPol: (n, tab, k, lv) => setPol(n, tab, k, lv),
  // economia, pesquisa e vertentes
  build: (n, s, b) => build(n, s, b), buySlot: n => buySlot(n), prospect: (n, s) => prospect(n, s), colonize: (n, p) => colonize(n, p),
  setResearch: (n, tid) => setResearch(n, tid), adoptVert: (n, v) => adoptVert(n, v), vertDecide: (n, v, keep) => n.vpend === v ? (vertDecide(n, v, !!keep), '') : 'Nada a decidir',
  // diplomacia, fé e intriga externa
  dipAct: (n, tid, kind) => { const t = nat(tid); return t ? dipAct(n, t, kind) : 'País inválido'; },
  acceptOffer: (n, fromId, kind) => { const o = nat(fromId); return o ? dipAct(o, n, kind) : 'País inválido'; },
  declareWar: (n, tid, st, kind) => { const t = nat(tid); return t ? declareWar(n, t, st ?? null, kind || null) : 'País inválido'; },
  faithAct: (n, k, tid) => faithAct(n, k, tid != null ? nat(tid) : undefined),
  startScheme: (n, k, tgt) => startScheme(n, k, tgt), cancelScheme: n => cancelScheme(n), exposeForeign: (n, tid) => exposeForeign(n, tid),
  fabricate: (n, s) => fabricate(n, s), setSubjLaw: (n, tid, k, v) => setSubjLaw(n, nat(tid), k, v),
  subjAct: (n, k) => subjAct(n, k), setImpPref: (n, k) => { if (!['senior', 'world'].includes(k)) return 'Inválido'; n.impPref = k; return ''; }, independence: n => { if (!isSubj(n)) return 'Você não é súdito'; independence(n); return ''; },
  freeSubject: (n, tid) => { const t = nat(tid); if (!t || t.senior !== n.id) return 'Não é seu súdito'; freeSubject(t, 'foi libertado por'); t.rel[n.id] = Math.min(100, (t.rel[n.id] || 0) + 40); return ''; },
  // militar
  recruit: (n, type, k, at, g) => recruit(n, type, k, at, g), buildShips: (n, k, p) => buildShips(n, k, p),
  setGeneral: (n, aid, cid) => { const a = myArmy(n, aid), c = charById(n, cid); return a && c ? setGeneral(n, a, c) : 'Inválido'; },
  addSupport: (n, aid, k) => { const a = myArmy(n, aid); if (!a) return 'Inválido'; const G = a.g != null ? groupOf(a) : [a]; if (G.some(x => x.sup && x.sup[k])) return ''; const e = addSupport(n, a, k); if (!e) G.forEach(x => (x.sup = x.sup || {})[k] = 1); return e; },
  setStance: (n, ids, k) => setStanceCmd(n, ids, k), setFront: (n, ids, fid) => setFront(n, ids, fid), setFord: (n, fid, o) => setFord(n.id, fid, o),
  setDrill: (n, ids, on) => setDrill(n, ids, on), setExplore: (n, aid, on) => setExplore(n, aid, on), mergeArmies: (n, ids) => mergeArmies(n, ids),
  splitGroup: (n, aid, fid) => { const a = myArmy(n, aid); return a ? (splitGroup(a, fid ?? null), '') : 'Inválido'; },
  joinGroups: (n, aid, bid) => { const a = myArmy(n, aid), b = myArmy(n, bid); return a && b ? (joinGroups(a, b), '') : 'Inválido'; },
  planInvasion: (n, aid, to) => { const a = myArmy(n, aid); return a ? planInvasion(n, a, to) : 'Inválido'; },
  cancelInvasion: (n, aid) => { const a = myArmy(n, aid); if (!a) return 'Inválido'; cancelInvasion(a); return ''; },
  setNavDoc: (n, k) => setNavDoc(n, k), fleetAuto: (n, fid, on) => fleetAuto(n, fid, on), fleetGo: (n, fid, z) => fleetGo(n, fid, z),
  // eventos e paz
  chooseEvent: (n, ev, k) => chooseEvent(n, ev, k),
  peaceOffer: (n, yes) => { const o = pendGet('offer', n.id); if (!o) return 'Nada a responder'; pendDel('offer', n.id); const w = S.wars.find(x => x.id === o.w); if (!w || !yes) return ''; separatePeace(w, o.L ?? n.id, o.winner, o.t); return ''; },
  proposePeace: (n, wid, L, t) => { const w = S.wars.find(x => x.id === wid); return w ? proposePeace(w, L, t, n.id) : 'Guerra inválida'; },
  answerCall: (n, wid, yes) => { const c = (S.calls || []).find(x => x.w === wid && (x.to ?? S.player) === n.id); if (!c) return 'Nada a responder'; S.calls = S.calls.filter(x => x !== c); answerCall(c, !!yes); return ''; },
  peace: (n, wid, L, winner, t) => { const w = S.wars.find(x => x.id === wid); if (!w) return 'Guerra inválida'; if (winner !== n.id && L !== n.id) return 'Não é sua paz'; separatePeace(w, L, winner, t); return ''; },
};
/* executa um comando como o país pid; devolve '' (feito) ou o motivo da recusa */
function runCmd(pid, c, args) {
  const n = nat(pid); if (!n || !n.alive) return 'País inválido'; if (!isHuman(pid)) return 'Esse país não é de um jogador';
  const f = CMDS[c]; if (!f) return 'Comando desconhecido: ' + c;
  try { return f(n, ...(args || [])) || ''; } catch (e) { console.error('comando', c, e); return 'Erro no comando'; }
}
