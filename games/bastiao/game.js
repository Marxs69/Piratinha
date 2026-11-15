/* Bastião: defesa de castelo contra ondas infinitas de zumbis, no estilo RTS (protótipo).
   Mapa hexagonal em 3D de polígonos (estilo 32 bits), sorteado a cada partida: relevo, rios, florestas, rochas e jazidas.
   A câmera não gira: arrasta, aproxima e inclina.
   Aldeões e soldados são unidades no mapa: selecione (clique ou arraste) e mande com o botão direito.
   Aldeões ociosos pegam obras e vagas sozinhos; uma ordem manual sempre vale mais. Feridos, abrigam-se no castelo.
   Quartel e oficina são ampliações do castelo: liberam tropas e deixam o próprio castelo mais forte.
   Os zumbis seguem um campo de fluxo até o castelo: contornam muros quando o desvio compensa, senão derrubam.
   Só o recorde fica salvo no navegador (localStorage). O equilíbrio está nas tabelas abaixo; os modelos e o desenho 3D, em render3d.js.
   A simulação usa só coordenadas do mapa (x, z no chão e y de altura, 1 = uma casa); a tela entra apenas no desenho e no mouse. */

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const SAVE_KEY = 'bastiao.best';
function rng32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ======================= Dados (equilíbrio do jogo) ======================= */
const MAP_W = 46, MAP_H = 42, N = MAP_W * MAP_H;
const ROW_Z = Math.sqrt(3) / 2, HSTEP = .3;                   // distância entre linhas · altura de cada nível de relevo
const TT = { GRASS: 0, FOREST: 1, WATER: 2, ROCK: 3, ORE: 4 };
const TNAME = ['Campo', 'Floresta', 'Rio', 'Rocha', 'Jazida de ferro'];
const RES = { wood: '🪵', stone: '🪨', iron: '⛓', food: '🍖', gold: '🪙' };
const START = { res: { wood: 150, stone: 50, iron: 0, food: 120, gold: 80 }, vil: 4 };
const EAT = 1, TAX = 2.5;                                      // por minuto: comida por vaga de moradia usada · ouro por aldeão
const CASTLE_INCOME = { food: 6, gold: 4 };                  // por minuto, sempre: evita beco sem saída
const MARKET = { wood: [20, 25], stone: [20, 35], iron: [10, 45], food: [30, 25] };   // no castelo: [quantidade, preço em ouro]
const STARVE_T = 12, TERR_R = 5, MAX_BUILDERS = 2;           // s por morte de fome · raio de construção · aldeões por obra
const VIL_SPD = 1.6, SOL_SPD = 1.4;                          // casas por segundo
const FIRST_WAVE = 240, MAX_Z = 400;
const waveGap = n => Math.max(55, 210 - 9 * n);              // s até a onda seguinte: começa lento, aperta aos poucos
const waveCount = n => Math.round(1 + .6 * n + .16 * n * n);  // 2, 3, 4… e só depois dispara
const waveHp = n => .6 + .05 * n + .004 * n * n;             // zumbis fracos no começo, bem mais duros adiante
const waveSides = n => n < 5 ? 1 : n < 10 ? 2 : n < 16 ? 3 : 4;
// Fases: a cada `len` ondas vencidas há uma trégua de `rest` s e tudo recomeça `ahead` ondas à frente, com mais zumbis, mais vida/dano e mais velocidade por fase.
const PHASE = { len: 20, rest: 240, ahead: 5, count: .3, hp: .25, spd: .08 };
const effWave = n => n - (PHASE.len - PHASE.ahead) * G.phase;   // onda n (contagem total) → posição na curva de dificuldade

// work = segundos de obra com 1 aldeão · jobs = vagas · rate = produção por aldeão por minuto · on = terreno · near = [terreno, distância]
// x = explicação que aparece ao clicar no botão · max = quantas podem existir
const BUILD = {
  castle:   { n: 'Castelo',  hp: 2500, pop: 8, atk: { dmg: 14, range: 4, cd: .8, shot: 'arrow' } },
  house:    { n: 'Casa',     d: '+4 moradia',           cost: { wood: 25 },            hp: 200, work: 14, pop: 4, x: 'Abriga 4 pessoas (mais com a pesquisa Moradias). Sem moradia livre não dá para treinar ninguém.' },
  farm:     { n: 'Fazenda',  d: 'comida · +50% no rio', cost: { wood: 30 },            hp: 150, work: 16, jobs: 2, out: 'food',  rate: 10, x: 'Dois aldeões produzem comida. Colada a um rio rende 50% a mais. Cada pessoa come 1 de comida por minuto.' },
  sawmill:  { n: 'Serraria', d: 'perto de floresta',    cost: { wood: 20 },            hp: 180, work: 14, jobs: 2, out: 'wood',  rate: 8, near: [TT.FOREST, 2], x: 'Dois aldeões cortam madeira. Rende conforme a floresta até 2 casas em volta: com 4 casas de floresta chega a 100%.' },
  quarry:   { n: 'Pedreira', d: 'junto à rocha',        cost: { wood: 40 },            hp: 220, work: 16, jobs: 2, out: 'stone', rate: 5.5, near: [TT.ROCK, 1], x: 'Dois aldeões tiram pedra. Precisa encostar numa rocha.' },
  mine:     { n: 'Mina',     d: 'sobre jazida',         cost: { wood: 50, stone: 20 }, hp: 250, work: 20, jobs: 2, out: 'iron',  rate: 4, on: [TT.ORE], x: 'Dois aldeões extraem ferro. Só pode ser erguida em cima de uma jazida.' },
  market:   { n: 'Mercado',  d: 'ouro por recursos',    cost: { wood: 60, stone: 20 }, hp: 300, work: 20, max: 1, x: 'Troca ouro por madeira, pedra, ferro ou comida: clique no mercado para comprar. Você começa com um e só pode ter um.' },
  wall:     { n: 'Muro',     d: 'barra zumbis',         work: 5,  on: [TT.GRASS, TT.FOREST], x: 'Zumbis precisam contornar ou derrubar; saltadores pulam. Arraste para erguer vários. A pesquisa Muros troca a paliçada por troncos e depois por pedra.' },
  gate:     { n: 'Portão',   d: 'sua gente passa',      work: 10, on: [TT.GRASS, TT.FOREST], x: 'Um muro que deixa aldeões e soldados passarem. Zumbis não passam.' },
  tower:    { n: 'Torre',    d: 'atira · alcance 5',    cost: { wood: 40, stone: 30 }, hp: 380, work: 22, on: [TT.GRASS, TT.FOREST], atk: { dmg: 11, range: 5, cd: .9, shot: 'arrow' }, x: 'Atira sozinha nos zumbis ao alcance e emenda com muros. A pesquisa Torres aumenta alcance e dano; no nível 3 (exige pólvora) passa a usar fuzis.' },
};
const BUILD_MENU = ['house', 'farm', 'sawmill', 'quarry', 'mine', 'market', 'wall', 'gate', 'tower'];
// Ampliações do castelo (no painel dele). Cada nível libera tropas e fortalece o castelo: [alcance, dano] somados por nível.
const CASTLE_UP = {
  barracks: { n: 'Quartel', d: ['lanceiro · arqueiro · T2', 'tropas +25% · T3 · aldeão revida'], lv: [{ wood: 80, stone: 30 }, { wood: 120, stone: 120, iron: 30 }],
    x: ['Libera lanceiros, arqueiros e a promoção para T2. O castelo ganha alcance e dano.', 'Todo combatente ganha +25% de vida e dano e pode chegar a T3. Aldeões passam a revidar de perto, com pouco dano, inclusive enquanto fogem. O castelo fica mais forte.'] },
  workshop: { n: 'Oficina', d: ['catapulta · trebuchet', 'canhão'], lv: [{ wood: 100, stone: 60, iron: 15 }, { wood: 150, stone: 150, iron: 60 }],
    x: ['Libera as armas de cerco (catapulta e trebuchet) e a pesquisa Pólvora. O castelo ganha alcance e dano.', 'Libera o canhão. Exige a pesquisa Pólvora. O castelo fica mais forte.'] },
};
const CASTLE_BONUS = [[.5, .25], [1, .4]];                    // nível 1 · nível 2 (alcance arredonda para baixo)
const SQUAD_MUL = 1.25, VIL_ATK = { dmg: 4, cd: 1.2 };          // quartel nv2: vida e dano dos combatentes · golpe do aldeão
const GARRISON = { rate: .15, max: 10, safe: 7, stay: 4 };   // cadência por aldeão abrigado · teto · raio sem zumbis para sair · s mínimos lá dentro
const WALL_T = [
  { n: 'Paliçada',        hp: 160, cost: { wood: 4 },  gate: { wood: 20 } },
  { n: 'Muro de troncos', hp: 340, cost: { wood: 8 },  gate: { wood: 35 } },
  { n: 'Muro de pedra',   hp: 750, cost: { stone: 6 }, gate: { wood: 15, stone: 25 } },
];
// tudo treina no castelo · req = [ampliação, nível] exigidos · time = s de treino · range/min em casas · splash = raio da explosão · shot = projétil (sem shot: golpe direto)
const TROOPS = {
  villager: { n: 'Aldeão',     d: 'constrói e trabalha', civ: 1, cost: { food: 40 },                    pop: 1, hp: 45,  time: 14, x: 'Constrói e trabalha; ocioso, pega obra ou vaga sozinho. Ferido, corre para o castelo e acelera os tiros dele enquanto está abrigado. Com o quartel nv2, revida de perto.' },
  sword:    { n: 'Espadachim', d: 'corpo a corpo',       cost: { gold: 20, food: 20 },                 pop: 1, hp: 150, dmg: 15, range: 1, cd: .8,  time: 12, x: 'Infantaria resistente. Segura a linha na frente dos atiradores.' },
  spear:    { n: 'Lanceiro',   d: 'alcance 2',           cost: { gold: 15, wood: 15, food: 20 },       pop: 1, hp: 120, dmg: 13, range: 2, cd: 1,   time: 12, req: ['barracks', 1], x: 'Acerta a 2 casas: luta por cima de um muro ou atrás de um espadachim.' },
  archer:   { n: 'Arqueiro',   d: 'alcance 5',           cost: { gold: 30, wood: 20, food: 20 },       pop: 1, hp: 70,  dmg: 10, range: 5, cd: 1.2, time: 14, req: ['barracks', 1], shot: 'arrow', x: 'Atira de longe; em terreno mais alto que o alvo ganha +1 de alcance. No T3, que exige pólvora, vira fuzileiro: mais dano e alcance.' },
  catapult: { n: 'Catapulta',  d: 'alcance 3–8 · área',  cost: { gold: 90, wood: 100, iron: 10 },      pop: 2, hp: 100, dmg: 60, range: 8, min: 3, cd: 5.5, time: 24, req: ['workshop', 1], splash: 1, shot: 'rock', siege: 1, x: 'Pedra que acerta uma área, entre 3 e 8 casas. Não atinge quem já está colado nela.' },
  treb:     { n: 'Trebuchet',  d: 'alcance 5–12 · área 2', cost: { gold: 160, wood: 180, iron: 30 },   pop: 2, hp: 120, dmg: 95, range: 12, min: 5, cd: 9, time: 34, req: ['workshop', 1], splash: 2, shot: 'rock', siege: 1, x: 'O maior alcance (5 a 12 casas) e a maior área. Demora a recarregar.' },
  cannon:   { n: 'Canhão',     d: 'alcance 6 · explode', cost: { gold: 140, iron: 60 },                pop: 2, hp: 110, dmg: 50, range: 6, cd: 3.5, time: 26, req: ['workshop', 2], splash: 1, shot: 'ball', siege: 1, x: 'Tiro explosivo direto até 6 casas, bem mais rápido que a catapulta. Exige a oficina nv2.' },
};
const TIER_MUL = .4;                                         // PV e dano a mais por tier
const PROMO = [{ cost: { gold: 35, iron: 8 }, lv: 1 }, { cost: { gold: 80, iron: 25 }, lv: 2 }];   // T1→T2 (quartel) · T2→T3 (quartel nv2; arqueiro também exige pólvora)
const RIFLE = { dmg: 1.7, range: 1, cd: 1.5 };              // arqueiro T3 (fuzileiro)
// spd = casas por segundo · w = peso no sorteio · from = primeira onda · leap = pula muro · boom = dano da explosão
const ZOMBIES = {
  normal: { n: 'Zumbi',       hp: 45,  spd: .38, dmg: 6,  cd: 1,   w: 10, from: 1 },
  runner: { n: 'Corredor',    hp: 28,  spd: .9,  dmg: 4,  cd: .7,  w: 4,  from: 3 },
  jumper: { n: 'Saltador',    hp: 40,  spd: .55, dmg: 7,  cd: 1,   w: 3,  from: 5, leap: 1 },
  boomer: { n: 'Explosivo',   hp: 70,  spd: .32, dmg: 0,  cd: 1,   w: 2,  from: 7, boom: 90 },
  brute:  { n: 'Brutamontes', hp: 380, spd: .28, dmg: 28, cd: 1.5, w: 1,  from: 10 },
};
// Pesquisas globais. O nível 0 é o ponto de partida (ferramentas de madeira, paliçada).
const UPG = {
  tools:  { n: 'Ferramentas', base: 'Madeira',  lv: [{ n: 'Pedra', d: '+25% produção', cost: { wood: 60, stone: 40 } }, { n: 'Metal', d: '+50% produção', cost: { iron: 50, gold: 80 } }], x: 'Aumenta o que cada aldeão produz em fazendas, serrarias, pedreiras e minas.' },
  wall:   { n: 'Muros',       base: 'Paliçada', lv: [{ n: 'Troncos', d: '340 PV', cost: { wood: 150 } }, { n: 'Pedra', d: '750 PV · custa pedra', cost: { stone: 180, gold: 60 } }], x: 'Paliçada, depois troncos, depois pedra. Os muros e portões que já existem são trocados na hora.' },
  tower:  { n: 'Torres',      base: 'Arcos',    lv: [{ n: 'Seteiras', d: '+1 alcance · +40% dano', cost: { wood: 120, stone: 100 } }, { n: 'Fuzis', d: '+2 alcance · +80% dano', cost: { stone: 220, iron: 70, gold: 120 } }], x: 'Vale para todas as torres. O nível 3 exige pólvora: as torres passam a atirar com fuzis.' },
  house:  { n: 'Moradias',    base: 'Cabana',   lv: [{ n: 'Sobrado', d: '+2 por casa', cost: { wood: 140, stone: 70 } }, { n: 'Casarão', d: '+4 por casa', cost: { stone: 220, gold: 200 } }], x: 'Cada casa passa a abrigar mais gente.' },
  powder: { n: 'Pólvora',     base: '—',        lv: [{ n: 'Pólvora', d: 'oficina nv2 · fuzileiros · torres nv3', cost: { gold: 200, iron: 50 } }], x: 'Exige a oficina. Libera a oficina nv2 (canhões), o arqueiro T3 (fuzileiro) e o nível 3 das torres.' },
};
// Explicações de itens fixos da tela: [título, texto]
const HELP = {
  wood: ['Madeira', 'Vem das serrarias. Paga quase toda construção.'], stone: ['Pedra', 'Vem das pedreiras. Paga torres, ampliações e muros de pedra.'], iron: ['Ferro', 'Vem das minas. Paga promoções, armas de cerco e pesquisas avançadas.'],
  food: ['Comida', 'Vem das fazendas (e um pouco do castelo). Cada pessoa come 1 por minuto; sem comida, alguém morre a cada ' + STARVE_T + ' s.'],
  gold: ['Ouro', 'Imposto de ' + TAX + ' por aldeão por minuto, prêmio por onda vencida e por adiantar ondas. Paga tropas e o mercado.'],
  pop: ['População', 'Pessoas / moradia. Casas aumentam o limite. Clique para selecionar os aldeões ociosos (tecla .).'],
  wave: ['Ondas', 'Cada fase tem ' + PHASE.len + ' ondas. As setas mostram de que lado vem a próxima. Vencida a última, há uma trégua e a fase seguinte vem com mais zumbis, mais fortes e mais rápidos.'],
  call: ['Chamar onda', 'Adianta a próxima onda e paga ouro pelo tempo que faltava.'], bell: ['Sino', 'Recolhe todos os aldeões ao castelo (cada abrigado acelera os tiros dele) ou os solta de volta ao serviço. Tecla G.'],
  speed: ['Velocidade', 'Pausa, 1×, 2× ou 4×. Espaço pausa; Tab troca a velocidade. Dá para construir e dar ordens com o jogo pausado.'],
  build: ['Construir', 'Escolha a construção e clique no mapa, dentro da área clara em volta das suas construções. Aldeões ociosos vão para a obra sozinhos.'],
  troop: ['Treinar', 'Tropas saem do castelo e ocupam moradia. Ao lado ficam as ampliações do castelo, que liberam tropas novas.'],
  upg: ['Pesquisas', 'Melhorias que valem para tudo de uma vez: ferramentas, muros, torres, moradias e pólvora.'], demo: ['Demolir', 'Clique numa construção para derrubá-la e receber metade do custo.'],
};
const SHOT = { arrow: { v: 7.5, arc: .35 }, bullet: { v: 16, arc: 0 }, ball: { v: 6.5, arc: .45 }, rock: { v: 3.6, arc: 1.8 } };   // v = casas por segundo · arc = altura do arco

