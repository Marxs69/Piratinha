/* Grand Chronicle — conteúdo: governos, títulos, ideologias, leis, minorias, súditos e diplomacia.
   Arquivo de dados editável: cada bloco "CONTENT.NOME = ...;" é JSON5 (comentários, chaves sem aspas, aspas simples, vírgula no fim).
   Só dados: nada de código. O jogo lê ao abrir a página; para valer num save, salve o arquivo e recarregue. */

/* ---------- governos ----------
   cat: grupo · succ: sucessão (hered herança · elect eleito vitalício · term eleições a cada `term` anos · party partido · junta · council · theo · ai)
   t: título do governante · m: modificadores · coup: risco de golpe (1 = normal) · fmt: nome do país */
/* árvore de governos: to = reformas possíveis a partir deste (id, ou [id, condição COND]); ev = só por evento ou revolução (aparece na árvore, não se escolhe).
   Golpes levam aos de COUP_GOVS. A tecnologia (fx.g), o título e a época continuam valendo para todos. */
CONTENT.GOVS = {
  tribal:        { n: 'Chefatura tribal', cat: 'Tribal', succ: 'elect', t: 'Chefe', fmt: 'Tribo de {}', m: { tax: -.3, manpower: .3, research: -.2 }, coup: .6 , to: ['tribal_conf', 'horde', 'feudal', 'elective', 'principality'], ev: ['theocracy'] },
  tribal_conf:   { n: 'Confederação tribal', until: 1750, next: 'feudal', cat: 'Tribal', succ: 'council', term: 8, t: 'Chefe supremo', fmt: 'Confederação de {}', m: { tax: -.2, stab: .1, research: -.15 }, coup: .4 , to: ['tribal', 'feudal', 'elective', 'khanate'] },
  horde:         { n: 'Horda nômade', until: 1500, next: 'khanate', cat: 'Tribal', succ: 'elect', t: 'Cã', fmt: 'Horda de {}', m: { tax: -.4, army: .2, manpower: .4, prod: -.2, speed: .3 }, coup: 1.2 , to: ['khanate', 'tribal', 'tribal_conf'] },
  feudal:        { n: 'Monarquia feudal', until: 1800, next: 'absolute', cat: 'Monarquia', succ: 'hered', t: 'Rei', fmt: 'Reino de {}', m: { tax: -.1, manpower: .2 }, coup: .5 , to: ['absolute', 'elective', 'principality', 'empire', 'sultanate'], ev: ['theocracy', 'military_order', 'merchant', 'oligarchic'] },
  elective:      { n: 'Monarquia eletiva', until: 1800, next: 'constitutional', cat: 'Monarquia', succ: 'elect', t: 'Rei eleito', fmt: 'Reino de {}', m: { tax: -.05, research: .05, stab: -.05 }, coup: .4 , to: ['feudal', 'absolute', 'constitutional', 'oligarchic', 'merchant'] },
  absolute:      { n: 'Monarquia absoluta', cat: 'Monarquia', succ: 'hered', t: 'Rei', fmt: 'Reino de {}', m: { tax: .15, stab: .1, research: -.05, manpower: .1 }, coup: .3 , to: ['enlightened', 'constitutional', 'feudal', 'empire', 'sultanate'], ev: ['oligarchic', 'presidential', 'parliamentary'] },
  enlightened:   { n: 'Despotismo esclarecido', cat: 'Monarquia', succ: 'hered', t: 'Monarca', fmt: 'Reino de {}', m: { research: .15, tax: .1 }, coup: .4 , to: ['absolute', 'constitutional', 'parl_monarchy'] },
  constitutional:{ n: 'Monarquia constitucional', cat: 'Monarquia', succ: 'hered', t: 'Monarca', fmt: 'Reino Unido de {}', m: { research: .1, prod: .1, stab: .05 }, coup: .2 , to: ['parl_monarchy', 'absolute', 'enlightened', 'parliamentary', 'presidential', 'federal'] },
  empire:        { n: 'Império', minRank: 4, cat: 'Monarquia', succ: 'hered', t: 'Imperador', fmt: 'Império de {}', m: { tax: .1, army: .1, stab: -.05 }, coup: .6 , to: ['absolute', 'constitutional', 'parl_monarchy', 'star_empire', 'feudal'] },
  merchant:      { n: 'República mercantil', until: 1850, next: 'parliamentary', cat: 'República', succ: 'term', term: 10, t: 'Doge', fmt: 'Sereníssima de {}', m: { trade: .3, tax: .1, manpower: -.2 }, coup: .3 , to: ['oligarchic', 'parliamentary', 'company', 'city_state', ['corporate', { clsShare: ['high', .05, null] }]] },
  oligarchic:    { n: 'República oligárquica', cat: 'República', succ: 'term', term: 6, t: 'Cônsul', fmt: 'República de {}', m: { tax: .1, stab: .05 }, coup: .5 , to: ['parliamentary', 'presidential', 'merchant', 'constitutional', ['corporate', { clsShare: ['high', .05, null] }]], ev: ['caudillo'] },
  parliamentary: { n: 'República parlamentar', cat: 'República', succ: 'term', term: 4, t: 'Primeiro-ministro', fmt: 'República de {}', m: { research: .15, prod: .1, manpower: -.1 }, coup: .4 , to: ['presidential', 'federal', 'social_state', 'liquid', 'parl_monarchy', ['technate', { clsShare: ['mid', .25, null] }]], ev: ['peoples', 'syndicalist'] },
  presidential:  { n: 'República presidencialista', cat: 'República', succ: 'term', term: 4, t: 'Presidente', fmt: 'República de {}', m: { stab: .05, prod: .1 }, coup: .7 , to: ['parliamentary', 'federal', 'social_state', 'one_party', ['technate', { clsShare: ['mid', .25, null] }]], ev: ['peoples'] },
  federal:       { n: 'República federal', cat: 'República', succ: 'term', term: 4, t: 'Presidente', fmt: 'Estados Unidos de {}', m: { tax: -.05, stab: .1, admin: .2 }, coup: .4 , to: ['parliamentary', 'presidential', 'social_state'] },
  peoples:       { n: 'República popular', cat: 'Socialista', succ: 'party', t: 'Secretário-geral', fmt: 'República Popular de {}', m: { prod: .15, research: .05, stab: .05, trade: -.2 }, coup: .5 , to: ['peoples_dem', 'commune', 'syndicalist', 'one_party', 'totalitarian'] },
  commune:       { n: 'Comuna federada', cat: 'Socialista', succ: 'council', term: 2, t: 'Delegado', fmt: 'Comuna de {}', m: { prod: .1, manpower: .2, tax: -.3, stab: -.1 }, coup: .8 , to: ['syndicalist', 'peoples'] },
  syndicalist:   { n: 'República sindicalista', cat: 'Socialista', succ: 'council', term: 4, t: 'Presidente do congresso', fmt: 'União Sindical de {}', m: { prod: .2, tax: -.1 }, coup: .6 , to: ['commune', 'peoples', 'social_state', 'peoples_dem'] },
  theocracy:     { n: 'Teocracia', cat: 'Teocracia', succ: 'theo', t: 'Sumo-sacerdote', fmt: 'Santa Sé de {}', m: { stab: .15, research: -.1 }, coup: .3 , to: ['military_order', 'sages', 'absolute', 'feudal'] },
  military_order:{ n: 'Ordem militar', cat: 'Teocracia', succ: 'theo', t: 'Grão-mestre', fmt: 'Ordem de {}', m: { army: .2, manpower: -.1, stab: .05 }, coup: .4 , to: ['theocracy', 'sages'] },
  sages:         { n: 'Concílio dos sábios', cat: 'Teocracia', succ: 'council', term: 7, t: 'Arquissábio', fmt: 'Concílio de {}', m: { research: .2, army: -.1, stab: -.05 }, coup: .5 , to: ['theocracy', ['technate', { clsShare: ['mid', .25, null] }]] },
  junta:         { n: 'Junta militar', cat: 'Ditadura', succ: 'junta', t: 'General', fmt: 'Estado de {}', m: { army: .2, manpower: .2, stab: -.1 }, coup: 2 , to: ['mil_regime', 'caudillo', 'totalitarian', 'protectorate', 'presidential'] },
  caudillo:      { n: 'Caudilhismo', cat: 'Ditadura', succ: 'junta', t: 'Caudilho', fmt: 'Estado de {}', m: { tax: .1, army: .1, stab: -.05 }, coup: 1.5 , to: ['junta', 'one_party', 'presidential', 'absolute'] },
  one_party:     { n: 'Estado de partido único', cat: 'Ditadura', succ: 'party', t: 'Líder do partido', fmt: 'Estado de {}', m: { stab: .15, research: .05, trade: -.1 }, coup: .3 , to: ['totalitarian', 'peoples', 'presidential', 'surveillance', 'mil_regime'] },
  totalitarian:  { n: 'Estado totalitário', cat: 'Ditadura', succ: 'party', t: 'Líder supremo', fmt: 'Estado Total de {}', m: { army: .25, prod: .1, research: -.1, stab: .1 }, coup: .4 , to: ['one_party', 'surveillance', 'junta'] },
  technate:      { n: 'Tecnato', cat: 'Tecnocracia', succ: 'council', term: 6, t: 'Diretor técnico', fmt: 'Tecnato de {}', m: { research: .25, prod: .15, stab: -.05 }, coup: .6 , to: ['net_state', 'synthocracy', 'parliamentary', ['corporate', { clsShare: ['high', .05, null] }]] },
  corporate:     { n: 'Corporatocracia', cat: 'Tecnocracia', succ: 'council', term: 5, t: 'CEO', fmt: '{} S.A.', m: { tax: .25, prod: .2, stab: -.15 }, coup: 1 , to: ['technate', 'oligarchic', 'net_state'] },
  liquid:        { n: 'Democracia líquida', cat: 'República', succ: 'term', term: 2, t: 'Mediador', fmt: 'Rede de {}', m: { research: .2, stab: .1 }, coup: .2 , to: ['parliamentary', 'net_state', 'social_state'] },
  synthocracy:   { n: 'Sintocracia', cat: 'Tecnocracia', succ: 'ai', t: 'Inteligência regente', fmt: 'Núcleo de {}', m: { research: .3, prod: .25 }, coup: 0 , to: ['hive', 'technate'] },
  khanate:       { n: 'Canato', until: 1800, next: 'sultanate', cat: 'Tribal', succ: 'hered', t: 'Cã', fmt: 'Canato de {}', m: { army: .15, manpower: .25, tax: -.15, speed: .2 }, coup: .9 , to: ['sultanate', 'feudal', 'horde', 'absolute'] },
  principality:  { n: 'Principado', maxRank: 2, cat: 'Monarquia', succ: 'hered', t: 'Príncipe', fmt: 'Principado de {}', m: { tax: .05, research: .05, trade: .05 }, coup: .4 , to: ['feudal', 'absolute', 'constitutional', 'city_state'] },
  city_state:    { n: 'Cidade-Estado', maxRank: 1, until: 1900, cat: 'República', succ: 'term', term: 5, t: 'Gonfaloneiro', fmt: 'Cidade de {}', m: { trade: .25, research: .1, manpower: -.3 }, coup: .4 , to: ['merchant', 'oligarchic', 'principality'] },
  sultanate:     { n: 'Sultanato', minRank: 2, cat: 'Monarquia', succ: 'hered', t: 'Sultão', fmt: 'Sultanato de {}', m: { tax: .1, army: .1, stab: .03 }, coup: .7 , to: ['absolute', 'khanate', 'constitutional', 'enlightened'] },
  parl_monarchy: { n: 'Monarquia parlamentar', cat: 'Monarquia', succ: 'hered', t: 'Monarca', fmt: 'Reino de {}', m: { stab: .08, tax: .05, research: .05 }, coup: .2 , to: ['constitutional', 'parliamentary', 'presidential', 'social_state', 'federal'] },
  company:       { n: 'Companhia mercantil', cat: 'República', succ: 'council', term: 6, t: 'Governador-geral', fmt: 'Companhia de {}', m: { trade: .3, colon: .3, stab: -.05 }, coup: .5 , to: ['merchant', 'oligarchic', ['corporate', { clsShare: ['high', .05, null] }]] },
  protectorate:  { n: 'Protetorado', cat: 'Ditadura', succ: 'junta', t: 'Lorde protetor', fmt: 'Protetorado de {}', m: { army: .1, stab: .05, research: -.05 }, coup: 1.2 , to: ['junta', 'constitutional', 'presidential', 'absolute'] },
  peoples_dem:   { n: 'Democracia popular', cat: 'Socialista', succ: 'party', t: 'Presidente do conselho', fmt: 'República Democrática de {}', m: { prod: .1, stab: .08, trade: -.1 }, coup: .4 , to: ['peoples', 'syndicalist', 'social_state'] },
  mil_regime:    { n: 'Regime militar', cat: 'Ditadura', succ: 'junta', t: 'Presidente militar', fmt: 'República de {}', m: { army: .15, stab: .05, research: -.05 }, coup: 1.5 , to: ['presidential', 'junta', 'one_party', 'parliamentary'] },
  social_state:  { n: 'Estado social', cat: 'República', succ: 'term', term: 4, t: 'Chanceler', fmt: 'República Federal de {}', m: { stab: .12, growth: .05, tax: .05 }, coup: .2 , to: ['parliamentary', 'federal', 'liquid', 'syndicalist', 'peoples_dem'] },
  net_state:     { n: 'Estado-rede', cat: 'Tecnocracia', succ: 'council', term: 4, t: 'Coordenador', fmt: 'Rede de {}', m: { research: .2, trade: .1, stab: -.05 }, coup: .4 , to: ['liquid', 'technate', 'synthocracy', 'hive'] },
  surveillance:  { n: 'Estado de vigilância', cat: 'Ditadura', succ: 'party', t: 'Guardião', fmt: 'Estado de {}', m: { stab: .2, research: -.05, coup: 0 }, coup: .1, to: ['totalitarian', 'one_party', 'synthocracy'] },
  hive:          { n: 'Coletivo-colmeia', cat: 'Tecnocracia', succ: 'ai', t: 'Mente coletiva', fmt: 'Colmeia de {}', m: { prod: .3, research: .2, stab: .1, growth: -.1 }, coup: 0 , to: ['synthocracy'] },
  star_empire:   { n: 'Império estelar', minRank: 4, cat: 'Monarquia', succ: 'hered', t: 'Imperador estelar', fmt: 'Império Estelar de {}', m: { tax: .15, army: .15, research: .1 }, coup: .4 , to: ['empire', 'hegemony'] },
  hegemony:      { n: 'Hegemonia orbital', cat: 'Tecnocracia', succ: 'council', term: 10, t: 'Hegemon', fmt: 'Hegemonia de {}', m: { tax: .1, prod: .1, research: .1, army: .1, stab: .1 }, coup: .2 , to: ['star_empire', 'technate'] },
};

