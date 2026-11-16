/* Adventure: dados do jogo (equilíbrio). Os mapas ficam em regions.js e são editados pelo modo dev (#dev).
   Tempo em segundos, distância em pixels do mundo (TILE px por quadrado), ângulos em radianos. */

const TILE = 16;

// Ladrilhos: s = sólido (bloqueia passagem), c = cor base. O desenho de cada um fica em render.js.
const TILES = {
  '.': { n: 'Grama', c: '#5f9e48' },
  ',': { n: 'Grama alta', c: '#578f42' },
  '=': { n: 'Trilha', c: '#b09060' },
  's': { n: 'Areia', c: '#d8c48a' },
  '_': { n: 'Pedra (praça)', c: '#9a9488' },
  'b': { n: 'Ponte', c: '#8a6038' },
  'o': { n: 'Piso da cripta', c: '#4a4652' },
  'T': { n: 'Árvore', c: '#2f6a34', s: 1 },
  '~': { n: 'Água', c: '#3d78b8', s: 1 },
  '#': { n: 'Rocha', c: '#7a7670', s: 1 },
  'W': { n: 'Muralha', c: '#8c8478', s: 1 },
  'R': { n: 'Telhado', c: '#a5452f', s: 1 },
  'H': { n: 'Parede de casa', c: '#d6c3a0', s: 1 },
  'd': { n: 'Porta', c: '#6b4426', s: 1 },
  'f': { n: 'Cerca', c: '#8a6a40', s: 1 },
  'x': { n: 'Parede da cripta', c: '#2a2630', s: 1 },
  'l': { n: 'Tocha', c: '#2a2630', s: 1 },
  'p': { n: 'Pilar', c: '#6a6474', s: 1 },
  'C': { n: 'Entrada de caverna', c: '#1a1418' },
  'm': { n: 'Lama', c: '#5a5032' },
  'j': { n: 'Junco', c: '#4f6a3a' },
  'v': { n: 'Água do pântano', c: '#3f5a40', s: 1 },
  'n': { n: 'Neve', c: '#e8eef4' },
  'i': { n: 'Gelo', c: '#bcd8ec' },
  'P': { n: 'Pinheiro nevado', c: '#2f5a44', s: 1 },
  'u': { n: 'Chão de caverna', c: '#5a4c44' },
  'k': { n: 'Parede de caverna', c: '#3a302c', s: 1 },
  'L': { n: 'Lava', c: '#d0501a', s: 1 },
  'Q': { n: 'Cogumelo gigante', c: '#7a3a5a', s: 1 },
  'D': { n: 'Duna', c: '#e0c080' },
  'K': { n: 'Cacto', c: '#4a8a3a', s: 1 },
  'Z': { n: 'Lápide', c: '#8a8a90', s: 1 },
  'F': { n: 'Flores', c: '#5f9e48' },
};
// Biomas: dão o clima, a escuridão e a transição padrão dos portais, e o modelo de mapa novo no editor.
const BIOMES = {
  vila:     { n: 'Vila', trans: 'vila', weather: '', dark: 0 },
  campo:    { n: 'Campo', trans: 'fade', weather: '', dark: 0 },
  floresta: { n: 'Floresta', trans: 'floresta', weather: 'folhas', dark: .15 },
  pantano:  { n: 'Pântano', trans: 'pantano', weather: 'nevoa', dark: .15 },
  cripta:   { n: 'Cripta', trans: 'cripta', weather: '', dark: .88 },
  caverna:  { n: 'Caverna', trans: 'caverna', weather: '', dark: .75 },
  deserto:  { n: 'Deserto', trans: 'deserto', weather: '', dark: 0 },
  neve:     { n: 'Neve', trans: 'neve', weather: 'neve', dark: 0 },
  vulcao:   { n: 'Vulcão', trans: 'fogo', weather: 'cinzas', dark: .35 },
};
const WEATHERS = { '': 'Nenhum', chuva: 'Chuva', neve: 'Neve', nevoa: 'Névoa', folhas: 'Folhas', vagalumes: 'Vaga-lumes', cinzas: 'Cinzas' };
// Transições dos portais (desenhadas em transition.js). 'auto' usa a do bioma de destino.
const TRANSITIONS = { auto: 'Automática (bioma)', fade: 'Escurecer', vila: 'Portões da vila', floresta: 'Folhas', pantano: 'Névoa do pântano', cripta: 'Caveira', caverna: 'Túnel', neve: 'Nevasca', deserto: 'Tempestade de areia', fogo: 'Chamas', magia: 'Redemoinho mágico' };
// Bioma de uma região (regiões antigas sem "bio" deduzem pelo tipo).
const bioOf = reg => reg.bio || (reg.kind === 'cidade' ? 'vila' : reg.kind === 'masmorra' ? 'cripta' : 'campo');

