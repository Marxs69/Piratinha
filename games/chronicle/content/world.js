/* Grand Chronicle — conteúdo: terrenos, eras, doenças, invasões, eventos mundiais e espaço.
   Arquivo de dados editável: cada bloco "CONTENT.NOME = ...;" é JSON5 (comentários, chaves sem aspas, aspas simples, vírgula no fim).
   Só dados: nada de código. O jogo lê ao abrir a página; para valer num save, salve o arquivo e recarregue. */

/* ---------- terrenos ---------- */
/* width = largura de combate; att = dado de quem ataca; cav = eficácia da cavalaria; sup = suprimento; attr = atrito mensal do próprio terreno */
/* open = campo aberto (vento) · sun = sol forte · wood = floresta (madeira) · stone = pedra */
CONTENT.TERRAIN = {
  plains:   { n: 'Planície', col: [148, 178, 92], move: 1, def: 0, food: 1.2, pop: 1.2, width: 1, att: 0, cav: 1, sup: 1, attr: 0, open: 1 },
  grass:    { n: 'Campos', col: [176, 190, 104], move: 1, def: 0, food: 1.1, pop: 1.1, width: 1, att: 0, cav: 1, sup: 1, attr: 0, open: 1, sun: 1 },
  forest:   { n: 'Floresta', col: [70, 120, 62], move: 1.3, def: .15, food: .8, pop: .8, width: 0.8, att: -1, cav: 0.6, sup: 0.8, attr: 0, wood: 1 },
  taiga:    { n: 'Taiga', col: [76, 104, 78], move: 1.4, def: .15, food: .5, pop: .5, width: 0.8, att: -1, cav: 0.6, sup: 0.6, attr: 0.01, wood: 1 },
  jungle:   { n: 'Selva', col: [48, 110, 54], move: 1.8, def: .25, food: .7, pop: .6, width: 0.6, att: -1, cav: 0.4, sup: 0.6, attr: 0.01, wood: 1 },
  hills:    { n: 'Colinas', col: [150, 140, 96], move: 1.5, def: .25, food: .8, pop: .8, width: 0.85, att: -1, cav: 0.8, sup: 0.8, attr: 0, stone: 1, open: 1 },
  mountain: { n: 'Montanhas', col: [128, 116, 104], move: 2.2, def: .45, food: .3, pop: .35, width: 0.6, att: -2, cav: 0.4, sup: 0.5, attr: 0.01, stone: 1 },
  desert:   { n: 'Deserto', col: [222, 198, 138], move: 1.4, def: .05, food: .25, pop: .3, width: 1, att: 0, cav: 1, sup: 0.4, attr: 0.01, stone: 1, sun: 1 },
  savanna:  { n: 'Savana', col: [196, 180, 98], move: 1.1, def: 0, food: .9, pop: .8, width: 1, att: 0, cav: 1, sup: 0.9, attr: 0, sun: 1 },
  marsh:    { n: 'Pântano', col: [96, 120, 92], move: 1.7, def: .2, food: .6, pop: .5, width: 0.6, att: -1, cav: 0.5, sup: 0.6, attr: 0.01 },
  tundra:   { n: 'Tundra', col: [168, 170, 150], move: 1.3, def: .05, food: .25, pop: .25, width: 0.9, att: 0, cav: 0.8, sup: 0.4, attr: 0.01, open: 1 },
  ice:      { n: 'Gelo', col: [232, 238, 242], move: 2, def: .1, food: 0, pop: .05, width: 0.5, att: -1, cav: 0.5, sup: 0.1, attr: 0.03 },
};

/* limites que crescem a cada era alcançada pelo país (completar as técnicas da era): por índice de ERAS
   slots = canteiros de obra (também limitados pelo título) · bld = níveis de cada prédio por estado (os que não têm max próprio) · svc = níveis de cada serviço público por estado */