/* como se escolhe o governante em cada tipo de sucessão (aba Governo). pick = o jogador escolhe entre 4 candidatos */
CONTENT.ELECT_FORMS = {
  hered:   { n: 'Monarquia hereditária', d: 'O herdeiro assume pela lei de sucessão.' },
  term:    { n: 'Eleição popular por mandato', d: 'A cada {term} anos o eleitorado vota; o partido mais votado indica o governante.', pick: 1 },
  council: { n: 'Eleição interna por mandato', d: 'A cada {term} anos o conselho (ou congresso) escolhe o governante entre os seus.', pick: 1 },
  elect:   { n: 'Eleição vitalícia', d: 'Eleito para a vida toda; quando morre, há nova eleição.', pick: 1 },
  party:   { n: 'Escolha do partido', d: 'O partido governa sem eleições abertas; quando o líder morre ou cai, a cúpula escolhe outro.', pick: 1 },
  junta:   { n: 'Escolha da junta', d: 'Os generais escolhem um dos seus quando o chefe cai.' },
  theo:    { n: 'Escolha do clero', d: 'O clero escolhe um sacerdote idoso como novo governante.' },
  ai:      { n: 'A máquina decide', d: 'Não há sucessão: a inteligência regente governa.' },
};

/* golpe militar: para qual governo o país pode cair, pelo tipo de governo atual (chance de mudar a forma: chance) */
CONTENT.COUP_GOVS = { chance: .45, Monarquia: ['junta', 'caudillo', 'mil_regime', 'protectorate'], República: ['junta', 'caudillo', 'mil_regime'], Tribal: ['junta', 'caudillo'],
  Socialista: ['totalitarian', 'junta'], Ditadura: ['junta', 'caudillo', 'totalitarian'], Tecnocracia: ['junta', 'surveillance'] };

