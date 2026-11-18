/**
 * Mock das rotas novas (carteira com indicadores, estudo, contatos, notas, agenda, plano,
 * "ver como" e trilha). SÓ desenvolvimento; as regras de acesso espelham as do servidor
 * (`domain/mentoring/acompanhamento.py` e `ver_como.py`), para a tela ser testada contra elas.
 */
export interface ContextoDoMock {
  quem: { user: string; role: string };
  alunos: [string, string, string][];
  nomeDoMentor: Record<string, string>;
  atende: (alunoId: string) => boolean;
  escopo: () => [string, string, string][];
  json: (body: unknown, status?: number) => Response;
  agora: number;
}

const iso = (ctx: ContextoDoMock, horasAtras: number) => new Date(ctx.agora - horasAtras * 3600_000).toISOString();
let seq = 1;
const novoId = () => `mk-${seq++}`;

type Contato = { id: string; student_id: string; author_id: string; author_name: string; channel: string; occurred_at: string; duration_min: number | null; summary: string; mood: string | null; created_at: string };
type Nota = { id: string; student_id: string; author_id: string; body: string; sensitive: boolean; created_at: string; updated_at: string };
type Pend = { id: string; owner_id: string; student_id: string | null; student_name: string | null; kind: string; channel: string | null; title: string; due_at: string | null; done_at: string | null; source_contact_id: string | null; created_at: string };
type Obj = { id: string; student_id: string; author_id: string; author_name: string; title: string; detail: string; due_date: string | null; progress: number; done_at: string | null; created_at: string; updated_at: string };
type Sessao = { id: string; admin_id: string; admin_name: string; mentor_id: string; mentor_name: string; reason: string; detail: string; started_at: string; last_seen_at: string; ended_at: string | null; ip_address: string | null; events: { at: string; method: string; route: string; student_id: string | null; student_name: string | null }[] };

const contatos: Contato[] = [];
const notas: Nota[] = [];
const pendencias: Pend[] = [];
const objetivos: Obj[] = [];
const sessoes: Sessao[] = [];
let semeado = false;

