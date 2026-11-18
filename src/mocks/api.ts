/**
 * API de mentira, SÓ para desenvolvimento (`VITE_MOCK_API=true npm run dev`).
 * Intercepta o `fetch` para a URL da API e responde com dados fictícios nos
 * mesmos formatos do elite-med-back-end. Nunca entra no build de produção:
 * `main.tsx` só a importa quando `import.meta.env.DEV`.
 *
 * Entrar: qualquer senha. E-mail começando com "admin" entra como admin;
 * "vazio" entra como mentora sem mentorandos; o resto, como a Dra. Ana.
 */
import { API_BASE_URL, FEATURES } from '@/config';
import { responderAcompanhamento } from '@/mocks/acompanhamento';

const ANA = 'm-ana', PEDRO = 'm-pedro', HELENA = 'm-helena', ADMIN = 'u-admin';
const agora = Date.now();
const iso = (horasAtras: number) => new Date(agora - horasAtras * 3600_000).toISOString();

const ALUNOS: [string, string, string][] = [
  ['a-rafael', 'Rafael Teixeira', ANA], ['a-camila', 'Camila Duarte', ANA], ['a-bruno', 'Bruno Albuquerque', ANA], ['a-natalia', 'Natália Freitas', ANA],
  ['a-leticia', 'Letícia Moura', ANA], ['a-amanda', 'Amanda Queiroz', ANA], ['a-marina', 'Marina Ribeiro', ANA], ['a-thiago', 'Thiago Farias', ANA],
  ['a-juliana', 'Juliana Pires', ANA], ['a-isabela', 'Isabela Cunha', ANA], ['a-lucas', 'Lucas Pimentel', PEDRO], ['a-sofia', 'Sofia Bastos', PEDRO],
];
const nomeDoMentor: Record<string, string> = { [ANA]: 'Dra. Ana Souza', [PEDRO]: 'Dr. Pedro Lima', [HELENA]: 'Dra. Helena Prado', [ADMIN]: 'Rodrigo Campos' };

const RADAR: Record<string, [string, string][]> = {
  'a-rafael': [['sem_questoes_7d', '9 dias sem responder questão'], ['meta_baixa_2_semanas', 'Abaixo de 50% da meta nas 2 últimas semanas'], ['revisoes_atrasadas', '8 revisões atrasadas'], ['queda_de_acerto', 'Acerto caiu de 71% para 58%']],
  'a-camila': [['queda_de_acerto', 'Acerto caiu de 74% para 61%'], ['revisoes_atrasadas', '3 revisões atrasadas']],
  'a-bruno': [['sem_questoes_7d', '8 dias sem responder questão']],
  'a-leticia': [['revisoes_atrasadas', '6 revisões atrasadas']],
  'a-amanda': [['queda_de_acerto', 'Acerto caiu de 73% para 63%']],
  'a-lucas': [['simulado_abandonado', 'Simulado parado há 2 dias']],
};
const CONVERSAS: Record<string, [number, boolean, string, number]> = { // horas atrás, última é do aluno?, prévia, não lidas
  'a-rafael': [14, true, 'Dra., estou meio desanimado. Fiquei quase 10 dias sem estudar…', 1],
  'a-camila': [50, true, 'Posso trocar o horário da nossa conversa?', 1],
  'a-bruno': [75, true, 'Dra., consegui ver as aulas de trauma mas…', 1],
  'a-marina': [30, false, 'Ótimo avanço no simulado de sábado!', 0],
  'a-thiago': [120, false, 'Perfeito, seguimos assim.', 0],
  'a-juliana': [8, false, 'Obrigada, Dra.! Vou revisar hoje.', 0],
  'a-leticia': [96, false, 'Combinado, me avisa na sexta.', 0],
  'a-lucas': [20, true, 'Dr., o simulado travou na questão 40', 1],
};
const mensagens: Record<string, { id: string; author_id: string; author_name: string; body: string; created_at: string }[]> = {
  't-a-rafael': [
    { id: '1', author_id: ANA, author_name: 'Dra. Ana Souza', body: 'Rafael, vi o simulado 07 (62%). A queda veio mais de Cardiologia. Vamos olhar juntos?', created_at: iso(260) },
    { id: '2', author_id: 'a-rafael', author_name: 'Rafael Teixeira', body: 'Pode ser, Dra. Só que essa semana está puxada com os plantões.', created_at: iso(240) },
    { id: '3', author_id: ANA, author_name: 'Dra. Ana Souza', body: 'Sem problema. Me manda quando tiver uma janela.', created_at: iso(215) },
    { id: '4', author_id: 'a-rafael', author_name: 'Rafael Teixeira', body: 'Dra., estou meio desanimado. Fiquei quase 10 dias sem estudar por causa dos plantões e agora a lista de revisões assusta. Será que ainda dá tempo para a USP?', created_at: iso(14) },
  ],
};
const metas: Record<string, { weekly_questions: number; weekly_hours: number | null; set_by_name: string; updated_at: string } | null> = {
  'a-rafael': { weekly_questions: 150, weekly_hours: 10, set_by_name: 'Dra. Ana Souza', updated_at: iso(1000) },
};