/* como o conselho é escolhido em cada tipo de governo: ideo = membros da ideologia do governo · faith = da fé oficial · merit = pontos a mais no atributo do assento · mil = pontos a mais em Marcial */
CONTENT.COUNCIL_MODE = {
  Tribal:      { n: 'Anciãos e guerreiros escolhidos pelo chefe', act: 'Nomear', mil: 1 },
  Monarquia:   { n: 'Nomeados pelo monarca', act: 'Nomear' },
  República:   { n: 'Gabinete do partido no governo', act: 'Indicar ministro', ideo: 1 },
  Socialista:  { n: 'Indicados pelo partido', act: 'Indicar', ideo: 1 },
  Ditadura:    { n: 'Designados pelo regime', act: 'Designar', ideo: 1, mil: 2 },
  Teocracia:   { n: 'Escolhidos pelo clero', act: 'Ungir', faith: 1 },
  Tecnocracia: { n: 'Escolhidos por mérito técnico', act: 'Selecionar', merit: 3 },
};

/* votações de leis e reformas de governo (como no Victoria 3): 3 fases de 100 pontos.
   base = pontos por mês · k = quanto cada ponto de apoio acelera (apoio: governante 3, conselheiro 1, cônjuge e herdeiro 0,5) · push = atributo que empurra (por ponto acima de 8, de quem apoia)
   cat = multiplicador quando a reforma muda o tipo de governo · stall = chance de emperrar ao fim de uma fase com apoio 0 (cai com apoio a favor) · fail = apoio abaixo do qual a última fase pode derrubar a proposta */
CONTENT.ENACT = {
  law: { base: 10, cost: 50, stab: -3 }, gov: { base: 6, cost: 80, stab: -10, cat: .6, catStab: -25 },
  k: .1, push: 'dip', pushK: .015, stall: .2, back: 30, fail: -2, w: { ruler: 3, seat: 1, spouse: .5, heir: .5 },
  phases: {
    Tribal: ['Fogueira dos anciãos', 'Assembleia do clã', 'Juramento'], Monarquia: ['Conselho real', 'Decreto', 'Proclamação'], República: ['Comissão', 'Votação no parlamento', 'Sanção'],
    Socialista: ['Comitê central', 'Congresso do partido', 'Ratificação'], Ditadura: ['Estudo do regime', 'Decreto', 'Promulgação'], Teocracia: ['Sínodo', 'Concílio', 'Bula'],
    Tecnocracia: ['Análise técnica', 'Simulação', 'Implantação'],
  },
};
/* reforma que troca quem manda: o evento de transição decide o novo governante (from/to = tipos de governo; o primeiro que servir) */
CONTENT.GOV_TR = [
  { from: ['Monarquia', 'Tribal'], to: ['República', 'Tecnocracia'], ev: 'gov_tr_republic' },
  { from: ['República', 'Socialista', 'Ditadura', 'Tecnocracia', 'Teocracia'], to: ['Monarquia'], ev: 'gov_tr_crown' },
  { from: ['Monarquia', 'Tribal', 'República', 'Tecnocracia', 'Teocracia'], to: ['Socialista', 'Ditadura'], ev: 'gov_tr_regime' },
  { from: ['Monarquia', 'Tribal', 'República', 'Socialista', 'Ditadura', 'Tecnocracia'], to: ['Teocracia'], ev: 'gov_tr_clergy' },
  { from: ['Socialista', 'Ditadura'], to: ['República', 'Tecnocracia'], ev: 'gov_tr_opening' },
];