CONTENT.ERA_LIM = { slots: [5, 6, 7, 8, 10, 12, 14, 16, 18], bld: [4, 5, 6, 8, 10, 12, 14, 16, 20], svc: [2, 3, 3, 4, 5, 6, 7, 8, 10],
  armies: [5, 7, 9, 11, 13, 15, 17, 19, 21] };   // armies: exércitos que a IA mantém (5 + 2 por era)

CONTENT.ERAS = [[860, 'Alta Idade Média'], [1000, 'Idade Média'], [1450, 'Renascimento'], [1650, 'Era Moderna'], [1780, 'Era das Revoluções'], [1880, 'Era Industrial'], [1945, 'Guerra Fria'], [2000, 'Era Digital'], [2060, 'Futuro']];

/* ---------- doenças ----------
   le = parte da população que morre por mês numa província doente; sp = chance de passar para cada vizinha por mês; mar = chance de saltar pelo mar;
   dur = meses doente; y = época; terr = surge mais nesses terrenos; war = nasce em cercos e acampamentos; urb = precisa de gente amontoada; vert = só existe se alguém seguir a vertente.
   Hospitais e medicina reduzem a letalidade e o contágio, mas nunca zeram (ver diseaseProt). */
CONTENT.DISEASES = {
  fever:     { n: 'Febre', y: [860, 2200], le: .008, sp: .10, dur: 4, w: 3 },
  smallpox:  { n: 'Varíola', y: [860, 1980], le: .02, sp: .14, mar: .03, dur: 6, w: 2 },
  measles:   { n: 'Sarampo', y: [860, 2200], le: .008, sp: .16, dur: 4, w: 2 },
  dysentery: { n: 'Disenteria', y: [860, 2200], le: .012, sp: .08, dur: 4, w: 2, war: 1 },
  marsh:     { n: 'Febre dos pântanos', y: [860, 1950], le: .014, sp: .06, dur: 6, w: 2, terr: ['marsh', 'jungle'] },
  typhus:    { n: 'Tifo', y: [1400, 1950], le: .016, sp: .10, dur: 5, w: 2, war: 1 },
  flu:       { n: 'Gripe', y: [1500, 2200], le: .006, sp: .20, mar: .05, dur: 3, w: 3 },
  yellow:    { n: 'Febre amarela', y: [1600, 1950], le: .02, sp: .10, mar: .05, dur: 5, w: 1, terr: ['jungle', 'savanna'] },
  tb:        { n: 'Tuberculose', y: [1750, 1960], le: .006, sp: .08, dur: 10, w: 2, urb: 1 },
  cholera:   { n: 'Cólera', y: [1815, 1960], le: .02, sp: .12, mar: .06, dur: 4, w: 2, urb: 1 },
  synth:     { n: 'Praga sintética', y: [1985, 2200], le: .02, sp: .14, mar: .06, dur: 6, w: 2, vert: 'bio' },
  grey:      { n: 'Febre cinzenta', y: [2100, 2200], le: .015, sp: .12, mar: .05, dur: 5, w: 2, vert: 'nano' },
};

/* grandes pandemias: no máximo uma vez por partida, dentro da janela (o fim da janela garante que acontece) */
CONTENT.PANDEMICS = {
  black:   { n: 'Grande Peste', e: '☠️', y: [1340, 1360], le: .035, sp: .3, mar: .6, dur: 12, cont: 'main', m: 'Uma praga mortal surgiu em {p} e se espalha pelas estradas e pelos portos. Quem adoecer perde parte da população por um ano.' },
  cholera: { n: 'Pandemia de cólera', e: '🦠', y: [1817, 1835], le: .02, sp: .25, mar: .5, dur: 8, m: 'O cólera saiu de {p} pelos portos. As cidades sem saneamento serão as mais atingidas.' },
  flu:     { n: 'Grande Gripe', e: '🤧', y: [1916, 1922], le: .022, sp: .4, mar: .7, dur: 6, war: 1, m: 'Uma gripe devastadora surgiu em {p}. Tropas e navios a levam para todo o mundo.' },
  synth:   { n: 'Pandemia sintética', e: '🧬', y: [2030, 2120], le: .02, sp: .35, mar: .7, dur: 8, m: 'Um patógeno criado em laboratório escapou em {p}.' },
};