/* ======================= Grade hexagonal ======================= */
// Linhas ímpares deslocadas meia casa. Vizinhos na ordem E, W, NE, NW, SE, SW.
const HQ = new Int16Array(N), HR = new Int16Array(N), NB = [];
for (let i = 0; i < N; i++) {
  const c = i % MAP_W, r = i / MAP_W | 0, odd = r & 1;
  HQ[i] = c - ((r - odd) >> 1); HR[i] = r;
  const d = odd ? [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]] : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
  NB.push(d.map(([dc, dr]) => { const cc = c + dc, rr = r + dr; return cc < 0 || rr < 0 || cc >= MAP_W || rr >= MAP_H ? -1 : rr * MAP_W + cc; }));
}
const dist = (a, b) => { const dq = HQ[a] - HQ[b], dr = HR[a] - HR[b]; return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)); };
function around(i, rad, fn) {
  const c = i % MAP_W, r = i / MAP_W | 0;
  for (let rr = Math.max(0, r - rad); rr <= Math.min(MAP_H - 1, r + rad); rr++)
    for (let cc = Math.max(0, c - rad - 1); cc <= Math.min(MAP_W - 1, c + rad + 1); cc++) { const j = rr * MAP_W + cc; if (dist(i, j) <= rad) fn(j); }
}
const CASTLE = (MAP_H >> 1) * MAP_W + (MAP_W >> 1);

/* ======================= Posição de cada casa no mundo ======================= */
// PX, PZ = centro da casa no chão (fixos) · PY = altura do topo (muda a cada mapa). YAW = para onde aponta cada vizinho.
const PX = new Float32Array(N), PZ = new Float32Array(N), PY = new Float32Array(N);
for (let i = 0; i < N; i++) { PX[i] = i % MAP_W + (HR[i] & 1) * .5; PZ[i] = HR[i] * ROW_Z; }
const YAW = [[1, 0], [-1, 0], [.5, -ROW_Z], [-.5, -ROW_Z], [.5, ROW_Z], [-.5, ROW_Z]].map(([x, z]) => Math.atan2(x, z));
const turn = (o, x, z) => { if (x !== o.x || z !== o.z) o.yaw = Math.atan2(x - o.x, z - o.z); };   // vira para o ponto (a frente dos modelos é +z)

/* ======================= Geração do mapa ======================= */
function noise2(seed) {
  const r = rng32(seed), P = new Float32Array(4096); for (let i = 0; i < 4096; i++) P[i] = r();
  const at = (x, y) => P[(x + y * 64) & 4095], sm = t => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi); return (at(xi, yi) * (1 - fx) + at(xi + 1, yi) * fx) * (1 - fy) + (at(xi, yi + 1) * (1 - fx) + at(xi + 1, yi + 1) * fx) * fy; };
  return (x, y) => clamp(((v(x, y) + .5 * v(x * 2 + 17, y * 2 + 31) + .25 * v(x * 4 + 5, y * 4 + 9)) / 1.75 - .5) * 2 + .5);
}
function tryMap(seed) {
  const rnd = rng32(seed), n1 = noise2(seed + 1), n2 = noise2(seed + 2), n3 = noise2(seed + 3);
  const T = new Uint8Array(N), L = new Uint8Array(N), ri = n => Math.floor(rnd() * n);
  for (let i = 0; i < N; i++) {
    const x = i % MAP_W + (HR[i] & 1) * .5, y = HR[i] * .866, e = n1(x / 9, y / 9), dc = dist(i, CASTLE);
    L[i] = e < .3 ? 0 : e < .55 ? 1 : e < .76 ? 2 : 3;
    if (n2(x / 6, y / 6) > .66) T[i] = TT.FOREST;
    if (n3(x / 5, y / 5) > .84 && L[i] >= 1) T[i] = TT.ROCK;
    if (e < .05) T[i] = TT.WATER;                                  // lagoas no fundo dos vales
    if (dc <= 3) { T[i] = TT.GRASS; L[i] = 1; } else if (dc <= 5) { if (T[i] !== TT.FOREST || dc <= 4) T[i] = TT.GRASS; L[i] = clamp(L[i], 1, 2); }
  }
  // Rios: atravessam o mapa serpenteando, longe do castelo, e escavam o relevo (o nível só desce ao longo do curso)
  const CC = MAP_W / 2, CR = MAP_H / 2;
  for (let k = 0, nr = 1 + (rnd() < .55); k < nr; k++) {
    let ax, ay, bx, by, ok = false;
    for (let t = 0; t < 40 && !ok; t++) {
      if (rnd() < .5) { ax = 0; ay = rnd() * (MAP_H - 1); bx = MAP_W - 1; by = rnd() * (MAP_H - 1); } else { ax = rnd() * (MAP_W - 1); ay = 0; bx = rnd() * (MAP_W - 1); by = MAP_H - 1; }
      const dx = bx - ax, dy = (by - ay) * .866, dd = Math.abs((CC - ax) * dy - (CR - ay) * .866 * dx) / Math.hypot(dx, dy);
      ok = dd > 9 && dd < 17;
    }
    if (!ok) continue;
    const len = Math.hypot(bx - ax, by - ay), steps = Math.ceil(len * 3), ph = rnd() * TAU, fr = 1.5 + rnd() * 2, amp = 1.2 + rnd() * 1.4;
    const nx = -(by - ay) / len, ny = (bx - ax) / len; let lv = 3;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, off = Math.sin(t * Math.PI * fr * 2 + ph) * amp;
      const r = clamp(Math.round(ay + (by - ay) * t + ny * off), 0, MAP_H - 1), c = clamp(Math.round(ax + (bx - ax) * t + nx * off - (r & 1) * .5), 0, MAP_W - 1), i = r * MAP_W + c;
      if (dist(i, CASTLE) < 7) continue;
      T[i] = TT.WATER; lv = Math.min(lv, L[i]); L[i] = lv;
    }
  }
  // Recursos sempre em volta do castelo: floresta, rocha e jazida ao alcance da primeira área de construção
  const ring = (a, b) => { for (let t = 0; t < 600; t++) { const i = ri(N), d = dist(i, CASTLE); if (d >= a && d <= b && T[i] !== TT.WATER && T[i] !== TT.ORE) return i; } return -1; };
  const blob = (i, type, rad, p) => { if (i >= 0) around(i, rad, j => { if (dist(j, CASTLE) > 4 && T[j] !== TT.WATER && (j === i || rnd() < p)) T[j] = type; }); };
  blob(ring(6, 7), TT.FOREST, 2, .75); blob(ring(6, 6), TT.ROCK, 1, .6);
  const ore0 = ring(5, 5); if (ore0 >= 0) T[ore0] = TT.ORE;
  blob(ring(6, 8), TT.ORE, 1, .3);
  for (let k = 0; k < 5; k++) blob(ring(9, 19), TT.ORE, 1, .3);
  const spot = (on, type, rad) => { let ok = false; around(CASTLE, TERR_R, i => { if (!ok && T[i] === on && dist(i, CASTLE) > 1) { if (type == null) ok = true; else around(i, rad, j => { if (T[j] === type) ok = true; }); } }); return ok; };
  if (!spot(TT.GRASS, TT.FOREST, 2) || !spot(TT.GRASS, TT.ROCK, 1) || !spot(TT.ORE)) return null;
  // Toda borda precisa de caminho até o castelo (rocha barra; rio só atrasa)
  const seen = new Uint8Array(N), q = [CASTLE], spawns = [[], [], [], []]; seen[CASTLE] = 1;
  for (let h = 0; h < q.length; h++) for (const j of NB[q[h]]) if (j >= 0 && !seen[j] && T[j] !== TT.ROCK) { seen[j] = 1; q.push(j); }
  for (let i = 0; i < N; i++) if (seen[i]) {
    const c = i % MAP_W, r = HR[i];
    if (r === 0) spawns[0].push(i); else if (c === MAP_W - 1) spawns[1].push(i); else if (r === MAP_H - 1) spawns[2].push(i); else if (c === 0) spawns[3].push(i);
  }
  if (spawns.some(s => s.length < 4)) return null;
  return { seed, T, L, spawns };
}
function genMap(seed) { for (let k = 0; ; k++) { const m = tryMap(seed + k * 7919); if (m) return m; } }

/* ======================= Estado ======================= */
let G = null, T = null, L = null, MINI_BASE = null;
const FLOW = new Int16Array(N), DIST = new Float32Array(N), TERR = new Uint8Array(N);
const UI = { menu: null, tool: null, selB: null, selU: [], hover: -1 };
const cam = { x: 0, z: 0, d: 17, p: .9 };                      // alvo no chão · distância · inclinação (rad acima do horizonte)
const CAM = { d: [5, 46], p: [.38, 1.45] };

