import FingerprintJS from '@fingerprintjs/fingerprintjs';

const KEY = 'device_fp';

/** Identificador do aparelho para o limite de dispositivos do login (opcional no servidor). */
export async function getOrCreateFingerprint(): Promise<string | undefined> {
  try {
    const salvo = localStorage.getItem(KEY);
    if (salvo) return salvo;
  } catch { /* storage bloqueado */ }
  try {
    // `monitoring: false`: sem isto a biblioteca manda uma amostra para openfpcdn.io (e a CSP a bloquearia).
    const fp = await (await FingerprintJS.load({ monitoring: false })).get();
    try { localStorage.setItem(KEY, fp.visitorId); } catch { /* idem */ }
    return fp.visitorId;
  } catch {
    // Sem identificador o servidor aceita o login do mesmo jeito.
    return undefined;
  }
}
