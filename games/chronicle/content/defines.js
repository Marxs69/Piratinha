/* Grand Chronicle — conteúdo: constantes gerais (defines).
   Arquivo de dados editável: cada bloco "CONTENT.NOME = ...;" é JSON5 (comentários, chaves sem aspas, aspas simples, vírgula no fim).
   Só dados: nada de código. O jogo lê ao abrir a página; para valer num save, salve o arquivo e recarregue. */
const CONTENT = {};                                           // a única linha de código: cria o espaço dos blocos

CONTENT.DEFINES = {
  START_YEAR: 860,
  END_YEAR: 2200,
  VERT_DECLINE: .1, // parte do bônus da vertente que fica para quem a recusa
  BUILD_SLOW: 2.4, // obras, recrutas, navios e prospecção: prazos ×2,4 (base de 2–3 meses vira 5–7)
  WIDTH_BASE: 12, // largura de combate, alcance da linha de suprimento (províncias), regimentos por navio
  LOGI_BASE: 2,
  SHIP_CAP: 1,
  COUNCIL_TRAIT_W: .5,
  HOARD_MONTHS: 8, // tesouro acima de 8 meses de receita bruta (impostos + exportações; ou do mínimo × preços) vaza em corrupção
  HOARD_MIN: 400, // também o piso da dívida que leva à falência (× preços)
  HOARD_LEAK: .25, // 25% ao mês do excesso (a cobertura de administração reduz até 60%)
  TECH_BASE: 700, // custo base de uma técnica em 860 (cresce e^((ano−860)/TECH_TAU))
  TECH_TAU: 294, // 700 em 860 → ~33 500 em 2000 (o mesmo de antes no moderno; ~1,8× mais caro em 1000)
  TECH_AHEAD: 30, // nenhuma técnica pode ser pesquisada mais de 30 anos antes do ano dela
  TECH_DIFF: { world: .3, nb: .3, old: .006, oldMax: .3, floor: .3 }, // difusão: desconto = 30% × parte do mundo que já a tem + 30% × parte dos vizinhos + 0,6%/ano de atraso (até 30%); custo nunca abaixo de 30%
  ERA_FRAC: .8, // sobe de era com 80% das técnicas comuns da era
  STAB_SOFT: { at: 70, k: .5, at2: 90, k2: .5 }, // alvo acima de 70 vale metade; o que ainda passar de 90 vale metade de novo (retorno decrescente)
  NEW_NATION: { money: 100, horde: 400, stab: 55, mp: .3 }, // país que nasce no meio da partida (secessão, rebeldes, partilha, invasão): dinheiro × preços, estab., contingente inicial (parte do máximo)
  ALIENS: { on: false }, // vida inteligente na lua e ataques: desligados até a fase de fim de jogo (decisão do dono: só perto de 2000, raros, um susto). Os sorteios continuam iguais
  REFUSE_STAB: 5, // estabilidade perdida por quem recusa um chamado às armas (jogador e IA)
  CRISIS: { stab: 10, months: 24, to: 35 }, // estab. abaixo de 10 por 24 meses: golpe/crise que refaz o governo e devolve a estab. a 35
  SEPAR: { k: .004, max: .04, lib: 3 }, // acima do limite de domínio: chance/mês = 0,4% × estados em excesso (teto 4%) de um estado afastado se separar; súditos +3 de liberdade por estado em excesso
  WEX: { time: .1, occ: 1.5, loss: 6, cap: 30, rec: .6 }, // cansaço/mês em guerra: 0,1 + 1,5 × parte ocupada + 6 × perdas do mês ÷ contingente máx.; teto 30; fora de guerra −0,6
  APPOINT_CD: 12, // meses entre nomear de novo o mesmo cargo de conselho ou general de um exército
  APPOINT_CD_DEATH: 4, // depois de morte ou assassinato, o cargo pode ser trocado de novo em 4 meses
  PRICE_BASE: 25, // nível de preços = (imposto médio por estado no mundo ÷ 25) ^ 0,8, suavizado: custos acompanham a economia, não só o calendário
  PRICE_EXP: .8,
  PRICE_LAG: .04, // quanto anda por mês rumo ao valor atual (~2 anos para assentar) // traço de conselheiro vale metade; o traço que combina com o assento (TUTOR_TR) vale inteiro
};
