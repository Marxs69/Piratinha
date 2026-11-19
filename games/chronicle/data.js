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
  cloth:   { n: 'Tecido', p: 5, c: 'ind', e: '🧵' },
  goods:   { n: 'Bens de consumo', p: 8, c: 'ind', e: '🏺' },
  tools:   { n: 'Ferramentas', p: 7, c: 'ind', e: '🔨' },
  arms:    { n: 'Armas', p: 9, c: 'ind', e: '🗡️' },
  steel:   { n: 'Aço', p: 8, c: 'ind', e: '🔩' },
  elec:    { n: 'Eletrônicos', p: 25, c: 'ind', e: '📟' },
  lux:     { n: 'Luxo', p: 20, c: 'lux', e: '💎' },
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
  const t = Math.max(0, Math.min(1, (year - 860) / 1100));            // 0 em 860, 1 em 1960
  const t2 = Math.max(0, Math.min(1, (year - 1950) / 250));           // era digital e futura
  return { food: 1, cloth: .04 + .1 * t, goods: .015 + .22 * t + .2 * t2, lux: .0012 + .012 * t, elec: year < 1950 ? 0 : .01 + .12 * t2 };
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
  textile_mill:{ n: 'Fábrica têxtil', e: '🧵', cost: 320, w: 3, in: { fiber: 4, coal: .5 }, out: { cloth: 5.5 }, tech: 'eco_textile' },
  goods_factory:{ n: 'Fábrica de bens', e: '🏭', cost: 380, w: 3, in: { cloth: 1, steel: .5, wood: 1 }, out: { goods: 4.6 }, tech: 'eco_factory' },
  tool_factory:{ n: 'Fábrica de ferramentas', e: '🔧', cost: 360, w: 3, in: { steel: 1.5, coal: .5 }, out: { tools: 3.4 }, tech: 'eco_mechanization' },
  arms_factory:{ n: 'Fábrica de armamentos', e: '💣', cost: 400, w: 3, in: { steel: 1.5, coal: .5 }, out: { arms: 3.2 }, tech: 'eco_interchangeable' },
  steel_mill:  { n: 'Siderúrgica', e: '🔩', cost: 420, w: 3, in: { iron: 3, coal: 2 }, out: { steel: 3.4 }, tech: 'eco_bessemer' },
  railway:     { n: 'Ferrovia', e: '🚂', cost: 300, w: 1, in: { steel: .3, coal: .5 }, fx: { prod: .1, speed: .5 }, tech: 'eco_railways', max: 3 },
  oil_well:    { n: 'Poço de petróleo', e: '🛢️', cost: 300, w: 1, out: { oil: 3.2 }, req: 'res:oil', tech: 'eco_oil' },
  power_plant: { n: 'Usina elétrica', e: '🔌', cost: 450, w: 1, in: { coal: 2 }, fx: { prod: .15 }, tech: 'eco_electricity', max: 3 },
  electronics: { n: 'Fábrica de eletrônicos', e: '📟', cost: 600, w: 3, in: { steel: .5, oil: .6 }, out: { elec: 1.6 }, tech: 'eco_transistor' },
  // vertentes
  clock_works: { n: 'Oficina de engrenagens', e: '⚙️', cost: 220, w: 1, in: { iron: 1, tools: .3 }, out: { gears: 1 }, vert: 'clock' },
  steam_foundry:{ n: 'Fundição a vapor', e: '♨️', cost: 300, w: 2, in: { iron: 1.5, coal: 1.5 }, out: { boilers: 1.2 }, vert: 'steam' },
  tesla_tower: { n: 'Torre Tesla', e: '⚡', cost: 380, w: 1, in: { steel: 1, coal: 1 }, out: { coils: 1.2 }, fx: { prod: .05 }, vert: 'tesla' },
  diesel_works:{ n: 'Fábrica de motores', e: '🛞', cost: 400, w: 2, in: { steel: 1, oil: 1.5 }, out: { engines: 1.2 }, vert: 'diesel' },
  reactor:     { n: 'Reator atômico', e: '☢️', cost: 600, w: 1, in: { steel: 1.5, coal: 1 }, out: { cores: .7 }, fx: { prod: .08 }, vert: 'atom' },
  biovat:      { n: 'Tanque biológico', e: '🧬', cost: 450, w: 1, in: { grain: 3 }, out: { biomass: 1.6 }, vert: 'bio' },
  chipfab:     { n: 'Fábrica de implantes', e: '💾', cost: 700, w: 2, in: { elec: 1, steel: .5 }, out: { chips: 1.1 }, vert: 'cyber' },
  solar_array: { n: 'Fazenda solar', e: '☀️', cost: 600, w: 1, in: { steel: .5, elec: .2 }, out: { panels: 1.6 }, fx: { prod: .06 }, vert: 'solar' },
  nanoforge:   { n: 'Nanoforja', e: '🔬', cost: 900, w: 1, in: { elec: .5, steel: .5 }, out: { nanites: .7 }, vert: 'nano' },
  spaceport:   { n: 'Porto espacial', e: '🚀', cost: 1200, w: 2, in: { steel: 2, elec: 1 }, out: { he3: .6 }, vert: 'space' },
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
T('mil_drill', 'mil', 1620, 'Exército permanente', ['mil_musket'], { m: { army: .1 } });
T('mil_bayonet', 'mil', 1690, 'Baioneta', ['mil_drill'], { u: { inf: .4, cav: .2 } });
T('mil_fieldart', 'mil', 1720, 'Artilharia de campanha', ['mil_bayonet'], { u: { art: .6 } });
T('mil_conscription', 'mil', 1790, 'Conscrição em massa', ['mil_fieldart', 'soc_nationalism'], { m: { manpower: .3 } });
T('mil_rifle', 'mil', 1840, 'Fuzil raiado', ['mil_conscription'], { u: { inf: .6 } });
T('mil_breech', 'mil', 1865, 'Retrocarga', ['mil_rifle'], { u: { inf: .5, art: .6 } });
T('mil_machinegun', 'mil', 1885, 'Metralhadora', ['mil_breech'], { u: { inf: .9 } });
T('mil_trench', 'mil', 1910, 'Guerra de trincheiras', ['mil_machinegun'], { u: { inf: .5 }, fort: 1 });
T('mil_aircraft', 'mil', 1915, 'Aviação militar', ['mil_machinegun', 'eco_assembly'], { u: { inf: .4, cav: .4, art: .4 } });
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
T('nav_seastead', 'nav', 2090, 'Cidades flutuantes', ['nav_autonomous'], { m: { growth: .1, trade: .1 } });
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
T('eco_electricity', 'eco', 1885, 'Eletricidade', ['eco_oil'], { b: ['power_plant'], m: { research: .05 } });
T('eco_fertilizer', 'eco', 1910, 'Fertilizantes químicos', ['eco_electricity'], { bo: { farm: .35 }, m: { growth: .1 } });
T('eco_assembly', 'eco', 1913, 'Linha de montagem', ['eco_electricity'], { m: { prod: .12 }, slots: 1 });
T('eco_transistor', 'eco', 1950, 'Transistor', ['eco_assembly'], { b: ['electronics'] });
T('eco_green_rev', 'eco', 1960, 'Revolução verde', ['eco_fertilizer'], { bo: { farm: .5 }, m: { growth: .15 } });
T('eco_computers', 'eco', 1965, 'Computadores', ['eco_transistor'], { m: { research: .12 } });
T('eco_automation', 'eco', 1980, 'Automação', ['eco_computers'], { m: { prod: .15 }, slots: 1 });
T('eco_internet', 'eco', 1993, 'Internet', ['eco_automation'], { m: { research: .12, trade: .1 } });
T('eco_ai', 'eco', 2030, 'Inteligência artificial', ['eco_internet'], { m: { research: .15, prod: .1 } });
T('eco_fusion', 'eco', 2070, 'Fusão nuclear', ['eco_ai'], { m: { prod: .2 } });
T('eco_molecular', 'eco', 2110, 'Manufatura molecular', ['eco_fusion'], { m: { prod: .2 }, slots: 2 });
T('eco_postscarcity', 'eco', 2150, 'Pós-escassez', ['eco_molecular'], { m: { prod: .25, stab: .1 } });
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