/* ---------- níveis de título (como no CK3): limitam quantos estados o país sustenta (Limite de domínio) ----------
   cap: províncias sem perder estabilidade · req: mínimo para proclamar o nível · no nível 3 cada governo usa o próprio nome (fmt/t) */
CONTENT.RANK_N = ['Baronia', 'Condado', 'Ducado', 'Reino', 'Império'];

CONTENT.RANK_CAP = [2, 5, 12];
CONTENT.RANK_REQ = [0, 2, 4, 8];

CONTENT.RANK_SLOTS = [3, 5, 8, 12, 18];// teto de canteiros de obra pelo título

CONTENT.RANKSET = {
  Monarquia:   { f: ['Baronato de {}', 'Condado de {}', 'Ducado de {}', null, 'Império de {}'], t: ['Barão', 'Conde', 'Duque', null, 'Imperador'] },
  Tribal:      { f: ['Clã de {}', 'Tribo de {}', 'Chefado de {}', 'Alto Reino de {}', 'Grande Horda de {}'], t: ['Chefe de clã', 'Chefe', 'Grande chefe', 'Alto rei', 'Grão-cã'], f3for: ['tribal'] },
  República:   { f: ['Comuna de {}', 'Cidade Livre de {}', 'Liga de {}', null, 'República Imperial de {}'], t: ['Prefeito', 'Burgomestre', 'Cônsul', null, 'Primeiro Cidadão'] },
  Socialista:  { f: ['Coletivo de {}', 'Soviete de {}', 'União Regional de {}', null, 'União das Repúblicas de {}'], t: ['Delegado', 'Comissário', 'Secretário regional', null, 'Presidente da União'] },
  Teocracia:   { f: ['Priorado de {}', 'Bispado de {}', 'Arcebispado de {}', null, 'Santo Império de {}'], t: ['Prior', 'Bispo', 'Arcebispo', null, 'Pontífice'] },
  Ditadura:    { f: ['Distrito Militar de {}', 'Protetorado de {}', 'Estado de {}', null, 'Império Nacional de {}'], t: ['Comandante', 'Governador militar', 'Protetor', null, 'Autocrata'] },
  Tecnocracia: { f: ['Distrito Técnico de {}', 'Comitê de {}', 'Diretório de {}', null, 'Hegemonia de {}'], t: ['Engenheiro-chefe', 'Supervisor', 'Diretor', null, 'Arquiteto supremo'] },
};

/* ---------- ideologias (m: modificadores · war: agressividade da IA) ---------- */
/* ideologias. m = modificadores quando é a do país · war = agressividade na IA
   y0 = ano em que surge entre as pessoas (personagens podem tê-la antes de o país adotá-la) · y1 = até quando está em alta; depois perde adeptos aos poucos, mas quem já a tem continua com ela
   ax = radicalismo: −2 reacionário, −1 conservador, 0 centro, +1 reformista, +2 revolucionário · govs = governos que quer (em ordem; a pessoa empurra o país pelo caminho da árvore até eles)
   laws = leis que quer · gen = bônus do general com esta ideologia (força em batalha) */
