/* Grand Chronicle — conteúdo: unidades, veterania, apoio e posturas.
   Arquivo de dados editável: cada bloco "CONTENT.NOME = ...;" é JSON5 (comentários, chaves sem aspas, aspas simples, vírgula no fim).
   Só dados: nada de código. O jogo lê ao abrir a página; para valer num save, salve o arquivo e recarregue. */

/* ---------- unidades: nomes por época (o mais recente já pesquisado vale) ---------- */
CONTENT.UNITS = {
  inf: [['mil_levy', 'Lanceiros'], ['mil_crossbow', 'Besteiros'], ['mil_pike', 'Piqueiros'], ['mil_arquebus', 'Arcabuzeiros'], ['mil_musket', 'Mosqueteiros'], ['mil_bayonet', 'Infantaria de linha'], ['mil_rifle', 'Fuzileiros'], ['mil_machinegun', 'Infantaria moderna'], ['mil_blitz', 'Infantaria mecanizada'], ['mil_drones', 'Infantaria em rede'], ['mil_exo', 'Exossoldados'], ['mil_swarm', 'Legiões autônomas']],
  cav: [['mil_levy', 'Cavaleiros leves'], ['mil_stirrup', 'Cavaleiros'], ['mil_plate', 'Cavaleiros de placas'], ['mil_musket', 'Dragões'], ['mil_bayonet', 'Couraceiros'], ['mil_tank', 'Tanques'], ['mil_blitz', 'Divisões blindadas'], ['mil_stealth', 'Blindados modernos'], ['mil_exo', 'Mechas'], ['mil_swarm', 'Enxames blindados']],
  art: [['mil_trebuchet', 'Máquinas de cerco'], ['mil_bombard', 'Bombardas'], ['mil_bastion', 'Canhões'], ['mil_fieldart', 'Artilharia de campanha'], ['mil_breech', 'Artilharia raiada'], ['mil_trench', 'Artilharia pesada'], ['mil_missile', 'Baterias de mísseis'], ['mil_railgun', 'Canhões eletromagnéticos'], ['mil_orbital', 'Plataformas orbitais']],
};

/* atributos por regimento (1k homens): fire/shock = dano nas fases de fogo e choque; def = resistência; mor = moral; kill = letalidade;
   spd = movimento; sw = peso no suprimento; back = luta da segunda linha (com metade do dano); a/d = força resumida (IA e listas); c = custo */
CONTENT.UNIT_BASE = {
  inf: { a: 1, d: 1.1, c: 8, fire: .6, shock: 1.2, def: 1.1, mor: 1, kill: 1, spd: 1, sw: 1 },
  cav: { a: 1.6, d: .9, c: 16, fire: .4, shock: 2.2, def: .9, mor: 1.1, kill: 1, spd: 1.5, sw: 2 },
  art: { a: 1.4, d: .5, c: 20, fire: 2.2, shock: .4, def: .6, mor: .8, kill: 1.6, spd: .8, sw: 1.5, back: 1 },
  vrt: { a: 2.4, d: 2, c: 40, fire: 2, shock: 2, def: 2, mor: 1.2, kill: 1.3, spd: 1.1, sw: 1.5 },
};

/* mudanças de papel com a tecnologia (a última pesquisada vale): pólvora faz a infantaria atirar, tanques blindam a cavalaria */
CONTENT.UNIT_ERA = {
  inf: [['mil_arquebus', { fire: 1.2, shock: .9 }], ['mil_machinegun', { fire: 1.8, shock: .8 }]],
  cav: [['mil_musket', { fire: .7, shock: 1.9 }], ['mil_tank', { fire: 1.6, shock: 2.4, def: 1.4, spd: 1.8 }]],
  art: [['mil_breech', { fire: 2.6, kill: 1.8 }]],
};

/* necessidades por regimento por mês (a última faixa de tecnologia vale); a vertente usa o próprio bem */
CONTENT.UNIT_NEEDS = {
  inf: [[null, { arms: .025, grain: .02, clothes: .01 }], ['mil_crossbow', { arms: .04, grain: .02, clothes: .015 }], ['mil_musket', { arms: .05, grain: .02, clothes: .02 }], ['mil_rifle', { arms: .06, pfood: .02, clothes: .02 }], ['mil_drones', { arms: .06, pfood: .02, clothes: .02, elec: .01 }]],
  cav: [[null, { arms: .03, grain: .04, horses: .02 }], ['mil_plate', { arms: .05, grain: .04, horses: .02, iron: .01 }], ['mil_tank', { arms: .04, oil: .15, steel: .03, tools: .01 }], ['mil_stealth', { arms: .04, oil: .15, steel: .03, elec: .02 }]],
  art: [[null, { arms: .03, wood: .03, tools: .01 }], ['mil_gunpowder', { arms: .06, iron: .02, tools: .01 }], ['mil_breech', { arms: .07, steel: .03, tools: .01 }], ['mil_missile', { arms: .06, steel: .02, elec: .03 }], ['mil_railgun', { arms: .05, power: .05, elec: .03 }]],
  vrt: [[null, { arms: .03, pfood: .01 }]],
};

