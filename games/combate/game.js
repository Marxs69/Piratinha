/* Combate: auto-batalha com mochila.
   Loop: antes da luta você vê a mochila do inimigo, compra itens na loja, melhora itens e o personagem e arruma
   a sua mochila (cada item ocupa casas, como numa maleta) → a luta roda sozinha, com a mesma lógica para os dois lados
   → vitória dá ouro (moeda da jornada) e essência (moeda permanente, gasta na árvore de melhorias).
   Jornada: 50 rodadas em 5 dezenas (cada uma mais perto do inferno), com sargento (X8), capitão (X9) e chefe (X0).
   Depois da 50ª: New Game+ (até 20; mantém o treino e os lendários, zera ouro e mochila). Só depois do ng.20 vem o modo infinito (loja e treino fechados).
   Os inimigos vêm em grupo (até 10, depois sobem de tier ★): uma barra de vida e uma mochila para todos. Do ng.1 em diante há auto-play.
   Tudo fica salvo no navegador (localStorage). */

const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pct = v => Math.round(v * 100) + '%';

/* ======================= Dados (equilíbrio do jogo) ======================= */
const LVM = [1, 1.4, 1.9, 2.5];                    // multiplicador dos números do item por tier: T1 a T3 (loja e melhoria) e T4 (lendário, só de espólio)
const MAX_LV = 3, LEG = 4, FATIGUE_AT = 25, DROP_CHANCE = .2;   // MAX_LV = tier máximo de loja/melhoria · DROP_CHANCE = chance de o inimigo derrotado largar um item da mochila dele
const TIER_PRICE = [1, 2, 4, 4];                   // preço na loja por tier (igual a comprar T1 e melhorar)
const START_CUT = .5, STARTERS = ['dagger', 'sword', 'mace', 'wand'];   // rodada 1: a loja só traz armas, sorteadas, pela metade do preço
const NG_MAX = 20, NG_ITEM = .3, NG_HP = .25, NG_DMG = 0;   // New Game+: itens da loja +30% por NG · inimigos +25% de vida por NG (o dano cresce pelos itens deles)
const E_ITEM_NG = 1, E_ITEM_CYC = .25;             // itens dos inimigos, em unidades de NG_ITEM: +30% por NG e +7,5% por dezena (o espólio herda)
const MAG_DMG = .25;                               // cada ponto de poder mágico: +25% no dano das magias (sem poder mágico, magia não funciona)
const im = it => LVM[it.lv - 1] * (1 + NG_ITEM * (it.b || 0));   // multiplicador do item: tier × bônus de onde foi obtido (it.b: 1 por NG na loja; no espólio, o do inimigo)
const iv = (v, it) => Math.round(v * im(it));

// w × h = casas na mochila · price = preço na loja · min = rodada em que começa a aparecer na loja
// kind: weapon (ataca a cada cd segundos) · magic (magia: igual, mas exige poder mágico e ignora armadura) · def · util    aura = bônus dado aos itens encostados nele
const ITEMS = {
  dagger:  { n: 'Adaga',             w: 1, h: 2, price: 4,  min: 1, kind: 'weapon', dmg: 3,  cd: 1.1 },
  sword:   { n: 'Espada',            w: 1, h: 3, price: 7,  min: 1, kind: 'weapon', dmg: 8,  cd: 2.0 },
  mace:    { n: 'Maça',              w: 2, h: 2, price: 8,  min: 2, kind: 'weapon', dmg: 7,  cd: 2.4, crush: 4 },
  spear:   { n: 'Lança',             w: 1, h: 4, price: 10, min: 3, kind: 'weapon', dmg: 10, cd: 2.3, pierce: .5 },
  axe:     { n: 'Machado',           w: 2, h: 3, price: 13, min: 4, kind: 'weapon', dmg: 19, cd: 3.4 },
  wshield: { n: 'Escudo de madeira', w: 2, h: 2, price: 5,  min: 1, kind: 'def', block: 4, cd: 2.6 },
  ishield: { n: 'Escudo de ferro',   w: 2, h: 3, price: 10, min: 4, kind: 'def', block: 9, cd: 3.0 },
  helmet:  { n: 'Elmo',              w: 2, h: 2, price: 6,  min: 2, kind: 'def', hp: 15 },
  armor:   { n: 'Peitoral',          w: 2, h: 3, price: 12, min: 4, kind: 'def', hp: 25, armor: 1 },
  whet:    { n: 'Pedra de amolar',   w: 1, h: 1, price: 4,  min: 1, kind: 'util', aura: { dmg: 2 } },
  ring:    { n: 'Anel da pressa',    w: 1, h: 1, price: 6,  min: 2, kind: 'util', aura: { haste: .15 } },
  venom:   { n: 'Frasco de veneno',  w: 1, h: 1, price: 6,  min: 3, kind: 'util', aura: { poison: 1 } },
  amulet:  { n: 'Amuleto vampírico', w: 1, h: 1, price: 7,  min: 3, kind: 'util', aura: { steal: .2 } },
  potion:  { n: 'Poção',             w: 1, h: 2, price: 4,  min: 1, kind: 'util', heal: 18 },
  wand:    { n: 'Varinha',           w: 1, h: 2, price: 4,  min: 1, kind: 'magic', dmg: 4,  cd: 1.3 },
  staff:   { n: 'Cajado',            w: 1, h: 3, price: 9,  min: 2, kind: 'magic', dmg: 10, cd: 2.4 },
  hat:     { n: 'Chapéu de mago',    w: 2, h: 2, price: 8,  min: 2, kind: 'def', hp: 8, mag: 1 },
  tome:    { n: 'Grimório',          w: 1, h: 1, price: 6,  min: 3, kind: 'util', aura: { mdmg: 2 } },
};
const FIST = { id: 'fist', lv: 1, x: -9, y: -9, r: 0 }, FIST_D = { n: 'Punhos', kind: 'weapon', dmg: 2, cd: 1.4 };   // sem arma que funcione, o lutador soca (não é item: não vai à loja nem à mochila)
// Passivos dos lendários (T4): k = campo do lutador que recebe v
const PASSIVES = [
  { k: 'flat',  v: 2,   t: '+2 de dano em todos os golpes' },
  { k: 'armor', v: 1,   t: '+1 de resistência a cada golpe sofrido' },
  { k: 'hp',    v: 15,  t: '+15 de vida máxima' },
  { k: 'spd',   v: .05, t: '+5% de velocidade' },
  { k: 'mag',   v: 1,   t: '+1 de poder mágico' },
  { k: 'res',   v: .04, t: '−4% de dano sofrido' },
  { k: 'steal', v: .04, t: 'cura 4% do dano causado' },
];

// Inimigos, um por rodada. kit = [item, nível, x, y, girado]
const ENEMIES = [
  { n: 'Goblin',       spr: 'goblin',   hp: 26,  w: 3, h: 3, kit: [['dagger', 1, 1, 0]] },
  { n: 'Bandido',      spr: 'bandit',   hp: 38,  w: 4, h: 3, kit: [['dagger', 1, 0, 0], ['wshield', 1, 1, 0]] },
  { n: 'Esqueleto',    spr: 'skeleton', hp: 42,  w: 4, h: 3, kit: [['sword', 1, 1, 0], ['whet', 1, 0, 0]] },
  { n: 'Xamã goblin',  spr: 'shaman',   hp: 48,  w: 4, h: 3, kit: [['wand', 1, 0, 0], ['venom', 1, 1, 0], ['dagger', 1, 2, 0], ['potion', 1, 3, 0], ['tome', 1, 1, 1]] },
  { n: 'Orc',          spr: 'orc',      hp: 75,  w: 4, h: 4, kit: [['axe', 1, 0, 0], ['helmet', 1, 2, 0]] },
  { n: 'Lanceiro',     spr: 'lancer',   hp: 70,  w: 5, h: 4, kit: [['spear', 1, 0, 0], ['ring', 1, 1, 0], ['sword', 1, 2, 0], ['wshield', 1, 3, 0]] },
  { n: 'Cavaleiro',    spr: 'knight',   hp: 85,  w: 6, h: 4, kit: [['whet', 1, 0, 0], ['sword', 2, 1, 0], ['ishield', 1, 2, 0], ['armor', 1, 4, 0]] },
  { n: 'Assassino',    spr: 'assassin', hp: 80,  w: 5, h: 4, kit: [['amulet', 1, 0, 0], ['dagger', 2, 1, 0], ['venom', 2, 2, 0], ['ring', 1, 2, 1], ['dagger', 2, 3, 0], ['potion', 1, 4, 0]] },
  { n: 'Chefe orc',    spr: 'warlord',  hp: 130, w: 6, h: 4, big: true, kit: [['axe', 2, 0, 0], ['whet', 2, 2, 0], ['mace', 1, 2, 1], ['helmet', 2, 4, 0], ['wshield', 2, 4, 2]] },
  { n: 'Rei Caveira',  spr: 'king',     hp: 150, w: 6, h: 5, big: true, kit: [['whet', 2, 0, 0], ['amulet', 2, 0, 1], ['venom', 1, 0, 2], ['sword', 3, 1, 0], ['spear', 1, 2, 0], ['ishield', 2, 3, 0], ['potion', 2, 5, 0], ['armor', 2, 3, 3, 1]] },
];

/* Jornada: 50 rodadas em 5 ciclos de 10. Em cada ciclo voltam os mesmos 9 inimigos, mais fortes, e a 10ª rodada é um chefe.
   O 5º chefe (rodada 50) é o final: dele se vai ao New Game+ e, só depois do último NG, às rodadas sem fim (loja fechada), cada vez mais duras.
   BOSSES: kit = índice em ENEMIES de onde vem a mochila do chefe. NGs pares enfrentam os 5 primeiros; ímpares, os 5 últimos. */
const CYCLE = 10, FINAL = 50;
const BOSSES = [
  { n: 'Rei Caveira',        spr: 'king',     kit: 9 },
  { n: 'Senhor da Guerra',   spr: 'warlord',  kit: 8 },
  { n: 'Cavaleiro Negro',    spr: 'knight',   kit: 6 },
  { n: 'Mestre Assassino',   spr: 'assassin', kit: 7 },
  { n: 'Arquixamã',          spr: 'shaman',   kit: 9 },
  { n: 'Rei Orc',            spr: 'orc',      kit: 8 },
  { n: 'General Lanceiro',   spr: 'lancer',   kit: 6 },
  { n: 'Lorde dos Ossos',    spr: 'skeleton', kit: 7 },
  { n: 'Rei Bandido',        spr: 'bandit',   kit: 8 },
  { n: 'Imperador Caveira',  spr: 'king',     kit: 9 },
];
/* Antes de cada chefe vêm dois subchefes da mesma classe: sargento (X8) e capitão (X9).
   CLASS: sprite do chefe → [sprite da tropa, título do sargento, título do capitão] · MINI: [vida, dano] extras de cada um. */
const CLASS = {
  king:     ['skeleton', 'Sargento caveira',     'Capitão da guarda real'],
  warlord:  ['orc',      'Sargento orc',         'Capitão de guerra'],
  knight:   ['knight',   'Sargento de armas',    'Capitão cavaleiro'],
  assassin: ['assassin', 'Sargento das sombras', 'Capitão assassino'],
  shaman:   ['shaman',   'Feiticeiro-sargento',  'Grão-feiticeiro'],
  orc:      ['orc',      'Sargento orc',         'Capitão orc'],
  lancer:   ['lancer',   'Sargento lanceiro',    'Capitão lanceiro'],
  skeleton: ['skeleton', 'Sargento dos ossos',   'Capitão dos ossos'],
  bandit:   ['bandit',   'Sargento bandido',     'Capitão bandido'],
};
const ARCANE = { sword: 'staff', dagger: 'wand', whet: 'tome' };   // xamãs e feiticeiros trocam as armas da mochila por magias do mesmo formato
const MINI = [[1.15, 1.05], [1.3, 1.1]], MINI_HP = [80, 110];   // vida base: o capitão fica abaixo do chefe da dezena
/* Da 2ª dezena em diante os inimigos comuns (X1 a X7) usam a mochila de um modelo mais forte (UPKIT), partem todos da mesma
   vida (UP_HP) e crescem a cada rodada (IN_CYC por posição): vida e dano de um comum são sempre maiores que os de qualquer comum anterior. */
