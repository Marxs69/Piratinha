/* Grand Chronicle — multijogador (fundação).
   Modelo: anfitrião autoritativo. Quem abre a sala é o anfitrião: só ele simula. Os outros mandam comandos (sim/cmd.js: { c, a })
   e recebem retratos do estado (packState/unpackState de sim/save.js), compactados com gzip quando o navegador permite.
   O anfitrião controla a velocidade e a pausa; os outros podem pedir pausa. 2–8 jogadores; quem sai vira IA; dá para entrar
   numa partida em andamento escolhendo um país livre.
   Transportes, todos com a mesma cara { selfId, send(msg, alvo?), onMsg, onJoin, onLeave, leave }:
   - p2p: WebRTC via Trystero (lib/trystero.js, MIT), que usa relays Nostr públicos só para os navegadores se acharem;
   - bc:  BroadcastChannel, para testar com duas abas do mesmo navegador (código de sala começando com "local").
   Protocolo (campo t): join {name, proto} → lobby {nations, year, seed} → pick {pid} → snap {s, speed, humans, pid?};
   cmd {c, a, rid} → res {rid, e}; pause (pedido do cliente); bye. */
'use strict';

const NET_APP = 'piratinha-chronicle-1', NET_PROTO = 1, NET_MAX = 8, NET_SNAP_DAYS = 30, NET_SNAP_MS = 4000;

function bcTransport(code) {
  const ch = new BroadcastChannel('chronicle-' + code), me = Math.random().toString(36).slice(2, 10), peers = new Set();
  const t = { selfId: me, onMsg: null, onJoin: null, onLeave: null };
  const post = (k, data, to) => ch.postMessage({ k, from: me, to: to || null, data });
  ch.onmessage = e => {
    const m = e.data; if (m.from === me || (m.to && m.to !== me)) return;
    if (m.k === 'hi' || m.k === 'hey') { if (!peers.has(m.from)) { peers.add(m.from); t.onJoin && t.onJoin(m.from); } if (m.k === 'hi') post('hey', null, m.from); }
    else if (m.k === 'bye') { if (peers.delete(m.from)) t.onLeave && t.onLeave(m.from); }
    else if (m.k === 'm') t.onMsg && t.onMsg(m.data, m.from);
  };
  t.send = (data, to) => post('m', data, to);
  t.leave = () => { post('bye'); ch.close(); };
  addEventListener('pagehide', () => post('bye'));
  setTimeout(() => post('hi'), 0);
  return Promise.resolve(t);
}
async function p2pTransport(code) {
  const { joinRoom } = await import('./lib/trystero.js');
  const room = joinRoom({ appId: NET_APP, identity: 'none' }, 'sala-' + code), act = room.makeAction('m');
  await room.ready;
  const self = await room.getSelf();
  const t = { selfId: self.peerId, onMsg: null, onJoin: null, onLeave: null };
  act.onMessage((data, meta) => t.onMsg && t.onMsg(data, meta.peerId));
  room.onPeerJoin(c => t.onJoin && t.onJoin(c.peerId));
  room.onPeerLeave(c => t.onLeave && t.onLeave(c.peerId));
  t.send = (data, to) => act.send(data, to ? { target: to } : undefined).catch(e => console.warn('Chronicle: envio falhou', e));
  t.leave = () => room.leave();
  return t;
}
const openTransport = code => (code || '').startsWith('local') ? bcTransport(code) : p2pTransport(code);