CONTENT.IDEOS = {
  trad:       { n: 'Tradicionalismo', col: '#8d6e63', m: { stab: .1, research: -.05 }, war: 1, y0: 860, y1: 1650, ax: -1, govs: ['feudal', 'absolute', 'tribal_conf', 'theocracy'],
                laws: { land: 'feudal', labor: 'serfdom', edu: 'clergy', relig: 'state', vote: 'nobles', women: 'patriarchy', company: 'guilds' } },
  warrior:    { n: 'Ética guerreira', col: '#b71c1c', m: { army: .1, manpower: .1, stab: -.05 }, war: 2.2, y0: 860, y1: 1500, ax: 0, govs: ['horde', 'khanate', 'military_order', 'tribal', 'junta'], laws: { draft: 'wide', tax: 'high' }, gen: .05 },
  mercant:    { n: 'Mercantilismo', col: '#00897b', m: { trade: .2, tax: .05 }, war: 1, y0: 1480, y1: 1800, ax: 0, govs: ['merchant', 'oligarchic', 'company', 'city_state'], laws: { trade: 'protect', company: 'crown', currency: 'paper', bank: 'private' } },
  absolut:    { n: 'Absolutismo', col: '#5e35b1', m: { tax: .1, stab: .05 }, war: 1.3, y0: 1580, y1: 1830, ax: -2, govs: ['absolute', 'enlightened', 'empire', 'sultanate'], laws: { press: 'censored', vote: 'nobles', tax: 'high', relig: 'state', police: 'police' }, gen: .02 },
  liberal:    { n: 'Liberalismo', col: '#fdd835', m: { research: .1, prod: .05, trade: .1 }, war: .8, y0: 1690, y1: 1950, ax: 1, govs: ['constitutional', 'parl_monarchy', 'parliamentary', 'presidential', 'federal'],
                laws: { press: 'free', trade: 'free', labor: 'free', land: 'private', vote: 'census', company: 'free', relig: 'free' } },
  conservative:{ n: 'Conservadorismo', col: '#1e88e5', m: { stab: .1 }, war: 1, y0: 1780, y1: 2200, ax: -1, govs: ['constitutional', 'parl_monarchy', 'presidential', 'absolute'], laws: { relig: 'state', police: 'police', press: 'regulated', culture: 'primary', women: 'property' }, gen: .02 },
  radical:    { n: 'Radicalismo', col: '#f4511e', m: { research: .05, manpower: .1, stab: -.05 }, war: 1.3, y0: 1770, y1: 1900, ax: 2, govs: ['presidential', 'parliamentary', 'federal'], laws: { vote: 'universal', press: 'free', edu: 'public', relig: 'secular', land: 'reform' } },
  socialism:  { n: 'Socialismo', col: '#e53935', m: { prod: .1, stab: .05 }, war: 1.1, y0: 1840, y1: 2080, ax: 2, govs: ['peoples', 'peoples_dem', 'commune'],
                laws: { labor: 'collective', land: 'collective', bank: 'state', company: 'state', health: 'universal', edu: 'mandatory', hours: 'eight' } },
  syndicalism:{ n: 'Sindicalismo', col: '#c62828', m: { prod: .15, tax: -.05 }, war: 1.2, y0: 1875, y1: 1990, ax: 2, govs: ['syndicalist', 'commune'], laws: { labor: 'unions', hours: 'eight', company: 'state', land: 'reform' } },
  anarchism:  { n: 'Anarquismo', col: '#9e9e9e', m: { manpower: .2, tax: -.2, stab: -.1 }, war: .9, y0: 1840, y1: 1960, ax: 2, govs: ['commune', 'syndicalist'], laws: { police: 'militia', draft: 'volunteer', relig: 'secular', tax: 'low' } },
  socdem:     { n: 'Social-democracia', col: '#ef5350', m: { stab: .1, research: .05 }, war: .7, y0: 1885, y1: 2200, ax: 1, govs: ['social_state', 'parliamentary', 'federal', 'parl_monarchy'],
                laws: { spend: 'welfare', health: 'universal', hours: 'eight', vote: 'universal', tax: 'progressive', labor: 'unions' } },
  natpop:     { n: 'Nacional-populismo', col: '#6d4c41', m: { manpower: .15, stab: .05 }, war: 1.8, y0: 1885, y1: 2200, ax: -2, govs: ['one_party', 'caudillo', 'presidential', 'mil_regime'], laws: { culture: 'primary', police: 'police', draft: 'wide', trade: 'protect' }, gen: .04 },
  agrarian:   { n: 'Agrarismo', col: '#7cb342', m: { food: .25, stab: .05 }, war: .8, y0: 1885, y1: 2000, ax: 0, govs: ['presidential', 'parliamentary', 'federal'], laws: { land: 'reform', subsidy: 'agri', trade: 'protect' } },
  totalism:   { n: 'Totalismo', col: '#78909c', m: { army: .2, prod: .1, stab: -.05 }, war: 3, y0: 1915, y1: 2050, ax: -2, govs: ['totalitarian', 'one_party', 'surveillance'], laws: { press: 'censored', police: 'secret', draft: 'total', subsidy: 'industry' }, gen: .06 },
  futurism:   { n: 'Futurismo', col: '#ff6f00', m: { research: .1, prod: .15, stab: -.05 }, war: 2.2, y0: 1915, y1: 2050, ax: 1, govs: ['technate', 'one_party', 'totalitarian'], laws: { subsidy: 'industry', edu: 'mandatory' }, gen: .04 },
  technocrat: { n: 'Tecnocratismo', col: '#26c6da', m: { research: .2 }, war: .9, y0: 1925, y1: 2200, ax: 0, govs: ['technate', 'net_state', 'sages', 'corporate'], laws: { edu: 'lifelong', bank: 'central', police: 'predictive' } },
  neolib:     { n: 'Neoliberalismo', col: '#ffd54f', m: { trade: .25, prod: .05, stab: -.05 }, war: .8, y0: 1975, y1: 2200, ax: 0, govs: ['presidential', 'federal', 'parliamentary', 'corporate'], laws: { trade: 'free', spend: 'austerity', bank: 'private', company: 'free', tax: 'low' } },
  green:      { n: 'Ecologismo', col: '#43a047', m: { stab: .05, food: .1, growth: .05 }, war: .5, y0: 1975, y1: 2200, ax: 1, govs: ['liquid', 'social_state', 'parliamentary'], laws: { spend: 'welfare', subsidy: 'agri', press: 'network' } },
  transhum:   { n: 'Transumanismo', col: '#ab47bc', m: { research: .2, manpower: -.1 }, war: 1, y0: 2015, y1: 2200, ax: 1, govs: ['net_state', 'technate', 'liquid'], laws: { health: 'genetic', edu: 'lifelong', vote: 'liquid' } },
  accel:      { n: 'Aceleracionismo', col: '#ff3d00', m: { prod: .25, stab: -.1 }, war: 1.6, y0: 2060, y1: 2200, ax: 2, govs: ['synthocracy', 'corporate', 'net_state'], laws: { labor: 'automated', spend: 'ubi', trade: 'free' }, gen: .03 },
  posthuman:  { n: 'Pós-humanismo', col: '#7c4dff', m: { research: .25, prod: .15 }, war: 1.2, y0: 2110, y1: 2200, ax: 2, govs: ['hive', 'synthocracy'], laws: { labor: 'automated', health: 'genetic' } },
  cosmism:    { n: 'Cosmismo', col: '#3949ab', m: { research: .1, prod: .1, trade: .1, army: .1 }, war: 1.4, y0: 2150, y1: 2200, ax: 0, govs: ['hegemony', 'star_empire'], laws: { subsidy: 'total' }, gen: .03 },
};

CONTENT.MODS = { tax: 'Impostos', prod: 'Produção', research: 'Pesquisa', stab: 'Estabilidade', army: 'Força militar', manpower: 'Contingente', trade: 'Comércio', colon: 'Colonização', food: 'Alimentos', speed: 'Movimento', admin: 'Custo de obras', growth: 'Crescimento' };

