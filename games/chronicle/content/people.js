/* Grand Chronicle — conteúdo: personagens, corte, culturas e línguas.
   Arquivo de dados editável: cada bloco "CONTENT.NOME = ...;" é JSON5 (comentários, chaves sem aspas, aspas simples, vírgula no fim).
   Só dados: nada de código. O jogo lê ao abrir a página; para valer num save, salve o arquivo e recarregue. */

/* ---------- traços de personagens (m: modificadores da nação enquanto governa) ---------- */
/* m = modificadores da nação enquanto governa · pm = multiplicadores da personalidade da IA (war, build, army, colon, claim, ally, gold) */
CONTENT.TRAITS = {
  brave:     { n: 'Bravo', m: { army: .05 }, pm: { war: 1.3 }, ai: 'guerreia mais' }, craven: { n: 'Covarde', m: { army: -.05 }, pm: { war: .5 }, ai: 'evita guerras' },
  genius:    { n: 'Gênio', m: { research: .1 } }, slow: { n: 'Lento', m: { research: -.06 } },
  ambitious: { n: 'Ambicioso', m: { prod: .04, stab: -.03 }, pm: { war: 1.4, claim: 1.5 }, ai: 'busca expansão e reivindicações' }, content: { n: 'Contente', m: { stab: .04 }, pm: { war: .6 }, ai: 'prefere a paz' },
  just:      { n: 'Justo', m: { stab: .06 }, pm: { claim: .1 }, ai: 'não fabrica reivindicações' }, cruel: { n: 'Cruel', m: { stab: -.04, manpower: .05 }, pm: { war: 1.3 }, ai: 'guerreia mais' },
  greedy:    { n: 'Ganancioso', m: { tax: .06, stab: -.02 }, pm: { gold: 2 }, ai: 'acumula ouro e ergue mercados' }, generous: { n: 'Generoso', m: { tax: -.04, stab: .05 }, pm: { ally: 1.3 }, ai: 'aceita mais acordos e dá presentes' },
  zealous:   { n: 'Zeloso', m: { stab: .03, research: -.03 }, ai: 'ergue templos' }, cynical: { n: 'Cínico', m: { research: .03 }, ai: 'ignora templos' },
  diligent:  { n: 'Diligente', m: { prod: .05, tax: .03 }, pm: { build: 1.4 }, ai: 'constrói mais' }, lazy: { n: 'Preguiçoso', m: { prod: -.04 }, pm: { build: .6 }, ai: 'constrói menos' },
  schemer:   { n: 'Conspirador', m: { coup: -.3 }, pm: { claim: 1.8 }, ai: 'fabrica mais reivindicações' }, honest: { n: 'Honesto', m: { stab: .03 }, ai: 'sempre honra alianças' },
  strategist:{ n: 'Estrategista', m: { army: .08 }, pm: { army: 1.25 }, ai: 'mantém exército maior' }, builder: { n: 'Construtor', m: { admin: .1 }, pm: { build: 1.5 }, ai: 'prioriza obras' },
  navigator: { n: 'Navegador', m: { colon: .15, trade: .05 }, pm: { colon: 1.6 }, ai: 'explora e coloniza mais' }, scholar: { n: 'Erudito', m: { research: .06 }, ai: 'ergue universidades' },
  paranoid:  { n: 'Paranoico', m: { coup: -.5, stab: -.03 }, pm: { army: 1.3, ally: .5 }, ai: 'exército maior, desconfia de alianças' }, charismatic: { n: 'Carismático', m: { stab: .05, manpower: .03 }, pm: { ally: 1.4 }, ai: 'faz mais alianças e casamentos' },
  sickly:    { n: 'Doente', m: { stab: -.02 }, die: 2, ai: 'morre mais cedo' }, robust: { n: 'Robusto', m: {}, die: .5, ai: 'vive mais' },
};

/* atributos (0–20; 8 = neutro). col = cor do atributo e do cargo que o usa · mod = modificador que move
   r = por ponto acima de 8 no governante (vale para todos os atributos dele) · c = por ponto em qualquer conselheiro · s = extra por ponto quando é o atributo do assento */
CONTENT.STATS = {
  dip: { n: 'Diplomacia', col: '#5b9be0', mod: 'stab', r: .005, c: .0008, s: .0025, d: 'Estabilidade. Também empurra as votações de leis e reformas e ajuda a convencer outros países.' },
  mar: { n: 'Marcial', col: '#e5636b', mod: 'army', r: .01, c: .0015, s: .0045, d: 'Força militar.' },
  adm: { n: 'Administração', col: '#6fcf7a', mod: 'tax', r: .01, c: .0015, s: .0045, d: 'Impostos.' },
  int: { n: 'Intriga', col: '#b48be0', mod: 'coup', r: -.035, c: -.006, s: -.026, d: 'Risco de golpe (negativo é bom). O assento de intriga também descobre segredos e move os esquemas.' },
  lea: { n: 'Saber', col: '#cfd4da', mod: 'research', r: .01, c: .0015, s: .0045, d: 'Pesquisa.' },
};

