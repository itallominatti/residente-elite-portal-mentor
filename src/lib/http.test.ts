import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, extrairErro, ReadOnlyError, request, setReadOnly } from '@/lib/http';
import { ordenarPorEspera, type Conversa } from '@/lib/api/chat';
import { haQuanto } from '@/lib/format';

afterEach(() => { setReadOnly(false); vi.unstubAllGlobals(); });

describe('modo somente leitura', () => {
  it('recusa escrita antes de tocar a rede', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setReadOnly(true);
    await expect(request('/mentoring/chat/threads/x/messages/', { method: 'POST', body: '{}' })).rejects.toBeInstanceOf(ReadOnlyError);
    await expect(request('/mentoring/students/x/goal/', { method: 'DELETE' })).rejects.toBeInstanceOf(ReadOnlyError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deixa leitura passar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 })));
    setReadOnly(true);
    await expect(request('/mentoring/radar/')).resolves.toEqual({ ok: 1 });
  });

  it('erro do servidor vira ApiError com a frase dele', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Você não atende este aluno.' }), { status: 403 })));
    const e = await request('/revision/calendar-items/').catch((x: ApiError) => x) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(403);
    expect(e.message).toBe('Você não atende este aluno.');
  });
});

describe('extrairErro', () => {
  it('lê error, detail e erro por campo', () => {
    expect(extrairErro({ detail: 'x' }, 403)).toBe('x');
    expect(extrairErro({ weekly_questions: ['Fora da faixa.'] }, 400)).toBe('weekly_questions: Fora da faixa.');
    expect(extrairErro({ non_field_errors: ['Inválido.'] }, 400)).toBe('Inválido.');
    expect(extrairErro(null, 502)).toBe('Erro 502');
  });
});

describe('ordenarPorEspera', () => {
  const c = (id: string | null, at: string, aluno: boolean): Conversa => ({ id, student_id: id ?? 'n', student_name: id ?? 'Novo', mentor_id: 'm', mentor_name: 'M', last_message_at: at, last_message_preview: '', last_message_author_is_student: aluno, unread_count: 0 });
  it('quem espera há mais tempo primeiro; depois as recentes; "a iniciar" no fim', () => {
    const r = ordenarPorEspera([c('r1', '2026-11-17T10:00:00Z', false), c('e2', '2026-11-16T10:00:00Z', true), c(null, '', false), c('e1', '2026-11-15T10:00:00Z', true), c('r2', '2026-11-18T10:00:00Z', false)]);
    expect(r.map(x => x.id)).toEqual(['e1', 'e2', 'r2', 'r1', null]);
  });
});

describe('haQuanto', () => {
  const agora = Date.parse('2026-11-18T12:00:00Z');
  it('minutos, horas e dias', () => {
    expect(haQuanto('2026-11-18T11:55:00Z', agora)).toBe('há 5 min');
    expect(haQuanto('2026-11-17T22:00:00Z', agora)).toBe('há 14 h');
    expect(haQuanto('2026-11-15T12:00:00Z', agora)).toBe('há 3 d');
    expect(haQuanto(null, agora)).toBe('');
  });
});
