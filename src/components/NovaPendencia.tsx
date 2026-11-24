/* Nova pendência ou contato agendado (com cor e, se o Google estiver conectado, convite do Meet). */
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Paleta } from '@/components/Paleta';
import { Callout } from '@/components/ui';
import { useCarteira } from '@/hooks/useCarteira';
import { CANAIS, criarPendencia, DURACOES_DO_MEET, type Canal, type StatusDoGoogle } from '@/lib/api/acompanhamento';
import { doCampoSP, paraCampoSP } from '@/lib/calendario';

export function NovaPendencia({ fechar, google, inicial }: { fechar: () => void; google?: StatusDoGoogle; /** Instante (ISO) já escolhido, quando se clica num horário do calendário. */ inicial?: string }) {
  const qc = useQueryClient();
  const { mentorandos } = useCarteira();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'tarefa' | 'contato'>('tarefa');
  const [aluno, setAluno] = useState('');
  const [quando, setQuando] = useState(inicial ? paraCampoSP(inicial) : '');
  const [canal, setCanal] = useState<Canal>('video');
  const [cor, setCor] = useState<string | null>(null);
  const [convite, setConvite] = useState(false);
  const [duracao, setDuracao] = useState<number>(45);
  const [aviso, setAviso] = useState<string | null>(null);
  const podeConvite = tipo === 'contato' && !!aluno && !!quando && google?.enabled === true && google.connected;
  const salvar = useMutation({
    mutationFn: () => criarPendencia({
      titulo: titulo.trim(), tipo, aluno_id: aluno || null, para_quando: doCampoSP(quando), canal: tipo === 'contato' ? canal : null, cor,
      ...(convite && podeConvite ? { convite_meet: true, duracao_min: duracao } : {}),
    }),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['pendencias'] });
      // O contato foi salvo; se o Google falhou, o mentor vê por quê e refaz pela agenda, sem perder o que escreveu.
      if (r.convite?.erro) { setAviso(`O contato foi salvo, mas o convite não saiu: ${r.convite.erro} Você pode enviar depois pela agenda.`); return; }
      fechar();
    },
  });
  const valido = !!titulo.trim() && (tipo === 'tarefa' || !!doCampoSP(quando));
  const ordenados = useMemo(() => [...mentorandos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [mentorandos]);
  if (aviso) {
    return (
      <Sheet titulo="Contato salvo" fechar={fechar} aoEnviar={fechar} enviar="Entendi">
        <Callout icon={Link2} tone="amber"><p className="t-small">{aviso}</p></Callout>
      </Sheet>
    );
  }
  return (
    <Sheet titulo="Nova pendência" fechar={fechar} aoEnviar={() => salvar.mutate()} enviar="Salvar" enviando={salvar.isPending} desabilitado={!valido} erro={salvar.error}>
      <label className="field"><span className="t-small-strong">Tipo</span><span className="input"><select value={tipo} onChange={e => setTipo(e.target.value as 'tarefa' | 'contato')} aria-label="Tipo"><option value="tarefa">Pendência</option><option value="contato">Contato agendado</option></select></span></label>
      <label className="field"><span className="t-small-strong">O que fazer</span><span className="input"><input required maxLength={160} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tipo === 'contato' ? 'Ex.: conversa sobre o plano de dezembro' : 'Ex.: montar plano de revisão'} autoFocus /></span></label>
      <label className="field"><span className="t-small-strong">Aluno (opcional)</span><span className="input"><select value={aluno} onChange={e => setAluno(e.target.value)} aria-label="Aluno"><option value="">Nenhum</option>{ordenados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></span></label>
      <label className="field"><span className="t-small-strong">{tipo === 'contato' ? 'Quando' : 'Para quando (opcional)'}</span><span className="input"><input type="datetime-local" required={tipo === 'contato'} value={quando} onChange={e => setQuando(e.target.value)} /></span></label>
      {tipo === 'contato' && <label className="field"><span className="t-small-strong">Canal</span><span className="input"><select value={canal} onChange={e => setCanal(e.target.value as Canal)} aria-label="Canal">{CANAIS.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}</select></span></label>}
      <div className="field"><span className="t-small-strong">Cor no calendário</span><Paleta valor={cor} aoEscolher={setCor} /></div>
      {tipo === 'contato' && google?.enabled && (
        google.connected
          ? (
            <div className="stack-s">
              <label className="hrow t-small"><input type="checkbox" checked={convite} disabled={!podeConvite} onChange={e => setConvite(e.target.checked)} /> Enviar convite do Google Meet para o aluno</label>
              {!podeConvite && <span className="t-small muted">Escolha o aluno e a data para poder enviar o convite.</span>}
              {convite && podeConvite && (
                <>
                  <label className="field"><span className="t-small-strong">Duração</span><span className="input"><select value={duracao} onChange={e => setDuracao(Number(e.target.value))} aria-label="Duração">{DURACOES_DO_MEET.map(d => <option key={d} value={d}>{d} minutos</option>)}</select></span></label>
                  <span className="t-small muted">O Google cria o evento na sua agenda e envia o e-mail com o link ao aluno. Só vão o horário e o e-mail dele, com um título genérico.</span>
                </>
              )}
            </div>
          )
          : <span className="t-small muted">Para enviar convite do Meet, conecte sua conta Google no topo da Agenda.</span>
      )}
    </Sheet>
  );
}