const UPKIT = [4, 4, 5, 5, 6, 6, 7], UP_HP = 80, IN_CYC = .04;
const RANKS = ['', ' veterano', ' de elite', ' feroz', ' sombrio', ' maldito', ' infernal', ' abissal', ' demoníaco', ' do apocalipse'];
// Por ciclo completo: +vida, +dano e +velocidade do inimigo (e +1 tier nos itens dele). Chefe: vida e dano extras.
// Depois da rodada final, vida e dano ainda crescem ENDLESS por rodada (composto), para a jornada infinita acabar um dia
const E_HP = .8, E_DMG = .25, E_SPD = .04, E_SPD_MAX = .6, BOSS_HP = 1.6, BOSS_DMG = 1.1, ENDLESS = 1.06;
const endless = () => run.round > FINAL && run.ng >= NG_MAX;   // modo infinito: só depois do último NG
const needNG = () => run.round > FINAL && run.ng < NG_MAX;     // venceu o chefe final: o próximo passo é o New Game+
/* Grupo: a cada G_STEP rodadas entra +1 inimigo (o intervalo cai pela metade a cada NG, até G_STEP_MIN) e a contagem segue de um NG para o outro.
   Com GROUP_MAX inimigos, cada passo seguinte sobe o tier (★) de um deles. O grupo luta como um só: vida somada e mochila compartilhada.
   G_HP = vida que cada companheiro soma (fração da do líder) · G_KIT = itens que ele põe na mochila · G_DMG = quanto o dano do grupo cede por companheiro · STAR_* = por ★ */
const GROUP_MAX = 10, G_STEP = 20, G_STEP_MIN = 5, G_HP = .3, G_KIT = 2, G_DMG = .15, STAR_HP = .03, STAR_DMG = .01;
const gStep = ng => Math.max(G_STEP_MIN, Math.round(G_STEP / 2 ** Math.min(ng, 4)));
function groupSteps(round, ng) { let s = Math.floor((round - 1) / gStep(ng)); for (let k = 0; k < ng; k++) s += Math.floor(FINAL / gStep(k)); return s; }
const STAR_COL = ['#ffd257', '#ff9a3a', '#ff5d6c', '#c77dff'];   // cor das fagulhas do inimigo de tier maior

// Treino: melhorias do personagem compradas com ouro, valem só nesta jornada
const TRAIN = [
  { id: 'vig', e: '❤', n: 'Vigor',     d: '+12 de vida máxima',           base: 5, step: 3 },
  { id: 'str', e: '💪', n: 'Força',     d: '+8% de dano',                  base: 6, step: 4 },
  { id: 'agi', e: '⚡', n: 'Agilidade', d: '+6% de velocidade dos itens',  base: 6, step: 4 },
  { id: 'mag', e: '✨', n: 'Poder mágico', d: 'Libera as magias; +25% de dano mágico por ponto', base: 5, step: 4 },
];
const SHOP_BASE = 4, SHOP_MAX = 8;                 // itens na loja: 4 de base e +1 por nó de vitrine da árvore (4 nós), até 8
const shopN = () => Math.min(SHOP_MAX, SHOP_BASE + meta('shopn'));

/* Árvore permanente (comprada com essência): um centro e quatro ramos.
   cima = resistências · direita = a partida (ouro, loja, espólio) · esquerda = a mochila · baixo = o herói (atributos base).
   Cada ramo: a raiz e três trilhas de quatro nós. fx = efeito, somado por meta(). Os ids antigos foram mantidos: o que já foi comprado continua valendo. */
const BRANCH = (br, name, rows) => rows.map(([id, e, n, d, cost, fx], i) => {
  const lane = i ? Math.floor((i - 1) / 4) - 1 : 0, L = i ? 2 + (i - 1) % 4 : 1;       // trilha (-1, 0, 1) e distância do centro (1 a 5)
  const [x, y] = br === 'd' ? [lane, L] : br === 'u' ? [lane, -L] : br === 'r' ? [L, lane] : [-L, lane];
  return { id, e, n, d, cost, fx, x, y, br, req: !i ? 'core' : (i - 1) % 4 ? rows[i - 1][0] : rows[0][0] };
});
const BRANCHES = { u: 'Resistências', r: 'Partida', l: 'Mochila', d: 'Herói' };
const NODES = [
  { id: 'core', e: '⭐', n: 'O herói', d: 'O começo de tudo', cost: 0, fx: {}, x: 0, y: 0 },
  ...BRANCH('u', 'Resistências', [
    ['res1',   '🛡', 'Pele dura',        '−3% de dano sofrido',               3,  { res: .03 }],
    ['blk1',   '🛡', 'Guarda alta',      'Começa a luta com 3 de bloqueio',   4,  { block0: 3 }],
    ['res2',   '🛡', 'Couro curtido',    '−4% de dano sofrido',               8,  { res: .04 }],
    ['armor1', '⛨', 'Couraça',          '−1 em cada golpe sofrido',          13, { armor: 1 }],
    ['thorn1', '🌵', 'Espinhos',         'Devolve 1 de dano a cada golpe sofrido', 18, { thorns: 1 }],
    ['pres1',  '☠', 'Estômago forte',   '−20% de dano de veneno',            4,  { pres: .2 }],
    ['tire1',  '⏱', 'Fôlego',           'Exaustão começa 3 s mais tarde',    7,  { tire: 3 }],
    ['pres2',  '☠', 'Antídoto',         '−30% de dano de veneno',            11, { pres: .3 }],
    ['tire2',  '⏱', 'Maratonista',      'Exaustão começa 5 s mais tarde',    16, { tire: 5 }],
    ['mres1',  '🔮', 'Mente firme',      '−15% de dano mágico',               4,  { mres: .15 }],
    ['dodge1', '💨', 'Passo leve',       '3% de chance de esquivar',          8,  { dodge: .03 }],
    ['mres2',  '🔮', 'Runa de proteção', '−20% de dano mágico',               12, { mres: .2 }],
    ['dodge2', '💨', 'Sombra',           '4% de chance de esquivar',          18, { dodge: .04 }],
  ]),
  ...BRANCH('r', 'Partida', [
    ['gold1',  '🪙', 'Bolsa cheia',      '+4 de ouro inicial',                3,  { gold: 4 }],
    ['goldw1', '🪙', 'Saque',            '+10% de ouro por vitória',          4,  { goldw: .1 }],
    ['consol', '🪙', 'Esmola',           '+2 de ouro de consolo na derrota',  6,  { consol: 2 }],
    ['goldw2', '🪙', 'Pilhagem',         '+15% de ouro por vitória',          11, { goldw: .15 }],
    ['sellv',  '⚖', 'Bom negociante',   'Vende itens por 20% a mais',        15, { sellv: .2 }],
    ['merch',  '🏷', 'Pechincha',        'Loja 6% mais barata',               5,  { disc: .06 }],
    ['shop1',  '🛒', 'Vitrine maior',    '+1 item na loja',                   8,  { shopn: 1 }],
    ['reroll', '🎲', 'Freguês',          '1 troca grátis da loja por rodada', 11, { reroll: 1 }],
    ['tier1',  '🧳', 'Mercadores viajados', '+10% de chance de item de tier maior na loja', 16, { tier: .1 }],
    ['soul',   '💠', 'Colheita',         '+20% de essência',                  5,  { ess: .2 }],
    ['drop1',  '🎁', 'Olho vivo',        '+5% de chance de espólio',          8,  { drop: .05 }],
    ['leg1',   '✦',  'Caçador de relíquias', '+3% de chance de espólio lendário', 12, { leg: .03 }],
    ['soul2',  '💠', 'Ceifa',            '+25% de essência',                  18, { ess: .25 }],
  ]),
  ...BRANCH('l', 'Mochila', [
    ['pack1',  '🎒', 'Mochila larga',    '+1 coluna na mochila',              6,  { cols: 1 }],
    ['stash1', '📦', 'Baú',              '+2 lugares na reserva',             4,  { stash: 2 }],
    ['pack2',  '🎒', 'Mochila funda',    '+1 linha na mochila',               12, { rows: 1 }],
    ['stash2', '📦', 'Baú reforçado',    '+2 lugares na reserva',             10, { stash: 2 }],
    ['pack3',  '🎒', 'Mochila de viagem', '+1 coluna na mochila',             22, { cols: 1 }],
    ['kit',    '🛡', 'Kit inicial',      'Começa com um escudo de madeira',   5,  { kit: 1 }],
    ['kitp',   '🧪', 'Cantil',           'Começa com uma poção',              7,  { kitp: 1 }],
    ['kitw',   '🪨', 'Fio de navalha',   'Começa com uma pedra de amolar',    9,  { kitw: 1 }],
    ['upd',    '🔨', 'Ferreiro amigo',   'Melhorar itens custa 15% menos',    15, { upd: .15 }],
    ['aura1',  '🔗', 'Encaixe',          'Itens de apoio dão +10% de bônus',  5,  { aura: .1 }],
    ['pot1',   '🧪', 'Boticário',        'Poções curam 25% a mais',           7,  { potion: .25 }],
    ['aura2',  '🔗', 'Sinergia',         'Itens de apoio dão +15% de bônus',  12, { aura: .15 }],
    ['traind', '🏋', 'Mestre de treino', 'Treino 10% mais barato',            16, { traind: .1 }],
  ]),
  ...BRANCH('d', 'Herói', [
    ['vit1',   '❤', 'Vitalidade I',     '+6 de vida',                        2,  { hp: 6 }],
    ['vit2',   '❤', 'Vitalidade II',    '+8 de vida',                        4,  { hp: 8 }],
    ['vit3',   '❤', 'Vitalidade III',   '+10 de vida',                       7,  { hp: 10 }],
    ['regen1', '💗', 'Recuperação',      'Recupera 1 de vida a cada 2 s',     12, { regen: .5 }],
    ['life',   '💖', 'Segunda chance',   '+1 vida por jornada',               20, { lives: 1 }],
    ['str1',   '💪', 'Força I',          '+4% de dano',                       4,  { dmg: .04 }],
    ['str2',   '💪', 'Força II',         '+5% de dano',                       7,  { dmg: .05 }],
    ['crit1',  '🎯', 'Golpe certeiro',   '5% de chance de crítico (+50% de dano)', 11, { crit: .05 }],
    ['critd',  '🎯', 'Ponto fraco',      'Críticos causam +25% de dano',      16, { critd: .25 }],
    ['spd1',   '⚡', 'Reflexos',         '+4% de velocidade',                 4,  { spd: .04 }],
    ['mag1',   '✨', 'Dom arcano',       '+1 de poder mágico',                8,  { mag: 1 }],
    ['spd2',   '⚡', 'Ímpeto',           '+5% de velocidade',                 12, { spd: .05 }],
    ['steal1', '🩸', 'Sede de sangue',   'Cura 3% do dano causado',           18, { steal: .03 }],
  ]),
  // Vitrines: a trilha do meio da Partida segue depois de "Mercadores viajados", uma casa por nó (loja de 4 até 8 itens com a Vitrine maior)
  ...[['shop2', 'Vitrine larga', 18], ['shop3', 'Vitrine dupla', 24], ['shop4', 'Grande bazar', 30]].map(([id, n, cost], i, a) =>
    ({ id, e: '🛒', n, d: '+1 item na loja', cost, fx: { shopn: 1 }, x: 6 + i, y: 0, br: 'r', req: i ? a[i - 1][0] : 'tier1' })),
];

/* ======================= Estado e salvamento ======================= */
const SAVE = 'combate-save';
let S = { meta: { ess: 0, nodes: [] }, run: null, best: 0, speed: 1 };
try { const d = JSON.parse(localStorage.getItem(SAVE)); if (d && d.meta) S = Object.assign(S, d); } catch (e) {}
let save = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} };
const owned = id => id === 'core' || S.meta.nodes.includes(id);
const meta = k => NODES.reduce((a, n) => a + (owned(n.id) && n.fx[k] || 0), 0);   // soma de um efeito da árvore (vale só para o herói)

let run = S.run;              // jornada atual (ou null)
let mode = 'prep';            // prep | combat | result
let sel = null;               // item selecionado: { src: 'pack' | 'stash' | 'shop' | 'enemy', it }
let cb = null;                // combate em andamento
let view = { a: null, b: null };   // lutadores mostrados na arena (prévia na preparação, reais no combate)
let hold = false, autoT = 0, tipHost = null;   // hold: auto-play pausado até o jogador lutar de novo ou religar · autoT: contagem até a próxima luta automática
const AUTO_WAIT = 2;                            // segundos entre a preparação e a luta automática
const autoOn = () => !!(S.auto && run && run.ng >= 1);   // auto-play existe do ng.1 em diante
const SHOP_BOX = 100;          // lado (px) da área do item no card da loja
const itemEls = new Map();    // item → elemento na mochila (para as barras de recarga)