/* ---------- corte ----------
   nomes dos cargos mudam com a era e o tipo de governo: [condição (cat = grupos de governo, y = a partir do ano), nome]; vale o último que servir */
CONTENT.ROLE_NAMES = {
  chancellor: [[{}, 'Chanceler'], [{ y: 1700 }, 'Secretário de Estado'], [{ cat: ['República', 'Ditadura', 'Tecnocracia'], y: 1800 }, 'Ministro do Exterior'], [{ cat: ['Socialista'] }, 'Comissário do Exterior'], [{ cat: ['Teocracia'] }, 'Núncio']],
  marshal:    [[{}, 'Marechal'], [{ y: 1750 }, 'Ministro da Guerra'], [{ y: 1945 }, 'Ministro da Defesa'], [{ cat: ['Socialista'] }, 'Comissário da Defesa'], [{ cat: ['Tribal'] }, 'Chefe guerreiro']],
  steward:    [[{}, 'Tesoureiro'], [{ y: 1700 }, 'Ministro da Fazenda'], [{ y: 1930 }, 'Ministro da Economia'], [{ cat: ['Socialista'] }, 'Comissário do Plano'], [{ cat: ['Tribal'] }, 'Guardião do tesouro']],
  spymaster:  [[{}, 'Mestre espião'], [{ y: 1800 }, 'Chefe de polícia'], [{ y: 1900 }, 'Diretor de inteligência'], [{ cat: ['Ditadura', 'Socialista'], y: 1900 }, 'Chefe da polícia secreta'], [{ cat: ['Tribal'] }, 'Olhos do chefe']],
  scholar:    [[{}, 'Erudito'], [{ y: 1800 }, 'Ministro da Instrução'], [{ y: 1920 }, 'Ministro da Ciência'], [{ cat: ['Teocracia'] }, 'Grande teólogo'], [{ cat: ['Tribal'] }, 'Sábio']],
  spouse:     [[{}, 'Consorte'], [{ cat: ['República', 'Ditadura', 'Socialista', 'Tecnocracia'] }, 'Cônjuge do governante']],
  pres:       [[{}, 'Prestígio'], [{ cat: ['República'] }, 'Popularidade'], [{ cat: ['Ditadura', 'Socialista', 'Tecnocracia'] }, 'Legitimidade']],
};

/* segredos que um personagem pode esconder (descobertos pelo chefe da espionagem) */
CONTENT.SECRETS = { murder: { n: 'Assassinato', e: '🩸' }, affair: { n: 'Caso amoroso', e: '💋' }, embezzle: { n: 'Desvio de dinheiro', e: '💰' }, heresy: { n: 'Heresia', e: '🕯️' }, debts: { n: 'Dívidas', e: '📜' } };

/* esquemas: alvo ('own' = conselheiro seu, 'foreign' = outro país); m = meses; risk = chance de ser descoberto por mês; names = nome pela era */
/* operações no exterior (botão direito num país). m = meses · risk = chance por mês de ser descoberto · c = custo (× preços)
   spy: ao concluir, escolha o que levar (evento intel_haul) · slander (panfletos): espalha uma ideologia, lei ou governo lá dentro · murder: elimina o governante, um conselheiro ou um general */
CONTENT.SCHEMES = {
  spy:     { m: 6, risk: .02, c: 20, names: [[860, 'Espionar'], [1900, 'Operação de inteligência']], d: 'Ao concluir, escolha o que levar: uma tecnologia em que eles estão à frente, vantagem militar contra eles, parte do tesouro, os mapas deles ou os podres do governante.' },
  slander: { m: 8, risk: .03, c: 30, names: [[860, 'Pregadores'], [1450, 'Panfletos'], [1900, 'Propaganda'], [1990, 'Campanha de desinformação']], d: 'Espalha uma ideia lá dentro: a sua ideologia, uma lei ou forma de governo sua — ou qualquer outra, para atrapalhar. Governante e conselheiros deles passam a querê-la; a pressão do conselho deles sobe.' },
  murder:  { m: 12, risk: .04, c: 60, names: [[860, 'Envenenar'], [1600, 'Assassinar'], [1900, 'Eliminar'], [1990, 'Operação encoberta']], d: 'Elimina o governante, um conselheiro ou um general deles.' },
};
/* o que uma operação de inteligência pode trazer: tech = desconto na pesquisa de uma técnica em que eles estão à frente · mil = dano contra eles por meses · gold = parte do tesouro deles (teto em meses dos seus impostos) · map = mapas deles */
CONTENT.SPY = { tech: .35, mil: .1, milMo: [24, 36], gold: .05, goldCap: 6 };

