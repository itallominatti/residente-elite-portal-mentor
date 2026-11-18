import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ClipboardList, Eye, Info, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Avatar, Btn, Callout, Card, ErrorBox, Loading, Pill, SituacaoPill, Stats } from '@/components/ui';
import { useArvore } from '@/hooks/useCarteira';
import { useEscopo } from '@/contexts/EscopoContext';
import { getCarteira, getRadar } from '@/lib/api/mentoring';
import { listarConversas } from '@/lib/api/chat';
import { montarCarteira, ordenarPorUrgencia, contar } from '@/lib/carteira';
import { haQuanto } from '@/lib/format';
import { MOTIVOS_DO_VER_COMO, type MotivoDoVerComo } from '@/lib/api/acompanhamento';
import { FEATURES } from '@/config';


export default function MentorPage() {
  const { id = '' } = useParams();
  const arvore = useArvore();
  const alunos = useQuery({ queryKey: ['carteira'], queryFn: getCarteira, staleTime: 60_000 });
  const radar = useQuery({ queryKey: ['radar'], queryFn: getRadar, staleTime: 5 * 60_000 });
  const conversas = useQuery({ queryKey: ['conversas'], queryFn: listarConversas });
  const [aberto, setAberto] = useState(false);
  const mentor = arvore.data?.mentors.find(m => m.id === id);

  if (arvore.isLoading || alunos.isLoading || radar.isLoading || conversas.isLoading) return <Shell title="Mentor" back="/admin/mentores"><Loading /></Shell>;
  const erro = arvore.error ?? alunos.error ?? radar.error ?? conversas.error;
  if (erro) return <Shell title="Mentor" back="/admin/mentores"><ErrorBox error={erro} /></Shell>;
  if (!mentor) return <Shell title="Mentor" back="/admin/mentores"><Callout icon={Info} tone="amber"><p className="t-small">Mentor não encontrado na árvore.</p></Callout></Shell>;

  const carteira = ordenarPorUrgencia(montarCarteira(alunos.data ?? [], radar.data?.alunos ?? [], conversas.data ?? [], { mentorId: id }));
  const c = contar(carteira);

  return (
    <Shell title={mentor.full_name} back="/admin/mentores">
      <div className="card phead">
        <Avatar nome={mentor.full_name} id={mentor.id} size={56} />
        <div className="phead-t"><div className="hrow wrap"><h1 className="t-h1">{mentor.full_name}</h1><Pill tone="teal">{mentor.role === 'admin' ? 'Admin e mentor' : 'Mentor'}</Pill>{mentor.submentores.length > 0 && <Pill tone="muted">{mentor.submentores.length} submentor{mentor.submentores.length > 1 ? 'es' : ''}</Pill>}</div><p className="t-small muted">{mentor.email}</p></div>
        <div className="phead-a"><Btn icon={Eye} onClick={() => setAberto(true)} disabled={!c.total}>Ver como {mentor.full_name.split(' ').slice(0, 2).join(' ')}</Btn></div>
      </div>
      <Stats items={[
        { label: 'Mentorandos', value: c.total, tone: 'teal' },
        { label: 'Em risco', value: c.alerta + c.atencao, tone: c.alerta + c.atencao ? 'amber' : 'ok', extra: `${c.alerta} em alerta` },
        { label: 'Aguardando resposta', value: c.esperando, tone: c.esperando ? 'amber' : 'ok' },
        { label: 'Sem primeiro contato', value: c.novo, tone: c.novo ? 'blue' : 'ok' },
      ]} />
      <Card title="Carteira" sub="nome, situação e última conversa; o detalhe só em “Ver como”" flush>
        <div className="tbl-wrap"><table className="tbl" aria-label="Carteira do mentor">
          <thead><tr><th>Mentorando</th><th>Situação</th><th className="r">Última conversa</th></tr></thead>
          <tbody>{carteira.map(m => <tr key={m.id}><td><span className="tcell-name"><Avatar nome={m.nome} id={m.id} size={28} /><span className="t-strong">{m.nome}</span></span></td><td><SituacaoPill s={m.situacao} /></td><td className="r t-small muted">{m.ultimaMensagemEm ? haQuanto(m.ultimaMensagemEm) : 'nunca'}</td></tr>)}</tbody>
        </table></div>
      </Card>
      {aberto && <CaixaVerComo mentorId={mentor.id} mentorNome={mentor.full_name} fechar={() => setAberto(false)} />}
    </Shell>
  );
}