/* ======================= Mochila: geometria ======================= */
const dims = it => { const d = ITEMS[it.id]; return it.r ? [d.h, d.w] : [d.w, d.h]; };
function fits(pack, it, x, y, r, ignore) {
  const d = ITEMS[it.id], w = r ? d.h : d.w, h = r ? d.w : d.h;
  if (x < 0 || y < 0 || x + w > pack.w || y + h > pack.h) return false;
  return !pack.items.some(o => { if (o === ignore) return false; const [ow, oh] = dims(o); return x < o.x + ow && o.x < x + w && y < o.y + oh && o.y < y + h; });
}
function adjacent(a, b) {     // encostados por um lado (canto não conta)
  const [aw, ah] = dims(a), [bw, bh] = dims(b);
  const ox = a.x < b.x + bw && b.x < a.x + aw, oy = a.y < b.y + bh && b.y < a.y + ah;
  return ((a.x + aw === b.x || b.x + bw === a.x) && oy) || ((a.y + ah === b.y || b.y + bh === a.y) && ox);
}

/* ======================= Jornada ======================= */
const newItem = (id, lv = 1, b = 0) => ({ uid: run.uid++, id, lv, x: 0, y: 0, r: 0, b });   // b = NG em que o item foi obtido (bônus nos números)
const fromShop = en => newItem(en.id, en.lv, en.b);
const stashMax = () => 8 + meta('stash');
const price = en => Math.max(1, Math.round(ITEMS[en.id].price * TIER_PRICE[en.lv - 1] * (1 - meta('disc')) * (en.cut || 1)));   // en = oferta da loja (tier e desconto da rodada 1)
const upCost = it => Math.max(1, Math.round(ITEMS[it.id].price * it.lv * (1 - meta('upd'))));                    // T1→T2: preço do item; T2→T3: o dobro
const sellValue = it => Math.floor(ITEMS[it.id].price * (1 + (it.lv > 1) + 2 * (it.lv > 2) + 2 * (it.lv > 3)) / 2 * (1 + meta('sellv')));   // metade do que foi investido
const trainCost = t => Math.max(1, Math.ceil((t.base + t.step * (run.train[t.id] || 0)) * (1 - meta('traind'))));
const essFor = round => Math.ceil((1 + Math.floor(round / 3)) * (1 + meta('ess')) * (1 + .1 * run.ng));   // +10% por NG

function newRun(ng = 0, train = null) {                // train: o treino que atravessa o New Game+
  run = S.run = { v: 2, round: 1, ng, gold: 12 + meta('gold'), lives: 1 + meta('lives') + (ng ? 1 : 0), train: train || { vig: 0, str: 0, agi: 0, mag: 0, shop: 0 }, uid: 1,
    pack: { w: 5 + meta('cols'), h: 4 + meta('rows'), items: [] }, stash: [], shop: [], free: 0, rerolls: 0, ess: 0 };
  let x = 0; const put = id => { run.pack.items.push(Object.assign(newItem(id), { x })); x += ITEMS[id].w; };   // sem armas: elas vêm da loja da rodada 1
  if (meta('kit')) put('wshield'); if (meta('kitp')) put('potion'); if (meta('kitw')) put('whet');
  setupRound();
}
function startNG() {                                   // New Game+: volta à rodada 1 sem ouro nem itens (os lendários vão para a reserva), mantendo o treino; loja e inimigos ficam mais fortes
  if (!run || !needNG()) return;
  const keep = [...run.pack.items, ...run.stash].filter(it => it.lv > MAX_LV);
  newRun(run.ng + 1, run.train);
  keep.forEach(it => run.stash.push(Object.assign(it, { uid: run.uid++, x: 0, y: 0, r: 0 })));
  hold = true; save(); toPrep(); toast('New Game+ ' + run.ng);
}
function mkEnemy(round, ng = 0) {
  const cyc = Math.floor((round - 1) / CYCLE), pos = (round - 1) % CYCLE, B = BOSSES[(cyc + ng * 5) % BOSSES.length], cls = CLASS[B.spr];
  let e, hpM = 1, dmgM = 1, rank = 0, cf = cyc;       // rank: 0 comum · 1 sargento · 2 capitão · 3 chefe · cf = quanto o ciclo pesa na vida e no dano
  if (pos === 9) { e = { ...ENEMIES[B.kit], n: B.n, spr: B.spr, hp: ENEMIES[9].hp, w: 6, h: 5, big: true }; rank = 3; if (cyc) { hpM = BOSS_HP; dmgM = BOSS_DMG; } }
  else if (pos >= 7) { e = { ...ENEMIES[pos], n: cls[pos - 6], spr: cls[0], hp: MINI_HP[pos - 7], big: false }; rank = pos - 6; [hpM, dmgM] = MINI[pos - 7]; }
  else if (cyc) { e = { ...ENEMIES[UPKIT[pos]], n: ENEMIES[pos].n + RANKS[Math.min(cyc * 2 + (ng ? 1 : 0), RANKS.length - 1)], spr: ENEMIES[pos].spr, hp: UP_HP, big: false }; cf = cyc + pos * IN_CYC; }
  else e = { ...ENEMIES[pos] };
  const extra = round > FINAL ? ENDLESS ** (round - FINAL) : 1, bonus = +(ng * E_ITEM_NG + cyc * E_ITEM_CYC).toFixed(2);
  // grupo: quantos são, quantas ★ cabem a cada um (o líder primeiro) e os companheiros, tirados dos inimigos comuns
  const steps = groupSteps(round, ng), cnt = Math.min(GROUP_MAX, 1 + steps), stars = Math.max(0, steps - (GROUP_MAX - 1)), st = i => Math.floor(stars / cnt) + (i < stars % cnt ? 1 : 0);
  const crew = Array.from({ length: cnt - 1 }, (_, j) => { const m = ENEMIES[(pos + cyc + (j + 1) * 3) % 8]; return { n: m.n, spr: m.spr, st: st(j + 1), kit: m.kit.slice(0, G_KIT) }; });
  // mochila compartilhada: a do líder, mais alta e alargada até caberem os itens dos companheiros
  const pack = { w: e.w, h: cnt > 1 ? Math.min(6, e.h + 1) : e.h, items: [] };
  const mk = (spr, [id0, lv, x, y, r]) => ({ uid: 'e' + pack.items.length, id: spr === 'shaman' && ARCANE[id0] || id0, lv: Math.min(MAX_LV, lv + cyc), x, y, r: r || 0, b: bonus });
  e.kit.forEach(k => { const it = mk(e.spr, k); if (fits(pack, it, it.x, it.y, it.r)) pack.items.push(it); else console.warn('Kit inválido:', e.n, it.id); });
  crew.forEach(c => c.kit.forEach(k => {
    const it = mk(c.spr, k);
    for (let w = pack.w; ; w++) {                     // primeiro buraco livre, coluna a coluna; sem buraco, a mochila alarga
      pack.w = w;
      for (let x = 0; x < w; x++) for (let y = 0; y < pack.h; y++) for (const r of [0, 1]) if (fits(pack, it, x, y, r)) return pack.items.push(Object.assign(it, { x, y, r }));
    }
  }));
  crew.forEach(c => delete c.kit);
  return { n: e.n, spr: e.spr, big: !!e.big, boss: rank === 3, rank, pack, mag: 1 + cyc + ng, st: st(0), crew,
    hp: Math.round(e.hp * (1 + E_HP * cf) * hpM * extra * (1 + NG_HP * ng) * (1 + G_HP * (cnt - 1)) * (1 + STAR_HP * stars)),
    dmg: (1 + E_DMG * cf) * dmgM * extra * (1 + NG_DMG * ng) * (1 + STAR_DMG * stars) / (1 + G_DMG * (cnt - 1)), spd: 1 + Math.min(E_SPD_MAX, E_SPD * cyc) };
}
function rollShop() {
  run.shopKey = (run.shopKey || 0) + 1;            // identifica a loja da rodada (aviso de item raro já visto)
  if (run.round > FINAL) return void (run.shop = []);   // depois do chefe final a loja fecha
  run.shop = Array.from({ length: shopN() }, offer);
}
function offer() {                                     // uma oferta da loja
  const cyc = Math.floor((run.round - 1) / CYCLE), start = run.round === 1;
  const pool = start ? STARTERS : Object.keys(ITEMS).filter(id => run.ng || ITEMS[id].min <= run.round);
  // a cada 10 rodadas cresce a chance de a oferta vir num tier maior: T2 a partir da 11ª, T3 a partir da 31ª (T4 nunca: só de espólio)
  const t2 = cyc ? Math.min(.6, .12 * cyc + meta('tier')) : 0, t3 = cyc >= 3 ? Math.min(.35, .07 * (cyc - 2) + meta('tier') / 2) : 0, q = Math.random();
  return { uid: 's' + run.uid++, id: pool[Math.random() * pool.length | 0], lv: q < t3 ? 3 : q < t3 + t2 ? 2 : 1, r: 0, b: run.ng, cut: start ? START_CUT : 1, sold: false };
}
function setupRound() { run.enemy = mkEnemy(run.round, run.ng); rollShop(); run.free = meta('reroll'); run.rerolls = 0; sel = null; save(); }
const REROLL_BASE = 3;   // troca da loja: 3, 6, 12… (dobra a cada troca paga na rodada)
const rerollCost = () => run.free > 0 ? 0 : REROLL_BASE * 2 ** run.rerolls;
if (run && run.v !== 2) {   // jornada salva por uma versão antiga: completa os campos novos, traz a rodada para dentro da jornada de 50 e refaz inimigo e loja (só nesse caso: a loja de um save atual não muda ao recarregar)
  run.v = 2; run.ng = Math.min(NG_MAX, run.ng || 0); run.round = Math.min(run.round, FINAL); run.train = Object.assign({ vig: 0, str: 0, agi: 0, mag: 0, shop: 0 }, run.train); run.stash = (run.stash || []).filter(it => ITEMS[it.id]);
  run.pack.items = run.pack.items.filter(it => ITEMS[it.id]); run.enemy = mkEnemy(run.round, run.ng); rollShop();
}

