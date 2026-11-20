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

/* ---------- estado em pedaços: cada campo de cada país (e de cada estado) vira um texto; só os textos que mudaram viajam ---------- */
const NET_DEEP = ['nations', 'bld'], NET_SUB = ['mk', 'council', 'inc', 'cands'];   // listas por elemento; dentro deles, estes campos descem mais um nível
/* números arredondados a 5 algarismos só para a rede (o cliente mostra, não simula): menos bytes e menos mudança à toa */
const netRound = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Number(v.toPrecision(5)) : v;
const netJ = v => JSON.stringify(v, netRound);
function flatState(o) {
  const m = new Map();
  for (const k in o) { const v = o[k]; if (v === undefined) continue;
    if (NET_DEEP.includes(k) && Array.isArray(v)) { m.set(k + '#len', String(v.length));
      v.forEach((x, i) => { const b = k + '.' + i;
        if (x && typeof x === 'object' && !Array.isArray(x)) { m.set(b, '{}');
          for (const f in x) { const y = x[f]; if (y === undefined) continue;
            if (NET_SUB.includes(f) && y && typeof y === 'object' && !Array.isArray(y)) { m.set(b + '.' + f, '{}'); for (const g in y) { const j = netJ(y[g]); if (j !== undefined) m.set(b + '.' + f + '.' + g, j); } }
            else { const j = netJ(y); if (j !== undefined) m.set(b + '.' + f, j); } } }
        else m.set(b, netJ(x)); }); }
    else { const j = netJ(v); if (j !== undefined) m.set(k, j); } }
  return m;
}
function unflatState(m) {
  const o = {}, put = (obj, key, v) => { if (v === '{}') { if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {}; } else obj[key] = JSON.parse(v); };   // '{}' só marca que o objeto existe
  for (const [p, v] of m) if (p.endsWith('#len')) o[p.slice(0, -4)] = new Array(+v);
  const rows = [...m].filter(([p]) => !p.endsWith('#len')).sort((a, b) => a[0].split('.').length - b[0].split('.').length);   // pais antes dos filhos
  for (const [p, v] of rows) { const a = p.split('.');
    if (a.length === 1) o[p] = JSON.parse(v);
    else if (a.length === 2) put(o[a[0]], +a[1], v);
    else if (a.length === 3) put(o[a[0]][+a[1]], a[2], v);
    else put(o[a[0]][+a[1]][a[2]], a.slice(3).join('.'), v); }
  return o;
}
function flatDiff(prev, cur) { const set = [], del = []; for (const [p, v] of cur) if (prev.get(p) !== v) set.push([p, v]); for (const p of prev.keys()) if (!cur.has(p)) del.push(p); return { set, del }; }

