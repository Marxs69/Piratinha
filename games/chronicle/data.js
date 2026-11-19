/* Grand Chronicle — dados do jogo: bens, prédios, tecnologias, vertentes, governos, ideologias, unidades, traços e nomes.
   Tudo aqui é tabela; a lógica fica em sim.js. Para equilibrar, mexa nos números daqui. */
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

/* necessidades da população por 1.000 habitantes/mês; crescem com o tempo (padrão de vida) */
function popNeeds(year) {
  const t = Math.max(0, Math.min(1, (year - 860) / 900));             // pré-industrial: sobe devagar até 1760
  const ti = Math.max(0, Math.min(1, (year - 1760) / 200));           // industrialização
  const t2 = Math.max(0, Math.min(1, (year - 1950) / 250));           // era digital e futura
  return { food: 1, cloth: .04 + .02 * t + .08 * ti, goods: .015 + .02 * t + .18 * ti + .2 * t2, lux: .0012 + .003 * t + .009 * ti, elec: year < 1950 ? 0 : .01 + .12 * t2, power: year < 1890 ? 0 : .01 + .05 * Math.min(1, (year - 1890) / 110) + .12 * t2 };
}

/* ---------- prédios (no estado; nível = quantas unidades) ----------
   w = mil trabalhadores por nível · in/out = bens por mês por nível · req = condição do estado · tech = tecnologia que libera */
