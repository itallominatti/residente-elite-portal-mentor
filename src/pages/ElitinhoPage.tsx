/* Elitinho de apoio ao mentor: um copiloto que lê a carteira e ajuda a preparar contatos. Só leitura. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, ShieldAlert, Sparkles } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Btn, Callout, ErrorBox, Loading, PageHead } from '@/components/ui';
import { conversar, getCapacidades } from '@/lib/api/elitinho';
import { useEscopo } from '@/contexts/EscopoContext';

interface Msg { autor: 'mentor' | 'elitinho'; texto: string }
const SUGESTOES = ['Quem da minha carteira precisa de contato esta semana e por quê?', 'Prepare a pauta da conversa com o aluno em alerta há mais tempo.', 'Que contatos e combinados estão vencidos na minha agenda?'];

export default function ElitinhoPage() {
  const { somenteLeitura } = useEscopo();
  const cap = useQuery({ queryKey: ['elitinho-capacidades'], queryFn: getCapacidades, retry: false });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ferramenta, setFerramenta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);
  const conversa = useRef<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [msgs, ferramenta]);

  const enviar = async (e?: FormEvent, forcada?: string) => {
    e?.preventDefault();
    const pergunta = (forcada ?? texto).trim();
    if (!pergunta || enviando) return;
    setTexto(''); setErro(null); setEnviando(true);
    setMsgs(m => [...m, { autor: 'mentor', texto: pergunta }, { autor: 'elitinho', texto: '' }]);
    try {
      await conversar(pergunta, conversa.current, ev => {
        if (ev.tipo === 'conversation') conversa.current = ev.id;
        else if (ev.tipo === 'tool') setFerramenta(ev.label);
        else if (ev.tipo === 'delta') { setFerramenta(null); setMsgs(m => m.map((x, i) => (i === m.length - 1 ? { ...x, texto: x.texto + ev.texto } : x))); }
        else if (ev.tipo === 'done') setRestantes(ev.restantes);
        else if (ev.tipo === 'error') setErro(ev.detalhe);
      });
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não foi possível falar com o Elitinho.');
    } finally {
      setEnviando(false); setFerramenta(null);
      // Resposta vazia (erro antes do texto) não fica pendurada na tela.
      setMsgs(m => (m.length && m[m.length - 1]!.autor === 'elitinho' && !m[m.length - 1]!.texto ? m.slice(0, -1) : m));
    }
  };

  return (
    <Shell title="Elitinho">
      <PageHead title="Elitinho, seu apoio" sub="Lê os dados da sua carteira para ajudar a priorizar e preparar contatos. Não escreve nada por você." />
      {cap.isLoading ? <Loading /> : cap.error ? <ErrorBox error={cap.error} onRetry={() => cap.refetch()} /> : !cap.data?.mentor_assistant ? (
        <Callout icon={ShieldAlert} tone="amber"><p className="t-strong">Apoio ao mentor indisponível</p><p className="t-small">O serviço não está liberado para esta conta. Quando for liberado, o Elitinho aparece aqui.</p></Callout>
      ) : (
        <>
          <Callout icon={ShieldAlert} tone="violet"><p className="t-small">O Elitinho usa um modelo de IA de terceiro. Para responder, ele recebe do servidor, só dos seus mentorandos, o primeiro nome e os números de estudo, os contatos, o plano e a sua agenda. Nunca recebe suas anotações privadas nem as conversas dos alunos com o Elitinho. Confira o que ele disser antes de agir.</p></Callout>
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 360 }}>
            <div className="chat-msgs" aria-live="polite">
              {!msgs.length && (
                <div className="chat-empty"><Sparkles size={22} aria-hidden /><p className="t-body">Pergunte sobre a sua carteira.</p>
                  <div className="stack-s" style={{ marginTop: 10 }}>{SUGESTOES.map(s => <Btn key={s} kind="s" sm onClick={() => void enviar(undefined, s)} disabled={enviando || somenteLeitura}>{s}</Btn>)}</div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={`bubble-w${m.autor === 'mentor' ? ' me' : ''}`}>
                  <span className="meta">{m.autor === 'mentor' ? 'Você' : 'Elitinho'}</span>
                  <div className="bubble">{m.texto || (enviando && i === msgs.length - 1 ? (ferramenta ?? 'Pensando…') : '')}</div>
                </div>
              ))}
              {ferramenta && msgs.at(-1)?.texto && <p className="t-small muted">{ferramenta}…</p>}
              <div ref={fim} />
            </div>
            {erro && <p className="t-small c-bad" role="alert" style={{ padding: '0 14px' }}>{erro}</p>}
            <form className="composer" style={{ padding: 12 }} onSubmit={e => void enviar(e)}>
              <span className="input"><input aria-label="Pergunta ao Elitinho" maxLength={2000} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Pergunte sobre a sua carteira" disabled={somenteLeitura} /></span>
              <Btn type="submit" icon={Send} disabled={enviando || !texto.trim() || somenteLeitura} aria-label="Enviar" />
            </form>
          </div>
          {restantes !== null && <p className="t-small muted">Restam {restantes} mensagens hoje.</p>}
        </>
      )}
    </Shell>
  );
}
