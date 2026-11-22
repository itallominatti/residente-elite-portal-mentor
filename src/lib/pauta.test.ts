import { describe, expect, it } from 'vitest';
import { montarPauta } from '@/lib/pauta';
import type { Mentorando } from '@/lib/carteira';
import type { Contato, Objetivo, Pendencia } from '@/lib/api/acompanhamento';

const AGORA = Date.parse('2026-11-18T15:00:00Z');
const aluno = (extra: Partial<Mentorando> = {}): Mentorando => ({
  id: 'a1', nome: 'Rafael', email: '', mentores: [], situacao: 'alerta', motivos: [], resumo: [], rascunho: '', conversaId: null, podeEscrever: true,
  esperandoDesde: null, naoLidas: 0, ultimaMensagemDoRamo: null, ultimaMensagemEm: null, previa: '', indicadores: null, ...extra,
});
const contato = (extra: Partial<Contato> = {}): Contato => ({
  id: 'c1', student_id: 'a1', author_id: 'm', author_name: 'Ana', channel: 'video', occurred_at: '2026-11-10T12:00:00Z', duration_min: 30,
  summary: 'Revisamos o cronograma.', mood: 'desanimado', created_at: '2026-11-10T12:30:00Z', ...extra,
});
const pend = (extra: Partial<Pendencia> = {}): Pendencia => ({
  id: 'p1', student_id: 'a1', student_name: 'Rafael', kind: 'tarefa', channel: null, title: 'Refazer simulado', due_at: '2026-11-15T20:00:00Z', done_at: null,
  source_contact_id: null, meet_url: null, created_at: '2026-11-10T12:30:00Z', ...extra,
});
const objetivo = (extra: Partial<Objetivo> = {}): Objetivo => ({
  id: 'o1', student_id: 'a1', author_id: 'm', author_name: 'Ana', title: 'Fechar Pediatria', detail: '', due_date: '2026-12-01', progress: 40, done_at: null,
  created_at: '', updated_at: '', ...extra,
});
const secao = (s: ReturnType<typeof montarPauta>, titulo: string) => s.find(x => x.titulo === titulo);

describe('montarPauta', () => {
  it('sem contato anterior, diz que é o primeiro e não inventa histórico', () => {
    const s = montarPauta(aluno(), [], [], [], AGORA);
    expect(secao(s, 'Desde o último contato')!.itens[0]).toMatch(/primeiro/);
    expect(secao(s, 'Combinados em aberto')).toBeUndefined();
    expect(secao(s, 'Plano combinado')).toBeUndefined();
  });

  it('usa o contato mais recente, com o humor com que o aluno saiu', () => {
    const s = montarPauta(aluno(), [contato({ id: 'velho', occurred_at: '2026-10-01T12:00:00Z', summary: 'Antigo' }), contato()], [], [], AGORA);
    const itens = secao(s, 'Desde o último contato')!.itens;
    expect(itens[0]).toMatch(/Videochamada.*desanimado/);
    expect(itens[1]).toBe('Resumo: Revisamos o cronograma.');
  });

  it('traz os motivos do radar e as perguntas fixas de cada um', () => {
    const m = aluno({ motivos: [{ codigo: 'sem_questoes_7d', texto: '9 dias sem responder questão' }, { codigo: 'revisoes_atrasadas', texto: '8 revisões atrasadas' }] });
    const s = montarPauta(m, [], [], [], AGORA);
    expect(secao(s, 'O que os números mostram')!.itens).toEqual(['9 dias sem responder questão', '8 revisões atrasadas']);
    expect(secao(s, 'Perguntas para abrir a conversa')!.itens).toHaveLength(2);
  });

  it('sem motivo, usa as perguntas gerais', () => {
    expect(secao(montarPauta(aluno({ situacao: 'ok' }), [], [], [], AGORA), 'Perguntas para abrir a conversa')!.itens[0]).toMatch(/semana de estudo/);
  });

  it('junta os indicadores do servidor ao que o radar já disse', () => {
    const m = aluno({ indicadores: { acerto_recente: 58, respostas_recentes: 41, acerto_anterior: 71, variacao_do_acerto: -13, questoes_na_semana: 0, meta_semanal: 150, pct_da_meta: 0, revisoes_atrasadas: 8, revisoes_de_hoje: 2, dias_sem_questao: 9 } });
    const itens = secao(montarPauta(m, [], [], [], AGORA), 'O que os números mostram')!.itens;
    expect(itens).toContain('Acerto de 58% em 41 questões nas últimas duas semanas (-13 pontos).');
    expect(itens).toContain('Semana: 0 de 150 questões (0% da meta).');
    expect(itens).toContain('8 revisões atrasadas.');
  });

  it('não repete as revisões atrasadas quando o radar já as citou', () => {
    const m = aluno({ motivos: [{ codigo: 'revisoes_atrasadas', texto: '8 revisões atrasadas' }], indicadores: { acerto_recente: null, respostas_recentes: 0, acerto_anterior: null, variacao_do_acerto: null, questoes_na_semana: 0, meta_semanal: null, pct_da_meta: null, revisoes_atrasadas: 8, revisoes_de_hoje: 0, dias_sem_questao: null } });
    expect(secao(montarPauta(m, [], [], [], AGORA), 'O que os números mostram')!.itens).toEqual(['8 revisões atrasadas']);
  });

  it('lista só os combinados abertos deste aluno, marcando o atrasado', () => {
    const s = montarPauta(aluno(), [], [pend(), pend({ id: 'p2', title: 'Feito', done_at: '2026-11-16T00:00:00Z' }), pend({ id: 'p3', student_id: 'outro', title: 'De outro' }), pend({ id: 'p4', title: 'Sem data', due_at: null })], [], AGORA);
    expect(secao(s, 'Combinados em aberto')!.itens).toEqual(['Refazer simulado (até 15/11, atrasado)', 'Sem data']);
  });

  it('o plano mostra só objetivos em andamento', () => {
    const s = montarPauta(aluno(), [], [], [objetivo(), objetivo({ id: 'o2', title: 'Concluído', done_at: '2026-11-01T00:00:00Z', progress: 100 })], AGORA);
    expect(secao(s, 'Plano combinado')!.itens).toEqual(['Fechar Pediatria: 40%, prazo 01/12']);
  });

  it('corta resumo muito longo', () => {
    const s = montarPauta(aluno(), [contato({ summary: 'x'.repeat(400) })], [], [], AGORA);
    expect(secao(s, 'Desde o último contato')!.itens[1]!.length).toBeLessThan(160);
  });
});