/* gzip quando existe CompressionStream (navegadores atuais); senão texto puro */
async function netPack(obj) {
  const s = JSON.stringify(obj); if (typeof CompressionStream === 'undefined') return s;
  return new Uint8Array(await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
}
async function netUnpack(d) {
  if (typeof d === 'string') return JSON.parse(d);
  return JSON.parse(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}

const NET = {
  host: false, client: false, t: null, code: '', name: '',
  peers: new Map(),          // anfitrião: peerId → { pid, name }
  hostId: null, pid: -1, rid: 0, waiting: new Map(), lastSnapT: -1, lastSnapMs: 0, dirty: false, busy: false,
  // ganchos da interface
  onLobby: null, onState: null, onInfo: null, onPauseReq: null, onClosed: null,
  freeNations() { return S.nations.filter(n => n.alive && !isHuman(n.id) && n.senior == null).map(n => ({ id: n.id, name: natName(n), provs: provsOf(n.id).length, gov: GOVS[n.gov].n })).sort((a, b) => b.provs - a.provs); },
  info(m) { if (NET.onInfo) NET.onInfo(m); },

  /* ---------- anfitrião ---------- */
  async openRoom(code, transport) {
    if (!S || S.player < 0) throw new Error('Abra a sala com uma partida em andamento');
    const t = NET.t = transport || await openTransport(code); NET.host = true; NET.code = code; S.humans = [S.player];
    t.onJoin = () => {};
    t.onLeave = peer => { const p = NET.peers.get(peer); if (!p) return; NET.peers.delete(peer); S.humans = S.humans.filter(id => id !== p.pid); log(p.name + ' saiu; ' + natName(nat(p.pid)) + ' volta para a IA.', 'world', [p.pid]); NET.info(p.name + ' saiu.'); NET.dirty = true; };
    t.onMsg = (m, from) => NET.hostMsg(m, from);
    return code;
  },
  hostMsg(m, from) {
    if (!m || !m.t) return; const p = NET.peers.get(from);
    if (m.t === 'join') {
      if (m.proto !== NET_PROTO) { NET.t.send({ t: 'deny', why: 'Versão diferente do jogo' }, from); return; }
      if (NET.peers.size + 1 >= NET_MAX) { NET.t.send({ t: 'deny', why: 'Sala cheia (' + NET_MAX + ' jogadores)' }, from); return; }
      NET.t.send({ t: 'lobby', nations: NET.freeNations(), year: curYear(), seed: S.seed, host: S.player >= 0 ? natName(nat(S.player)) : '' }, from); return;
    }
    if (m.t === 'pick') {
      const n = nat(m.pid); if (!n || !n.alive || isHuman(m.pid)) { NET.t.send({ t: 'deny', why: 'Esse país já tem dono', again: true, nations: NET.freeNations() }, from); return; }
      NET.peers.set(from, { pid: m.pid, name: String(m.name || 'Jogador').slice(0, 24) }); S.humans.push(m.pid);
      log(NET.peers.get(from).name + ' assumiu ' + natName(n) + '.', 'world', [m.pid]); NET.info(NET.peers.get(from).name + ' entrou com ' + natName(n) + '.');
      NET.sendSnap(from); return;
    }
    if (!p) return;                                              // daqui em diante só quem já escolheu país
    if (m.t === 'cmd') { const e = runCmd(p.pid, m.c, m.a); NET.t.send({ t: 'res', rid: m.rid, e }, from); NET.dirty = true; return; }
    if (m.t === 'pause') { if (NET.onPauseReq) NET.onPauseReq(p.name); return; }
  },
  async sendSnap(to) {
    const d = await netPack({ t: 'snap', s: packState(true), speed: typeof UI !== 'undefined' ? UI.speed : 0, humans: S.humans, names: [...NET.peers.values()].map(x => [x.pid, x.name]) });
    if (to) { NET.t.send(d, to); return; } NET.t.send(d);
  },
  /* chamado pelo laço do anfitrião: retrato a cada mês de jogo (ou depois de comandos), no máximo a cada NET_SNAP_MS */
  async hostTick(nowMs) {
    if (!NET.host || NET.busy || !NET.peers.size) return;
    if ((S.t - NET.lastSnapT >= NET_SNAP_DAYS || NET.dirty) && nowMs - NET.lastSnapMs >= (NET.dirty ? 300 : NET_SNAP_MS)) {
      NET.busy = true; NET.dirty = false; NET.lastSnapT = S.t; NET.lastSnapMs = nowMs;
      try { await NET.sendSnap(); } finally { NET.busy = false; }
    }
  },

  /* ---------- cliente ---------- */
  async join(code, name, transport) {
    const t = NET.t = transport || await openTransport(code); NET.client = true; NET.code = code; NET.name = name || 'Jogador';
    t.onJoin = peer => { if (NET.hostId == null) t.send({ t: 'join', name: NET.name, proto: NET_PROTO }, peer); };
    t.onLeave = peer => { if (peer === NET.hostId) { NET.info('O anfitrião fechou a sala.'); if (NET.onClosed) NET.onClosed(); } };
    t.onMsg = async (raw, from) => {
      const m = raw instanceof Uint8Array || raw instanceof ArrayBuffer || typeof raw === 'string' ? await netUnpack(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw) : raw;
      if (!m || !m.t) return;
      if (m.t === 'lobby' || (m.t === 'deny' && m.again)) { NET.hostId = from; if (NET.onLobby) NET.onLobby(m); return; }
      if (m.t === 'deny') { NET.info(m.why); return; }
      if (from !== NET.hostId) return;
      if (m.t === 'snap') { unpackState(m.s, true); if (NET.pid < 0) NET.pid = (m.humans || []).find(id => id === NET.wantPid) ?? -1; S.player = NET.pid; S.humans = m.humans; NET.speed = m.speed; NET.names = m.names || []; if (NET.onState) NET.onState(); return; }
      if (m.t === 'res') { const cb = NET.waiting.get(m.rid); NET.waiting.delete(m.rid); if (cb) cb(m.e); return; }
    };
  },
  pick(pid) { NET.wantPid = pid; NET.t.send({ t: 'pick', pid, name: NET.name }, NET.hostId); },
  cmd(c, a, cb) { const rid = ++NET.rid; if (cb) NET.waiting.set(rid, cb); else NET.waiting.set(rid, e => { if (e) NET.info(e); }); NET.t.send({ t: 'cmd', c, a, rid }, NET.hostId); },
  askPause() { if (NET.client) NET.t.send({ t: 'pause' }, NET.hostId); },
  close() { if (NET.t) NET.t.leave(); NET.host = NET.client = false; NET.t = null; NET.peers.clear(); NET.hostId = null; NET.pid = -1; if (S) S.humans = null; },
};
