/* Grand Chronicle — conteúdo: constantes gerais (defines).
   Arquivo de dados editável: cada bloco "CONTENT.NOME = ...;" é JSON5 (comentários, chaves sem aspas, aspas simples, vírgula no fim).
   Só dados: nada de código. O jogo lê ao abrir a página; para valer num save, salve o arquivo e recarregue. */
const CONTENT = {};                                           // a única linha de código: cria o espaço dos blocos

CONTENT.DEFINES = {
  START_YEAR: 860,
  END_YEAR: 2200,
  VERT_DECLINE: .1, // parte do bônus da vertente que fica para quem a recusa
  BUILD_SLOW: 2.4, // obras, recrutas, navios e prospecção: prazos ×2,4 (base de 2–3 meses vira 5–7)
  RANK_KING: .75, // Reino sustenta 3/4 dos estados do continente; Império exige 2/3 das províncias dele
  RANK_EMP: 0.6666666666666666,
  WIDTH_BASE: 12, // largura de combate, alcance da linha de suprimento (províncias), regimentos por navio
  LOGI_BASE: 2,
  SHIP_CAP: 1,
  COUNCIL_TRAIT_W: .5,
  HOARD_MONTHS: 24, // tesouro acima de 24 meses de impostos (ou do mínimo × era) vaza em corrupção
  HOARD_MIN: 400,
  HOARD_LEAK: .05,
  APPOINT_CD: 12, // meses entre nomear de novo o mesmo cargo de conselho ou general de um exército
  APPOINT_CD_DEATH: 4, // depois de morte ou assassinato, o cargo pode ser trocado de novo em 4 meses
  PRICE_BASE: 25, // nível de preços = (imposto médio por estado no mundo ÷ 25) ^ 0,8, suavizado: custos acompanham a economia, não só o calendário
  PRICE_EXP: .8,
  PRICE_LAG: .04, // quanto anda por mês rumo ao valor atual (~2 anos para assentar) // 5% ao mês do excesso (a cobertura de administração reduz até 60%) // traço de conselheiro vale metade; o traço que combina com o assento (TUTOR_TR) vale inteiro
};