/* ---------- história: grandes acontecimentos em janelas de época (podem não acontecer se faltar condição) ----------
   invasões: surgem como países novos com exército grande. from: 'cold' = costa do continente frio; 'edge' = ponta leste do continente principal.
   army = múltiplo da força do vizinho mais forte; cav = parte de cavalaria; years = anos de fúria (IA agressiva) */
CONTENT.INVASIONS = [
  { id: 'vikings', n: 'Grande Exército', y: [860, 920], from: 'cold', cul: 'local', relig: 'local', gov: 'tribal', army: 1.6, min: 22, cav: .1, ships: 1, years: 30, e: '🪓',
    m: 'Os chefes do norte uniram-se num Grande Exército e cruzam o mar atrás de terras e ouro.' },
  { id: 'magyars', n: 'Federação das Estepes', y: [895, 960], from: 'edge', cul: 'new', fam: 'gut', relig: 'new', gov: 'horde', army: 1.8, min: 25, cav: .7, years: 40, e: '🏹',
    m: 'Cavaleiros das estepes atravessaram a fronteira leste. Saqueiam tudo o que alcançam.' },
  { id: 'mongols', n: 'Grande Horda', y: [1206, 1260], from: 'edge', cul: 'new', fam: 'gut', relig: 'new', gov: 'horde', army: 3.5, min: 40, cav: .8, years: 60, e: '🐎',
    m: 'Um grande cã uniu as tribos das estepes. Sua horda avança como uma tempestade.' },
];

/* ondas e guerras do mundo */
CONTENT.WORLD_EVENTS = {
  revolutions: { n: 'Era das Revoluções', y: [1789, 1850], e: '🗽' },
  greatwar:    { n: 'Grande Guerra', y: [1905, 1925], p: [.004, .034], e: '💥' },   // p = chance/mês no início e no fim da janela (sobe em curva: mediana ~1914)
  worldwar:    { n: 'Segunda Guerra Mundial', y: [1933, 1948], p: [.005, .04], e: '☢️' },
  coldwar:     { n: 'Guerra Fria', y: [1946, 1995], e: '🧊' },
};

/* ---------- espaço: foguete de cada vertente e a lua sorteada em cada partida ---------- */
CONTENT.ROCKETS = { none: 'Foguete químico', clock: 'Foguete de corda', steam: 'Foguete a vapor', tesla: 'Canhão eletromagnético', diesel: 'Foguete a diesel', atom: 'Foguete nuclear', bio: 'Nave orgânica', cyber: 'Lançador em rede', solar: 'Vela solar', nano: 'Elevador de nanotubos', space: 'Nave estelar' };

CONTENT.MOON_TYPES = [['Rochosa', '#9a9890'], ['Gelada', '#cfe6f2'], ['Oceânica', '#3f78b8'], ['Vulcânica', '#a5452c'], ['Desértica', '#cfa96a'], ['Selvagem', '#4f8a43']];

CONTENT.ALIEN_ERAS = ['Idade da Pedra', 'Idade do Bronze', 'Idade Média', 'Renascimento', 'Era Industrial', 'Era Atômica', 'Era Digital', 'Era Interestelar'];

/* mapa conhecido ao começar numa era avançada (como as navegações e a colonização reais): [ano, costas, interior]
   costas = parte do litoral do mundo conhecida · interior = quão fundo, do litoral para dentro, os continentes já foram mapeados (1 = tudo)
   kind = quanto disso cada tipo de país conhece (potências do continente principal, povos do frio, povos distantes) — os outros alcançam com o tempo */
CONTENT.EXPLORE_ERA = { steps: [[1400, 0, 0], [1453, .15, 0], [1550, .45, .06], [1650, .7, .15], [1750, .88, .35], [1850, 1, .7], [1900, 1, .9], [1950, 1, 1]],
  kind: { main: 1, cold: .7, far: .45 }, catchUp: 1900 };