// Atributos. Base de STAT_MIN a STAT_MAX (subir o teto depois é só mudar STAT_MAX); itens somam por cima e podem passar do teto.
// FOR: dano de espada e soco, Giro · INT: mana, regeneração, cajado e magia · DES: dano de adaga e arco, velocidade de ataque e de passo
// CON: vida · SOR: crítico e chance de saque. Cada nível dá POINTS_PER_LVL pontos; tirar ponto de um atributo devolve o ponto.
const STATS = { for: 'Força', int: 'Inteligência', des: 'Destreza', con: 'Constituição', sor: 'Sorte' };
const STAT_SHORT = { for: 'FOR', int: 'INT', des: 'DES', con: 'CON', sor: 'SOR' };
const STAT_MIN = 3, STAT_MAX = 10, POINTS_PER_LVL = 2;
const DERIVED = {
  hp: (s, l) => 50 + s.con * 14 + (l - 1) * 6,
  mp: (s, l) => 15 + s.int * 7 + (l - 1) * 3,
  regen: s => 1 + s.int * .25,                  // mana por segundo
  spd: s => 68 + s.des * 1.5,                   // passo
  cdMul: s => Math.max(.7, 1 - (s.des - 3) * .02),  // recarga dos ataques
  crit: s => .03 + s.sor * .015,
  luck: s => 1 + (s.sor - 3) * .08,             // multiplica a chance de cada saque
};

// Classes: atributos iniciais, arma inicial e habilidade (botão direito, gasta mana). Qualquer classe usa qualquer arma.
// Dano da habilidade = base + atributo × k + nível. Tipos: spin (giro em volta), proj (projétil), fan (leque de qty projéteis).
const CLASSES = {
  guerreiro: { n: 'Guerreiro', e: '🗡️', st: { for: 8, int: 3, des: 4, con: 5, sor: 3 }, arma: 'espada0',
    b: { n: 'Giro', k: 'spin', cd: 3, mp: 12, range: 36, stat: 'for', base: 10, mult: 1.8 } },
  mago: { n: 'Mago', e: '🔮', st: { for: 3, int: 10, des: 4, con: 3, sor: 3 }, arma: 'cajado0',
    b: { n: 'Bola de fogo', k: 'proj', cd: 1.4, mp: 14, spd: 170, life: 1.2, aoe: 32, pk: 'fogo', stat: 'int', base: 12, mult: 2.4 } },
  ladino: { n: 'Ladino', e: '🗝️', st: { for: 3, int: 4, des: 10, con: 3, sor: 3 }, arma: 'adaga0',
    b: { n: 'Leque de facas', k: 'fan', cd: 2.4, mp: 12, spd: 300, life: .5, pk: 'faca', qty: 5, spread: .55, stat: 'des', base: 3, mult: .9 } },
};
// Tipos de arma: o ataque básico (botão esquerdo). arc = corte em leque; proj = projétil. Dano = dano da arma + atributo × k + nível/2.
const WTYPES = {
  punho:  { n: 'Soco', k: 'arc', cd: .45, range: 16, arc: 1.2, stat: 'for', mult: 1, dmg: 2 },
  espada: { n: 'Corte', k: 'arc', cd: .45, range: 26, arc: 1.3, stat: 'for', mult: 1.2 },
  adaga:  { n: 'Estocada', k: 'arc', cd: .3, range: 20, arc: .9, stat: 'des', mult: .9 },
  arco:   { n: 'Flecha', k: 'proj', cd: .42, spd: 320, life: .7, pk: 'flecha', pierce: 1, stat: 'des', mult: 1 },
  cajado: { n: 'Faísca', k: 'proj', cd: .42, spd: 230, life: .8, pk: 'faisca', stat: 'int', mult: 1.1 },
};
const ROLL = { cd: 1.1, t: .2, mult: 3.2 };      // esquiva (espaço): duração e velocidade; o herói não leva dano rolando
const LEVEL = { xp: l => Math.round(60 * Math.pow(l, 1.55)) };   // XP para passar do nível l
const DEATH_GOLD = .1, RESPAWN = 4;              // perde 10% do ouro ao morrer; renasce na vila depois de 4 s

