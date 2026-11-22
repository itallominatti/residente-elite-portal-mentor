/* Registrar um contato com o aluno: o que foi falado, como ele saiu, os próximos passos e o próximo contato. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Callout } from '@/components/ui';
import { CANAIS, getGoogle, HUMORES, registrarContato, type Canal, type Humor, type NovoContato } from '@/lib/api/acompanhamento';

/** `<input type="datetime-local">` quer `yyyy-MM-ddTHH:mm` na hora local. */
const paraCampo = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const doCampo = (v: string) => new Date(v).toISOString();

interface Passo { titulo: string; prazo: string }

export function RegistrarContato({ alunoId, alunoNome, fechar }: { alunoId: string; alunoNome: string; fechar: () => void }) {
  const qc = useQueryClient();
  const [canal, setCanal] = useState<Canal>('video');
  const [quando, setQuando] = useState(() => paraCampo(new Date()));
  const [duracao, setDuracao] = useState('');
  const [humor, setHumor] = useState<Humor | ''>('');
  const [resumo, setResumo] = useState('');
  const [passos, setPassos] = useState<Passo[]>([]);
  const [agendar, setAgendar] = useState(false);
  const [proximo, setProximo] = useState('');
  const [convite, setConvite] = useState(false);
  const [avisoDoConvite, setAvisoDoConvite] = useState<string | null>(null);
  const google = useQuery({ queryKey: ['google'], queryFn: getGoogle, retry: false, staleTime: 60_000 });
  const podeConvidar = google.data?.enabled === true && google.data.connected;

  const salvar = useMutation({
    mutationFn: () => {
      const corpo: NovoContato = {
        canal, resumo: resumo.trim(), ocorreu_em: doCampo(quando),
        duracao_min: duracao ? Number(duracao) : null, humor: humor || null,
        proximos_passos: passos.filter(p => p.titulo.trim()).map(p => ({ titulo: p.titulo.trim(), ...(p.prazo ? { prazo: p.prazo } : {}) })),
        ...(agendar && proximo ? { proximo_contato: { quando: doCampo(proximo), canal, ...(convite && podeConvidar ? { convite_meet: true } : {}) } } : {}),
      };
      return registrarContato(alunoId, corpo);
    },
    onSuccess: r => {
      for (const k of ['contatos', 'pendencias']) qc.invalidateQueries({ queryKey: [k] });
      // O contato foi salvo; se o convite falhou, o mentor vê por quê antes de fechar.
      if (r.convite?.erro) { setAvisoDoConvite(`O contato foi salvo, mas o convite do Meet não saiu: ${r.convite.erro} Você pode enviar depois pela Agenda.`); return; }
      fechar();
    },
  });

  const valido = resumo.trim().length > 0 && !!quando && (!agendar || !!proximo) && (!duracao || (Number(duracao) >= 1 && Number(duracao) <= 1440));
  const mudaPasso = (i: number, campo: Partial<Passo>) => setPassos(ps => ps.map((p, j) => (j === i ? { ...p, ...campo } : p)));

  if (avisoDoConvite) {
    return (
      <Sheet titulo="Contato salvo" fechar={fechar} aoEnviar={fechar} enviar="Entendi">
        <Callout icon={Plus} tone="amber"><p className="t-small">{avisoDoConvite}</p></Callout>
      </Sheet>
    );
  }
  return (
    <Sheet titulo={`Registrar contato com ${alunoNome.split(' ')[0]}`} fechar={fechar} aoEnviar={() => salvar.mutate()} enviar="Salvar contato" enviando={salvar.isPending} desabilitado={!valido} erro={salvar.error}>
      <div className="goal-form">
        <label className="field"><span className="t-small-strong">Canal</span><span className="input"><select value={canal} onChange={e => setCanal(e.target.value as Canal)} aria-label="Canal">{CANAIS.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}</select></span></label>
        <label className="field"><span className="t-small-strong">Quando foi</span><span className="input"><input type="datetime-local" required max={paraCampo(new Date())} value={quando} onChange={e => setQuando(e.target.value)} /></span></label>
        <label className="field"><span className="t-small-strong">Duração (min, opcional)</span><span className="input"><input type="number" inputMode="numeric" min={1} max={1440} value={duracao} onChange={e => setDuracao(e.target.value)} /></span></label>
        <label className="field"><span className="t-small-strong">Como o aluno saiu</span><span className="input"><select value={humor} onChange={e => setHumor(e.target.value as Humor | '')} aria-label="Como o aluno saiu"><option value="">Não informar</option>{HUMORES.map(h => <option key={h.valor} value={h.valor}>{h.rotulo}</option>)}</select></span></label>
      </div>
      <label className="field"><span className="t-small-strong">Resumo do contato</span><span className="input area"><textarea rows={4} required maxLength={4000} value={resumo} onChange={e => setResumo(e.target.value)} placeholder="O que foi combinado, o que o aluno trouxe, o que ficou de ser feito." /></span><span className="t-small muted">Fica visível para quem atende este aluno e para administradores. Para algo reservado, use uma anotação privada.</span></label>

      <div className="stack-s">
        <span className="t-small-strong">Próximos passos</span>
        {passos.map((p, i) => (
          <div key={i} className="hrow wrap">
            <span className="input grow"><input aria-label={`Próximo passo ${i + 1}`} maxLength={160} value={p.titulo} onChange={e => mudaPasso(i, { titulo: e.target.value })} placeholder="Ex.: refazer o simulado de Pediatria" /></span>
            <span className="input"><input type="date" aria-label={`Prazo do passo ${i + 1}`} value={p.prazo} onChange={e => mudaPasso(i, { prazo: e.target.value })} /></span>
            <button type="button" className="ibtn plain" aria-label={`Remover o passo ${i + 1}`} onClick={() => setPassos(ps => ps.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden /></button>
          </div>
        ))}
        {passos.length < 10 && <button type="button" className="btn btn-g sm" onClick={() => setPassos(ps => [...ps, { titulo: '', prazo: '' }])}><Plus size={14} aria-hidden /><span>Adicionar passo</span></button>}
        <span className="t-small muted">Cada passo vira uma pendência na sua agenda, ligada a este aluno.</span>
      </div>

      <label className="hrow t-small"><input type="checkbox" checked={agendar} onChange={e => setAgendar(e.target.checked)} /> Já agendar o próximo contato</label>
      {agendar && <label className="field"><span className="t-small-strong">Próximo contato</span><span className="input"><input type="datetime-local" required min={paraCampo(new Date())} value={proximo} onChange={e => setProximo(e.target.value)} /></span></label>}
      {agendar && podeConvidar && (
        <label className="hrow t-small"><input type="checkbox" checked={convite} onChange={e => setConvite(e.target.checked)} /> Enviar convite do Google Meet para o aluno (o Google manda o e-mail com o link)</label>
      )}
      {agendar && google.data?.enabled && !google.data.connected && <span className="t-small muted">Para enviar convite do Meet, conecte sua conta Google na página Agenda.</span>}
    </Sheet>
  );
}
