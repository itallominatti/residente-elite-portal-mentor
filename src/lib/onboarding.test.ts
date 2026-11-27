import { describe, expect, it, beforeEach } from 'vitest';
import {
  chaveDoOnboarding,
  deveMostrarOnboarding,
  marcarOnboardingConcluido,
  onboardingConcluido,
} from '@/lib/onboarding';

describe('onboarding de primeiro login do mentor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mostra automaticamente apenas para carteira própria no primeiro acesso', () => {
    expect(deveMostrarOnboarding({ userId: 'm-1', temCarteira: true, verComo: false, concluido: false })).toBe(true);
    expect(deveMostrarOnboarding({ userId: 'm-1', temCarteira: true, verComo: false, concluido: true })).toBe(false);
    expect(deveMostrarOnboarding({ userId: 'm-1', temCarteira: true, verComo: true, concluido: false })).toBe(false);
    expect(deveMostrarOnboarding({ userId: 'a-1', temCarteira: false, verComo: false, concluido: false })).toBe(false);
    expect(deveMostrarOnboarding({ userId: null, temCarteira: true, verComo: false, concluido: false })).toBe(false);
  });

  it('persiste conclusão separada por usuário', () => {
    expect(onboardingConcluido('m-ana')).toBe(false);
    expect(onboardingConcluido('m-pedro')).toBe(false);

    marcarOnboardingConcluido('m-ana');

    expect(onboardingConcluido('m-ana')).toBe(true);
    expect(onboardingConcluido('m-pedro')).toBe(false);
    expect(localStorage.getItem(chaveDoOnboarding('m-ana'))).toBe('1');
  });
});