/* o que cada tutor ensina (o conselheiro do cargo) */
/* interações com membros da corte e do conselho (botão direito no cartão). money = ducados (× era) · pres = prestígio · cd = meses até repetir com a mesma pessoa
   amigáveis: op = opinião ganha · cooptar: base + (intriga do plano − defesa)×2% + dirt se os podres dele são conhecidos; mo = meses cooptado (vota a favor, não pressiona)
   investigar: depois de mo meses, chance de achar podres · difamar: desacreditado por mo meses (pesa 40% nas votações e na pressão) · eliminar: plano com barra de sucesso e de falha */
CONTENT.INTERACT = {
  feast:   { n: 'Convidar para banquete', e: '🍷', kind: 'friend', money: 15, op: 8, cd: 6 },
  gift:    { n: 'Presentear', e: '🎁', kind: 'friend', money: 40, op: 15, cd: 12 },
  praise:  { n: 'Elogiar em público', e: '👏', kind: 'friend', pres: 3, op: 12, cd: 12 },
  honor:   { n: 'Conceder honraria', e: '🎖️', kind: 'friend', pres: 8, op: 30, cd: 60 },
  coopt:   { n: 'Cooptar', e: '🤝', kind: 'hostile', money: 80, base: .45, dirt: .4, mo: 60, cd: 24, d: 'Passa a votar a favor das suas propostas e para de pressionar. Com os podres dele, é bem mais fácil e sai pela metade do preço.' },
  intel:   { n: 'Investigar', e: '🔎', kind: 'hostile', money: 50, mo: 6, cd: 36, d: 'Em alguns meses, chance de achar podres (segredo): servem para chantagear, expor ou cooptar com mais força.' },
  slander: { n: 'Difamar', e: '🗞️', kind: 'hostile', money: 60, base: .55, mo: 60, cd: 24, d: 'Desacreditado: as pautas e o voto dele perdem força. Se der errado, você perde prestígio.' },
  kill:    { n: 'Eliminar', e: '🗡️', kind: 'hostile', money: 120, plot: 1, cd: 60, d: 'Um plano corre por meses: a barra dourada é o sucesso, a vermelha o fracasso; vence quem chegar ao fim primeiro. Fracassado, pode ser descoberto.' },
};
/* plano de eliminação: por mês, sucesso += ok + ok_k × intriga do plano; fracasso += bad + bad_k × defesa do alvo (mais um sorteio). Descoberto ao falhar: disc + (defesa − intriga) × 2% */
CONTENT.PLOT = { ok: 5, ok_k: .45, bad: 5, bad_k: .6, rnd: 5, friend: .3, disc: .35, pres: -10, opAll: -15 };

/* traços que combinam com cada assento: o tutor ensina um deles; no conselho, contam inteiros (os outros traços valem COUNCIL_TRAIT_W) */
CONTENT.TUTOR_TR = { chancellor: ['charismatic', 'just', 'honest'], marshal: ['brave', 'strategist', 'robust'], steward: ['diligent', 'greedy', 'builder'], spymaster: ['schemer', 'paranoid', 'cruel'], scholar: ['scholar', 'genius', 'navigator'] };

CONTENT.TRAIT_OPP = [['brave', 'craven'], ['just', 'cruel'], ['greedy', 'generous'], ['zealous', 'cynical'], ['diligent', 'lazy'], ['honest', 'schemer'], ['content', 'ambitious'], ['genius', 'slow']];

CONTENT.COUNCIL = [['chancellor', 'Chanceler', 'dip'], ['marshal', 'Marechal', 'mar'], ['steward', 'Tesoureiro', 'adm'], ['spymaster', 'Mestre espião', 'int'], ['scholar', 'Erudito', 'lea']];

/* ---------- culturas (todas fictícias): 52 povos em 10 famílias de idioma ----------
   As sílabas de lugares (a, b) e os nomes de pessoas (m, f) saem da família, sempre iguais para cada povo.
   A cada partida (pela seed) muda onde cada povo vive, a fé que segue e as peculiaridades dele (rollCultures). */