// Itens. p = preço de compra (vende pela metade). slot: arma (wt = tipo, dmg), armadura (hp), joia. bonus = atributos somados.
const ITEMS = {
  pocao:  { n: 'Poção de vida', e: '❤️', p: 15, use: { hp: 60 } },
  eter:   { n: 'Poção de mana', e: '💧', p: 15, use: { mp: 50 } },
  geleia: { n: 'Geleia', e: '🟢', p: 4 },
  presa:  { n: 'Presa de lobo', e: '🦷', p: 10 },
  trapo:  { n: 'Trapo goblin', e: '🧣', p: 8 },
  osso:   { n: 'Osso antigo', e: '🦴', p: 16 },
  coroa:  { n: 'Coroa partida', e: '👑', p: 200 },
  espada0: { n: 'Espada curta', e: '🗡️', p: 30, slot: 'arma', wt: 'espada', dmg: 5 },
  espada1: { n: 'Espada de ferro', e: '🗡️', p: 90, slot: 'arma', wt: 'espada', dmg: 10 },
  espada2: { n: 'Espada de aço', e: '🗡️', p: 240, slot: 'arma', wt: 'espada', dmg: 17 },
  espada3: { n: 'Lâmina do rei', e: '🗡️', p: 600, slot: 'arma', wt: 'espada', dmg: 26, bonus: { for: 2 } },
  adaga0:  { n: 'Adaga', e: '🔪', p: 30, slot: 'arma', wt: 'adaga', dmg: 4 },
  adaga1:  { n: 'Adaga afiada', e: '🔪', p: 90, slot: 'arma', wt: 'adaga', dmg: 8 },
  adaga2:  { n: 'Punhal de aço', e: '🔪', p: 240, slot: 'arma', wt: 'adaga', dmg: 14 },
  adaga3:  { n: 'Presa do rei', e: '🔪', p: 600, slot: 'arma', wt: 'adaga', dmg: 21, bonus: { des: 2 } },
  arco1:   { n: 'Arco curto', e: '🏹', p: 90, slot: 'arma', wt: 'arco', dmg: 9 },
  arco2:   { n: 'Arco longo', e: '🏹', p: 240, slot: 'arma', wt: 'arco', dmg: 16 },
  cajado0: { n: 'Cajado de galho', e: '🪄', p: 30, slot: 'arma', wt: 'cajado', dmg: 5 },
  cajado1: { n: 'Cajado de carvalho', e: '🪄', p: 90, slot: 'arma', wt: 'cajado', dmg: 10 },
  cajado2: { n: 'Cajado rúnico', e: '🪄', p: 240, slot: 'arma', wt: 'cajado', dmg: 17 },
  cajado3: { n: 'Cetro do rei', e: '🪄', p: 600, slot: 'arma', wt: 'cajado', dmg: 26, bonus: { int: 2 } },
  arm1:   { n: 'Gibão de couro', e: '🦺', p: 60, slot: 'armadura', hp: 20, bonus: { con: 1 } },
  arm2:   { n: 'Cota de malha', e: '🛡️', p: 200, slot: 'armadura', hp: 40, bonus: { con: 2 } },
  anel_for: { n: 'Anel do touro', e: '💍', p: 150, slot: 'joia', bonus: { for: 2 } },
  anel_int: { n: 'Anel da coruja', e: '💍', p: 150, slot: 'joia', bonus: { int: 2 } },
  anel_des: { n: 'Anel da raposa', e: '💍', p: 150, slot: 'joia', bonus: { des: 2 } },
  trevo:    { n: 'Trevo de quatro folhas', e: '🍀', p: 150, slot: 'joia', bonus: { sor: 2 } },
};
const SLOTS = { arma: '⚔️', armadura: '🛡️', joia: '💍' };
const itemName = id => ITEMS[id].n;