function newGame(seed) {
  const m = genMap(seed == null ? Math.floor(Math.random() * 1e9) : seed);
  T = m.T; L = m.L;
  for (let i = 0; i < N; i++) PY[i] = L[i] * HSTEP - (T[i] === TT.WATER ? .12 : 0);
  G = {
    seed: m.seed, spawns: m.spawns, b: new Array(N).fill(null), blds: [], units: [], unitAt: new Array(N).fill(null), vilAt: Array.from({ length: N }, () => []), vilUsed: [], resv: new Set(),
    zs: [], shots: [], fx: [], res: { ...START.res }, cap: 0, used: 0, queued: 0, idle: 0, rate: { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 },
    phase: 0, up: { tools: 0, wall: 0, tower: 0, house: 0, powder: 0 }, cu: { barracks: 0, workshop: 0 }, gp: false, bell: false, gar: 0, safe: true, time: 0, wave: 0, nextWave: FIRST_WAVE, queue: [], plan: [], live: false,
    spawnT: 0, starveT: 0, jobT: 0, flowT: 0, flowDirty: true, meshDirty: true, kills: 0, speed: 1, over: false,
  };
  const c = makeB('castle', CASTLE); c.done = true; c.hp = c.mhp;
  const mk = makeB('market', CASTLE + 2 * MAP_W); mk.done = true; mk.hp = mk.mhp;      // o mercado já vem pronto, ao sul do castelo
  for (let k = 0; k < START.vil; k++) spawnUnit('villager', c);
  buildTerrain(); buildMini(); recalcTerr(); calcFlow(); census(); planWave();
  UI.menu = UI.tool = UI.selB = null; UI.selU = []; UI.hover = -1;
  cam.d = 17; cam.p = .9;
  show('play'); resize(); centerOn(CASTLE); setSpeed(0); renderTools(); renderSub(); renderInfo(); updateTop();
  $('#feed').innerHTML = ''; $('#explain').hidden = true; feed('Mapa nº ' + G.seed); feed('Pausado · espaço começa', 'good');
}
const fmtCost = c => Object.entries(c).map(([k, v]) => RES[k] + v).join(' ') || 'grátis';
const canPay = c => Object.entries(c).every(([k, v]) => G.res[k] >= v);
const pay = c => { for (const k in c) G.res[k] -= c[k]; };
const lack = c => Object.keys(c).filter(k => G.res[k] < c[k]).map(k => RES[k]).join('');
const getCost = k => k === 'wall' ? WALL_T[G.up.wall].cost : k === 'gate' ? WALL_T[G.up.wall].gate : BUILD[k].cost;
const maxHp = k => k === 'wall' ? WALL_T[G.up.wall].hp : k === 'gate' ? WALL_T[G.up.wall].hp * 1.5 : BUILD[k].hp;
const has = (k, lv = 1) => k in G.cu ? G.cu[k] >= lv : G.blds.some(b => b.k === k && b.done && !b.dead);
const countNear = (i, type, rad) => { let n = 0; around(i, rad, j => { if (T[j] === type) n++; }); return n; };
const connects = b => b && b.done && (b.k === 'wall' || b.k === 'gate' || b.k === 'tower' || b.k === 'castle');
const bName = b => b.k === 'wall' ? WALL_T[G.up.wall].n : BUILD[b.k].n;

/* ======================= Economia ======================= */
const prodRate = b => BUILD[b.k].rate * b.eff * (1 + .25 * G.up.tools);
function census() {                                    // conta quem está onde: moradia, trabalhadores presentes e obras com gente
  const rate = { wood: 0, stone: 0, iron: 0, food: CASTLE_INCOME.food, gold: CASTLE_INCOME.gold };
  G.cap = 0; G.used = 0; G.queued = 0; G.idle = 0; G.gar = 0;
  G.safe = !G.zs.some(z => !z.dead && dist(z.h, CASTLE) <= GARRISON.safe);
  for (const b of G.blds) { b.nw = 0; b.nb = 0; b.asg = 0; for (const k of b.q) G.queued += TROOPS[k].pop; }
  for (const i of G.vilUsed) G.vilAt[i].length = 0;
  G.vilUsed.length = 0;
  for (const u of G.units) {
    if (u.dead) continue;
    G.used += TROOPS[u.k].pop;
    if (!u.civ) continue;
    rate.gold += TAX;
    const t = u.task;
    if (u.sh === 2) { G.gar++; if (t) t.b.asg++; continue; }           // abrigado: fora do mapa, mas guarda a vaga
    if (!G.vilAt[u.h].length) G.vilUsed.push(u.h);
    G.vilAt[u.h].push(u);
    if (!t) { if (!u.path && !u.hold && !u.sh) G.idle++; continue; }
    t.b.asg++;
    if (!u.path && dist(u.h, t.b.i) <= 1) { if (t.t === 'build') t.b.nb++; else t.b.nw++; }
  }
  for (const b of G.blds) if (b.done) {
    const d = BUILD[b.k];
    if (d.pop) G.cap += d.pop + (b.k === 'house' ? 2 * G.up.house : 0);
    if (d.jobs) rate[d.out] += b.nw * prodRate(b);
  }
  rate.food -= G.used * EAT; G.rate = rate;
  G.gp = G.up.powder > 0;
}
function economy(dt) {
  for (const k in G.rate) G.res[k] = Math.max(0, G.res[k] + G.rate[k] * dt / 60);
  if (G.res.food <= 0 && G.rate.food < 0) {
    if ((G.starveT += dt) >= STARVE_T) {
      G.starveT = 0; const v = G.units.find(u => u.civ && !u.dead) || G.units.find(u => !u.dead);
      if (v) { dropUnit(v); feed('Fome: ' + TROOPS[v.k].n.toLowerCase() + ' morreu', 'bad'); }
    }
  } else G.starveT = 0;
}
function buy(k) { const [n, p] = MARKET[k]; if (!has('market')) return feed('Sem mercado', 'bad'); if (G.res.gold < p) return feed('Falta 🪙', 'bad'); G.res.gold -= p; G.res[k] += n; }

/* ======================= Construções ======================= */
function makeB(k, i) {
  const d = BUILD[k], mhp = maxHp(k);
  const b = { isB: true, k, i, lv: 1, hp: mhp * .3, mhp, done: false, prog: 0, work: d.work || 1, nw: 0, nb: 0, asg: 0, eff: 1, cd: 0, q: [], qt: 0, hit: -99, noPath: -99, dead: false };
  if (k === 'farm') b.eff = NB[i].some(j => j >= 0 && T[j] === TT.WATER) ? 1.5 : 1;
  if (k === 'sawmill') b.eff = Math.min(1, countNear(i, TT.FOREST, 2) / 4);
  G.b[i] = b; G.blds.push(b); G.flowDirty = G.meshDirty = true;
  return b;
}
function whyNot(k, i) {
  const d = BUILD[k];
  if (i < 0) return 'fora do mapa';
  if (G.b[i] || G.unitAt[i] || G.resv.has(i) || G.vilAt[i].length) return 'ocupado';
  if (d.on ? !d.on.includes(T[i]) : T[i] !== TT.GRASS) return d.on ? 'só em ' + TNAME[d.on[0]].toLowerCase() : 'terreno ruim';
  if (!TERR[i]) return 'longe da base';
  if (d.max && G.blds.filter(b => b.k === k).length >= d.max) return 'já existe';
  if (d.near && !countNear(i, d.near[0], d.near[1])) return 'sem ' + TNAME[d.near[0]].toLowerCase() + ' perto';
  if (G.zs.some(z => z.h === i || z.n === i)) return 'zumbis na casa';
  if (!canPay(getCost(k))) return 'falta ' + lack(getCost(k));
  return '';
}
function tryBuild(k, i, quiet) {
  const why = whyNot(k, i);
  if (why) { if (!quiet) feed(BUILD[k].n + ': ' + why, 'bad'); return false; }
  pay(getCost(k)); const b = makeB(k, i);
  for (const u of UI.selU) if (u.civ && !u.dead && b.asg < MAX_BUILDERS) setTask(u, 'build', b);   // aldeões selecionados já vão para a obra
  G.jobT = 0; return true;
}
function recalcTerr() {
  TERR.fill(0);
  for (const b of G.blds) if (b.done && !b.dead && b.k !== 'wall' && b.k !== 'gate') around(b.i, TERR_R, j => { TERR[j] = 1; });
}
function removeB(b) {
  b.dead = true; G.b[b.i] = null; G.flowDirty = G.meshDirty = true;
  for (const k of b.q) { const c = TROOPS[k].cost; for (const r in c) G.res[r] += c[r]; }
  if (UI.selB === b) { UI.selB = null; renderInfo(); }
  G.blds = G.blds.filter(x => !x.dead);
  if (b.done && b.k !== 'wall' && b.k !== 'gate') recalcTerr();
}
function destroyB(b) {
  G.fx.push({ k: 'boom', x: PX[b.i], y: PY[b.i] + .3, z: PZ[b.i], t: 0, dur: .45, r: .55, c: '#b9b3ab' });
  removeB(b);
  if (b.k === 'castle') return gameOver();
  feed(BUILD[b.k].n + ' destruído', 'bad');
}
function demolish(i) {
  const b = G.b[i];
  if (!b || b.k === 'castle') return;
  const c = getCost(b.k); for (const k in c) G.res[k] += Math.floor(c[k] / 2);
  removeB(b);
}
const cupLock = k => k === 'workshop' && G.cu.workshop === 1 && !G.gp ? 'Pólvora' : '';   // o que falta para a próxima ampliação
function castleUp(k) {
  const u = CASTLE_UP[k], c = u.lv[G.cu[k]], b = G.b[CASTLE];
  if (!c) return false;
  if (cupLock(k)) return feed(u.n + ' nv2: precisa de ' + cupLock(k).toLowerCase(), 'bad'), false;
  if (!canPay(c)) return feed(u.n + ': falta ' + lack(c), 'bad'), false;
  pay(c); G.cu[k]++; G.meshDirty = true; b.mhp += 300; b.hp += 300;
  for (const s of G.units) if (!s.civ) { const f = s.hp / s.mhp; s.mhp = unitStats(s).hp; s.hp = s.mhp * f; }   // quartel nv2 engorda quem já existe
  feed(u.n + ' nv' + G.cu[k] + ' · castelo mais forte', 'good'); return true;
}
function atkOf(b) {                                    // ataque de torre ou castelo, já com pesquisas, ampliações e guarnição
  const a = BUILD[b.k].atk;
  if (!a) return null;
  if (b.k === 'tower') return { ...a, dmg: a.dmg * (1 + .4 * G.up.tower), range: a.range + G.up.tower, shot: G.up.tower >= 2 ? 'bullet' : 'arrow' };
  let r = a.range, m = 1;
  for (const k in G.cu) for (let l = 0; l < G.cu[k]; l++) { r += CASTLE_BONUS[l][0]; m += CASTLE_BONUS[l][1]; }
  return { ...a, dmg: a.dmg * m, range: Math.floor(r), cd: a.cd / (1 + GARRISON.rate * Math.min(GARRISON.max, G.gar)) };
}
function stepBuildings(dt) {
  for (const b of G.blds) {
    if (b.dead) continue;
    if (!b.done) {
      if (!b.nb) continue;
      b.prog += dt * b.nb; b.hp = Math.min(b.mhp, b.hp + b.mhp * .7 * dt * b.nb / b.work);
      if (b.prog >= b.work) { b.done = true; b.hp = b.mhp; G.flowDirty = G.meshDirty = true; G.jobT = 0; if (b.k !== 'wall' && b.k !== 'gate') recalcTerr(); }
      continue;
    }
    if (b.hp < b.mhp && G.time - b.hit > 10) b.hp = Math.min(b.mhp, b.hp + b.mhp * .02 * dt);
    if (b.q.length && (b.qt += dt) >= TROOPS[b.q[0]].time) {             // treino: sai quando há lugar para ficar
      if (spawnUnit(b.q[0], b)) { b.q.shift(); b.qt = 0; } else b.qt = TROOPS[b.q[0]].time;
    }
    if (BUILD[b.k].atk && (b.cd -= dt) <= 0) {
      const a = atkOf(b), z = findZ(b.i, a.range, 0, false);
      if (z) { fire(PX[b.i], PY[b.i] + (b.k === 'castle' ? 1.5 : 1.25), PZ[b.i], z, a, a.dmg); b.cd = a.cd; } else b.cd = .2;
    }
  }
}

/* ======================= Campo de fluxo dos zumbis ======================= */
// Dijkstra a partir do castelo. Construção não barra: só encarece (PV), então zumbi contorna se o desvio for curto e derruba se não for.
function enterCost(i, from) {
  let c = T[i] === TT.WATER ? 3 : T[i] === TT.FOREST ? 1.5 : 1;
  if (L[i] > L[from]) c += .5 * (L[i] - L[from]);
  const b = G.b[i];
  if (b && b.k !== 'castle') c += 2 + b.hp / 12;
  return c;
}
function calcFlow() {
  DIST.fill(Infinity); FLOW.fill(-1);
  const hd = [], hi = [];
  const push = (d, i) => { let k = hd.length; hd.push(d); hi.push(i); while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= d) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; } hd[k] = d; hi[k] = i; };
  const pop = () => {
    const i = hi[0], ld = hd.pop(), li = hi.pop(), n = hd.length;
    if (n) { let k = 0; for (;;) { let c = k * 2 + 1; if (c >= n) break; if (c + 1 < n && hd[c + 1] < hd[c]) c++; if (hd[c] >= ld) break; hd[k] = hd[c]; hi[k] = hi[c]; k = c; } hd[k] = ld; hi[k] = li; }
    return i;
  };
  DIST[CASTLE] = 0; push(0, CASTLE);
  while (hd.length) {
    const d = hd[0], i = pop();
    if (d > DIST[i]) continue;
    for (const j of NB[i]) {
      if (j < 0 || T[j] === TT.ROCK) continue;
      const nd = d + enterCost(i, j);
      if (nd < DIST[j]) { DIST[j] = nd; FLOW[j] = i; push(nd, j); }
    }
  }
  G.flowDirty = false;
}

