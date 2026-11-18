/**
 * "Preparar contato": a pauta de uma conversa com o aluno, montada só com o
 * que o portal já sabe (radar, indicadores, contatos, pendências e plano).
 * Sem IA e sem texto inventado: cada linha vem de um dado, e a pergunta
 * sugerida de cada motivo é fixa. Função pura: a tela só mostra.
 */
import type { Mentorando } from '@/lib/carteira';
import type { Contato, Objetivo, Pendencia } from '@/lib/api/acompanhamento';
import { rotuloDoCanal, rotuloDoHumor } from '@/lib/api/acompanhamento';
import { dataCurta, haQuanto } from '@/lib/format';

export interface SecaoDaPauta { titulo: string; itens: string[] }

/** O que perguntar para cada sinal do radar. Texto fixo: o mentor decide o tom. */
export const PERGUNTA_DO_MOTIVO: Record<string, string> = {
  sem_questoes_7d: 'O que atrapalhou a rotina de estudo nesta última semana? Dá para combinar um mínimo viável para os próximos dias?',
  meta_baixa_2_semanas: 'A meta semanal ainda cabe na sua rotina? Vale ajustar o número em vez de cumprir pela metade?',
  revisoes_atrasadas: 'Quer reorganizar as revisões em atraso por prioridade, começando pelos temas de maior peso?',
  queda_de_acerto: 'O que mudou nas últimas semanas (tema novo, cansaço, pressa nas questões)? Quer olhar os erros recentes juntos?',
  simulado_abandonado: 'O simulado que ficou parado travou em algum ponto? Prefere retomar ou refazer em outro horário?',
};

const corta = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function montarPauta(m: Mentorando, contatos: Contato[], pendencias: Pendencia[], objetivos: Objetivo[], agora = Date.now()): SecaoDaPauta[] {
  const secoes: SecaoDaPauta[] = [];

  const ultimo = [...contatos].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  secoes.push({
    titulo: 'Desde o último contato',
    itens: ultimo
      ? [
        `${rotuloDoCanal(ultimo.channel)} ${haQuanto(ultimo.occurred_at, agora)} (${dataCurta(ultimo.occurred_at)})${ultimo.mood ? `; o aluno saiu ${rotuloDoHumor(ultimo.mood).toLowerCase()}` : ''}.`,
        `Resumo: ${corta(ultimo.summary)}`,
      ]
      : ['Nenhum contato registrado ainda: este é o primeiro. Apresente o combinado da mentoria e pergunte a meta para a prova.'],
  });

  const sinais: string[] = [];
  for (const x of m.motivos) sinais.push(x.texto);
  const i = m.indicadores;
  if (i) {
    if (i.acerto_recente !== null) sinais.push(`Acerto de ${i.acerto_recente}% em ${i.respostas_recentes} questões nas últimas duas semanas${i.variacao_do_acerto ? ` (${i.variacao_do_acerto > 0 ? '+' : ''}${i.variacao_do_acerto} pontos)` : ''}.`);
    if (i.meta_semanal !== null) sinais.push(`Semana: ${i.questoes_na_semana} de ${i.meta_semanal} questões (${i.pct_da_meta ?? 0}% da meta).`);
    // O radar já diz das revisões atrasadas; o número do indicador só entra quando ele não disse.
    if (i.revisoes_atrasadas && !m.motivos.some(x => x.codigo === 'revisoes_atrasadas')) sinais.push(`${i.revisoes_atrasadas} revisões atrasadas.`);
  }
  if (sinais.length) secoes.push({ titulo: 'O que os números mostram', itens: [...new Set(sinais)] });

  const abertas = pendencias.filter(p => !p.done_at && p.student_id === m.id);
  if (abertas.length) {
    secoes.push({
      titulo: 'Combinados em aberto',
      itens: abertas.map(p => `${p.title}${p.due_at ? ` (até ${dataCurta(p.due_at)}${new Date(p.due_at).getTime() < agora ? ', atrasado' : ''})` : ''}`),
    });
  }

  const emAndamento = objetivos.filter(o => !o.done_at);
  if (emAndamento.length) {
    secoes.push({ titulo: 'Plano combinado', itens: emAndamento.map(o => `${o.title}: ${o.progress}%${o.due_date ? `, prazo ${dataCurta(`${o.due_date}T12:00:00`)}` : ''}`) });
  }

  const perguntas = m.motivos.map(x => PERGUNTA_DO_MOTIVO[x.codigo]).filter((x): x is string => !!x);
  secoes.push({
    titulo: 'Perguntas para abrir a conversa',
    itens: perguntas.length ? perguntas : ['Como foi a semana de estudo? O que funcionou e o que travou?', 'Há algo no seu dia a dia que eu possa ajudar a organizar?'],
  });

  return secoes;
}