// Monstros. r = raio, aggro = distância em que nota o herói, leash = quanto se afasta de casa,
// range = alcance do ataque, wind = preparo antes do golpe, drops = [item, chance].
// lvl = nível de referência; uma área de monstros com nível maior deixa o bicho mais forte (MOB_LVL por nível de diferença).
// look = aparência de outro monstro, tint = cor principal, size = escala: usados pelos monstros criados no editor.
const MOBS = {
  geleia: { lvl: 1, n: 'Geleia', hp: 34, dmg: 7, spd: 34, r: 6, aggro: 70, range: 12, wind: .4, cd: 1.1, xp: 9, gold: [1, 4], drops: [['geleia', .6]] },
  lobo:   { lvl: 2, n: 'Lobo', hp: 60, dmg: 11, spd: 74, r: 7, aggro: 110, range: 14, wind: .3, cd: 1, xp: 17, gold: [2, 6], drops: [['presa', .5]] },
  goblin: { lvl: 3, n: 'Goblin', hp: 80, dmg: 13, spd: 52, r: 7, aggro: 100, range: 14, wind: .35, cd: 1, xp: 24, gold: [4, 10], drops: [['trapo', .45], ['pocao', .08]], fam: 'goblin' },
  arqueiro_g: { lvl: 3, n: 'Goblin arqueiro', hp: 55, dmg: 10, spd: 44, r: 7, aggro: 140, range: 120, wind: .55, cd: 1.6, xp: 26, gold: [4, 10], drops: [['trapo', .45], ['eter', .08]], fam: 'goblin', shot: { spd: 150, pk: 'flecha_m' }, keep: 70 },
  esqueleto: { lvl: 5, n: 'Esqueleto', hp: 130, dmg: 17, spd: 46, r: 7, aggro: 110, range: 15, wind: .4, cd: 1.1, xp: 42, gold: [8, 16], drops: [['osso', .55], ['pocao', .1]] },
  rei: { lvl: 7, n: 'Rei Ossudo', hp: 1400, dmg: 24, spd: 40, r: 12, aggro: 150, range: 24, wind: .6, cd: 1.4, xp: 500, gold: [140, 180], drops: [['coroa', 1], ['espada2', .1], ['adaga2', .1], ['arco2', .1], ['cajado2', .1]], boss: 1, leash: 400, respawn: 150 },
};
const MOB_RESPAWN = 14, LEASH = 220, PARTY_HP = .6;   // +60% de vida por jogador a mais na região
const MOB_LVL = { hp: .22, dmg: .12, xp: .25, gold: .2 };   // por nível acima (ou abaixo) do nível de referência

// Personagens da vila. Ganham posição no mapa pelo modo dev (cada região guarda os seus).
const NPCS = {
  mercadora: { n: 'Lia, a mercadora', look: 'mercadora', talk: 'Poções fresquinhas! E compro o que você trouxer do mato.', shop: ['pocao', 'eter', 'anel_for', 'anel_int', 'anel_des', 'trevo'], buys: 1, quests: ['presas'] },
  ferreiro:  { n: 'Bruno, o ferreiro', look: 'ferreiro', talk: 'Aço bom não é barato.', shop: ['espada1', 'espada2', 'adaga1', 'adaga2', 'arco1', 'arco2', 'cajado1', 'cajado2', 'arm1', 'arm2'], buys: 1 },
  capita:    { n: 'Capitã Rosa', look: 'capita', talk: 'A guarda não dá conta de tudo. Ajuda?', quests: ['geleias', 'goblins'] },
  ancia:     { n: 'Anciã Ivete', look: 'ancia', talk: 'Venha, deixe-me cuidar dessas feridas.', heal: 1, quests: ['cripta'] },
  aldeao:    { n: 'Aldeão', look: 'aldeao', talk: 'Dizem que algo se mexe na cripta do bosque…' },
};

// Missões. kill = derrotar (mob ou família), fetch = entregar itens. req = missão anterior concluída.
// reward.weapon = nível da arma dada, do tipo da arma inicial da classe (ex.: 3 → espada3 para o guerreiro).
const QUESTS = {
  geleias: { n: 'Praga na horta', giver: 'capita', kind: 'kill', target: 'geleia', count: 6, d: 'Derrote 6 geleias nos Campos do Leste.', reward: { gold: 40, xp: 60, items: { pocao: 2 } } },
  presas:  { n: 'Presas para o mercado', giver: 'mercadora', kind: 'fetch', target: 'presa', count: 4, d: 'Traga 4 presas de lobo.', reward: { gold: 70, xp: 80, items: { eter: 2 } } },
  goblins: { n: 'Goblins no bosque', giver: 'capita', kind: 'kill', target: 'goblin', count: 8, req: 'geleias', d: 'Derrote 8 goblins no Bosque Sombrio.', reward: { gold: 120, xp: 180, items: { arm1: 1 } } },
  cripta:  { n: 'O rei da cripta', giver: 'ancia', kind: 'kill', target: 'rei', count: 1, req: 'goblins', d: 'Derrote o Rei Ossudo na cripta do bosque.', reward: { gold: 300, xp: 600, weapon: 3 } },
};
