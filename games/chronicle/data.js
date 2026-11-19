/* Grand Chronicle — dados do jogo: bens, prédios, tecnologias, vertentes, governos, ideologias, unidades, traços e nomes.
   Tudo aqui é tabela; a lógica fica em sim/ (um arquivo por sistema; fases do mês em sim/tick.js). Para equilibrar, mexa nos números daqui. */
'use strict';

const START_YEAR = 860, END_YEAR = 2200;

/* ---------- bens (p = preço base em ducados) ---------- */
const GOODS = {
  grain:   { n: 'Grãos', p: 2, c: 'food', e: '🌾' },
  fish:    { n: 'Peixe', p: 2.4, c: 'food', e: '🐟' },
  wood:    { n: 'Madeira', p: 2, c: 'raw', e: '🪵' },
  stone:   { n: 'Pedra', p: 2, c: 'raw', e: '🪨' },
  iron:    { n: 'Ferro', p: 4, c: 'raw', e: '⛓️' },
  coal:    { n: 'Carvão', p: 3.5, c: 'raw', e: '⚫' },
  gold:    { n: 'Ouro', p: 20, c: 'raw', e: '🪙' },
  fiber:   { n: 'Fibras', p: 2.5, c: 'raw', e: '🧶' },
  oil:     { n: 'Petróleo', p: 7, c: 'raw', e: '🛢️' },
  copper:  { n: 'Cobre', p: 5, c: 'raw', e: '🟠' },
  uranium: { n: 'Urânio', p: 14, c: 'raw', e: '☢️' },
  rare:    { n: 'Terras raras', p: 16, c: 'raw', e: '💠' },
  cloth:   { n: 'Tecido', p: 5, c: 'ind', e: '🧵' },
  clothes: { n: 'Roupas', p: 7, c: 'ind', e: '👕' },
  pfood:   { n: 'Comida processada', p: 5, c: 'ind', e: '🥫' },
  goods:   { n: 'Bens de consumo', p: 8, c: 'ind', e: '🏺' },
  tools:   { n: 'Ferramentas', p: 7, c: 'ind', e: '🔨' },
  arms:    { n: 'Armas', p: 9, c: 'ind', e: '🗡️' },
  steel:   { n: 'Aço', p: 8, c: 'ind', e: '🔩' },
  elec:    { n: 'Eletrônicos', p: 25, c: 'ind', e: '📟' },
  lux:     { n: 'Luxo', p: 20, c: 'lux', e: '💎' },
  power:   { n: 'Energia', p: 6, c: 'ind', e: '⚡' },
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
const GOOD_IDS = Object.keys(GOODS);

/* ---------- classes sociais: necessidades por 1.000 pessoas/mês (crescem com o padrão de vida da era) ----------
   staple = grãos ou peixe · as outras chaves são bens · svc = serviços públicos que a classe cobra (saúde e educação) */
const CLASSES = {
  slave: { n: 'Escravos', e: '⛓️', col: '#8a6d5a', d: 'Mão de obra forçada: trabalham em fazendas, plantações, minas e madeireiras rendendo mais e só comem.\nNão votam nem compram nada. Muitos escravos derrubam a estabilidade e causam revoltas.' },
  low:   { n: 'Classe baixa', e: '🧑‍🌾', col: '#b59a6a', d: 'Camponeses, pescadores e operários: a maior parte do povo e do contingente.\nPrecisam de comida e roupas; com fome ou sem roupa, fazem revoltas populares.' },
  mid:   { n: 'Classe média', e: '🧑‍💼', col: '#7fb3d5', d: 'Artesãos, comerciantes, burocratas, professores e técnicos.\nCompram comida processada, roupas e bens; querem saúde e educação. Satisfeita: mais pesquisa e impostos.' },
  high:  { n: 'Classe alta', e: '🎩', col: '#d9b45a', d: 'Nobreza, clero, oficiais e capitalistas.\nConsome luxo, roupas e comida processada. Insatisfeita: apoia golpes contra o governo.' },
};
const CLASS_IDS = Object.keys(CLASSES);
function classNeeds(year, k) {
  const t = Math.max(0, Math.min(1, (year - 860) / 900)), ti = Math.max(0, Math.min(1, (year - 1760) / 200)), t2 = Math.max(0, Math.min(1, (year - 1950) / 250));
  const pw = year < 1890 ? 0 : .01 + .05 * Math.min(1, (year - 1890) / 110) + .12 * t2, el = year < 1950 ? 0 : .01 + .12 * t2;
  if (k === 'slave') return { staple: .85 };
  if (k === 'low') return { staple: 1, clothes: .025 + .015 * t + .04 * ti, goods: .01 + .012 * t + .06 * ti + .08 * t2, pfood: .03 * ti + .1 * t2, power: pw * .7, elec: el * .6 };
  if (k === 'mid') return { staple: .8, pfood: .12 + .1 * t + .2 * ti, clothes: .07 + .04 * t + .08 * ti, goods: .06 + .05 * t + .15 * ti + .15 * t2, lux: .002 + .004 * t + .01 * ti, tools: .01, power: pw * 1.4, elec: el * 1.6, svc: 1 };
  return { staple: .6, pfood: .35 + .2 * ti, clothes: .18 + .1 * ti, goods: .2 + .2 * ti + .2 * t2, lux: .04 + .07 * t + .12 * ti, power: pw * 2.5, elec: el * 3, svc: 1 };
}
/* quem trabalha em cada grupo de prédios (fração de cada classe) */
const JOBS = { prod: { low: .93, mid: .05, high: .02 }, ind: { low: .8, mid: .16, high: .04 }, energy: { low: .65, mid: .3, high: .05 }, infra: { low: .82, mid: .15, high: .03 },
  svc: { low: .2, mid: .72, high: .08 }, mil: { low: .45, mid: .35, high: .2 }, vert: { low: .55, mid: .35, high: .1 }, trade: { low: .4, mid: .5, high: .1 } };
const JOB_N = { prod: 'Agricultura e extração', ind: 'Indústria e artesanato', energy: 'Energia', infra: 'Transporte', svc: 'Serviços públicos', mil: 'Militar', vert: 'Vertente', trade: 'Comércio' };
const SLAVE_JOBS = ['farm', 'plantation', 'lumber', 'quarry', 'iron_mine', 'coal_mine', 'gold_mine', 'copper_mine'];

/* ---------- prédios (no estado; nível = quantas unidades) ----------
   w = mil trabalhadores por nível · in/out = bens por mês por nível · req = condição do estado · tech = tecnologia que libera */
const BUILDINGS = {
  farm:        { n: 'Fazenda', e: '🌾', cost: 60, w: 2, out: { grain: 4.4 }, req: 'arable', tl: .04 },
  fishery:     { n: 'Pesqueiro', e: '🐟', cost: 50, w: 1, out: { fish: 2.6 }, req: 'coast', tl: .03 },
  lumber:      { n: 'Madeireira', e: '🪵', cost: 45, w: 1, out: { wood: 3 }, req: 'forest', tl: .04 },
  quarry:      { n: 'Pedreira', e: '🪨', cost: 50, w: 1, out: { stone: 2.6 }, req: 'rocky', tl: .05 },
  iron_mine:   { n: 'Mina de ferro', e: '⛓️', cost: 80, w: 1.5, out: { iron: 2.2 }, req: 'res:iron', tl: .06 },
  coal_mine:   { n: 'Mina de carvão', e: '⚫', cost: 80, w: 1.5, out: { coal: 2.6 }, req: 'res:coal', tech: 'eco_deepmining', tl: .06 },
  gold_mine:   { n: 'Mina de ouro', e: '🪙', cost: 120, w: 1, out: { gold: .45 }, req: 'res:gold', tl: .05 },
  plantation:  { n: 'Plantação', e: '🧶', cost: 60, w: 2, out: { fiber: 3.4 }, req: 'warm', tl: .04 },
  weaver:      { n: 'Tecelagem', e: '🧵', cost: 70, w: 1, in: { fiber: 2 }, out: { cloth: 1.6 }, tl: .03 },
  tailor:      { n: 'Alfaiataria', e: '👕', cost: 70, w: 1, in: { cloth: 1 }, out: { clothes: 1.2 }, tl: .03 },
  bakery:      { n: 'Padaria e salgadeira', e: '🥫', cost: 60, w: 1, in: { grain: 1.4, fish: .4 }, out: { pfood: 1.5 }, tl: .02 },
  workshop:    { n: 'Oficina de artesãos', e: '🏺', cost: 80, w: 1, in: { wood: 1, cloth: .3 }, out: { goods: .85 }, tl: .05 },
  smithy:      { n: 'Ferraria', e: '🔨', cost: 90, w: 1, in: { iron: 1, wood: .6 }, out: { tools: .5, arms: .45 } },
  jeweler:     { n: 'Ourivesaria', e: '💎', cost: 120, w: .6, in: { gold: .2, cloth: .2 }, out: { lux: .42 }, tech: 'eco_guilds' },
  market:      { n: 'Mercado', e: '🏪', cost: 90, w: .5, fx: { tax: .06 }, tech: 'eco_trade_fairs', max: 3 },
  castle:      { n: 'Castelo', e: '🏰', cost: 150, w: .3, fx: { fort: 1 }, max: 3 },
  port:        { n: 'Porto', e: '⚓', cost: 120, w: .6, fx: { port: 1, trade: .04 }, req: 'coast', max: 3 },
  university:  { n: 'Universidade', e: '🎓', cost: 160, w: .4, fx: { research: 2.5 }, tech: 'soc_universities', max: 3 },
  temple:      { n: 'Templo', e: '⛪', cost: 100, w: .3, fx: { stab: .5 }, max: 2 },
  mill:        { n: 'Moinho e celeiro', e: '🥖', cost: 90, w: .5, fx: { mill: .15 }, tech: 'eco_watermill', max: 2 },
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
  copper_mine: { n: 'Mina de cobre', e: '🟠', cost: 80, w: 1.5, out: { copper: 2.4 }, req: 'res:copper', tl: .06 },
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
  pipeline:    { n: 'Oleoduto e gasoduto', e: '🧪', cost: 350, w: .3, in: { steel: .2 }, fx: { pipe: 1 }, tech: 'eco_pipelines', max: 1 },
  // serviços públicos (cobertura por estado)
  hospital:    { n: 'Hospital', e: '🏥', cost: 120, w: .4, fx: { svc: 'health' }, max: 5 },
  school:      { n: 'Escola', e: '📚', cost: 110, w: .4, fx: { svc: 'edu' }, max: 5 },
  office:      { n: 'Repartição pública', e: '🏛️', cost: 130, w: .4, fx: { svc: 'adm' }, max: 5 },
  guard:       { n: 'Guarda', e: '🛡️', cost: 110, w: .4, fx: { svc: 'sec' }, max: 5 },
  // militares
  shipyard:    { n: 'Estaleiro', e: '🛠️', cost: 160, w: .6, req: 'coast', fx: { yard: 1 }, max: 2 },
  barracks:    { n: 'Quartel', e: '⛺', cost: 100, w: .4, fx: { mp: .05 }, max: 3 },
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

/* ---------- tecnologias ----------
   c: mil (militar) · nav (naval) · eco (economia) · soc (sociedade) · y: ano em que fica no tempo; dá para pesquisar antes, mais caro
   fx: b prédios · g governos · i ideologias · m modificadores nacionais · u força das unidades · bo produção de prédios · fort · sea (1 costeiro, 2 oceano) · col (colonizar) · slots (obras ao mesmo tempo) */
const TECHS = [];
const T = (id, c, y, n, req, fx) => TECHS.push({ id, c, y, n, req: req || [], fx: fx || {} });
// militar
T('mil_levy', 'mil', 860, 'Recrutamento feudal', [], { u: { inf: .05 } });
T('mil_chainmail', 'mil', 880, 'Cota de malha', ['mil_levy'], { u: { inf: .1 } });
T('mil_shieldwall', 'mil', 900, 'Parede de escudos', ['mil_chainmail'], { u: { inf: .08 }, m: { army: .03 } });
T('mil_motte', 'mil', 930, 'Mota e paliçada', ['mil_levy'], { fort: 1 });
T('mil_stirrup', 'mil', 950, 'Cavalaria pesada', ['mil_chainmail'], { u: { cav: .25 } });
T('mil_castles', 'mil', 1000, 'Castelos de pedra', ['mil_chainmail'], { fort: 1 });
T('mil_crossbow', 'mil', 1050, 'Besta', ['mil_chainmail'], { u: { inf: .15 } });
T('mil_trebuchet', 'mil', 1150, 'Trabuco', ['mil_castles'], { u: { art: .4, siege: .5 } });
T('mil_plate', 'mil', 1300, 'Armadura de placas', ['mil_crossbow', 'mil_stirrup'], { u: { inf: .1, cav: .2 } });
T('mil_pike', 'mil', 1320, 'Piqueiros', ['mil_plate'], { u: { inf: .2 } });
T('mil_gunpowder', 'mil', 1340, 'Pólvora', ['mil_trebuchet'], { u: { art: .2 } });
T('mil_bombard', 'mil', 1400, 'Bombardas', ['mil_gunpowder'], { u: { art: .5, siege: .6 } });
T('mil_arquebus', 'mil', 1450, 'Arcabuz', ['mil_bombard', 'mil_pike'], { u: { inf: .3 } });
T('mil_bastion', 'mil', 1520, 'Fortificação abaluartada', ['mil_bombard'], { fort: 1 });
T('mil_musket', 'mil', 1580, 'Mosquete', ['mil_arquebus'], { u: { inf: .35 } });
T('mil_drill', 'mil', 1620, 'Exército permanente', ['mil_musket'], { m: { army: .1 }, b: ['academy'] });
T('mil_bayonet', 'mil', 1690, 'Baioneta', ['mil_drill'], { u: { inf: .4, cav: .2 } });
T('mil_fieldart', 'mil', 1720, 'Artilharia de campanha', ['mil_bayonet'], { u: { art: .6 } });
T('mil_conscription', 'mil', 1790, 'Conscrição em massa', ['mil_fieldart', 'soc_nationalism'], { m: { manpower: .3 } });
T('mil_rifle', 'mil', 1840, 'Fuzil raiado', ['mil_conscription'], { u: { inf: .6 } });
T('mil_breech', 'mil', 1865, 'Retrocarga', ['mil_rifle'], { u: { inf: .5, art: .6 } });
T('mil_machinegun', 'mil', 1885, 'Metralhadora', ['mil_breech'], { u: { inf: .9 } });
T('mil_trench', 'mil', 1910, 'Guerra de trincheiras', ['mil_machinegun'], { u: { inf: .5 }, fort: 1 });
T('mil_aircraft', 'mil', 1915, 'Aviação militar', ['mil_machinegun', 'eco_assembly'], { u: { inf: .4, cav: .4, art: .4 }, b: ['airbase'] });
T('mil_tank', 'mil', 1916, 'Tanques', ['mil_trench', 'eco_oil'], { u: { cav: 1.5 } });
T('mil_blitz', 'mil', 1937, 'Guerra mecanizada', ['mil_tank', 'mil_aircraft'], { u: { cav: 1.2, inf: .6 }, m: { speed: .3 } });
T('mil_jet', 'mil', 1950, 'Caças a jato', ['mil_blitz'], { u: { inf: .6, cav: .6, art: .6 } });
T('mil_nuclear', 'mil', 1950, 'Armas nucleares', ['mil_blitz', 'eco_electricity'], { u: { art: 2 }, m: { stab: .05 } });
T('mil_missile', 'mil', 1965, 'Mísseis guiados', ['mil_jet', 'eco_computers'], { u: { art: 1.5 } });
T('mil_stealth', 'mil', 1985, 'Furtividade', ['mil_missile'], { u: { cav: 1, art: 1 } });
T('mil_drones', 'mil', 2010, 'Drones de combate', ['mil_stealth', 'eco_internet'], { u: { inf: 1.2, art: 1.2 } });
T('mil_exo', 'mil', 2050, 'Exoesqueletos', ['mil_drones'], { u: { inf: 2 } });
T('mil_railgun', 'mil', 2080, 'Canhões eletromagnéticos', ['mil_exo', 'eco_fusion'], { u: { art: 2.5 } });
T('mil_swarm', 'mil', 2120, 'Enxames autônomos', ['mil_railgun', 'eco_ai'], { u: { inf: 2.5, cav: 2.5 } });
T('mil_orbital', 'mil', 2170, 'Bombardeio orbital', ['mil_swarm'], { u: { art: 4, siege: 3 } });
// naval
T('nav_longship', 'nav', 860, 'Barcos longos', [], { sea: 1 });
T('nav_raids', 'nav', 900, 'Expedições de saque', ['nav_longship'], { m: { speed: .05 }, ship: .15 });
T('nav_knarr', 'nav', 1000, 'Knarr mercante', ['nav_raids'], { m: { trade: .05 } });
T('nav_cog', 'nav', 1150, 'Coca', ['nav_knarr'], { m: { trade: .05 }, ship: .3 });
T('nav_compass', 'nav', 1250, 'Bússola', ['nav_cog'], { m: { speed: .05 }, ship: .2 });
T('nav_caravel', 'nav', 1430, 'Caravela', ['nav_compass'], { sea: 2, ship: .3 });
T('nav_astrolabe', 'nav', 1460, 'Astrolábio náutico', ['nav_caravel'], { col: 1, m: { colon: .1 } });
T('nav_galleon', 'nav', 1530, 'Galeão', ['nav_astrolabe'], { ship: .5, m: { trade: .05 } });
T('nav_lineship', 'nav', 1640, 'Navio de linha', ['nav_galleon'], { ship: .6 });
T('nav_steamship', 'nav', 1820, 'Navio a vapor', ['nav_lineship', 'eco_steam'], { ship: .6, m: { speed: .1, trade: .05 } });
T('nav_ironclad', 'nav', 1860, 'Encouraçado', ['nav_steamship'], { ship: 1 });
T('nav_dreadnought', 'nav', 1906, 'Dreadnought', ['nav_ironclad', 'eco_bessemer'], { ship: 1.5 });
T('nav_submarine', 'nav', 1914, 'Submarino', ['nav_dreadnought'], { ship: 1 });
T('nav_carrier', 'nav', 1925, 'Porta-aviões', ['nav_submarine', 'mil_aircraft'], { ship: 1.5 });
T('nav_nuclearsub', 'nav', 1955, 'Submarino nuclear', ['nav_carrier', 'mil_nuclear'], { ship: 2 });
T('nav_container', 'nav', 1960, 'Navios porta-contêineres', ['nav_carrier'], { m: { trade: .15 } });
T('nav_aegis', 'nav', 1985, 'Destróier de mísseis', ['nav_nuclearsub', 'mil_missile'], { ship: 2 });
T('nav_autonomous', 'nav', 2040, 'Frotas autônomas', ['nav_aegis', 'eco_ai'], { ship: 3 });
T('spc_rockets', 'nav', 2050, 'Programa espacial', ['nav_autonomous'], { b: ['launch_site'], m: { research: .03 } });
T('spc_sat', 'nav', 2055, 'Satélites', ['spc_rockets'], {});
T('spc_probe', 'nav', 2065, 'Sondas lunares', ['spc_sat'], {});
T('spc_landing', 'nav', 2080, 'Pouso tripulado', ['spc_probe'], { m: { stab: .05 } });
T('nav_seastead', 'nav', 2090, 'Cidades flutuantes', ['nav_autonomous'], { m: { growth: .1, trade: .1 } });
T('spc_base', 'nav', 2095, 'Base lunar', ['spc_landing'], {});
T('spc_contact', 'nav', 2110, 'Protocolos de contato', ['spc_base'], {});
T('nav_orbit', 'nav', 2150, 'Navegação orbital', ['nav_seastead'], { ship: 4, m: { speed: .3 } });
// economia
T('eco_heavyplough', 'eco', 900, 'Arado pesado', [], { bo: { farm: .15 } });
T('eco_coinage', 'eco', 920, 'Cunhagem', [], { m: { tax: .05 } });
T('eco_watermill', 'eco', 980, 'Moinho d’água', ['eco_heavyplough'], { m: { prod: .05 }, b: ['mill'] });
T('eco_three_field', 'eco', 1050, 'Rotação trienal', ['eco_heavyplough'], { bo: { farm: .2 }, m: { growth: .1 } });
T('eco_trade_fairs', 'eco', 1100, 'Feiras comerciais', ['eco_watermill'], { b: ['market'], m: { trade: .05 } });
T('eco_guilds', 'eco', 1180, 'Guildas', ['eco_trade_fairs'], { b: ['jeweler'], bo: { workshop: .2, smithy: .15 } });
T('eco_deepmining', 'eco', 1200, 'Mineração profunda', ['eco_watermill'], { b: ['coal_mine'], bo: { iron_mine: .2, gold_mine: .2 } });
T('eco_banking', 'eco', 1300, 'Bancos', ['eco_guilds'], { m: { tax: .08 } });
T('eco_doubleentry', 'eco', 1450, 'Partidas dobradas', ['eco_banking'], { m: { tax: .06 }, slots: 1 });
T('eco_foundry', 'eco', 1450, 'Fundição de ferro', ['eco_deepmining'], { b: ['foundry'] });
T('eco_colonization', 'eco', 1490, 'Colonização', ['eco_doubleentry', 'nav_caravel'], { col: 1, m: { colon: .1 } });
T('eco_mercantilism', 'eco', 1520, 'Mercantilismo', ['eco_doubleentry'], { i: ['mercant'], m: { trade: .1 } });
T('eco_manufactory', 'eco', 1560, 'Manufaturas', ['eco_mercantilism'], { b: ['manufactory', 'textile_manuf'] });
T('eco_blastfurnace', 'eco', 1600, 'Alto-forno', ['eco_foundry'], { b: ['blast_furnace'] });
T('eco_companies', 'eco', 1600, 'Companhias de comércio', ['eco_colonization', 'eco_mercantilism'], { col: 1, m: { trade: .1, colon: .15 } });
T('eco_agri_rev', 'eco', 1700, 'Revolução agrícola', ['eco_manufactory'], { bo: { farm: .3, plantation: .2 }, m: { growth: .15 } });
T('eco_steam', 'eco', 1770, 'Máquina a vapor', ['eco_agri_rev'], { m: { prod: .08 }, slots: 1 });
T('eco_textile', 'eco', 1780, 'Maquinário têxtil', ['eco_steam'], { b: ['textile_mill'] });
T('eco_factory', 'eco', 1800, 'Sistema fabril', ['eco_textile'], { b: ['goods_factory', 'garment_factory'] });
T('eco_mechanization', 'eco', 1820, 'Mecanização', ['eco_factory'], { b: ['tool_factory', 'food_factory'] });
T('eco_interchangeable', 'eco', 1830, 'Peças intercambiáveis', ['eco_mechanization'], { b: ['arms_factory'] });
T('eco_railways', 'eco', 1830, 'Ferrovias', ['eco_steam'], { b: ['railway'], slots: 1 });
T('eco_bessemer', 'eco', 1856, 'Processo Bessemer', ['eco_railways'], { b: ['steel_mill'] });
T('eco_oil', 'eco', 1870, 'Perfuração de petróleo', ['eco_bessemer'], { b: ['oil_well'] });
T('eco_electricity', 'eco', 1885, 'Eletricidade', ['eco_oil'], { b: ['power_plant', 'hydro', 'uranium_mine'], m: { research: .05 } });
T('eco_oil_power', 'eco', 1900, 'Termelétricas a óleo', ['eco_electricity'], { b: ['oil_plant'] });
T('eco_pipelines', 'eco', 1905, 'Oleodutos e gasodutos', ['eco_oil'], { b: ['pipeline'], m: { trade: .03 } });
T('eco_fertilizer', 'eco', 1910, 'Fertilizantes químicos', ['eco_electricity'], { bo: { farm: .35 }, m: { growth: .1 } });
T('eco_assembly', 'eco', 1913, 'Linha de montagem', ['eco_electricity'], { b: ['rare_mine'], m: { prod: .12 }, slots: 1 });
T('eco_highways', 'eco', 1920, 'Rodovias', ['eco_assembly'], { b: ['highway'] });
T('eco_nuclear', 'eco', 1955, 'Energia nuclear', ['eco_assembly', 'eco_electricity'], { b: ['nuclear'] });
T('eco_hsr', 'eco', 1965, 'Trem de alta velocidade', ['eco_highways'], { b: ['hsr'] });
T('eco_transistor', 'eco', 1950, 'Transistor', ['eco_assembly'], { b: ['electronics'] });
T('eco_green_rev', 'eco', 1960, 'Revolução verde', ['eco_fertilizer'], { bo: { farm: .5 }, m: { growth: .15 } });
T('eco_computers', 'eco', 1965, 'Computadores', ['eco_transistor'], { m: { research: .12 } });
T('eco_automation', 'eco', 1980, 'Automação', ['eco_computers'], { m: { prod: .15 }, slots: 1 });
T('eco_wind', 'eco', 1980, 'Energia eólica', ['eco_automation'], { b: ['wind'] });
T('eco_internet', 'eco', 1993, 'Internet', ['eco_automation'], { m: { research: .12, trade: .1 } });
T('eco_solar', 'eco', 1995, 'Energia solar', ['eco_wind'], { b: ['solar_plant'] });
T('eco_maglev', 'eco', 2030, 'Maglev', ['eco_hsr', 'eco_internet'], { b: ['maglev'] });
T('eco_ai', 'eco', 2030, 'Inteligência artificial', ['eco_internet'], { m: { research: .15, prod: .1 } });
T('eco_fusion', 'eco', 2070, 'Fusão nuclear', ['eco_ai'], { b: ['fusion'], m: { prod: .1 } });
T('eco_tubes', 'eco', 2080, 'Tubos a vácuo', ['eco_maglev', 'eco_fusion'], { b: ['tubes'] });
T('eco_molecular', 'eco', 2110, 'Manufatura molecular', ['eco_fusion'], { m: { prod: .2 }, slots: 2 });
T('eco_postscarcity', 'eco', 2150, 'Pós-escassez', ['eco_molecular'], { m: { prod: .25, stab: .1 } });
T('eco_portals', 'eco', 2160, 'Portais', ['eco_tubes', 'eco_postscarcity'], { b: ['portal'] });
// sociedade
T('soc_feudal', 'soc', 860, 'Direito feudal', [], { g: ['feudal', 'elective'] });
T('soc_monasteries', 'soc', 900, 'Mosteiros', ['soc_feudal'], { m: { stab: .03, research: .04 } });
T('soc_vassalage', 'soc', 940, 'Vassalagem', ['soc_feudal'], { m: { manpower: .1 } });
T('soc_chancery', 'soc', 950, 'Chancelaria', ['soc_feudal'], { m: { tax: .05 } });
T('soc_charters', 'soc', 1080, 'Cartas municipais', ['soc_chancery'], { g: ['merchant', 'oligarchic'] });
T('soc_universities', 'soc', 1100, 'Universidades', ['soc_chancery'], { b: ['university'] });
T('soc_orders', 'soc', 1120, 'Ordens militares', ['soc_feudal'], { g: ['military_order', 'theocracy'], m: { army: .05 } });
T('soc_scholastic', 'soc', 1200, 'Escolástica', ['soc_universities'], { m: { research: .08 }, g: ['sages'] });
T('soc_common_law', 'soc', 1250, 'Direito comum', ['soc_charters'], { m: { stab: .05 }, g: ['khanate'] });
T('soc_printing', 'soc', 1450, 'Imprensa', ['soc_scholastic'], { m: { research: .12 } });
T('soc_humanism', 'soc', 1470, 'Humanismo', ['soc_printing'], { m: { stab: .03, research: .05 }, g: ['principality', 'city_state', 'sultanate'] });
T('soc_absolutism', 'soc', 1600, 'Absolutismo', ['soc_humanism', 'soc_common_law'], { g: ['absolute'], i: ['absolut'], slots: 1 });
T('soc_scientific', 'soc', 1620, 'Revolução científica', ['soc_humanism'], { m: { research: .15 } });
T('soc_glorious', 'soc', 1680, 'Revolução parlamentar', ['soc_scientific', 'soc_absolutism'], { g: ['parl_monarchy', 'company', 'protectorate'], m: { stab: .03 } });
T('soc_enlightenment', 'soc', 1700, 'Iluminismo', ['soc_scientific'], { g: ['enlightened', 'constitutional'], i: ['liberal'] });
T('soc_constitution', 'soc', 1780, 'Constitucionalismo', ['soc_enlightenment'], { g: ['parliamentary', 'presidential'], i: ['conservative', 'radical'] });
T('soc_nationalism', 'soc', 1800, 'Nacionalismo', ['soc_constitution'], { g: ['federal', 'junta', 'caudillo'], m: { manpower: .15 } });
T('soc_socialism', 'soc', 1848, 'Socialismo', ['soc_nationalism', 'eco_factory'], { g: ['peoples', 'commune'], i: ['socialism', 'anarchism'] });
T('soc_unions', 'soc', 1880, 'Sindicatos', ['soc_socialism'], { g: ['syndicalist'], i: ['syndicalism'] });
T('soc_mass_politics', 'soc', 1890, 'Política de massas', ['soc_unions'], { i: ['socdem', 'natpop', 'agrarian'] });
T('soc_mass_media', 'soc', 1920, 'Comunicação de massa', ['soc_mass_politics', 'eco_electricity'], { g: ['one_party', 'totalitarian'], i: ['totalism', 'futurism'] });
T('soc_technocracy', 'soc', 1930, 'Tecnocracia', ['soc_mass_media'], { g: ['technate'], i: ['technocrat'] });
T('soc_welfare', 'soc', 1945, 'Estado de bem-estar', ['soc_mass_media'], { m: { stab: .1, growth: .05 }, g: ['peoples_dem', 'mil_regime', 'social_state'] });
T('soc_globalization', 'soc', 1990, 'Globalização', ['soc_welfare', 'eco_internet'], { i: ['neolib', 'green'], m: { trade: .1 } });
T('soc_transhumanism', 'soc', 2020, 'Transumanismo', ['soc_globalization'], { i: ['transhum'], g: ['corporate', 'net_state', 'surveillance'] });
T('soc_digital_dem', 'soc', 2040, 'Democracia digital', ['soc_transhumanism'], { g: ['liquid'] });
T('soc_ai_gov', 'soc', 2080, 'Governança algorítmica', ['soc_digital_dem', 'eco_ai'], { g: ['synthocracy'], i: ['accel'] });
T('soc_posthuman', 'soc', 2120, 'Pós-humanismo', ['soc_ai_gov'], { i: ['posthuman'], m: { research: .2 }, g: ['hive'] });
T('soc_galactic', 'soc', 2165, 'Hegemonia orbital', ['soc_posthuman', 'nav_orbit'], { g: ['hegemony', 'star_empire'], i: ['cosmism'] });
const TECH = Object.fromEntries(TECHS.map(t => [t.id, t]));
const CATS = { mil: 'Militar', nav: 'Naval', eco: 'Economia', soc: 'Sociedade' };

/* ---------- vertentes ----------
   Cada vertente entra na árvore normal por uma tecnologia de entrada (ex.: Clockpunk em Economia por volta de 1360, depois de Guildas).
   Quem pesquisa a entrada fica preso a ela: as tecnologias militares, navais e econômicas posteriores da árvore normal são
   substituídas pela árvore da vertente, que leva o mesmo "futuro" (até a colonização espacial) pelo caminho da vertente.
   tree: [ano, área, nome] · m: bônus total da árvore completa · unit: nomes da unidade especial ao longo da árvore */
const VERTS = [
  { id: 'clock', need: 'iron', n: 'Clockpunk', e: '⚙️', col: '#c9a227', good: 'gears', bld: 'clock_works', m: { prod: .2, research: .2 },
    entry: { y: 1360, c: 'eco', req: ['eco_guilds'], n: 'Mecanismos de relojoaria' },
    tree: [[1420, 'mil', 'Bestas de corda'], [1450, 'eco', 'Moinhos de engrenagem'], [1500, 'nav', 'Caravelas de relojoaria'], [1560, 'mil', 'Autômatos de guerra'], [1620, 'eco', 'Manufatura autômata'], [1700, 'nav', 'Navios de corda'], [1780, 'eco', 'Fábricas de relojoaria'], [1850, 'mil', 'Golens de engrenagem'], [1880, 'eco', 'Motores diferenciais'], [1920, 'nav', 'Submarinos de corda'], [1950, 'mil', 'Androides de corda'], [1980, 'eco', 'Cérebros analíticos'], [2020, 'eco', 'Relojoaria quântica'], [2050, 'mil', 'Colossos mecânicos'], [2075, 'nav', 'Dirigíveis de engrenagem'], [2100, 'eco', 'Engrenagens perpétuas'], [2150, 'nav', 'Arcas celestes de relojoaria'], [2190, 'mil', 'Titãs eternos']],
    unit: ['Autômatos', 'Autômatos de guerra', 'Golens de engrenagem', 'Androides de corda', 'Colossos mecânicos', 'Titãs eternos'] },
  { id: 'steam', need: 'coal', n: 'Steampunk', e: '♨️', col: '#a0522d', good: 'boilers', bld: 'steam_foundry', m: { prod: .3, army: .15 },
    entry: { y: 1640, c: 'eco', req: ['eco_manufactory'], n: 'Caldeiras primitivas' },
    tree: [[1700, 'eco', 'Caldeiras de alta pressão'], [1730, 'nav', 'Navios a roda'], [1760, 'mil', 'Canhões a vapor'], [1800, 'eco', 'Cidades de vapor'], [1830, 'nav', 'Dirigíveis'], [1870, 'mil', 'Caminhantes a vapor'], [1890, 'eco', 'Locomotivas colossais'], [1920, 'eco', 'Megafornalhas'], [1960, 'nav', 'Encouraçados aéreos'], [2000, 'mil', 'Encouraçados terrestres'], [2030, 'eco', 'Vapor sintético'], [2060, 'eco', 'Caldeiras etéreas'], [2110, 'nav', 'Dirigíveis orbitais'], [2160, 'mil', 'Leviatãs a vapor'], [2190, 'nav', 'Colônias espaciais a vapor']],
    unit: ['Carros a vapor', 'Couraças a vapor', 'Caminhantes a vapor', 'Encouraçados terrestres', 'Leviatãs a vapor'] },
  { id: 'tesla', need: 'copper', n: 'Teslapunk', e: '⚡', col: '#4aa3df', good: 'coils', bld: 'tesla_tower', m: { research: .3, prod: .15 },
    entry: { y: 1890, c: 'eco', req: ['eco_electricity'], n: 'Bobinas de Tesla' },
    tree: [[1910, 'eco', 'Energia sem fio'], [1925, 'mil', 'Raios da morte'], [1945, 'nav', 'Navios voltaicos'], [1970, 'eco', 'Rede de torres'], [2000, 'mil', 'Escudos elétricos'], [2040, 'nav', 'Frotas de arco'], [2080, 'eco', 'Rede planetária'], [2120, 'mil', 'Tempestade controlada'], [2170, 'nav', 'Velas de plasma']],
    unit: ['Lanceiros de raio', 'Tropas de bobina', 'Andarilhos de arco', 'Colossos voltaicos', 'Tempestades vivas'] },
  { id: 'diesel', need: 'oil', n: 'Dieselpunk', e: '🛞', col: '#6d6d6d', good: 'engines', bld: 'diesel_works', m: { army: .3, manpower: .2 },
    entry: { y: 1890, c: 'mil', req: ['eco_oil'], n: 'Motores de combustão' },
    tree: [[1910, 'mil', 'Motores pesados'], [1925, 'eco', 'Cidades-fábrica'], [1940, 'nav', 'Couraçados a diesel'], [1955, 'mil', 'Supertanques'], [1975, 'eco', 'Refinarias colossais'], [2000, 'nav', 'Fortalezas voadoras'], [2040, 'mil', 'Megatanques'], [2090, 'eco', 'Megamáquinas'], [2140, 'nav', 'Foguetes a diesel'], [2185, 'mil', 'Moloques de aço']],
    unit: ['Couraçados de lagarta', 'Supertanques', 'Fortalezas rolantes', 'Megatanques', 'Moloques de aço'] },
  { id: 'atom', need: 'uranium', n: 'Atompunk', e: '☢️', col: '#4caf50', good: 'cores', bld: 'reactor', m: { prod: .25, army: .2 },
    entry: { y: 1930, c: 'eco', req: ['eco_assembly'], n: 'Radiação domada' },
    tree: [[1945, 'mil', 'Soldados de rádio'], [1955, 'eco', 'Energia atômica barata'], [1965, 'nav', 'Frotas atômicas'], [1980, 'mil', 'Robôs atômicos'], [2000, 'eco', 'Cidades-cúpula'], [2030, 'nav', 'Foguetes nucleares'], [2070, 'mil', 'Gigantes de cobalto'], [2110, 'eco', 'Era do átomo eterno'], [2160, 'nav', 'Arcas atômicas'], [2190, 'mil', 'Titãs nucleares']],
    unit: ['Soldados de rádio', 'Tanques atômicos', 'Robôs atômicos', 'Gigantes de cobalto', 'Titãs nucleares'] },
  { id: 'bio', need: 'wild', n: 'Biopunk', e: '🧬', col: '#8bc34a', good: 'biomass', bld: 'biovat', m: { growth: .4, food: .3 },
    entry: { y: 1960, c: 'soc', req: ['eco_green_rev'], n: 'Engenharia genética' },
    tree: [[1975, 'eco', 'Colheitas sintéticas'], [1990, 'mil', 'Soldados aprimorados'], [2010, 'nav', 'Cascos vivos'], [2030, 'eco', 'Fábricas orgânicas'], [2060, 'mil', 'Quimeras'], [2090, 'nav', 'Leviatãs vivos'], [2120, 'eco', 'Organismos-cidade'], [2160, 'nav', 'Naves orgânicas'], [2190, 'mil', 'Hivemente']],
    unit: ['Soldados aprimorados', 'Feras de laboratório', 'Quimeras', 'Leviatãs vivos', 'Enxame orgânico'] },
  { id: 'cyber', need: 'rare', n: 'Cyberpunk', e: '💾', col: '#e040fb', good: 'chips', bld: 'chipfab', m: { research: .3, tax: .25 },
    entry: { y: 1995, c: 'eco', req: ['eco_internet'], n: 'Implantes neurais' },
    tree: [[2005, 'eco', 'Megacorporações'], [2015, 'mil', 'Ciborgues'], [2030, 'nav', 'Frotas em rede'], [2050, 'eco', 'Ciberespaço total'], [2075, 'mil', 'Mechas urbanos'], [2100, 'nav', 'Drones orbitais'], [2130, 'eco', 'Consciência digital'], [2165, 'mil', 'Fantasmas de rede'], [2195, 'nav', 'Singularidade estelar']],
    unit: ['Ciborgues', 'Mercenários cromados', 'Mechas urbanos', 'Fantasmas de rede', 'Avatares'] },
  { id: 'solar', need: 'sun', n: 'Solarpunk', e: '☀️', col: '#ffca28', good: 'panels', bld: 'solar_array', m: { growth: .25, stab: .2, prod: .15 },
    entry: { y: 2040, c: 'eco', req: ['eco_ai'], n: 'Energia solar abundante' },
    tree: [[2055, 'eco', 'Cidades-jardim'], [2070, 'mil', 'Guardiões verdes'], [2090, 'nav', 'Velas solares'], [2110, 'eco', 'Arcologias verdes'], [2140, 'mil', 'Sentinelas de luz'], [2165, 'nav', 'Esferas solares'], [2190, 'eco', 'Era dourada']],
    unit: ['Guardiões verdes', 'Drones solares', 'Andarilhos de jardim', 'Sentinelas de luz', 'Coros solares'] },
  { id: 'nano', need: 'gold', n: 'Nanopunk', e: '🔬', col: '#00bcd4', good: 'nanites', bld: 'nanoforge', m: { prod: .35, army: .2 },
    entry: { y: 2080, c: 'mil', req: ['eco_fusion'], n: 'Nanomáquinas' },
    tree: [[2095, 'mil', 'Nanotropa'], [2110, 'eco', 'Matéria programável'], [2130, 'nav', 'Cascos autorreparáveis'], [2150, 'mil', 'Nuvem cinza'], [2170, 'eco', 'Forja infinita'], [2190, 'nav', 'Naves de matéria']],
    unit: ['Nanotropa', 'Legião autorreparável', 'Soldados de matéria', 'Nuvem cinza', 'Exército fluido'] },
  { id: 'space', need: 'launch', n: 'Spacepunk', e: '🚀', col: '#7e57c2', good: 'he3', bld: 'spaceport', m: { research: .25, trade: .3, army: .2 },
    entry: { y: 2050, c: 'nav', req: ['nav_autonomous'], n: 'Elevadores orbitais' },
    tree: [[2060, 'nav', 'Estações orbitais'], [2070, 'eco', 'Mineração lunar'], [2085, 'mil', 'Tropas de queda'], [2100, 'nav', 'Colônias marcianas'], [2115, 'eco', 'Fábricas orbitais'], [2130, 'mil', 'Legiões estelares'], [2150, 'nav', 'Frotas do vazio'], [2170, 'eco', 'Economia do cinturão'], [2195, 'mil', 'Império estelar']],
    unit: ['Fuzileiros orbitais', 'Tropas de queda', 'Naves de assalto', 'Legiões estelares', 'Armada do vazio'] },
];
const VERT = Object.fromEntries(VERTS.map(v => [v.id, v]));
/* tropas próprias de cada vertente: substituem infantaria, cavalaria, artilharia e navios da árvore normal.
   [progresso na árvore (0–1), nome] — evoluem conforme a vertente avança pelas eras · um: força de cada tipo */
const VUNITS = {
  clock:  { um: { inf: 1.1, cav: 1, art: 1.15 }, inf: [[0, 'Besteiros de corda'], [.2, 'Arcabuzeiros de mola'], [.4, 'Granadeiros autômatos'], [.6, 'Soldados de relojoaria'], [.8, 'Legiões de engrenagem']], cav: [[0, 'Cavaleiros de mola'], [.3, 'Corcéis mecânicos'], [.55, 'Carruagens de corda'], [.8, 'Aranhas de bronze']], art: [[0, 'Balistas de engrenagem'], [.3, 'Canhões de relojoaria'], [.6, 'Morteiros automáticos'], [.85, 'Baterias perpétuas']], ship: [[0, 'Caravelas de relojoaria'], [.4, 'Navios de corda'], [.6, 'Submarinos de corda'], [.8, 'Dirigíveis de engrenagem'], [.95, 'Arcas celestes']] },
  steam:  { um: { inf: 1, cav: 1.1, art: 1.2 }, inf: [[0, 'Fuzileiros de caldeira'], [.3, 'Couraceiros a vapor'], [.6, 'Granadeiros pressurizados'], [.85, 'Exossoldados a vapor']], cav: [[0, 'Carroças a vapor'], [.3, 'Tratores blindados'], [.5, 'Caminhantes a vapor'], [.8, 'Fortalezas rolantes']], art: [[0, 'Canhões a vapor'], [.4, 'Obuses pneumáticos'], [.75, 'Supercanhões de pressão']], ship: [[0, 'Navios a roda'], [.25, 'Dirigíveis'], [.6, 'Encouraçados aéreos'], [.85, 'Dirigíveis orbitais']] },
  tesla:  { um: { inf: 1.05, cav: 1, art: 1.25 }, inf: [[0, 'Lanceiros voltaicos'], [.35, 'Tropas de bobina'], [.7, 'Infantaria de arco']], cav: [[0, 'Motociclos elétricos'], [.4, 'Andarilhos de arco'], [.75, 'Tanques de plasma']], art: [[0, 'Torres de raio'], [.4, 'Canhões de raio'], [.75, 'Tempestades dirigidas']], ship: [[0, 'Navios voltaicos'], [.5, 'Frotas de arco'], [.85, 'Velas de plasma']] },
  diesel: { um: { inf: 1.05, cav: 1.25, art: 1 }, inf: [[0, 'Infantaria motorizada'], [.35, 'Tropas de assalto blindadas'], [.7, 'Legionários de aço']], cav: [[0, 'Couraçados de lagarta'], [.35, 'Supertanques'], [.7, 'Megatanques']], art: [[0, 'Canhões ferroviários'], [.4, 'Obuses colossais'], [.75, 'Moloques de artilharia']], ship: [[0, 'Couraçados a diesel'], [.4, 'Fortalezas voadoras'], [.8, 'Foguetes a diesel']] },
  atom:   { um: { inf: 1, cav: 1.1, art: 1.2 }, inf: [[0, 'Soldados de rádio'], [.4, 'Patrulheiros atômicos'], [.75, 'Robôs atômicos']], cav: [[0, 'Tanques atômicos'], [.45, 'Andarilhos de cobalto'], [.8, 'Gigantes nucleares']], art: [[0, 'Canhões atômicos'], [.4, 'Lançadores de ogivas'], [.75, 'Baterias de cobalto']], ship: [[0, 'Frotas atômicas'], [.5, 'Foguetes nucleares'], [.85, 'Arcas atômicas']] },
  bio:    { um: { inf: 1.2, cav: 1.05, art: .95 }, inf: [[0, 'Soldados aprimorados'], [.35, 'Enxertados'], [.7, 'Quimeras de assalto']], cav: [[0, 'Feras de laboratório'], [.4, 'Montarias quiméricas'], [.75, 'Leviatãs terrestres']], art: [[0, 'Lançadores de esporos'], [.4, 'Artilharia viva'], [.75, 'Colmeias de cerco']], ship: [[0, 'Cascos vivos'], [.5, 'Leviatãs vivos'], [.85, 'Naves orgânicas']] },
  cyber:  { um: { inf: 1.15, cav: 1, art: 1.1 }, inf: [[0, 'Ciborgues'], [.4, 'Mercenários cromados'], [.75, 'Fantasmas de rede']], cav: [[0, 'Drones de assalto'], [.4, 'Mechas urbanos'], [.75, 'Mechas de guerra']], art: [[0, 'Baterias inteligentes'], [.4, 'Enxames de mísseis'], [.75, 'Satélites armados']], ship: [[0, 'Frotas em rede'], [.55, 'Drones orbitais'], [.9, 'Naves da singularidade']] },
  solar:  { um: { inf: 1.1, cav: 1.1, art: 1 }, inf: [[0, 'Guardiões verdes'], [.45, 'Patrulhas de luz'], [.8, 'Sentinelas de luz']], cav: [[0, 'Andarilhos de jardim'], [.5, 'Drones solares'], [.8, 'Carros de prisma']], art: [[0, 'Espelhos ardentes'], [.5, 'Lentes de cerco'], [.8, 'Coros solares']], ship: [[0, 'Velas solares'], [.7, 'Esferas solares']] },
  nano:   { um: { inf: 1.25, cav: 1.1, art: 1 }, inf: [[0, 'Nanotropa'], [.4, 'Legião autorreparável'], [.75, 'Exército fluido']], cav: [[0, 'Blindados de matéria'], [.5, 'Nuvem cinza']], art: [[0, 'Desmontadores'], [.5, 'Canhões de enxame']], ship: [[0, 'Cascos autorreparáveis'], [.7, 'Naves de matéria']] },
  space:  { um: { inf: 1.1, cav: 1, art: 1.3 }, inf: [[0, 'Fuzileiros orbitais'], [.35, 'Tropas de queda'], [.7, 'Legiões estelares']], cav: [[0, 'Naves de assalto'], [.45, 'Andarilhos lunares'], [.8, 'Couraçados de queda']], art: [[0, 'Canhões de massa'], [.4, 'Bombardeio orbital'], [.75, 'Armada do vazio']], ship: [[0, 'Estações orbitais'], [.35, 'Cruzadores marcianos'], [.7, 'Frotas do vazio']] },
};
// necessidades que não são recurso: terreno ou posição
const NEEDS = { wild: { n: 'selva ou pântano (biodiversidade)', ok: p => p.terr === 'jungle' || p.terr === 'marsh' }, sun: { n: 'deserto ou savana (sol forte)', ok: p => p.terr === 'desert' || p.terr === 'savanna' }, launch: { n: 'litoral perto do equador (base de lançamento)', ok: p => p.coast && Math.abs(p.cy / MAP_H - .5) < .12 } };
VERTS.forEach(v => {
  const add = t => { TECHS.push(t); TECH[t.id] = t; };
  add({ id: 'v_' + v.id, c: v.entry.c, v: v.id, entry: true, y: v.entry.y, n: v.entry.n, req: v.entry.req, fx: { b: [v.bld] }, src: [] });
  const last = {}; v.len = v.tree.length + 1;
  v.tree.forEach(([y, c, n], k) => { const id = 'v_' + v.id + '_' + k; add({ id, c, v: v.id, vt: true, y, n, req: [last[c] || 'v_' + v.id], fx: {}, src: [] }); last[c] = id; });
  // cada tecnologia da árvore normal substituída vai para a primeira da vertente na mesma área com ano igual ou maior
  TECHS.filter(t => !t.v && ['mil', 'nav', 'eco'].includes(t.c) && t.y > v.entry.y).forEach(t => {
    const opts = TECHS.filter(x => x.v === v.id && x.vt && x.c === t.c); if (!opts.length) return;
    (opts.find(x => x.y >= t.y) || opts[opts.length - 1]).src.push(t.id);
  });
});

/* ---------- governos ----------
   cat: grupo · succ: sucessão (hered herança · elect eleito vitalício · term eleições a cada `term` anos · party partido · junta · council · theo · ai)
   t: título do governante · m: modificadores · coup: risco de golpe (1 = normal) · fmt: nome do país */
const GOVS = {
  tribal:        { n: 'Chefatura tribal', cat: 'Tribal', succ: 'elect', t: 'Chefe', fmt: 'Tribo de {}', m: { tax: -.3, manpower: .3, research: -.2 }, coup: .6 },
  tribal_conf:   { n: 'Confederação tribal', until: 1750, next: 'feudal', cat: 'Tribal', succ: 'council', term: 8, t: 'Chefe supremo', fmt: 'Confederação de {}', m: { tax: -.2, stab: .1, research: -.15 }, coup: .4 },
  horde:         { n: 'Horda nômade', until: 1500, next: 'khanate', cat: 'Tribal', succ: 'elect', t: 'Cã', fmt: 'Horda de {}', m: { tax: -.4, army: .2, manpower: .4, prod: -.2, speed: .3 }, coup: 1.2 },
  feudal:        { n: 'Monarquia feudal', until: 1800, next: 'absolute', cat: 'Monarquia', succ: 'hered', t: 'Rei', fmt: 'Reino de {}', m: { tax: -.1, manpower: .2 }, coup: .5 },
  elective:      { n: 'Monarquia eletiva', until: 1800, next: 'constitutional', cat: 'Monarquia', succ: 'elect', t: 'Rei eleito', fmt: 'Reino de {}', m: { tax: -.05, research: .05, stab: -.05 }, coup: .4 },
  absolute:      { n: 'Monarquia absoluta', cat: 'Monarquia', succ: 'hered', t: 'Rei', fmt: 'Reino de {}', m: { tax: .15, stab: .1, research: -.05, manpower: .1 }, coup: .3 },
  enlightened:   { n: 'Despotismo esclarecido', cat: 'Monarquia', succ: 'hered', t: 'Monarca', fmt: 'Reino de {}', m: { research: .15, tax: .1 }, coup: .4 },
  constitutional:{ n: 'Monarquia constitucional', cat: 'Monarquia', succ: 'hered', t: 'Monarca', fmt: 'Reino Unido de {}', m: { research: .1, prod: .1, stab: .05 }, coup: .2 },
  empire:        { n: 'Império', minRank: 4, cat: 'Monarquia', succ: 'hered', t: 'Imperador', fmt: 'Império de {}', m: { tax: .1, army: .1, stab: -.05 }, coup: .6 },
  merchant:      { n: 'República mercantil', until: 1850, next: 'parliamentary', cat: 'República', succ: 'term', term: 10, t: 'Doge', fmt: 'Sereníssima de {}', m: { trade: .3, tax: .1, manpower: -.2 }, coup: .3 },
  oligarchic:    { n: 'República oligárquica', cat: 'República', succ: 'term', term: 6, t: 'Cônsul', fmt: 'República de {}', m: { tax: .1, stab: .05 }, coup: .5 },
  parliamentary: { n: 'República parlamentar', cat: 'República', succ: 'term', term: 4, t: 'Primeiro-ministro', fmt: 'República de {}', m: { research: .15, prod: .1, manpower: -.1 }, coup: .4 },
  presidential:  { n: 'República presidencialista', cat: 'República', succ: 'term', term: 4, t: 'Presidente', fmt: 'República de {}', m: { stab: .05, prod: .1 }, coup: .7 },
  federal:       { n: 'República federal', cat: 'República', succ: 'term', term: 4, t: 'Presidente', fmt: 'Estados Unidos de {}', m: { tax: -.05, stab: .1, admin: .2 }, coup: .4 },
  peoples:       { n: 'República popular', cat: 'Socialista', succ: 'party', t: 'Secretário-geral', fmt: 'República Popular de {}', m: { prod: .15, research: .05, stab: .05, trade: -.2 }, coup: .5 },
  commune:       { n: 'Comuna federada', cat: 'Socialista', succ: 'council', term: 2, t: 'Delegado', fmt: 'Comuna de {}', m: { prod: .1, manpower: .2, tax: -.3, stab: -.1 }, coup: .8 },
  syndicalist:   { n: 'República sindicalista', cat: 'Socialista', succ: 'council', term: 4, t: 'Presidente do congresso', fmt: 'União Sindical de {}', m: { prod: .2, tax: -.1 }, coup: .6 },
  theocracy:     { n: 'Teocracia', cat: 'Teocracia', succ: 'theo', t: 'Sumo-sacerdote', fmt: 'Santa Sé de {}', m: { stab: .15, research: -.1 }, coup: .3 },
  military_order:{ n: 'Ordem militar', cat: 'Teocracia', succ: 'theo', t: 'Grão-mestre', fmt: 'Ordem de {}', m: { army: .2, manpower: -.1, stab: .05 }, coup: .4 },
  sages:         { n: 'Concílio dos sábios', cat: 'Teocracia', succ: 'council', term: 7, t: 'Arquissábio', fmt: 'Concílio de {}', m: { research: .2, army: -.1, stab: -.05 }, coup: .5 },
  junta:         { n: 'Junta militar', cat: 'Ditadura', succ: 'junta', t: 'General', fmt: 'Estado de {}', m: { army: .2, manpower: .2, stab: -.1 }, coup: 2 },
  caudillo:      { n: 'Caudilhismo', cat: 'Ditadura', succ: 'junta', t: 'Caudilho', fmt: 'Estado de {}', m: { tax: .1, army: .1, stab: -.05 }, coup: 1.5 },
  one_party:     { n: 'Estado de partido único', cat: 'Ditadura', succ: 'party', t: 'Líder do partido', fmt: 'Estado de {}', m: { stab: .15, research: .05, trade: -.1 }, coup: .3 },
  totalitarian:  { n: 'Estado totalitário', cat: 'Ditadura', succ: 'party', t: 'Líder supremo', fmt: 'Estado Total de {}', m: { army: .25, prod: .1, research: -.1, stab: .1 }, coup: .4 },
  technate:      { n: 'Tecnato', cat: 'Tecnocracia', succ: 'council', term: 6, t: 'Diretor técnico', fmt: 'Tecnato de {}', m: { research: .25, prod: .15, stab: -.05 }, coup: .6 },
  corporate:     { n: 'Corporatocracia', cat: 'Tecnocracia', succ: 'council', term: 5, t: 'CEO', fmt: '{} S.A.', m: { tax: .25, prod: .2, stab: -.15 }, coup: 1 },
  liquid:        { n: 'Democracia líquida', cat: 'República', succ: 'term', term: 2, t: 'Mediador', fmt: 'Rede de {}', m: { research: .2, stab: .1 }, coup: .2 },
  synthocracy:   { n: 'Sintocracia', cat: 'Tecnocracia', succ: 'ai', t: 'Inteligência regente', fmt: 'Núcleo de {}', m: { research: .3, prod: .25 }, coup: 0 },
  khanate:       { n: 'Canato', until: 1800, next: 'sultanate', cat: 'Tribal', succ: 'hered', t: 'Cã', fmt: 'Canato de {}', m: { army: .15, manpower: .25, tax: -.15, speed: .2 }, coup: .9 },
  principality:  { n: 'Principado', maxRank: 2, cat: 'Monarquia', succ: 'hered', t: 'Príncipe', fmt: 'Principado de {}', m: { tax: .05, research: .05, trade: .05 }, coup: .4 },
  city_state:    { n: 'Cidade-Estado', maxRank: 1, until: 1900, cat: 'República', succ: 'term', term: 5, t: 'Gonfaloneiro', fmt: 'Cidade de {}', m: { trade: .25, research: .1, manpower: -.3 }, coup: .4 },
  sultanate:     { n: 'Sultanato', minRank: 2, cat: 'Monarquia', succ: 'hered', t: 'Sultão', fmt: 'Sultanato de {}', m: { tax: .1, army: .1, stab: .03 }, coup: .7 },
  parl_monarchy: { n: 'Monarquia parlamentar', cat: 'Monarquia', succ: 'hered', t: 'Monarca', fmt: 'Reino de {}', m: { stab: .08, tax: .05, research: .05 }, coup: .2 },
  company:       { n: 'Companhia mercantil', cat: 'República', succ: 'council', term: 6, t: 'Governador-geral', fmt: 'Companhia de {}', m: { trade: .3, colon: .3, stab: -.05 }, coup: .5 },
  protectorate:  { n: 'Protetorado', cat: 'Ditadura', succ: 'junta', t: 'Lorde protetor', fmt: 'Protetorado de {}', m: { army: .1, stab: .05, research: -.05 }, coup: 1.2 },
  peoples_dem:   { n: 'Democracia popular', cat: 'Socialista', succ: 'party', t: 'Presidente do conselho', fmt: 'República Democrática de {}', m: { prod: .1, stab: .08, trade: -.1 }, coup: .4 },
  mil_regime:    { n: 'Regime militar', cat: 'Ditadura', succ: 'junta', t: 'Presidente militar', fmt: 'República de {}', m: { army: .15, stab: .05, research: -.05 }, coup: 1.5 },
  social_state:  { n: 'Estado social', cat: 'República', succ: 'term', term: 4, t: 'Chanceler', fmt: 'República Federal de {}', m: { stab: .12, growth: .05, tax: .05 }, coup: .2 },
  net_state:     { n: 'Estado-rede', cat: 'Tecnocracia', succ: 'council', term: 4, t: 'Coordenador', fmt: 'Rede de {}', m: { research: .2, trade: .1, stab: -.05 }, coup: .4 },
  surveillance:  { n: 'Estado de vigilância', cat: 'Ditadura', succ: 'party', t: 'Guardião', fmt: 'Estado de {}', m: { stab: .2, research: -.05, coup: 0 }, coup: .1 },
  hive:          { n: 'Coletivo-colmeia', cat: 'Tecnocracia', succ: 'ai', t: 'Mente coletiva', fmt: 'Colmeia de {}', m: { prod: .3, research: .2, stab: .1, growth: -.1 }, coup: 0 },
  star_empire:   { n: 'Império estelar', minRank: 4, cat: 'Monarquia', succ: 'hered', t: 'Imperador estelar', fmt: 'Império Estelar de {}', m: { tax: .15, army: .15, research: .1 }, coup: .4 },
  hegemony:      { n: 'Hegemonia orbital', cat: 'Tecnocracia', succ: 'council', term: 10, t: 'Hegemon', fmt: 'Hegemonia de {}', m: { tax: .1, prod: .1, research: .1, army: .1, stab: .1 }, coup: .2 },
};

/* ---------- níveis de título (como no CK3): limitam quantos estados o país sustenta (Limite de domínio) ----------
   cap: províncias sem perder estabilidade · req: mínimo para proclamar o nível · no nível 3 cada governo usa o próprio nome (fmt/t) */
const RANK_N = ['Baronia', 'Condado', 'Ducado', 'Reino', 'Império'];
const RANK_CAP = [2, 5, 12], RANK_REQ = [0, 2, 4, 8];   // em estados (inteiros ou não); Reino e Império dependem do continente de origem
const RANK_KING = .75, RANK_EMP = 2 / 3;                    // Reino sustenta 3/4 dos estados do continente; Império exige 2/3 das províncias dele
const RANKSET = {
  Monarquia:   { f: ['Baronato de {}', 'Condado de {}', 'Ducado de {}', null, 'Império de {}'], t: ['Barão', 'Conde', 'Duque', null, 'Imperador'] },
  Tribal:      { f: ['Clã de {}', 'Tribo de {}', 'Chefado de {}', 'Alto Reino de {}', 'Grande Horda de {}'], t: ['Chefe de clã', 'Chefe', 'Grande chefe', 'Alto rei', 'Grão-cã'], f3for: ['tribal'] },
  República:   { f: ['Comuna de {}', 'Cidade Livre de {}', 'Liga de {}', null, 'República Imperial de {}'], t: ['Prefeito', 'Burgomestre', 'Cônsul', null, 'Primeiro Cidadão'] },
  Socialista:  { f: ['Coletivo de {}', 'Soviete de {}', 'União Regional de {}', null, 'União das Repúblicas de {}'], t: ['Delegado', 'Comissário', 'Secretário regional', null, 'Presidente da União'] },
  Teocracia:   { f: ['Priorado de {}', 'Bispado de {}', 'Arcebispado de {}', null, 'Santo Império de {}'], t: ['Prior', 'Bispo', 'Arcebispo', null, 'Pontífice'] },
  Ditadura:    { f: ['Distrito Militar de {}', 'Protetorado de {}', 'Estado de {}', null, 'Império Nacional de {}'], t: ['Comandante', 'Governador militar', 'Protetor', null, 'Autocrata'] },
  Tecnocracia: { f: ['Distrito Técnico de {}', 'Comitê de {}', 'Diretório de {}', null, 'Hegemonia de {}'], t: ['Engenheiro-chefe', 'Supervisor', 'Diretor', null, 'Arquiteto supremo'] },
};

/* ---------- ideologias (m: modificadores · war: agressividade da IA) ---------- */
const IDEOS = {
  trad:       { n: 'Tradicionalismo', col: '#8d6e63', m: { stab: .1, research: -.05 }, war: 1 },
  warrior:    { n: 'Ética guerreira', col: '#b71c1c', m: { army: .1, manpower: .1, stab: -.05 }, war: 2.2 },
  mercant:    { n: 'Mercantilismo', col: '#00897b', m: { trade: .2, tax: .05 }, war: 1 },
  absolut:    { n: 'Absolutismo', col: '#5e35b1', m: { tax: .1, stab: .05 }, war: 1.3 },
  liberal:    { n: 'Liberalismo', col: '#fdd835', m: { research: .1, prod: .05, trade: .1 }, war: .8 },
  conservative:{ n: 'Conservadorismo', col: '#1e88e5', m: { stab: .1 }, war: 1 },
  radical:    { n: 'Radicalismo', col: '#f4511e', m: { research: .05, manpower: .1, stab: -.05 }, war: 1.3 },
  socialism:  { n: 'Socialismo', col: '#e53935', m: { prod: .1, stab: .05 }, war: 1.1 },
  syndicalism:{ n: 'Sindicalismo', col: '#c62828', m: { prod: .15, tax: -.05 }, war: 1.2 },
  anarchism:  { n: 'Anarquismo', col: '#212121', m: { manpower: .2, tax: -.2, stab: -.1 }, war: .9 },
  socdem:     { n: 'Social-democracia', col: '#ef5350', m: { stab: .1, research: .05 }, war: .7 },
  natpop:     { n: 'Nacional-populismo', col: '#6d4c41', m: { manpower: .15, stab: .05 }, war: 1.8 },
  agrarian:   { n: 'Agrarismo', col: '#7cb342', m: { food: .25, stab: .05 }, war: .8 },
  totalism:   { n: 'Totalismo', col: '#37474f', m: { army: .2, prod: .1, stab: -.05 }, war: 3 },
  futurism:   { n: 'Futurismo', col: '#ff6f00', m: { research: .1, prod: .15, stab: -.05 }, war: 2.2 },
  technocrat: { n: 'Tecnocratismo', col: '#26c6da', m: { research: .2 }, war: .9 },
  neolib:     { n: 'Neoliberalismo', col: '#ffd54f', m: { trade: .25, prod: .05, stab: -.05 }, war: .8 },
  green:      { n: 'Ecologismo', col: '#43a047', m: { stab: .05, food: .1, growth: .05 }, war: .5 },
  transhum:   { n: 'Transumanismo', col: '#ab47bc', m: { research: .2, manpower: -.1 }, war: 1 },
  accel:      { n: 'Aceleracionismo', col: '#ff3d00', m: { prod: .25, stab: -.1 }, war: 1.6 },
  posthuman:  { n: 'Pós-humanismo', col: '#7c4dff', m: { research: .25, prod: .15 }, war: 1.2 },
  cosmism:    { n: 'Cosmismo', col: '#3949ab', m: { research: .1, prod: .1, trade: .1, army: .1 }, war: 1.4 },
};
const MODS = { tax: 'Impostos', prod: 'Produção', research: 'Pesquisa', stab: 'Estabilidade', army: 'Força militar', manpower: 'Contingente', trade: 'Comércio', colon: 'Colonização', food: 'Alimentos', speed: 'Movimento', admin: 'Custo de obras', growth: 'Crescimento' };

/* ---------- unidades: nomes por época (o mais recente já pesquisado vale) ---------- */
const UNITS = {
  inf: [['mil_levy', 'Lanceiros'], ['mil_crossbow', 'Besteiros'], ['mil_pike', 'Piqueiros'], ['mil_arquebus', 'Arcabuzeiros'], ['mil_musket', 'Mosqueteiros'], ['mil_bayonet', 'Infantaria de linha'], ['mil_rifle', 'Fuzileiros'], ['mil_machinegun', 'Infantaria moderna'], ['mil_blitz', 'Infantaria mecanizada'], ['mil_drones', 'Infantaria em rede'], ['mil_exo', 'Exossoldados'], ['mil_swarm', 'Legiões autônomas']],
  cav: [['mil_levy', 'Cavaleiros leves'], ['mil_stirrup', 'Cavaleiros'], ['mil_plate', 'Cavaleiros de placas'], ['mil_musket', 'Dragões'], ['mil_bayonet', 'Couraceiros'], ['mil_tank', 'Tanques'], ['mil_blitz', 'Divisões blindadas'], ['mil_stealth', 'Blindados modernos'], ['mil_exo', 'Mechas'], ['mil_swarm', 'Enxames blindados']],
  art: [['mil_trebuchet', 'Máquinas de cerco'], ['mil_bombard', 'Bombardas'], ['mil_bastion', 'Canhões'], ['mil_fieldart', 'Artilharia de campanha'], ['mil_breech', 'Artilharia raiada'], ['mil_trench', 'Artilharia pesada'], ['mil_missile', 'Baterias de mísseis'], ['mil_railgun', 'Canhões eletromagnéticos'], ['mil_orbital', 'Plataformas orbitais']],
};
const UNIT_BASE = { inf: { a: 1, d: 1.1, c: 8 }, cav: { a: 1.6, d: .9, c: 16 }, art: { a: 1.4, d: .5, c: 20 }, vrt: { a: 2.4, d: 2, c: 40 } };

/* ---------- terrenos ---------- */
const TERRAIN = {
  plains:   { n: 'Planície', col: [148, 178, 92], move: 1, def: 0, food: 1.2, pop: 1.2 },
  grass:    { n: 'Campos', col: [176, 190, 104], move: 1, def: 0, food: 1.1, pop: 1.1 },
  forest:   { n: 'Floresta', col: [70, 120, 62], move: 1.3, def: .15, food: .8, pop: .8 },
  taiga:    { n: 'Taiga', col: [76, 104, 78], move: 1.4, def: .15, food: .5, pop: .5 },
  jungle:   { n: 'Selva', col: [48, 110, 54], move: 1.8, def: .25, food: .7, pop: .6 },
  hills:    { n: 'Colinas', col: [150, 140, 96], move: 1.5, def: .25, food: .8, pop: .8 },
  mountain: { n: 'Montanhas', col: [128, 116, 104], move: 2.2, def: .45, food: .3, pop: .35 },
  desert:   { n: 'Deserto', col: [222, 198, 138], move: 1.4, def: .05, food: .25, pop: .3 },
  savanna:  { n: 'Savana', col: [196, 180, 98], move: 1.1, def: 0, food: .9, pop: .8 },
  marsh:    { n: 'Pântano', col: [96, 120, 92], move: 1.7, def: .2, food: .6, pop: .5 },
  tundra:   { n: 'Tundra', col: [168, 170, 150], move: 1.3, def: .05, food: .25, pop: .25 },
  ice:      { n: 'Gelo', col: [232, 238, 242], move: 2, def: .1, food: 0, pop: .05 },
};

/* ---------- traços de personagens (m: modificadores da nação enquanto governa) ---------- */
const TRAITS = {
  brave:     { n: 'Bravo', m: { army: .05 }, ai: 'guerreia mais' }, craven: { n: 'Covarde', m: { army: -.05 }, ai: 'evita guerras' },
  genius:    { n: 'Gênio', m: { research: .1 } }, slow: { n: 'Lento', m: { research: -.06 } },
  ambitious: { n: 'Ambicioso', m: { prod: .04, stab: -.03 }, ai: 'busca expansão e reivindicações' }, content: { n: 'Contente', m: { stab: .04 }, ai: 'prefere a paz' },
  just:      { n: 'Justo', m: { stab: .06 }, ai: 'não fabrica reivindicações' }, cruel: { n: 'Cruel', m: { stab: -.04, manpower: .05 }, ai: 'guerreia mais' },
  greedy:    { n: 'Ganancioso', m: { tax: .06, stab: -.02 }, ai: 'acumula ouro e ergue mercados' }, generous: { n: 'Generoso', m: { tax: -.04, stab: .05 }, ai: 'aceita mais acordos e dá presentes' },
  zealous:   { n: 'Zeloso', m: { stab: .03, research: -.03 }, ai: 'ergue templos' }, cynical: { n: 'Cínico', m: { research: .03 }, ai: 'ignora templos' },
  diligent:  { n: 'Diligente', m: { prod: .05, tax: .03 }, ai: 'constrói mais' }, lazy: { n: 'Preguiçoso', m: { prod: -.04 }, ai: 'constrói menos' },
  schemer:   { n: 'Conspirador', m: { coup: -.3 }, ai: 'fabrica mais reivindicações' }, honest: { n: 'Honesto', m: { stab: .03 }, ai: 'sempre honra alianças' },
  strategist:{ n: 'Estrategista', m: { army: .08 }, ai: 'mantém exército maior' }, builder: { n: 'Construtor', m: { admin: .1 }, ai: 'prioriza obras' },
  navigator: { n: 'Navegador', m: { colon: .15, trade: .05 }, ai: 'explora e coloniza mais' }, scholar: { n: 'Erudito', m: { research: .06 }, ai: 'ergue universidades' },
  paranoid:  { n: 'Paranoico', m: { coup: -.5, stab: -.03 }, ai: 'exército maior, desconfia de alianças' }, charismatic: { n: 'Carismático', m: { stab: .05, manpower: .03 }, ai: 'faz mais alianças e casamentos' },
  sickly:    { n: 'Doente', m: { stab: -.02 }, die: 2, ai: 'morre mais cedo' }, robust: { n: 'Robusto', m: {}, die: .5, ai: 'vive mais' },
};
const STATS = {                                              // o que cada atributo faz (governante e conselho)
  dip: { n: 'Diplomacia', d: 'Governante: +0,4 de estabilidade por ponto acima de 8.\nChanceler: +0,3 por ponto.\nAjuda a convencer outros países em propostas.' },
  mar: { n: 'Marcial', d: 'Governante: +0,8% de força militar por ponto acima de 8.\nMarechal: +0,6% por ponto.' },
  adm: { n: 'Administração', d: 'Governante: +0,8% de impostos por ponto acima de 8.\nTesoureiro: +0,6% por ponto.' },
  int: { n: 'Intriga', d: 'Governante: −2% de risco de golpe por ponto acima de 8.\nMestre espião: −4% por ponto.' },
  lea: { n: 'Saber', d: 'Governante: +0,8% de pesquisa por ponto acima de 8.\nErudito: +0,6% por ponto.' },
};
const ERAS = [[860, 'Alta Idade Média'], [1000, 'Idade Média'], [1450, 'Renascimento'], [1650, 'Era Moderna'], [1780, 'Era das Revoluções'], [1880, 'Era Industrial'], [1945, 'Guerra Fria'], [2000, 'Era Digital'], [2060, 'Futuro']];
const eraOf = y => { let e = ERAS[0][1]; for (const [a, n] of ERAS) if (y >= a) e = n; return e; };
const SHIPS = [['nav_longship', 'Barcos longos'], ['nav_knarr', 'Knarrs'], ['nav_cog', 'Cocas'], ['nav_caravel', 'Caravelas'], ['nav_galleon', 'Galeões'], ['nav_lineship', 'Naus de linha'], ['nav_steamship', 'Vapores'], ['nav_ironclad', 'Encouraçados'], ['nav_dreadnought', 'Dreadnoughts'], ['nav_carrier', 'Porta-aviões'], ['nav_nuclearsub', 'Submarinos nucleares'], ['nav_aegis', 'Destróieres de mísseis'], ['nav_autonomous', 'Frotas autônomas'], ['nav_orbit', 'Naves orbitais']];
/* ---------- serviços públicos: nome do prédio muda com a era; cada nível atende SVC_CAP(ano) mil pessoas ---------- */
const SVC = {
  health: { n: 'Saúde', e: '🏥', b: 'hospital', names: [[860, 'Casa de caridade'], [1650, 'Hospital'], [1900, 'Hospital moderno'], [2000, 'Centro médico'], [2080, 'Clínica de regeneração']], d: 'Crescimento da população, teto populacional e resistência a pragas' },
  edu:    { n: 'Educação', e: '📚', b: 'school', names: [[860, 'Escola monástica'], [1500, 'Escola'], [1850, 'Escola pública'], [2000, 'Campus digital'], [2080, 'Rede neural de ensino']], d: 'Pesquisa' },
  adm:    { n: 'Administração', e: '🏛️', b: 'office', names: [[860, 'Chancelaria local'], [1500, 'Intendência'], [1850, 'Repartição pública'], [2000, 'Governo digital'], [2080, 'Administração algorítmica']], d: 'Impostos, menos corrupção e obras mais baratas' },
  sec:    { n: 'Segurança', e: '🛡️', b: 'guard', names: [[860, 'Guarda'], [1600, 'Milícia urbana'], [1830, 'Polícia'], [2000, 'Segurança inteligente'], [2080, 'Vigilância preditiva']], d: 'Estabilidade e menos golpes' },
};
const SVC_CAP = y => 30 * (1 + (y - 860) / 250);
const svcName = (k, y) => { let n = SVC[k].names[0][1]; for (const [a, x] of SVC[k].names) if (y >= a) n = x; return n; };

/* ---------- leis (cada uma tem opções com modificadores; trocar custa estabilidade) ---------- */
const LAWS = {
  tax:   { eco: 1, n: 'Impostos', o: { low: { n: 'Baixos', m: { tax: -.2, stab: .08, growth: .03 } }, normal: { n: 'Normais', m: {} }, high: { n: 'Altos', m: { tax: .2, stab: -.08 } }, extort: { n: 'Extorsivos', m: { tax: .4, stab: -.2, growth: -.1 } } } },
  draft: { n: 'Recrutamento', o: { volunteer: { n: 'Voluntários', m: { manpower: -.4, prod: .05 } }, limited: { n: 'Limitado', m: {} }, wide: { n: 'Amplo', m: { manpower: .3, prod: -.05 } }, total: { n: 'Mobilização total', m: { manpower: .8, prod: -.15, stab: -.05 }, when: { tech: 'mil_conscription' } } } },
  trade: { eco: 1, n: 'Comércio', o: { free: { n: 'Livre comércio', m: { trade: .15, prod: -.03 }, when: { tech: 'eco_mercantilism' } }, normal: { n: 'Tarifas moderadas', m: {} }, protect: { n: 'Protecionismo', m: { trade: -.1, prod: .06 } }, autarky: { n: 'Autarquia', m: { trade: -.4, prod: .08, stab: .03 } } } },
  spend: { n: 'Gastos públicos', o: { austerity: { n: 'Austeridade', m: { stab: -.05 }, svc: .5 }, normal: { n: 'Equilibrados', m: {}, svc: 1 }, welfare: { n: 'Bem-estar social', m: { stab: .08, growth: .05 }, svc: 1.6, when: { tech: 'soc_welfare' } } } },
  press: { n: 'Imprensa', o: { censored: { n: 'Censurada', m: { stab: .05, research: -.05 } }, regulated: { n: 'Regulada', m: {} }, free: { n: 'Livre', m: { research: .06, stab: -.03 }, when: { tech: 'soc_printing' } } } },
  currency: { eco: 1, n: 'Moeda', o: { metal: { n: 'Padrão-ouro', m: { trade: .04, stab: .02 } }, paper: { n: 'Papel-moeda', m: { tax: .05, trade: .05, stab: -.02 }, when: { tech: 'eco_banking' } }, fiat: { n: 'Moeda fiduciária', m: { prod: .06, tax: .05, stab: -.03 }, when: { tech: 'soc_welfare' } }, digital: { n: 'Moeda digital', m: { tax: .08, trade: .1 }, when: { tech: 'eco_internet' } } } },
  bank:  { eco: 1, n: 'Sistema bancário', o: { none: { n: 'Agiotas', m: {} }, private: { n: 'Bancos privados', m: { prod: .04, trade: .04, stab: -.02 }, when: { tech: 'eco_banking' } }, central: { n: 'Banco central', m: { stab: .04, tax: .04 }, when: { tech: 'eco_doubleentry' } }, state: { n: 'Banco estatal', m: { prod: .06, trade: -.06 }, when: { tech: 'soc_socialism' } } } },
  labor: { n: 'Trabalho', o: { serfdom: { n: 'Servidão', m: { tax: .05, prod: -.05, stab: -.03 } }, free: { n: 'Trabalho livre', m: {} }, unions: { n: 'Sindicatos', m: { stab: .05, prod: -.03 }, when: { tech: 'soc_unions' } }, collective: { n: 'Coletivizado', m: { prod: .08, stab: -.06 }, when: { tech: 'soc_socialism' } } } },
  land:  { n: 'Terra', o: { feudal: { n: 'Feudal', m: { manpower: .1, prod: -.04 } }, private: { n: 'Propriedade privada', m: { prod: .05, food: .05 }, when: { tech: 'soc_common_law' } }, reform: { n: 'Reforma agrária', m: { food: .1, stab: .04, tax: -.03 }, when: { tech: 'soc_mass_politics' } }, collective: { n: 'Fazendas coletivas', m: { food: -.05, prod: .05 }, when: { tech: 'soc_socialism' } } } },
  edu:   { n: 'Educação', o: { clergy: { n: 'Do clero', m: { stab: .03 } }, public: { n: 'Pública', m: { research: .08 }, when: { tech: 'soc_enlightenment' } }, mandatory: { n: 'Obrigatória', m: { research: .15, prod: .03 }, when: { tech: 'soc_nationalism' } } } },
  health:{ n: 'Saúde', o: { charity: { n: 'Caridade', m: {} }, public: { n: 'Pública', m: { growth: .08 }, when: { tech: 'soc_enlightenment' } }, universal: { n: 'Universal', m: { growth: .15, stab: .05 }, when: { tech: 'soc_welfare' } } } },
  police:{ n: 'Policiamento', o: { militia: { n: 'Milícias locais', m: {} }, police: { n: 'Polícia nacional', m: { stab: .05, coup: -.2 }, when: { tech: 'soc_nationalism' } }, secret: { n: 'Polícia secreta', m: { stab: .08, coup: -.5, research: -.04 }, when: { tech: 'soc_mass_media' } } } },
  vote:  { n: 'Sufrágio', o: { nobles: { n: 'Só nobres', m: {}, d: 'Só a classe alta pesa na política' }, census: { n: 'Censitário', m: { stab: .03 }, when: { tech: 'soc_constitution' }, d: 'Classes alta e média pesam na política' }, universal: { n: 'Universal', m: { stab: .06, research: .03 }, when: { tech: 'soc_mass_politics' }, d: 'Todas as classes livres pesam na política' } } },
  subsidy:{ eco: 1, n: 'Subsídios', o: { none: { n: 'Nenhum', m: {} }, agri: { n: 'Agrícolas', m: { food: .12, tax: -.03 } }, industry: { n: 'Industriais', m: { prod: .07, tax: -.05 }, when: { tech: 'eco_manufactory' } }, total: { n: 'Dirigismo', m: { prod: .1, food: .08, tax: -.1, trade: -.05 }, when: { tech: 'eco_assembly' } } } },
  company:{ eco: 1, n: 'Empresas', o: { guilds: { n: 'Guildas', m: { stab: .02, prod: -.02 } }, crown: { n: 'Monopólios régios', m: { tax: .08, prod: -.03, trade: .03 }, when: { tech: 'eco_banking' } }, free: { n: 'Livre iniciativa', m: { prod: .05, trade: .04, stab: -.02 }, when: { tech: 'eco_mercantilism' } }, state: { n: 'Estatais', m: { prod: .03, tax: .05, trade: -.05 }, when: { tech: 'soc_socialism' } } } },
  hours: { eco: 1, n: 'Jornada de trabalho', o: { free: { n: 'Sem limite', m: { prod: .04, stab: -.02 } }, ten: { n: 'Dez horas', m: { stab: .03 }, when: { tech: 'soc_unions' } }, eight: { n: 'Oito horas', m: { stab: .06, prod: -.02, growth: .02 }, when: { tech: 'soc_welfare' } } } },
  slavery:{ eco: 1, n: 'Escravidão', o: { banned: { n: 'Proibida', m: {}, sl: 0, d: 'Escravos são libertados aos poucos e viram classe baixa' }, colonial: { n: 'Só nas colônias', m: { tax: .02 }, sl: .25, d: 'Até 25% de escravos nas províncias fora do continente de origem' }, legal: { n: 'Legal', m: { tax: .04, prod: .02 }, sl: .15, d: 'Até 15% de escravos em todo o país' } } },
  relig: { n: 'Religião', o: { state: { n: 'Igreja de Estado', m: { stab: .04, research: -.03 }, mp: 1, d: 'Minorias religiosas: −0,8 de estabilidade por 10% da população' }, tolerant: { n: 'Tolerância', m: {}, mp: .5, when: { tech: 'soc_humanism' }, d: 'Minorias religiosas pesam metade' }, free: { n: 'Liberdade de culto', m: { research: .03 }, mp: .15, when: { tech: 'soc_enlightenment' }, d: 'Minorias quase não pesam' }, secular: { n: 'Estado laico', m: { research: .05, stab: -.02 }, mp: 0, when: { tech: 'soc_socialism' }, d: 'Nenhuma religião oficial; templos rendem menos estabilidade' } } },
  culture:{ n: 'Cidadania', o: { primary: { n: 'Só a cultura principal', m: {}, mp: 1, d: 'Minorias culturais: −0,8 de estabilidade por 10% da população e menos satisfação' }, accepted: { n: 'Culturas aceitas', m: { manpower: .05 }, mp: .5, when: { tech: 'soc_common_law' }, d: 'Minorias culturais pesam metade' }, multi: { n: 'Multiculturalismo', m: { growth: .03, manpower: .08 }, mp: .1, when: { tech: 'soc_welfare' }, d: 'Minorias quase não pesam' } } },
  women: { n: 'Mulheres', o: { patriarchy: { n: 'Patriarcado', m: {}, lab: .55, fr: .08, d: 'Força de trabalho: 55% da população' }, property: { n: 'Direito à propriedade', m: { prod: .02 }, lab: .57, fr: .12, when: { tech: 'soc_enlightenment' }, d: 'Força de trabalho: 57%' }, suffrage: { n: 'Sufrágio feminino', m: { stab: .03, prod: .03 }, lab: .6, fr: .25, when: { tech: 'soc_mass_politics' }, d: 'Força de trabalho: 60%; mais governantes mulheres' }, equality: { n: 'Igualdade plena', m: { prod: .05, research: .04, stab: .02 }, lab: .64, fr: .45, when: { tech: 'soc_welfare' }, d: 'Força de trabalho: 64%; metade dos governantes pode ser mulher' } } },
};
const LAW_DEF = { tax: 'normal', draft: 'limited', trade: 'normal', spend: 'normal', press: 'regulated', currency: 'metal', bank: 'none', labor: 'free', land: 'feudal', edu: 'clergy', health: 'charity', police: 'militia', vote: 'nobles', subsidy: 'none', company: 'guilds', hours: 'free', slavery: 'colonial', relig: 'state', culture: 'primary', women: 'patriarchy' };

/* ---------- autonomia de culturas e religiões que não são a principal/oficial (−2 a +2; 0 = livre) ----------
   w: peso como minoria (estabilidade e satisfação) · as: assimilação/conversão por ano · ag: agitação (revoltas) */
const CPOL = { '-2': { n: 'Escravizada', e: '⛓️', w: 2.5, as: 0, ag: 3, d: 'Parte desse povo vira escravo a cada mês (exige escravidão permitida). Pesa muito na estabilidade e gera revoltas.' },
  '-1': { n: 'Reprimida', e: '🚫', w: 1.6, as: 3, ag: 1.8, d: 'Assimilação três vezes mais rápida para a cultura principal, mas pesa mais e gera revoltas.' },
  '0': { n: 'Livre', e: '⚪', w: 1, as: 1, ag: 1, d: 'Situação normal de minoria: assimila devagar.' },
  '1': { n: 'Integrada', e: '🤝', w: .5, as: .4, ag: .5, d: 'Metade do peso como minoria; assimila bem devagar.' },
  '2': { n: 'Aceita', e: '✅', w: 0, as: 0, ag: 0, d: 'Conta como cultura do país (sem peso como minoria). Ocupa uma vaga de cultura secundária e pode virar a principal.' } };
const RPOL_N = { '-2': ['Perseguida', 'Fiéis dessa fé viram escravos a cada mês (exige escravidão permitida).'], '-1': ['Discriminada', 'Conversão três vezes mais rápida para a fé oficial, mas pesa mais e gera revoltas.'], '0': ['Livre', 'Situação normal de minoria: converte devagar.'], '1': ['Tolerada', 'Metade do peso como minoria; converte bem devagar.'], '2': ['Reconhecida', 'Conta como fé do país (sem peso). Ocupa uma vaga e pode virar a fé oficial.'] };
const CUL_SLOTS = { primary: 1, accepted: 3, multi: 8 }, REL_SLOTS = { state: 0, tolerant: 1, free: 3, secular: 8 };

/* ---------- religiões (reais e fictícias): cada cultura nasce com uma; as fictícias surgem como heresias ---------- */
const RELIGIONS = {
  roman:     { n: 'Cristianismo romano', e: '✝️', col: '#e8d48a' }, orthodox: { n: 'Cristianismo ortodoxo', e: '☦️', col: '#c9a0dc' },
  norse:     { n: 'Fé nórdica', e: '🪓', col: '#7aa6c2' }, slavic: { n: 'Fé eslava', e: '🌳', col: '#6f9e5a' },
  islam:     { n: 'Islã', e: '☪️', col: '#4fa36b' }, buddhism: { n: 'Budismo', e: '☸️', col: '#f0a64a' },
  confucian: { n: 'Confucionismo', e: '📜', col: '#d46a5a' }, ancestral: { n: 'Fé ancestral', e: '🥁', col: '#a0784a' },
  fifthsun:  { n: 'Culto do Quinto Sol', e: '🌞', col: '#e0703c' }, ocean: { n: 'Fé do Oceano', e: '🌊', col: '#4a9ec9' },
  zoroaster: { n: 'Zoroastrismo', e: '🔥', col: '#e6a23c' },
  aurora:    { n: 'Culto da Aurora', e: '🌅', col: '#ff9ec7', fict: 1 }, machine: { n: 'Igreja da Máquina', e: '⚙️', col: '#9aa4ad', fict: 1 },
  // religiões menores (sem Estado): bolsões espalhados pelo mundo
  druid:     { n: 'Fé druídica', e: '🌿', col: '#5f9e6e', minor: 1 }, shaman: { n: 'Xamanismo', e: '🦌', col: '#8f7a5c', minor: 1 },
  bon:       { n: 'Bön', e: '🏔️', col: '#b0705a', minor: 1 }, kamuy: { n: 'Fé Kamuy', e: '🐻', col: '#7d6a8f', minor: 1 },
  tengri:    { n: 'Tengrismo', e: '🐺', col: '#6f8fb5', minor: 1 }, gnostic: { n: 'Gnosticismo', e: '👁️', col: '#c8b7e8', minor: 1 },
  manich:    { n: 'Maniqueísmo', e: '🌗', col: '#9e9e6e', minor: 1 }, serpent: { n: 'Irmandade da Serpente', e: '🐍', col: '#5aa58a', minor: 1, fict: 1 },
};
const REL_IDS = Object.keys(RELIGIONS);
const CUL_MAJOR = 10;                                         // as 10 primeiras culturas podem ter nação; as outras são menores
const CUL_REL = ['roman', 'roman', 'norse', 'slavic', 'islam', 'confucian', 'ancestral', 'fifthsun', 'ocean', 'zoroaster'];   // pelo índice de CULTURES
const CUL_REL2 = ['orthodox', 'orthodox', 'roman', 'orthodox', 'islam', 'buddhism', 'islam', 'fifthsun', 'ocean', 'islam'];    // variante regional

/* ---------- espaço: foguete de cada vertente e a lua sorteada em cada partida ---------- */
const ROCKETS = { none: 'Foguete químico', clock: 'Foguete de corda', steam: 'Foguete a vapor', tesla: 'Canhão eletromagnético', diesel: 'Foguete a diesel', atom: 'Foguete nuclear', bio: 'Nave orgânica', cyber: 'Lançador em rede', solar: 'Vela solar', nano: 'Elevador de nanotubos', space: 'Nave estelar' };
const MOON_TYPES = [['Rochosa', '#9a9890'], ['Gelada', '#cfe6f2'], ['Oceânica', '#3f78b8'], ['Vulcânica', '#a5452c'], ['Desértica', '#cfa96a'], ['Selvagem', '#4f8a43']];
const ALIEN_ERAS = ['Idade da Pedra', 'Idade do Bronze', 'Idade Média', 'Renascimento', 'Era Industrial', 'Era Atômica', 'Era Digital', 'Era Interestelar'];
/* grupos de prédios (painel do estado e janela de construção) */
const BGROUPS = [['prod', '🌾 Produção e extração', ['farm', 'mill', 'fishery', 'lumber', 'quarry', 'plantation', 'iron_mine', 'coal_mine', 'gold_mine', 'copper_mine', 'uranium_mine', 'rare_mine', 'oil_well']],
  ['ind', '🏭 Indústria', ['weaver', 'textile_manuf', 'tailor', 'bakery', 'garment_factory', 'food_factory', 'workshop', 'smithy', 'foundry', 'blast_furnace', 'jeweler', 'manufactory', 'textile_mill', 'goods_factory', 'tool_factory', 'arms_factory', 'steel_mill', 'electronics']],
  ['energy', '⚡ Energia', ['power_plant', 'oil_plant', 'hydro', 'nuclear', 'wind', 'solar_plant', 'fusion']],
  ['infra', '🛤️ Transporte e comércio', ['road', 'railway', 'highway', 'hsr', 'maglev', 'tubes', 'portal', 'pipeline', 'port', 'market']],
  ['svc', '🏛️ Serviços públicos', ['hospital', 'school', 'office', 'guard', 'university', 'temple']],
  ['mil', '⚔️ Militar', ['castle', 'shipyard', 'barracks', 'academy', 'airbase', 'launch_site']],
  ['vert', '✨ Vertente', []]];
const bGroupOf = b => (BGROUPS.find(g => g[2].includes(b)) || BGROUPS[6])[0];
/* doenças menores, aleatórias ao longo do jogo */
const DISEASES = ['Febre', 'Tosse', 'Varíola', 'Febre amarela', 'Disenteria', 'Cólera', 'Gripe', 'Sarampo', 'Febre das águas', 'Peste suína', 'Febre dos pântanos'];
const COUNCIL = [['chancellor', 'Chanceler', 'dip'], ['marshal', 'Marechal', 'mar'], ['steward', 'Tesoureiro', 'adm'], ['spymaster', 'Mestre espião', 'int'], ['scholar', 'Erudito', 'lea']];

/* ---------- culturas: sílabas para nomes de lugares, pessoas e dinastias ---------- */
const CULTURES = [
  { n: 'Latina',   a: ['ro', 'ma', 'va', 'le', 'ti', 'ca', 'sa', 'lu', 'ne', 'ra', 'vi', 'to', 'ce', 'li', 'ri', 'tu'], b: ['ria', 'na', 'lia', 'ssa', 'ntia', 'rum', 'nia', 'ca', 'tia', 'lo'], m: ['Marco', 'Lúcio', 'Tito', 'Caio', 'Paulo', 'Otávio', 'Sérgio', 'Fábio', 'Júlio', 'Vítor'], f: ['Lívia', 'Júlia', 'Cláudia', 'Otávia', 'Paula', 'Flávia', 'Valéria', 'Aurélia'] },
  { n: 'Germânica', a: ['wal', 'ber', 'gun', 'hel', 'rich', 'win', 'ald', 'sig', 'thor', 'eg', 'hal', 'mund', 'bran', 'dor'], b: ['burg', 'heim', 'land', 'mark', 'stadt', 'feld', 'wald', 'au', 'gard', 'dorf'], m: ['Otto', 'Konrad', 'Heinrich', 'Ludwig', 'Albrecht', 'Siegfried', 'Gunther', 'Friedrich', 'Walter'], f: ['Mathilde', 'Hildegard', 'Gisela', 'Adelheid', 'Brunhilde', 'Irmgard', 'Kunigunde'] },
  { n: 'Nórdica',  a: ['ska', 'thor', 'ulf', 'bjor', 'sig', 'rag', 'hall', 'frey', 'ein', 'tor', 'vik', 'har', 'gun', 'sve'], b: ['heim', 'vik', 'fjord', 'by', 'gard', 'stad', 'ness', 'holm', 'dal', 'ey'], m: ['Ragnar', 'Bjorn', 'Ivar', 'Harald', 'Sigurd', 'Ulf', 'Halfdan', 'Erik', 'Olaf', 'Thorvald'], f: ['Astrid', 'Sigrid', 'Ingrid', 'Freydis', 'Gunnhild', 'Thyra', 'Ragnhild'] },
  { n: 'Eslava',   a: ['vla', 'mir', 'bor', 'sla', 'ra', 'do', 'bro', 'ko', 'zla', 'pol', 'kra', 'vo', 'lu', 'ro'], b: ['grad', 'slav', 'nia', 'ovo', 'sk', 'ava', 'mir', 'ice', 'ka', 'stan'], m: ['Vladimir', 'Boris', 'Jaroslav', 'Mstislav', 'Bogdan', 'Dobrogost', 'Kazimir', 'Svetopolk'], f: ['Olga', 'Ludmila', 'Dobrava', 'Milena', 'Rogneda', 'Zlata', 'Vesna'] },
  { n: 'Árabe',    a: ['al', 'ka', 'ra', 'sa', 'ma', 'ha', 'da', 'ja', 'za', 'qa', 'ba', 'ta', 'na', 'fa'], b: ['bad', 'dar', 'shan', 'mir', 'sur', 'ra', 'qan', 'iyya', 'ira', 'bah'], m: ['Harun', 'Yusuf', 'Ali', 'Tariq', 'Rashid', 'Khalid', 'Hamza', 'Idris', 'Saladin', 'Faisal'], f: ['Zaynab', 'Layla', 'Fatima', 'Aisha', 'Yasmin', 'Salma', 'Nur'] },
  { n: 'Sínica',   a: ['shan', 'li', 'wu', 'jin', 'han', 'zhou', 'ming', 'qin', 'yan', 'tang', 'lu', 'xia', 'song', 'hua'], b: ['an', 'ing', 'zhou', 'yang', 'du', 'shan', 'ling', 'hai', 'yuan', 'ning'], m: ['Wen', 'Jian', 'Hong', 'Zhi', 'Bao', 'Liang', 'Tao', 'Wei', 'Cheng', 'Kang'], f: ['Mei', 'Lian', 'Yue', 'Hua', 'Xiu', 'Ning', 'Jing'] },
  { n: 'Bantu',    a: ['ka', 'mba', 'zu', 'lu', 'ngo', 'ta', 'shi', 'ki', 'ma', 'wa', 'nde', 'bo', 'mu', 'si'], b: ['nda', 'mbe', 'zi', 'ngo', 'wa', 'land', 'lu', 'ro', 'kwe', 'shi'], m: ['Mansa', 'Sundiata', 'Chaka', 'Kwame', 'Jabari', 'Tendai', 'Oba', 'Kofi', 'Mbeki'], f: ['Nzinga', 'Amani', 'Zuri', 'Nala', 'Ama', 'Imani', 'Thandiwe'] },
  { n: 'Nauatle',  a: ['tla', 'xo', 'cha', 'tec', 'ma', 'ix', 'ozo', 'co', 'te', 'mix', 'za', 'qui', 'hua', 'to'], b: ['tlan', 'pan', 'co', 'tepec', 'can', 'apan', 'titlan', 'lco', 'xco', 'huac'], m: ['Itzcoatl', 'Tizoc', 'Ahuitzotl', 'Cuauhtli', 'Xolotl', 'Tlacaelel', 'Mixcoatl'], f: ['Citlali', 'Xochitl', 'Itzel', 'Yaretzi', 'Tonalli', 'Atzi'] },
  { n: 'Polinésia', a: ['ka', 'mo', 'ha', 'lei', 'ta', 'ri', 'ma', 'oa', 'pu', 'ke', 'na', 'ho', 'ki', 'tu'], b: ['loa', 'kai', 'nui', 'moana', 'rua', 'tea', 'hiva', 'lani', 'aro', 'riki'], m: ['Kamehameha', 'Tane', 'Maui', 'Keola', 'Rangi', 'Tupa', 'Kai', 'Hoku'], f: ['Leilani', 'Moana', 'Kalani', 'Hina', 'Malia', 'Noelani'] },
  { n: 'Persa',    a: ['par', 'sa', 'kho', 'da', 'ar', 'mi', 'ra', 'sha', 'ba', 'zar', 'ves', 'ta', 'pa', 'go'], b: ['stan', 'abad', 'van', 'shahr', 'gird', 'kand', 'pur', 'dan', 'shan', 'zar'], m: ['Darius', 'Cyrus', 'Khosrow', 'Ardashir', 'Shapur', 'Bahram', 'Rostam', 'Kaveh'], f: ['Roxana', 'Shirin', 'Parisa', 'Azadeh', 'Mitra', 'Soraya', 'Yasaman'] },

  // culturas menores, sem nação própria: nascem em bolsões dentro de outros países
  { n: 'Basca', minor: 1, rel: 'roman', a: ['ar', 'go', 'ize', 'mai', 'txu', 'be', 'lo', 'za'], b: ['rri', 'tegi', 'eta', 'aga', 'ola', 'ondo'], m: ['Aitor', 'Iñaki', 'Xabier', 'Gorka', 'Unai'], f: ['Ane', 'Maite', 'Nerea', 'Itziar', 'Amaia'] },
  { n: 'Gaélica', minor: 1, rel: 'druid', a: ['dun', 'kil', 'bal', 'glen', 'inis', 'ard', 'cair', 'loch'], b: ['more', 'beg', 'ach', 'an', 'ree', 'ross'], m: ['Brian', 'Cormac', 'Niall', 'Fergus', 'Conall'], f: ['Brigid', 'Aoife', 'Niamh', 'Saoirse', 'Deirdre'] },
  { n: 'Lapônica', minor: 1, rel: 'shaman', a: ['sam', 'ki', 'jaur', 'vuo', 'rov', 'ina', 'ana', 'gal'], b: ['ri', 'javri', 'vuopmi', 'oaivi', 'la'], m: ['Ánte', 'Niillas', 'Ásllat', 'Mihkkal'], f: ['Elle', 'Máret', 'Sárá', 'Ristin'] },
  { n: 'Berbere', minor: 1, rel: 'ancestral', a: ['ta', 'ma', 'zi', 'ghr', 'ou', 'ti', 'ad', 'ag'], b: ['mazirt', 'zou', 'ghen', 'dad', 'ouine', 'tit'], m: ['Masinissa', 'Yugurta', 'Aksil', 'Idir', 'Massin'], f: ['Tiziri', 'Dihya', 'Tanirt', 'Lunja'] },
  { n: 'Tibetana', minor: 1, rel: 'bon', a: ['lha', 'gyal', 'tse', 'dro', 'sam', 'ri', 'ngar', 'khar'], b: ['sa', 'tse', 'ling', 'gang', 'pa', 'chen'], m: ['Tenzin', 'Norbu', 'Dorje', 'Pema', 'Jampa'], f: ['Dolma', 'Yangchen', 'Lhamo', 'Kunsang'] },
  { n: 'Andina', minor: 1, rel: 'fifthsun', a: ['wa', 'ti', 'qha', 'pu', 'cha', 'ka', 'yu', 'mar'], b: ['pampa', 'marka', 'llaqta', 'qucha', 'wasi', 'kancha'], m: ['Wayna', 'Tupaq', 'Inti', 'Waman', 'Kusi'], f: ['Killa', 'Sisa', 'Urpi', 'Chaska', 'Nina'] },
  { n: 'Ainu', minor: 1, rel: 'kamuy', a: ['shi', 'ka', 'ru', 'po', 'ta', 'ni', 'sap', 'pet'], b: ['pet', 'nay', 'shiri', 'kotan', 'ushi', 'to'], m: ['Shakushain', 'Kamuy', 'Ekashi', 'Retar'], f: ['Huchi', 'Pirka', 'Mena', 'Uapo'] },
  { n: 'Malgaxe', minor: 1, rel: 'ancestral', a: ['ana', 'tsi', 'mi', 'ra', 'vo', 'ki', 'ma', 'fi'], b: ['vo', 'rivo', 'tsara', 'ana', 'be', 'tany'], m: ['Rado', 'Andry', 'Ravo', 'Hery', 'Tojo'], f: ['Lova', 'Soa', 'Hanta', 'Fara', 'Vola'] },
  { n: 'Estepária', minor: 1, rel: 'tengri', a: ['kur', 'tem', 'bat', 'ak', 'kara', 'sar', 'tol', 'yen'], b: ['tai', 'bek', 'kul', 'tash', 'dar', 'gan'], m: ['Temür', 'Bars', 'Arslan', 'Kutlu', 'Bayan'], f: ['Altani', 'Börte', 'Khulan', 'Ayaz'] },
];
