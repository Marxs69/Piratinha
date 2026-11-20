/* Grand Chronicle — conteúdo: economia: bens, classes, prédios e serviços.
   Arquivo de dados editável: cada bloco "CONTENT.NOME = ...;" é JSON5 (comentários, chaves sem aspas, aspas simples, vírgula no fim).
   Só dados: nada de código. O jogo lê ao abrir a página; para valer num save, salve o arquivo e recarregue. */

/* ---------- bens (p = preço base em ducados) ---------- */
CONTENT.GOODS = {
  grain:   { n: 'Grãos', p: 2, c: 'food', e: '🌾' },
  fish:    { n: 'Peixe', p: 2.4, c: 'food', e: '🐟' },
  wood:    { n: 'Madeira', p: 2, c: 'raw', e: '🪵' },
  stone:   { n: 'Pedra', p: 2, c: 'raw', e: '🪨' },
  iron:    { n: 'Ferro', p: 4, c: 'raw', e: '⛓️', rm: 3 },
  coal:    { n: 'Carvão', p: 3.5, c: 'raw', e: '⚫', rm: 3 },
  gold:    { n: 'Ouro', p: 20, c: 'raw', e: '🪙', rm: 2 },
  fiber:   { n: 'Fibras', p: 2.5, c: 'raw', e: '🧶' },
  oil:     { n: 'Petróleo', p: 7, c: 'raw', e: '🛢️', rm: 3, pros: 'eco_oil' },
  copper:  { n: 'Cobre', p: 5, c: 'raw', e: '🟠', rm: 3 },
  uranium: { n: 'Urânio', p: 14, c: 'raw', e: '☢️', rm: 2, pros: 'eco_electricity', terr: ['hills', 'mountain', 'desert', 'tundra'] },
  rare:    { n: 'Terras raras', p: 16, c: 'raw', e: '💠', rm: 2, pros: 'eco_assembly' },
  cloth:   { n: 'Tecido', p: 5, c: 'ind', e: '🧵' },
  clothes: { n: 'Roupas', p: 7, c: 'ind', e: '👕' },
  pfood:   { n: 'Comida processada', p: 5, c: 'ind', e: '🥫' },
  goods:   { n: 'Bens de consumo', p: 8, c: 'ind', e: '🏺' },
  tools:   { n: 'Ferramentas', p: 7, c: 'ind', e: '🔨', ip: 2 },
  arms:    { n: 'Armas', p: 9, c: 'ind', e: '🗡️', ip: 2 },
  horses:  { n: 'Cavalos', p: 6, c: 'raw', e: '🐎' },
  meds:    { n: 'Remédios', p: 10, c: 'ind', e: '💊' },
  steel:   { n: 'Aço', p: 8, c: 'ind', e: '🔩' },
  elec:    { n: 'Eletrônicos', p: 25, c: 'ind', e: '📟' },
  lux:     { n: 'Luxo', p: 20, c: 'lux', e: '💎' },
  power:   { n: 'Energia', p: 6, c: 'ind', e: '⚡', y0: 1885, grid: 1 },
  gears:   { n: 'Engrenagens', p: 14, c: 'punk', e: '⚙️' },
  boilers: { n: 'Caldeiras', p: 16, c: 'punk', e: '♨️' },
  coils:   { n: 'Bobinas Tesla', p: 18, c: 'punk', e: '⚡' },
  engines: { n: 'Motores a diesel', p: 18, c: 'punk', e: '🛞' },
  cores:   { n: 'Núcleos atômicos', p: 30, c: 'punk', e: '☢️' },
  biomass: { n: 'Biomassa', p: 14, c: 'punk', e: '🧬' },
  chips:   { n: 'Implantes', p: 28, c: 'punk', e: '💾' },
  panels:  { n: 'Painéis solares', p: 16, c: 'punk', e: '☀️' },
  nanites: { n: 'Nanites', p: 40, c: 'punk', e: '🔬' },
  he3:     { n: 'Hélio-3', p: 45, c: 'punk', e: '🚀' },
};