/* ---------- leis (cada uma tem opções com modificadores; trocar custa estabilidade) ---------- */
/* leis. Cada opção: n, m (modificadores), when (condição para adotar), until = ano em que fica ultrapassada (não se adota mais; quem a mantém perde estabilidade) */
CONTENT.LAWS = {
  tax:   { eco: 1, n: 'Impostos', o: { low: { n: 'Baixos', m: { tax: -.2, stab: .08, growth: .03 } }, normal: { n: 'Normais', m: {} }, high: { n: 'Altos', m: { tax: .2, stab: -.08 } }, extort: { n: 'Extorsivos', m: { tax: .4, stab: -.2, growth: -.1 } }, progressive: { n: 'Progressivos', m: { tax: .1, stab: .04 }, when: { tech: 'soc_welfare' } } } },
  draft: { n: 'Recrutamento', o: { volunteer: { n: 'Voluntários', m: { manpower: -.4, prod: .05 } }, limited: { n: 'Limitado', m: {} }, wide: { n: 'Amplo', m: { manpower: .3, prod: -.05 } }, professional: { n: 'Exército profissional', m: { manpower: -.25, army: .12 }, when: { tech: 'eco_computers' } }, total: { n: 'Mobilização total', m: { manpower: .8, prod: -.15, stab: -.05 }, when: { tech: 'mil_conscription', any: [{ govCat: 'Ditadura' }, { ideo: ['warrior', 'natpop', 'totalism', 'futurism'] }] }, d: 'Só ditaduras ou países de ideologia belicista (ética guerreira, nacional-populismo, totalismo, futurismo)' } } },
  trade: { eco: 1, n: 'Comércio', o: { free: { n: 'Livre comércio', m: { trade: .15, prod: -.03 }, when: { tech: 'eco_mercantilism' } }, normal: { n: 'Tarifas moderadas', m: {} }, protect: { n: 'Protecionismo', m: { trade: -.1, prod: .06 } }, autarky: { n: 'Autarquia', m: { trade: -.4, prod: .08, stab: .03 } } } },
  spend: { n: 'Gastos públicos', o: { austerity: { n: 'Austeridade', m: { stab: -.05 }, svc: .5 }, normal: { n: 'Equilibrados', m: {}, svc: 1 }, welfare: { n: 'Bem-estar social', m: { stab: .08, growth: .05 }, svc: 1.6, when: { tech: 'soc_welfare' } }, ubi: { n: 'Renda básica universal', m: { stab: .1, growth: .03, prod: -.04 }, svc: 2, when: { tech: 'eco_automation' } } } },
  press: { n: 'Imprensa', o: { censored: { n: 'Censurada', m: { stab: .05, research: -.05 } }, regulated: { n: 'Regulada', m: {} }, free: { n: 'Livre', m: { research: .06, stab: -.03 }, when: { tech: 'soc_printing' } }, network: { n: 'Rede aberta', m: { research: .1, stab: -.04 }, when: { tech: 'eco_internet' } } } },
  currency: { eco: 1, n: 'Moeda', o: { metal: { until: 1975, n: 'Padrão-ouro', m: { trade: .04, stab: .02 } }, paper: { n: 'Papel-moeda', m: { tax: .05, trade: .05, stab: -.02 }, when: { tech: 'eco_banking' } }, fiat: { n: 'Moeda fiduciária', m: { prod: .06, tax: .05, stab: -.03 }, when: { tech: 'soc_welfare' } }, digital: { n: 'Moeda digital', m: { tax: .08, trade: .1 }, when: { tech: 'eco_internet' } } } },
  bank:  { eco: 1, n: 'Sistema bancário', o: { none: { until: 1900, n: 'Agiotas', m: {} }, private: { n: 'Bancos privados', m: { prod: .04, trade: .04, stab: -.02 }, when: { tech: 'eco_banking' } }, central: { n: 'Banco central', m: { stab: .04, tax: .04 }, when: { tech: 'eco_doubleentry' } }, state: { n: 'Banco estatal', m: { prod: .06, trade: -.06 }, when: { tech: 'soc_socialism' } } } },
  labor: { n: 'Trabalho', o: { serfdom: { until: 1860, n: 'Servidão', m: { tax: .05, prod: -.05, stab: -.03 } }, free: { n: 'Trabalho livre', m: {} }, unions: { n: 'Sindicatos', m: { stab: .05, prod: -.03 }, when: { tech: 'soc_unions' } }, collective: { n: 'Coletivizado', m: { prod: .08, stab: -.06 }, when: { tech: 'soc_socialism' } }, automated: { n: 'Trabalho automatizado', m: { prod: .12, stab: -.04 }, when: { tech: 'eco_ai', year: [2050, null] } } } },
  land:  { n: 'Terra', o: { feudal: { until: 1850, n: 'Feudal', m: { manpower: .1, prod: -.04 } }, private: { n: 'Propriedade privada', m: { prod: .05, food: .05 }, when: { tech: 'soc_common_law' } }, reform: { n: 'Reforma agrária', m: { food: .1, stab: .04, tax: -.03 }, when: { tech: 'soc_mass_politics' } }, collective: { n: 'Fazendas coletivas', m: { food: -.05, prod: .05 }, when: { tech: 'soc_socialism' } } } },
  edu:   { n: 'Educação', o: { clergy: { until: 1950, n: 'Do clero', m: { stab: .03 } }, public: { n: 'Pública', m: { research: .08 }, when: { tech: 'soc_enlightenment' } }, mandatory: { n: 'Obrigatória', m: { research: .15, prod: .03 }, when: { tech: 'soc_nationalism' } }, lifelong: { n: 'Educação permanente', m: { research: .2, prod: .05 }, when: { tech: 'eco_computers' } } } },
  health:{ n: 'Saúde', o: { charity: { until: 2000, n: 'Caridade', m: {} }, public: { n: 'Pública', m: { growth: .08 }, when: { tech: 'soc_enlightenment' } }, universal: { n: 'Universal', m: { growth: .15, stab: .05 }, when: { tech: 'soc_welfare' } }, genetic: { n: 'Medicina genética', m: { growth: .2, stab: .05 }, when: { tech: 'soc_transhumanism' } } } },
  police:{ n: 'Policiamento', o: { militia: { until: 1960, n: 'Milícias locais', m: {} }, police: { n: 'Polícia nacional', m: { stab: .05, coup: -.2 }, when: { tech: 'soc_nationalism' } }, secret: { n: 'Polícia secreta', m: { stab: .08, coup: -.5, research: -.04 }, when: { tech: 'soc_mass_media' } }, predictive: { n: 'Policiamento preditivo', m: { stab: .08, coup: -.4, research: -.02 }, when: { tech: 'eco_ai' } } } },
  vote:  { n: 'Sufrágio', o: { nobles: { until: 1920, n: 'Só nobres', m: {}, d: 'Só a classe alta pesa na política' }, census: { n: 'Censitário', m: { stab: .03 }, when: { tech: 'soc_constitution' }, d: 'Classes alta e média pesam na política' }, universal: { n: 'Universal', m: { stab: .06, research: .03 }, when: { tech: 'soc_mass_politics' }, d: 'Todas as classes livres pesam na política' }, liquid: { n: 'Voto direto digital', m: { stab: .05, research: .03 }, when: { tech: 'soc_digital_dem' }, d: 'Toda a população pesa igualmente e vota em cada lei' } } },
  subsidy:{ eco: 1, n: 'Subsídios', o: { none: { n: 'Nenhum', m: {} }, agri: { n: 'Agrícolas', m: { food: .12, tax: -.03 } }, industry: { n: 'Industriais', m: { prod: .07, tax: -.05 }, when: { tech: 'eco_manufactory' } }, total: { n: 'Dirigismo', m: { prod: .1, food: .08, tax: -.1, trade: -.05 }, when: { tech: 'eco_assembly' } } } },
  company:{ eco: 1, n: 'Empresas', o: { guilds: { until: 1850, n: 'Guildas', m: { stab: .02, prod: -.02 } }, crown: { n: 'Monopólios régios', m: { tax: .08, prod: -.03, trade: .03 }, when: { tech: 'eco_banking' } }, free: { n: 'Livre iniciativa', m: { prod: .05, trade: .04, stab: -.02 }, when: { tech: 'eco_mercantilism' } }, state: { n: 'Estatais', m: { prod: .03, tax: .05, trade: -.05 }, when: { tech: 'soc_socialism' } } } },
  hours: { eco: 1, n: 'Jornada de trabalho', o: { free: { n: 'Sem limite', m: { prod: .04, stab: -.02 } }, ten: { n: 'Dez horas', m: { stab: .03 }, when: { tech: 'soc_unions' } }, eight: { n: 'Oito horas', m: { stab: .06, prod: -.02, growth: .02 }, when: { tech: 'soc_welfare' } } } },
  slavery:{ eco: 1, n: 'Escravidão', o: { banned: { n: 'Proibida', m: {}, sl: 0, d: 'Escravos são libertados aos poucos e viram classe baixa' }, colonial: { n: 'Só nas colônias', m: { tax: .02 }, sl: .25, d: 'Até 25% de escravos nas províncias fora do continente de origem' }, legal: { n: 'Legal', m: { tax: .04, prod: .02 }, sl: .15, d: 'Até 15% de escravos em todo o país' } } },
  relig: { n: 'Religião', o: { state: { n: 'Igreja de Estado', m: { stab: .04, research: -.03 }, mp: 1, d: 'Minorias religiosas: −0,8 de estabilidade por 10% da população' }, tolerant: { n: 'Tolerância', m: {}, mp: .5, when: { tech: 'soc_humanism' }, d: 'Minorias religiosas pesam metade' }, free: { n: 'Liberdade de culto', m: { research: .03 }, mp: .15, when: { tech: 'soc_enlightenment' }, d: 'Minorias quase não pesam' }, secular: { n: 'Estado laico', m: { research: .05, stab: -.02 }, mp: 0, when: { tech: 'soc_socialism' }, d: 'Nenhuma religião oficial; templos rendem menos estabilidade' } } },
  culture:{ n: 'Cidadania', o: { primary: { n: 'Só a cultura principal', m: {}, mp: 1, d: 'Minorias culturais: −0,8 de estabilidade por 10% da população e menos satisfação' }, accepted: { n: 'Culturas aceitas', m: { manpower: .05 }, mp: .5, when: { tech: 'soc_common_law' }, d: 'Minorias culturais pesam metade' }, multi: { n: 'Multiculturalismo', m: { growth: .03, manpower: .08 }, mp: .1, when: { tech: 'soc_welfare' }, d: 'Minorias quase não pesam' } } },
  women: { n: 'Mulheres', o: { patriarchy: { n: 'Patriarcado', m: {}, lab: .55, fr: .08, d: 'Força de trabalho: 55% da população' }, property: { n: 'Direito à propriedade', m: { prod: .02 }, lab: .57, fr: .12, when: { tech: 'soc_enlightenment' }, d: 'Força de trabalho: 57%' }, suffrage: { n: 'Sufrágio feminino', m: { stab: .03, prod: .03 }, lab: .6, fr: .25, when: { tech: 'soc_mass_politics' }, d: 'Força de trabalho: 60%; mais governantes mulheres' }, equality: { n: 'Igualdade plena', m: { prod: .05, research: .04, stab: .02 }, lab: .64, fr: .45, when: { tech: 'soc_welfare' }, d: 'Força de trabalho: 64%; metade dos governantes pode ser mulher' } } },
  succ:  { n: 'Sucessão', o: { partition: { until: 1650, n: 'Partilha', m: { stab: .03 }, when: { succ: 'hered' }, d: 'O primogênito herda; com 2+ herdeiros adultos e 4+ estados, o segundo leva um quarto do reino como país próprio (aliado e da mesma dinastia)' }, primo: { n: 'Primogenitura', m: {}, when: { succ: 'hered', tech: 'soc_common_law' }, d: 'O primogênito herda tudo; os irmãos mais novos ficam ressentidos' }, elective: { n: 'Eletiva', m: { stab: .02 }, when: { succ: 'hered' }, d: 'O conselho escolhe o mais capaz entre herdeiros e conselheiros; nada de regência, mas a dinastia pode mudar' } } }
};