function semear(ctx: ContextoDoMock) {
  if (semeado) return;
  semeado = true;
  const ANA = 'm-ana';
  contatos.push(
    { id: novoId(), student_id: 'a-rafael', author_id: ANA, author_name: ctx.nomeDoMentor[ANA]!, channel: 'video', occurred_at: iso(ctx, 24 * 12), duration_min: 40, summary: 'Revisamos o cronograma até a prova da USP. Rafael está com plantões pesados e combinamos meta reduzida por duas semanas.', mood: 'neutro', created_at: iso(ctx, 24 * 12) },
    { id: novoId(), student_id: 'a-rafael', author_id: ANA, author_name: ctx.nomeDoMentor[ANA]!, channel: 'mensagem', occurred_at: iso(ctx, 24 * 30), duration_min: null, summary: 'Primeiro contato: apresentei a mentoria e pedi a prova-alvo.', mood: 'motivado', created_at: iso(ctx, 24 * 30) },
  );
  pendencias.push(
    { id: novoId(), owner_id: ANA, student_id: 'a-rafael', student_name: 'Rafael Teixeira', kind: 'contato', channel: 'ligacao', title: 'Contato com Rafael', due_at: iso(ctx, -3), done_at: null, source_contact_id: null, created_at: iso(ctx, 24) },
    { id: novoId(), owner_id: ANA, student_id: 'a-camila', student_name: 'Camila Duarte', kind: 'tarefa', channel: null, title: 'Montar plano de revisão de Cardiologia', due_at: iso(ctx, 30), done_at: null, source_contact_id: null, created_at: iso(ctx, 60) },
    { id: novoId(), owner_id: ANA, student_id: null, student_name: null, kind: 'tarefa', channel: null, title: 'Preparar relatório mensal da carteira', due_at: null, done_at: null, source_contact_id: null, created_at: iso(ctx, 90) },
  );
  objetivos.push({ id: novoId(), student_id: 'a-rafael', author_id: ANA, author_name: ctx.nomeDoMentor[ANA]!, title: 'Fechar Cardiologia e Pediatria', detail: 'Antes do simulado de dezembro.', due_date: '2026-12-10', progress: 35, done_at: null, created_at: iso(ctx, 24 * 12), updated_at: iso(ctx, 24 * 5) });
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function indicadores(id: string) {
  const h = hash(id), parou = id === 'a-rafael';
  const acerto = parou ? 58 : 55 + (h % 30), anterior = parou ? 71 : acerto + ((h % 9) - 4);
  const meta = id === 'a-bruno' ? null : 150, feitas = parou ? 0 : 60 + (h % 110);
  return {
    acerto_recente: acerto, respostas_recentes: parou ? 41 : 60 + (h % 120), acerto_anterior: anterior, variacao_do_acerto: acerto - anterior,
    questoes_na_semana: feitas, meta_semanal: meta, pct_da_meta: meta ? Math.round((feitas / meta) * 100) : null,
    revisoes_atrasadas: parou ? 8 : h % 5 === 0 ? 3 : 0, revisoes_de_hoje: h % 4, dias_sem_questao: parou ? 9 : h % 3,
  };
}

const RADAR_DO_MOCK: Record<string, [string, string][]> = {
  'a-rafael': [['sem_questoes_7d', '9 dias sem responder questão'], ['meta_baixa_2_semanas', 'Abaixo de 50% da meta nas 2 últimas semanas'], ['revisoes_atrasadas', '8 revisões atrasadas'], ['queda_de_acerto', 'Acerto caiu de 71% para 58%']],
};

function estudo(ctx: ContextoDoMock, id: string) {
  const parou = id === 'a-rafael';
  return {
    gerado_em: new Date(ctx.agora).toISOString(),
    simulados: {
      total_finalizados: 3,
      finalizados: [
        { id: 'e1', titulo: 'Simulado Nacional 07', finalizado_em: iso(ctx, 24 * 11), nota: 62, acertos: 62, erros: 38 },
        { id: 'e2', titulo: 'USP 2024', finalizado_em: iso(ctx, 24 * 25), nota: 66, acertos: 66, erros: 34 },
        { id: 'e3', titulo: 'SES-PE 2025', finalizado_em: iso(ctx, 24 * 40), nota: 71, acertos: 71, erros: 29 },
      ],
      parados: parou ? [{ id: 'e4', titulo: 'Simulado Nacional 08', comecou_em: iso(ctx, 24 * 4) }] : [],
    },
    desempenho: {
      por_area: { rows: [{ label: 'Cardiologia', answered: 120, correct: 62, accuracy: 51.7, is_significant: true, delta: -6 }, { label: 'Pediatria', answered: 90, correct: 58, accuracy: 64.4, is_significant: true, delta: 2 }, { label: 'Cirurgia', answered: 140, correct: 99, accuracy: 70.7, is_significant: true, delta: 4 }] },
      por_tema: { rows: [] },
    },
    caderno_de_erros: {
      total: 46, ultimos_30_dias: 18,
      por_motivo: [{ motivo: 'falta_de_conteudo', rotulo: 'Falta de conteúdo', total: 21 }, { motivo: 'desatencao', rotulo: 'Desatenção', total: 14 }, { motivo: 'sem_motivo', rotulo: 'Sem motivo informado', total: 11 }],
      por_area: [{ area: 'Clínica Médica', total: 24 }, { area: 'Pediatria', total: 12 }, { area: 'Cirurgia', total: 10 }],
    },
    flashcards: { cartoes_agendados: 210, atrasados: parou ? 34 : 4, para_hoje: 12, sessoes_ultimos_14_dias: parou ? 0 : 7, ultima_sessao_em: parou ? iso(ctx, 24 * 15) : iso(ctx, 20), avaliacoes_ultimos_30_dias: { facil: 40, medio: 22, dificil: 9 }, minutos_na_semana: parou ? 0 : 85 },
    foco: { registra_sessoes: false, rotinas: [{ nome: 'Manhã de plantão', minutos_de_foco: 25, minutos_de_pausa: 5, rodadas: 4 }] },
  };
}

export function responderAcompanhamento(ctx: ContextoDoMock, p: string, metodo: string, url: URL, init: RequestInit): Response | null {
  semear(ctx);
  const { json, quem } = ctx;
  const corpo = () => (init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {});
  const sessaoId = new Headers(init.headers as HeadersInit).get('X-Ver-Como');
  const nome = (id: string) => ctx.alunos.find(a => a[0] === id)?.[1] ?? '';
  const admin = quem.role === 'admin';
  const naoAtende = () => json({ error: 'Você não atende este aluno.' }, 403);

  // O servidor é a trava do "ver como": escrita e aluno de fora da carteira são recusados antes de qualquer rota.
  let sessao: Sessao | undefined;
  if (sessaoId) {
    sessao = sessoes.find(s => s.id === sessaoId && s.admin_id === quem.user);
    const vencida = !sessao || !!sessao.ended_at || ctx.agora - Date.parse(sessao.last_seen_at) > 30 * 60_000;
    if (vencida) return json({ error: 'Esta sessão de "ver como" terminou. Abra outra para continuar.', code: 'ver_como_encerrado' }, 403);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(metodo)) return json({ error: 'Em "ver como" o portal é somente leitura.', code: 'ver_como_somente_leitura' }, 403);
    const aluno = p.match(/^\/mentoring\/students\/([^/]+)\//)?.[1];
    const fora = (aluno && ctx.alunos.find(a => a[0] === aluno)?.[2] !== sessao!.mentor_id) || (url.searchParams.get('mentor_id') && url.searchParams.get('mentor_id') !== sessao!.mentor_id);
    if (fora) return json({ error: 'Esta sessão de "ver como" não cobre este aluno nem esta carteira.', code: 'ver_como_fora_do_escopo' }, 403);
    sessao!.last_seen_at = new Date(ctx.agora).toISOString();
    const aluno_id = aluno ?? null;
    sessao!.events.unshift({ at: sessao!.last_seen_at, method: metodo, route: p.startsWith('/mentoring/carteira') ? 'mentoring-carteira' : p.endsWith('/estudo/') ? 'mentoring-student-estudo' : p.endsWith('/contatos/') ? 'mentoring-contatos' : p.endsWith('/plano/') ? 'mentoring-plano' : 'mentoring-outra', student_id: aluno_id, student_name: aluno_id ? nome(aluno_id) : null });
  }

  if (p === '/mentoring/carteira/') {
    const alvo = url.searchParams.get('mentor_id');
    const lista = alvo ? ctx.alunos.filter(a => a[2] === alvo) : ctx.escopo();
    const results = lista.map(a => ({ id: a[0], nome: a[1], email: `${a[0].slice(2)}@exemplo.com`, indicadores: indicadores(a[0]), motivos: (RADAR_DO_MOCK[a[0]] ?? []).map(([codigo, texto]) => ({ codigo, texto })), simulado_parado: null }));
    return json({ gerado_em: new Date(ctx.agora).toISOString(), total_no_escopo: lista.length, total_em_risco: 0, total_da_busca: lista.length, pagina: 1, por_pagina: 200, total_de_paginas: 1, results });
  }

  const doAluno = p.match(/^\/mentoring\/students\/([^/]+)\/(estudo|contatos|notas|plano)\/$/);
  if (doAluno) {
    const [, id, recurso] = doAluno as unknown as [string, string, string];
    if (!ctx.atende(id)) return naoAtende();
    const meu = ctx.escopo().some(a => a[0] === id);
    if (recurso === 'estudo') return json(estudo(ctx, id));
    if (recurso === 'contatos') {
      if (metodo === 'POST') {
        if (!meu) return naoAtende();
        const b = corpo();
        if (!b.resumo || !b.canal) return json({ error: !b.canal ? 'Informe o canal do contato.' : 'Informe o resumo do contato.' }, 400);
        const c: Contato = { id: novoId(), student_id: id, author_id: quem.user, author_name: ctx.nomeDoMentor[quem.user] ?? '', channel: String(b.canal), occurred_at: String(b.ocorreu_em ?? new Date(ctx.agora).toISOString()), duration_min: (b.duracao_min as number | null) ?? null, summary: String(b.resumo), mood: (b.humor as string | null) ?? null, created_at: new Date(ctx.agora).toISOString() };
        contatos.unshift(c);
        for (const passo of (b.proximos_passos as { titulo: string; prazo?: string }[] | undefined) ?? []) pendencias.push({ id: novoId(), owner_id: quem.user, student_id: id, student_name: nome(id), kind: 'tarefa', channel: null, title: passo.titulo, due_at: passo.prazo ? `${passo.prazo}T23:59:00-03:00` : null, done_at: null, source_contact_id: c.id, created_at: c.created_at });
        const prox = b.proximo_contato as { quando: string; canal?: string } | undefined;
        if (prox) pendencias.push({ id: novoId(), owner_id: quem.user, student_id: id, student_name: nome(id), kind: 'contato', channel: prox.canal ?? c.channel, title: `Contato com ${nome(id).split(' ')[0]}`, due_at: prox.quando, done_at: null, source_contact_id: c.id, created_at: c.created_at });
        return json(c, 201);
      }
      return json({ results: contatos.filter(c => c.student_id === id).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)) });
    }
    if (recurso === 'notas') {
      // Anotação é só do autor: o administrador leva 403, com ou sem "ver como".
      if (admin || !meu) return json({ error: admin ? 'As anotações privadas são só de quem as escreveu.' : 'Você não atende este aluno.' }, 403);
      if (metodo === 'POST') { const b = corpo(); if (!String(b.texto ?? '').trim()) return json({ error: 'Informe a anotação.' }, 400); const n: Nota = { id: novoId(), student_id: id, author_id: quem.user, body: String(b.texto), sensitive: !!b.sensivel, created_at: new Date(ctx.agora).toISOString(), updated_at: new Date(ctx.agora).toISOString() }; notas.unshift(n); return json(n, 201); }
      return json({ results: notas.filter(n => n.student_id === id && n.author_id === quem.user) });
    }
    if (recurso === 'plano') {
      if (metodo === 'POST') {
        if (!meu) return naoAtende();
        const b = corpo();
        if (!String(b.titulo ?? '').trim()) return json({ error: 'Informe o título do objetivo.' }, 400);
        const o: Obj = { id: novoId(), student_id: id, author_id: quem.user, author_name: ctx.nomeDoMentor[quem.user] ?? '', title: String(b.titulo), detail: String(b.detalhe ?? ''), due_date: (b.prazo as string | null) ?? null, progress: Number(b.progresso ?? 0), done_at: null, created_at: new Date(ctx.agora).toISOString(), updated_at: new Date(ctx.agora).toISOString() };
        objetivos.push(o);
        return json(o, 201);
      }
      return json({ results: objetivos.filter(o => o.student_id === id) });
    }
  }

  const contato = p.match(/^\/mentoring\/contatos\/([^/]+)\/$/);
  if (contato) {
    const i = contatos.findIndex(c => c.id === contato[1]);
    if (i < 0) return json({ error: 'Registro não encontrado.' }, 404);
    if (contatos[i]!.author_id !== quem.user) return json({ error: 'Só quem escreveu pode alterar ou apagar.' }, 403);
    if (metodo === 'DELETE') { contatos.splice(i, 1); return json(undefined, 204); }
  }

  const nota = p.match(/^\/mentoring\/notas\/([^/]+)\/$/);
  if (nota) {
    const n = notas.find(x => x.id === nota[1]);
    if (!n || n.author_id !== quem.user) return json({ error: 'Registro não encontrado.' }, 404);
    if (metodo === 'DELETE') { notas.splice(notas.indexOf(n), 1); return json(undefined, 204); }
    if (metodo === 'PATCH') { n.body = String(corpo().texto ?? n.body); n.updated_at = new Date(ctx.agora + 1000).toISOString(); return json(n); }
  }

  if (p === '/mentoring/pendencias/') {
    if (metodo === 'POST') {
      const b = corpo();
      if (!String(b.titulo ?? '').trim()) return json({ error: 'Informe o título.' }, 400);
      if (b.tipo === 'contato' && !b.para_quando) return json({ error: 'Um contato agendado precisa de data e hora.' }, 400);
      if (b.aluno_id && !ctx.escopo().some(a => a[0] === b.aluno_id)) return naoAtende();
      const t: Pend = { id: novoId(), owner_id: quem.user, student_id: (b.aluno_id as string | null) ?? null, student_name: b.aluno_id ? nome(String(b.aluno_id)) : null, kind: String(b.tipo ?? 'tarefa'), channel: (b.canal as string | null) ?? null, title: String(b.titulo), due_at: (b.para_quando as string | null) ?? null, done_at: null, source_contact_id: null, created_at: new Date(ctx.agora).toISOString() };
      pendencias.push(t);
      return json(t, 201);
    }
    const feitas = url.searchParams.get('feitas'), aluno = url.searchParams.get('aluno_id');
    const lista = pendencias.filter(t => t.owner_id === quem.user && (feitas === null || (feitas === 'true') === !!t.done_at) && (!aluno || t.student_id === aluno));
    return json({ results: lista.sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')) });
  }
  const pend = p.match(/^\/mentoring\/pendencias\/([^/]+)\/$/);
  if (pend) {
    const t = pendencias.find(x => x.id === pend[1]);
    if (!t || t.owner_id !== quem.user) return json({ error: 'Registro não encontrado.' }, 404);
    if (metodo === 'DELETE') { pendencias.splice(pendencias.indexOf(t), 1); return json(undefined, 204); }
    if (metodo === 'PATCH') { const b = corpo(); if ('feita' in b) t.done_at = b.feita ? new Date(ctx.agora).toISOString() : null; return json(t); }
  }

  const obj = p.match(/^\/mentoring\/plano\/([^/]+)\/$/);
  if (obj) {
    const o = objetivos.find(x => x.id === obj[1]);
    if (!o) return json({ error: 'Registro não encontrado.' }, 404);
    if (!ctx.escopo().some(a => a[0] === o.student_id)) return naoAtende();
    if (metodo === 'DELETE') { if (o.author_id !== quem.user) return json({ error: 'Só quem escreveu pode alterar ou apagar.' }, 403); objetivos.splice(objetivos.indexOf(o), 1); return json(undefined, 204); }
    if (metodo === 'PATCH') {
      const b = corpo();
      if ('progresso' in b) o.progress = Number(b.progresso);
      if ('concluido' in b) { o.done_at = b.concluido ? new Date(ctx.agora).toISOString() : null; if (b.concluido) o.progress = 100; }
      return json(o);
    }
  }

  if (p === '/mentoring/ver-como/' && metodo === 'POST') {
    if (!admin) return json({ error: 'Só administradores usam o "ver como".' }, 403);
    const b = corpo();
    const motivos = ['suporte', 'qualidade', 'denuncia', 'lgpd', 'outro'];
    if (!motivos.includes(String(b.motivo))) return json({ error: `Informe o motivo: ${motivos.join(', ')}.` }, 400);
    if (b.motivo === 'outro' && !String(b.detalhe ?? '').trim()) return json({ error: 'Descreva o motivo em "outro".' }, 400);
    if (!ctx.nomeDoMentor[String(b.mentor_id)] || b.mentor_id === quem.user) return json({ error: 'Escolha um mentor (submentor não tem carteira própria), que não seja você.' }, 400);
    const s: Sessao = { id: novoId(), admin_id: quem.user, admin_name: ctx.nomeDoMentor[quem.user] ?? 'Administrador', mentor_id: String(b.mentor_id), mentor_name: ctx.nomeDoMentor[String(b.mentor_id)]!, reason: String(b.motivo), detail: String(b.detalhe ?? ''), started_at: new Date(ctx.agora).toISOString(), last_seen_at: new Date(ctx.agora).toISOString(), ended_at: null, ip_address: '127.0.0.1', events: [] };
    sessoes.unshift(s);
    return json({ id: s.id, mentor_id: s.mentor_id, started_at: s.started_at, expires_after_idle_seconds: 1800 }, 201);
  }
  const encerrar = p.match(/^\/mentoring\/ver-como\/([^/]+)\/encerrar\/$/);
  if (encerrar && metodo === 'POST') {
    const s = sessoes.find(x => x.id === encerrar[1] && x.admin_id === quem.user);
    if (!s) return json({ error: 'Sessão não encontrada.' }, 404);
    s.ended_at ??= new Date(ctx.agora).toISOString();
    return json(undefined, 204);
  }
  if (p === '/mentoring/ver-como/auditoria/') {
    if (!admin) return json({ error: 'Só administradores usam o "ver como".' }, 403);
    return json({ results: sessoes.map(s => ({ ...s, accesses: s.events.length, events: undefined })) });
  }
  const detalhe = p.match(/^\/mentoring\/ver-como\/([^/]+)\/auditoria\/$/);
  if (detalhe) {
    if (!admin) return json({ error: 'Só administradores usam o "ver como".' }, 403);
    const s = sessoes.find(x => x.id === detalhe[1]);
    if (!s) return json({ error: 'Sessão não encontrada.' }, 404);
    return json({ session: { ...s, accesses: s.events.length, events: undefined }, events: s.events });
  }
  return null;
}
