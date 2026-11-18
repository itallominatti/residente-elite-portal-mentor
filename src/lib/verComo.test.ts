import { afterEach, describe, expect, it, vi } from 'vitest';
import { aoServidorEncerrarVerComo, ApiError, ReadOnlyError, request, setReadOnly, setVerComoSessao } from '@/lib/http';

afterEach(() => { setReadOnly(false); setVerComoSessao(null); aoServidorEncerrarVerComo(null); vi.unstubAllGlobals(); });

const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const cabecalho = (fetchMock: ReturnType<typeof vi.fn>, chamada = 0) => new Headers((fetchMock.mock.calls[chamada]![1] as RequestInit).headers).get('X-Ver-Como');

describe('sessão de "ver como" no transporte', () => {
  it('manda o cabeçalho em toda requisição enquanto a sessão existe', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(resposta({})));
    vi.stubGlobal('fetch', f);
    setVerComoSessao('sessao-1');
    await request('/mentoring/radar/');
    await request('/mentoring/carteira/');
    expect(cabecalho(f, 0)).toBe('sessao-1');
    expect(cabecalho(f, 1)).toBe('sessao-1');
  });

  it('sem sessão, nenhum cabeçalho', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(resposta({})));
    vi.stubGlobal('fetch', f);
    await request('/mentoring/radar/');
    expect(cabecalho(f)).toBeNull();
  });

  it('abrir e encerrar a sessão vão sem o cabeçalho e fora da trava de leitura', async () => {
    const f = vi.fn().mockImplementation(() => Promise.resolve(resposta({ id: 'x' }, 201)));
    vi.stubGlobal('fetch', f);
    setVerComoSessao('sessao-1');
    setReadOnly(true);
    await expect(request('/mentoring/ver-como/sessao-1/encerrar/', { method: 'POST' })).rejects.toBeInstanceOf(ReadOnlyError);
    await request('/mentoring/ver-como/sessao-1/encerrar/', { method: 'POST' }, { semVerComo: true });
    expect(f).toHaveBeenCalledTimes(1);
    expect(cabecalho(f)).toBeNull();
  });

  it('o servidor encerrou a sessão: avisa a tela e propaga o código', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({ error: 'Esta sessão de "ver como" terminou.', code: 'ver_como_encerrado' }, 403)));
    const aviso = vi.fn();
    aoServidorEncerrarVerComo(aviso);
    setVerComoSessao('velha');
    const e = await request('/mentoring/carteira/').catch((x: ApiError) => x) as ApiError;
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(e.code).toBe('ver_como_encerrado');
    expect(e.status).toBe(403);
  });

  it('outro 403 não derruba a sessão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({ error: 'Você não atende este aluno.' }, 403)));
    const aviso = vi.fn();
    aoServidorEncerrarVerComo(aviso);
    await request('/mentoring/students/x/estudo/').catch(() => undefined);
    expect(aviso).not.toHaveBeenCalled();
  });
});