/* ======================= Lutadores e combate (mesma lógica para os dois lados) ======================= */
/* o = atributos do lutador. Os da árvore e do treino só entram no herói (playerFighter); o inimigo usa dano, velocidade e poder mágico da rodada. */
const STATS = () => ({ dmg: 1, spd: 1, mag: 0, flat: 0, crit: 0, critd: 0, steal: 0, regen: 0, res: 0, armor: 0, block0: 0, pres: 0, mres: 0, tire: 0, dodge: 0, thorns: 0, aura: 0, potion: 0, big: false, def: null });
function buildFighter(name, spr, hp, pack, o) {
  const f = Object.assign(STATS(), o, { name, spr, hpMax: hp, hp: 0, block: 0, poison: 0, lunge: 0, flash: 0, dead: 0, rg: 0 });
  f.items = pack.items.map(it => ({ it, d: ITEMS[it.id], t: 0, bonus: 0, haste: 0, poison: 0, steal: 0, used: false }));
  for (const a of f.items) {
    if (a.d.hp) f.hpMax += iv(a.d.hp, a.it);
    if (a.d.armor) f.armor += a.it.lv;
    if (a.d.mag) f.mag += a.it.lv;
    const ps = PASSIVES[a.it.p]; if (ps) { if (ps.k === 'hp') f.hpMax += ps.v; else f[ps.k] += ps.v; }   // lendário
  }
  for (const a of f.items) {
    const au = a.d.aura; if (!au) continue;
    const k = 1 + f.aura;
    for (const b of f.items) {
      if (b === a || !adjacent(a.it, b.it)) continue;
      const w = b.d.kind === 'weapon', m = b.d.kind === 'magic';
      if (au.dmg && w) b.bonus += Math.round(iv(au.dmg, a.it) * k);
      if (au.mdmg && m) b.bonus += Math.round(iv(au.mdmg, a.it) * k);
      if (au.haste && b.d.cd) b.haste += au.haste * im(a.it) * k;
      if (au.poison && (w || m)) b.poison += a.it.lv;
      if (au.steal && (w || m)) b.steal += au.steal * im(a.it) * k;
    }
  }
  if (!f.items.some(r => r.d.dmg && usable(f, r))) f.items.push({ it: FIST, d: FIST_D, t: 0, bonus: 0, haste: 0, poison: 0, steal: 0, used: false });   // desarmado: luta no soco
  f.block = f.block0; f.hp = f.hpMax;
  return f;
}
const usable = (f, r) => r.d.kind !== 'magic' || f.mag > 0;                                  // magia só funciona com poder mágico
const hitBase = (f, r) => (iv(r.d.dmg, r.it) + r.bonus + f.flat) * (r.d.kind === 'magic' ? 1 + MAG_DMG * f.mag : f.dmg);   // dano de um golpe antes da sorte, do bloqueio e das resistências
/* Aparência do herói: começa de mãos vazias e veste o que está na mochila (arma mais forte, escudo, elmo, peitoral, chapéu) */
function heroDef() {
  const has = id => run.pack.items.some(it => it.id === id);
  const arm = run.pack.items.filter(it => ITEMS[it.id].dmg).sort((a, b) => iv(ITEMS[b.id].dmg, b) - iv(ITEMS[a.id].dmg, a))[0];
  return { skin: SK.human, body: has('armor') ? PAL.steel : PAL.blue, legs: PAL.dark, hair: '#8a4b22', plate: has('armor'), helm: has('helmet'), hat: has('hat'),
    shield: has('ishield') ? 'iron' : has('wshield') ? 'wood' : null, weapon: arm ? arm.id : null, orb: PAL.blue };
}
const heroName = () => 'Você' + (run.lives > 1 ? ` (+${run.lives - 1} vida${run.lives > 2 ? 's' : ''})` : '');   // vidas extras ao lado do nome
const starTxt = st => st > 3 ? '★' + st : '★'.repeat(st);
function playerFighter() {
  const def = heroDef(), M = meta;
  return buildFighter(heroName(), 'hero:' + [def.weapon, def.shield, def.plate, def.helm, def.hat].join(), 60 + M('hp') + run.train.vig * 12, run.pack, {
    dmg: 1 + M('dmg') + run.train.str * .08, spd: 1 + M('spd') + run.train.agi * .06, mag: M('mag') + run.train.mag, crit: M('crit'), critd: M('critd'), steal: M('steal'), regen: M('regen'),
    res: M('res'), armor: M('armor'), block0: M('block0'), pres: M('pres'), mres: M('mres'), tire: M('tire'), dodge: M('dodge'), thorns: M('thorns'), aura: M('aura'), potion: M('potion'), def });
}
const enemyFighter = () => { const e = run.enemy; return buildFighter(e.n + (e.st ? ' ' + starTxt(e.st) : ''), e.spr, e.hp, e.pack, { dmg: e.dmg || 1, spd: e.spd || 1, mag: e.mag || 0, big: e.big, crew: e.crew || [], st: e.st || 0 }); };
function rates(f) {           // dano e bloqueio por segundo, para a prévia
  let dps = 0, bps = 0;
  for (const r of f.items) { const sp = f.spd * (1 + r.haste) / (r.d.cd || 1); if (r.d.dmg && usable(f, r)) dps += hitBase(f, r) * sp; if (r.d.block) bps += iv(r.d.block, r.it) * sp; }
  return { dps, bps };
}

const STEP = .05;
function startCombat() {
  hideTip(); sel = null; mode = 'combat'; swings.length = 0;
  cb = { a: playerFighter(), b: enemyFighter(), t: 0, acc: 0, sec: 0, over: false, win: false, endT: 0 };
  view = cb; $('#log').innerHTML = ''; $('#fx').innerHTML = '';
  log(`<b>Rodada ${run.round}</b> — você contra ${cb.b.name}`);
  render();
}
function fire(f, foe, r, side) {
  const d = r.d, me = side === 'a' ? 'Você' : f.name, cls = side === 'a' ? 'me' : 'foe', other = side === 'a' ? 'b' : 'a';
  flashItem(r);
  if (d.dmg) {
    const magic = d.kind === 'magic';
    swing(side, r, f); f.lunge = magic ? .4 : 1;
    if (Math.random() < foe.dodge) { fx(other, 'esquivou', 'blk'); log(`<span class="${cls}">${me}</span>: ${d.n} <i>erra</i>`); }
    else {
      const crit = Math.random() < f.crit;
      const dmg = Math.max(1, Math.round(hitBase(f, r) * (.9 + Math.random() * .2) * (crit ? 1.5 + f.critd : 1)));
      const absorbed = Math.min(foe.block, Math.round(dmg * (1 - (d.pierce || 0))));
      foe.block = Math.max(0, foe.block - absorbed - (d.crush || 0));
      let dealt = dmg - absorbed;
      if (dealt > 0) dealt = Math.max(1, Math.round((dealt - (magic ? 0 : foe.armor)) * (1 - foe.res) * (magic ? 1 - foe.mres : 1)));   // magia ignora armadura
      foe.hp -= dealt;
      if (dealt > 0) { foe.flash = 1; fx(other, '-' + dealt + (crit ? '!' : ''), 'dmg'); } else fx(other, 'bloqueou', 'blk');
      if (dealt > 0 && r.poison) foe.poison += r.poison;
      const st = r.steal + f.steal;
      if (dealt > 0 && st) { const h = Math.min(f.hpMax - f.hp, Math.max(1, Math.round(dealt * st))); if (h > 0) { f.hp += h; fx(side, '+' + h, 'heal'); } }
      if (dealt > 0 && foe.thorns && !magic) { f.hp -= foe.thorns; fx(side, '-' + foe.thorns, 'dmg'); }
      log(`<span class="${cls}">${me}</span>: ${d.n} causa <b>${dealt}</b>${crit ? ' <b>crítico!</b>' : ''}${absorbed ? ` <i>(${absorbed} bloqueado)</i>` : ''}`);
    }
  }
  if (d.block) { const b = iv(d.block, r.it); f.block = Math.min(99, f.block + b); fx(side, '🛡+' + b, 'blk'); }
}
function step(dt) {
  const { a, b } = cb;
  cb.t += dt;
  for (const [f, foe, side] of [[a, b, 'a'], [b, a, 'b']]) for (const r of f.items) {
    if (r.d.heal && !r.used && f.hp <= f.hpMax / 2 && f.hp > 0) {
      r.used = true; const h = Math.round(iv(r.d.heal, r.it) * (1 + f.potion)); f.hp = Math.min(f.hpMax, f.hp + h);
      flashItem(r); fx(side, '+' + h, 'heal'); log(`<span class="${side === 'a' ? 'me' : 'foe'}">${side === 'a' ? 'Você' : f.name}</span> bebe a poção: <b>+${h}</b> de vida`);
    }
    if (!r.d.cd || !usable(f, r)) continue;
    r.t += dt * f.spd * (1 + r.haste);
    if (r.t >= r.d.cd) { r.t -= r.d.cd; fire(f, foe, r, side); }
  }
  cb.sec += dt;
  if (cb.sec >= 1) {                                   // a cada segundo: veneno e exaustão
    cb.sec -= 1;
    for (const [f, side] of [[a, 'a'], [b, 'b']]) {
      const tired = cb.t > FATIGUE_AT + f.tire ? Math.ceil((cb.t - FATIGUE_AT - f.tire) / 2) : 0;
      if (f.poison) { const p = Math.max(1, Math.round(f.poison * (1 - f.pres))); f.hp -= p; fx(side, '☠-' + p, 'psn'); }
      if (tired) { const td = Math.round(tired * Math.max(1, f.hpMax / 100)); f.hp -= td; fx(side, '-' + td, 'dmg'); }   // acima de 100 de vida, a exaustão cresce junto
      if (f.regen && f.hp > 0 && (f.rg += f.regen) >= 1) { const h = Math.min(f.hpMax - f.hp, Math.floor(f.rg)); f.rg -= Math.floor(f.rg); if (h > 0) { f.hp += h; fx(side, '+' + h, 'heal'); } }
    }
    if (cb.t > FATIGUE_AT && Math.ceil(cb.t - FATIGUE_AT) === 1) log('<i>Exaustão! Os lutadores perdem vida a cada segundo.</i>');
  }
  if (a.hp <= 0 || b.hp <= 0) {
    cb.over = true; cb.win = a.hp > 0;                 // empate conta como derrota
    a.hp = Math.max(0, a.hp); b.hp = Math.max(0, b.hp);
    (cb.win ? b : a).dead = .01; if (!cb.win && b.hp <= 0) b.dead = .01;
  }
}
function finishCombat() {
  mode = 'result';
  const round = run.round, name = cb.b.name;
  if (cb.win) {
    const ng = run.ng, final = round === FINAL, gold = Math.round((6 + round * 2) * (1 + meta('goldw'))), ess = essFor(round) + (final ? 50 : 0);
    S.meta.ess += ess; run.ess += ess;
    if (ng > (S.bng || 0) || (ng === (S.bng || 0) && round > (S.best || 0))) { S.best = round; S.bng = ng; }
    // Espólio: um item da mochila do inimigo, com o bônus dos itens dele, vai para a reserva — mesmo cheia (a próxima luta só começa de volta ao limite).
    // Às vezes vem lendário (T4), com um passivo sorteado.
    let loot = '';
    if (Math.random() < DROP_CHANCE + meta('drop') && run.enemy.pack.items.length) {
      const src = run.enemy.pack.items[Math.random() * run.enemy.pack.items.length | 0], cyc = Math.floor((round - 1) / CYCLE);
      const leg = Math.random() < (.06 + .02 * cyc + meta('leg')) * (run.enemy.rank ? 2.5 : 1), it = newItem(src.id, leg ? LEG : src.lv, src.b || 0);
      if (leg) it.p = Math.random() * PASSIVES.length | 0;
      run.stash.push(it);
      const over = run.stash.length > stashMax(); if (over) hold = true;
      loot = `<p class="rw loot"><img src="${itemImg(it.id)}" alt=""> Espólio: ${ITEMS[it.id].n}${leg ? ' <span class="leg">✦ lendário</span>' : it.lv > 1 ? ' ' + '★'.repeat(it.lv) : ''}</p>${over ? `<p class="warn">Reserva acima do limite (${run.stash.length}/${stashMax()}): venda ou equipe itens para lutar.</p>` : ''}`;
    }
    run.gold += gold; run.round++; setupRound();
    if (final) hold = true;
    const canNG = final && ng < NG_MAX, e = run.enemy;
    const next = final ? (canNG ? `<p>Próxima parada: <b>ng.${ng + 1}</b></p>${ngList()}` : '<p>Último NG vencido! Agora vem o <b>modo infinito</b>: loja e treino fechados.</p>')
      : `<p class="dim">Próximo: <b>${RANK_ICON[e.rank]}${e.n}${e.crew.length ? ` e mais ${e.crew.length}` : ''}</b></p>`;
    return modal(final ? '🏆 Chefe final derrotado!' : 'Vitória!', `<p>Você derrotou ${name}.</p><p class="rw">🪙 +${gold} de ouro &nbsp; 💠 +${ess} de essência</p>${loot}${next}`,
      final ? [canNG ? [`🔁 New Game+ (ng.${ng + 1})`, startNG] : ['∞ Modo infinito', toPrep]] : [['Continuar ▶', toPrep]], final ? 0 : 1400);
  }
  run.lives--; hold = true;                            // derrota pausa o auto-play
  if (run.lives > 0) {
    const pity = 3 + meta('consol'); run.gold += pity; rollShop(); save();
    return modal('Derrota', `<p>${name} venceu esta luta. Você perdeu uma vida — restam <b>${run.lives}</b>.</p><p class="rw">🪙 +${pity} de ouro de consolo</p>`, [['Tentar de novo', toPrep]]);
  }
  const total = run.ess; run = S.run = null; save();
  modal('Fim da jornada', `<p>${name} derrotou você na rodada ${round}.</p><p class="rw">💠 ${total} de essência ganha nesta jornada</p><p class="dim">Gaste a essência na árvore: as melhorias são permanentes.</p>`,
    [['💠 Árvore de melhorias', () => show('tree')], ['Menu', () => show('menu')]]);
}
/* Antes de lutar: NG+ pendente, reserva acima do limite, aviso do chefe final e item raro na loja. auto = chamada pelo auto-play */
function tryFight(auto) {
  if (mode !== 'prep' || !run) return;
  if (needNG()) return auto ? void (hold = true) : startNG();
  if (run.stash.length > stashMax()) { hold = true; return toast(`Reserva acima do limite (${run.stash.length}/${stashMax()}): venda ou equipe itens`); }
  if (run.round === FINAL && !run.warnFinal) return finalWarn();
  if (run.shop.some(isRare) && run.rareAck !== run.shopKey) {
    if (auto) { hold = true; return toast('★★★ Item raro na loja! Auto-play pausado'); }
    return modal('Item raro na loja', '<p>A loja tem um item <span class="stars">★★★</span> que você não comprou. Na próxima rodada ele some.</p>',
      [['🛒 Ver a loja', () => { run.rareAck = run.shopKey; shopTab(); }], ['Lutar assim mesmo', () => { run.rareAck = run.shopKey; hold = false; startCombat(); }]]);
  }
  if (!auto) hold = false;
  startCombat();
}
/* Item raro: ★★★ na loja, que dá para comprar e que você ainda não tem em ★★★ (na mochila ou na reserva) */
const isRare = en => en.lv === MAX_LV && !en.sold && price(en) <= run.gold && ![...run.pack.items, ...run.stash].some(it => it.id === en.id && it.lv >= MAX_LV);
function finalWarn() {                                 // aviso do último chefe da jornada (uma vez por NG)
  hold = true;
  modal('⚠ Último chefe', run.ng < NG_MAX ? `<p>Vencer este chefe leva ao <b>ng.${run.ng + 1}</b>.</p>${ngList()}<p class="mtip">💡 Gaste o ouro no treino antes de lutar.</p>`
    : '<p>Vencer este chefe abre o <b>modo infinito</b>.</p><ul class="mlist"><li class="lose">Fecham: loja e treino</li></ul><p class="mtip">💡 Gaste o ouro antes de lutar.</p>', [['Entendi', () => { run.warnFinal = true; save(); render(); }]]);
}
function ngList() {                                    // o que muda no New Game+, em três linhas
  return '<ul class="mlist"><li class="lose">Zeram: ouro, mochila e reserva</li><li class="keep">Ficam: lendários ✦ (na reserva) e treino</li><li class="keep">Ganha: +1 vida e loja mais forte</li></ul>';
}
const checkFinalWarn = () => { if (run && mode === 'prep' && run.round === FINAL && !run.warnFinal) finalWarn(); };
function shopTab() { document.querySelector('.tabs [data-tab="shop"]').click(); }
function toPrep() { mode = 'prep'; cb = null; swings.length = 0; $('#fx').innerHTML = ''; autoT = 0; render(); checkFinalWarn(); }
const RANK_ICON = ['', '🎖 ', '🎖🎖 ', '👑 '];   // comum · sargento · capitão · chefe