const BUILDINGS = {
  farm:        { n: 'Fazenda', e: '🌾', cost: 60, w: 2, out: { grain: 4.4 }, req: 'arable' },
  fishery:     { n: 'Pesqueiro', e: '🐟', cost: 50, w: 1, out: { fish: 2.6 }, req: 'coast' },
  lumber:      { n: 'Madeireira', e: '🪵', cost: 45, w: 1, out: { wood: 3 }, req: 'forest' },
  quarry:      { n: 'Pedreira', e: '🪨', cost: 50, w: 1, out: { stone: 2.6 }, req: 'rocky' },
  iron_mine:   { n: 'Mina de ferro', e: '⛓️', cost: 80, w: 1.5, out: { iron: 2.2 }, req: 'res:iron' },
  coal_mine:   { n: 'Mina de carvão', e: '⚫', cost: 80, w: 1.5, out: { coal: 2.6 }, req: 'res:coal', tech: 'eco_deepmining' },
  gold_mine:   { n: 'Mina de ouro', e: '🪙', cost: 120, w: 1, out: { gold: .45 }, req: 'res:gold' },
  plantation:  { n: 'Plantação', e: '🧶', cost: 60, w: 2, out: { fiber: 3.4 }, req: 'warm' },
  weaver:      { n: 'Tecelagem', e: '🧵', cost: 70, w: 1, in: { fiber: 2 }, out: { cloth: 1.6 } },
  workshop:    { n: 'Oficina de artesãos', e: '🏺', cost: 80, w: 1, in: { wood: 1, cloth: .3 }, out: { goods: .85 } },
  smithy:      { n: 'Ferraria', e: '🔨', cost: 90, w: 1, in: { iron: 1, wood: .6 }, out: { tools: .5, arms: .45 } },
  jeweler:     { n: 'Ourivesaria', e: '💎', cost: 120, w: .6, in: { gold: .2, cloth: .2 }, out: { lux: .42 }, tech: 'eco_guilds' },
  market:      { n: 'Mercado', e: '🏪', cost: 90, w: .5, fx: { tax: .06 }, tech: 'eco_trade_fairs', max: 3 },
  castle:      { n: 'Castelo', e: '🏰', cost: 150, w: .3, fx: { fort: 1 }, max: 3 },
  port:        { n: 'Porto', e: '⚓', cost: 120, w: .6, fx: { port: 1, trade: .04 }, req: 'coast', max: 3 },
  university:  { n: 'Universidade', e: '🎓', cost: 160, w: .4, fx: { research: 2.5 }, tech: 'soc_universities', max: 3 },
  temple:      { n: 'Templo', e: '⛪', cost: 100, w: .3, fx: { stab: .5 }, max: 2 },
  manufactory: { n: 'Manufatura', e: '🏭', cost: 200, w: 2, in: { cloth: .8, wood: 1 }, out: { goods: 2.6 }, tech: 'eco_manufactory' },
  textile_mill:{ n: 'Fábrica têxtil', e: '🧵', cost: 320, w: 3, in: { fiber: 4, coal: .5, power: .3 }, out: { cloth: 5.5 }, tech: 'eco_textile' },
  goods_factory:{ n: 'Fábrica de bens', e: '🏭', cost: 380, w: 3, in: { cloth: 1, steel: .5, wood: 1, power: .5 }, out: { goods: 4.6 }, tech: 'eco_factory' },
  tool_factory:{ n: 'Fábrica de ferramentas', e: '🔧', cost: 360, w: 3, in: { steel: 1.5, coal: .5, power: .4 }, out: { tools: 3.4 }, tech: 'eco_mechanization' },
  arms_factory:{ n: 'Fábrica de armamentos', e: '💣', cost: 400, w: 3, in: { steel: 1.5, coal: .5, power: .4 }, out: { arms: 3.2 }, tech: 'eco_interchangeable' },
  steel_mill:  { n: 'Siderúrgica', e: '🔩', cost: 420, w: 3, in: { iron: 3, coal: 2, power: .8 }, out: { steel: 3.4 }, tech: 'eco_bessemer' },
  railway:     { n: 'Ferrovia', e: '🚂', cost: 300, w: 1, in: { steel: .3, coal: .5 }, fx: { prod: .08, speed: .5, infra: 2 }, tech: 'eco_railways', max: 3 },
  copper_mine: { n: 'Mina de cobre', e: '🟠', cost: 80, w: 1.5, out: { copper: 2.4 }, req: 'res:copper' },
  uranium_mine:{ n: 'Mina de urânio', e: '☢️', cost: 300, w: 1, out: { uranium: 1.4 }, req: 'res:uranium', tech: 'eco_electricity' },
  rare_mine:   { n: 'Mina de terras raras', e: '💠', cost: 350, w: 1.5, out: { rare: 1.2 }, req: 'res:rare', tech: 'eco_assembly' },
  oil_well:    { n: 'Poço de petróleo', e: '🛢️', cost: 300, w: 1, out: { oil: 3.2 }, req: 'res:oil', tech: 'eco_oil' },
  power_plant: { n: 'Termelétrica a carvão', e: '🏭', cost: 420, w: 1, in: { coal: 2 }, out: { power: 5 }, tech: 'eco_electricity' },
  electronics: { n: 'Fábrica de eletrônicos', e: '📟', cost: 600, w: 3, in: { steel: .5, oil: .6, power: .8 }, out: { elec: 1.6 }, tech: 'eco_transistor' },
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
T('eco_watermill', 'eco', 980, 'Moinho d’água', ['eco_heavyplough'], { m: { prod: .05 } });
T('eco_three_field', 'eco', 1050, 'Rotação trienal', ['eco_heavyplough'], { bo: { farm: .2 }, m: { growth: .1 } });
T('eco_trade_fairs', 'eco', 1100, 'Feiras comerciais', ['eco_watermill'], { b: ['market'], m: { trade: .05 } });
T('eco_guilds', 'eco', 1180, 'Guildas', ['eco_trade_fairs'], { b: ['jeweler'], bo: { workshop: .2, smithy: .15 } });
T('eco_deepmining', 'eco', 1200, 'Mineração profunda', ['eco_watermill'], { b: ['coal_mine'], bo: { iron_mine: .2, gold_mine: .2 } });
T('eco_banking', 'eco', 1300, 'Bancos', ['eco_guilds'], { m: { tax: .08 } });
T('eco_doubleentry', 'eco', 1450, 'Partidas dobradas', ['eco_banking'], { m: { tax: .06 }, slots: 1 });
T('eco_colonization', 'eco', 1490, 'Colonização', ['eco_doubleentry', 'nav_caravel'], { col: 1, m: { colon: .1 } });
T('eco_mercantilism', 'eco', 1520, 'Mercantilismo', ['eco_doubleentry'], { i: ['mercant'], m: { trade: .1 } });
T('eco_manufactory', 'eco', 1560, 'Manufaturas', ['eco_mercantilism'], { b: ['manufactory'] });
T('eco_companies', 'eco', 1600, 'Companhias de comércio', ['eco_colonization', 'eco_mercantilism'], { col: 1, m: { trade: .1, colon: .15 } });
T('eco_agri_rev', 'eco', 1700, 'Revolução agrícola', ['eco_manufactory'], { bo: { farm: .3, plantation: .2 }, m: { growth: .15 } });
T('eco_steam', 'eco', 1770, 'Máquina a vapor', ['eco_agri_rev'], { m: { prod: .08 }, slots: 1 });
T('eco_textile', 'eco', 1780, 'Maquinário têxtil', ['eco_steam'], { b: ['textile_mill'] });
T('eco_factory', 'eco', 1800, 'Sistema fabril', ['eco_textile'], { b: ['goods_factory'] });
T('eco_mechanization', 'eco', 1820, 'Mecanização', ['eco_factory'], { b: ['tool_factory'] });
T('eco_interchangeable', 'eco', 1830, 'Peças intercambiáveis', ['eco_mechanization'], { b: ['arms_factory'] });
T('eco_railways', 'eco', 1830, 'Ferrovias', ['eco_steam'], { b: ['railway'], slots: 1 });
T('eco_bessemer', 'eco', 1856, 'Processo Bessemer', ['eco_railways'], { b: ['steel_mill'] });
T('eco_oil', 'eco', 1870, 'Perfuração de petróleo', ['eco_bessemer'], { b: ['oil_well'] });
T('eco_electricity', 'eco', 1885, 'Eletricidade', ['eco_oil'], { b: ['power_plant', 'hydro'], m: { research: .05 } });
T('eco_oil_power', 'eco', 1900, 'Termelétricas a óleo', ['eco_electricity'], { b: ['oil_plant'] });
T('eco_pipelines', 'eco', 1905, 'Oleodutos e gasodutos', ['eco_oil'], { b: ['pipeline'], m: { trade: .03 } });
T('eco_fertilizer', 'eco', 1910, 'Fertilizantes químicos', ['eco_electricity'], { bo: { farm: .35 }, m: { growth: .1 } });
T('eco_assembly', 'eco', 1913, 'Linha de montagem', ['eco_electricity'], { m: { prod: .12 }, slots: 1 });
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
T('soc_common_law', 'soc', 1250, 'Direito comum', ['soc_charters'], { m: { stab: .05 } });
T('soc_printing', 'soc', 1450, 'Imprensa', ['soc_scholastic'], { m: { research: .12 } });
T('soc_humanism', 'soc', 1470, 'Humanismo', ['soc_printing'], { m: { stab: .03, research: .05 } });
T('soc_absolutism', 'soc', 1600, 'Absolutismo', ['soc_humanism', 'soc_common_law'], { g: ['absolute'], i: ['absolut'], slots: 1 });
T('soc_scientific', 'soc', 1620, 'Revolução científica', ['soc_humanism'], { m: { research: .15 } });
T('soc_enlightenment', 'soc', 1700, 'Iluminismo', ['soc_scientific'], { g: ['enlightened', 'constitutional'], i: ['liberal'] });
T('soc_constitution', 'soc', 1780, 'Constitucionalismo', ['soc_enlightenment'], { g: ['parliamentary', 'presidential'], i: ['conservative', 'radical'] });
T('soc_nationalism', 'soc', 1800, 'Nacionalismo', ['soc_constitution'], { g: ['federal', 'junta', 'caudillo'], m: { manpower: .15 } });
T('soc_socialism', 'soc', 1848, 'Socialismo', ['soc_nationalism', 'eco_factory'], { g: ['peoples', 'commune'], i: ['socialism', 'anarchism'] });
T('soc_unions', 'soc', 1880, 'Sindicatos', ['soc_socialism'], { g: ['syndicalist'], i: ['syndicalism'] });
T('soc_mass_politics', 'soc', 1890, 'Política de massas', ['soc_unions'], { i: ['socdem', 'natpop', 'agrarian'] });
T('soc_mass_media', 'soc', 1920, 'Comunicação de massa', ['soc_mass_politics', 'eco_electricity'], { g: ['one_party', 'totalitarian'], i: ['totalism', 'futurism'] });
T('soc_technocracy', 'soc', 1930, 'Tecnocracia', ['soc_mass_media'], { g: ['technate'], i: ['technocrat'] });
T('soc_welfare', 'soc', 1945, 'Estado de bem-estar', ['soc_mass_media'], { m: { stab: .1, growth: .05 } });
T('soc_globalization', 'soc', 1990, 'Globalização', ['soc_welfare', 'eco_internet'], { i: ['neolib', 'green'], m: { trade: .1 } });
T('soc_transhumanism', 'soc', 2020, 'Transumanismo', ['soc_globalization'], { i: ['transhum'], g: ['corporate'] });
T('soc_digital_dem', 'soc', 2040, 'Democracia digital', ['soc_transhumanism'], { g: ['liquid'] });
T('soc_ai_gov', 'soc', 2080, 'Governança algorítmica', ['soc_digital_dem', 'eco_ai'], { g: ['synthocracy'], i: ['accel'] });
T('soc_posthuman', 'soc', 2120, 'Pós-humanismo', ['soc_ai_gov'], { i: ['posthuman'], m: { research: .2 } });
T('soc_galactic', 'soc', 2165, 'Hegemonia orbital', ['soc_posthuman', 'nav_orbit'], { g: ['hegemony'], i: ['cosmism'] });
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
    entry: { y: 1960, c: 'eco', req: ['eco_green_rev'], n: 'Engenharia genética' },
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
    entry: { y: 2080, c: 'eco', req: ['eco_fusion'], n: 'Nanomáquinas' },
    tree: [[2095, 'mil', 'Nanotropa'], [2110, 'eco', 'Matéria programável'], [2130, 'nav', 'Cascos autorreparáveis'], [2150, 'mil', 'Nuvem cinza'], [2170, 'eco', 'Forja infinita'], [2190, 'nav', 'Naves de matéria']],
    unit: ['Nanotropa', 'Legião autorreparável', 'Soldados de matéria', 'Nuvem cinza', 'Exército fluido'] },
  { id: 'space', need: 'launch', n: 'Spacepunk', e: '🚀', col: '#7e57c2', good: 'he3', bld: 'spaceport', m: { research: .25, trade: .3, army: .2 },
    entry: { y: 2120, c: 'nav', req: ['nav_seastead'], n: 'Elevadores orbitais' },
    tree: [[2135, 'nav', 'Estações orbitais'], [2150, 'eco', 'Mineração lunar'], [2165, 'mil', 'Tropas de queda'], [2180, 'nav', 'Colônias marcianas'], [2195, 'eco', 'Império estelar']],
    unit: ['Fuzileiros orbitais', 'Tropas de queda', 'Naves de assalto', 'Legiões estelares', 'Armada do vazio'] },
];
const VERT = Object.fromEntries(VERTS.map(v => [v.id, v]));
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
  tribal_conf:   { n: 'Confederação tribal', cat: 'Tribal', succ: 'council', term: 8, t: 'Chefe supremo', fmt: 'Confederação de {}', m: { tax: -.2, stab: .1, research: -.15 }, coup: .4 },
  horde:         { n: 'Horda nômade', cat: 'Tribal', succ: 'elect', t: 'Cã', fmt: 'Horda de {}', m: { tax: -.4, army: .2, manpower: .4, prod: -.2, speed: .3 }, coup: 1.2 },
  feudal:        { n: 'Monarquia feudal', cat: 'Monarquia', succ: 'hered', t: 'Rei', fmt: 'Reino de {}', m: { tax: -.1, manpower: .2 }, coup: .5 },
  elective:      { n: 'Monarquia eletiva', cat: 'Monarquia', succ: 'elect', t: 'Rei eleito', fmt: 'Reino de {}', m: { tax: -.05, research: .05, stab: -.05 }, coup: .4 },
  absolute:      { n: 'Monarquia absoluta', cat: 'Monarquia', succ: 'hered', t: 'Rei', fmt: 'Reino de {}', m: { tax: .15, stab: .1, research: -.05, manpower: .1 }, coup: .3 },
  enlightened:   { n: 'Despotismo esclarecido', cat: 'Monarquia', succ: 'hered', t: 'Monarca', fmt: 'Reino de {}', m: { research: .15, tax: .1 }, coup: .4 },
  constitutional:{ n: 'Monarquia constitucional', cat: 'Monarquia', succ: 'hered', t: 'Monarca', fmt: 'Reino Unido de {}', m: { research: .1, prod: .1, stab: .05 }, coup: .2 },
  empire:        { n: 'Império', cat: 'Monarquia', succ: 'hered', t: 'Imperador', fmt: 'Império de {}', m: { tax: .1, army: .1, stab: -.05 }, coup: .6, minProv: 120 },
  merchant:      { n: 'República mercantil', cat: 'República', succ: 'term', term: 10, t: 'Doge', fmt: 'Sereníssima de {}', m: { trade: .3, tax: .1, manpower: -.2 }, coup: .3 },
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
  hegemony:      { n: 'Hegemonia orbital', cat: 'Tecnocracia', succ: 'council', term: 10, t: 'Hegemon', fmt: 'Hegemonia de {}', m: { tax: .1, prod: .1, research: .1, army: .1, stab: .1 }, coup: .2 },
};

