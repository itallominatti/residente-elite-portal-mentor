import { describe, expect, it } from 'vitest';
import {
  arredondar, corDoTipo, diaDaSemana, diaDe, diasDaSemana, horaDoMinuto, inicioDaSemana, minutoNoDia, paraIso, periodoDosDias, posicionar,
  rotuloDoPeriodo, somarDias, somarMinutos,
} from '@/lib/calendario';

describe('dias no fuso de São Paulo', () => {
  it('o dia vem de São Paulo, não do UTC', () => {
    // 01h UTC de 19/11 ainda é 22h de 18/11 em São Paulo.
    expect(diaDe('2026-11-19T01:00:00Z')).toBe('2026-11-18');
    expect(diaDe('2026-11-19T03:00:00Z')).toBe('2026-11-19');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('a semana começa no domingo', () => {
    expect(diaDaSemana('2026-11-22')).toBe(0); // domingo
    expect(diaDaSemana('2026-11-24')).toBe(2); // terça
    expect(inicioDaSemana('2026-11-24')).toBe('2026-11-22');
    expect(diasDaSemana('2026-11-24')).toEqual(['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']);
    expect(inicioDaSemana('2026-11-22')).toBe('2026-11-22');
  });

  it('rótulo do período, dentro do mês e cruzando o mês', () => {
    expect(rotuloDoPeriodo(diasDaSemana('2026-11-24'))).toBe('novembro de 2026');
    expect(rotuloDoPeriodo(diasDaSemana('2026-11-30'))).toBe('29 nov – 5 dez 2026');
    expect(rotuloDoPeriodo(['2026-11-24'])).toBe('24 de novembro de 2026');
  });
});

describe('horas', () => {
  it('minuto do dia em São Paulo', () => {
    expect(minutoNoDia('2026-11-24T18:30:00Z')).toBe(15 * 60 + 30);
    expect(minutoNoDia('2026-11-24T03:00:00Z')).toBe(0);
  });

  it('ida e volta entre dia+minuto e instante', () => {
    const iso = paraIso('2026-11-24', 15 * 60 + 45);
    expect(iso).toBe('2026-11-24T18:45:00.000Z');
    expect(diaDe(iso)).toBe('2026-11-24');
    expect(minutoNoDia(iso)).toBe(15 * 60 + 45);
  });

  it('limita o minuto ao dia e arredonda ao passo de 15', () => {
    expect(minutoNoDia(paraIso('2026-11-24', -30))).toBe(0);
    expect(minutoNoDia(paraIso('2026-11-24', 5000))).toBe(23 * 60 + 59);
    expect(arredondar(7)).toBe(0);
    expect(arredondar(8)).toBe(15);
    expect(arredondar(14 * 60 + 38)).toBe(14 * 60 + 45);
  });

  it('formata e soma minutos virando o dia', () => {
    expect(horaDoMinuto(9 * 60 + 5)).toBe('09:05');
    expect(diaDe(somarMinutos(paraIso('2026-11-24', 23 * 60 + 30), 60))).toBe('2026-11-25');
  });

  it('o período cobre do começo do primeiro dia ao começo do dia depois do último', () => {
    const p = periodoDosDias(['2026-11-22', '2026-11-28']);
    expect(p.de).toBe('2026-11-22T03:00:00.000Z');
    expect(p.ate).toBe('2026-11-29T03:00:00.000Z');
  });
});

describe('posicionar (sobreposição)', () => {
  const e = (id: string, inicioMin: number, duracaoMin = 60) => ({ id, inicioMin, duracaoMin });
  const por = (ps: ReturnType<typeof posicionar>, id: string) => ps.find(p => p.id === id)!;

  it('eventos que não se tocam ocupam a largura toda', () => {
    const ps = posicionar([e('a', 8 * 60), e('b', 10 * 60)]);
    expect(por(ps, 'a')).toMatchObject({ coluna: 0, colunas: 1 });
    expect(por(ps, 'b')).toMatchObject({ coluna: 0, colunas: 1 });
  });

  it('encostar (fim = início) não é sobrepor', () => {
    const ps = posicionar([e('a', 8 * 60, 60), e('b', 9 * 60, 60)]);
    expect(por(ps, 'a').colunas).toBe(1);
    expect(por(ps, 'b').colunas).toBe(1);
  });

  it('dois eventos no mesmo horário dividem em duas colunas', () => {
    const ps = posicionar([e('a', 8 * 60), e('b', 8 * 60 + 30)]);
    expect(por(ps, 'a')).toMatchObject({ coluna: 0, colunas: 2 });
    expect(por(ps, 'b')).toMatchObject({ coluna: 1, colunas: 2 });
  });

  it('reaproveita a coluna livre e o grupo seguinte volta a uma coluna', () => {
    const ps = posicionar([e('longo', 8 * 60, 180), e('curto1', 8 * 60, 30), e('curto2', 9 * 60, 30), e('depois', 12 * 60)]);
    expect(por(ps, 'curto1')).toMatchObject({ coluna: 1, colunas: 2 });
    expect(por(ps, 'curto2')).toMatchObject({ coluna: 1, colunas: 2 }); // a coluna do curto1 já liberou
    expect(por(ps, 'depois')).toMatchObject({ coluna: 0, colunas: 1 });
  });

  it('dá altura mínima ao evento muito curto e é estável com ids iguais de horário', () => {
    const ps = posicionar([e('b', 600, 5), e('a', 600, 5)]);
    expect(por(ps, 'a').altura).toBe(20);
    expect(por(ps, 'a').coluna).toBe(0);
    expect(por(ps, 'b').coluna).toBe(1);
  });
});

describe('cores', () => {
  it('usa a escolhida; senão a do tipo; revisão pela etapa', () => {
    expect(corDoTipo('pendencia', 'roxo')).toBe('roxo');
    expect(corDoTipo('pendencia', null)).toBe('verde');
    expect(corDoTipo('contato', '')).toBe('azul');
    expect(corDoTipo('revisao', null, 'd1')).toBe('laranja');
    expect(corDoTipo('revisao', null, 'qualquer')).toBe('cinza');
    expect(corDoTipo('pendencia', 'fora-da-paleta')).toBe('verde');
  });
});

describe('campos de formulário', () => {
  it('lê e escreve datetime-local na hora de São Paulo, não na do navegador', async () => {
    const { paraCampoSP, doCampoSP } = await import('@/lib/calendario');
    expect(paraCampoSP('2026-11-24T18:45:00Z')).toBe('2026-11-24T15:45');
    expect(doCampoSP('2026-11-24T15:45')).toBe('2026-11-24T18:45:00.000Z');
    expect(doCampoSP(paraCampoSP('2026-11-25T02:30:00Z'))).toBe('2026-11-25T02:30:00.000Z');
    expect(doCampoSP('')).toBeNull();
    expect(doCampoSP('lixo')).toBeNull();
  });
});
