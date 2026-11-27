/**
 * Onboarding completo do primeiro login do mentor (e guia reabrível pelo menu).
 * Explica a rotina diária, onde fica cada informação do aluno, como ler a agenda
 * (horários do mentor × faixa diária de revisões) e o que é privado vs. visível ao aluno.
 */
import { useEffect, useId, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarClock, CheckCircle2, Compass, Lock, MessageSquare,
  Radar, ShieldCheck, Users, X, type LucideProps,
} from 'lucide-react';
import { Btn, Callout, Pill, Tile, type Tom } from '@/components/ui';

type Icon = ComponentType<LucideProps>;

interface CartaoGuia {
  titulo: string;
  texto: string;
  tom?: Tom;
  selo?: string;
}

interface Passo {
  icone: Icon;
  tom: Tom;
  etiqueta: string;
  titulo: string;
  resumo: string;
  cartoes: CartaoGuia[];
  dica?: string;
  atalho?: { rotulo: string; para: string };
}

function montarPassos(primeiroNome: string, isSubmentor: boolean): Passo[] {
  return [
    {
      icone: Compass,
      tom: 'teal',
      etiqueta: 'Boas-vindas',
      titulo: `Bem-vindo ao Portal do Mentor${primeiroNome ? `, ${primeiroNome}` : ''}`,
      resumo: 'Em 1 minuto você entende onde está cada informação do seu mentorando e qual a ordem mais rápida para conduzir o seu dia.',
      cartoes: [
        { selo: '1º passo do dia', tom: 'amber', titulo: 'Início e Conversas', texto: 'Veja primeiro quem está esperando resposta e os alunos priorizados para hoje.' },
        { selo: '2º passo', tom: 'bad', titulo: 'Radar da carteira', texto: 'Identifique automaticamente quem ficou parado, caiu no acerto ou acumulou revisões.' },
        { selo: '3º passo', tom: 'blue', titulo: 'Agenda e Perfil do aluno', texto: 'Conduza seus encontros, ajuste revisões/metas e registre o combinado em um só lugar.' },
      ],
      dica: isSubmentor
        ? 'Como submentor, você acompanha a mesma carteira do mentor responsável — todas as telas já vêm filtradas para esse ramo.'
        : 'Você pode reabrir este guia sempre que precisar pelo botão “Guia do portal” no menu.',
    },
    {
      icone: Radar,
      tom: 'bad',
      etiqueta: 'Priorização',
      titulo: 'Início e Radar: quem precisa de atenção agora',
      resumo: 'O portal classifica sua carteira automaticamente com 5 regras objetivas do servidor (sem IA), para você não precisar abrir aluno por aluno.',
      cartoes: [
        { selo: 'Em alerta', tom: 'bad', titulo: 'Urgência alta', texto: 'Aluno há 7+ dias sem responder questões ou acumulando dois ou mais sinais de risco.' },
        { selo: 'Atenção', tom: 'amber', titulo: 'Um sinal ligado', texto: 'Queda de acerto, revisões atrasadas, meta baixa por 2 semanas ou simulado parado.' },
        { selo: 'Sem contato / Em dia', tom: 'ok', titulo: 'Acompanhamento de rotina', texto: '“Sem contato” lembra de dar boas-vindas aos novos; “Em dia” mostra quem está no ritmo.' },
      ],
      dica: 'No Radar, clicar em “Mandar mensagem” nunca envia nada sozinho: abre a conversa com um rascunho pronto para você revisar e editar.',
      atalho: { rotulo: 'Abrir o Radar', para: '/radar' },
    },
    {
      icone: Users,
      tom: 'teal',
      etiqueta: 'Perfil do mentorando',
      titulo: 'Onde está cada dado do aluno (5 abas)',
      resumo: 'Clique em qualquer nome em “Mentorandos” para abrir o dossiê completo do aluno, organizado em 5 abas fixas:',
      cartoes: [
        { selo: 'Visão geral', tom: 'teal', titulo: 'Retrato rápido + Perfil de prova', texto: 'Motivos do radar, atividade das últimas 12 semanas, meta semanal e questionário (ano, instituições e especialidades).' },
        { selo: 'Desempenho', tom: 'amber', titulo: 'Acerto, grandes áreas e temas', texto: 'Evolução semanal, matriz de temas prioritários (Crítico, Prioritário e Suporte) e lista de evolução por tema com histórico de contatos.' },
        { selo: 'Estudo', tom: 'blue', titulo: 'Provas, flashcards e agenda de revisões', texto: 'Simulados feitos na plataforma (com “Ver prova” questão a questão), caderno de erros por contagem, constância e agenda de revisões do aluno.' },
        { selo: 'Plano · Contatos', tom: 'ok', titulo: 'Combinados, pauta e notas privadas', texto: 'Em “Plano e metas” você combina objetivos e meta semanal. Em “Contatos e notas” gera a pauta do encontro, registra reuniões e guarda anotações privadas.' },
      ],
      atalho: { rotulo: 'Ver Mentorandos', para: '/mentorandos' },
    },
    {
      icone: CalendarClock,
      tom: 'blue',
      etiqueta: 'Agenda sem poluição',
      titulo: 'Como ler a Agenda e ajustar revisões',
      resumo: 'Separamos o que tem horário marcado do que é diário para a tela ficar sempre limpa:',
      cartoes: [
        { selo: 'Grade de horários', tom: 'blue', titulo: 'Seus contatos e pendências', texto: 'Clique em qualquer horário vazio para criar uma tarefa ou agendar contato (com convite automático do Google Meet, se conectado). Arraste para mudar de dia/hora.' },
        { selo: 'Faixa “Rev.” no topo', tom: 'amber', titulo: 'Revisões dos alunos por dia', texto: 'Ficam fora das horas para não poluir sua grade. Dias cheios aparecem resumidos (“6 revisões · 4 alunos”) — clique para abrir a lista agrupada por aluno.' },
        { selo: 'Ação na revisão', tom: 'ok', titulo: 'Remarcar e sugerir questões', texto: 'Clique em qualquer revisão (na Agenda ou na aba Estudo do aluno) para remarcar a data ou definir a sugestão de questões do mentor.' },
      ],
      dica: 'Revisões já concluídas começam ocultas para manter o foco no que pede ação. Ligue “Mostrar concluídas” nos filtros se quiser consultar o histórico.',
      atalho: { rotulo: 'Ir para a Agenda', para: '/agenda' },
    },
    {
      icone: MessageSquare,
      tom: 'amber',
      etiqueta: 'Comunicação',
      titulo: 'Conversas com contexto ao lado',
      resumo: 'A caixa de entrada ordena automaticamente quem espera resposta há mais tempo no topo.',
      cartoes: [
        { selo: 'Painel lateral', tom: 'teal', titulo: 'Contexto sem trocar de tela', texto: 'Ao abrir uma conversa, o resumo do radar e o link direto para o perfil do aluno aparecem ao lado.' },
        { selo: 'Ponto de partida', tom: 'amber', titulo: 'Rascunho editável', texto: 'Se o aluno estiver no radar, você pode carregar o rascunho no campo de texto e ajustar com suas palavras antes de enviar.' },
      ],
      atalho: { rotulo: 'Abrir Conversas', para: '/conversas' },
    },
    {
      icone: ShieldCheck,
      tom: 'ok',
      etiqueta: 'Privacidade e transparência',
      titulo: 'O que o aluno vê e o que é só seu',
      resumo: 'Para você orientar com tranquilidade e segurança (LGPD):',
      cartoes: [
        { selo: 'Visível ao aluno', tom: 'blue', titulo: 'Meta, revisões, convite e chat', texto: 'Meta semanal de questões/horas, nova data de revisão remarcada, sugestão de questões, convite do Meet e mensagens no chat.' },
        { selo: 'Equipe de mentoria', tom: 'teal', titulo: 'Contatos e plano combinado', texto: 'Histórico de contatos registrados e objetivos do plano são compartilhados apenas com quem atende o aluno e administradores.' },
        { selo: 'Só você vê', tom: 'violet', titulo: 'Anotações privadas e sua agenda', texto: 'Suas anotações privadas pertencem exclusivamente a você — nem outros mentores nem administradores têm acesso.' },
      ],
      dica: 'Tudo pronto! Você pode revisitar este guia quando quiser clicando em “Guia do portal” no menu.',
    },
  ];
}