/* ======================= Arena (canvas) ======================= */
/* A altura lógica é fixa (104 px de arte); a largura acompanha a proporção da área na tela, então nada é cortado:
   numa janela larga e baixa a cena ganha largura em vez de perder o topo. Os lutadores ficam sempre em volta do centro. */
const cv = $('#cv'), g = cv.getContext('2d'), CH = 104, GROUND = CH - 24, GAP = 72;   // GAP = do centro até as costas de cada lutador
let BG = null;
function fitArena() {
  const r = $('#arena').getBoundingClientRect(); if (!r.width || !r.height) return;
  const w = Math.max(176, Math.round(CH * r.width / r.height / 2) * 2);   // mínimo: os dois lutadores cabem (abaixo disso só as bordas somem)
  const st = stageNow();
  if (BG && w === cv.width && BG.stage === st) return;
  cv.width = w; cv.height = CH; g.imageSmoothingEnabled = false; BG = arenaBg(w, CH, st);
}
// Cenário da dezena atual (0 a 9: do entardecer ao inferno). No resultado de uma vitória a cena ainda é a da luta que acabou.
const stageNow = () => run ? Math.min(9, Math.floor((run.round - (mode === 'result' && cb && cb.win ? 2 : 1)) / CYCLE) * 2 + (run.ng ? 1 : 0)) : 0;   // ng.0: cenários pares · NG+: ímpares, mais perto do inferno
function drawFires(now) {                              // chamas das árvores (pontos em BG.fires) e, perto do inferno, fagulhas subindo pela cena
  for (const [x, y, s] of BG.fires) for (let i = 0; i < 8; i++) {
    const k = (now / 420 + i * .27 + x * .13) % 1; g.globalAlpha = 1 - k;
    g.fillStyle = i % 3 ? '#ff8a1e' : '#ffe27a'; g.fillRect(Math.round((x + Math.sin(k * 6 + i) * s) / 2) * 2, Math.round((y - k * 14) / 2) * 2, 2, 2);
  }
  if (BG.stage >= 6) for (let i = 0; i < (BG.stage - 5) * 4; i++) {
    const k = (now / 3000 + i * .173) % 1; g.globalAlpha = (1 - k) * .8;
    g.fillStyle = i % 2 ? '#ff7a1e' : '#ffd257'; g.fillRect(Math.round((i * 97 % cv.width + Math.sin(k * 5 + i) * 6) / 2) * 2, Math.round((GROUND - k * 70) / 2) * 2, 2, 2);
  }
  g.globalAlpha = 1;
}
/* Golpes na arena: só desenho, não mexem em vida nem em tempo. Cada cópia do mesmo item na mochila rende um golpe extra logo atrás do principal
   (3 espadas = o corte e mais dois). kind: slash (corte) · thrust (estocada) · bash (impacto) · bolt (projétil mágico). */
const swings = [];
function swing(side, r, f) {
  const n = Math.min(5, f.items.filter(o => o.it.id === r.it.id).length), id = r.it.id;
  const kind = r.d.kind === 'magic' ? 'bolt' : id === 'spear' ? 'thrust' : id === 'mace' || id === 'fist' ? 'bash' : 'slash';
  for (let i = 0; i < n && swings.length < 40; i++) swings.push({ side, kind, i, t: -i * .12 });
}
function drawSwings(real) {
  const P = (x, y, w = 2, h = 2) => g.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h);
  for (let k = swings.length - 1; k >= 0; k--) {
    const s = swings[k]; s.t += real; if (s.t < 0) continue;
    const p = s.t / .3; if (p >= 1) { swings.splice(k, 1); continue; }
    const dir = s.side === 'a' ? 1 : -1, tx = cv.width / 2 + dir * (GAP - 28), ty = GROUND - 30 + (s.i ? (s.i % 2 ? 7 : -7) : 0);   // centro do alvo; os ecos saem um pouco acima e abaixo
    g.globalAlpha = 1 - p * p;
    if (s.kind === 'bolt') {
      const sx = cv.width / 2 - dir * (GAP - 46), x = sx + (tx - sx) * Math.min(1, p * 1.5), y = ty - 4 + Math.sin(p * 9 + s.i) * 3;
      g.fillStyle = '#a455e0'; P(x - dir * 6, y, 4, 4); P(x - dir * 12, y + 2); g.fillStyle = s.i ? '#e2a8ff' : '#fff'; P(x, y - 2, 6, 6);
    } else if (s.kind === 'thrust') { g.fillStyle = s.i ? '#ffe9a8' : '#fff'; P(tx - dir * (30 - p * 26) - 10, ty, 20, 2); }
    else if (s.kind === 'bash') { const d = 4 + p * 12; g.fillStyle = s.i ? '#ffd257' : '#fff'; for (let a = 0; a < 8; a++) P(tx + Math.cos(a * .785) * d, ty + Math.sin(a * .785) * d); }
    else { const a0 = -1.3 + s.i * .45, rad = 20 - s.i * 3; g.fillStyle = s.i ? '#ffe9a8' : '#fff'; for (let a = a0; a < a0 + 2.6 * Math.min(1, p * 2.2); a += .08) P(tx - dir * 8 + dir * Math.cos(a) * rad, ty + Math.sin(a) * rad); }
  }
  g.globalAlpha = 1;
}
new ResizeObserver(fitArena).observe($('#arena'));
let lastTs = 0;
function drawBody(spr, def, x, y, sc, dir, f) {        // um boneco; morte, golpe e piscar vêm do lutador f (o grupo divide os mesmos)
  const s = charSprite(spr, def), w = 28 * sc;
  g.save();
  if (f.dead) { const k = Math.min(1, f.dead); g.globalAlpha = 1 - k * .65; g.translate(x + w / 2, GROUND); g.rotate(-dir * k * Math.PI / 2); g.translate(-(x + w / 2), -GROUND); }
  g.translate(dir > 0 ? x : x + w, y); g.scale(dir * sc, sc);
  g.drawImage(s.img, 0, 0);
  if (f.flash > 0) { g.globalAlpha = Math.min(1, f.flash); g.drawImage(s.white, 0, 0); }
  g.restore();
}
/* Inimigo de tier maior (★): fagulhas que sobem em espiral dos pés à cabeça e um brilho no chão; a cor muda a cada 5 ★ */
function drawStars(x, w, y, st, now, seed) {
  const n = Math.min(8, 2 + st), cx = x + w / 2; g.fillStyle = STAR_COL[Math.min(STAR_COL.length - 1, Math.floor((st - 1) / 5))];
  for (let i = 0; i < n; i++) {
    const a = now / 700 + i * 6.283 / n + seed, k = (now / 1100 + i / n + seed * .37) % 1;
    g.globalAlpha = .95 - k * .7;
    g.fillRect(Math.round((cx + Math.cos(a) * w * .36) / 2) * 2, Math.round((GROUND - 4 - k * (GROUND - y - 6)) / 2) * 2, 2, 2);
  }
  g.globalAlpha = .3 + .15 * Math.sin(now / 250 + seed); g.fillRect(Math.round(cx - w * .32), GROUND - 2, Math.round(w * .64), 2);
  g.globalAlpha = 1;
}
function drawFighter(f, dir, now) {
  const sc = f.big ? 3 : 2, w = 28 * sc, lunge = dir * f.lunge * 16, bob = k => f.dead ? 0 : Math.round(Math.sin(now / 320 + k));
  const x = Math.round((dir > 0 ? cv.width / 2 - GAP : cv.width / 2 + GAP - w) + lunge), y = GROUND - 27 * sc + bob(dir > 0 ? 0 : 2);
  const crew = f.crew || [], n = crew.length;
  if (n) {                                             // o grupo fica atrás do líder, do mais distante para o mais perto
    const start = dir < 0 ? x + w * .5 : x + w * .5 - 56, room = dir < 0 ? cv.width - 58 - start : start - 2, sp = n > 1 ? clamp(room / (n - 1), 6, 30) : 0;
    for (let j = n - 1; j >= 0; j--) {
      const c = crew[j], cx = Math.round(start - dir * j * sp), cy = GROUND - 54 + bob(j * 1.3);
      drawBody(c.spr, null, cx, cy, 2, dir, f); if (c.st) drawStars(cx, 56, cy, c.st, now, j + 1);
    }
  }
  drawBody(f.spr, f.def, x, y, sc, dir, f); if (f.st) drawStars(x, w, y, f.st, now, 0);
}
function frame(ts) {
  requestAnimationFrame(frame);
  const real = Math.min(.1, (ts - lastTs) / 1000 || 0); lastTs = ts;
  if ($('#menu').classList.contains('on')) return drawMenuArt(ts);
  if (!$('#game').classList.contains('on') || !view.a) return;
  if (!BG || BG.stage !== stageNow()) { fitArena(); if (!BG) return; }
  renderAuto();
  if (mode === 'prep' && run) {                        // auto-play: conta AUTO_WAIT e luta sozinho
    const ready = autoOn() && !hold && $('#modal').hidden && !drag;
    autoT = ready ? autoT + real : 0; fightLabel(ready);
    if (ready && autoT >= AUTO_WAIT) { autoT = 0; tryFight(true); }
  }
  if (mode === 'combat' && cb) {
    if (!cb.over) { cb.acc += real * S.speed; while (cb.acc >= STEP && !cb.over) { step(STEP); cb.acc -= STEP; } }
    else if ((cb.endT += real) > 1.1) finishCombat();
    updateCombatUI();
  }
  for (const f of [view.a, view.b]) { f.lunge = Math.max(0, f.lunge - real * 5); f.flash = Math.max(0, f.flash - real * 5); if (f.dead) f.dead = Math.min(1, f.dead + real * 2.5); }
  g.drawImage(BG, 0, 0); drawFires(ts);
  drawFighter(view.a, 1, ts); drawFighter(view.b, -1, ts); drawSwings(real * (mode === 'combat' ? S.speed : 1));
}