/* ======================= Ondas e zumbis ======================= */
function planWave() {                                  // sorteia de onde vem a próxima onda (aparece no mapa antes dela chegar)
  const n = effWave(G.wave + 1), sides = [0, 1, 2, 3].sort(() => Math.random() - .5).slice(0, waveSides(n));
  G.plan = sides.map(side => { const a = G.spawns[side][Math.floor(Math.random() * G.spawns[side].length)]; return { side, a, pts: G.spawns[side].filter(i => dist(i, a) <= 4) }; });
}
function launchWave() {
  const n = ++G.wave, e = effWave(n), kinds = Object.keys(ZOMBIES).filter(k => ZOMBIES[k].from <= n), tot = kinds.reduce((s, k) => s + ZOMBIES[k].w, 0);
  for (let i = 0, c = Math.round(waveCount(e) * (1 + PHASE.count * G.phase)); i < c; i++) {
    let r = Math.random() * tot, k = kinds[0];
    for (const kk of kinds) { if ((r -= ZOMBIES[kk].w) < 0) { k = kk; break; } }
    G.queue.push({ k, pts: G.plan[i % G.plan.length].pts, mul: waveHp(e) * (1 + PHASE.hp * G.phase) });
  }
  const last = n % PHASE.len === 0;                      // última da fase: a seguinte só vem depois da trégua
  feed('Onda ' + (n - PHASE.len * G.phase) + (last ? ' · final da fase ' : ' ') + G.plan.map(p => arrowTo(p.a)).join(''), 'bad');
  G.live = true; G.nextWave = last ? Infinity : G.time + waveGap(e); G.spawnT = 0; planWave();
}
function stepWaves(dt) {
  if (G.time >= G.nextWave) launchWave();
  if (G.queue.length && (G.spawnT -= dt) <= 0 && G.zs.length < MAX_Z) {
    const q = G.queue.shift(), d = ZOMBIES[q.k], h = q.pts[Math.floor(Math.random() * q.pts.length)];
    G.zs.push({ k: q.k, h, n: -1, t: 0, hp: d.hp * q.mul, mhp: d.hp * q.mul, mul: q.mul, atkT: 0, leapT: 0, jump: 0, ox: Math.random() * .56 - .28, oz: Math.random() * .4 - .2, x: PX[h], y: PY[h], z: PZ[h], yaw: 0, lunge: 0, hit: -9, sp: 1 + PHASE.spd * G.phase, dead: false });
    G.spawnT = Math.max(.15, 1.2 - effWave(G.wave) * .04);
  }
  if (G.live && !G.queue.length && !G.zs.length) {
    G.live = false; const g = 15 + 5 * G.wave; G.res.gold += g; feed('Onda ' + G.wave + ' vencida · +' + g + '🪙', 'good');
    try { if (G.wave > +(localStorage.getItem(SAVE_KEY) || 0)) localStorage.setItem(SAVE_KEY, G.wave); } catch (e) {}
    if (G.wave % PHASE.len === 0 && !isFinite(G.nextWave)) {             // fase vencida: trégua, e a próxima vem mais dura
      G.phase++; G.nextWave = G.time + PHASE.rest; planWave(); setSpeed(0);
      modal('Fase ' + G.phase + ' vencida', `Trégua de <b>${PHASE.rest / 60} minutos</b> para se preparar.<br><span class="dim">Fase ${G.phase + 1}: mais zumbis, mais fortes e mais rápidos.</span>`, [['▶ Continuar', () => setSpeed(1)]]);
    }
  }
}
function hurt(o, d) {                                  // dano em construção ou unidade
  if (o.dead) return;
  o.hp -= d; o.hit = G.time;
  if (o.hp <= 0) { if (o.isB) destroyB(o); else killUnit(o); } else if (o.civ) shelter(o);
}
function hurtZ(z, d) {
  if (z.dead) return;
  z.hp -= d; z.hit = G.time;
  if (z.hp > 0) return;
  z.dead = true; G.kills++;
  G.fx.push({ k: 'puff', x: z.x, y: z.y + .25, z: z.z, t: 0, dur: .3, r: .22, c: '#78a850' });
  if (ZOMBIES[z.k].boom) explode(z);
}
function explode(z) {
  const dmg = ZOMBIES[z.k].boom * z.mul;
  z.dead = true;
  G.fx.push({ k: 'boom', x: z.x, y: z.y + .25, z: z.z, t: 0, dur: .4, r: 1.1, c: '#ffa63a' });
  around(z.h, 1, j => { if (G.b[j]) hurt(G.b[j], dmg); if (G.unitAt[j]) hurt(G.unitAt[j], dmg * .6); for (const v of G.vilAt[j].slice()) hurt(v, dmg * .6); });
  for (const o of G.zs) if (!o.dead && dist(o.h, z.h) <= 1) hurtZ(o, dmg * .3);
}
function zAttack(z, o) {
  const d = ZOMBIES[z.k];
  if (o.isB) turn(z, PX[o.i], PZ[o.i]); else turn(z, o.x, o.z);
  if (z.atkT > 0) return;
  if (d.boom) return explode(z);
  z.atkT = d.cd; z.lunge = .15; hurt(o, d.dmg * z.mul);
}
const preyAt = j => G.unitAt[j] || G.vilAt[j].find(v => !v.dead);
function stepZombie(z, dt) {
  const d = ZOMBIES[z.k];
  z.atkT -= dt; z.leapT -= dt; z.lunge -= dt;
  if (z.n < 0) {                                         // parado numa casa: decide o que fazer
    let u = preyAt(z.h);
    if (!u) for (const j of NB[z.h]) if (j >= 0 && (u = preyAt(j))) break;
    if (u) return zAttack(z, u);
    const n = FLOW[z.h];
    if (n < 0) return;
    const b = G.b[n];
    if (b) {
      const over = d.leap && b.k === 'wall' && z.leapT <= 0 ? NB[n][NB[z.h].indexOf(n)] : -1;   // casa do outro lado do muro
      if (over >= 0 && !G.b[over] && T[over] !== TT.ROCK) { z.jump = 1; z.n = over; z.t = 0; z.leapT = 6; } else return zAttack(z, b);
    } else { z.n = n; z.t = 0; }
    turn(z, PX[z.n] + z.ox, PZ[z.n] + z.oz);
  }
  if (!z.jump && G.b[z.n]) { z.n = -1; z.t = 0; }        // ergueram algo no caminho
  else {
    z.t += dt * (z.jump ? 2 : d.spd * z.sp * (T[z.n] === TT.WATER ? .45 : T[z.n] === TT.FOREST ? .8 : 1));
    if (z.t >= 1) { z.h = z.n; z.n = -1; z.t = 0; z.jump = 0; }
  }
}