function CaixaVerComo({ mentorId, mentorNome, fechar }: { mentorId: string; mentorNome: string; fechar: () => void }) {
  const { entrarVerComo } = useEscopo();
  const nav = useNavigate();
  const [motivo, setMotivo] = useState<MotivoDoVerComo>(MOTIVOS_DO_VER_COMO[0]!.valor);
  const [detalhe, setDetalhe] = useState('');
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const precisaDetalhe = FEATURES.acompanhamento && motivo === 'outro';
  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true); setErro(null);
    try {
      await entrarVerComo({ mentorId, mentorNome, motivo, motivoRotulo: MOTIVOS_DO_VER_COMO.find(m => m.valor === motivo)!.rotulo, detalhe: detalhe.trim() });
      nav('/');
    } catch (x) { setErro(x instanceof Error ? x.message : 'Não foi possível abrir o “ver como”.'); setEnviando(false); }
  };
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) fechar(); }} onKeyDown={e => { if (e.key === 'Escape') fechar(); }}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="vc-t" onSubmit={entrar}>
        <div className="grip" />
        <header className="sheet-h"><h2 className="t-title grow" id="vc-t">Ver o portal como {mentorNome}</h2><button type="button" className="ibtn plain" aria-label="Fechar" onClick={fechar}><X size={18} aria-hidden /></button></header>
        <div className="sheet-b">
          <Callout icon={Eye} tone="amber"><p className="t-strong">Somente leitura</p><p className="t-small">Você verá o portal como este mentor, sem enviar mensagem, editar meta ou marcar conversa como lida. O modo encerra sozinho após 30 minutos sem uso.</p></Callout>
          <label className="field"><span className="t-small-strong">Motivo do acesso</span><span className="input"><ClipboardList size={16} aria-hidden /><select value={motivo} onChange={e => setMotivo(e.target.value as MotivoDoVerComo)} aria-label="Motivo do acesso">{MOTIVOS_DO_VER_COMO.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}</select><ChevronDown size={15} aria-hidden /></span></label>
          <label className="field"><span className="t-small-strong">{precisaDetalhe ? 'Detalhe (obrigatório em “Outro”)' : 'Detalhe (opcional)'}</span><span className="input area"><textarea rows={2} value={detalhe} onChange={e => setDetalhe(e.target.value)} placeholder="Ex.: chamado 4821" /></span></label>
          {FEATURES.acompanhamento
            ? <Callout icon={Info} tone="violet"><p className="t-small"><b>Tudo o que você abrir fica registrado.</b> O servidor grava quem entrou, em qual carteira, por qual motivo e cada tela aberta (a rota e o aluno, nunca o conteúdo). Os administradores consultam isso em “Auditoria”. Sem escrita: o servidor recusa, mesmo que a tela deixasse.</p></Callout>
            : <Callout icon={Info} tone="violet"><p className="t-small"><b>O registro por recurso ainda não existe no servidor.</b> Hoje fica só o acesso normal do seu usuário às mesmas rotas que o admin-hub já usa. A trilha “quem viu o quê” está na lista de ajustes do back-end.</p></Callout>}
          {erro && <p className="t-small c-bad" role="alert">{erro}</p>}
          <label className="hrow t-small"><input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)} /> Entendo que estou acessando dados de alunos e da mentoria com a finalidade acima.</label>
        </div>
        <footer className="sheet-f"><Btn kind="s" onClick={fechar}>Cancelar</Btn><Btn type="submit" icon={Eye} disabled={!ciente || enviando || (precisaDetalhe && !detalhe.trim())}>Entrar no modo “ver como”</Btn></footer>
      </form>
    </div>
  );
}
