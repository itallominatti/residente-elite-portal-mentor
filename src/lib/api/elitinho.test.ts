import { describe, expect, it } from 'vitest';
import { lerEventos } from '@/lib/api/elitinho';

const sse = (nome: string, dados: unknown) => `event: ${nome}\ndata: ${JSON.stringify(dados)}\n\n`;

describe('lerEventos', () => {
  it('lê os eventos do stream na ordem', () => {
    const { eventos, resto } = lerEventos(sse('conversation', { id: 'c1', title: 't', created: true }) + sse('tool', { label: 'Lendo a carteira' }) + sse('delta', { text: 'Olá' }) + sse('done', { message_id: 'm', remaining_today: 39, attempt_id: null }));
    expect(eventos).toEqual([{ tipo: 'conversation', id: 'c1' }, { tipo: 'tool', label: 'Lendo a carteira' }, { tipo: 'delta', texto: 'Olá' }, { tipo: 'done', restantes: 39 }]);
    expect(resto).toBe('');
  });

  it('guarda o evento incompleto para o próximo pedaço', () => {
    const inteiro = sse('delta', { text: 'a' }) + sse('delta', { text: 'b' });
    const corte = inteiro.length - 6;
    const a = lerEventos(inteiro.slice(0, corte));
    expect(a.eventos).toEqual([{ tipo: 'delta', texto: 'a' }]);
    const b = lerEventos(a.resto + inteiro.slice(corte));
    expect(b.eventos).toEqual([{ tipo: 'delta', texto: 'b' }]);
  });

  it('ignora evento desconhecido e JSON quebrado, e lê erro', () => {
    const { eventos } = lerEventos(sse('draft', { id: 'x' }) + 'event: delta\ndata: {quebrado\n\n' + sse('error', { code: 'TUTOR_UNAVAILABLE', detail: 'Fora do ar.' }));
    expect(eventos).toEqual([{ tipo: 'error', detalhe: 'Fora do ar.' }]);
  });

  it('aceita fim de linha CRLF', () => {
    expect(lerEventos('event: delta\r\ndata: {"text":"x"}\r\n\r\n').eventos).toEqual([{ tipo: 'delta', texto: 'x' }]);
  });
});