/* ======================= Unidades (aldeões e soldados) ======================= */
function unitStats(u) {
  const d = TROOPS[u.k], m = (1 + TIER_MUL * u.tier) * (!u.civ && has('barracks', 2) ? SQUAD_MUL : 1), rifle = u.k === 'archer' && u.tier >= 2;
  return { hp: d.hp * m, dmg: (d.dmg || 0) * m * (rifle ? RIFLE.dmg : 1), range: (d.range || 0) + (rifle ? RIFLE.range : 0), cd: rifle ? RIFLE.cd : d.cd, shot: rifle ? 'bullet' : d.shot, rifle };
}
const walkable = j => j >= 0 && T[j] !== TT.ROCK && (!G.b[j] || (G.b[j].k === 'gate' && G.b[j].done));   // sua gente não atravessa rocha nem construção (só portão)
const freeHex = i => i >= 0 && !G.b[i] && !G.unitAt[i] && !G.resv.has(i) && (T[i] === TT.GRASS || T[i] === TT.FOREST || T[i] === TT.ORE);
function findPath(a, goal) {                           // busca em largura até a primeira casa que satisfaz goal(j)
  const par = new Int32Array(N).fill(-1), q = [a]; par[a] = a;
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    if (goal(i)) { const p = []; for (let j = i; j !== a; j = par[j]) p.push(j); return p.reverse(); }
    for (const j of NB[i]) if (j >= 0 && par[j] < 0 && walkable(j)) { par[j] = i; q.push(j); }
  }
  return null;
}
function nearFree(i) { for (let rad = 0; rad <= 7; rad++) { let best = -1; around(i, rad, j => { if (best < 0 && dist(i, j) === rad && freeHex(j)) best = j; }); if (best >= 0) return best; } return -1; }
function spawnUnit(k, b) {
  const d = TROOPS[k], door = NB[b.i].filter(walkable), h = !d.civ ? nearFree(b.i) : door.length ? door[Math.floor(Math.random() * door.length)] : b.i;
  if (h < 0) return null;
  const u = { k, civ: !!d.civ, h, hp: d.hp, mhp: d.hp, tier: 0, cd: 0, path: null, t: 0, x: PX[h], y: PY[h], z: PZ[h], ox: d.civ ? Math.random() * .44 - .22 : 0, oz: d.civ ? Math.random() * .3 - .15 : 0, yaw: 0, task: null, hold: false, back: null, sh: 0, shT: 0, shFail: -99, hit: -99, dead: false };
  u.hp = u.mhp = unitStats(u).hp;
  G.units.push(u); if (!u.civ) G.unitAt[h] = u;
  return u;
}
function lockWhy(k) {                                  // por que a unidade ainda não pode ser treinada ('' = liberada)
  const r = TROOPS[k].req;
  return r && !has(r[0], r[1]) ? CASTLE_UP[r[0]].n + (r[1] > 1 ? ' nv' + r[1] : '') : '';
}
function queueTrain(k) {
  const d = TROOPS[k], fail = m => (feed(d.n + ': ' + m, 'bad'), false), lock = lockWhy(k);
  if (lock) return fail('precisa de ' + lock.toLowerCase());
  const b = G.b[CASTLE];
  if (!b) return false;
  if (b.q.length >= 8) return fail('fila cheia');
  if (!canPay(d.cost)) return fail('falta ' + lack(d.cost));
  if (G.used + G.queued + d.pop > G.cap) return fail('falta moradia');
  pay(d.cost); b.q.push(k); G.queued += d.pop; return true;
}
function promoLock(u) {                                // o que falta para a próxima promoção ('' = liberada)
  const p = PROMO[u.tier];
  return !has('barracks', p.lv) ? 'Quartel' + (p.lv > 1 ? ' nv2' : '') : u.k === 'archer' && u.tier === 1 && !G.gp ? 'Pólvora' : '';
}
function promote(u) {
  const p = PROMO[u.tier], d = TROOPS[u.k];
  if (u.civ || d.siege || !p) return false;
  if (promoLock(u)) return feed('Promoção: precisa de ' + promoLock(u).toLowerCase(), 'bad'), false;
  if (!canPay(p.cost)) return feed('Promoção: falta ' + lack(p.cost), 'bad'), false;
  pay(p.cost); const f = u.hp / u.mhp; u.tier++; u.mhp = unitStats(u).hp; u.hp = u.mhp * f; return true;
}
function setTask(v, t, b) {                            // manda o aldeão construir ou trabalhar em b
  const path = findPath(v.h, j => j !== b.i && dist(j, b.i) <= 1);
  if (!path) { b.noPath = G.time; return false; }
  v.task = { t, b }; v.hold = false; v.path = path.length ? path : null; v.t = 0; b.asg++;
  return true;
}
function orderMove(u, i) {
  if (u.civ) {
    const path = walkable(i) ? findPath(u.h, j => j === i) : G.b[i] ? findPath(u.h, j => j !== i && dist(j, i) <= 1) : null;   // construção: para ao lado
    if (!path) return false;
    u.task = null; u.back = null; u.hold = true; u.path = path.length ? path : null; u.t = 0; return true;
  }
  const dest = nearFree(i), path = dest < 0 ? null : findPath(u.h, j => j === dest);
  if (!path || !path.length) return false;
  if (u.path) G.resv.delete(u.path[u.path.length - 1]); else if (G.unitAt[u.h] === u) G.unitAt[u.h] = null;
  u.path = path; u.t = 0; G.resv.add(dest); return true;
}
function order(i) {                                    // botão direito com unidades selecionadas
  const sel = UI.selU.filter(u => !u.dead), b = G.b[i];
  if (!sel.length || i < 0) return;
  let fails = 0;
  for (const u of sel) {
    if (u.sh === 1) u.sh = 0;                              // ordem manual interrompe a fuga
    if (u.civ && b && !b.done) { if (!setTask(u, 'build', b)) fails++; }
    else if (u.civ && b && BUILD[b.k].jobs) { if (b.asg >= BUILD[b.k].jobs) { feed(BUILD[b.k].n + ': vagas cheias', 'bad'); break; } if (!setTask(u, 'work', b)) fails++; }
    else if (!orderMove(u, i)) fails++;
  }
  if (fails) feed(fails === sel.length ? 'Sem caminho' : fails + ' sem caminho', 'bad');
  G.fx.push({ k: 'ping', i, t: 0, dur: .5 });
}
function dropUnit(u) {
  u.dead = true; G.units = G.units.filter(x => !x.dead);
  if (G.unitAt[u.h] === u) G.unitAt[u.h] = null;
  if (u.path && !u.civ) G.resv.delete(u.path[u.path.length - 1]);
  if (UI.selU.includes(u)) { UI.selU = UI.selU.filter(x => x !== u); renderInfo(); }
}
function killUnit(u) { G.fx.push({ k: 'puff', x: u.x, y: u.y + .25, z: u.z, t: 0, dur: .4, r: .28, c: '#d93a3a' }); dropUnit(u); feed(TROOPS[u.k].n + ' morreu', 'bad'); }
function dispatch() {                                  // aldeões ociosos pegam obras e vagas; obra sem ninguém puxa um trabalhador e o devolve depois
  const idle = G.units.filter(u => u.civ && !u.dead && !u.task && !u.hold && !u.path && !u.sh);
  const nearest = (list, i) => { let k = -1, bd = 1e9; list.forEach((u, n) => { const d = dist(u.h, i); if (d < bd) { bd = d; k = n; } }); return k < 0 ? null : list.splice(k, 1)[0]; };
  for (const b of G.blds) {
    if (b.dead || G.time - b.noPath < 5) continue;
    if (!b.done) {
      while (b.asg < MAX_BUILDERS && idle.length) if (!setTask(nearest(idle, b.i), 'build', b)) break;
      if (!b.asg) {
        const w = nearest(G.units.filter(u => u.civ && !u.dead && !u.sh && u.task && u.task.t === 'work'), b.i);
        if (w) { const old = w.task.b; if (setTask(w, 'build', b)) w.back = old; }
      }
    } else if (BUILD[b.k].jobs) while (b.asg < BUILD[b.k].jobs && idle.length) if (!setTask(nearest(idle, b.i), 'work', b)) break;
  }
}
function moveAlong(u, dt, spd) {
  if (!u.path) return false;
  const n = u.path[0];
  u.t += dt * spd * (T[n] === TT.WATER ? .5 : 1); turn(u, PX[n] + u.ox, PZ[n] + u.oz);
  if (u.t >= 1) { u.h = n; u.t = 0; u.path.shift(); if (!u.path.length) { u.path = null; if (!u.civ) { G.unitAt[n] = u; G.resv.delete(n); } } }
  return true;
}
function shelter(v) {                                  // corre para o castelo (ferido ou pelo sino)
  if (v.sh || G.time - v.shFail < 3) return;
  const p = findPath(v.h, j => j !== CASTLE && dist(j, CASTLE) <= 1);
  if (!p) { v.shFail = G.time; return; }
  v.sh = 1; v.path = p.length ? p : null; v.t = 0;
}
function leave(v) {                                    // sai do castelo; o serviço de antes é retomado sozinho
  const door = NB[CASTLE].filter(walkable);
  if (v.sh === 2 && door.length) v.h = door[Math.floor(Math.random() * door.length)];
  v.sh = 0; v.path = null; v.t = 0;
}
function bell() {
  G.bell = !G.bell;
  if (!G.bell) for (const v of G.units) if (v.sh) leave(v);
  feed(G.bell ? '🔔 Aldeões ao castelo' : '🔔 Aldeões liberados');
}
function stepVillager(v, dt) {
  if (v.sh === 2) { if (!G.bell && G.safe && G.time - v.shT > GARRISON.stay) leave(v); return; }
  if (G.bell && !v.sh) shelter(v);
  if (has('barracks', 2) && (v.cd -= dt) <= 0) {         // quartel nv2: revida em quem está colado, mesmo fugindo
    const z = findZ(v.h, 1, 0, false); v.cd = z ? VIL_ATK.cd : .3;
    if (z) { hurtZ(z, VIL_ATK.dmg); G.fx.push({ k: 'slash', x: z.x, y: z.y + .3, z: z.z, t: 0, dur: .15 }); }
  }
  if (moveAlong(v, dt, VIL_SPD * (v.sh ? 1.25 : 1))) return;
  if (v.sh === 1) {                                      // chegou: entra (some do mapa e reforça os tiros do castelo)
    if (dist(v.h, CASTLE) <= 1) { v.sh = 2; v.shT = G.time; if (UI.selU.includes(v)) UI.selU = UI.selU.filter(x => x !== v); }
    else { v.sh = 0; shelter(v); }
    return;
  }
  const t = v.task;
  if (!t) return;
  const b = t.b;
  if (b.dead || (t.t === 'build' && b.done)) {           // obra pronta: fica trabalhando nela, ou volta ao serviço de antes
    v.task = null;
    const next = !b.dead && BUILD[b.k].jobs && b.asg <= BUILD[b.k].jobs ? b : v.back && !v.back.dead ? v.back : null;
    v.back = null;
    if (next) setTask(v, 'work', next);
  } else if (dist(v.h, b.i) > 1 && !setTask(v, t.t, b)) v.task = null;
}
function findZ(h, range, min, high) {                  // zumbi mais próximo no alcance (terreno alto: +1 para quem atira longe)
  let best = null, bd = 99;
  for (const z of G.zs) {
    if (z.dead) continue;
    const d = dist(h, z.h);
    if (d >= min && d < bd && d <= range + (high && L[h] > L[z.h] ? 1 : 0)) { bd = d; best = z; }
  }
  return best;
}
function fire(x, y, z, zt, d, dmg) {                   // dispara de (x, y, z) no zumbi zt
  if (!d.shot) { hurtZ(zt, dmg); G.fx.push({ k: 'slash', x: zt.x, y: zt.y + .3, z: zt.z, t: 0, dur: .15 }); return; }
  const th = zt.n >= 0 && !zt.jump ? zt.n : zt.h, s = SHOT[d.shot], tx = d.splash ? PX[th] : zt.x, ty = d.splash ? PY[th] : zt.y + .25, tz = d.splash ? PZ[th] : zt.z;
  if (d.shot === 'bullet' || d.shot === 'ball') G.fx.push({ k: 'puff', x, y, z, t: 0, dur: .25, r: .18, c: '#e8e8e8' });
  G.shots.push({ k: d.shot, x0: x, y0: y, z0: z, tx, ty, tz, z: zt, th, t: 0, dur: Math.max(.08, Math.hypot(tx - x, ty - y, tz - z) / s.v), dmg, splash: d.splash || 0, arc: s.arc * (d.range > 9 ? 1.5 : 1) });
}
function stepSoldier(u, dt) {
  if (moveAlong(u, dt, SOL_SPD)) return;
  const d = TROOPS[u.k];
  if (u.hp < u.mhp && G.time - u.hit > 8) u.hp = Math.min(u.mhp, u.hp + u.mhp * .02 * dt);
  if ((u.cd -= dt) > 0) return;
  const s = unitStats(u), z = findZ(u.h, s.range, d.min || 0, s.range > 2);
  if (!z) { u.cd = .2; return; }
  turn(u, z.x, z.z); u.cd = s.cd;
  fire(u.x, u.y + .35, u.z, z, { shot: s.shot, splash: d.splash, range: s.range }, s.dmg);
}
function stepShots(dt) {
  for (const s of G.shots) {
    if (!s.splash && !s.z.dead) { s.tx = s.z.x; s.ty = s.z.y + .25; s.tz = s.z.z; }
    if ((s.t += dt / s.dur) < 1) continue;
    s.done = true;
    if (!s.splash) { hurtZ(s.z, s.dmg); continue; }
    G.fx.push({ k: 'boom', x: s.tx, y: s.ty + .15, z: s.tz, t: 0, dur: .35, r: .5 + .5 * s.splash, c: s.k === 'ball' ? '#ffa63a' : '#c9b9a0' });
    for (const z of G.zs) { if (z.dead) continue; const dd = dist(z.h, s.th); if (dd <= s.splash) hurtZ(z, s.dmg * (dd ? .6 : 1)); }
  }
}
function place() {                                     // posição no mundo de quem anda
  for (const z of G.zs) {
    const a = z.h, b = z.n < 0 ? a : z.n, t = z.t;
    z.x = PX[a] + (PX[b] - PX[a]) * t + z.ox; z.z = PZ[a] + (PZ[b] - PZ[a]) * t + z.oz; z.y = PY[a] + (PY[b] - PY[a]) * t + (z.jump ? Math.sin(t * Math.PI) * .9 : 0);
  }
  for (const u of G.units) {
    const b = u.path ? u.path[0] : u.h;
    u.x = PX[u.h] + (PX[b] - PX[u.h]) * u.t + u.ox; u.z = PZ[u.h] + (PZ[b] - PZ[u.h]) * u.t + u.oz; u.y = PY[u.h] + (PY[b] - PY[u.h]) * u.t;
  }
}

/* ======================= Passo da simulação ======================= */
function tick(dt) {
  if (!G || G.over) return;
  G.time += dt;
  census(); place(); economy(dt); stepWaves(dt);
  if ((G.jobT -= dt) <= 0) { G.jobT = 1; dispatch(); }
  if (G.flowDirty && (G.flowT -= dt) <= 0) { calcFlow(); G.flowT = .3; }
  for (const z of G.zs) if (!z.dead) stepZombie(z, dt);
  for (const u of G.units) if (!u.dead) (u.civ ? stepVillager : stepSoldier)(u, dt);
  stepBuildings(dt); stepShots(dt);
  for (const f of G.fx) f.t += dt;
  G.zs = G.zs.filter(z => !z.dead); G.units = G.units.filter(u => !u.dead); G.blds = G.blds.filter(b => !b.dead);
  G.shots = G.shots.filter(s => !s.done); G.fx = G.fx.filter(f => f.t < f.dur);
}
function gameOver() {
  G.over = true;
  let best = 0; try { best = Math.max(+(localStorage.getItem(SAVE_KEY) || 0), G.wave - 1); localStorage.setItem(SAVE_KEY, best); } catch (e) {}
  modal('O castelo caiu', `Fase <b>${G.phase + 1}</b> · onda <b>${G.wave}</b> · ${G.kills} zumbis abatidos<br><span class="dim">Recorde: onda ${best}</span>`,
    [['🏰 Novo mapa', () => newGame()], ['Menu', toMenu]]);
}