type Ctx = { user: string; role: string };
let quem: Ctx = { user: ANA, role: 'mentor' };
try { const s = sessionStorage.getItem('mock_user'); if (s) quem = JSON.parse(s); } catch { /* sem storage */ }

const escopo = () => quem.role === 'admin' ? ALUNOS : ALUNOS.filter(a => a[2] === quem.user);
const json = (body: unknown, status = 200) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const atende = (aluno: string) => quem.role === 'admin' || escopo().some(a => a[0] === aluno);

function thread(a: [string, string, string]) {
  const c = CONVERSAS[a[0]];
  return { id: c ? `t-${a[0]}` : null, student_id: a[0], student_name: a[1], mentor_id: a[2], mentor_name: nomeDoMentor[a[2]], last_message_at: c ? iso(c[0]) : null, last_message_preview: c?.[2] ?? '', last_message_author_is_student: c?.[1] ?? false, unread_count: c?.[3] ?? 0, can_write: quem.role !== 'admin' || a[2] === quem.user };
}

async function responder(url: URL, init: RequestInit): Promise<Response> {
  const p = url.pathname.replace(new URL(API_BASE_URL).pathname, '');
  const metodo = (init.method ?? 'GET').toUpperCase();
  await new Promise(r => setTimeout(r, 120));

  if (p === '/auth/login/') {
    const { email } = JSON.parse(String(init.body));
    quem = String(email).startsWith('admin') ? { user: ADMIN, role: 'admin' } : String(email).startsWith('vazio') ? { user: HELENA, role: 'mentor' } : { user: ANA, role: 'mentor' };
    try { sessionStorage.setItem('mock_user', JSON.stringify(quem)); } catch { /* idem */ }
    return json({ access_token: 'mock', refresh_token: 'mock', user_id: quem.user, email, role: quem.role });
  }
  if (p === '/mentoring/tree/') {
    const mentors = [ANA, PEDRO, HELENA].map(id => ({ id, full_name: nomeDoMentor[id], email: `${id}@exemplo.com`, role: 'mentor', alunos_count: ALUNOS.filter(a => a[2] === id).length, submentores: id === ANA ? [{ id: 's-marcos', full_name: 'Dr. Marcos Vidal', email: 'marcos@exemplo.com' }] : [] }));
    return json({ mentors: quem.role === 'admin' ? mentors : mentors.filter(m => m.id === quem.user) });
  }
  if (p === '/mentoring/students/') return json({ data: escopo().map(a => ({ id: a[0], full_name: a[1], email: `${a[0].slice(2)}@exemplo.com`, mentorships: [{ mentorship_id: `v-${a[0]}`, mentor_id: a[2], mentor_name: nomeDoMentor[a[2]] }] })), meta: { has_next: false, page: 1, total_pages: 1, count: escopo().length } });
  if (p === '/mentoring/radar/') {
    const results = escopo().filter(a => RADAR[a[0]]).map(a => ({ id: a[0], nome: a[1], email: '', motivos: RADAR[a[0]]!.map(([codigo, texto]) => ({ codigo, texto })), resumo: ['Semana: 0 de 150 questões', '14 dias: 41 questões, 58% de acerto', 'Revisões: 8 atrasadas, 2 para hoje', 'Último simulado: Simulado Nacional 07, 62%', 'Temas críticos: Sepse, Arritmias'], rascunho: `Oi, ${a[1].split(' ')[0]}! Vi que a semana foi puxada. Quer conversar sobre como reorganizar o plano?`, conversa_id: CONVERSAS[a[0]] ? `t-${a[0]}` : null, ultima_mensagem_do_ramo_em: iso(260), pode_escrever: quem.role !== 'admin' }));
    return json({ gerado_em: iso(2), total_no_escopo: escopo().length, total_em_risco: results.length, pagina: 1, total_de_paginas: 1, results });
  }
  const meta = p.match(/^\/mentoring\/students\/([^/]+)\/goal\/$/);
  if (meta) {
    const id = meta[1]!;
    if (!atende(id)) return json({ error: 'Você não atende este aluno.' }, 403);
    if (metodo === 'PUT') { const b = JSON.parse(String(init.body)); metas[id] = { ...b, set_by_name: nomeDoMentor[quem.user], updated_at: new Date().toISOString() }; return json({ goal: metas[id] }); }
    if (metodo === 'DELETE') { metas[id] = null; return json(undefined, 204); }
    return json({ goal: metas[id] ?? null, min: 1, max: 3000, min_hours: 1, max_hours: 80 });
  }
  if (p === '/mentoring/chat/threads/') return json({ data: escopo().map(thread), meta: { count: 0, has_next: false, page: 1 } });
  if (p === '/mentoring/chat/threads/open/') { const { student_id } = JSON.parse(String(init.body)); const a = ALUNOS.find(x => x[0] === student_id); if (!a || !atende(a[0])) return json({ error: 'Você não atende este aluno.' }, 403); CONVERSAS[a[0]] ??= [0, false, '', 0]; return json(thread(a), 201); }
  const msg = p.match(/^\/mentoring\/chat\/threads\/([^/]+)\/(messages|read)\/$/);
  if (msg) {
    const id = msg[1]!;
    if (msg[2] === 'read') return json(undefined, 204);
    if (metodo === 'POST') { const nova = { id: String(Date.now()), author_id: quem.user, author_name: nomeDoMentor[quem.user], body: JSON.parse(String(init.body)).body, created_at: new Date().toISOString() }; (mensagens[id] ??= []).push(nova); const al = id.slice(2); if (CONVERSAS[al]) CONVERSAS[al] = [0, false, nova.body.slice(0, 80), 0]; return json(nova, 201); }
    return json({ results: mensagens[id] ?? [] });
  }
  if (p === '/revision/calendar-items/') {
    const id = url.searchParams.get('user_id') ?? '';
    if (!atende(id)) return json({ error: 'Você não atende este aluno.' }, 403);
    const parou = id === 'a-rafael';
    const items = [3, 6, 9, 13, 15, 20, 24, 31, 38, 45, 52, 60].filter(d => !parou || d > 9).map((d, i) => ({ kind: i % 3 ? 'isolated_revision' : 'registered_simulado', id: `c${i}`, date: new Date(agora - d * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), occurred_at: iso(d * 24 + 3), title: ['Simulado Nacional 07', 'Sepse', 'Arritmias', 'Simulado USP 2024', 'Pneumonia', 'Insuficiência cardíaca', 'Simulado Nacional 06', 'Trauma', 'Apendicite', 'Simulado Nacional 05', 'Bronquiolite', 'Pré-eclâmpsia'][i], theme_id: null, category_name: i % 3 ? 'Clínica Médica' : null, questions_total: i % 3 ? 20 : 100, questions_correct: i % 3 ? 11 + (i % 6) : 62 + i, accuracy_percentage: i % 3 ? (11 + (i % 6)) * 5 : 62 + i }));
    return json({ timezone: 'America/Sao_Paulo', start: url.searchParams.get('start') ?? '', end: url.searchParams.get('end') ?? '', items });
  }
  if (/^\/revision\/students\/[^/]+\/resets\/$/.test(p)) return json({ results: p.includes('a-rafael') ? [{ id: 'r1', reset_at: iso(900), themes_restarted: 12, schedules_pending_removed: 18, mentor_suggestions_removed: 0 }] : [] });
  if (p === '/revision/evolution/') {
    const id = url.searchParams.get('user_id') ?? '';
    if (!atende(id)) return json({ error: 'Você não atende este aluno.' }, 403);
    // Rafael parou há 9 dias; os outros têm uma rotina regular. Contatos datados por dia, para o gráfico semanal e a constância.
    const parou = id === 'a-rafael';
    const contacts = (tema: string, base: number) => Array.from({ length: 84 }, (_, d) => d).filter(d => (d * 7 + tema.length) % 3 !== 0 && (!parou || d > 9) && new Date(agora - d * 86400000).getDay() !== 4)
      .map(d => { const feitas = 6 + ((d * 5 + base) % 17); const certas = Math.round(feitas * Math.max(0.35, (parou ? 0.72 - Math.max(0, 40 - d) * 0.004 * (d < 40 ? 1 : 0) - (d < 26 ? 0.1 : 0) : 0.68) + ((d % 5) - 2) * 0.02)); return { id: `${tema}${d}`, contact_type: 'rp1', contact_date: new Date(agora - d * 86400000 - 3 * 3600000).toISOString(), questions_done: feitas, questions_correct: certas, accuracy_percentage: Math.round((certas / feitas) * 100) }; });
    const tema = (nome: string, area: string, base: number) => { const cs = contacts(nome, base); const f = cs.reduce((x, c) => x + c.questions_done, 0), c = cs.reduce((x, k) => x + k.questions_correct, 0); return { theme_id: nome, theme_name: nome, theme_weight: 'A', category_id: area, category_name: area, total_contacts: cs.length, total_questions_done: f, total_questions_correct: c, overall_accuracy: f ? (c / f) * 100 : 0, current_stage: 'primeira', next_scheduled_date: null, schedules: [], contacts: cs }; };
    const results = [tema('Sepse', 'Clínica Médica', 3), tema('Arritmias', 'Clínica Médica', 7), tema('Pneumonia', 'Clínica Médica', 1), tema('Trauma', 'Cirurgia', 5), tema('Apendicite', 'Cirurgia', 2), tema('Bronquiolite', 'Pediatria', 9), tema('Pré-eclâmpsia', 'Ginecologia e Obstetrícia', 4)];
    const f = results.reduce((x, r) => x + r.total_questions_done, 0), c = results.reduce((x, r) => x + r.total_questions_correct, 0);
    return json({ count: results.length, page: 1, page_size: 50, total_pages: 1, summary: { total_themes: results.length, total_questions_done: f, total_questions_correct: c, overall_accuracy: f ? (c / f) * 100 : 0, total_schedules_completed: 88, total_schedules_pending: 14 }, results });
  }
  if (p === '/revision/priority-themes/') return json({ summary: { critico: 2, prioritario: 3, suporte_secundario: 9, total_evaluated: 14 }, levels: [{ key: 'critico', title: 'Crítico', count: 2, themes: [{ theme_id: 't1', theme_name: 'Sepse', category_name: 'Clínica Médica', total_questions_done: 38, overall_accuracy: 41 }, { theme_id: 't2', theme_name: 'Arritmias', category_name: 'Clínica Médica', total_questions_done: 44, overall_accuracy: 48 }] }] });
  if (p === '/revision/schedules/') return json([{ id: 's1', theme_name: 'Sepse', stage: 'primeira', scheduled_date: '2026-11-01', completed: false }, { id: 's2', theme_name: 'DPOC', stage: 'segunda', scheduled_date: '2099-01-01', completed: false }]);
  if (FEATURES.acompanhamento) {
    const r = responderAcompanhamento({ quem, alunos: ALUNOS, nomeDoMentor, atende, escopo, json, agora: Date.now() }, p, metodo, url, init);
    if (r) return r;
  }
  return json({ detail: `Mock sem rota: ${metodo} ${p}` }, 404);
}

export function instalarApiFalsa() {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return url.href.startsWith(API_BASE_URL) ? responder(url, init) : original(input, init);
  };
  console.info('[portal] API falsa ligada (VITE_MOCK_API=true). Nada sai para o servidor.');
}
