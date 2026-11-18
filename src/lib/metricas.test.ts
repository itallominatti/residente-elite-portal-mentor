import { describe, expect, it } from 'vitest';
import { atividadesDe, constancia, diaSPDe, domingoDe, porArea, resumoDasRevisoes, serieSemanal, somaDias, tendencia } from '@/lib/metricas';
import type { ContatoDaRevisao, ItemDoCalendario, TemaDaEvolucao } from '@/lib/api/revision';

// 18/11/2026 é quarta-feira; o domingo da semana é 15/11.
const HOJE = '2026-11-18';
const contato = (iso: string, feitas: number, certas: number): ContatoDaRevisao => ({ id: iso, contact_type: 'rp1', contact_date: iso, questions_done: feitas, questions_correct: certas, accuracy_percentage: 0 });
const item = (kind: ItemDoCalendario['kind'], date: string, total: number, certas: number): ItemDoCalendario => ({ kind, id: date + kind, date, occurred_at: date, title: 'x', theme_id: null, category_name: null, questions_total: total, questions_correct: certas, accuracy_percentage: 0 });

describe('datas', () => {
  it('soma dias e acha o domingo', () => {
    expect(somaDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(domingoDe(HOJE)).toBe('2026-11-15');
    expect(domingoDe('2026-11-15')).toBe('2026-11-15');
    expect(domingoDe('2026-11-21')).toBe('2026-11-15');
  });
  it('o dia é o de São Paulo, não o UTC (22h30 de Brasília é 01h30 UTC do dia seguinte)', () => {
    expect(diaSPDe('2026-11-19T01:30:00Z')).toBe('2026-11-18');
  });
});

describe('atividadesDe', () => {
  it('com a evolução, a revisão isolada do calendário NÃO conta de novo; o simulado registrado conta', () => {
    const r = atividadesDe([contato('2026-11-10T15:00:00Z', 20, 15)], [item('isolated_revision', '2026-11-10', 20, 15), item('registered_simulado', '2026-11-12', 100, 70)]);
    expect(r).toEqual([{ dia: '2026-11-10', questoes: 20, certas: 15 }, { dia: '2026-11-12', questoes: 100, certas: 70 }]);
  });
  it('sem a evolução, usa os dois tipos do calendário', () => {
    expect(atividadesDe(null, [item('isolated_revision', '2026-11-10', 20, 15), item('registered_simulado', '2026-11-12', 100, 70)])).toHaveLength(2);
  });
});

describe('serieSemanal', () => {
  it('agrupa por semana (domingo a sábado), com a atual por último e lacuna onde não há questão', () => {
    const s = serieSemanal([
      { dia: '2026-11-16', questoes: 10, certas: 8 }, { dia: '2026-11-18', questoes: 10, certas: 6 },  // semana atual
      { dia: '2026-11-08', questoes: 40, certas: 20 },                                                  // semana anterior (domingo 8/11)
      { dia: '2026-11-14', questoes: 10, certas: 10 },                                                  // sábado da anterior
    ], HOJE, 4);
    expect(s.rotulos).toEqual(['25/10', '1/11', '8/11', '15/11']);
    expect(s.inicios.at(-1)).toBe('2026-11-15');
    expect(s.questoes).toEqual([0, 0, 50, 20]);
    expect(s.acerto).toEqual([null, null, 60, 70]);
  });
  it('ignora o que é futuro ou anterior à janela', () => {
    const s = serieSemanal([{ dia: '2026-11-25', questoes: 99, certas: 99 }, { dia: '2020-01-01', questoes: 99, certas: 99 }], HOJE, 4);
    expect(s.questoes).toEqual([0, 0, 0, 0]);
  });
});

describe('constancia', () => {
  it('dias ativos, níveis por volume e dias futuros vazios', () => {
    const c = constancia([
      { dia: '2026-11-15', questoes: 5, certas: 3 }, { dia: '2026-11-16', questoes: 30, certas: 20 }, { dia: '2026-11-17', questoes: 80, certas: 50 },
    ], HOJE, 2);
    expect(c.niveis).toHaveLength(14);
    // semana atual: dom 15 (nível 1), seg 16 (3), ter 17 (4), qua 18 (0, ainda vazio), qui-sáb futuros (0)
    expect(c.niveis.slice(7)).toEqual([1, 3, 4, 0, 0, 0, 0]);
    expect(c.diasAtivos).toBe(3);
    expect(c.diasNoPeriodo).toBe(7 + 4);
  });
  it('hoje vazio não quebra a sequência; um dia vazio no meio quebra', () => {
    const base = [{ dia: '2026-11-17', questoes: 1, certas: 1 }, { dia: '2026-11-16', questoes: 1, certas: 1 }];
    expect(constancia(base, HOJE, 2).sequenciaAtual).toBe(2);
    expect(constancia([...base, { dia: '2026-11-14', questoes: 1, certas: 1 }], HOJE, 2).sequenciaAtual).toBe(2);
    expect(constancia([...base, { dia: '2026-11-18', questoes: 1, certas: 1 }], HOJE, 2).sequenciaAtual).toBe(3);
  });
  it('atividade sem questões ainda conta como dia ativo', () => {
    const c = constancia([{ dia: '2026-11-17', questoes: 0, certas: 0 }], HOJE, 1);
    expect(c.diasAtivos).toBe(1);
    expect(c.niveis[2]).toBe(1);
  });
});

describe('porArea', () => {
  it('soma os temas por grande área, calcula o acerto e ordena pelo volume', () => {
    const t = (area: string, f: number, c: number): TemaDaEvolucao => ({ theme_id: area + f, theme_name: 'x', category_name: area, total_questions_done: f, total_questions_correct: c, overall_accuracy: 0, current_stage: 'primeira', contacts: [] });
    const r = porArea([t('Clínica', 100, 60), t('Pediatria', 40, 30), t('Clínica', 100, 70), t('Vazia', 0, 0)]);
    expect(r.map(a => a.area)).toEqual(['Clínica', 'Pediatria']);
    expect(r[0]).toMatchObject({ feitas: 200, certas: 130, acerto: 65, temas: 2 });
  });
});

describe('resumoDasRevisoes', () => {
  it('conta atrasadas (pendente com data antes de hoje), por etapa, e as dos próximos 7 dias', () => {
    const ag = (stage: string, data: string, completed = false) => ({ id: data + stage, theme_name: 't', stage, scheduled_date: data, completed });
    const r = resumoDasRevisoes([
      ag('primeira', '2026-11-10T12:00:00Z'), ag('primeira', '2026-11-12T12:00:00Z'), ag('segunda', '2026-11-17T12:00:00Z'),
      ag('primeira', '2026-11-18T12:00:00Z'), ag('terceira', '2026-11-22T12:00:00Z'), ag('primeira', '2026-11-30T12:00:00Z'),
      ag('primeira', '2026-11-01T12:00:00Z', true),
    ], HOJE);
    expect(r).toMatchObject({ pendentes: 6, atrasadas: 3, proximos7: 2 });
    expect(r.porEtapa).toEqual([{ etapa: '1ª revisão', atrasadas: 2 }, { etapa: '2ª revisão', atrasadas: 1 }]);
  });
});

describe('tendencia', () => {
  it('compara as duas últimas semanas fechadas com as duas anteriores, ponderando pelo volume', () => {
    const s = { inicios: [], rotulos: [], questoes: [100, 100, 100, 100, 50], acerto: [80, 80, 60, 60, 10] as (number | null)[] };
    expect(tendencia(s)).toEqual({ recente: 60, anterior: 80, delta: -20 });
  });
  it('sem dados em um dos lados, não inventa a diferença', () => {
    const s = { inicios: [], rotulos: [], questoes: [0, 0, 100, 100, 5], acerto: [null, null, 70, 70, 50] as (number | null)[] };
    expect(tendencia(s).delta).toBeNull();
  });
});
