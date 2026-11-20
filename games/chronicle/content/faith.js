/* Grand Chronicle — conteúdo: religiões, doutrinas e reformas.
   Arquivo de dados editável: cada bloco "CONTENT.NOME = ...;" é JSON5 (comentários, chaves sem aspas, aspas simples, vírgula no fim).
   Só dados: nada de código. O jogo lê ao abrir a página; para valer num save, salve o arquivo e recarregue. */

/* ---------- religiões (todas fictícias) ----------
   A lista é fixa; a cada partida (pela seed) cada fé sorteia família, doutrina, chefe religioso e nome da guerra santa (rollFaiths).
   fict = heresia (surge no jogo: Aurora a partir de 1450, Máquina na era industrial, Serpente em bolsões). */
CONTENT.RELIGIONS = {
  aurora: { n: 'Culto da Aurora', e: '🌅', col: '#d87777', fict: 1 },
  machine: { n: 'Igreja da Máquina', e: '⚙️', col: '#7793d8', fict: 1 },
  serpent: { n: 'Irmandade da Serpente', e: '🐍', col: '#b0d877', fict: 1 },
  veiledsun: { n: 'Culto do Sol Velado', e: '🌞', col: '#d877cc' },
  firstfire: { n: 'Igreja do Primeiro Fogo', e: '🔥', col: '#77d8c8' },
  sevenmoons: { n: 'Fé das Sete Luas', e: '🌙', col: '#d8ab77' },
  void: { n: 'Caminho do Vazio Sereno', e: '🌑', col: '#8f77d8' },
  openeye: { n: 'Ordem do Olho Aberto', e: '👁️', col: '#7bd877' },
  tides: { n: 'Culto das Marés', e: '🌊', col: '#d87797' },
  stoneanc: { n: 'Fé dos Antepassados de Pedra', e: '🗿', col: '#77b4d8' },
  crown: { n: 'Igreja da Coroa Celeste', e: '👑', col: '#d0d877' },
  whitewolf: { n: 'Senda do Lobo Branco', e: '🐺', col: '#c477d8' },
  mothertree: { n: 'Culto da Árvore-Mãe', e: '🌳', col: '#77d8a7' },
  thunder: { n: 'Fé do Trovão Eterno', e: '⚡', col: '#d88b77' },
  mirrors: { n: 'Escola dos Mil Espelhos', e: '🪞', col: '#777fd8' },
  blackfire: { n: 'Culto do Fogo Negro', e: '🖤', col: '#9bd877' },
  guidestar: { n: 'Igreja da Estrela Guia', e: '⭐', col: '#d877b8' },
  river: { n: 'Caminho do Rio Sagrado', e: '🏞️', col: '#77d4d8' },
  redmoon: { n: 'Culto da Lua Vermelha', e: '🔴', col: '#d8c077' },
  winds: { n: 'Fé dos Quatro Ventos', e: '🌬️', col: '#a377d8' },
  hammer: { n: 'Ordem do Martelo', e: '🔨', col: '#77d887' },
  sleep: { n: 'Culto do Sono Eterno', e: '💤', col: '#d87783' },
  mountain: { n: 'Fé da Montanha Viva', e: '⛰️', col: '#77a0d8' },
  sealed: { n: 'Igreja do Verbo Selado', e: '📜', col: '#bcd877' },
  bees: { n: 'Culto das Abelhas Douradas', e: '🐝', col: '#d877d8' },
  stag: { n: 'Fé do Cervo Alado', e: '🦌', col: '#77d8bb' },
  ninefl: { n: 'Senda das Nove Chamas', e: '🕯️', col: '#d89f77' },
  brokensky: { n: 'Culto do Céu Partido', e: '🌩️', col: '#8377d8' },
  twins: { n: 'Fé dos Gêmeos', e: '♊', col: '#87d877' },
  salt: { n: 'Igreja do Sal', e: '🧂', col: '#d877a4' },
  silence: { n: 'Caminho do Silêncio', e: '🤫', col: '#77c0d8' },
  phoenix: { n: 'Culto da Fênix', e: '🐦‍🔥', col: '#d8d477' },
  iron: { n: 'Fé do Ferro', e: '⛓️', col: '#b777d8' },
  scales: { n: 'Ordem da Balança', e: '⚖️', col: '#77d89b' },
  fish: { n: 'Culto do Grande Peixe', e: '🐟', col: '#d87e77' },
  sands: { n: 'Fé das Areias Eternas', e: '🏜️', col: '#778bd8' },
  lamp: { n: 'Igreja da Lâmpada', e: '🪔', col: '#a8d877' },
  raven: { n: 'Culto do Corvo', e: '🐦‍⬛', col: '#d877c4' },
  harvest: { n: 'Fé da Colheita', e: '🌾', col: '#77d8d0' },
  dragon: { n: 'Senda do Dragão Adormecido', e: '🐉', col: '#d8b377' },
  eclipse: { n: 'Culto do Eclipse', e: '🌘', col: '#9777d8' },
  bones: { n: 'Fé dos Ossos Cantores', e: '🦴', col: '#77d87a' },
  oath: { n: 'Igreja do Juramento', e: '🤝', col: '#d87790' },
  mist: { n: 'Caminho da Névoa', e: '🌫️', col: '#77acd8' },
  bull: { n: 'Culto do Touro Celeste', e: '🐂', col: '#c9d877' },
  lotus: { n: 'Fé do Lótus de Prata', e: '🪷', col: '#cb77d8' },
  clock: { n: 'Ordem do Relógio', e: '🕰️', col: '#77d8af' },
  rain: { n: 'Culto da Chuva', e: '🌧️', col: '#d89377' },
  horizon: { n: 'Fé do Horizonte', e: '🌄', col: '#7777d8' },
  icemart: { n: 'Igreja dos Mártires do Gelo', e: '🧊', col: '#94d877' },
  maze: { n: 'Culto do Labirinto', e: '🌀', col: '#d877b0' },
  ember: { n: 'Fé da Brasa Viva', e: '♨️', col: '#77cdd8' },
  owl: { n: 'Ordem da Coruja', e: '🦉', col: '#d8c777' },
  // sem fé: aparece depois de 1700 em quase todo país, em pouca quantidade; cresce com a educação e muito com o Estado laico. Vale como qualquer religião (pode até ser a oficial)
  atheism: { n: 'Ateísmo', e: '⚛️', col: '#c8c8c8', atheist: 1, y0: 1700, fixed: { grp: 'nul', dc: { head: 'none', plural: 'plural', gender: 'equal', marriage: 'mono', clergy: 'married' }, tn: ['scholars'] } },
};