interface Props {
  aberto: boolean;
  nome: string;
  isSubmentor: boolean;
  aoConcluir: () => void;
}

export function OnboardingDoMentor({ aberto, nome, isSubmentor, aoConcluir }: Props) {
  const [indice, setIndice] = useState(0);
  const nav = useNavigate();
  const tituloId = useId();
  const primeiroNome = nome && !nome.includes('@') ? nome.split(' ')[0]! : '';
  const passos = montarPassos(primeiroNome, isSubmentor);
  const atual = passos[indice]!;
  const ultimo = indice === passos.length - 1;

  useEffect(() => {
    if (aberto) setIndice(0);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoConcluir();
      else if (e.key === 'ArrowRight' && indice < passos.length - 1) setIndice(i => i + 1);
      else if (e.key === 'ArrowLeft' && indice > 0) setIndice(i => i - 1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto, indice, passos.length, aoConcluir]);

  if (!aberto) return null;

  const irPara = (rota: string) => {
    aoConcluir();
    nav(rota);
  };

  return (
    <div className="overlay onb-overlay" onClick={e => { if (e.target === e.currentTarget) aoConcluir(); }}>
      <div className="sheet onb-modal" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <div className="grip" />
        <header className="sheet-h">
          <Tile icon={atual.icone} tone={atual.tom} size={34} />
          <div className="grow">
            <span className="t-label">{atual.etiqueta} · passo {indice + 1} de {passos.length}</span>
            <h2 className="t-title" id={tituloId}>{atual.titulo}</h2>
          </div>
          <button type="button" className="ibtn plain" aria-label="Fechar guia" onClick={aoConcluir}>
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="onb-prog" role="tablist" aria-label="Passos do guia">
          {passos.map((p, i) => (
            <button
              key={p.etiqueta}
              type="button"
              role="tab"
              aria-selected={i === indice}
              aria-label={`Passo ${i + 1}: ${p.etiqueta}`}
              className={`onb-dot${i === indice ? ' on' : i < indice ? ' feito' : ''}`}
              onClick={() => setIndice(i)}
            />
          ))}
        </div>

        <div className="sheet-b">
          <p className="t-body muted">{atual.resumo}</p>

          <div className="onb-grid">
            {atual.cartoes.map(c => (
              <div key={c.titulo} className="onb-card">
                {c.selo && <Pill tone={c.tom ?? 'neutral'}>{c.selo}</Pill>}
                <p className="t-strong">{c.titulo}</p>
                <p className="t-small muted">{c.texto}</p>
              </div>
            ))}
          </div>

          {atual.dica && (
            <Callout icon={indice === passos.length - 1 ? Lock : BookOpen} tone={indice === passos.length - 1 ? 'violet' : 'teal'}>
              <p className="t-small">{atual.dica}</p>
            </Callout>
          )}

          {atual.atalho && (
            <div className="hrow">
              <Btn kind="g" sm icon={ArrowRight} onClick={() => irPara(atual.atalho!.para)}>
                {atual.atalho.rotulo}
              </Btn>
            </div>
          )}
        </div>

        <footer className="sheet-f onb-foot">
          {indice === 0 ? (
            <Btn kind="g" onClick={aoConcluir}>Pular por agora</Btn>
          ) : (
            <Btn kind="s" icon={ArrowLeft} onClick={() => setIndice(i => i - 1)}>Anterior</Btn>
          )}
          {ultimo ? (
            <Btn icon={CheckCircle2} onClick={aoConcluir}>Começar a usar o portal</Btn>
          ) : (
            <Btn icon={ArrowRight} onClick={() => setIndice(i => i + 1)}>Próximo</Btn>
          )}
        </footer>
      </div>
    </div>
  );
}