/* campos dos bens: rm = níveis de mina por jazida · pros = jazida escondida, achada por prospecção com essa técnica · terr = terrenos onde a prospecção acha jazida nova
   ip = prioridade de importação (0 comida, 1 bem da vertente, 2 este, 3 o resto) · y0 = só é consumido a partir desse ano · grid = não viaja entre estados (sempre local) */
/* subsistência: o que cada mil pessoas sem emprego nos prédios produz por mês (n = para o país, st = para o estado) */
CONTENT.SUBSIST = { wood: { n: .02, st: .02 }, fiber: { n: .01, st: .01 }, cloth: { n: .012, st: .012 }, lux: { n: .0006 }, goods: { n: .012 }, clothes: { n: .022 }, tools: { n: .0015 } };

/* ---------- classes sociais: necessidades por 1.000 pessoas/mês (crescem com o padrão de vida da era) ----------
   staple = grãos ou peixe · as outras chaves são bens · svc = serviços públicos que a classe cobra (saúde e educação) */
CONTENT.CLASSES = {
  slave: { n: 'Escravos', e: '⛓️', col: '#8a6d5a', d: 'Mão de obra forçada: trabalham em fazendas, plantações, minas e madeireiras rendendo mais e só comem.\nNão votam nem compram nada. Muitos escravos derrubam a estabilidade e causam revoltas.' },
  low:   { n: 'Classe baixa', e: '🧑‍🌾', col: '#b59a6a', d: 'Camponeses, pescadores e operários: a maior parte do povo e do contingente.\nPrecisam de comida e roupas; com fome ou sem roupa, fazem revoltas populares.' },
  mid:   { n: 'Classe média', e: '🧑‍💼', col: '#7fb3d5', d: 'Artesãos, comerciantes, burocratas, professores e técnicos.\nCompram comida processada, roupas e bens; querem saúde e educação. Satisfeita: mais pesquisa e impostos.' },
  high:  { n: 'Classe alta', e: '🎩', col: '#d9b45a', d: 'Nobreza, clero, oficiais e capitalistas.\nConsome luxo, roupas e comida processada. Insatisfeita: apoia golpes contra o governo.' },
};

/* quem trabalha em cada grupo de prédios (fração de cada classe) */
CONTENT.JOBS = { prod: { low: .93, mid: .05, high: .02 }, ind: { low: .8, mid: .16, high: .04 }, energy: { low: .65, mid: .3, high: .05 }, infra: { low: .82, mid: .15, high: .03 },
  svc: { low: .2, mid: .72, high: .08 }, mil: { low: .45, mid: .35, high: .2 }, vert: { low: .55, mid: .35, high: .1 }, trade: { low: .4, mid: .5, high: .1 } };

CONTENT.JOB_N = { prod: 'Agricultura e extração', ind: 'Indústria e artesanato', energy: 'Energia', infra: 'Transporte', svc: 'Serviços públicos', mil: 'Militar', vert: 'Vertente', trade: 'Comércio' };

/* ---------- prédios (no estado; nível = quantas unidades) ----------
   w = mil trabalhadores por nível · in/out = bens por mês por nível · req = condição do estado (REQS ou res:<bem>) · tech = tecnologia que libera
   job = grupo de empregos (senão o do BGROUPS) · slave = aceita escravos · food = soma o modificador de comida · fert = rende pela fertilidade do estado
   cap = vaga própria em st.caps (senão a do req) · maxFx = nível máximo = 1 + esse efeito da nação (senão max)
   fx (por nível): tax impostos · trade comércio · port porto · research pesquisa/mês · stab estabilidade · ferv fervor · yard desconto de navios no estado · rec meses a menos de recrutamento no estado
   fx.boost = { prédio: bônus por nível à produção dele no mesmo estado } · fx.sub = bônus por nível à subsistência do estado */
