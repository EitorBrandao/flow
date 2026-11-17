// scripts/varredura/medir.mjs
// Medidas feitas dentro da página (page.evaluate). A função é serializada pelo Playwright:
// não pode importar nada nem usar variável de fora dela.

export function medir() {
  const ALVO_MINIMO = 38; // px — docs/estilo/fundamentos.md
  const FOLGA = 8;        // px — diferença pequena o bastante para ser desalinho, não desenho
  const achados = [];

  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const texto = (el) => (el.getAttribute('aria-label') || el.innerText || el.closest('label')?.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const nome = (el) => {
    const classes = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${classes ? `.${classes}` : ''} "${texto(el)}"`;
  };

  // Só o que está na frente: com um sheet aberto, a tela de trás não conta.
  const sheets = [...document.querySelectorAll('.sheet')].filter(visivel);
  const raiz = sheets.length ? sheets[sheets.length - 1] : document.body;

  // 1. Estouro lateral: a página rola para o lado.
  const sobra = document.documentElement.scrollWidth - window.innerWidth;
  if (sobra > 1) achados.push({ tipo: 'estouro', alvo: 'página', detalhe: `${sobra}px além da largura` });

  // 2. Alvo de toque menor que o mínimo.
  for (const el of raiz.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=tab]')) {
    if (!visivel(el)) continue;
    // caixa de seleção e botão de opção: o alvo de toque é o rótulo que a envolve, não os 13px do controle
    const rotulo = ['checkbox', 'radio'].includes(el.type) ? el.closest('label') : null;
    const r = (rotulo ?? el).getBoundingClientRect();
    // input invisível por cima de um botão (.campo-data-input, .selecionar-arquivo): o alvo é o botão
    if (Number(getComputedStyle(el).opacity) === 0) continue;
    if (r.height < ALVO_MINIMO) achados.push({ tipo: 'alvo', alvo: nome(el), detalhe: `${Math.round(r.height)}px de altura` });
  }

  // 3. Alinhamento: irmãos de uma mesma coluna que começam ou terminam a poucos px um do outro.
  const colunas = raiz.querySelectorAll('.tela, .lista, .sheet-conteudo, .card');
  for (const coluna of colunas) {
    if (!visivel(coluna)) continue;
    const filhos = [...coluna.children].filter(visivel).filter((f) => getComputedStyle(f).position !== 'fixed');
    if (filhos.length < 3) continue;
    for (const lado of ['left', 'right']) {
      const medidas = filhos.map((f) => Math.round(f.getBoundingClientRect()[lado]));
      const contagem = new Map();
      for (const m of medidas) contagem.set(m, (contagem.get(m) ?? 0) + 1);
      const [moda, vezes] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
      if (vezes < 2) continue;
      filhos.forEach((f, i) => {
        const dif = Math.abs(medidas[i] - moda);
        if (dif >= 1 && dif <= FOLGA) {
          achados.push({ tipo: 'alinhamento', alvo: nome(f), detalhe: `${lado === 'left' ? 'esquerda' : 'direita'} ${dif}px fora da coluna` });
        }
      });
    }
  }

  // 4. Ação principal escondida atrás da barra de navegação ao abrir a tela.
  const barra = document.querySelector('nav.navegacao');
  if (barra && !sheets.length) {
    const topoDaBarra = barra.getBoundingClientRect().top;
    for (const el of document.querySelectorAll('main .botao-primario')) {
      if (!visivel(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > topoDaBarra) {
        achados.push({ tipo: 'primario-fora', alvo: nome(el), detalhe: `base em ${Math.round(r.bottom)}px, barra em ${Math.round(topoDaBarra)}px` });
      }
    }
  }

  return achados;
}