CONTENT.LANGS = {
  liq: { on: ['l', 'r', 's', 'th', 'v', 'n', 'el', 'al', 'm'], vo: ['a', 'e', 'i', 'ae', 'ia', 'ie'], co: ['', '', 'n', 'l', 'r', 's'], end: ['ria', 'lis', 'nel', 'thas', 'wen', 'ian', 'oria', 'eth', 'iel', 'anor'], me: ['or', 'ian', 'el', 'ath', 'is'], fe: ['iel', 'a', 'ia', 'wen', 'esse'] },
  har: { on: ['k', 'g', 'dr', 'br', 'th', 'kr', 'z', 'b', 'd', 'h'], vo: ['a', 'o', 'u', 'e'], co: ['', 'r', 'k', 'g', 'm', 'n', 'rd'], end: ['grim', 'dur', 'rok', 'hald', 'bur', 'mok', 'gar', 'zun', 'heim', 'kar'], me: ['ar', 'or', 'ok', 'in', 'um'], fe: ['a', 'is', 'ra', 'una', 'hild'] },
  sib: { on: ['s', 'sh', 'z', 'q', 'kh', 'm', 'r', 'n', 'h', 'j'], vo: ['a', 'i', 'u', 'aa'], co: ['', 'r', 'n', 'm', 'sh', 'd'], end: ['ar', 'shan', 'qir', 'zad', 'im', 'un', 'ash', 'rah', 'abad', 'iya'], me: ['ad', 'im', 'un', 'ir', 'as'], fe: ['a', 'iya', 'ah', 'ira', 'ine'] },
  ton: { on: ['t', 'k', 'm', 'n', 'l', 'ch', 'h', 'sh', 'y', 'j'], vo: ['a', 'o', 'i', 'u', 'ao', 'ei'], co: ['', 'n', 'ng', '', 'n'], end: ['an', 'ong', 'ei', 'u', 'ao', 'in', 'eng', 'ya', 'shan', 'lin'], me: ['an', 'ong', 'ei', 'u', 'ao'], fe: ['a', 'i', 'ei', 'yu', 'lan'] },
  vow: { on: ['k', 'h', 'm', 'n', 'l', 'p', 't', 'w', 'r'], vo: ['a', 'e', 'i', 'o', 'u'], co: [''], end: ['ua', 'ani', 'olo', 'iki', 'ea', 'oa', 'ehu', 'ina', 'aka', 'ono'], me: ['o', 'u', 'aka', 'ele', 'oa'], fe: ['a', 'ani', 'ea', 'ina', 'ola'] },
  gut: { on: ['q', 'kh', 't', 'b', 'ch', 'y', 'g', 's', 'm', 'ar'], vo: ['a', 'e', 'u', 'o', 'i'], co: ['', 'r', 'n', 'g', 'l', 'q'], end: ['tai', 'khan', 'gul', 'tur', 'bek', 'dar', 'yr', 'gan', 'tash', 'ordu'], me: ['ai', 'an', 'ur', 'ek', 'ar'], fe: ['a', 'e', 'ai', 'gul', 'tana'] },
  cel: { on: ['br', 'gw', 'c', 'd', 'll', 'm', 'f', 'rh', 't', 'g'], vo: ['a', 'e', 'o', 'y', 'ae'], co: ['', 'n', 'r', 'th', 'ch', 'dd'], end: ['wyn', 'ach', 'dor', 'lyn', 'an', 'ra', 'eth', 'og', 'mor', 'gal'], me: ['an', 'ric', 'dor', 'wyn', 'og'], fe: ['wen', 'a', 'eth', 'yn', 'ra'] },
  mes: { on: ['tl', 'x', 'ch', 'c', 'm', 'p', 'y', 't', 'hu', 'qu'], vo: ['a', 'e', 'i', 'o'], co: ['', 'l', 'c', 'x', 'n'], end: ['tlan', 'coatl', 'pan', 'ix', 'ec', 'oc', 'tli', 'ya', 'tepec', 'apan'], me: ['tl', 'oc', 'ix', 'atl', 'in'], fe: ['li', 'a', 'ix', 'tli', 'ya'] },
  sla: { on: ['v', 'z', 'd', 'br', 'st', 'sv', 'kr', 'm', 'l', 'g'], vo: ['a', 'o', 'e', 'i', 'y'], co: ['', 'r', 'n', 'v', 's', 'sk'], end: ['grad', 'ov', 'ava', 'ink', 'ets', 'ira', 'omir', 'esk', 'ograd', 'ica'], me: ['omir', 'ek', 'an', 'ov', 'imir'], fe: ['ava', 'ina', 'eta', 'ka', 'ena'] },
  lat: { on: ['v', 'c', 'm', 'r', 's', 't', 'd', 'p', 'l', 'f'], vo: ['a', 'e', 'i', 'o', 'u'], co: ['', 'r', 'n', 's', 'l'], end: ['ia', 'ium', 'ara', 'ona', 'ens', 'itas', 'orum', 'ella', 'ana', 'ino'], me: ['us', 'ius', 'o', 'an', 'or'], fe: ['a', 'ia', 'ina', 'ella', 'ena'] },
};

