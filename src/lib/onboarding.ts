/**
 * Controle do onboarding de primeiro login do mentor.
 * Guardado por usuário e versão no localStorage: dois mentores na mesma máquina têm o seu
 * próprio primeiro acesso, e subir a versão permite reapresentar mudanças grandes no futuro.
 */

export const VERSAO_DO_ONBOARDING = 1;

export const chaveDoOnboarding = (userId: string) =>
  `portal_mentor_onboarding_v${VERSAO_DO_ONBOARDING}:${userId}`;

export function onboardingConcluido(userId: string | null | undefined): boolean {
  if (!userId) return true;
  try {
    return localStorage.getItem(chaveDoOnboarding(userId)) === '1';
  } catch {
    return false;
  }
}

export function marcarOnboardingConcluido(userId: string | null | undefined): void {
  if (!userId) return;
  try {
    localStorage.setItem(chaveDoOnboarding(userId), '1');
  } catch {
    /* storage bloqueado */
  }
}

export interface ContextoDoOnboarding {
  userId?: string | null;
  temCarteira: boolean;
  verComo: boolean;
  concluido: boolean;
}

/**
 * Só abre automaticamente para quem está usando uma carteira própria (mentor, submentor
 * ou admin em "Minha carteira") pela primeira vez. Em "ver como" nunca abre.
 */
export function deveMostrarOnboarding(ctx: ContextoDoOnboarding): boolean {
  if (!ctx.userId || !ctx.temCarteira || ctx.verComo) return false;
  return !ctx.concluido;
}