/* peculiaridades sorteadas a cada partida: famílias de fé (guerra santa só contra outra família), doutrinas e títulos */
CONTENT.FAITH_GRP = { nul: 'Sem religião', sol: 'Fés solares', lua: 'Fés lunares', anc: 'Fés ancestrais', livro: 'Fés do Livro', nat: 'Fés da natureza', fogo: 'Fés do fogo', vazio: 'Fés do vazio', mar: 'Fés do mar' };

CONTENT.DOC_POOL = { stab: [.03, .06], research: [.03, .07], tax: [.03, .06], trade: [.03, .07], army: [.03, .07], manpower: [.05, .12], admin: [.05, .1], growth: [.03, .06], colon: [.05, .1], speed: [.03, .06], prod: [.03, .06], food: [.03, .06] };

CONTENT.HEAD_POOL = [['Sínodo', 'Patriarca'], ['Santa Sé', 'Pontífice'], ['Grande Templo', 'Sumo-sacerdote'], ['Conclave', 'Primaz'], ['Oráculo', 'Grande Vidente'], ['Colégio Sagrado', 'Hierofante'], ['Mosteiro-Mãe', 'Abade supremo'], ['Trono Sagrado', 'Profeta'], ['Círculo Interior', 'Arquidruida'], ['Assembleia dos Santos', 'Exarca']];

CONTENT.HOLY_POOL = ['Cruzada', 'Guerra santa', 'Peregrinação armada', 'Guerra da luz', 'Purificação', 'Marcha sagrada', 'Grande saque', 'Guerra florida', 'Jornada da fé', 'Vingança divina'];

CONTENT.GRP_D = { nul: 'Não há deuses: só a razão, a ciência e as pessoas', sol: 'O sol ordena o mundo', lua: 'Os ciclos da lua guiam a vida', anc: 'Os mortos guardam os vivos', livro: 'A palavra escrita é a lei', nat: 'A terra e os bichos são sagrados', fogo: 'O fogo purifica', vazio: 'A paz está no nada', mar: 'O mar dá e o mar toma' };