const NET = {
  host: false, client: false, t: null, code: '', name: '',
  peers: new Map(),          // anfitrião: peerId → { pid, name, seq } (seq = último retrato que ele tem)
  hostId: null, pid: -1, rid: 0, waiting: new Map(), lastSnapT: -1, lastSnapMs: 0, dirty: false, busy: false,
  prev: null, seq: 0, flat: null, chat: [], unread: 0, sentBytes: 0,
  // ganchos da interface
  onLobby: null, onState: null, onInfo: null, onPauseReq: null, onClosed: null, onChat: null,
  freeNations() { const was = S.mpNames || {}; return S.nations.filter(n => n.alive && !isHuman(n.id) && n.senior == null).map(n => ({ id: n.id, name: natName(n), provs: provsOf(n.id).length, gov: GOVS[n.gov].n, was: was[n.id] || null })).sort((a, b) => (b.was ? 1 : 0) - (a.was ? 1 : 0) || b.provs - a.provs); },
  info(m) { if (NET.onInfo) NET.onInfo(m); },
  players() { return NET.host ? [{ name: NET.name || 'Anfitrião', pid: S.player, host: true }, ...[...NET.peers.entries()].map(([id, p]) => ({ peer: id, name: p.name, pid: p.pid }))] : (NET.names || []).map(([pid, name, host]) => ({ pid, name, host: !!host })); },
  addChat(line) { NET.chat.push(line); if (NET.chat.length > 100) NET.chat.shift(); NET.unread++; if (NET.onChat) NET.onChat(line); },
  meta() { return { speed: typeof UI !== 'undefined' ? UI.speed : 0, humans: S.humans, names: NET.players().map(p => [p.pid, p.name, p.host ? 1 : 0]) }; },

  /* ---------- anfitrião ---------- */
  async openRoom(code, transport, name) {
    if (!S || S.player < 0) throw new Error('Abra a sala com uma partida em andamento');
    const t = NET.t = transport || await openTransport(code); NET.host = true; NET.code = code; NET.name = name || NET.name || 'Anfitrião'; S.humans = [S.player]; NET.prev = null; NET.seq = 0;
    t.onJoin = () => {};
    t.onLeave = peer => NET.dropPeer(peer, ' saiu');
    t.onMsg = (m, from) => NET.hostMsg(m, from);
    return code;
  },
  dropPeer(peer, why) { const p = NET.peers.get(peer); if (!p) return; NET.peers.delete(peer); S.humans = S.humans.filter(id => id !== p.pid); log(p.name + why + '; ' + natName(nat(p.pid)) + ' volta para a IA.', 'world', [p.pid]); NET.sys(p.name + why + '.'); NET.dirty = true; },
  sys(m) { const line = { sys: 1, m, at: dateStr() }; NET.addChat(line); if (NET.host && NET.t) NET.t.send({ t: 'chat', line }); },
  kick(peer) { if (!NET.host) return; NET.t.send({ t: 'kick' }, peer); NET.dropPeer(peer, ' foi expulso'); },
  hostMsg(m, from) {
    if (!m || !m.t) return; const p = NET.peers.get(from);
    if (m.t === 'join') {
      if (m.proto !== NET_PROTO) { NET.t.send({ t: 'deny', why: 'Versão diferente do jogo' }, from); return; }
      if (NET.peers.size + 1 >= NET_MAX) { NET.t.send({ t: 'deny', why: 'Sala cheia (' + NET_MAX + ' jogadores)' }, from); return; }
      NET.t.send({ t: 'lobby', nations: NET.freeNations(), year: curYear(), seed: S.seed, host: S.player >= 0 ? natName(nat(S.player)) : '', players: NET.players().map(x => x.name) }, from); return;
    }
    if (m.t === 'pick') {
      const n = nat(m.pid); if (!n || !n.alive || isHuman(m.pid)) { NET.t.send({ t: 'deny', why: 'Esse país já tem dono', again: true, nations: NET.freeNations() }, from); return; }
      const name = String(m.name || 'Jogador').slice(0, 24); NET.peers.set(from, { pid: m.pid, name, seq: -1 }); S.humans.push(m.pid); (S.mpNames = S.mpNames || {})[m.pid] = name;
      log(name + ' assumiu ' + natName(n) + '.', 'world', [m.pid]); NET.sys(name + ' entrou com ' + natName(n) + '.');
      NET.dirty = true; NET.lastSnapMs = 0; return;                  // o próximo envio leva o retrato completo para ele
    }
    if (!p) return;                                              // daqui em diante só quem já escolheu país
    if (m.t === 'cmd') { const e = runCmd(p.pid, m.c, m.a); NET.t.send({ t: 'res', rid: m.rid, e }, from); NET.dirty = true; return; }
    if (m.t === 'resync') { p.seq = -1; NET.dirty = true; return; }
    if (m.t === 'chat') { const line = { from: p.name, pid: p.pid, m: String(m.m || '').slice(0, 300), at: dateStr() }; NET.addChat(line); NET.t.send({ t: 'chat', line }); return; }
    if (m.t === 'pause') { if (NET.onPauseReq) NET.onPauseReq(p.name); return; }
  },
  /* envia o estado: diferenças para quem tem o retrato anterior, completo para quem acabou de entrar (ou se perdeu) */
  async sendState() {
    const cur = flatState(packState(true)), seq = NET.seq + 1, meta = NET.meta();
    let delta = null, full = null;
    for (const [id, p] of NET.peers) {
      let d;
      if (NET.prev && p.seq === NET.seq) { if (!delta) { const df = flatDiff(NET.prev, cur); delta = await netPack({ t: 'delta', base: NET.seq, seq, set: df.set, del: df.del, meta }); } d = delta; }
      else { if (!full) full = await netPack({ t: 'full', seq, flat: [...cur], meta }); d = full; }
      NET.t.send(d, id); NET.sentBytes += d.length || 0; p.seq = seq;
    }
    NET.prev = cur; NET.seq = seq;
  },
  /* chamado pelo laço do anfitrião: estado a cada mês de jogo (ou logo depois de comandos e entradas), no máximo a cada NET_SNAP_MS */
  async hostTick(nowMs) {
    if (!NET.host || NET.busy || !NET.peers.size) return;
    if ((S.t - NET.lastSnapT >= NET_SNAP_DAYS || NET.dirty) && nowMs - NET.lastSnapMs >= (NET.dirty ? 300 : NET_SNAP_MS)) {
      NET.busy = true; NET.dirty = false; NET.lastSnapT = S.t; NET.lastSnapMs = nowMs;
      try { await NET.sendState(); } finally { NET.busy = false; }
    }
  },

  /* ---------- cliente ---------- */
  async join(code, name, transport) {
    const t = NET.t = transport || await openTransport(code); NET.client = true; NET.code = code; NET.name = name || 'Jogador'; NET.flat = null; NET.seq = 0;
    t.onJoin = peer => { if (NET.hostId == null) t.send({ t: 'join', name: NET.name, proto: NET_PROTO }, peer); };
    t.onLeave = peer => { if (peer === NET.hostId) { NET.info('O anfitrião fechou a sala.'); if (NET.onClosed) NET.onClosed(); } };
    t.onMsg = async (raw, from) => {
      const m = raw instanceof Uint8Array || raw instanceof ArrayBuffer || typeof raw === 'string' ? await netUnpack(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw) : raw;
      if (!m || !m.t) return;
      if (m.t === 'lobby' || (m.t === 'deny' && m.again)) { NET.hostId = from; if (NET.onLobby) NET.onLobby(m); return; }
      if (m.t === 'deny') { NET.info(m.why); return; }
      if (from !== NET.hostId) return;
      if (m.t === 'full') { NET.flat = new Map(m.flat); NET.seq = m.seq; NET.apply(m.meta); return; }
      if (m.t === 'delta') { if (!NET.flat || m.base !== NET.seq) { NET.t.send({ t: 'resync' }, NET.hostId); return; }   // perdeu um pedaço: pede o retrato completo
        for (const [p, v] of m.set) NET.flat.set(p, v); for (const p of m.del) NET.flat.delete(p); NET.seq = m.seq; NET.apply(m.meta); return; }
      if (m.t === 'res') { const cb = NET.waiting.get(m.rid); NET.waiting.delete(m.rid); if (cb) cb(m.e); return; }
      if (m.t === 'chat') { NET.addChat(m.line); return; }
      if (m.t === 'kick') { NET.info('O anfitrião tirou você da sala.'); if (NET.onClosed) NET.onClosed(); return; }
    };
  },
  apply(meta) {
    unpackState(unflatState(NET.flat), true);
    if (NET.pid < 0) NET.pid = (meta.humans || []).find(id => id === NET.wantPid) ?? -1;
    S.player = NET.pid; S.humans = meta.humans; NET.speed = meta.speed; NET.names = meta.names || []; if (NET.onState) NET.onState();
  },
  pick(pid) { NET.wantPid = pid; NET.t.send({ t: 'pick', pid, name: NET.name }, NET.hostId); },
  cmd(c, a, cb) { const rid = ++NET.rid; NET.waiting.set(rid, cb || (e => { if (e) NET.info(e); })); NET.t.send({ t: 'cmd', c, a, rid }, NET.hostId); },
  say(text) { text = String(text || '').trim().slice(0, 300); if (!text) return; if (NET.host) { const line = { from: NET.name || 'Anfitrião', pid: S.player, m: text, at: dateStr() }; NET.addChat(line); NET.t.send({ t: 'chat', line }); } else if (NET.client) NET.t.send({ t: 'chat', m: text }, NET.hostId); },
  askPause() { if (NET.client) NET.t.send({ t: 'pause' }, NET.hostId); },
  close() { if (NET.t) NET.t.leave(); NET.host = NET.client = false; NET.t = null; NET.peers.clear(); NET.hostId = null; NET.pid = -1; NET.prev = NET.flat = null; NET.chat = []; NET.unread = 0; if (S) S.humans = null; },
};