CONTENT.COLD_FAMS = ['har', 'sla', 'cel'];// famílias que podem viver no continente frio

CONTENT.CUL_LIST = [['Aelírica', 'liq'], ['Sarvelina', 'liq'], ['Thalassiana', 'liq'], ['Vélien', 'liq'], ['Nimérica', 'liq'],
  ['Kragmar', 'har'], ['Dorgruna', 'har'], ['Brakhold', 'har'], ['Grimvarda', 'har'], ['Zharkun', 'har'],
  ['Sahrani', 'sib'], ['Zahmira', 'sib'], ['Khaziri', 'sib'], ['Ushadra', 'sib'], ['Marrakhi', 'sib'], ['Ashvenni', 'sib'],
  ['Tenhao', 'ton'], ['Lunqai', 'ton'], ['Moryeng', 'ton'], ['Kaoshin', 'ton'], ['Hanlei', 'ton'],
  ['Moanui', 'vow'], ['Kalehiki', 'vow'], ['Ohalea', 'vow'], ['Tavaiki', 'vow'], ['Lehuoma', 'vow'], ['Orúmbia', 'vow'],
  ['Khaltai', 'gut'], ['Yurtagi', 'gut'], ['Barkhul', 'gut'], ['Tuvaq', 'gut'], ['Chagrum', 'gut'],
  ['Gwenmor', 'cel'], ['Brythel', 'cel'], ['Caerwyd', 'cel'], ['Llandoric', 'cel'], ['Morvenna', 'cel'],
  ['Tlaxuni', 'mes'], ['Ixcoral', 'mes'], ['Chalpaya', 'mes'], ['Mexoqui', 'mes'], ['Yaxtepe', 'mes'],
  ['Zvarnia', 'sla'], ['Kroviana', 'sla'], ['Belostria', 'sla'], ['Drovaki', 'sla'], ['Svetrova', 'sla'],
  ['Velária', 'lat'], ['Corvínia', 'lat'], ['Taurena', 'lat'], ['Mirantia', 'lat'], ['Solvária', 'lat']];

// texto de abertura (montado por partes; {cul} cultura, {fe} fé, {pais} país, {gov} governo, {cont} continente, {viz} maior vizinho, {vfe} fé do vizinho).
// "when" escolhe a frase: kind (main/far/cold), size (small/mid/big), same (1 = mesma fé do vizinho, 0 = outra), rel (good/bad/cold). Sem "when" = vale sempre.
CONTENT.FLAVOR = {
  cul: [
    { t: 'O povo {cul} reza segundo a fé {fe}.' },
    { t: 'Entre os {cul}, a fé {fe} marca o calendário e a lei.' },
    { t: 'Os {cul} carregam velhos costumes e a devoção {fe}.' },
  ],
  nat: [
    { t: '{pais} é um pequeno domínio, {gov}, que ainda luta por espaço.', when: { size: 'small' } },
    { t: '{pais}, {gov}, tem terra e gente para crescer.', when: { size: 'mid' } },
    { t: '{pais} é uma potência, {gov}, e os vizinhos sabem disso.', when: { size: 'big' } },
  ],
  cont: [
    { t: '{cont} é o coração do mundo conhecido, cheio de rivais.', when: { kind: 'main' } },
    { t: 'Longe do centro do mundo, {cont} segue o próprio ritmo.', when: { kind: 'far' } },
    { t: 'Nas terras frias de {cont}, o mar é estrada e sustento.', when: { kind: 'cold' } },
  ],
  nb: [
    { t: 'Ao lado, {viz} divide a mesma fé, e a amizade é antiga.', when: { same: 1, rel: 'good' } },
    { t: '{viz} reza como vocês, mas a disputa por terra pesa mais que a fé.', when: { same: 1, rel: 'bad' } },
    { t: '{viz} segue a fé {vfe}, e a desconfiança cresce na fronteira.', when: { same: 0, rel: 'bad' } },
    { t: '{viz} segue a fé {vfe}; o comércio fala mais alto que os sermões.', when: { same: 0, rel: 'good' } },
    { t: 'O maior vizinho, {viz}, observa em silêncio.', when: { rel: 'cold' } },
  ],
};