/* teto da soma de cada efeito de prédio no país */
CONTENT.BFX_CAP = { tax: .3, trade: .4, stab: 10, ferv: 15, yard: .5 };

/* condições de estado para construir: cap = vaga em st.caps · coast 1 = exige litoral, 'or' = litoral basta · terr = flag de TERRAIN em alguma província */
CONTENT.REQS = {
  arable: { n: 'terra cultivável', cap: 'farm' }, forest: { n: 'floresta', cap: 'lumber' }, rocky: { n: 'colinas ou montanhas', cap: 'quarry' }, warm: { n: 'clima quente', cap: 'plantation' },
  coast: { n: 'litoral', coast: 1 }, windy: { n: 'litoral ou campo aberto', coast: 'or', terr: 'open' }, sunny: { n: 'deserto, savana ou campos', terr: 'sun' },
};

CONTENT.BUILDINGS = {
  farm:        { n: 'Fazenda', e: '🌾', cost: 60, w: 2, out: { grain: 4.4 }, req: 'arable', tl: .04, slave: 1, food: 1, fert: 1 },
  fishery:     { n: 'Pesqueiro', e: '🐟', cost: 50, w: 1, out: { fish: 2.6 }, req: 'coast', tl: .03, food: 1, cap: 'fishery' },
  lumber:      { n: 'Madeireira', e: '🪵', cost: 45, w: 1, out: { wood: 3 }, req: 'forest', tl: .04, slave: 1 },
  quarry:      { n: 'Pedreira', e: '🪨', cost: 50, w: 1, out: { stone: 2.6 }, req: 'rocky', tl: .05, slave: 1 },
  iron_mine:   { n: 'Mina de ferro', e: '⛓️', cost: 80, w: 1.5, out: { iron: 2.2 }, req: 'res:iron', tl: .06, slave: 1 },
  coal_mine:   { n: 'Mina de carvão', e: '⚫', cost: 80, w: 1.5, out: { coal: 2.6 }, req: 'res:coal', tech: 'eco_deepmining', tl: .06, slave: 1 },
  gold_mine:   { n: 'Mina de ouro', e: '🪙', cost: 120, w: 1, out: { gold: .45 }, req: 'res:gold', tl: .05, slave: 1 },
  plantation:  { n: 'Plantação', e: '🧶', cost: 60, w: 2, out: { fiber: 3.4 }, req: 'warm', tl: .04, slave: 1 },
  weaver:      { n: 'Tecelagem', e: '🧵', cost: 70, w: 1, in: { fiber: 2 }, out: { cloth: 1.6 }, tl: .03 },
  tailor:      { n: 'Alfaiataria', e: '👕', cost: 70, w: 1, in: { cloth: 1 }, out: { clothes: 1.2 }, tl: .03 },
  bakery:      { n: 'Padaria e salgadeira', e: '🥫', cost: 60, w: 1, in: { grain: 1.4, fish: .4 }, out: { pfood: 1.5 }, tl: .02 },
  workshop:    { n: 'Oficina de artesãos', e: '🏺', cost: 80, w: 1, in: { wood: 1, cloth: .3 }, out: { goods: .85 }, tl: .05 },
  stud:        { n: 'Haras', e: '🐎', cost: 70, w: 1, in: { grain: .6 }, out: { horses: 1.2 }, req: 'arable', tl: .02 },
  apothecary:  { n: 'Botica', e: '⚗️', cost: 90, w: .6, in: { fiber: .4, grain: .2 }, out: { meds: .5 }, tech: 'soc_universities' },
  pharma:      { n: 'Indústria farmacêutica', e: '💊', cost: 450, w: 2, in: { oil: .4, power: .4 }, out: { meds: 5 }, tech: 'soc_germ' },
  smithy:      { n: 'Ferraria', e: '🔨', cost: 90, w: 1, in: { iron: 1, wood: .6 }, out: { tools: .5, arms: .45 } },
  jeweler:     { n: 'Ourivesaria', e: '💎', cost: 120, w: .6, in: { gold: .2, cloth: .2 }, out: { lux: .42 }, tech: 'eco_guilds', job: 'trade' },
  market:      { n: 'Mercado', e: '🏪', cost: 90, w: .5, fx: { tax: .015 }, tech: 'eco_trade_fairs', max: 3, job: 'trade' },
  castle:      { n: 'Castelo', e: '🏰', cost: 150, w: .3, fx: { fort: 1 }, max: 3, maxFx: 'fort' },
  port:        { n: 'Porto', e: '⚓', cost: 120, w: .6, fx: { port: 1, trade: .08 }, req: 'coast', max: 3, job: 'trade' },
  university:  { n: 'Universidade', e: '🎓', cost: 160, w: .4, fx: { research: 2.5 }, tech: 'soc_universities', max: 3 },
  temple:      { n: 'Templo', e: '⛪', cost: 100, w: .3, fx: { stab: 1, ferv: 1.5 }, max: 2 },
  mill:        { n: 'Moinho e celeiro', e: '🥖', cost: 90, w: .5, fx: { boost: { farm: .15 }, sub: .05 }, tech: 'eco_watermill', max: 2 },
  foundry:     { n: 'Fundição', e: '🔥', cost: 160, w: 1.5, in: { iron: 2, coal: 1, wood: .5 }, out: { tools: 1.2, arms: 1.1 }, tech: 'eco_foundry' },
  blast_furnace:{ n: 'Alto-forno', e: '🏗️', cost: 220, w: 2, in: { iron: 2.5, coal: 1.5 }, out: { steel: 1.4 }, tech: 'eco_blastfurnace' },
  textile_manuf:{ n: 'Manufatura têxtil', e: '🧶', cost: 180, w: 2, in: { fiber: 3 }, out: { cloth: 3 }, tech: 'eco_manufactory', tl: .08 },
  manufactory: { n: 'Manufatura', e: '🏭', cost: 200, w: 2, in: { cloth: .8, wood: 1 }, out: { goods: 2.6 }, tech: 'eco_manufactory', tl: .1 },
  garment_factory:{ n: 'Fábrica de roupas', e: '👕', cost: 340, w: 3, in: { cloth: 3.5, power: .3 }, out: { clothes: 8 }, tech: 'eco_factory', tl: .05 },
  food_factory:{ n: 'Fábrica de alimentos', e: '🥫', cost: 340, w: 2.5, in: { grain: 4, fish: 1, power: .3 }, out: { pfood: 9.5 }, tech: 'eco_mechanization', tl: .05 },
  textile_mill:{ n: 'Fábrica têxtil', e: '🧵', cost: 320, w: 3, in: { fiber: 4, coal: .5, power: .3 }, out: { cloth: 8 }, tech: 'eco_textile' },
  goods_factory:{ n: 'Fábrica de bens', e: '🏭', cost: 380, w: 3, in: { cloth: 1, steel: .5, wood: 1, power: .5 }, out: { goods: 7 }, tech: 'eco_factory' },
  tool_factory:{ n: 'Fábrica de ferramentas', e: '🔧', cost: 360, w: 3, in: { steel: 1.5, coal: .5, power: .4 }, out: { tools: 5 }, tech: 'eco_mechanization' },
  arms_factory:{ n: 'Fábrica de armamentos', e: '💣', cost: 400, w: 3, in: { steel: 1.5, coal: .5, power: .4 }, out: { arms: 4.8 }, tech: 'eco_interchangeable' },
  steel_mill:  { n: 'Siderúrgica', e: '🔩', cost: 420, w: 3, in: { iron: 3, coal: 2, power: .8 }, out: { steel: 5 }, tech: 'eco_bessemer' },
  railway:     { n: 'Ferrovia', e: '🚂', cost: 300, w: 1, in: { steel: .3, coal: .5 }, fx: { prod: .08, speed: .5, infra: 2 }, tech: 'eco_railways', max: 3 },
  copper_mine: { n: 'Mina de cobre', e: '🟠', cost: 80, w: 1.5, out: { copper: 2.4 }, req: 'res:copper', tl: .06, slave: 1 },
  uranium_mine:{ n: 'Mina de urânio', e: '☢️', cost: 300, w: 1, out: { uranium: 1.4 }, req: 'res:uranium', tech: 'eco_electricity' },
  rare_mine:   { n: 'Mina de terras raras', e: '💠', cost: 350, w: 1.5, out: { rare: 1.2 }, req: 'res:rare', tech: 'eco_assembly' },
  oil_well:    { n: 'Poço de petróleo', e: '🛢️', cost: 300, w: 1, out: { oil: 3.2 }, req: 'res:oil', tech: 'eco_oil' },
  power_plant: { n: 'Termelétrica a carvão', e: '🏭', cost: 420, w: 1, in: { coal: 2 }, out: { power: 5 }, tech: 'eco_electricity' },
  electronics: { n: 'Fábrica de eletrônicos', e: '📟', cost: 600, w: 3, in: { steel: .5, oil: .6, power: .8 }, out: { elec: 2.4 }, tech: 'eco_transistor' },
  // energia
  oil_plant:   { n: 'Termelétrica a óleo', e: '🏭', cost: 420, w: 1, in: { oil: 1.5 }, out: { power: 5 }, tech: 'eco_oil_power' },
  hydro:       { n: 'Hidrelétrica', e: '💧', cost: 600, w: .6, out: { power: 4.5 }, req: 'rocky', tech: 'eco_electricity' },
  nuclear:     { n: 'Usina nuclear', e: '⚛️', cost: 1000, w: 1, in: { uranium: .4 }, out: { power: 14 }, tech: 'eco_nuclear' },
  wind:        { n: 'Parque eólico', e: '🌬️', cost: 500, w: .3, out: { power: 3 }, req: 'windy', tech: 'eco_wind' },
  solar_plant: { n: 'Usina solar', e: '🔆', cost: 550, w: .3, out: { power: 3.5 }, req: 'sunny', tech: 'eco_solar' },
  fusion:      { n: 'Reator de fusão', e: '🌟', cost: 2500, w: 1, out: { power: 40 }, tech: 'eco_fusion' },
  pw_clock:    { n: 'Torre de molas', e: '⚙️', cost: 250, w: .6, in: { gears: .2 }, out: { power: 2.5 }, vert: 'clock' },
  pw_steam:    { n: 'Usina a vapor colossal', e: '♨️', cost: 380, w: 1, in: { coal: 1.5 }, out: { power: 6 }, vert: 'steam' },
  pw_diesel:   { n: 'Usina a diesel', e: '🛢️', cost: 400, w: .8, in: { oil: 1 }, out: { power: 6 }, vert: 'diesel' },
  pw_bio:      { n: 'Usina de biogás', e: '🧬', cost: 420, w: .8, in: { grain: 1.5 }, out: { power: 5 }, vert: 'bio' },
  pw_cyber:    { n: 'Rede elétrica inteligente', e: '💾', cost: 600, w: .4, out: { power: 6 }, vert: 'cyber' },
  pw_nano:     { n: 'Nanocélulas', e: '🔬', cost: 900, w: .3, out: { power: 12 }, vert: 'nano' },
  pw_space:    { n: 'Coletor solar orbital', e: '🛰️', cost: 1500, w: .3, out: { power: 25 }, vert: 'space' },
  // obras de transporte (desenhadas no mapa) e oleodutos
  road:        { n: 'Estradas', e: '🛤️', cost: 60, w: .3, fx: { speed: .15, trade: .01, infra: 1 }, max: 3 },
  highway:     { n: 'Rodovias', e: '🛣️', cost: 400, w: .5, in: { oil: .3, steel: .2 }, fx: { speed: .4, prod: .05, infra: 3 }, tech: 'eco_highways', max: 3 },
  hsr:         { n: 'Trem de alta velocidade', e: '🚄', cost: 700, w: .6, in: { power: .5, steel: .2 }, fx: { speed: .7, prod: .06, infra: 4 }, tech: 'eco_hsr', max: 2 },
  maglev:      { n: 'Maglev', e: '🚝', cost: 1100, w: .5, in: { power: 1 }, fx: { speed: 1, prod: .08, infra: 5 }, tech: 'eco_maglev', max: 2 },
  tubes:       { n: 'Tubos a vácuo', e: '🌀', cost: 1600, w: .5, in: { power: 1.5 }, fx: { speed: 1.5, prod: .1, infra: 6 }, tech: 'eco_tubes', max: 2 },
  portal:      { n: 'Portais', e: '🌌', cost: 3000, w: .4, in: { power: 3 }, fx: { speed: 3, prod: .12, trade: .05, infra: 7 }, tech: 'eco_portals', max: 1 },
  pipeline:    { n: 'Oleoduto e gasoduto', e: '🧪', cost: 350, w: .3, in: { steel: .2 }, fx: { pipe: 1, boost: { oil_well: .3 } }, tech: 'eco_pipelines', max: 1 },
  // serviços públicos (cobertura por estado)
  hospital:    { n: 'Hospital', e: '🏥', cost: 120, w: .4, fx: { svc: 'health' }, max: 5 },
  school:      { n: 'Escola', e: '📚', cost: 110, w: .4, fx: { svc: 'edu' }, max: 5 },
  office:      { n: 'Repartição pública', e: '🏛️', cost: 130, w: .4, fx: { svc: 'adm' }, max: 5 },
  guard:       { n: 'Guarda', e: '🛡️', cost: 110, w: .4, fx: { svc: 'sec' }, max: 5 },
  // militares
  shipyard:    { n: 'Estaleiro', e: '🛠️', cost: 160, w: .6, req: 'coast', fx: { yard: .15 }, max: 2 },
  barracks:    { n: 'Quartel', e: '⛺', cost: 100, w: .4, fx: { mp: .05, rec: 1 }, max: 3 },
  academy:     { n: 'Academia militar', e: '🎖️', cost: 300, w: .3, fx: { army: .03 }, tech: 'mil_drill', max: 2 },
  airbase:     { n: 'Base aérea', e: '✈️', cost: 700, w: .5, in: { oil: .5 }, fx: { army: .04 }, tech: 'mil_aircraft', max: 2 },
  launch_site: { n: 'Centro de lançamento', e: '🚀', cost: 1500, w: 1, in: { steel: 1, elec: .5, power: .5 }, fx: { launch: 1 }, tech: 'spc_rockets', max: 1 },
  // vertentes
  clock_works: { n: 'Oficina de engrenagens', e: '⚙️', cost: 220, w: 1, in: { iron: 1, tools: .3 }, out: { gears: 1 }, vert: 'clock' },
  steam_foundry:{ n: 'Fundição a vapor', e: '♨️', cost: 300, w: 2, in: { iron: 1.5, coal: 1.5 }, out: { boilers: 1.2 }, vert: 'steam' },
  tesla_tower: { n: 'Torre Tesla', e: '⚡', cost: 380, w: 1, in: { steel: .5, copper: 1, coal: .5 }, out: { coils: 1.2, power: 4 }, vert: 'tesla' },
  diesel_works:{ n: 'Fábrica de motores', e: '🛞', cost: 400, w: 2, in: { steel: 1, oil: 1.5 }, out: { engines: 1.2 }, vert: 'diesel' },
  reactor:     { n: 'Reator atômico', e: '☢️', cost: 600, w: 1, in: { steel: 1, uranium: 1 }, out: { cores: .8, power: 8 }, vert: 'atom' },
  biovat:      { n: 'Tanque biológico', e: '🧬', cost: 450, w: 1, in: { grain: 3 }, out: { biomass: 1.6 }, vert: 'bio' },
  chipfab:     { n: 'Fábrica de implantes', e: '💾', cost: 700, w: 2, in: { elec: .8, rare: .6, power: .8 }, out: { chips: 1.1 }, vert: 'cyber' },
  solar_array: { n: 'Fazenda solar', e: '☀️', cost: 600, w: 1, in: { steel: .5, elec: .2 }, out: { panels: 1.6, power: 6 }, vert: 'solar' },
  nanoforge:   { n: 'Nanoforja', e: '🔬', cost: 900, w: 1, in: { elec: .5, gold: .2, rare: .2, power: 1 }, out: { nanites: .7 }, vert: 'nano' },
  spaceport:   { n: 'Porto espacial', e: '🚀', cost: 1200, w: 2, in: { steel: 2, elec: 1, power: 1.5 }, out: { he3: .6 }, fx: { launch: 1 }, vert: 'space' },
};