/* ======================= Desenho ======================= */
// #gl = cena 3D (render3d.js) · cv = camada 2D por cima: barras de vida, caixa de seleção e o mouse.
const cv = $('#cv'), g = cv.getContext('2d'), mini = $('#mini'), mg = mini.getContext('2d');
const GRASS_C = ['#4f9440', '#5fa648', '#70b552', '#84c460'], FOREST_C = ['#417a35', '#4e883b', '#5c9543', '#6ca14f'], ROCK_C = ['#8d8780', '#99938b', '#a59f97', '#b1aba3'];
const hex3 = h => [1, 3, 5].map(k => parseInt(h.substr(k, 2), 16) / 255), NONE = [0, 0, 0], WHITE = [1, 1, 1];
function buildTerrain() {                              // o chão vira uma malha só, uma vez por mapa
  const rock = i => T[i] === TT.ROCK || T[i] === TT.ORE;
  R3D.setTerrain(N, PX, PZ, NB, i => [PY[i], T[i] === TT.WATER ? '#3f7fd0' : rock(i) ? ROCK_C[L[i]] : T[i] === TT.FOREST ? FOREST_C[L[i]] : GRASS_C[L[i]]], i => rock(i) ? '#6a645e' : '#7d5a3a');
}
function buildMini() {
  MINI_BASE = document.createElement('canvas'); MINI_BASE.width = MAP_W * 3; MINI_BASE.height = MAP_H * 3;
  const m = MINI_BASE.getContext('2d');
  for (let i = 0; i < N; i++) {
    m.fillStyle = T[i] === TT.WATER ? '#3f7fd0' : T[i] === TT.ROCK ? '#8d8780' : T[i] === TT.ORE ? '#f0a24a' : T[i] === TT.FOREST ? '#2f7030' : GRASS_C[L[i]];
    m.fillRect((i % MAP_W) * 3 + (HR[i] & 1), HR[i] * 3, 3, 3);
  }
  mini.width = MINI_BASE.width; mini.height = MINI_BASE.height;
}
// Nome do modelo de cada peça (as funções ficam em DEFS, no render3d.js)
const bModel = b => !b.done ? 'site' : b.k === 'wall' ? 'post' + G.up.wall : b.k === 'gate' ? 'gate' + G.up.wall : b.k === 'tower' ? 'tower' + G.up.tower : b.k === 'house' ? 'house' + G.up.house : b.k === 'castle' ? 'castle' + G.cu.barracks + G.cu.workshop : b.k;
const uModel = u => u.civ ? 'villager' : TROOPS[u.k].siege ? u.k : (u.k === 'archer' && u.tier >= 2 ? 'rifle' : u.k) + u.tier;
function buildStatics() {                              // natureza e construções: refeito só quando algo é erguido, derrubado ou melhorado
  const list = [], put = (m, i, yaw) => list.push({ m, x: PX[i], y: PY[i], z: PZ[i], yaw });
  for (let i = 0; i < N; i++) {
    const b = G.b[i];
    if (!b) { if (T[i] === TT.FOREST) put('forest' + i % 3, i, i * 2.4 % TAU); else if (T[i] === TT.ROCK) put('rock' + i % 2, i, i * 1.3 % TAU); else if (T[i] === TT.ORE) put('ore', i, i * .9 % TAU); continue; }
    const links = connects(b) ? [0, 1, 2, 3, 4, 5].filter(d => connects(G.b[NB[i][d]])) : [];   // muro, portão, torre e castelo se emendam
    put(bModel(b), i, !b.done ? 0 : b.k === 'gate' && links.length ? YAW[links[0]] + Math.PI / 2 : b.k === 'house' ? (i % 3 - 1) * .5 : 0);
    for (const d of links) put('arm' + G.up.wall, i, YAW[d]);
  }
  R3D.setStatics(list); G.meshDirty = false;
}
function rangeOf() {                                   // [casa, alcance, mínimo] a realçar
  const b = UI.selB, u = UI.selU.length === 1 ? UI.selU[0] : null, t = UI.tool;
  if (t && t.t === 'build' && t.k === 'tower' && UI.hover >= 0) return [UI.hover, BUILD.tower.atk.range + G.up.tower, 0];
  if (b && b.done && BUILD[b.k].atk) return [b.i, atkOf(b).range, 0];
  if (u && !u.civ && !u.path) return [u.h, unitStats(u).range, TROOPS[u.k].min || 0];
  return null;
}
const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
const arrowTo = i => ARROWS[((Math.round(Math.atan2(PZ[i] - PZ[CASTLE], PX[i] - PX[CASTLE]) / (Math.PI / 4)) % 8) + 8) % 8];   // de onde vem, visto do castelo
const MARK = { range: [WHITE, .2], dim: [[.03, .04, .07], .5], warn: [[1, .22, .22], .5], hover: [WHITE, .3], ok: [[.45, 1, .55], .55], bad: [[1, .3, .35], .55], sel: [[1, .82, .34], .5] };
function tiles(list, kind, r = .96, fade = 1) { const pts = []; for (const i of list) pts.push(PX[i], PY[i], PZ[i]); R3D.hexes(pts, r, MARK[kind][0], MARK[kind][1] * fade); }
function bar(x, y, z, w, f, col) {                     // barra na camada 2D, sobre um ponto do mundo
  const p = R3D.project(x, y, z); if (!p) return;
  const bx = Math.round(p[0] - w / 2), by = Math.round(p[1]);
  g.fillStyle = '#000'; g.fillRect(bx - 1, by - 1, w + 2, 5); g.fillStyle = col; g.fillRect(bx, by, Math.max(1, Math.round(w * clamp(f))), 3);
}
let boxSel = null;
function draw() {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  if (!G) return;
  place();
  if (G.meshDirty) buildStatics();
  R3D.begin(cam);
  // Realces no chão
  const rg = rangeOf(), hv = UI.hover, t = UI.tool;
  if (t && t.t === 'build') { const l = []; for (let i = 0; i < N; i++) if (!TERR[i]) l.push(i); tiles(l, 'dim', 1); }
  if (rg) { const l = []; around(rg[0], rg[1], j => { if (dist(j, rg[0]) >= rg[2]) l.push(j); }); tiles(l, 'range', .9); }
  if (G.nextWave - G.time < 30 && Math.sin(G.time * 5) > 0) for (const p of G.plan) tiles(p.pts, 'warn');
  if (hv >= 0) tiles([hv], !t ? 'hover' : (t.t === 'build' ? !whyNot(t.k, hv) : G.b[hv] && G.b[hv].k !== 'castle') ? 'ok' : 'bad');
  if (UI.selB) tiles([UI.selB.i], 'sel');
  for (const f of G.fx) if (f.k === 'ping') tiles([f.i], 'ok', .8, 1 - f.t / f.dur);
  const sh = [], ring = [];
  for (const z of G.zs) sh.push(z.x, z.y, z.z);
  for (const u of G.units) if (u.sh !== 2) sh.push(u.x, u.y, u.z);
  for (const u of UI.selU) if (u.sh !== 2) ring.push(u.x, u.y + .01, u.z);
  R3D.hexes(sh, .4, NONE, .3); R3D.hexes(ring, .62, MARK.ok[0], .7);
  // Gente e zumbis (piscam em branco quando levam dano)
  const flash = o => G.time - o.hit < .08 ? [.45, .45, .45] : NONE;
  for (const z of G.zs) {
    const bob = z.n >= 0 ? Math.abs(Math.sin(G.time * 9 + z.ox * 20)) * .04 : 0, l = z.lunge > 0 ? .12 : 0;
    R3D.inst('z_' + z.k, z.x + Math.sin(z.yaw) * l, z.y + bob, z.z + Math.cos(z.yaw) * l, z.yaw, 1.15, WHITE, flash(z));
  }
  for (const u of G.units) {
    if (u.sh === 2) continue;
    const busy = u.path || (u.task && dist(u.h, u.task.b.i) <= 1), bob = busy ? Math.abs(Math.sin(G.time * (u.path ? 12 : 7) + u.ox * 20)) * .04 : 0;
    R3D.inst(uModel(u), u.x, u.y + bob, u.z, u.yaw, 1.15, WHITE, flash(u));
  }
  // Projéteis e efeitos
  for (const s of G.shots) {
    const x = s.x0 + (s.tx - s.x0) * s.t, y = s.y0 + (s.ty - s.y0) * s.t + Math.sin(s.t * Math.PI) * s.arc, z = s.z0 + (s.tz - s.z0) * s.t;
    if (s.k === 'arrow') R3D.inst('arrow', x, y, z, Math.atan2(s.tx - s.x0, s.tz - s.z0));
    else if (s.k === 'bullet') R3D.inst('cube', x, y, z, 0, .06, [1, .95, .6], [.3, .3, .1]);
    else R3D.inst(s.k === 'ball' ? 'oct' : 'cube', x, y, z, s.t * 6, s.k === 'ball' ? .09 : .15, s.k === 'ball' ? [.25, .26, .3] : [.66, .63, .58]);
  }
  for (const f of G.fx) {
    if (f.k === 'ping') continue;
    const p = f.t / f.dur;
    if (f.k === 'slash') { const q = R3D.project(f.x, f.y, f.z); if (q) { g.fillStyle = '#fff'; g.fillRect(Math.round(q[0]) - 6, Math.round(q[1]) - 1, 13, 2); g.fillRect(Math.round(q[0]) - 1, Math.round(q[1]) - 6, 2, 13); } continue; }
    R3D.blob(f.x, f.y, f.z, f.r * (.3 + .7 * p), hex3(f.c), 1 - p);
    if (f.k === 'boom') R3D.blob(f.x, f.y, f.z, f.r * .5 * (1 - p), [1, .95, .63], 1 - p);
  }
  // Barras (camada 2D)
  for (const b of G.blds) {
    const x = PX[b.i], y = PY[b.i] + (b.k === 'castle' ? 2.2 : b.k === 'tower' ? 1.5 : .9), z = PZ[b.i];
    if (!b.done) bar(x, y, z, 26, b.prog / b.work, '#7db4ff'); else if (b.hp < b.mhp) bar(x, y, z, 30, b.hp / b.mhp, '#7fe08a');
    if (b.q.length) bar(x, y + .22, z, 30, b.qt / TROOPS[b.q[0]].time, '#ffd257');
  }
  for (const u of G.units) if (u.hp < u.mhp && u.sh !== 2) bar(u.x, u.y + .8, u.z, 18, u.hp / u.mhp, '#7db4ff');
  for (const z of G.zs) if (z.hp < z.mhp) bar(z.x, z.y + (z.k === 'brute' ? 1.15 : .8), z.z, 16, z.hp / z.mhp, '#ff5d6c');
  if (boxSel) {                                          // caixa de seleção (em px de tela)
    g.strokeStyle = '#8dff9d'; g.fillStyle = 'rgba(141,255,157,.12)'; g.lineWidth = 1;
    const x = Math.min(boxSel.x0, boxSel.x1) + .5, y = Math.min(boxSel.y0, boxSel.y1) + .5, w = Math.abs(boxSel.x1 - boxSel.x0), h = Math.abs(boxSel.y1 - boxSel.y0);
    g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
  }
}
const mx = i => (i % MAP_W) * 3 + (HR[i] & 1), my = i => HR[i] * 3;
function drawMini() {                                  // norte do mapa sempre em cima
  mg.drawImage(MINI_BASE, 0, 0);
  for (const b of G.blds) { mg.fillStyle = b.k === 'castle' ? '#ffd257' : b.k === 'wall' || b.k === 'gate' ? '#d8d2c8' : '#ffffff'; mg.fillRect(mx(b.i), my(b.i), 3, 3); }
  for (const u of G.units) { mg.fillStyle = u.civ ? '#ffe9a0' : '#7db4ff'; mg.fillRect(mx(u.h), my(u.h), 2, 2); }
  mg.fillStyle = '#ff3b3b'; for (const z of G.zs) mg.fillRect(mx(z.h), my(z.h), 2, 2);
  if (G.nextWave - G.time < 30) for (const p of G.plan) for (const i of p.pts) mg.fillRect(mx(i), my(i), 3, 3);
  const hw = cam.d * R3D.TANF * cv.width / cv.height, hh = cam.d * R3D.TANF / Math.sin(cam.p) / ROW_Z;   // retângulo aproximado do que a câmera vê
  mg.strokeStyle = '#fff'; mg.lineWidth = 1; mg.strokeRect(Math.round((cam.x - hw) * 3) + .5, Math.round((cam.z / ROW_Z - hh) * 3) + .5, Math.round(hw * 6), Math.round(hh * 6));
}

