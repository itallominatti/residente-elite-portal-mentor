import { describe, expect, it } from 'vitest';
import { grupoDe, montarAgenda, pedemAtencao } from '@/lib/agenda';
import type { Pendencia } from '@/lib/api/acompanhamento';

// 18/11/2026, 12h em São Paulo.
const AGORA = Date.parse('2026-11-18T15:00:00Z');
const p = (id: string, due_at: string | null, extra: Partial<Pendencia> = {}): Pendencia => ({
  id, student_id: null, student_name: null, kind: 'tarefa', channel: null, title: id, due_at, done_at: null, source_contact_id: null, created_at: '', ...extra,
});

describe('agenda', () => {
  it('agrupa pelo dia em São Paulo, não pelo UTC', () => {
    // 01h UTC de 19/11 ainda é 22h de 18/11 em São Paulo: hoje.
    expect(grupoDe(p('a', '2026-11-19T01:00:00Z'), AGORA)).toBe('hoje');
    // 02h UTC de 18/11 é 23h de 17/11: atrasada.
    expect(grupoDe(p('b', '2026-11-18T02:00:00Z'), AGORA)).toBe('atrasadas');
  });

  it('separa hoje, próximos 7 dias, mais adiante e sem data', () => {
    expect(grupoDe(p('a', '2026-11-18T22:00:00Z'), AGORA)).toBe('hoje');
    expect(grupoDe(p('b', '2026-11-25T15:00:00Z'), AGORA)).toBe('proximos7');
    expect(grupoDe(p('c', '2026-11-26T15:00:00Z'), AGORA)).toBe('depois');
    expect(grupoDe(p('d', null), AGORA)).toBe('sem_data');
  });

  it('ordena por data dentro do grupo e põe as concluídas à parte, a mais recente primeiro', () => {
    const a = montarAgenda([
      p('tarde', '2026-11-18T21:00:00Z'), p('cedo', '2026-11-18T13:00:00Z'), p('sem', null), p('velha', '2026-11-10T12:00:00Z'),
      p('f1', '2026-11-01T12:00:00Z', { done_at: '2026-11-02T00:00:00Z' }), p('f2', null, { done_at: '2026-11-05T00:00:00Z' }),
    ], AGORA);
    expect(a.grupos.map(g => g.grupo)).toEqual(['atrasadas', 'hoje', 'sem_data']);
    expect(a.grupos[1]!.itens.map(i => i.id)).toEqual(['cedo', 'tarde']);
    expect(a.feitas.map(i => i.id)).toEqual(['f2', 'f1']);
    expect(a.abertas).toBe(4);
  });

  it('o selo conta atrasadas e de hoje, sem as concluídas', () => {
    expect(pedemAtencao([p('a', '2026-11-10T12:00:00Z'), p('b', '2026-11-18T20:00:00Z'), p('c', '2026-12-30T12:00:00Z'), p('d', '2026-11-10T12:00:00Z', { done_at: 'x' })], AGORA)).toBe(2);
  });
});
