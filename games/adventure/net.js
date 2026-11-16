/* Adventure: rede. Quem cria a sala é o host: roda Sim (game.js) e manda a cada jogador um retrato da região dele (~10 por segundo).
   Os outros só mandam posição, ataques e comandos. Solo = host sem ninguém conectado (mesmo caminho de código).
   Transportes, todos com a mesma cara { send(msg, alvo?), onMsg, onJoin, onLeave, leave }:
   - p2p: WebRTC via Trystero (lib/trystero.js, MIT), que usa relays Nostr públicos só para os navegadores se acharem;
   - bc: BroadcastChannel, para testar com duas janelas do mesmo navegador (código de sala começando com "local"). */

const SIM_HZ = 20, SNAP_EVERY = 2, APP_ID = 'piratinha-adventure-1', MAX_PLAYERS = 4, PROTO = 2;

function bcTransport(code) {
  const ch = new BroadcastChannel('adventure-' + code), me = Math.random().toString(36).slice(2, 10), peers = new Set();
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
  const room = joinRoom({ appId: APP_ID, identity: 'none' }, 'sala-' + code), act = room.makeAction('m');
  await room.ready;
  const self = await room.getSelf();
  const t = { selfId: self.peerId, onMsg: null, onJoin: null, onLeave: null };
  act.onMessage((data, meta) => t.onMsg && t.onMsg(data, meta.peerId));
  room.onPeerJoin(c => t.onJoin && t.onJoin(c.peerId));
  room.onPeerLeave(c => t.onLeave && t.onLeave(c.peerId));
  t.send = (data, to) => act.send(data, to ? { target: to } : undefined).catch(e => console.warn('Adventure: envio falhou', e));
  t.leave = () => room.leave();
  return t;
}
// Confere o formato do mundo que o host manda (evita travar com dados quebrados).
function validWorld(w) {
  try {
    const okList = a => a == null || Array.isArray(a), str = v => typeof v === 'string' && v.length < 400;
    if (!w || !w.regions || !w.regions.vila || typeof w.regions !== 'object') return false;
    for (const r of Object.values(w.regions)) {
      if (!r || !str(r.n) || !Array.isArray(r.map) || !r.map.length || r.map.length > 300 || !r.map.every(l => typeof l === 'string' && l.length === r.map[0].length && l.length <= 300)) return false;
      if (![r.npcs, r.spawns, r.portals, r.signs, r.chests].every(okList)) return false;
      for (const p of r.portals || []) if (![p.x, p.y, p.w, p.h, p.tx, p.ty].every(Number.isFinite)) return false;
    }
    const ex = w.extra || {};
    for (const k of ['mobs', 'npcs', 'quests']) if (ex[k] != null && typeof ex[k] !== 'object') return false;
    for (const M of Object.values(ex.mobs || {})) if (!M || !Number.isFinite(M.hp) || !Number.isFinite(M.dmg) || !Array.isArray(M.gold)) return false;
    for (const Q of Object.values(ex.quests || {})) if (!Q || !Q.reward || !Number.isFinite(Q.count)) return false;
    return JSON.stringify(w).length < 2e6;
  } catch (e) { return false; }
}
const openTransport = code => code.startsWith('local') ? bcTransport(code) : p2pTransport(code);

// Relógio da simulação num Worker: o navegador quase para os timers de abas em segundo plano, e o host não pode parar.
// Se o Worker não puder ser criado ou não responder (alguns navegadores com file://), usa um timer comum.
function workerClock(hz, fn) {
  let w = null, id = null, alive = false;
  const fallback = () => { if (id || stopped) return; if (w) w.terminate(); w = null; id = setInterval(fn, 1000 / hz); };
  let stopped = false;
  try {
    const src = `setInterval(() => postMessage(0), ${1000 / hz});`;
    w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.onmessage = () => { alive = true; fn(); }; w.onerror = fallback;
    setTimeout(() => { if (!alive) fallback(); }, 600);
  } catch (e) { fallback(); }
  return () => { stopped = true; if (w) w.terminate(); if (id) clearInterval(id); };
}

const Net = {
  role: null, code: '', t: null, selfId: 'eu', hostId: null, stop: null, onSnap: null, onStatus: null, peers: {},

  async startHost(char, code) {                   // code vazio = solo
    this.role = code ? 'host' : 'solo'; this.code = code || '';
    Sim.reset(); setWorld(currentWorld());
    if (code) {
      this.t = await openTransport(code); this.selfId = this.t.selfId;
      this.t.onMsg = (m, from) => this.hostRecv(m, from);
      this.t.onLeave = id => { if (Sim.players[id]) { this.status(Sim.players[id].name + ' saiu.'); Sim.removePlayer(id); } };
    }
    Sim.addPlayer(this.selfId, char);
    let n = 0, last = performance.now();
    this.stop = workerClock(SIM_HZ, () => {
      const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
      Sim.step(dt);
      if (++n % SNAP_EVERY) return;
      for (const id of Object.keys(Sim.players)) {
        const s = Sim.snapshot(id);
        if (id === this.selfId) this.onSnap && this.onSnap(s); else this.t.send(s, id);
      }
      Sim.endSnapshots();
    });
  },
  hostRecv(m, from) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (m.v !== PROTO) return this.t.send({ t: 'no', why: 'Versão diferente do jogo. Recarregue a página.' }, from);
      if (Object.keys(Sim.players).length >= MAX_PLAYERS && !Sim.players[from]) return this.t.send({ t: 'no', why: 'Sala cheia.' }, from);
      if (!Sim.players[from]) { Sim.addPlayer(from, m.char); this.status(Sim.players[from].name + ' entrou.'); }
      const { devKey, ...extra } = WORLD.extra || {};   // o hash da senha do editor não sai daqui
      this.t.send({ t: 'welcome', world: { regions: REGIONS, extra } }, from);
    } else if (Sim.players[from]) Sim.input(from, m);
  },

  async join(char, code) {
    this.role = 'client'; this.code = code; this.hostId = null;
    this.t = await openTransport(code); this.selfId = this.t.selfId;
    const hello = () => { if (!this.hostId) this.t.send({ t: 'hello', v: PROTO, char }); };
    this.t.onJoin = () => hello();
    this.t.onLeave = id => { if (id === this.hostId) { this.status('O host saiu. A partida acabou.', 1); } };
    this.t.onMsg = (m, from) => {
      if (m.t === 'welcome' && !this.hostId) {
        if (!validWorld(m.world)) return this.status('A sala mandou um mundo inválido.', 1);
        this.hostId = from; setWorld(m.world); View.forget(); this.status('Conectado.');
      }
      else if (m.t === 'no') this.status(m.why, 1);
      else if (m.t === 's' && from === this.hostId) this.onSnap && this.onSnap(m);
    };
    hello();
    const retry = setInterval(() => { if (this.hostId || this.role !== 'client') clearInterval(retry); else hello(); }, 1500);
  },

  send(m) {                                       // do jogador local para o host
    if (this.role === 'client') { if (this.hostId) this.t.send(m, this.hostId); }
    else Sim.input(this.selfId, m);
  },
  status(s, fatal) { this.onStatus && this.onStatus(s, fatal); },
  leave() {
    if (this.stop) this.stop(); this.stop = null;
    if (this.t) this.t.leave(); this.t = null; this.role = null; this.hostId = null;
  },
};
