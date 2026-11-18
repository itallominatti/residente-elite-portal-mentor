/**
 * Configuração de build. Tudo vem de variáveis `VITE_*` (veja `.env.example`).
 *
 * As chaves de função existem porque parte do portal depende de endpoints que
 * o elite-med-back-end ainda não tem (docs/BACKEND.md). Com a chave desligada,
 * a tela explica o que falta em vez de mostrar dado inventado ou, pior, dado
 * errado: hoje os endpoints de revisão devolvem os dados do PRÓPRIO mentor
 * quando ele pede `?user_id=` de um aluno (`usuario_alvo` só honra o pedido
 * para admin), sem 403.
 */
const env = import.meta.env;

const flag = (v: unknown) => String(v ?? '').trim().toLowerCase() === 'true';

export const API_BASE_URL: string = (env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  || 'https://api.residente-elite.com/api/v1';

export const FEATURES = {
  /** Mentor lê evolução, temas prioritários e revisões do aluno (`?user_id=`). Admin sempre lê. */
  metricasDoMentor: flag(env.VITE_FEATURE_METRICAS_DO_MENTOR),
  /**
   * Contatos, anotações, agenda, plano, carteira com indicadores, leitura do estudo
   * e "ver como" com sessão e trilha no servidor (commits da branch
   * `feat/api-do-portal-do-mentor`). Ligue depois que o back-end estiver no ar.
   */
  acompanhamento: flag(env.VITE_FEATURE_ACOMPANHAMENTO),
  /**
   * Elitinho de apoio ao mentor. DESLIGADO por decisão de LGPD (dado de aluno vai a um
   * modelo de terceiro): só liga com a decisão do dono e o serviço com `MENTOR_ASSISTANT_ENABLED`.
   */
  elitinhoDoMentor: flag(env.VITE_FEATURE_ELITINHO_DO_MENTOR),
} as const;

/** O serviço do Elitinho (outro host, mesmo token). */
export const ELITINHO_API_URL: string = (env.VITE_ELITINHO_API_URL as string | undefined)?.replace(/\/$/, '') || '';

/** "Ver como" encerra sozinho depois deste tempo sem uso. */
export const VER_COMO_EXPIRA_MS = 30 * 60 * 1000;
/** Sessão encerra depois deste tempo sem interação (mesma regra do admin-hub). */
export const INATIVIDADE_MS = 60 * 60 * 1000;
export const FUSO = 'America/Sao_Paulo';
