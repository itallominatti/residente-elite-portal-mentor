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
} as const;

/** "Ver como" encerra sozinho depois deste tempo sem uso. */
export const VER_COMO_EXPIRA_MS = 30 * 60 * 1000;
/** Sessão encerra depois deste tempo sem interação (mesma regra do admin-hub). */
export const INATIVIDADE_MS = 60 * 60 * 1000;
export const FUSO = 'America/Sao_Paulo';