CONTENT.VERT_UNIT_NEED = { atom: { uranium: .02 }, steam: { coal: .03 }, diesel: { oil: .05 }, tesla: { copper: .02 }, clock: { tools: .02 }, cyber: { elec: .03 }, nano: { rare: .01 }, space: { power: .03 }, solar: {}, bio: { pfood: .02 } };

/* veterania: xp de 0 a 1 */
CONTENT.VET = [
  { n: 'Recruta', x: 0, m: .85, mo: .85 }, { n: 'Regular', x: .2, m: 1, mo: 1 }, { n: 'Veterano', x: .45, m: 1.1, mo: 1.1 },
  { n: 'Experiente', x: .7, m: 1.2, mo: 1.2 }, { n: 'Elite', x: .9, m: 1.3, mo: 1.3 },
];

/* companhias de apoio (uma de cada por exército) */
CONTENT.SUPPORT = {
  recon: { e: '🔭', names: [[null, 'Batedores'], ['mil_aircraft', 'Reconhecimento aéreo'], ['mil_drones', 'Drones de reconhecimento']], c: 15, up: 1, need: { horses: .01 },
           d: '+1 no dado contra quem não tem reconhecimento · perseguição +30% · atrito −10%' },
  eng:   { e: '⛏️', tech: 'mil_trebuchet', names: [[null, 'Sapadores'], ['mil_trench', 'Engenheiros de combate']], c: 25, up: 1.5, need: { tools: .02 },
           d: 'Cercos +40% · na defesa, baixas −10% · metade da penalidade de terreno e de desembarque · atrito −10%' },
  med:   { e: '⚕️', tech: 'mil_surgeons', names: [[null, 'Cirurgiões'], ['soc_germ', 'Hospital de campanha'], ['soc_antibiotics', 'Batalhão médico']], c: 25, up: 1.5, need: { meds: .03 },
           d: 'Baixas −25% (um quarto dos feridos volta ao contingente) · atrito −30% · doenças −50%' },
};

/* posturas de combate: def vence agg, agg vence pur, pur vence def (+15% de dano para quem vence) */
/* posturas de combate e de automação: agressiva vai ao front mais próximo e ataca; defensiva segura a linha e abate quem avançou;
   equilibrada segue a ordem do front. Ciclo: defensiva vence agressiva, agressiva vence equilibrada, equilibrada vence defensiva (+15% de dano) */
CONTENT.STANCES = {
  bal: { n: 'Equilibrada', e: '⚖️', dmg: 1, take: 1, mor: 1, fat: 1, beats: 'def', d: 'Segue a ordem do front (defender ou avançar). Sem bônus nem penalidade' },
  agg: { n: 'Ataque agressivo', e: '⚔️', dmg: 1.2, take: 1.15, mor: 1.1, fat: 1.3, beats: 'bal', act: 'adv', d: 'Vai ao front mais próximo e ataca. Dano +20%, moral do inimigo cai 10% mais rápido; baixas próprias +15% e cansa mais' },
  def: { n: 'Defensiva', e: '🛡️', dmg: .85, take: .8, mor: 1, fat: .8, beats: 'agg', act: 'hold', d: 'Segura a linha e vai abater tropas inimigas que avançaram. Baixas −20%, cansa menos; dano −15%' },
};

CONTENT.PURSUIT = { mul: 2, cav: .1 };// bônus de perseguição (evento de treino): perseguição ×2 e choque da cavalaria +10%, por 1–2 anos

CONTENT.SHIPS = [['nav_longship', 'Barcos longos'], ['nav_knarr', 'Knarrs'], ['nav_cog', 'Cocas'], ['nav_caravel', 'Caravelas'], ['nav_galleon', 'Galeões'], ['nav_lineship', 'Naus de linha'], ['nav_steamship', 'Vapores'], ['nav_ironclad', 'Encouraçados'], ['nav_dreadnought', 'Dreadnoughts'], ['nav_carrier', 'Porta-aviões'], ['nav_nuclearsub', 'Submarinos nucleares'], ['nav_aegis', 'Destróieres de mísseis'], ['nav_autonomous', 'Frotas autônomas'], ['nav_orbit', 'Naves orbitais']];

/* doutrinas navais (uma por país, troca no máximo uma vez por ano). dmg = dano dado · take = dano recebido · ret = recua quando a força cai abaixo desta fração da inimiga
   cargo = parte das baixas que as tropas embarcadas sofrem quando a frota perde navios (1 = todas) */