/* ---------- vertentes (exclusivas: a primeira pesquisada prende a nação a ela) ----------
   y: ano de cada nível · m: bônus por nível · unit: nome da unidade especial por nível · good/bld: bem e prédio da vertente */
const VERTS = [
  { id: 'clock', n: 'Clockpunk', e: '⚙️', col: '#c9a227', y: [1400, 1520, 1680, 1900, 2120], good: 'gears', bld: 'clock_works', m: { prod: .04, research: .04 },
    t: ['Mecanismos de relojoaria', 'Autômatos de corda', 'Golens de engrenagem', 'Androides de relojoaria', 'Titãs eternos'],
    unit: ['Autômatos', 'Autômatos de guerra', 'Golens de engrenagem', 'Androides de corda', 'Titãs de relojoaria'] },
  { id: 'steam', n: 'Steampunk', e: '♨️', col: '#a0522d', y: [1650, 1720, 1800, 1900, 2100], good: 'boilers', bld: 'steam_foundry', m: { prod: .06, army: .03 },
    t: ['Caldeiras de alta pressão', 'Dirigíveis', 'Caminhantes a vapor', 'Encouraçados terrestres', 'Leviatãs a vapor'],
    unit: ['Carros a vapor', 'Couraças a vapor', 'Caminhantes a vapor', 'Encouraçados terrestres', 'Leviatãs'] },
  { id: 'tesla', n: 'Teslapunk', e: '⚡', col: '#4aa3df', y: [1880, 1920, 1980, 2060, 2150], good: 'coils', bld: 'tesla_tower', m: { research: .06, prod: .03 },
    t: ['Energia sem fio', 'Raios da morte', 'Escudos elétricos', 'Rede planetária', 'Tempestade controlada'],
    unit: ['Lanceiros de raio', 'Tropas de bobina', 'Andarilhos de arco', 'Colossos voltaicos', 'Tempestades vivas'] },
  { id: 'atom', n: 'Atompunk', e: '☢️', col: '#4caf50', y: [1900, 1940, 1970, 2030, 2120], good: 'cores', bld: 'reactor', m: { prod: .05, army: .04 },
    t: ['Radiação domada', 'Carros atômicos', 'Robôs atômicos', 'Cidades-cúpula', 'Era do átomo eterno'],
    unit: ['Soldados de rádio', 'Tanques atômicos', 'Robôs atômicos', 'Gigantes de cobalto', 'Titãs nucleares'] },
  { id: 'diesel', n: 'Dieselpunk', e: '🛞', col: '#6d6d6d', y: [1915, 1940, 1975, 2040, 2130], good: 'engines', bld: 'diesel_works', m: { army: .06, manpower: .04 },
    t: ['Motores pesados', 'Supertanques', 'Fortalezas voadoras', 'Cidades-fábrica', 'Megamáquinas'],
    unit: ['Couraçados de lagarta', 'Supertanques', 'Fortalezas rolantes', 'Megatanques', 'Moloques de aço'] },
  { id: 'bio', n: 'Biopunk', e: '🧬', col: '#8bc34a', y: [1960, 1990, 2030, 2090, 2160], good: 'biomass', bld: 'biovat', m: { growth: .08, food: .06 },
    t: ['Engenharia genética', 'Colheitas sintéticas', 'Bioarmas', 'Organismos-cidade', 'Hivemente'],
    unit: ['Soldados aprimorados', 'Feras de laboratório', 'Quimeras', 'Leviatãs vivos', 'Enxame orgânico'] },
  { id: 'cyber', n: 'Cyberpunk', e: '💾', col: '#e040fb', y: [2000, 2025, 2060, 2110, 2170], good: 'chips', bld: 'chipfab', m: { research: .06, tax: .05 },
    t: ['Implantes neurais', 'Megacorporações', 'Ciberespaço total', 'Consciência digital', 'Singularidade de neon'],
    unit: ['Ciborgues', 'Mercenários cromados', 'Mechas urbanos', 'Fantasmas de rede', 'Avatares'] },
  { id: 'solar', n: 'Solarpunk', e: '☀️', col: '#ffca28', y: [2050, 2080, 2110, 2150, 2190], good: 'panels', bld: 'solar_array', m: { growth: .05, stab: .04, prod: .03 },
    t: ['Cidades-jardim', 'Energia abundante', 'Arcologias verdes', 'Gaia restaurada', 'Era dourada'],
    unit: ['Guardiões verdes', 'Drones solares', 'Andarilhos de jardim', 'Sentinelas de luz', 'Coros solares'] },
  { id: 'nano', n: 'Nanopunk', e: '🔬', col: '#00bcd4', y: [2100, 2120, 2145, 2170, 2195], good: 'nanites', bld: 'nanoforge', m: { prod: .07, army: .04 },
    t: ['Nanomáquinas', 'Autorreparo', 'Matéria programável', 'Nuvem cinza', 'Forja infinita'],
    unit: ['Nanotropa', 'Legião autorreparável', 'Soldados de matéria', 'Nuvem cinza', 'Exército fluido'] },
  { id: 'space', n: 'Spacepunk', e: '🚀', col: '#7e57c2', y: [2150, 2165, 2180, 2190, 2199], good: 'he3', bld: 'spaceport', m: { research: .05, trade: .06, army: .04 },
    t: ['Estações orbitais', 'Mineração lunar', 'Frotas estelares', 'Colônias marcianas', 'Império estelar'],
    unit: ['Fuzileiros orbitais', 'Tropas de queda', 'Naves de assalto', 'Legiões estelares', 'Armada do vazio'] },
];
const VERT = Object.fromEntries(VERTS.map(v => [v.id, v]));
VERTS.forEach(v => v.y.forEach((y, i) => TECHS.push(TECH['v_' + v.id + i] = { id: 'v_' + v.id + i, c: 'vert', v: v.id, lv: i + 1, y, n: v.t[i], req: i ? ['v_' + v.id + (i - 1)] : [], fx: i ? {} : { b: [v.bld] } })));

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
  brave:     { n: 'Bravo', m: { army: .05 } }, craven: { n: 'Covarde', m: { army: -.05 } },
  genius:    { n: 'Gênio', m: { research: .1 } }, slow: { n: 'Lento', m: { research: -.06 } },
  ambitious: { n: 'Ambicioso', m: { prod: .04, stab: -.03 } }, content: { n: 'Contente', m: { stab: .04 } },
  just:      { n: 'Justo', m: { stab: .06 } }, cruel: { n: 'Cruel', m: { stab: -.04, manpower: .05 } },
  greedy:    { n: 'Ganancioso', m: { tax: .06, stab: -.02 } }, generous: { n: 'Generoso', m: { tax: -.04, stab: .05 } },
  zealous:   { n: 'Zeloso', m: { stab: .03, research: -.03 } }, cynical: { n: 'Cínico', m: { research: .03 } },
  diligent:  { n: 'Diligente', m: { prod: .05, tax: .03 } }, lazy: { n: 'Preguiçoso', m: { prod: -.04 } },
  schemer:   { n: 'Conspirador', m: { coup: -.3 } }, honest: { n: 'Honesto', m: { stab: .03 } },
  strategist:{ n: 'Estrategista', m: { army: .08 } }, builder: { n: 'Construtor', m: { admin: .1 } },
  navigator: { n: 'Navegador', m: { colon: .15, trade: .05 } }, scholar: { n: 'Erudito', m: { research: .06 } },
  paranoid:  { n: 'Paranoico', m: { coup: -.5, stab: -.03 } }, charismatic: { n: 'Carismático', m: { stab: .05, manpower: .03 } },
  sickly:    { n: 'Doente', m: { stab: -.02 }, die: 2 }, robust: { n: 'Robusto', m: {}, die: .5 },
};
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
