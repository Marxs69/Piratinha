/* Loja e amigos do app Jogos: jogos fictícios (paródias) e amigos fictícios. Adicione novos itens aqui. */

// n nome · e ícone · c cores do ícone · t gênero · p preço em dólares zimbabuanos de 1990 (0 = grátis) · d desconto em % · f aparece em Destaques · i imagem da página na loja
const CIMG = f => './assets/' + f;
const SHOP = [
  { n: 'Life in Half 2',               e: '🧪', c: ['#f28c18', '#3a2208'], t: 'Tiro',               p: 39.99, f: 1, i: CIMG('shop/life-in-half.svg') },
  { n: 'Small Theft Manual VI',        e: '🚤', c: ['#e2557a', '#2b1140'], t: 'Ação',               p: 149.99, f: 1, i: CIMG('shop/small-theft.svg') },
  { n: 'Mineshaft',                    e: '⛏️', c: ['#6dbb3c', '#3d2a17'], t: 'Sandbox',            p: 49.99, d: 30, f: 1, i: CIMG('community/cave.svg') },
  { n: 'The New Papers V',             e: '📰', c: ['#9aa7b0', '#1b2228'], t: 'RPG',                p: 124.99, f: 1, i: CIMG('shop/new-papers.svg') },
  { n: 'Bright Souls',                 e: '☀️', c: ['#c9772a', '#160d07'], t: 'Ação',               p: 79.99, d: 50, i: CIMG('community/bonfire.svg') },
  { n: 'Counting Attacks 2',           e: '🔫', c: ['#e1a530', '#1d2430'], t: 'Tiro',               p: 0, f: 1, i: CIMG('shop/counting-attacks.svg') },
  { n: 'Fable Association',            e: '📖', c: ['#c8a75a', '#0b1d2c'], t: 'MOBA',               p: 0, i: CIMG('shop/fable-association.svg') },
  { n: 'Botta 2',                      e: '😈', c: ['#d4442f', '#1b0f0d'], t: 'MOBA',               p: 0, i: CIMG('shop/botta.svg') },
  { n: 'Fourteen Nights',              e: '🪂', c: ['#9b5de5', '#1e3a8a'], t: 'Battle royale',      p: 0, f: 1, i: CIMG('shop/fourteen-nights.svg') },
  { n: 'Duck Shoot',                   e: '🦆', c: ['#e84b3c', '#1c2340'], t: 'Party',              p: 8.99, d: 40, i: CIMG('community/ducks.svg') },
  { n: 'Vacant Gentleman',             e: '🪖', c: ['#b9c6d8', '#121826'], t: 'Metroidvania',       p: 23.99, d: 60, f: 1, i: CIMG('shop/vacant-gentleman.svg') },
  { n: 'Farm Ville',                   e: '🌾', c: ['#8cc63f', '#2e5a1c'], t: 'Simulação',          p: 12.99, i: CIMG('community/farm.svg') },
  { n: 'The Warlock 3',                e: '🐺', c: ['#b23a3a', '#1a1414'], t: 'RPG',                p: 99.99, i: CIMG('shop/warlock.svg') },
  { n: 'CyberPuppies 1099',            e: '🐶', c: ['#f7e600', '#1a1a2e'], t: 'RPG',                p: 99.99, d: 65, f: 1, i: CIMG('community/cyber.svg') },
  { n: 'Scarlet Defunct Reparation 2', e: '🤠', c: ['#c0392b', '#2a1a12'], t: 'Ação',               p: 124.99, i: CIMG('shop/scarlet-defunct.svg') },
  { n: 'Elder Rim',                    e: '💍', c: ['#d8b45a', '#2a2216'], t: 'RPG',                p: 114.99, d: 25, f: 1, i: CIMG('shop/elder-rim.svg') },
  { n: "Bucket's Door 3",              e: '🪣', c: ['#c33b3b', '#1d1a24'], t: 'RPG',                p: 99.99, i: CIMG('shop/buckets-door.svg') },
  { n: 'Martiania',                    e: '👽', c: ['#4caf50', '#1b3a5c'], t: 'Sandbox',            p: 9.99, d: 50, i: CIMG('community/mars.svg') },
  { n: 'Rocket Federation',            e: '🚗', c: ['#2f80ed', '#e8742c'], t: 'Esporte',            p: 0, i: CIMG('shop/rocket-federation.svg') },
  { n: 'Gateway 2',                    e: '🌀', c: ['#2d9cdb', '#f2994a'], t: 'Puzzle',             p: 29.99, f: 1, i: CIMG('shop/gateway.svg') },
  { n: 'Posseidon 2',                  e: '🔱', c: ['#e0533b', '#1a0b14'], t: 'Roguelike',          p: 36.99, i: CIMG('shop/posseidon.svg') },
  { n: 'Factory',                      e: '⚙️', c: ['#e39b2d', '#2b2b2b'], t: 'Estratégia',         p: 44.99, i: CIMG('shop/factory.svg') },
  { n: 'Primitiveness VI',             e: '🗿', c: ['#c9a227', '#1f3b57'], t: 'Estratégia',         p: 139.99, d: 40, i: CIMG('shop/primitiveness.svg') },
  { n: 'Underwater 2',                 e: '🐠', c: ['#00b4d8', '#03263f'], t: 'Sobrevivência',      p: 34.99, i: CIMG('community/underwater.svg') },
  { n: 'Generic Survival',             e: '🪓', c: ['#8fa3ad', '#22303a'], t: 'Sobrevivência',      p: 18.99, d: 20, i: CIMG('shop/generic-survival.svg') },
  { n: 'Tankard',                      e: '🍺', c: ['#e8d7b0', '#7a2f2f'], t: 'Plataforma',         p: 18.99, i: CIMG('shop/tankard.svg') },
  { n: 'Africa Universalis',           e: '🍉', c: ['#e8424f', '#1f6b2c'], t: 'Grande estratégia',  p: 18.99, d: 75, i: CIMG('shop/africa-universalis.svg') },
  { n: 'Sea of Cheese',                e: '🧀', c: ['#f4c542', '#6b4e10'], t: 'Aventura',           p: 64.99, f: 1, i: CIMG('community/cheese-sea.svg') },
  { n: 'Foosball Manager 1987',        e: '⚽', c: ['#27ae60', '#123020'], t: 'Esporte',            p: 99.99, i: CIMG('shop/foosball.svg') },
  { n: 'Simps 4',                      e: '🏠', c: ['#3ccf6e', '#1d4d8a'], t: 'Simulação',          p: 0, i: CIMG('shop/simps.svg') },
];
const GAMEC = {   // cores do ícone dos jogos do sistema (pasta em games/)
  doom: ['#c2281f', '#3a0605'], smithing: ['#ea7016', '#3b1d0c'], combate: ['#6a4fc4', '#2a1f4e'],
  colonia: ['#5fae48', '#24461b'], bastiao: ['#7a5d9e', '#2b2436'], adventure: ['#5f9e48', '#1f3a17'],
};
const FRIENDS = [
  { n: 'Barba-Negra',   e: '🧔', c: '#3b3b46' },
  { n: 'Papagaio Zé',   e: '🦜', c: '#2e7d32' },
  { n: 'Kraken99',      e: '🦑', c: '#6a1b9a' },
  { n: 'PolvoLouco',    e: '🐙', c: '#ad1457' },
  { n: 'Sereia_GG',     e: '🧜‍♀️', c: '#00838f' },
  { n: 'Caranguejo',    e: '🦀', c: '#c62828' },
  { n: 'Caveirinha',    e: '💀', c: '#424242' },
  { n: 'TubarãoBR',     e: '🦈', c: '#1565c0' },
  { n: 'Macaco Prego',  e: '🐒', c: '#6d4c41' },
  { n: 'MaréAlta',      e: '🌊', c: '#0277bd' },
  { n: 'Capitã Ana',    e: '👒', c: '#ef6c00' },
  { n: 'Grumete',       e: '⚓', c: '#37474f' },
];
const POSTS = [   // aba Comunidade: amigo que postou (a), jogo (g), imagem (i), legenda (m) e curtidas (l)
  { a: 'Capitã Ana',   g: 'Sea of Cheese',     i: CIMG('community/cheese-sea.svg'), m: 'Achei o tesouro. É queijo.',                    l: 412 },
  { a: 'Caveirinha',   g: 'Bright Souls',      i: CIMG('community/bonfire.svg'),    m: 'Morri 312 vezes. Valeu a pena.',               l: 988 },
  { a: 'Kraken99',     g: 'Martiania',         i: CIMG('community/mars.svg'),       m: 'Base nº 47. As outras 46 explodiram.',          l: 156 },
  { a: 'Sereia_GG',    g: 'CyberPuppies 1099', i: CIMG('community/cyber.svg'),      m: 'Modo foto: 6 horas. Jogo: 5 minutos.',          l: 734 },
  { a: 'Barba-Negra',  g: 'Zombie Fortress',   i: CIMG('games/bastiao.svg'),        m: 'Onda 40 e o muro ainda de pé.',                 l: 221 },
  { a: 'Papagaio Zé',  g: 'Farm Ville',        i: CIMG('community/farm.svg'),       m: 'Colheita perfeita. Os corvos discordam.',       l: 89 },
  { a: 'Macaco Prego', g: 'Mineshaft',         i: CIMG('community/cave.svg'),       m: 'Cavei direto pra baixo. Não recomendo.',        l: 503 },
  { a: 'Grumete',      g: "Hero's Journey",    i: CIMG('games/combate.svg'),        m: 'Mochila organizada, luta perdida.',             l: 64 },
  { a: 'TubarãoBR',    g: 'Underwater 2',      i: CIMG('community/underwater.svg'), m: 'Me sentindo em casa.',                          l: 317 },
  { a: 'PolvoLouco',   g: 'Duck Shoot',        i: CIMG('community/ducks.svg'),      m: 'Nenhum pato foi ferido. Eu fui.',               l: 145 },
  { a: 'MaréAlta',     g: 'RPG Adventure',     i: CIMG('games/adventure.png'),      m: 'Coop de 4 descendo a cripta.',                  l: 276, px: 1 },
];
const UPDNOTES = [   // notas das atualizações aleatórias da barra inferior e dos downloads
  'Correções de bugs e bugs novos.', 'Removemos o lag. Adicionamos outro.', 'Novo chapéu cosmético por Z$ 44,99.', 'Balanceamento: tudo ficou mais fraco.',
  'Agora com 30% mais pixels.', 'Servidores consertados (por enquanto).', '80 GB para mudar uma vírgula.', 'Evento de temporada: igual ao anterior.',
  'O chefe final agora tem dois finais.', 'Os patos ficaram mais espertos.',
];