/* ======================= Interface ======================= */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  $('#modal').hidden = true; hideTip();
  if (id === 'menu') renderMenu();
  if (id === 'tree') renderTree(true);
  if (id === 'game') { mode = 'prep'; cb = null; autoT = 0; render(); checkFinalWarn(); }
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on'); }
let moTimer = 0;
function modal(title, body, btns, autoMs) {           // autoMs: com o auto-play ligado, o 1º botão é apertado sozinho depois desse tempo
  clearTimeout(moTimer);
  $('#mo-title').textContent = title; $('#mo-body').innerHTML = body;
  const foot = $('#mo-foot'); foot.innerHTML = '';
  btns.forEach(([t, fn], i) => { const b = el('button', 'btn' + (i ? '' : ' primary'), t); b.onclick = () => { clearTimeout(moTimer); $('#modal').hidden = true; fn(); }; foot.append(b); });
  $('#modal').hidden = false;
  if (autoMs && autoOn() && !hold) moTimer = setTimeout(() => { if (autoOn() && !hold) foot.firstChild.click(); }, autoMs / S.speed);
}
function log(html) { const l = $('#log'); l.append(el('p', '', html)); while (l.children.length > 80) l.firstChild.remove(); l.scrollTop = l.scrollHeight; }
function fx(side, text, cls) {
  const s = el('span', 'float ' + cls, text);
  s.style.left = 50 + (side === 'a' ? -1 : 1) * (GAP - 28) / cv.width * 100 + (Math.random() * 10 - 5) + '%';   // em cima do lutador s.style.top = 38 + Math.random() * 14 + '%';
  $('#fx').append(s); setTimeout(() => s.remove(), 900);
}
function flashItem(r) { const e = itemEls.get(r.it); if (e) { e.classList.remove('fire'); void e.offsetWidth; e.classList.add('fire'); } }