/* ======================= Interface ======================= */
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function feed(msg, cls) { const f = $('#feed'), d = el('div', cls, msg); f.append(d); while (f.children.length > 5) f.firstChild.remove(); setTimeout(() => d.remove(), 7000); }
function modal(title, body, btns) {
  $('#mo-title').textContent = title; $('#mo-body').innerHTML = body;
  const f = $('#mo-foot'); f.innerHTML = '';
  for (const [label, fn] of btns) { const b = el('button', 'btn small', label); b.onclick = () => { $('#modal').hidden = true; fn && fn(); }; f.append(b); }
  $('#modal').hidden = false;
}
function toMenu() {
  G = null; show('menu');
  let best = 0; try { best = +(localStorage.getItem(SAVE_KEY) || 0); } catch (e) {}
  $('#m-info').textContent = best ? 'Recorde: onda ' + best : 'Mapa novo a cada partida';
}
function setSpeed(s) { if (G) G.speed = s; document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.s === s)); }
function icon(k, o) {                                  // miniatura 3D da peça (o = construção ou unidade real, se houver)
  if (k === 'wall') return R3D.thumb('wallicon' + G.up.wall);
  if (o) return R3D.thumb(o.isB ? bModel(o) : uModel(o));
  const d = TROOPS[k];
  return R3D.thumb(d ? (d.civ || d.siege ? k : k + '0') : k === 'house' ? 'house' + G.up.house : k === 'tower' ? 'tower' + G.up.tower : k === 'gate' ? 'gate' + G.up.wall : k);
}
const TOOLS = [['build', '🔨', 'Construir', '1'], ['troop', '⚔️', 'Treinar', '2'], ['upg', '📜', 'Pesquisas', '3'], ['demo', '💥', 'Demolir', '4']];
function renderTools() {
  const nav = $('#tools'); nav.innerHTML = '';
  for (const [id, e, n, key] of TOOLS) {
    const b = el('button', (id === UI.menu || (id === 'demo' && UI.tool && UI.tool.t === 'demo')) ? 'on' : '', `<span class="e">${e}</span><span>${n}</span><kbd>${key}</kbd>`);
    b.dataset.tip = 'h:' + id; b.onclick = () => pickTool(id); nav.append(b);
  }
}
function pickTool(id) {
  if (!G) return;
  if (id === 'upg') return showUpgrades();
  if (id === 'demo') { UI.menu = null; UI.tool = UI.tool && UI.tool.t === 'demo' ? null : { t: 'demo' }; }
  else { UI.menu = UI.menu === id ? null : id; UI.tool = null; }
  renderTools(); renderSub(); renderInfo();
}
function renderSub() {                                 // construir: as construções · treinar: as tropas e, ao lado, as ampliações do castelo
  const m = $('#submenu'); hideTip(); m.hidden = !UI.menu; m.innerHTML = '';
  if (!UI.menu) return;
  const troop = UI.menu === 'troop', grp = el('div', troop ? 'grp t4' : 'grp');
  for (const k of troop ? Object.keys(TROOPS) : BUILD_MENU) {
    const d = troop ? TROOPS[k] : BUILD[k], name = k === 'wall' ? WALL_T[G.up.wall].n : d.n;
    const b = el('button', UI.tool && UI.tool.k === k ? 'on' : '', `<img src="${icon(k)}"><b>${name}</b><small>${d.d}</small><span class="cost"></span>`);
    b.dataset.k = k; b.dataset.tip = (troop ? 't:' : 'b:') + k;
    b.onclick = troop ? () => { queueTrain(k); updateTop(); } : () => { UI.tool = UI.tool && UI.tool.k === k ? null : { t: 'build', k }; renderSub(); };
    grp.append(b);
  }
  m.append(grp);
  if (troop) {
    const ups = el('div', 'grp ups');
    for (const k in CASTLE_UP) { const b = el('button'); b.dataset.cu = k; b.dataset.tip = 'c:' + k; b.onclick = () => { castleUp(k); census(); updateTop(); }; ups.append(b); }
    m.append(el('div', 'sep', '<span>Ampliar castelo</span>'), ups);
  }
  refreshSub();
}
function refreshSub() {
  if (!UI.menu) return;
  const troop = UI.menu === 'troop';
  for (const b of document.querySelectorAll('#submenu button')) {
    const k = b.dataset.k, cu = b.dataset.cu;
    if (cu) {                                              // ampliação do castelo: mostra o próximo nível
      const u = CASTLE_UP[cu], lv = G.cu[cu], c = u.lv[lv], lock = c ? cupLock(cu) : '', v = Math.min(2, lv + 1);
      const h = `<img src="${R3D.thumb(cu === 'barracks' ? 'castle' + v + G.cu.workshop : 'castle' + G.cu.barracks + v)}"><b>${u.n} nv${c ? lv + 1 : lv}</b><small>${c ? u.d[lv] : 'máximo'}</small><span class="cost">${!c ? '✔' : lock ? '🔒 ' + lock : fmtCost(c)}</span>`;
      if (b._h !== h) b.innerHTML = b._h = h;
      b.classList.toggle('poor', !!c && !canPay(c)); b.classList.toggle('lock', !c || !!lock);
      continue;
    }
    const cost = troop ? TROOPS[k].cost : getCost(k), lock = troop ? lockWhy(k) : '';
    b.classList.toggle('poor', !canPay(cost)); b.classList.toggle('lock', !!lock);
    b.querySelector('.cost').textContent = lock ? '🔒 ' + lock : fmtCost(cost) + (troop ? ' · ' + TROOPS[k].time + 's' : '');
  }
}
// Dicas: parar o mouse 0,5 s sobre um item mostra o resumo; clicar mostra a explicação (some com Esc ou clicando nela).
function tipOf(key) {                                  // → [título, resumo, explicação]
  const [t, k] = key.split(':'), j = a => a.filter(Boolean).join(' · ');
  if (t === 'b') { const d = BUILD[k], a = d.atk; return [k === 'wall' ? WALL_T[G.up.wall].n : d.n, j(['PV ' + Math.round(maxHp(k)), d.work + ' s de obra', d.jobs && d.jobs + ' vagas', d.out && RES[d.out] + ' +' + (d.rate * (1 + .25 * G.up.tools)).toFixed(1) + '/min por aldeão', d.pop && '+' + (d.pop + 2 * G.up.house) + ' moradia', a && 'dano ' + Math.round(a.dmg * (1 + .4 * G.up.tower)) + ' · alcance ' + (a.range + G.up.tower)]) + '<br>' + fmtCost(getCost(k)), d.x]; }
  if (t === 't') { const d = TROOPS[k], s = unitStats({ k, tier: 0, civ: !!d.civ }); return [d.n, j(['PV ' + Math.round(s.hp), d.dmg && 'dano ' + Math.round(s.dmg), d.range && 'alcance ' + (d.min ? d.min + '–' : '') + d.range, d.splash && 'área ' + d.splash, 'moradia ' + d.pop, d.time + ' s']) + '<br>' + (lockWhy(k) ? '🔒 ' + lockWhy(k) : fmtCost(d.cost)), d.x]; }
  if (t === 'c') { const u = CASTLE_UP[k], lv = Math.min(G.cu[k], u.lv.length - 1), c = u.lv[G.cu[k]]; return [u.n + ' nv' + (lv + 1), u.d[lv] + ' · castelo +300 PV<br>' + (!c ? 'máximo' : cupLock(k) ? '🔒 ' + cupLock(k) : fmtCost(c)), u.x[lv]]; }
  if (t === 'u') { const u = UPG[k], nx = u.lv[G.up[k]]; return [u.n, nx ? nx.n + ' · ' + nx.d + '<br>' + (upLock(k) ? '🔒 ' + upLock(k) : fmtCost(nx.cost)) : 'máximo', u.x]; }
  const h = HELP[k] || ['', ''], r = k in RES ? G.rate[k] : null;
  return [h[0], r != null ? Math.floor(G.res[k]) + ' em estoque · ' + (r >= 0 ? '+' : '') + r.toFixed(1) + '/min' : k === 'pop' ? G.used + ' pessoas · ' + G.cap + ' de moradia · ' + G.idle + ' ociosos' : '', h[1]];
}
let tipEl = null, tipT = 0;
function hideTip() { clearTimeout(tipT); tipEl = null; $('#tip').hidden = true; }
function showTip(t) {
  const [n, sum] = tipOf(t.dataset.tip), tip = $('#tip'), r = t.getBoundingClientRect();
  tip.innerHTML = `<b>${n}</b>${sum ? '<br>' + sum : ''}`; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = clamp(r.left + r.width / 2 - w / 2, 6, innerWidth - w - 6) + 'px'; tip.style.top = (r.top - h - 8 > 4 ? r.top - h - 8 : r.bottom + 8) + 'px';
}
function explain(key) {
  const [n, , x] = tipOf(key), e = $('#explain'); if (!x) return;
  if (key[0] === 'u') { const m = $('#mo-x'); if (m) m.innerHTML = `<b>${n}:</b> ${x}`; return; }   // pesquisas: a explicação fica dentro da janela
  e.innerHTML = `<b>${n}</b><p>${x}</p>`; e.hidden = false;
}
document.addEventListener('pointerover', e => {
  const t = e.target.closest ? e.target.closest('[data-tip]') : null;
  if (t === tipEl) return;
  hideTip(); if (t && G) { tipEl = t; tipT = setTimeout(() => showTip(t), 500); }
});
document.addEventListener('pointerdown', e => { const t = e.target.closest ? e.target.closest('[data-tip]') : null; hideTip(); if (t && G && !t.closest('#speed, .ib')) explain(t.dataset.tip); }, true);   // botões de ação imediata só têm o resumo
$('#explain').onclick = () => { $('#explain').hidden = true; };
const taskText = u => u.sh ? 'Fugindo para o castelo' : u.task ? (u.task.t === 'build' ? 'Construindo: ' : 'Trabalhando: ') + bName(u.task.b) : u.path ? 'Andando' : u.hold ? 'Parado por ordem' : 'Ocioso';
let infoHTML = '';
function renderInfo() {
  const p = $('#info'), b = UI.selB, us = UI.selU;
  p.hidden = !G || (!b && !us.length); if (p.hidden) { infoHTML = ''; return; }
  let h;
  if (b) {
    const d = BUILD[b.k];
    h = `<div class="hd"><img src="${icon(b.k, b)}"><div><b>${bName(b)}</b><br>${Math.ceil(b.hp)}/${Math.round(b.mhp)} PV</div></div><i class="pbar" style="--w:${b.hp / b.mhp * 100}%"></i>`;
    if (!b.done) h += `<div class="ln"><span>Em obra · 👷 ${b.nb}</span><span class="${b.nb ? '' : 'warn'}">${b.nb ? Math.round(b.prog / b.work * 100) + '%' : 'sem aldeão'}</span></div>`;
    else {
      if (d.jobs) h += `<div class="ln"><span>👷 ${b.nw}/${d.jobs}</span><span>${RES[d.out]} +${(b.nw * prodRate(b)).toFixed(1)}/min${b.eff !== 1 ? ` <span class="${b.eff < 1 ? 'warn' : ''}">(${Math.round(b.eff * 100)}%)</span>` : ''}</span></div>`;
      if (d.pop) h += `<div class="ln"><span>Moradia</span><span>+${d.pop + (b.k === 'house' ? 2 * G.up.house : 0)}</span></div>`;
      if (d.atk) { const a = atkOf(b); h += `<div class="ln"><span>Dano ${Math.round(a.dmg)} · ${(1 / a.cd).toFixed(1)}/s</span><span>Alcance ${a.range}</span></div>`; }
      if (b.k === 'castle') h += (b.q.length ? `<div class="ln"><span>Fila: ${b.q.map(k => TROOPS[k].n).join(', ')}</span><span>${Math.round(b.qt / TROOPS[b.q[0]].time * 100)}%</span></div>` : '')
        + `<div class="ln"><span>🛡 Abrigados ${G.gar}</span><button class="qi" data-a="bell">🔔 ${G.bell ? 'Soltar todos' : 'Recolher todos'}</button></div>`;
      if (b.k === 'market') h += `<div class="grid">${Object.entries(MARKET).map(([k, [n, c]]) => `<button class="qi${G.res.gold < c ? ' off' : ''}" data-a="buy:${k}">${RES[k]} +${n}<small>🪙 ${c}</small></button>`).join('')}</div>`;
    }
    if (b.k !== 'castle') h += `<button class="qi" data-a="demo">💥 Demolir · devolve metade</button>`;
  } else if (us.length === 1) {
    const u = us[0], d = TROOPS[u.k], st = unitStats(u), pr = !u.civ && !d.siege && PROMO[u.tier];
    h = `<div class="hd"><img src="${icon(u.k, u)}"><div><b>${st.rifle ? 'Fuzileiro' : d.n}${u.civ || d.siege ? '' : ' T' + (u.tier + 1)}</b><br>${Math.ceil(u.hp)}/${Math.round(u.mhp)} PV</div></div><i class="pbar" style="--w:${u.hp / u.mhp * 100}%;--c:var(--blue)"></i>`;
    h += u.civ ? `<div class="ln"><span>${taskText(u)}</span></div>` : `<div class="ln"><span>Dano ${Math.round(st.dmg)}</span><span>Alcance ${d.min ? d.min + '–' : ''}${st.range}</span></div>`;
    if (pr) h += `<button class="qi${!promoLock(u) && canPay(pr.cost) ? '' : ' off'}" data-a="promo">⬆ ${u.k === 'archer' && u.tier === 1 ? 'Fuzileiro' : 'T' + (u.tier + 2)} · ${promoLock(u) ? '🔒 ' + promoLock(u) : fmtCost(pr.cost)}</button>`;
    if (u.civ && (u.hold || u.task)) h += `<button class="qi" data-a="free">Liberar · volta a escolher serviço</button>`;
    h += `<button class="qi" data-a="drop">Dispensar</button>`;
  } else {
    const n = {}; for (const u of us) n[u.k] = (n[u.k] || 0) + 1;
    h = `<div class="hd"><div><b>${us.length} selecionados</b><br>${Object.entries(n).map(([k, v]) => v + '× ' + TROOPS[k].n).join(' · ')}</div></div>`;
    if (us.some(u => !u.civ && !TROOPS[u.k].siege && PROMO[u.tier])) h += `<button class="qi" data-a="promo">⬆ Promover todos</button>`;
    if (us.some(u => u.civ)) h += `<button class="qi" data-a="free">Liberar aldeões</button>`;
  }
  if (h !== infoHTML) p.innerHTML = infoHTML = h;
}
$('#info').addEventListener('pointerdown', e => {      // no pointerdown: o painel é refeito várias vezes por segundo e um click poderia se perder
  const t = e.target.closest('[data-a]'), b = UI.selB; if (!t || !G) return;
  const [a, k] = t.dataset.a.split(':');
  if (a === 'buy') buy(k); else if (a === 'bell') bell(); else if (a === 'demo') demolish(b.i);
  else if (a === 'promo') { for (const u of UI.selU) if (!u.civ && !TROOPS[u.k].siege && PROMO[u.tier] && (UI.selU.length === 1 || !promoLock(u)) && !promote(u)) break; }   // em grupo, pula quem está travado; para se faltar recurso
  else if (a === 'free') { for (const u of UI.selU) if (u.civ) { u.task = null; u.back = null; u.hold = false; } G.jobT = 0; }
  else if (a === 'drop') dropUnit(UI.selU[0]);
  census(); updateTop();
});
const upLock = k => k === 'powder' && !has('workshop') ? 'Oficina' : k === 'tower' && G.up.tower === 1 && !G.gp ? 'Pólvora' : '';   // o que falta para o próximo nível
function showUpgrades() {
  const rows = Object.entries(UPG).map(([k, u]) => {
    const lv = G.up[k], nx = u.lv[lv], now = lv ? u.lv[lv - 1].n : u.base, pips = '●'.repeat(lv) + '○'.repeat(u.lv.length - lv);
    if (!nx) return `<div class="prow" data-tip="u:${k}"><div><b>${u.n} <span class="pips">${pips}</span></b><small>${now} · máximo</small></div><span class="ok">✔</span></div>`;
    const lock = upLock(k);
    return `<div class="prow" data-tip="u:${k}"><div><b>${u.n} <span class="pips">${pips}</span></b><small>${now} → ${nx.n} · ${nx.d}</small><small>${lock ? '🔒 ' + lock : fmtCost(nx.cost)}</small></div>
      <button class="btn small" data-u="${k}" ${lock || !canPay(nx.cost) ? 'disabled' : ''}>Pesquisar</button></div>`;
  }).join('');
  modal('Pesquisas', rows + '<p id="mo-x" class="dim">Clique numa pesquisa para ver a explicação.</p>', [['Fechar']]);
  $('#mo-body').querySelectorAll('[data-u]').forEach(b => b.onclick = () => buyUpgrade(b.dataset.u));
}
function buyUpgrade(k) {
  const u = UPG[k], nx = u.lv[G.up[k]];
  if (!nx || !canPay(nx.cost) || upLock(k)) return false;
  pay(nx.cost); G.up[k]++; G.meshDirty = true;
  if (k === 'wall') { for (const b of G.blds) if (b.k === 'wall' || b.k === 'gate') { const f = b.hp / b.mhp; b.mhp = maxHp(b.k); b.hp = b.mhp * f; } G.flowDirty = true; }
  feed(u.n + ': ' + nx.n, 'good'); census(); renderSub(); showUpgrades(); return true;
}
function updateTop() {
  if (!G) return;
  for (const k in RES) {
    $('#r-' + k).textContent = Math.floor(G.res[k]);
    const r = G.rate[k], q = $('#q-' + k); q.textContent = Math.abs(r) < .05 ? '' : (r > 0 ? '+' : '') + r.toFixed(r > -10 && r < 10 ? 1 : 0); q.classList.toggle('neg', r < 0);
  }
  const fin = isFinite(G.nextWave), left = fin ? Math.max(0, Math.ceil(G.nextWave - G.time)) : 999;
  $('#c-wave').textContent = `Fase ${G.phase + 1} · ` + (fin ? `onda ${G.wave + 1 - PHASE.len * G.phase}/${PHASE.len} em ${left / 60 | 0}:${String(left % 60).padStart(2, '0')} ${G.plan.map(p => arrowTo(p.a)).join('')}` : 'onda final') + (G.zs.length + G.queue.length ? ` · 🧟 ${G.zs.length + G.queue.length}` : '');
  $('#c-wave').classList.toggle('bad', left <= 20);
  const pop = $('#c-pop'); pop.textContent = `👥 ${G.used}/${G.cap}` + (G.idle ? ` · ${G.idle} à toa` : ''); pop.classList.toggle('bad', G.res.food <= 0 && G.rate.food < 0);
  $('#p-bell').classList.toggle('alert', G.bell);
  refreshSub(); UI.selU = UI.selU.filter(u => !u.dead); if (UI.selB && UI.selB.dead) UI.selB = null;
  renderInfo(); hoverText(); drawMini();
}
function hoverText() {
  const i = UI.hover, h = $('#hover');
  if (i < 0 || !G) { h.textContent = ''; return; }
  const t = UI.tool, b = G.b[i], u = G.unitAt[i] || G.vilAt[i][0];
  if (t && t.t === 'build') { const w = whyNot(t.k, i); h.innerHTML = BUILD[t.k].n + (w ? ` · <span class="warn">${w}</span>` : ' · ' + fmtCost(getCost(t.k))); return; }
  h.textContent = (u ? TROOPS[u.k].n : b ? bName(b) : TNAME[T[i]]) + ' · relevo ' + L[i];
}