/* grupos de prédios (painel do estado e janela de construção) */
CONTENT.BGROUPS = [['prod', '🌾 Produção e extração', ['farm', 'stud', 'mill', 'fishery', 'lumber', 'quarry', 'plantation', 'iron_mine', 'coal_mine', 'gold_mine', 'copper_mine', 'uranium_mine', 'rare_mine', 'oil_well']],
  ['ind', '🏭 Indústria', ['apothecary', 'pharma', 'weaver', 'textile_manuf', 'tailor', 'bakery', 'garment_factory', 'food_factory', 'workshop', 'smithy', 'foundry', 'blast_furnace', 'jeweler', 'manufactory', 'textile_mill', 'goods_factory', 'tool_factory', 'arms_factory', 'steel_mill', 'electronics']],
  ['energy', '⚡ Energia', ['power_plant', 'oil_plant', 'hydro', 'nuclear', 'wind', 'solar_plant', 'fusion']],
  ['infra', '🛤️ Transporte e comércio', ['road', 'railway', 'highway', 'hsr', 'maglev', 'tubes', 'portal', 'pipeline', 'port', 'market']],
  ['svc', '🏛️ Serviços públicos', ['hospital', 'school', 'office', 'guard', 'university', 'temple']],
  ['mil', '⚔️ Militar', ['castle', 'shipyard', 'barracks', 'academy', 'airbase', 'launch_site']],
  ['vert', '✨ Vertente', []]];