CONTENT.NAV_DOCS = {
  line:   { n: 'Linha de batalha', e: '⚓', dmg: 1.15, take: 1, ret: .5, cargo: 1, d: 'Esquadras em linha, todo o fogo junto: mais dano nas batalhas. Bom para disputar o mar.' },
  escort: { n: 'Escolta de comboios', e: '🛡️', dmg: .9, take: .85, ret: .6, cargo: .5, d: 'Navios protegendo os transportes: perde menos navios e as tropas embarcadas sofrem metade das perdas. Recua cedo. Bom para invasões.' },
  raid:   { n: 'Guerra de corso', e: '🏴‍☠️', dmg: 1.25, take: 1.2, ret: .3, cargo: 1, d: 'Ataques rápidos e ousados: muito dano, mas perde mais navios e só recua quando quase destruída.' },
};

/* nomes da doutrina conforme a vertente do país (sem vertente valem os nomes comuns): escola = nome da doutrina do exército · frota = da marinha
   recon/eng/med = companhias de apoio · bal/agg/def = posturas · line/escort/raid = doutrinas navais */
CONTENT.VERT_DOC = {
  clock:  { escola: 'Doutrina da Cadência', frota: 'Esquadra de Engrenagens', recon: 'Vigias de corda', eng: 'Mestres-relojoeiros de cerco', med: 'Cirurgiões de precisão', bal: 'Cadência regular', agg: 'Avanço de mola', def: 'Muralha de engrenagens', line: 'Salvas cronometradas', escort: 'Comboio de relojoaria', raid: 'Corsários de mola' },
  steam:  { escola: 'Doutrina da Pressão', frota: 'Armada a Vapor', recon: 'Batedores a vapor', eng: 'Engenheiros de caldeira', med: 'Hospitais de vapor', bal: 'Pressão constante', agg: 'Carga a todo vapor', def: 'Trincheiras aquecidas', line: 'Linha de couraçados', escort: 'Comboios de carvoeiros', raid: 'Corsários de fumaça' },
  tesla:  { escola: 'Doutrina da Corrente', frota: 'Frota Elétrica', recon: 'Rádio de campanha', eng: 'Sapadores de bobina', med: 'Galvanoterapia', bal: 'Corrente alternada', agg: 'Descarga de arco', def: 'Campo de força', line: 'Bateria de raios', escort: 'Escudo galvânico', raid: 'Torpedos elétricos' },
  diesel: { escola: 'Doutrina Motorizada', frota: 'Frota de Motores', recon: 'Motociclistas', eng: 'Pioneiros mecanizados', med: 'Ambulâncias blindadas', bal: 'Coluna motorizada', agg: 'Investida de blindados', def: 'Linha de casamatas', line: 'Grupo de batalha', escort: 'Comboio protegido', raid: 'Matilha de submarinos' },
  atom:   { escola: 'Doutrina Atômica', frota: 'Frota Nuclear', recon: 'Contadores Geiger', eng: 'Engenheiros de reator', med: 'Descontaminação', bal: 'Dissuasão', agg: 'Ataque de saturação', def: 'Abrigo blindado', line: 'Esquadra de reatores', escort: 'Guarda-costas nucleares', raid: 'Submarinos de ataque' },
  bio:    { escola: 'Doutrina Orgânica', frota: 'Cardume', recon: 'Insetos batedores', eng: 'Escavadores vivos', med: 'Regeneração', bal: 'Simbiose', agg: 'Enxame', def: 'Carapaça', line: 'Leviatãs', escort: 'Cardume protetor', raid: 'Predadores do fundo' },
  cyber:  { escola: 'Doutrina em Rede', frota: 'Frota Conectada', recon: 'Drones de vigilância', eng: 'Hackers de campo', med: 'Nanomédicos', bal: 'Sincronia', agg: 'Ataque relâmpago', def: 'Firewall', line: 'Rede de mísseis', escort: 'Escolta autônoma', raid: 'Enxame de drones navais' },
  solar:  { escola: 'Doutrina Solar', frota: 'Frota Luminosa', recon: 'Espelhos de sinal', eng: 'Construtores verdes', med: 'Clínicas solares', bal: 'Equilíbrio', agg: 'Ofensiva radiante', def: 'Escudo de painéis', line: 'Lanças de luz', escort: 'Comboio solar', raid: 'Velas de ataque' },
  nano:   { escola: 'Doutrina Nanométrica', frota: 'Frota de Nanites', recon: 'Poeira espiã', eng: 'Nanoconstrutores', med: 'Reparo celular', bal: 'Enxame estável', agg: 'Dissolução', def: 'Malha autorreparável', line: 'Nuvem de ataque', escort: 'Casco vivo', raid: 'Corrosores' },
  space:  { escola: 'Doutrina Orbital', frota: 'Frota Estelar', recon: 'Satélites de reconhecimento', eng: 'Engenheiros orbitais', med: 'Módulos médicos', bal: 'Órbita estável', agg: 'Queda orbital', def: 'Escudo de defletores', line: 'Bombardeio orbital', escort: 'Escolta de transporte', raid: 'Caças de interceptação' },
};