/* ======================= Câmera e entrada ======================= */
// A câmera olha sempre para o norte: só anda (cam.x, cam.z), aproxima (cam.d) e inclina (cam.p).
function resize() { const s = $('#stage'); cv.width = s.clientWidth; cv.height = s.clientHeight; R3D.resize(cv.width, cv.height, cv.width > 1500 ? 3 : 2); clampCam(); }
function clampCam() { cam.x = clamp(cam.x, 0, MAP_W); cam.z = clamp(cam.z, 0, MAP_H * ROW_Z); cam.d = clamp(cam.d, CAM.d[0], CAM.d[1]); cam.p = clamp(cam.p, CAM.p[0], CAM.p[1]); }
function centerOn(i) { cam.x = PX[i]; cam.z = PZ[i]; clampCam(); }
function hexAt(x, z) {                                 // casa que contém o ponto do chão (-1 = fora do mapa)
  const r0 = Math.round(z / ROW_Z); let best = -1, bd = .34;
  for (let r = Math.max(0, r0 - 1); r <= Math.min(MAP_H - 1, r0 + 1); r++) {
    const c = Math.round(x - (r & 1) * .5); if (c < 0 || c >= MAP_W) continue;
    const i = r * MAP_W + c, d = (PX[i] - x) ** 2 + (PZ[i] - z) ** 2; if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function pickHex(sx, sy) {                             // segue o raio da câmera até ele entrar no topo de uma casa (acerta relevo alto)
  const [o, d] = R3D.ray(sx, sy); if (!(d[1] < -.001)) return -1;
  for (let t = Math.max(0, (1 - o[1]) / d[1]), end = (-.3 - o[1]) / d[1]; t <= end; t += .04) {
    const i = hexAt(o[0] + d[0] * t, o[2] + d[2] * t);
    if (i >= 0 && o[1] + d[1] * t <= PY[i]) return i;
  }
  return -1;
}
function groundAt(sx, sy) { const [o, d] = R3D.ray(sx, sy), t = d[1] < -.001 ? (.3 - o[1]) / d[1] : 0; return [o[0] + d[0] * t, o[2] + d[2] * t]; }
function zoom(f, sx, sy) {                             // mantém sob o cursor o ponto do chão que estava lá
  const d0 = cam.d; cam.d = clamp(d0 * f, CAM.d[0], CAM.d[1]);
  if (sx != null && cam.d !== d0) { const [gx, gz] = groundAt(sx, sy), k = cam.d / d0; cam.x = gx + (cam.x - gx) * k; cam.z = gz + (cam.z - gz) * k; }
  clampCam();
}
const evXY = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const evHex = e => pickHex(...evXY(e));
function unitNear(sx, sy) {                            // unidade mais perto do cursor, na tela
  let best = null, bd = Math.max(14, .45 * cv.height / (2 * cam.d * R3D.TANF)) ** 2;
  for (const u of G.units) { if (u.sh === 2) continue; const p = R3D.project(u.x, u.y + .3, u.z); if (!p) continue; const d = (p[0] - sx) ** 2 + (p[1] - sy) ** 2; if (d < bd) { bd = d; best = u; } }
  return best;
}
function select(e) {                                   // clique: unidade sob o cursor, senão a construção da casa
  const [sx, sy] = evXY(e), u = unitNear(sx, sy), i = pickHex(sx, sy);
  UI.selU = u ? [u] : []; UI.selB = !u && i >= 0 ? G.b[i] : null;
  if (UI.selB && UI.selB.k === 'castle') { UI.menu = 'troop'; UI.tool = null; renderTools(); renderSub(); }   // clicar no castelo abre treino e ampliações
  renderInfo();
}
function boxSelect(cx0, cy0, cx1, cy1) {               // cantos em px do cliente
  const r = cv.getBoundingClientRect(), x0 = Math.min(cx0, cx1) - r.left, x1 = Math.max(cx0, cx1) - r.left, y0 = Math.min(cy0, cy1) - r.top, y1 = Math.max(cy0, cy1) - r.top;
  let us = G.units.filter(u => { if (u.sh === 2) return false; const p = R3D.project(u.x, u.y + .3, u.z); return p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1; });
  if (us.some(u => !u.civ) && us.some(u => u.civ)) us = us.filter(u => !u.civ);   // caixa mista: fica com os soldados
  UI.selU = us; UI.selB = null; renderInfo();
}
let drag = null;
cv.addEventListener('pointerdown', e => {
  if (!G || G.over) return;
  cv.setPointerCapture(e.pointerId);
  const touch = e.pointerType === 'touch', t = UI.tool;
  // mode: paint = construir · box = caixa de seleção (botão esquerdo) · tilt = inclinar (botão do meio) · pan = mover a câmera (direito ou toque)
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cz: cam.z, cp: cam.p, btn: e.button, moved: false, touch, mode: e.button === 0 && t && t.t === 'build' ? 'paint' : e.button === 0 && !t && !touch ? 'box' : e.button === 1 ? 'tilt' : 'pan' };
  if (drag.mode === 'paint') tryBuild(t.k, evHex(e));
});
cv.addEventListener('pointermove', e => {
  if (!G) return;
  const h = evHex(e);
  if (h !== UI.hover) { UI.hover = h; hoverText(); }
  if (!drag) return;
  if (drag.mode === 'paint') { if (UI.tool && UI.tool.k === 'wall' && h >= 0) tryBuild('wall', h, true); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true;
  if (drag.mode === 'box') { const r = cv.getBoundingClientRect(); boxSel = { x0: drag.x - r.left, y0: drag.y - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top }; }
  else if (drag.mode === 'tilt') { cam.p = drag.cp + dy * .006; clampCam(); }
  else { const k = 2 * cam.d * R3D.TANF / cv.height; cam.x = drag.cx - dx * k; cam.z = drag.cz - dy * k / Math.sin(cam.p); clampCam(); }
});
cv.addEventListener('pointerup', e => {
  if (!drag || !G) return;
  const d = drag, t = UI.tool; drag = null;
  if (d.mode === 'paint') return;
  if (d.moved) { if (d.mode === 'box') { boxSelect(d.x, d.y, e.clientX, e.clientY); boxSel = null; } return; }
  const i = evHex(e);
  if (t) return d.btn === 0 && t.t === 'demo' ? demolish(i) : cancel();          // com ferramenta ativa, o botão direito só a solta
  if (d.btn === 2 || (d.touch && UI.selU.length && !unitNear(...evXY(e)))) { if (UI.selU.length) order(i); else cancel(); }   // toque: com gente selecionada, tocar no chão manda
  else if (d.btn === 0) select(e);
});
cv.addEventListener('pointerleave', () => { UI.hover = -1; hoverText(); });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });   // botão do meio: sem rolagem automática
cv.addEventListener('wheel', e => {                    // roda aproxima · Shift + roda inclina
  e.preventDefault();
  const up = (e.deltaY || e.deltaX) < 0;
  if (e.shiftKey) { cam.p += up ? .08 : -.08; clampCam(); } else zoom(up ? 1 / 1.15 : 1.15, ...evXY(e));
}, { passive: false });
mini.addEventListener('pointerdown', e => {
  const r = mini.getBoundingClientRect(), c = clamp(Math.floor((e.clientX - r.left) / r.width * MAP_W), 0, MAP_W - 1), rr = clamp(Math.floor((e.clientY - r.top) / r.height * MAP_H), 0, MAP_H - 1);
  centerOn(rr * MAP_W + c);
});
function cancel() { hideTip(); $('#explain').hidden = true; if (UI.tool) UI.tool = null; else if (UI.menu) UI.menu = null; else { UI.selB = null; UI.selU = []; } renderTools(); renderSub(); renderInfo(); }
function selectIdle() {                                // chip da população: seleciona os aldeões ociosos
  const us = G.units.filter(u => u.civ && !u.task && !u.hold && !u.path && !u.sh);
  if (!us.length) return;
  UI.selU = us; UI.selB = null; centerOn(us[0].h); renderInfo();
}
const KEYS = {};
addEventListener('keydown', e => {
  if (!G || !$('#modal').hidden) return;
  const k = e.key.toLowerCase(); KEYS[k] = true;
  if (k === 'escape') cancel();
  else if (k === ' ') { e.preventDefault(); setSpeed(G.speed ? 0 : 1); }
  else if (k >= '1' && k <= '4') pickTool(TOOLS[k - 1][0]);
  else if (k === 'tab') { e.preventDefault(); setSpeed(G.speed === 1 ? 2 : G.speed === 2 ? 4 : 1); }
  else if (k === 'g') bell(); else if (k === '.') selectIdle(); else if (k === 'h') centerOn(CASTLE);
});
addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
addEventListener('resize', () => { if (G) resize(); });

$('#m-new').onclick = () => newGame();
$('#p-menu').onclick = () => { const s = G.speed; setSpeed(0); modal('Pausa', `Mapa nº ${G.seed} · onda ${G.wave}`, [['▶ Continuar', () => setSpeed(s || 1)], ['🎲 Novo mapa', () => newGame()], ['Sair', toMenu]]); };
$('#p-call').onclick = () => { if (!G || G.over) return; if (!isFinite(G.nextWave)) return feed('Vença antes a onda final da fase', 'bad'); const gold = Math.round(Math.max(0, G.nextWave - G.time) / 4); G.res.gold += gold; if (gold) feed('Onda adiantada · +' + gold + '🪙', 'good'); launchWave(); updateTop(); };
$('#p-bell').onclick = () => G && (bell(), updateTop()); $('#c-pop').onclick = () => G && selectIdle();
document.querySelectorAll('#camctl button').forEach(b => b.onclick = () => { const c = b.dataset.c; if (c === 'in') zoom(1 / 1.25); else if (c === 'out') zoom(1.25); else { cam.p += c === 'up' ? .12 : -.12; clampCam(); } });
document.querySelectorAll('#speed button').forEach(b => b.onclick = () => setSpeed(+b.dataset.s));

/* ======================= Laço principal ======================= */
const STEP = 1 / 30;
let last = 0, acc = 0, uiT = 0;
function frame(ts) {
  const dt = Math.min(.1, (ts - last) / 1000 || 0); last = ts;
  if (G) {
    if (!G.over) { acc += dt * G.speed; while (acc >= STEP) { tick(STEP); acc -= STEP; if (!G || G.over) break; } }
    if (G) {
      const v = cam.d * .9 * dt * (KEYS.shift ? 2 : 1);
      if (KEYS.a || KEYS.arrowleft) cam.x -= v; if (KEYS.d || KEYS.arrowright) cam.x += v;
      if (KEYS.w || KEYS.arrowup) cam.z -= v; if (KEYS.s || KEYS.arrowdown) cam.z += v;
      if (KEYS.r) cam.p += dt; if (KEYS.f) cam.p -= dt;                    // R / F: inclinar
      clampCam(); draw();
      if ((uiT += dt) > .25) { uiT = 0; updateTop(); }
    }
  }
  requestAnimationFrame(frame);
}
(function boot() {
  const ok = R3D.init($('#gl'));
  if (ok) {                                              // arte do menu: uma cena pequena tirada do próprio renderizador
    const P = (m, x, z, yaw = 0, s = 1) => ({ m, x, y: 0, z, yaw, s }), E = Math.PI / 2, list = [];
    for (let r = -2; r <= 1; r++) for (let c = -5; c <= 5; c++) list.push(P('tile', c + (r & 1) * .5, r * ROW_Z));
    for (const x of [-3, -2, -1, 1, 2, 3]) list.push(P(x === 2 ? 'tower1' : 'post2', x, 0), P('arm2', x, 0, E), P('arm2', x, 0, -E));
    list.push(P('castle11', 0, 0), P('forest0', -3.5, -ROW_Z), P('forest1', 3.5, -ROW_Z), P('house1', -2.5, -ROW_Z, .4), P('rock0', 2.5, -ROW_Z * 2));
    list.push(P('villager', -2.2, .8, .5, 1.15), P('archer0', -1.1, .7, .3, 1.15), P('sword1', -.5, .9, .2, 1.15), P('spear0', .6, .8, -.2, 1.15));
    list.push(P('z_normal', 1.6, .9, -1.2, 1.15), P('z_runner', 2.3, .7, -1.3, 1.15), P('z_brute', 3.2, .9, -1.3, 1.15), P('z_boomer', 2.7, 1.5, -1, 1.15));
    const a = $('#menu-art'); a.getContext('2d').drawImage(R3D.shot(list, a.width, a.height, [0, 3.9, 9.6], [0, .7, 0]), 0, 0);
  }
  toMenu();
  if (!ok) { $('#m-info').textContent = 'Este navegador não tem WebGL: o jogo não abre'; $('#m-new').disabled = true; return; }
  const h = location.hash, seed = /seed=(\d+)/.exec(h);
  if (/dbg/.test(h)) newGame(seed ? +seed[1] : undefined);      // #dbg ou #dbg&seed=123: pula o menu
  requestAnimationFrame(frame);
})();
