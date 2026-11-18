/**
 * Elitinho de apoio ao mentor (serviço à parte, mesmo token). DESLIGADO por decisão de LGPD:
 * só aparece com `FEATURES.elitinhoDoMentor` E com o serviço dizendo `mentor_assistant: true`.
 * O copiloto só lê (carteira, estudo, contatos, plano, agenda); nunca escreve nada.
 */
import { ELITINHO_API_URL } from '@/config';
import { ApiError, extrairErro } from '@/lib/http';
import { fetchWithAuth } from '@/lib/session';

export interface CapacidadesDoElitinho { mentor_assistant: boolean; remaining_today: number; daily_limit: number }

export async function getCapacidades(): Promise<CapacidadesDoElitinho> {
  const r = await fetchWithAuth(`${ELITINHO_API_URL}/elitinho/v1/capabilities`);
  if (!r.ok) throw new ApiError(extrairErro(await r.json().catch(() => null), r.status), r.status);
  const c = await r.json() as Partial<CapacidadesDoElitinho>;
  return { mentor_assistant: c.mentor_assistant === true, remaining_today: c.remaining_today ?? 0, daily_limit: c.daily_limit ?? 0 };
}

export type EventoDoElitinho =
  | { tipo: 'conversation'; id: string }
  | { tipo: 'tool'; label: string }
  | { tipo: 'delta'; texto: string }
  | { tipo: 'done'; restantes: number | null }
  | { tipo: 'error'; detalhe: string };

/**
 * Lê eventos SSE de um pedaço de texto. Devolve os eventos completos e o resto ainda
 * incompleto, para o próximo pedaço continuar dali. Evento desconhecido ou JSON ruim é ignorado.
 */
export function lerEventos(buffer: string): { eventos: EventoDoElitinho[]; resto: string } {
  const blocos = buffer.split(/\r?\n\r?\n/);
  const resto = blocos.pop() ?? '';
  const eventos: EventoDoElitinho[] = [];
  for (const bloco of blocos) {
    let nome = '', dados = '';
    for (const linha of bloco.split(/\r?\n/)) {
      if (linha.startsWith('event:')) nome = linha.slice(6).trim();
      else if (linha.startsWith('data:')) dados += linha.slice(5).trim();
    }
    let d: Record<string, unknown>;
    try { d = JSON.parse(dados) as Record<string, unknown>; } catch { continue; }
    if (nome === 'conversation' && typeof d.id === 'string') eventos.push({ tipo: 'conversation', id: d.id });
    else if (nome === 'tool' && typeof d.label === 'string') eventos.push({ tipo: 'tool', label: d.label });
    else if (nome === 'delta' && typeof d.text === 'string') eventos.push({ tipo: 'delta', texto: d.text });
    else if (nome === 'done') eventos.push({ tipo: 'done', restantes: typeof d.remaining_today === 'number' ? d.remaining_today : null });
    else if (nome === 'error') eventos.push({ tipo: 'error', detalhe: typeof d.detail === 'string' ? d.detail : 'O Elitinho não conseguiu responder.' });
  }
  return { eventos, resto };
}

/** Manda uma mensagem e entrega os eventos conforme chegam. Erros antes do stream sobem como `ApiError`. */
export async function conversar(mensagem: string, conversaId: string | null, aoEvento: (e: EventoDoElitinho) => void, sinal?: AbortSignal): Promise<void> {
  const r = await fetchWithAuth(`${ELITINHO_API_URL}/elitinho/v1/chat/messages`, {
    method: 'POST', signal: sinal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    // `accepts_drafts: false`: o copiloto do mentor não tem prévias nem escreve nada.
    body: JSON.stringify({ message: mensagem, conversation_id: conversaId, accepts_drafts: false }),
  });
  if (!r.ok || !r.body) {
    const corpo = await r.json().catch(() => null) as { detail?: string } | null;
    throw new ApiError(corpo?.detail ?? extrairErro(corpo, r.status), r.status);
  }
  const leitor = r.body.getReader(), decodificador = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    buffer += decodificador.decode(value, { stream: true });
    const { eventos, resto } = lerEventos(buffer);
    buffer = resto;
    eventos.forEach(aoEvento);
  }
}