/* ---------- serviços públicos: nome do prédio muda com a era; cada nível atende SVC_CAP(ano) mil pessoas ---------- */
CONTENT.SVC = {
  health: { n: 'Saúde', e: '🏥', b: 'hospital', names: [[860, 'Casa de caridade'], [1650, 'Hospital'], [1900, 'Hospital moderno'], [2000, 'Centro médico'], [2080, 'Clínica de regeneração']], d: 'Crescimento da população, teto populacional e resistência a pragas' },
  edu:    { n: 'Educação', e: '📚', b: 'school', names: [[860, 'Escola monástica'], [1500, 'Escola'], [1850, 'Escola pública'], [2000, 'Campus digital'], [2080, 'Rede neural de ensino']], d: 'Pesquisa' },
  adm:    { n: 'Administração', e: '🏛️', b: 'office', names: [[860, 'Chancelaria local'], [1500, 'Intendência'], [1850, 'Repartição pública'], [2000, 'Governo digital'], [2080, 'Administração algorítmica']], d: 'Impostos, menos corrupção e obras mais baratas' },
  sec:    { n: 'Segurança', e: '🛡️', b: 'guard', names: [[860, 'Guarda'], [1600, 'Milícia urbana'], [1830, 'Polícia'], [2000, 'Segurança inteligente'], [2080, 'Vigilância preditiva']], d: 'Estabilidade e menos golpes' },
};
