/**
 * Texto rico das questões (enunciado, alternativas, comentário) para exibir no portal.
 *
 * O back-end já sanitiza ao gravar (`internal/infrastructure/sanitizer/html_sanitizer.py`); aqui se
 * repete a MESMA lista na saída, como o learner e o admin-hub fazem: o que não está na lista some, e
 * o que está só mantém os atributos permitidos. Mudou a lista no back-end, muda aqui.
 */
const TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'sub', 'sup', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img']);
/** Estas somem com o conteúdo: o texto de um <script> ou <style> não é texto para o leitor. */
const DESCARTADAS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template']);
const MAX_MESCLA = 20;

function limpar(origem: Node, destino: Node, doc: Document): void {
  origem.childNodes.forEach(no => {
    if (no.nodeType === Node.TEXT_NODE) { destino.appendChild(doc.createTextNode(no.textContent ?? '')); return; }
    if (no.nodeType !== Node.ELEMENT_NODE) return;
    const el = no as Element, tag = el.tagName.toLowerCase();
    if (DESCARTADAS.has(tag)) return;
    if (!TAGS.has(tag)) { limpar(el, destino, doc); return; } // tag desconhecida: fica o texto, sai a marcação
    if (tag === 'img') {
      const src = el.getAttribute('src') ?? '';
      if (!/^https:\/\//i.test(src)) return; // imagem sem endereço seguro sai inteira
      const img = doc.createElement('img');
      img.setAttribute('src', src);
      img.setAttribute('alt', (el.getAttribute('alt') ?? '').slice(0, 300));
      img.setAttribute('loading', 'lazy');
      img.setAttribute('referrerpolicy', 'no-referrer');
      destino.appendChild(img);
      return;
    }
    const novo = doc.createElement(tag);
    if (tag === 'th' || tag === 'td') {
      for (const a of ['colspan', 'rowspan']) {
        const n = Number(el.getAttribute(a));
        if (Number.isInteger(n) && n >= 1 && n <= MAX_MESCLA) novo.setAttribute(a, String(n));
      }
    }
    limpar(el, novo, doc);
    destino.appendChild(novo);
  });
}

export function sanitizarTextoRico(html: string | null | undefined): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const saida = doc.createElement('div');
  limpar(doc.body, saida, doc);
  return saida.innerHTML;
}

/** O texto puro, numa linha só, para o resumo de uma questão (sem imagem, tabela vira texto corrido). */
export function textoPuro(html: string | null | undefined, limite = 160): string {
  if (!html) return '';
  // Um espaço antes de cada quebra de bloco: sem ele, parágrafos vizinhos colam as palavras ("febre" + "há" = "febreha").
  const doc = new DOMParser().parseFromString(html.replace(/<\/(p|li|tr|td|th|div|blockquote)>|<br\s*\/?>/gi, ' $&'), 'text/html');
  doc.querySelectorAll('script,style').forEach(e => e.remove());
  const t = (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= limite ? t : `${t.slice(0, limite - 1).trimEnd()}…`;
}
