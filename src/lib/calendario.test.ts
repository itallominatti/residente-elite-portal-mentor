import { describe, expect, it } from 'vitest';
import {
  agruparRevisoesPorDia, arredondar, corDoTipo, diaDaSemana, diaDe, diasDaSemana, filtrarRevisoes, horaDoMinuto, inicioDaSemana, minutoNoDia,
  paraIso, periodoDosDias, posicionar, revisaoAtrasada, rotuloDaEtapa, rotuloDoPeriodo, somarDias, somarMinutos,
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
  it('usa a escolhida; senão a do tipo; revisão pela etapa (real ou legada)', () => {
    expect(corDoTipo('pendencia', 'roxo')).toBe('roxo');
    expect(corDoTipo('pendencia', null)).toBe('verde');
    expect(corDoTipo('contato', '')).toBe('azul');
    expect(corDoTipo('revisao', null, 'primeira')).toBe('laranja');
    expect(corDoTipo('revisao', null, 'segunda')).toBe('amarelo');
    expect(corDoTipo('revisao', null, 'terceira')).toBe('roxo');
    expect(corDoTipo('revisao', null, 'd1')).toBe('laranja');
    expect(corDoTipo('revisao', null, 'qualquer')).toBe('cinza');
    expect(corDoTipo('pendencia', 'fora-da-paleta')).toBe('verde');
    expect(rotuloDaEtapa('primeira')).toBe('1ª rev.');
    expect(rotuloDaEtapa('d7')).toBe('D7');
  });
});

describe('agrupamento e busca de revisões', () => {
  const mk = (id: string, student_id: string, student_name: string, theme_name: string, dia: string, completed = false) => ({
    id, student_id, student_name, theme_name, category_name: 'Clínica Médica',
    scheduled_date: `${dia}T15:00:00Z`, completed,
  });

  it('agrupa por dia com contagem de pendentes, atrasadas, concluídas e alunos distintos', () => {
    const hoje = '2026-11-25';
    const dias = ['2026-11-24', '2026-11-25', '2026-11-26'];
    const lista = [
      mk('1', 'a1', 'Ana', 'Sepse', '2026-11-24', false),
      mk('2', 'a1', 'Ana', 'Arritmias', '2026-11-24', true),
      mk('3', 'a2', 'Bruno', 'Trauma', '2026-11-24', false),
      mk('4', 'a1', 'Ana', 'Pneumonia', '2026-11-25', false),
    ];
    const grupos = agruparRevisoesPorDia(lista, dias, hoje);
    expect(grupos.get('2026-11-24')).toMatchObject({ pendentes: 2, atrasadas: 2, concluidas: 1, alunos: 2 });
    expect(grupos.get('2026-11-24')!.itens.map(x => x.id)).toEqual(['1', '3', '2']);
    expect(grupos.get('2026-11-25')).toMatchObject({ pendentes: 1, atrasadas: 0, concluidas: 0, alunos: 1 });
    expect(grupos.get('2026-11-26')).toMatchObject({ pendentes: 0, atrasadas: 0, concluidas: 0, alunos: 0 });
    expect(revisaoAtrasada(lista[0]!, hoje)).toBe(true);
    expect(revisaoAtrasada(lista[1]!, hoje)).toBe(false);
    expect(revisaoAtrasada(lista[3]!, hoje)).toBe(false);
  });

  it('filtra por tema, aluno ou área ignorando acentos e maiúsculas', () => {
    const lista = [
      mk('1', 'a1', 'Natália Freitas', 'Pré-eclâmpsia', '2026-11-25'),
      mk('2', 'a2', 'Rafael Teixeira', 'Sepse', '2026-11-25'),
    ];
    expect(filtrarRevisoes(lista, 'natalia').map(x => x.id)).toEqual(['1']);
    expect(filtrarRevisoes(lista, 'pre-eclampsia').map(x => x.id)).toEqual(['1']);
    expect(filtrarRevisoes(lista, 'clinica').length).toBe(2);
    expect(filtrarRevisoes(lista, '   ').length).toBe(2);
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