/* ---------- níveis de título (como no CK3): limitam quantas províncias o país sustenta ----------
   cap: províncias sem perder estabilidade · req: mínimo para proclamar o nível · no nível 3 cada governo usa o próprio nome (fmt/t) */
const RANK_N = ['Baronia', 'Condado', 'Ducado', 'Reino', 'Império'];
const RANK_CAP = [10, 25, 60, 150, 1e9], RANK_REQ = [0, 6, 16, 40, 100];
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
  tax:   { n: 'Impostos', o: { low: { n: 'Baixos', m: { tax: -.2, stab: .08, growth: .03 } }, normal: { n: 'Normais', m: {} }, high: { n: 'Altos', m: { tax: .2, stab: -.08 } }, extort: { n: 'Extorsivos', m: { tax: .4, stab: -.2, growth: -.1 } } } },
  draft: { n: 'Recrutamento', o: { volunteer: { n: 'Voluntários', m: { manpower: -.4, prod: .05 } }, limited: { n: 'Limitado', m: {} }, wide: { n: 'Amplo', m: { manpower: .3, prod: -.05 } }, total: { n: 'Mobilização total', m: { manpower: .8, prod: -.15, stab: -.05 }, req: 'mil_conscription' } } },
  trade: { n: 'Comércio', o: { free: { n: 'Livre comércio', m: { trade: .15, prod: -.03 }, req: 'eco_mercantilism' }, normal: { n: 'Tarifas moderadas', m: {} }, protect: { n: 'Protecionismo', m: { trade: -.1, prod: .06 } }, autarky: { n: 'Autarquia', m: { trade: -.4, prod: .08, stab: .03 } } } },
  spend: { n: 'Gastos públicos', o: { austerity: { n: 'Austeridade', m: { stab: -.05 }, svc: .5 }, normal: { n: 'Equilibrados', m: {}, svc: 1 }, welfare: { n: 'Bem-estar social', m: { stab: .08, growth: .05 }, svc: 1.6, req: 'soc_welfare' } } },
  press: { n: 'Imprensa', o: { censored: { n: 'Censurada', m: { stab: .05, research: -.05 } }, regulated: { n: 'Regulada', m: {} }, free: { n: 'Livre', m: { research: .06, stab: -.03 }, req: 'soc_printing' } } },
};
const LAW_DEF = { tax: 'normal', draft: 'limited', trade: 'normal', spend: 'normal', press: 'regulated' };

/* ---------- espaço: foguete de cada vertente e a lua sorteada em cada partida ---------- */
const ROCKETS = { none: 'Foguete químico', clock: 'Foguete de corda', steam: 'Foguete a vapor', tesla: 'Canhão eletromagnético', diesel: 'Foguete a diesel', atom: 'Foguete nuclear', bio: 'Nave orgânica', cyber: 'Lançador em rede', solar: 'Vela solar', nano: 'Elevador de nanotubos', space: 'Nave estelar' };
const MOON_TYPES = [['Rochosa', '#9a9890'], ['Gelada', '#cfe6f2'], ['Oceânica', '#3f78b8'], ['Vulcânica', '#a5452c'], ['Desértica', '#cfa96a'], ['Selvagem', '#4f8a43']];
const ALIEN_ERAS = ['Idade da Pedra', 'Idade do Bronze', 'Idade Média', 'Renascimento', 'Era Industrial', 'Era Atômica', 'Era Digital', 'Era Interestelar'];
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
];