CONTENT.LAW_DEF = { tax: 'normal', draft: 'limited', trade: 'normal', spend: 'normal', press: 'regulated', currency: 'metal', bank: 'none', labor: 'free', land: 'feudal', edu: 'clergy', health: 'charity', police: 'militia', vote: 'nobles', subsidy: 'none', company: 'guilds', hours: 'free', slavery: 'colonial', relig: 'state', culture: 'primary', women: 'patriarchy', succ: 'partition' };

/* ---------- autonomia de culturas e religiões que não são a principal/oficial (−2 a +2; 0 = livre) ----------
   w: peso como minoria (estabilidade e satisfação) · as: assimilação/conversão por ano · ag: agitação (revoltas) */
CONTENT.CPOL = { '-2': { n: 'Escravizada', e: '⛓️', w: 2.5, as: 0, ag: 3, d: 'Parte desse povo vira escravo a cada mês (exige escravidão permitida). Pesa muito na estabilidade e gera revoltas.' },
  '-1': { n: 'Reprimida', e: '🚫', w: 1.6, as: 3, ag: 1.8, d: 'Assimilação três vezes mais rápida para a cultura principal, mas pesa mais e gera revoltas.' },
  '0': { n: 'Livre', e: '⚪', w: 1, as: 1, ag: 1, d: 'Situação normal de minoria: assimila devagar.' },
  '1': { n: 'Integrada', e: '🤝', w: .5, as: .4, ag: .5, d: 'Metade do peso como minoria; assimila bem devagar.' },
  '2': { n: 'Aceita', e: '✅', w: 0, as: 0, ag: 0, d: 'Conta como cultura do país (sem peso como minoria). Ocupa uma vaga de cultura secundária e pode virar a principal.' } };

