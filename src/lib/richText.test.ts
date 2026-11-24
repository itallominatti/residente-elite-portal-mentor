import { describe, expect, it } from 'vitest';
import { sanitizarTextoRico, textoPuro } from '@/lib/richText';

describe('sanitizarTextoRico', () => {
  it('mantém a formatação permitida', () => {
    expect(sanitizarTextoRico('<p>Texto com <strong>negrito</strong> e <em>itálico</em></p><ul><li>a</li></ul>')).toBe('<p>Texto com <strong>negrito</strong> e <em>itálico</em></p><ul><li>a</li></ul>');
  });

  it('descarta script, style e iframe com o conteúdo', () => {
    expect(sanitizarTextoRico('<p>ok</p><script>alert(1)</script><style>p{}</style><iframe src="https://x"></iframe>')).toBe('<p>ok</p>');
  });

  it('tag desconhecida perde a marcação e fica o texto', () => {
    expect(sanitizarTextoRico('<div><span style="color:red">texto</span></div>')).toBe('texto');
  });

  it('tira atributos de evento e estilo, e deixa só os permitidos', () => {
    expect(sanitizarTextoRico('<p onclick="x()" style="color:red" class="a">oi</p>')).toBe('<p>oi</p>');
    expect(sanitizarTextoRico('<table><tr><td colspan="2" onclick="x()">c</td><td colspan="99">d</td></tr></table>')).toContain('<td colspan="2">c</td><td>d</td>');
  });

  it('imagem só com https; a outra sai inteira', () => {
    const boa = sanitizarTextoRico('<img src="https://cdn.exemplo.com/videos/questions/a.png" alt="ECG" onerror="x()">');
    expect(boa).toContain('src="https://cdn.exemplo.com/videos/questions/a.png"');
    expect(boa).toContain('alt="ECG"');
    expect(boa).not.toContain('onerror');
    expect(sanitizarTextoRico('<img src="http://inseguro.com/a.png">')).toBe('');
    expect(sanitizarTextoRico('<img src="javascript:alert(1)">')).toBe('');
    expect(sanitizarTextoRico('<img alt="sem src">')).toBe('');
  });

  it('vazio e nulo viram texto vazio', () => {
    expect(sanitizarTextoRico(null)).toBe('');
    expect(sanitizarTextoRico('')).toBe('');
  });
});

describe('textoPuro', () => {
  it('sem tags, espaço colapsado e cortado', () => {
    expect(textoPuro('<p>Lactente  com <b>febre</b></p><p>há 3 dias</p>')).toBe('Lactente com febre há 3 dias');
    expect(textoPuro('<p>' + 'palavra '.repeat(60) + '</p>', 50).length).toBeLessThanOrEqual(50);
    expect(textoPuro('<p>x</p><script>y</script>')).toBe('x');
    expect(textoPuro(null)).toBe('');
  });
});
