import { describe, expect, it } from 'vitest';
import { contar, montarCarteira, ordenarPorUrgencia, situacaoDe } from '@/lib/carteira';
import type { AlunoDaCarteira, AlunoNoRadar } from '@/lib/api/mentoring';
import type { Conversa } from '@/lib/api/chat';

const aluno = (id: string, mentor = 'ana', nome = id): AlunoDaCarteira => ({ id, full_name: nome, email: `${id}@x.com`, mentorships: [{ mentorship_id: `v-${id}`, mentor_id: mentor, mentor_name: mentor }] });
const noRadar = (id: string, codigos: string[]): AlunoNoRadar => ({ id, nome: id, email: '', motivos: codigos.map(c => ({ codigo: c, texto: c })), resumo: ['l1'], rascunho: `Oi, ${id}`, conversa_id: null, ultima_mensagem_do_ramo_em: null, pode_escrever: true });
const conversa = (aluno: string, o: Partial<Conversa> = {}): Conversa => ({ id: `t-${aluno}`, student_id: aluno, student_name: aluno, mentor_id: 'ana', mentor_name: 'Ana', last_message_at: '2026-11-10T10:00:00Z', last_message_preview: 'oi', last_message_author_is_student: false, unread_count: 0, can_write: true, ...o });

describe('situacaoDe', () => {
  it('sumir é alerta mesmo com um motivo só', () => expect(situacaoDe([{ codigo: 'sem_questoes_7d', texto: '' }], true)).toBe('alerta'));
  it('dois motivos = alerta; um = atenção', () => {
    expect(situacaoDe([{ codigo: 'queda_de_acerto', texto: '' }, { codigo: 'revisoes_atrasadas', texto: '' }], true)).toBe('alerta');
    expect(situacaoDe([{ codigo: 'queda_de_acerto', texto: '' }], true)).toBe('atencao');
  });
  it('sem motivo e sem conversa = falta o primeiro contato', () => {
    expect(situacaoDe([], false)).toBe('novo');
    expect(situacaoDe([], true)).toBe('ok');
  });
});

describe('montarCarteira', () => {
  it('no "ver como", recorta pelos vínculos e pelas conversas do mentor escolhido', () => {
    const r = montarCarteira([aluno('a'), aluno('b', 'pedro')], [noRadar('b', ['queda_de_acerto'])], [conversa('a'), conversa('b', { mentor_id: 'pedro' })], { mentorId: 'ana' });
    expect(r.map(m => m.id)).toEqual(['a']);
    expect(r[0]!.situacao).toBe('ok');
  });

  it('para o mentor (escopo do servidor) mantém todos e junta radar e conversa', () => {
    const r = montarCarteira([aluno('a'), aluno('b')], [noRadar('b', ['sem_questoes_7d'])], [conversa('b', { last_message_author_is_student: true, unread_count: 2 })], { mentorId: null });
    const b = r.find(m => m.id === 'b')!;
    expect(b.situacao).toBe('alerta');
    expect(b.esperandoDesde).toBe('2026-11-10T10:00:00Z');
    expect(b.conversaId).toBe('t-b');
    expect(b.rascunho).toBe('Oi, b');
    expect(r.find(m => m.id === 'a')!.situacao).toBe('novo');
  });

  it('só libera escrita com `true` explícito do servidor', () => {
    const r = montarCarteira([aluno('a')], [{ ...noRadar('a', []), pode_escrever: false }], [conversa('a', { can_write: undefined })], { mentorId: null });
    expect(r[0]!.podeEscrever).toBe(false);
  });

  it('entrada "a iniciar" (id null) não conta como conversa', () => {
    const r = montarCarteira([aluno('a')], [], [conversa('a', { id: null, last_message_at: null })], { mentorId: null });
    expect(r[0]!.situacao).toBe('novo');
    expect(r[0]!.conversaId).toBeNull();
  });
});

describe('ordenarPorUrgencia', () => {
  it('alerta, atenção, sem contato, em dia; quem espera sobe dentro da mesma situação', () => {
    const ms = montarCarteira(
      [aluno('ok'), aluno('novo'), aluno('aten'), aluno('al1'), aluno('al2')],
      [noRadar('aten', ['queda_de_acerto']), noRadar('al1', ['sem_questoes_7d']), noRadar('al2', ['sem_questoes_7d'])],
      [conversa('ok'), conversa('al2', { last_message_author_is_student: true })],
      { mentorId: null },
    );
    expect(ordenarPorUrgencia(ms).map(m => m.id)).toEqual(['al2', 'al1', 'aten', 'novo', 'ok']);
    expect(contar(ms)).toMatchObject({ total: 5, alerta: 2, atencao: 1, novo: 1, ok: 1, esperando: 1 });
  });
});