CONTENT.RPOL_N = { '-2': ['Perseguida', 'Fiéis dessa fé viram escravos a cada mês (exige escravidão permitida).'], '-1': ['Discriminada', 'Conversão três vezes mais rápida para a fé oficial, mas pesa mais e gera revoltas.'], '0': ['Livre', 'Situação normal de minoria: converte devagar.'], '1': ['Tolerada', 'Metade do peso como minoria; converte bem devagar.'], '2': ['Reconhecida', 'Conta como fé do país (sem peso). Ocupa uma vaga e pode virar a fé oficial.'] };

CONTENT.CUL_SLOTS = { primary: 1, accepted: 3, multi: 8 };
CONTENT.REL_SLOTS = { state: 0, tolerant: 1, free: 3, secular: 8 };

/* ---------- súditos ----------
   base = liberdade de partida (0% integrado, 100% livre); tri = parte dos impostos paga ao suserano; war = entra nas guerras do suserano;
   dip = diplomacia própria; int = velocidade de integração; cost = preço na paz (fração do valor do país; null = não se impõe) */
/* ---------- ações diplomáticas ----------
   cost = ducados (× era) · cd = dias de espera por alvo · pay = o custo vai para o alvo · rel = [mudança na relação deles, na nossa] · stab = estabilidade de quem faz
   unlink = desfaz esse laço dos dois lados · toggle = liga/desliga a lista só de quem faz · ties = rompe todos os laços (breakTies)
   link = laço que nasce se o alvo aceitar · deny = [teste, motivo] checados antes · acc = termos de aceitação [teste, valor, texto, arg] · bonus = relação dos dois lados ao fechar · log = nome no registro
   block = ação feita em outro lugar (motivo) */
CONTENT.DIPLO = {
  improve:  { cost: 15, cd: 360, rel: [15, 8] },
  gift:     { cost: 40, pay: 1, rel: [20, 0] },
  insult:   { rel: [-40, -20] },
  break:    { ties: 1, rel: [-40, 0], stab: -5 },
  unally:   { unlink: 'allies', rel: [-40, 0], stab: -5 },
  untrade:  { unlink: 'trade', rel: [-10, 0] },
  embargo:  { toggle: 'emb', unlink: 'trade', rel: [-25, 0] },
  integrate:{ cost: 200, block: 'Use a aba Súditos na diplomacia' },
  ally:     { cost: 0, link: 'allies', bonus: 25, log: 'Aliança', deny: [['linked', 'Já são aliados']],
              acc: [['trait', -20, 'governante paranoico', 'paranoid'], ['one', -15, 'base'], ['count', -6, 'já tem aliados', 'allies'], ['common', 20, 'inimigo em comum'], ['stronger', 10, 'você é forte'], ['linked', 15, 'casamento real', 'marr']] },
  marr:     { cost: 20, link: 'marr', bonus: 25, log: 'Casamento real', deny: [['notHered', 'Exige duas monarquias hereditárias'], ['linked', 'Já há casamento']],
              acc: [['one', -10, 'base'], ['linked', 10, 'aliados', 'allies']] },
  trade:    { cost: 10, link: 'trade', bonus: 10, log: 'Acordo comercial', deny: [['linked', 'Já há acordo'], ['embargo', 'Há embargo']],
              acc: [['one', -5, 'base'], ['trait', 10, 'governante ganancioso', 'greedy'], ['count', -4, 'já tem acordos', 'trade']] },
};

/* termos de aceitação de qualquer proposta (antes dos da ação) */
CONTENT.DIP_ACC = [['rel', .5, 'relação'], ['sameIdeo', 12, 'mesma ideologia'], ['sameGovCat', 8, 'governos parecidos'], ['dipSkill', 2, 'diplomacia do seu governante'], ['trait2', 10, 'temperamento', ['charismatic', 'generous']]];

/* para onde a relação anda a cada ano (soma dos termos verdadeiros) */
CONTENT.DIP_DRIFT = [['linked', 50, 'allies'], ['linked', 30, 'marr'], ['linked', 15, 'trade'], ['sameIdeo', 10], ['neighbor', -10], ['embargo', -40], ['war', -100], ['overlord', 40]];

CONTENT.SUBJECTS = {
  puppet:   { n: 'Fantoche', e: '🎭', base: 15, tri: .3, war: 1, dip: 0, int: 1.5, cost: .9, d: 'Governo imposto: paga muito, segue o suserano em tudo e integra rápido.' },
  vassal:   { n: 'Vassalo', e: '🛡️', base: 30, tri: .15, war: 1, dip: 0, int: 1, cost: .7, d: 'Paga tributo e luta nas guerras do suserano.' },
  protect:  { n: 'Protetorado', e: '☂️', base: 45, tri: .05, war: 0, dip: 1, int: .6, cost: .5, d: 'Tem diplomacia própria e é defendido pelo suserano; paga pouco.' },
  dominion: { n: 'Domínio', e: '🏛️', base: 55, tri: .05, war: 0, dip: 1, int: .4, cost: .35, d: 'Quase independente: governo e diplomacia próprios, laço leve com a coroa.' },
  union:    { n: 'União pessoal', e: '👑', base: 30, tri: 0, war: 1, dip: 0, int: .8, cost: null, d: 'O mesmo monarca nas duas coroas; nasce de casamentos reais.' },
};

/* leis para cada súdito: lib = efeito na liberdade; tri = multiplicador do tributo; mp = parte do contingente cedida; int = velocidade de integração */
CONTENT.SUBJ_LAWS = {
  tribute: { n: 'Tributo', o: { none: { n: 'Isento', lib: -10, tri: 0 }, normal: { n: 'Normal', lib: 0, tri: 1 }, heavy: { n: 'Pesado', lib: 15, tri: 2 } } },
  army:    { n: 'Exército', o: { own: { n: 'Próprio', lib: 0 }, levies: { n: 'Contingentes ao suserano', lib: 8, mp: .2 }, demil: { n: 'Desmilitarizado', lib: 12, demil: 1 } } },
  rule:    { n: 'Governo', o: { self: { n: 'Autogoverno', lib: -10, int: .5 }, advisors: { n: 'Conselheiros do suserano', lib: 0, int: 1 }, governor: { n: 'Governador nomeado', lib: 12, int: 2 } } },
};

CONTENT.SUBJ_LAW_DEF = { tribute: 'normal', army: 'own', rule: 'advisors' };