/* doutrinas no estilo CK3 (sorteadas por partida): cada fé tem uma opção de cada doutrina e dois princípios.
   Efeitos: m = modificadores (doutrina da fé oficial); mw = peso das minorias religiosas; noHoly = sem guerra santa; fr = chance de governante mulher ×; kids = filhos × */
CONTENT.DOCTRINES = {
  head:     { n: 'Chefe da fé', o: { none: { n: 'Sem chefe', p: .45 }, spiritual: { n: 'Chefe espiritual', p: .4 }, temporal: { n: 'Chefe temporal', p: .15, m: { stab: .02 } } } },
  plural:   { n: 'Pluralismo', o: { fund: { n: 'Fundamentalista', p: .3, mw: 1.5 }, right: { n: 'Justa', p: .45, mw: 1 }, plural: { n: 'Pluralista', p: .25, mw: .5, noHoly: 1, m: { stab: .02 } } } },
  gender:   { n: 'Gênero', o: { male: { n: 'Dominada por homens', p: .55, fr: .5 }, equal: { n: 'Igualitária', p: .35, fr: 2.5, m: { prod: .02 } }, female: { n: 'Dominada por mulheres', p: .1, fr: 8 } } },
  marriage: { n: 'Casamento', o: { mono: { n: 'Monogamia', p: .55, m: { stab: .02 } }, poly: { n: 'Poligamia', p: .25, kids: 1.6, m: { stab: -.02 } }, conc: { n: 'Concubinato', p: .2, kids: 1.3 } } },
  clergy:   { n: 'Clero', o: { celib: { n: 'Celibatário', p: .5, m: { stab: .02 } }, married: { n: 'Casado', p: .5, m: { growth: .02 } } } },
};

CONTENT.TENETS = {
  pilgrim: { n: 'Peregrinações', m: { stab: .03 } }, warriors: { n: 'Guerreiros da fé', m: { army: .06 } }, merchants: { n: 'Mercadores sagrados', m: { trade: .06 } },
  scholars: { n: 'Erudição sagrada', m: { research: .05 } }, ascetic: { n: 'Ascetismo', m: { stab: .04, tax: -.02 } }, communal: { n: 'Identidade comunal', m: { manpower: .08 } },
  earth: { n: 'Terra sagrada', m: { food: .05, growth: .02 } }, builders: { n: 'Templos monumentais', m: { admin: .06 } }, missions: { n: 'Missões', m: { colon: .08 } },
  tithe: { n: 'Dízimo', m: { tax: .05, stab: -.01 } }, martyrs: { n: 'Culto aos mártires', m: { manpower: .05, stab: .01 } }, sea: { n: 'Mar sagrado', m: { speed: .03, trade: .03 } },
  struggle: { n: 'Luta eterna', m: { army: .04, stab: -.02 } }, harmony: { n: 'Harmonia', m: { stab: .05, army: -.03 } }, craft: { n: 'Ofício sagrado', m: { prod: .05 } },
};

/* reformas: numa janela de anos, a maior fé organizada do continente principal se divide onde o fervor está baixo; a fé nova é uma das que não têm povo */
CONTENT.REFORMS = [
  { id: 'reformation', n: 'Reforma', y: [1480, 1600], when: { tech: 'soc_printing' }, ferv: 45, sp: .2 },
];

CONTENT.FERV = { donate: 40, invest: 25, crusade: 40, excom: 15, lift: 35 };// custo em favor/limites

/* fé oficial e fés reconhecidas (autonomia +2, "Aceita"): o que rendem além da doutrina da fé oficial
   unity = estabilidade por ponto de fração da população acima de 50% que segue a fé oficial · recog = parte da doutrina de cada fé reconhecida, × a fração dela (teto recogCap)
   atheism: ateus surgem por ano em cada província (chance × (1 + educação) × lei) depois de 1700; secular multiplica */
CONTENT.FAITH_RULES = { unity: .1, recog: 1.5, recogCap: .35, atheism: { base: .0015, edu: 2, law: { state: .3, tolerant: .6, free: 1, secular: 6 } } };