// Texto do item. r = dados do item já calculados na mochila (bônus dos vizinhos), quando houver
/* Texto do item em linhas de "rótulo · valor · detalhe", seguidas das regras especiais em frases curtas */
const KIND = { weapon: '⚔ Arma', magic: '✨ Magia', def: '🛡 Defesa', util: '🔗 Apoio' };
function describe(it, r) {
  const d = ITEMS[it.id], R = [], N = [], m = im(it), magic = d.kind === 'magic', sp = d.cd / (1 + (r ? r.haste : 0));
  const row = (k, v, x = '') => R.push(`<div class="r"><span class="k">${k}</span><b>${v}</b>${x ? `<small>${x}</small>` : ''}</div>`);
  if (d.dmg) { const base = iv(d.dmg, it), bon = r ? r.bonus : 0; row(magic ? '✨ Dano mágico' : '⚔ Dano', base + (bon ? ` +${bon}` : ''), `a cada ${sp.toFixed(1)} s · ≈ ${((base + bon) / sp).toFixed(1)} por segundo`); }
  if (d.block) row('🛡 Bloqueio', '+' + iv(d.block, it), `a cada ${sp.toFixed(1)} s`);
  if (d.hp) row('❤ Vida máxima', '+' + iv(d.hp, it));
  if (d.mag) row('✨ Poder mágico', '+' + it.lv);
  if (d.armor) row('⛨ Armadura', '−' + it.lv, 'em cada golpe sofrido');
  if (d.heal) row('🧪 Cura', iv(d.heal, it), 'uma vez por luta');
  if (d.aura) {
    if (d.aura.dmg) row('⚔ Dano das armas', '+' + iv(d.aura.dmg, it));
    if (d.aura.mdmg) row('✨ Dano das magias', '+' + iv(d.aura.mdmg, it));
    if (d.aura.haste) row('⚡ Velocidade', '+' + pct(d.aura.haste * m), 'armas e escudos');
    if (d.aura.poison) row('☠ Veneno', '+' + it.lv, 'por golpe das armas');
    if (d.aura.steal) row('🩸 Roubo de vida', pct(d.aura.steal * m), 'do dano das armas');
    N.push('Apoio: vale para os itens encostados nele, lado com lado (canto não conta).');
  }
  if (r && r.poison) row('☠ Envenena', r.poison, 'por golpe (dos vizinhos)');
  if (r && r.steal) row('🩸 Cura', pct(r.steal), 'do dano (dos vizinhos)');
  if (magic) {
    N.push(`Ignora armadura. Cada ponto de poder mágico dá +${pct(MAG_DMG)} de dano.`);
    if (view.a && !view.a.mag && mode === 'prep') N.push('<span class="warn">Sem poder mágico não funciona: treine ✨ ou use o chapéu de mago.</span>');
  }
  if (d.pierce) N.push(`Perfura: ${pct(d.pierce)} do dano passa pelo bloqueio.`);
  if (d.crush) N.push(`Esmaga: cada golpe quebra mais ${d.crush} de bloqueio do alvo.`);
  if (d.block) N.push('O bloqueio acumula e absorve o dano dos próximos golpes.');
  if (d.armor) N.push('Não reduz dano de magia.');
  if (d.heal) N.push('Bebida sozinha quando a vida cai a 50% ou menos.');
  if (PASSIVES[it.p]) N.push(`<span class="leg">✦ Lendário: ${PASSIVES[it.p].t}.</span>`);
  if (it.b) N.push(`<span class="dim">Bônus de forja: números +${pct(NG_ITEM * it.b)}.</span>`);
  return `<div class="desc">${R.join('')}</div>${N.length ? `<ul class="notes">${N.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}`;
}
const runtimeOf = it => [view.a, view.b].flatMap(f => f ? f.items : []).find(r => r.it === it);
const tierTag = it => it.lv > MAX_LV ? '<span class="leg">✦ lendário</span>' : `<span class="stars">${'★'.repeat(it.lv)}${'☆'.repeat(MAX_LV - it.lv)}</span>`;
const itemTitle = it => `${ITEMS[it.id].n} ${tierTag(it)}<br><small>${KIND[ITEMS[it.id].kind]} · ${ITEMS[it.id].w}×${ITEMS[it.id].h} casas</small>`;

function showTip(e, it) {
  if (drag && drag.moved) return;
  const t = $('#tip'); t.innerHTML = `<b>${itemTitle(it)}</b>${describe(it, runtimeOf(it))}`; t.hidden = false; moveTip(e);
}
function moveTip(e) { const t = $('#tip'); if (t.hidden) return; t.style.left = clamp(e.clientX + 14, 4, innerWidth - t.offsetWidth - 4) + 'px'; t.style.top = clamp(e.clientY - t.offsetHeight - 10, 4, innerHeight - t.offsetHeight - 4) + 'px'; }
function hideTip() { $('#tip').hidden = true; }

function itemEl(it, src) {
  const [w, h] = dims(it), e = el('div', `it k-${ITEMS[it.id].kind} lv${it.lv}` + (sel && sel.it === it ? ' sel' : ''),
    `<img src="${itemImg(it.id, it.r ? 1 : 0)}" draggable="false" alt=""><b>${it.lv > MAX_LV ? '✦' : '★'.repeat(it.lv - 1)}</b>${ITEMS[it.id].cd ? '<i class="cd"></i>' : ''}`);
  e.style.width = `calc(var(--c) * ${w})`; e.style.height = `calc(var(--c) * ${h})`;
  e.onmouseenter = ev => showTip(ev, it); e.onmousemove = moveTip; e.onmouseleave = hideTip;
  if (src === 'enemy') e.onclick = () => { if (mode === 'prep') { sel = { src, it }; render(); } };
  else if (src !== 'shop') e.onpointerdown = ev => startDrag(ev, src, it);   // na loja quem arrasta é o card inteiro
  return e;
}
function renderGrid(box, pack, src) {
  box.innerHTML = ''; box.style.width = `calc(var(--c) * ${pack.w})`; box.style.height = `calc(var(--c) * ${pack.h})`;
  for (const it of pack.items) {
    const e = itemEl(it, src); e.style.left = `calc(var(--c) * ${it.x})`; e.style.top = `calc(var(--c) * ${it.y})`;
    if (src === 'pack') e.oncontextmenu = ev => { ev.preventDefault(); rotateInPlace(it); };
    if (ITEMS[it.id].kind === 'magic' && !(src === 'pack' ? view.a : view.b).mag) e.classList.add('inert');   // magia sem poder mágico: apagada
    box.append(e); itemEls.set(it, e);
  }
}
function renderPlate(id, f, combat) {
  const p = $(id), r = rates(f);
  p.querySelector('.pn').textContent = f.name + (f.crew && f.crew.length ? ` +${f.crew.length}` : '');
  p.querySelector('.hp i').style.width = clamp(f.hp / f.hpMax * 100, 0, 100) + '%';
  p.querySelector('.hp span').textContent = `${Math.ceil(f.hp)} / ${f.hpMax}`;
  p.querySelector('.st').innerHTML = combat
    ? `<span class="blk">🛡 ${f.block}</span>${f.poison ? ` <span class="psn">☠ ${f.poison}</span>` : ''}`
    : `⚔ ${r.dps.toFixed(1)}/s &nbsp;🛡 ${r.bps.toFixed(1)}/s${f.armor ? ` &nbsp;⛨ ${f.armor}` : ''}${f.mag ? ` &nbsp;✨ ${f.mag}` : ''}`;
}
function updateCombatUI() {
  renderPlate('#pa', cb.a, true); renderPlate('#pb', cb.b, true);
  for (const f of [cb.a, cb.b]) for (const r of f.items) {
    const e = itemEls.get(r.it); if (!e) continue;
    if (r.d.cd) e.lastChild.style.height = clamp(r.t / r.d.cd * 100, 0, 100) + '%';
    if (r.used) e.classList.add('used');
  }
  const t = $('#timer'); t.textContent = cb.t > FATIGUE_AT ? `⏱ ${cb.t.toFixed(0)}s — exaustão!` : `⏱ ${cb.t.toFixed(0)}s`; t.classList.toggle('hot', cb.t > FATIGUE_AT);
}

function render() {
  if (!run) return;
  const prep = mode === 'prep';
  $('#g-round').textContent = RANK_ICON[run.enemy.rank || 0] + (endless() ? `Rodada ${run.round} · ∞` : `Rodada ${Math.min(run.round, FINAL)}/${FINAL}`) + ` ng.${run.ng}`;
  $('#g-round').dataset.tip = roundTip(); $('#pb').dataset.tip = groupTip();
  renderAuto();
  $('#g-lives').textContent = run.lives; $('#g-gold').textContent = run.gold; $('#g-ess').textContent = S.meta.ess;
  $('#game').dataset.mode = mode;
  $('#fight').hidden = !prep; $('#speed').hidden = $('#timer').hidden = prep;
  $('#prep-ui').hidden = !prep; $('#log').hidden = prep;
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.s === S.speed));

  if (mode !== 'result') {                      // no resultado a arena continua mostrando a luta que acabou
    if (prep) view = { a: playerFighter(), b: enemyFighter() };
    itemEls.clear();
    renderGrid($('#pack'), run.pack, 'pack');
    renderGrid($('#epack'), run.enemy.pack, 'enemy');
    const ep = run.enemy.pack; $('#epack').style.setProperty('--ek', Math.min(1, 7 / ep.w, 5 / ep.h));   // mochila do grupo grande: casas menores
    $('#e-title').innerHTML = run.enemy.crew.length ? `Mochila do grupo <small>${run.enemy.crew.length + 1} inimigos</small>` : `Mochila de ${run.enemy.n}`;
    renderPlate('#pa', view.a, !prep); renderPlate('#pb', view.b, !prep);
  }

  const st = $('#stash'); st.innerHTML = '';
  run.stash.forEach(it => st.append(itemEl(it, 'stash')));
  $('#stash-n').textContent = `${run.stash.length}/${stashMax()}`; $('#stash-n').classList.toggle('warn', run.stash.length > stashMax());

  const shBox = $('#shop'); shBox.innerHTML = '';
  const sh = el('div', 'cards'), foot = el('div', 'shop-foot'); shBox.append(sh, foot);   // os cards rolam; a troca fica sempre na base
  if (run.round > FINAL) {                            // jornada vencida: ou o próximo NG+, ou (depois do último) o modo infinito
    if (needNG()) { sh.innerHTML = `<p class="dim">Jornada vencida! Siga para o ng.${run.ng + 1}.</p>`; const b = el('button', 'btn small primary', `🔁 New Game+ (ng.${run.ng + 1})`); b.onclick = startNG; sh.append(b); }
    else sh.innerHTML = '<p class="dim">Modo infinito: a loja e o treino estão fechados.</p>';
  }
  const rare = run.shop.some(isRare);
  document.querySelector('.tabs [data-tab="shop"]').classList.toggle('alert', rare);
  run.shop.forEach(en => {
    const c = el('div', 'card' + (en.sold ? ' sold' : '') + (price(en) > run.gold ? ' poor' : '') + (isRare(en) ? ' rare' : ''));
    if (isRare(en)) c.append(el('span', 'rare-tag', 'RARO'));
    if (!en.sold) {   // o item cresce até preencher a área do card; clicar ou arrastar em qualquer ponto do card vale
      const d = ITEMS[en.id], ie = itemEl(en, 'shop'), box = el('div', 'ci');
      ie.style.setProperty('--c', Math.floor(Math.min(SHOP_BOX / d.w, SHOP_BOX / d.h, 50)) + 'px'); box.append(ie); c.append(box); c.dataset.id = en.id;
      c.onpointerdown = ev => startDrag(ev, 'shop', en);
      c.onmouseenter = ev => showTip(ev, en); c.onmousemove = moveTip; c.onmouseleave = hideTip;
      if (sel && sel.it === en) c.classList.add('sel');
    }
    c.append(el('span', 'cn', en.sold ? 'vendido' : ITEMS[en.id].n + (en.lv > 1 ? ` <span class="stars">${'★'.repeat(en.lv)}</span>` : '')), el('span', 'cp', en.sold ? '' : '🪙 ' + price(en)));
    sh.append(c);
  });
  if (run.round <= FINAL) {
  const rc = rerollCost(), rb = el('button', 'btn reroll', `🎲 Trocar itens <b>${rc ? '🪙 ' + rc : 'grátis'}</b>`);
  rb.dataset.tip = 'Sorteia outros itens. O preço dobra a cada troca na mesma rodada.';
  rb.disabled = rc > run.gold; rb.onclick = () => { if (run.free > 0) run.free--; else { run.gold -= rc; run.rerolls++; } rollShop(); sel = null; save(); render(); };
  foot.append(el('span', 'dim', `${run.shop.length} de ${SHOP_MAX} vagas`), rb);
  }
  fitShop();

  const tr = $('#train'); tr.innerHTML = run.round > FINAL ? '<p class="dim">Jornada vencida: o treino está fechado.</p>' : '';
  if (run.round <= FINAL) TRAIN.forEach(t => {
    const n = run.train[t.id] || 0, max = !!(t.max && t.max()), c = trainCost(t);
    const row = el('div', 'trow', `<span class="te">${t.e}</span><div><b>${t.n}</b> <small>nv.${n}</small><br><small>${t.d}</small></div>`);
    row.dataset.tip = `<b>${t.n}</b> nv.${n}: ${t.d}. O preço sobe a cada nível; o treino segue nos NG+.`;
    const b = el('button', 'btn small', max ? 'máx.' : '🪙 ' + c); b.disabled = max || c > run.gold;
    b.onclick = () => { run.gold -= c; run.train[t.id] = n + 1; save(); render(); };
    row.append(b); tr.append(row);
  });
  renderInfo();
}
/* Loja sem rolagem: escolhe o número de colunas que deixa o item de cada card o maior possível dentro da área, e encolhe os cards até caberem */
function fitShop() {
  const box = $('#shop .cards'); if (!box || $('#shop').hidden) return;
  const cards = [...box.children].filter(c => c.classList.contains('card')), n = cards.length, W = box.clientWidth, H = box.clientHeight, GAP = 6, TIGHT = 100;   // card mais estreito que TIGHT: nome numa linha só
  if (!n || !W || !H) return;
  let best = null;
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c), w = (W - GAP * (c - 1)) / c, h = (H - GAP * (r - 1)) / r, s = Math.min(w - 10, h - (w < TIGHT ? 52 : 72));   // 52/72: nome, preço e margens (estimativa só para escolher as colunas)
    if (!best || s > best.s) best = { c, r, s, h, w };
  }
  box.classList.toggle('tight', best.w < TIGHT);
  box.style.gridTemplateColumns = `repeat(${best.c}, minmax(0, 1fr))`; box.style.gridTemplateRows = `repeat(${best.r}, ${Math.floor(best.h)}px)`;
  for (const card of cards) {                          // o item ocupa o que sobrou do card depois do nome e do preço (medido, não estimado)
    const ci = card.querySelector('.ci'); if (!ci) continue;
    const d = ITEMS[card.dataset.id], sw = Math.min(ci.clientWidth, 110) - 6, sh = Math.min(ci.clientHeight, 110) - 4;
    ci.firstChild.style.setProperty('--c', Math.max(4, Math.floor(Math.min(sw / d.w, sh / d.h, 56))) + 'px');
  }
}
function renderAuto() {                               // botão do auto-play (do ng.1 em diante)
  const b = $('#auto'); b.hidden = !run || run.ng < 1; if (b.hidden) return;
  const t = !S.auto ? '🤖 Auto: off' : hold ? '🤖 Auto: pausado' : '🤖 Auto: on';
  if (b.textContent !== t) { b.textContent = t; b.classList.toggle('on', !!(S.auto && !hold)); }
}
function fightLabel(ready) { const t = needNG() ? '🔁 New Game+' : ready ? `🤖 Luta em ${Math.ceil(AUTO_WAIT - autoT)}…` : '⚔ LUTAR!', b = $('#fight'); if (b.textContent !== t) b.textContent = t; }
function roundTip() {
  if (run.round > FINAL) return endless() ? 'Modo infinito: cada rodada mais dura que a anterior.' : 'Jornada vencida: siga para o New Game+.';
  const cnt = run.enemy.crew.length + 1, now = groupSteps(run.round, run.ng); let nx = 0;
  for (let r = run.round + 1; r <= FINAL && !nx; r++) if (groupSteps(r, run.ng) > now) nx = r;
  return `<b>Rodada ${run.round} de ${FINAL} · ng.${run.ng} de ${NG_MAX}</b><br>Dezena ${Math.ceil(run.round / CYCLE)} de ${FINAL / CYCLE}: X8 sargento, X9 capitão, X0 chefe. A cada dezena os inimigos ficam mais fortes.<br>Inimigos: ${cnt}${nx ? ` · ${cnt < GROUP_MAX ? '+1 inimigo' : '+1 ★'} na rodada ${nx}` : ''}`;
}
function groupTip() {
  const e = run.enemy, all = [{ n: e.n, st: e.st }, ...(e.crew || [])];
  return (all.length > 1 ? `<b>Grupo de ${all.length}</b><br>${all.map(c => c.n + (c.st ? ' <span class="stars">' + starTxt(c.st) + '</span>' : '')).join('<br>')}<br>Uma barra de vida e uma mochila para todos.<br>` : '')
    + '⚔ dano/s · 🛡 bloqueio/s · ⛨ armadura · ✨ poder mágico' + (all.some(c => c.st) ? '<br><span class="stars">★</span> tier maior: mais vida e dano' : '');
}
function renderInfo() {
  const box = $('#info'); box.innerHTML = '';
  if (!sel || mode !== 'prep') { box.innerHTML = '<p class="dim">Clique num item para ver detalhes, melhorar ou vender. Arraste para arrumar a mochila.</p>'; return; }
  const { src, it } = sel;
  box.innerHTML = `<b>${itemTitle(it)}</b>${describe(it, runtimeOf(it))}`;
  const row = el('div', 'row');
  if (src === 'shop') {
    const b = el('button', 'btn small primary', `Comprar 🪙 ${price(it)}`); b.disabled = price(it) > run.gold || run.stash.length >= stashMax();
    b.onclick = () => { if (buy(it)) { run.stash.push(fromShop(it)); sel = null; save(); render(); } }; row.append(b);
  } else if (src !== 'enemy') {
    const up = el('button', 'btn small primary', it.lv > MAX_LV ? 'Lendário' : it.lv === MAX_LV ? 'Tier máx.' : `Melhorar 🪙 ${upCost(it)}`); up.disabled = it.lv >= MAX_LV || upCost(it) > run.gold;
    up.onclick = () => { run.gold -= upCost(it); it.lv++; save(); render(); toast(`${ITEMS[it.id].n} agora é T${it.lv}!`); };
    const se = el('button', 'btn small', `Vender 🪙 ${sellValue(it)}`); se.onclick = () => sell(src, it);
    row.append(up, se);
  }
  box.append(row);
}
function buy(entry) {
  const p = price(entry);
  if (p > run.gold) { toast('Ouro insuficiente'); return false; }
  run.gold -= p; entry.sold = true; return true;
}
function takeOut(src, it) { const list = src === 'pack' ? run.pack.items : run.stash, i = list.indexOf(it); if (i >= 0) list.splice(i, 1); }
function sell(src, it) { takeOut(src, it); run.gold += sellValue(it); sel = null; save(); render(); }
function rotateInPlace(it) {
  if (mode !== 'prep') return;
  if (!fits(run.pack, it, it.x, it.y, it.r ? 0 : 1, it)) return toast('Não há espaço para girar aqui');
  it.r = it.r ? 0 : 1; save(); render();
}

/* ======================= Arrastar e soltar ======================= */
let drag = null;
const cellPx = () => $('#pack').getBoundingClientRect().width / run.pack.w;
function startDrag(e, src, it) {
  if (mode !== 'prep' || e.button !== 0) return;
  e.preventDefault();
  const c = cellPx(), rc = e.currentTarget.getBoundingClientRect();
  drag = { src, it, r: it.r || 0, sx: e.clientX, sy: e.clientY, moved: false, c,
    ox: src === 'pack' ? (e.clientX - rc.left) / c : .5, oy: src === 'pack' ? (e.clientY - rc.top) / c : .5, from: e.currentTarget };
  addEventListener('pointermove', onDrag); addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
}
function ghostSize() {
  const d = ITEMS[drag.it.id], w = drag.r ? d.h : d.w, h = drag.r ? d.w : d.h, gh = drag.ghost;
  gh.style.width = w * drag.c + 'px'; gh.style.height = h * drag.c + 'px'; gh.firstChild.src = itemImg(drag.it.id, drag.r);
}
function dropTarget(x, y) {
  const inside = (r, m = 0) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
  const pr = $('#pack').getBoundingClientRect(), c = drag.c;
  const gx = Math.round((x - drag.ox * c - pr.left) / c), gy = Math.round((y - drag.oy * c - pr.top) / c);
  if (inside(pr, c / 2)) return { zone: 'pack', x: gx, y: gy, ok: fits(run.pack, drag.it, gx, gy, drag.r, drag.src === 'pack' ? drag.it : null) };
  if (inside($('#sell').getBoundingClientRect())) return { zone: 'sell' };
  if (inside($('#stash').getBoundingClientRect(), 6)) return { zone: 'stash' };
  return null;
}
function onDrag(e) {
  if (!drag) return;
  if (e.clientX != null) { drag.lx = e.clientX; drag.ly = e.clientY; }
  if (!drag.moved) {
    if (Math.hypot(drag.lx - drag.sx, drag.ly - drag.sy) < 5) return;
    drag.moved = true; hideTip();
    drag.ghost = el('div', `it ghost k-${ITEMS[drag.it.id].kind} lv${drag.it.lv}`, '<img alt="" draggable="false">'); document.body.append(drag.ghost); ghostSize();
    drag.from.classList.add('lifted');
    drag.hl = el('div', 'hl'); $('#pack').append(drag.hl);
  }
  const { ghost, hl, c } = drag;
  ghost.style.left = drag.lx - drag.ox * c + 'px'; ghost.style.top = drag.ly - drag.oy * c + 'px';
  const t = dropTarget(drag.lx, drag.ly), d = ITEMS[drag.it.id];
  hl.hidden = !(t && t.zone === 'pack');
  if (!hl.hidden) {
    hl.className = 'hl ' + (t.ok ? 'ok' : 'bad');
    hl.style.left = t.x * c + 'px'; hl.style.top = t.y * c + 'px'; hl.style.width = (drag.r ? d.h : d.w) * c + 'px'; hl.style.height = (drag.r ? d.w : d.h) * c + 'px';
  }
  $('#sell').classList.toggle('over', !!t && t.zone === 'sell' && drag.src !== 'shop');
  $('#stash').classList.toggle('over', !!t && t.zone === 'stash');
}
function rotateDrag() { if (!drag || !drag.moved) return; drag.r = drag.r ? 0 : 1; drag.ox = drag.oy = .5; ghostSize(); onDrag({}); }
function endDrag(e) {
  removeEventListener('pointermove', onDrag); removeEventListener('pointerup', endDrag); removeEventListener('pointercancel', endDrag);
  const d = drag; drag = null; if (!d) return;
  $('#sell').classList.remove('over'); $('#stash').classList.remove('over');
  if (!d.moved) { sel = sel && sel.it === d.it ? null : { src: d.src, it: d.it }; return render(); }
  d.ghost.remove(); d.hl.remove();
  drag = d; const t = e.type === 'pointercancel' ? null : dropTarget(e.clientX, e.clientY); drag = null;
  const { src, it } = d;
  if (t && t.zone === 'pack') {
    if (!t.ok) toast('Não cabe aí');
    else if (src === 'shop') { if (buy(it)) run.pack.items.push(Object.assign(fromShop(it), { x: t.x, y: t.y, r: d.r })); }
    else { if (src === 'stash') { takeOut('stash', it); run.pack.items.push(it); } Object.assign(it, { x: t.x, y: t.y, r: d.r }); }
  } else if (t && t.zone === 'stash' && src !== 'stash') {
    if (run.stash.length >= stashMax()) toast('A reserva está cheia');
    else if (src === 'shop') { if (buy(it)) run.stash.push(fromShop(it)); }
    else { takeOut('pack', it); it.r = 0; run.stash.push(it); }
  } else if (t && t.zone === 'sell' && src !== 'shop') return sell(src, it);
  if (sel && sel.src === 'shop' && sel.it.sold) sel = null;
  else if (sel && sel.it === it) sel.src = run.pack.items.includes(it) ? 'pack' : 'stash';
  save(); render();
}
addEventListener('keydown', e => {
  if (e.key !== 'r' && e.key !== 'R') return;
  if (drag && drag.moved) rotateDrag(); else if (sel && sel.src === 'pack') rotateInPlace(sel.it);
});
addEventListener('contextmenu', e => { if (drag) { e.preventDefault(); rotateDrag(); } else if (e.target.closest('#game')) e.preventDefault(); });
addEventListener('wheel', () => { if (drag && drag.moved) rotateDrag(); }, { passive: true });

/* ======================= Menu e árvore ======================= */
function renderMenu() {
  $('#m-cont').hidden = !run;
  $('#m-ess').textContent = `(💠 ${S.meta.ess})`;
  const fill = (box, rows) => { box.innerHTML = ''; rows.forEach(([t, x]) => box.append(el(t, '', x))); };
  $('#m-best').hidden = !S.best; fill($('#m-best'), [['span', 'Melhor jornada'], ['b', `🏆 Rodada ${S.best}${S.bng ? ' · ng.' + S.bng : ''}`]]);
  if (run) fill($('#m-info'), [['b', `Rodada ${run.round} · ng.${run.ng}`], ['span', `❤ ${run.lives} vida${run.lives > 1 ? 's' : ''} · 🪙 ${run.gold} de ouro`], ['span', `🎒 ${run.pack.items.length} ite${run.pack.items.length === 1 ? 'm' : 'ns'} na mochila`], ['span', `💠 ${run.ess} de essência nesta jornada`]]);
  drawMenuArt(performance.now());
}
/* Saída do menu: toca a animação (#menu.go, em style.css) e só então troca de tela */
function leaveMenu(fn) {
  const m = $('#menu'); if (m.classList.contains('go')) return;
  m.classList.add('go'); setTimeout(() => { m.classList.remove('go'); fn(); }, 520);
}
/* Cena do menu (96×36, chão nas 7 linhas de baixo): a cada 1,8 s o herói recua, investe e corta; o rei esqueleto pisca em branco e é empurrado */
function drawMenuArt(now) {
  const x = $('#menu-art').getContext('2d'), t = now % 1800 / 1800, bob = k => Math.round(Math.sin(now / 320 + k));
  const ease = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const lunge = t < .55 ? 0 : t < .64 ? -3 * ease(.55, .64) : t < .7 ? -3 + 25 * ease(.64, .7) : 22 * (1 - ease(.8, 1));   // recuo, investida, volta
  const hit = t >= .69 && t < .86 ? 1 - ease(.69, .86) : 0;                                                                // 1 no impacto, some em seguida
  x.clearRect(0, 0, 96, 36);
  x.fillStyle = '#5fae4a'; x.fillRect(3, 29, 90, 2); x.fillRect(2, 30, 92, 1);              // chão da arena: grama, borda escura e terra
  x.fillStyle = '#3e7d36'; x.fillRect(2, 31, 92, 1);
  x.fillStyle = '#6b4a33'; x.fillRect(2, 32, 92, 3); x.fillRect(4, 35, 88, 1);
  for (let i = 0; i < 26; i++) { x.fillStyle = i % 2 ? '#553827' : '#86603f'; x.fillRect(4 + i * 37 % 88, 32 + i * 5 % 3, 1, 1); }
  x.fillStyle = '#7fd062'; for (let i = 0; i < 9; i++) x.fillRect(6 + i * 53 % 84, 28, 1, 1);
  const hero = charSprite('hero'), king = charSprite('king'), hx = 9 + Math.round(lunge), kx = 59 + Math.round(hit * 3);
  x.drawImage(hero.img, hx, 1 + (lunge ? 0 : bob(0)));
  x.save(); x.translate(kx + 28, 1 + (hit ? 0 : bob(2))); x.scale(-1, 1); x.drawImage(king.img, 0, 0);
  if (hit) { x.globalAlpha = hit; x.drawImage(king.white, 0, 0); }
  x.restore();
  if (t >= .66 && t < .84) {                                  // corte: arco que varre de cima para baixo, com rastro
    const p = ease(.66, .76), cx = hx + 17, cy = 15;
    for (let a = -1.25; a <= -1.25 + 2.5 * p; a += .07) {
      const head = (a + 1.25) / (2.5 * p || 1);               // 0 = começo do rastro, 1 = ponta
      x.globalAlpha = (.25 + .75 * head) * (1 - ease(.76, .84));
      x.fillStyle = '#ffe9a8'; x.fillRect(Math.round(cx + Math.cos(a) * 14), Math.round(cy + Math.sin(a) * 12), 1, 1);
      x.fillStyle = '#fff'; x.fillRect(Math.round(cx + Math.cos(a) * 13), Math.round(cy + Math.sin(a) * 11), 1, 1);
    }
    x.globalAlpha = 1;
  }
  if (hit) {                                                  // faíscas do impacto, abrindo em leque
    const d = (1 - hit) * 9; x.globalAlpha = hit;
    [[-1, -1.1], [-.4, -1.5], [.5, -1.2], [-1.2, .2], [.8, .4], [-.3, .9]].forEach(([dx, dy], i) => { x.fillStyle = i % 2 ? '#ffd257' : '#fff'; x.fillRect(Math.round(kx + 7 + dx * d), Math.round(14 + dy * d), 1, 1); });
    x.globalAlpha = 1;
  }
}
function renderTree(center) {                          // center: rola até o meio (ao abrir a tela; não a cada compra)
  const CW = 166, RH = 104, NW = 154, NH = 86, area = $('#tree-area'), svg = $('#tree-lines');
  const xs = NODES.map(n => n.x), ys = NODES.map(n => n.y), x0 = Math.min(...xs), y0 = Math.min(...ys), W = (Math.max(...xs) - x0 + 1) * CW, H = (Math.max(...ys) - y0 + 1) * RH;
  const pos = (x, y) => [(x - x0) * CW + CW / 2, (y - y0) * RH + RH / 2];   // centro da casa (x, y)
  $('#t-ess').textContent = S.meta.ess;
  area.querySelectorAll('.node, .blabel').forEach(n => n.remove());
  area.style.width = W + 'px'; area.style.height = H + 'px';
  let lines = '';
  NODES.forEach(n => {
    const own = owned(n.id), open = !n.req || owned(n.req), [x, y] = pos(n.x, n.y);
    if (n.req) { const q = NODES.find(m => m.id === n.req), [px, py] = pos(q.x, q.y); lines += `<line x1="${px}" y1="${py}" x2="${x}" y2="${y}" class="${own ? 'own' : open ? 'open' : ''}"/>`; }
    const b = el('button', `node b-${n.br || 'c'} ` + (own ? 'own' : open ? (S.meta.ess >= n.cost ? 'can' : 'open') : 'locked'),
      `<span class="ne">${n.e}</span><b>${n.n}</b><small>${n.d}</small><i>${n.id === 'core' ? '★' : own ? '✔ ativo' : '💠 ' + n.cost}</i>`);
    b.style.left = x - NW / 2 + 'px'; b.style.top = y - NH / 2 + 'px'; b.style.width = NW + 'px'; b.style.height = NH + 'px';
    b.disabled = own || !open;
    b.onclick = () => {
      if (S.meta.ess < n.cost) return toast('Essência insuficiente');
      S.meta.ess -= n.cost; S.meta.nodes.push(n.id); save(); renderTree();
    };
    area.append(b);
  });
  [['u', 1, -1], ['r', 1, 1], ['d', -1, 1], ['l', -1, -1]].forEach(([br, gx, gy]) => {   // nome de cada ramo, nas casas vazias em volta do centro
    const [x, y] = pos(gx, gy), l = el('div', 'blabel b-' + br, `${{ u: '▲', r: '▶', d: '▼', l: '◀' }[br]} ${BRANCHES[br]}`); l.style.left = x - NW / 2 + 'px'; l.style.top = y - 14 + 'px'; l.style.width = NW + 'px'; area.append(l);
  });
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.innerHTML = lines;
  if (center) { const w = $('#tree-wrap'); w.scrollLeft = (w.scrollWidth - w.clientWidth) / 2; w.scrollTop = (w.scrollHeight - w.clientHeight) / 2; }
}

/* ======================= Ligações ======================= */
$('#m-new').onclick = () => {
  const go = () => leaveMenu(() => { newRun(); show('game'); });
  if (!run) return go();
  modal('Nova jornada?', '<p>A jornada em andamento será abandonada. A essência já ganha fica com você.</p>', [['Começar de novo', go], ['Cancelar', () => {}]]);
};
$('#m-continue').onclick = () => leaveMenu(() => show('game'));
$('#m-tree').onclick = () => show('tree');
$('#t-back').onclick = () => show('menu');
$('#g-menu').onclick = () => { if (mode === 'combat') return toast('Termine a luta primeiro'); show('menu'); };
$('#fight').onclick = () => tryFight(false);
$('#auto').onclick = () => { if (S.auto && !hold) S.auto = false; else { S.auto = true; hold = false; if (run) run.rareAck = run.shopKey; } autoT = 0; save(); renderAuto(); };   // religar = já viu o item raro desta loja
$('#hud').addEventListener('pointerdown', () => autoT = 0);   // mexer na mochila adia a luta automática
/* Dicas do HUD: qualquer elemento com data-tip mostra a explicação ao passar o mouse */
addEventListener('mouseover', e => {
  if (drag && drag.moved) return;
  const t = e.target.closest && e.target.closest('[data-tip]'); if (!t || t === tipHost || !t.dataset.tip) return;
  tipHost = t; const tp = $('#tip'); tp.innerHTML = t.dataset.tip; tp.hidden = false; moveTip(e);
});
addEventListener('mouseout', e => { if (tipHost && !tipHost.contains(e.relatedTarget)) { tipHost = null; hideTip(); } });
addEventListener('mousemove', e => { if (tipHost) moveTip(e); });
document.querySelectorAll('#speed button').forEach(b => b.onclick = () => { S.speed = +b.dataset.s; save(); render(); });
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(o => o.classList.toggle('on', o === b));
  $('#shop').hidden = b.dataset.tab !== 'shop'; $('#train').hidden = b.dataset.tab !== 'train'; fitShop();
});
new ResizeObserver(() => fitShop()).observe($('#shop'));

renderMenu();
requestAnimationFrame(frame);

/* Modo de demonstração (para testar telas): ?demo=prep, ?demo=combat, ?demo=end ou ?demo=tree. Não grava nada. */
const DEMO = new URLSearchParams(location.search).get('demo');
if (DEMO) {
  save = () => {};
  S.meta = { ess: 14, nodes: ['vit1', 'pack1', 'str1'] };
  const Q = new URLSearchParams(location.search);   // &round=N&ng=M: abre nessa rodada e NG
  newRun(+Q.get('ng') || 0); run.round = +Q.get('round') || 7; run.gold = 40; run.train.mag = 1;
  run.pack.items = [['whet', 1, 0, 0], ['sword', 2, 1, 0], ['wshield', 1, 2, 0], ['dagger', 1, 4, 0], ['venom', 1, 5, 0], ['helmet', 3, 4, 2], ['potion', 1, 0, 1], ['spear', 1, 0, 3, 1]]
    .map(([id, lv, x, y, r]) => Object.assign(newItem(id, lv), { x, y, r: r || 0 }));
  run.stash = [newItem('axe'), newItem('ring'), newItem('ishield', 2), newItem('staff'), Object.assign(newItem('sword', LEG), { p: 0 })];
  setupRound();
  if (DEMO === 'tree') show('tree'); else { show('game'); if (DEMO === 'combat' || DEMO === 'end') { startCombat(); if (DEMO === 'end') { while (!cb.over) step(STEP); updateCombatUI(); finishCombat(); } } }
}
