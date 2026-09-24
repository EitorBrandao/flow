# Navegação e texto da wiki — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** a wiki ganha uma barra de índice sempre visível, seções na gaveta, busca com trecho e texto mais sucinto.

**Arquitetura:** a busca por seção é uma função pura nova em `src/ui/ajustes/capitulos.ts` (`secoesDoCapitulo`, `buscar`). `Wiki.tsx` troca o botão "☰ Índice" por uma barra `position: sticky` e acompanha a seção atual com um ouvinte de rolagem. A gaveta lista as seções do capítulo atual e, com busca, os resultados com trecho. O texto dos 9 capítulos em `docs/wiki/` é enxugado sem mudar títulos, links nem termos.

**Tecnologias:** React 18, TypeScript, Vitest + Testing Library (jsdom), CSS puro em `src/styles.css`, Playwright (fora do projeto) para a varredura.

**Spec:** `docs/superpowers/specs/2026-09-24-wiki-navegacao-design.md`.

## Restrições globais

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\wiki-navegacao`, branch `wiki-navegacao`. **Não toque no checkout principal** (`C:\Users\eitor\Claude\ProjetoFinancas`).
- Todo texto (UI, docs, commits) em português. Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017FzHH4B7r6fEmfS8JwUHVB
  ```
- Nenhuma dependência nova no `package.json`. O Playwright vive só na pasta de rascunho da sessão.
- Não mexer em `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json`, `.claude/`, `public/`.
- CSS só com tokens existentes (`--bg`, `--fg`, `--muted`, `--surface`, `--surface2`, `--line`, `--ac`, `--ac-dim`). Raios só da escala 12/18/20/24/999 px. Classe nova entra em `docs/estilo/catalogo.md`; classe removida sai de lá.
- Arquivos em UTF-8 sem BOM. Use as ferramentas de edição, não `Set-Content`.
- Antes de dizer que uma tarefa terminou: `npm test` inteiro verde.
- Nenhum dado financeiro real em arquivo versionado.
- Tela da varredura Playwright: Galaxy S25+ do usuário — viewport 411 × 744, screen 412 × 892, `deviceScaleFactor` 2,63, `isMobile` e `hasTouch` ligados, `locale` `pt-BR`.

## Mapa de arquivos

| Arquivo | Muda o quê |
|---|---|
| `src/ui/ajustes/capitulos.ts` | + `SecaoTexto`, `Resultado`, `secoesDoCapitulo`, `buscar`; `textoPuro` passa a reusar `textoDoBloco` |
| `src/ui/ajustes/capitulos.test.ts` | + testes de `secoesDoCapitulo` e `buscar` |
| `src/ui/ajustes/Wiki.tsx` | barra fixa, seção atual, seções na gaveta, resultados da busca |
| `src/ui/ajustes/Wiki.test.tsx` | testes novos; ajuste dos dois testes de busca |
| `src/styles.css` | − `.wiki-abrir-indice`; + `.wiki-barra`, `.wiki-barra-texto`, `.wiki-barra-secao`, `.wiki-secao`, `.wiki-resultado`, `.wiki-resultado-onde`, `.wiki-resultado-trecho`; `scroll-margin-top` nos alvos |
| `docs/estilo/catalogo.md` | mesmas classes, entrando e saindo |
| `docs/wiki/*.md` (9 capítulos) | texto enxugado |
| `changelog.d/alterado-wiki-navegacao.md` | fragmento novo |

Pontos de chamada de `parseCapitulo`/`normalizar`/`texto` (grep feito): só `Wiki.tsx` e `capitulos.test.ts`. A wiki não toca em dados, backup nem persistência.

---

### Tarefa 0: preparar o worktree

- [ ] **Passo 1:** conferir o worktree.

Rode: `git rev-parse --show-toplevel`
Esperado: `C:/Users/eitor/Claude/ProjetoFinancas/.worktrees/wiki-navegacao`

- [ ] **Passo 2:** instalar as dependências do lockfile (o worktree não tem `node_modules`).

Rode: `npm ci`

- [ ] **Passo 3:** linha de base.

Rode: `npm test`
Esperado: tudo verde. Se algo falhar antes de qualquer mudança, pare e avise.

---

### Tarefa 1: busca por seção (função pura)

**Arquivos:**
- Modificar: `src/ui/ajustes/capitulos.ts`
- Teste: `src/ui/ajustes/capitulos.test.ts`

**Interfaces produzidas:**
```ts
export interface SecaoTexto { id?: string; titulo?: string; texto: string }
export interface Resultado {
  capitulo: string; tituloCapitulo: string;
  secao?: string; tituloSecao?: string;
  antes: string; achado: string; depois: string;
}
export function secoesDoCapitulo(c: Capitulo): SecaoTexto[];
export function buscar(capitulos: Capitulo[], termo: string): Resultado[];
```

Regras:
- `secoesDoCapitulo` devolve primeiro o trecho antes da primeira seção: `{ texto: titulo do capítulo + blocos de introdução }`, sem `id` nem `titulo`. Depois, um item por `##`: `{ id, titulo, texto: titulo da seção + blocos da seção }`. Pedaços unidos por um espaço.
- `buscar` compara sem acento e sem caixa (`normalizar`). Termo vazio (após `trim`) → `[]`.
- Um resultado por seção, na primeira ocorrência. Ordem: capítulos na ordem recebida; seções na ordem do texto.
- `achado` é o texto **original** (com acento e caixa) que casou.
- Contexto de 40 caracteres de cada lado. Corte à esquerda avança até depois do primeiro espaço; corte à direita recua até o último espaço. Ponta cortada ganha `…`; ponta não cortada não ganha.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente ao fim de `src/ui/ajustes/capitulos.test.ts` (ajuste o `import` do topo para incluir `buscar` e `secoesDoCapitulo`; `parseCapitulo` já é importado lá — confira):

```ts
describe('secoesDoCapitulo', () => {
  const nomes = { a: 'Ana', b: 'Bruno' };
  it('separa a introdução e cada seção, com o título dentro do texto', () => {
    const cap = parseCapitulo('cartao', '# Cartão\nIntro curta.\n## Fatura\nA fatura fecha.\n- item um\n## Pagamento\n: campo | definição', nomes);
    expect(secoesDoCapitulo(cap)).toEqual([
      { texto: 'Cartão Intro curta.' },
      { id: 'fatura', titulo: 'Fatura', texto: 'Fatura A fatura fecha. item um' },
      { id: 'pagamento', titulo: 'Pagamento', texto: 'Pagamento campo definição' },
    ]);
  });
});

describe('buscar', () => {
  const nomes = { a: 'Ana', b: 'Bruno' };
  const cartao = parseCapitulo('cartao', '# Cartão\nIntro curta.\n## Fatura\nA fatura fecha no dia do fechamento e vence depois.\n> Nota sobre juros.', nomes);
  const longo = parseCapitulo('longo', '# Outro\n## Longa\num dois tres quatro cinco seis sete oito nove dez alvo onze doze treze catorze quinze dezesseis dezessete dezoito', nomes);

  it('um resultado por seção, na primeira ocorrência, sem reticências quando nada foi cortado', () => {
    expect(buscar([cartao], 'FECHA')).toEqual([{
      capitulo: 'cartao', tituloCapitulo: 'Cartão', secao: 'fatura', tituloSecao: 'Fatura',
      antes: 'Fatura A fatura ', achado: 'fecha', depois: ' no dia do fechamento e vence depois. Nota sobre juros.',
    }]);
  });

  it('acha sem acento e devolve o texto original; introdução não tem seção', () => {
    expect(buscar([cartao], 'cartao')).toEqual([{
      capitulo: 'cartao', tituloCapitulo: 'Cartão',
      antes: '', achado: 'Cartão', depois: ' Intro curta.',
    }]);
  });

  it('acha em nota', () => {
    expect(buscar([cartao], 'juros').map((r) => r.secao)).toEqual(['fatura']);
  });

  it('corta o contexto em limite de palavra, com reticências nas pontas cortadas', () => {
    const [r] = buscar([longo], 'alvo');
    expect(r.antes).toBe('…quatro cinco seis sete oito nove dez ');
    expect(r.achado).toBe('alvo');
    expect(r.depois).toBe(' onze doze treze catorze quinze…');
  });

  it('percorre vários capítulos na ordem recebida', () => {
    const outro = parseCapitulo('outro', '# Outro\n## Fatura extra\nTexto da fatura.', nomes);
    expect(buscar([cartao, outro], 'fatura').map((r) => `${r.capitulo}/${r.secao}`))
      .toEqual(['cartao/fatura', 'outro/fatura-extra']);
  });

  it('termo vazio ou ausente não devolve nada', () => {
    expect(buscar([cartao], '   ')).toEqual([]);
    expect(buscar([cartao], 'jabuticaba')).toEqual([]);
  });
});
```

Valores esperados foram recalculados à mão: em `"Longa um dois … dezoito"`, `alvo` começa no índice 56; o contexto começa no 16, avança para 19 (depois do espaço em 18); termina no 100 e recua para 91 (espaço antes de `dezesseis`).

- [ ] **Passo 2: rodar e ver falhar**

Rode: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: FAIL — `buscar` e `secoesDoCapitulo` não exportados.

- [ ] **Passo 3: implementar**

Em `src/ui/ajustes/capitulos.ts`, troque `textoPuro` por:

```ts
function textoDoBloco(b: Bloco): string[] {
  if (b.tipo === 'topico') return [b.titulo];
  if (b.tipo === 'lista') return b.itens.map(inlineTexto);
  if (b.tipo === 'campos') return b.itens.map((i) => `${inlineTexto(i.termo)} ${inlineTexto(i.definicao)}`);
  return [inlineTexto(b.conteudo)];
}

function textoPuro(titulo: string, blocos: Bloco[]): string {
  return [titulo, ...blocos.flatMap(textoDoBloco)].join(' ');
}
```

E acrescente, depois de `normalizar`:

```ts
export interface SecaoTexto { id?: string; titulo?: string; texto: string }

/** Texto puro por seção. O primeiro item é a introdução (título do capítulo + texto antes do primeiro ##). */
export function secoesDoCapitulo(c: Capitulo): SecaoTexto[] {
  const secoes: { id?: string; titulo?: string; pedacos: string[] }[] = [{ pedacos: [c.titulo] }];
  for (const b of c.blocos) {
    if (b.tipo === 'topico') secoes.push({ id: b.id, titulo: b.titulo, pedacos: [b.titulo] });
    else secoes[secoes.length - 1].pedacos.push(...textoDoBloco(b));
  }
  return secoes.map(({ pedacos, ...resto }) => ({ ...resto, texto: pedacos.join(' ') }));
}

export interface Resultado {
  capitulo: string; tituloCapitulo: string;
  secao?: string; tituloSecao?: string;
  antes: string; achado: string; depois: string;
}

const CONTEXTO = 40;

/** Posição [início, fim) no texto original do primeiro trecho que casa com `alvo` já normalizado. */
function localizar(texto: string, alvo: string): [number, number] | null {
  let norm = '';
  const origem: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const n = normalizar(texto[i]);
    for (let j = 0; j < n.length; j++) origem.push(i);
    norm += n;
  }
  const k = norm.indexOf(alvo);
  if (k < 0) return null;
  return [origem[k], origem[k + alvo.length - 1] + 1];
}

/** Busca na wiki: um resultado por seção, com trecho em volta da primeira ocorrência. */
export function buscar(capitulos: Capitulo[], termo: string): Resultado[] {
  const alvo = normalizar(termo.trim());
  if (!alvo) return [];
  const resultados: Resultado[] = [];
  for (const c of capitulos) {
    for (const s of secoesDoCapitulo(c)) {
      const pos = localizar(s.texto, alvo);
      if (!pos) continue;
      const [ini, fim] = pos;
      let a = Math.max(0, ini - CONTEXTO);
      let b = Math.min(s.texto.length, fim + CONTEXTO);
      if (a > 0) { const e = s.texto.indexOf(' ', a); a = e >= 0 && e < ini ? e + 1 : ini; }
      if (b < s.texto.length) { const e = s.texto.lastIndexOf(' ', b); b = e >= fim ? e : fim; }
      resultados.push({
        capitulo: c.id, tituloCapitulo: c.titulo,
        ...(s.id ? { secao: s.id, tituloSecao: s.titulo } : {}),
        antes: (a > 0 ? '…' : '') + s.texto.slice(a, ini),
        achado: s.texto.slice(ini, fim),
        depois: s.texto.slice(fim, b) + (b < s.texto.length ? '…' : ''),
      });
    }
  }
  return resultados;
}
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: PASS.

- [ ] **Passo 5: suíte inteira e commit**

Rode: `npm test` → verde.

```bash
git add src/ui/ajustes/capitulos.ts src/ui/ajustes/capitulos.test.ts
git commit -m "feat(wiki): busca por seção com trecho em volta do termo"
```

---

### Tarefa 2: mockup (PONTO DE PARADA)

**Nenhum código de UI antes da aprovação do usuário.**

- [ ] **Passo 1:** montar `wiki-navegacao-mockup.html` na pasta de rascunho da sessão (nunca no repositório). `<meta charset="utf-8">` na primeira linha. Copie o bloco `:root` e as regras usadas de `src/styles.css` (`.topo`, `.chip`, `.conteudo`, `.tela`, `.botao`, `.wiki-*`, `.campo-busca`, `.rotulo`, `.sub`, `.aviso`, `.navegacao`) e acrescente as classes novas exatamente como na Tarefa 3. Texto sintético tirado dos capítulos reais da wiki (a wiki não tem dados financeiros).
- [ ] **Passo 2:** três estados, navegáveis por abas no topo do mockup:
  1. Capítulo "Cartão de crédito" rolado até o meio: barra `☰ Cartão de crédito · <seção>` colada sob o `.topo`.
  2. Gaveta aberta sem busca: capítulos, o atual expandido com as seções, a seção atual destacada.
  3. Gaveta com a busca `fatura`: resultados `Capítulo · Seção` + trecho com `<mark>`.
- [ ] **Passo 3:** abrir o mockup no Playwright a 411 × 744 (DPR 2,63), conferir cada aba e tirar uma captura de cada estado.
- [ ] **Passo 4:** enviar o HTML pelo chat com `SendUserFile`. **Esperar aprovação.** Ajuste pedido → refazer e reenviar. As classes e o markup aprovados valem à risca nas Tarefas 3–5.

---

### Tarefa 3: barra fixa com a seção atual

**Arquivos:**
- Modificar: `src/ui/ajustes/Wiki.tsx`, `src/styles.css` (bloco `/* --- Wiki --- */`), `docs/estilo/catalogo.md`
- Teste: `src/ui/ajustes/Wiki.test.tsx`

**Interfaces:** consome `Capitulo` (já existe). Produz, dentro de `Wiki.tsx`: estado `secaoAtual: string | null`, refs `barra` (`HTMLButtonElement`) e `raiz` (`HTMLDivElement`), lista `secoes` (blocos `topico` do capítulo atual). As Tarefas 4 e 5 usam esses nomes.

- [ ] **Passo 1: testes que falham**

Acrescente em `Wiki.test.tsx` (importe `fireEvent` de `@testing-library/react`):

```tsx
it('a barra do índice mostra o capítulo atual', async () => {
  render(<Wiki />);
  await screen.findByRole('article');
  expect(screen.getByRole('button', { name: 'Índice' })).toHaveTextContent('Os primeiros passos');
});

function simularPosicoes(titulos: Element[], passaram: number) {
  // Barra: topo 0, base 20. Títulos até `passaram` já subiram além da barra; os demais estão abaixo.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const i = titulos.indexOf(this);
    const top = i === -1 ? 0 : i < passaram ? -100 + i : 500;
    return { top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON() {} } as DOMRect;
  });
}

it('a barra mostra a última seção que passou por baixo dela', async () => {
  render(<Wiki />);
  const titulos = [...(await screen.findByRole('article')).querySelectorAll('h3[id]')];
  expect(titulos.length).toBeGreaterThan(2);
  simularPosicoes(titulos, 2);
  fireEvent.scroll(window);
  expect(screen.getByRole('button', { name: 'Índice' }))
    .toHaveTextContent(`Os primeiros passos · ${titulos[1].textContent}`);
});

it('antes da primeira seção, a barra mostra só o capítulo', async () => {
  render(<Wiki />);
  const titulos = [...(await screen.findByRole('article')).querySelectorAll('h3[id]')];
  simularPosicoes(titulos, 0);
  fireEvent.scroll(window);
  expect(screen.getByRole('button', { name: 'Índice' }).textContent).not.toContain('·');
});
```

- [ ] **Passo 2:** `npx vitest run src/ui/ajustes/Wiki.test.tsx` → os dois últimos falham (a barra ainda não mostra seção).

- [ ] **Passo 3: implementar em `Wiki.tsx`**

Novos estados e refs, junto dos existentes:

```tsx
const [secaoAtual, setSecaoAtual] = useState<string | null>(null);
const barra = useRef<HTMLButtonElement>(null);
const raiz = useRef<HTMLDivElement>(null);
```

Depois de `const atual = …`:

```tsx
const secoes = atual.blocos.filter((b): b is Extract<Bloco, { tipo: 'topico' }> => b.tipo === 'topico');
const tituloSecao = secoes.find((s) => s.id === secaoAtual)?.titulo;
```

Efeitos novos:

```tsx
// A barra gruda logo abaixo do .topo do app; títulos e campos param abaixo da barra ao rolar até eles.
useEffect(() => {
  const medir = () => {
    const topo = document.querySelector<HTMLElement>('.topo')?.offsetHeight ?? 0;
    const altura = barra.current?.offsetHeight ?? 0;
    raiz.current?.style.setProperty('--wiki-topo', `${topo}px`);
    raiz.current?.style.setProperty('--wiki-rolagem', `${topo + altura + 8}px`);
  };
  medir();
  window.addEventListener('resize', medir);
  return () => window.removeEventListener('resize', medir);
}, []);

// Seção atual: o último título cujo topo já passou pela base da barra.
useEffect(() => {
  const atualizar = () => {
    const limite = (barra.current?.getBoundingClientRect().bottom ?? 0) + 1;
    let id: string | null = null;
    corpo.current?.querySelectorAll<HTMLElement>('h3[id]').forEach((h) => {
      if (h.getBoundingClientRect().top <= limite) id = h.id;
    });
    setSecaoAtual(id);
  };
  atualizar();
  window.addEventListener('scroll', atualizar, { passive: true });
  return () => window.removeEventListener('scroll', atualizar);
}, [atualId]);
```

No JSX: `<div className="tela" ref={raiz}>`; troque o botão `wiki-abrir-indice` por:

```tsx
<button ref={barra} className="wiki-barra" aria-label="Índice" onClick={() => setIndiceAberto(true)}>
  <span aria-hidden="true">☰</span>
  <span className="wiki-barra-texto">
    {atual.titulo}
    {tituloSecao && <span className="wiki-barra-secao"> · {tituloSecao}</span>}
  </span>
</button>
```

Importe `Bloco` como tipo (já está no `import` de `./capitulos`).

- [ ] **Passo 4: CSS** — no bloco Wiki de `src/styles.css`, remova `.wiki-abrir-indice` e acrescente (ajuste ao mockup aprovado, se ele mudou algo):

```css
/* Barra do índice: gruda sob o .topo (--wiki-topo vem do Wiki.tsx) e ocupa a largura toda,
   anulando o padding lateral de .conteudo. Fica abaixo do .topo (z-index 10). */
.wiki-barra {
  position: sticky; top: var(--wiki-topo, 0px); z-index: 9;
  display: flex; align-items: center; gap: 10px; min-height: 44px;
  margin: 0 -16px; padding: 8px 16px; border: none; text-align: left;
  background: var(--bg); color: var(--fg); font-weight: 600;
}
.wiki-barra-texto { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wiki-barra-secao { color: var(--muted); font-weight: 400; }
/* Destino de rolagem para abaixo da barra, não por trás dela. */
.wiki-corpo h3[id], .wiki-campos > div { scroll-margin-top: var(--wiki-rolagem, 0px); }
```

- [ ] **Passo 5: catálogo** — em `docs/estilo/catalogo.md`, troque a linha de `.wiki-abrir-indice` por:

```
| `.wiki-barra` | barra do índice da wiki: `<button>` sticky sob o `.topo` (`top: var(--wiki-topo)`, medido no Wiki.tsx), z-index 9, largura total (margem −16px), `--bg`, 44px mínimo; `☰ Capítulo · Seção atual`; `h3[id]` e `.wiki-campos > div` ganham `scroll-margin-top: var(--wiki-rolagem)` |
| `.wiki-barra-texto` | texto da barra numa linha só, cortado com reticências |
| `.wiki-barra-secao` | nome da seção atual na barra, em `--muted` e peso normal |
```

Rode: `node scripts/verificar-catalogo.mjs` → sem avisos sobre classes `wiki-*`.

- [ ] **Passo 6:** `npx vitest run src/ui/ajustes/Wiki.test.tsx` → PASS; `npm test` → verde.

- [ ] **Passo 7: commit**

```bash
git add src/ui/ajustes/Wiki.tsx src/ui/ajustes/Wiki.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(wiki): barra do índice fixa, com o capítulo e a seção atual"
```

---

### Tarefa 4: seções do capítulo atual na gaveta

**Arquivos:** `src/ui/ajustes/Wiki.tsx`, `src/styles.css`, `docs/estilo/catalogo.md`, `src/ui/ajustes/Wiki.test.tsx`

**Interfaces:** consome `secoes`, `secaoAtual`, `acoes.ir(capitulo, secao)` e `atual` (Tarefa 3 e código existente).

- [ ] **Passo 1: teste que falha**

```tsx
it('a gaveta lista as seções do capítulo atual e leva até a seção', async () => {
  const original = Element.prototype.scrollIntoView; // jsdom não implementa
  const rolar = vi.fn();
  Element.prototype.scrollIntoView = rolar;
  try {
    await abrirConceitos();
    const titulos = [...screen.getByRole('article').querySelectorAll('h3[id]')];
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    const gaveta = screen.getByRole('navigation');
    for (const t of titulos) expect(within(gaveta).getByRole('button', { name: t.textContent! })).toBeInTheDocument();
    await userEvent.click(within(gaveta).getByRole('button', { name: titulos[2].textContent! }));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(rolar.mock.contexts.at(-1)).toBe(titulos[2]);
  } finally {
    Element.prototype.scrollIntoView = original;
  }
});

it('a gaveta não expande capítulos que não são o atual', async () => {
  render(<Wiki />);
  await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
  // "Box" é seção de Conceitos; o capítulo atual é Os primeiros passos.
  expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Box' })).not.toBeInTheDocument();
});
```

- [ ] **Passo 2:** rodar → o primeiro falha (seções não listadas).

- [ ] **Passo 3: implementar** — importe `Fragment` de `react` e troque o laço da gaveta:

```tsx
{!alvo && capitulos.map((c) => (
  <Fragment key={c.id}>
    <button
      className={`wiki-item${c.id === atual.id ? ' ativo' : ''}`}
      onClick={() => { setBalao(null); setAtualId(c.id); setIndiceAberto(false); }}
    >
      {c.titulo}
    </button>
    {c.id === atual.id && secoes.map((s) => (
      <button
        key={s.id} className={`wiki-item wiki-secao${s.id === secaoAtual ? ' ativo' : ''}`}
        onClick={() => { setIndiceAberto(false); acoes.ir(c.id, s.id); }}
      >
        {s.titulo}
      </button>
    ))}
  </Fragment>
))}
```

(`alvo` já existe; a Tarefa 5 usa o ramo `alvo` para os resultados. Até lá, deixe o ramo de busca como está hoje, trocando `filtrados.map` por `alvo && filtrados.map`.)

- [ ] **Passo 4: CSS e catálogo**

```css
/* Seção do capítulo atual, recuada sob ele. Ativa = só a cor, para não competir com o fundo do capítulo. */
.wiki-item.wiki-secao { padding-left: 28px; min-height: 40px; font-size: 14px; color: var(--muted); }
.wiki-item.wiki-secao.ativo { background: none; color: var(--ac); }
```

Catálogo:

```
| `.wiki-secao` | modificador de `.wiki-item`: seção do capítulo atual na gaveta, recuada 28px, 14px, `--muted`; `.ativo` só troca a cor para `--ac` (sem fundo) |
```

- [ ] **Passo 5:** `npm test` → verde. Commit:

```bash
git add src/ui/ajustes/Wiki.tsx src/ui/ajustes/Wiki.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(wiki): gaveta mostra as seções do capítulo atual"
```

---

### Tarefa 5: resultados da busca com trecho

**Arquivos:** `src/ui/ajustes/Wiki.tsx`, `src/styles.css`, `docs/estilo/catalogo.md`, `src/ui/ajustes/Wiki.test.tsx`

**Interfaces:** consome `buscar` e `Resultado` (Tarefa 1).

- [ ] **Passo 1: testes** — substitua os dois testes de busca existentes (`'a busca filtra o índice, sem acento e sem caixa'` e `'a busca filtra pelo texto do capítulo, não só pelo título'`) por (importe `normalizar` de `./capitulos`):

```tsx
it('a busca mostra onde o termo está, com o trecho destacado, sem acento e sem caixa', async () => {
  render(<Wiki />);
  await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
  await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'CREDITO');
  const resultados = await screen.findAllByRole('button', { name: /^Cartão de crédito/ });
  for (const r of resultados) expect(normalizar(r.querySelector('mark')!.textContent!)).toBe('credito');
  expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Glossário' })).not.toBeInTheDocument();
});

it('a busca acha pelo texto, não só pelo título, e o resultado leva à seção', async () => {
  const original = Element.prototype.scrollIntoView;
  const rolar = vi.fn();
  Element.prototype.scrollIntoView = rolar;
  try {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'pendente');
    const [r] = await screen.findAllByRole('button', { name: /^Conceitos e modelo de dados · / });
    const secao = r.querySelector('.wiki-resultado-onde')!.textContent!.split(' · ')[1];
    await userEvent.click(r);
    expect(await screen.findByRole('heading', { name: 'Conceitos e modelo de dados' })).toBeInTheDocument();
    expect((rolar.mock.contexts.at(-1) as HTMLElement).textContent).toBe(secao);
  } finally {
    Element.prototype.scrollIntoView = original;
  }
});
```

O teste `'avisa quando a busca não acha nada'` fica como está.

- [ ] **Passo 2:** rodar → falham (a gaveta ainda lista capítulos).

- [ ] **Passo 3: implementar** — em `Wiki.tsx`:

```tsx
const resultados = useMemo(() => buscar(capitulos, busca), [capitulos, busca]);
```

Remova `filtrados`. No lugar do ramo de busca:

```tsx
{alvo && resultados.map((r) => (
  <button
    key={`${r.capitulo}/${r.secao ?? ''}`} className="wiki-item wiki-resultado"
    onClick={() => { setIndiceAberto(false); acoes.ir(r.capitulo, r.secao); }}
  >
    <span className="wiki-resultado-onde">{r.tituloCapitulo}{r.tituloSecao && ` · ${r.tituloSecao}`}</span>
    <span className="wiki-resultado-trecho">{r.antes}<mark>{r.achado}</mark>{r.depois}</span>
  </button>
))}
{alvo && resultados.length === 0 && <p className="sub">Nada encontrado.</p>}
```

- [ ] **Passo 4: CSS e catálogo**

```css
.wiki-item.wiki-resultado { display: flex; flex-direction: column; gap: 2px; }
.wiki-resultado-onde { font-size: 13px; color: var(--muted); }
.wiki-resultado-trecho { font-size: 14px; }
.wiki-resultado mark { background: var(--ac-dim); color: var(--ac); }
```

Catálogo:

```
| `.wiki-resultado` | modificador de `.wiki-item`: resultado da busca da wiki, em coluna; `mark` destaca o termo com `--ac-dim`/`--ac` |
| `.wiki-resultado-onde` | `Capítulo · Seção` do resultado, 13px `--muted` |
| `.wiki-resultado-trecho` | trecho em volta do termo, 14px |
```

- [ ] **Passo 5:** `node scripts/verificar-catalogo.mjs` sem avisos `wiki-*`; `npm test` verde. Commit:

```bash
git add src/ui/ajustes/Wiki.tsx src/ui/ajustes/Wiki.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(wiki): busca mostra capítulo, seção e trecho do termo"
```

---

### Tarefa 6: texto mais sucinto (9 capítulos)

**Arquivos:** `docs/wiki/1-primeiros-passos.md` … `docs/wiki/9-codigo.md`. **Não** `docs/wiki/README.md`.

Regras (valem para cada capítulo):
- Estilo do CLAUDE.md: frases curtas, uma ideia por frase, voz ativa, vocabulário consistente, sem repetição.
- **Nenhum conteúdo sai.** Um fato, uma regra ou um exemplo que estava lá continua lá.
- Linhas `# ` e `## ` **idênticas** (são ids de links e alvos dos testes).
- Todo `[[termo]]`, link interno `[..](#..)` e link externo continua. `{{nomeA}}`/`{{nomeB}}`/`{{boxA}}`/`{{boxB}}` continuam; nenhum nome literal.
- Só a sintaxe de `docs/wiki/README.md`.
- Frases que os testes procuram continuam: "espera confirmação na tela Hoje" (glossário, `pendente`), "entra só na projeção" (glossário, `previsto`), o link com texto "Consolidação da casa" em Conceitos, `github.com/EitorBrandao/flow` em Código. Se uma delas precisar mudar, atualize o teste no mesmo commit e explique no relatório.

Para cada capítulo, em ordem:

- [ ] **Passo 1:** anotar a contagem de palavras antes: `wc -w docs/wiki/<arquivo>`.
- [ ] **Passo 2:** reescrever o capítulo.
- [ ] **Passo 3:** `npx vitest run src/ui/ajustes/capitulos.test.ts src/ui/ajustes/Wiki.test.tsx` → PASS.
- [ ] **Passo 4:** `git diff --stat` e conferir que as linhas `#`/`##` não aparecem no diff: `git diff -U0 docs/wiki/<arquivo> | grep -E '^[-+]#'` → vazio.
- [ ] **Passo 5:** commit, um por capítulo:

```bash
git add docs/wiki/<arquivo>
git commit -m "docs(wiki): enxuga o capítulo <título>"
```

Ao fim dos 9: `npm test` verde; `node scripts/verificar-dados-reais.mjs` sem aviso. Relatório com palavras antes/depois por capítulo e dois exemplos de parágrafo antes/depois, para o usuário revisar.

---

### Tarefa 7: varredura como usuário (Playwright)

Fora do projeto. Pasta: a pasta de rascunho da sessão (`…\scratchpad\playwright`).

- [ ] **Passo 1:** instalar lá, se ainda não houver: `npm init -y && npm i playwright && npx playwright install chromium`.
- [ ] **Passo 2:** subir o app do worktree em porta própria, em segundo plano: `npx vite --port 5198 --strictPort` (a partir do worktree).
- [ ] **Passo 3:** script `varredura-wiki.mjs`:

```js
import { chromium } from 'playwright';
const saida = process.argv[2] ?? '.';
const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 411, height: 744 }, screen: { width: 412, height: 892 },
  deviceScaleFactor: 2.63, isMobile: true, hasTouch: true, locale: 'pt-BR',
});
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(e.message));
await p.goto('http://localhost:5198/');
await p.getByRole('button', { name: 'Ajustes' }).tap();
await p.getByRole('button', { name: 'Wiki' }).tap();
const barra = p.getByRole('button', { name: 'Índice' });
const topo = p.locator('.topo');
const foto = (n) => p.screenshot({ path: `${saida}/${n}.png` });

// 1–2: barra colada sob o .topo durante a rolagem; seção muda ao passar os títulos
await p.getByRole('button', { name: 'Índice' }).tap();
await p.getByRole('button', { name: 'Cartão de crédito' }).tap();
const textos = [];
for (let i = 0; i < 6; i++) {
  await p.mouse.wheel(0, 500);
  await p.waitForTimeout(150);
  const b = await barra.boundingBox(), t = await topo.boundingBox();
  if (Math.abs(b.y - (t.y + t.height)) > 1) erros.push(`barra solta do topo: ${b.y} vs ${t.y + t.height}`);
  textos.push(await barra.textContent());
}
if (new Set(textos).size < 2) erros.push(`barra não trocou de seção: ${textos.join(' | ')}`);
await foto('1-rolado');

// 3: gaveta com seções; tocar numa seção deixa o título visível abaixo da barra
await barra.tap();
await foto('2-gaveta');
const secoes = p.locator('.wiki-secao');
if ((await secoes.count()) === 0) erros.push('gaveta sem seções');
const alvo = secoes.nth(1);
const nome = await alvo.textContent();
await alvo.tap();
await p.waitForTimeout(300);
const h = await p.getByRole('heading', { name: nome, exact: true }).boundingBox();
const b = await barra.boundingBox();
if (h.y < b.y + b.height) erros.push(`título "${nome}" escondido sob a barra`);
await foto('3-secao');

// 4: busca sem acento, com trecho e destaque
await barra.tap();
await p.getByLabel('Buscar na wiki').fill('credito');
if ((await p.locator('.wiki-resultado mark').count()) === 0) erros.push('busca sem destaque');
await foto('4-busca');
await p.locator('.wiki-resultado').first().tap();

// 5: nada de rolagem horizontal
const largura = await p.evaluate(() => document.documentElement.scrollWidth);
if (largura > 411) erros.push(`rolagem horizontal: ${largura}px`);

// 6: balão do glossário abre e fecha ao rolar
const termo = p.locator('.wiki-termo').first();
await termo.scrollIntoViewIfNeeded();
await termo.tap();
if (!(await p.getByRole('dialog').isVisible())) erros.push('balão não abriu');
await p.mouse.wheel(0, 200);
await p.waitForTimeout(150);
if (await p.getByRole('dialog').isVisible()) erros.push('balão não fechou ao rolar');

console.log(erros.length ? `FALHAS:\n${erros.join('\n')}` : 'OK');
await nav.close();
process.exit(erros.length ? 1 : 0);
```

O `base` do `vite.config.ts` é `'./'`: em desenvolvimento o app responde na raiz.

- [ ] **Passo 4:** rodar `node varredura-wiki.mjs <pasta-das-capturas>`. Esperado: `OK`. Falha → corrigir no código (com teste Vitest que reproduza, quando possível), commit, rodar de novo.
- [ ] **Passo 5:** olhar as 4 capturas. Enviar ao usuário pelo chat (`SendUserFile`).
- [ ] **Passo 6:** encerrar o `vite` e matar o `node` que segura a porta 5198 (`netstat -ano | findstr :5198` → `taskkill /PID <pid> /F`).

---

### Tarefa 8: fragmento e ciclo de entrega

- [ ] **Passo 1:** criar `changelog.d/alterado-wiki-navegacao.md`:

```
- Wiki mais fácil de navegar.
  - O índice fica sempre à mão numa barra no topo, com o capítulo e a seção em que você está.
  - O índice mostra as seções do capítulo aberto; um toque leva direto a elas.
  - A busca mostra o capítulo, a seção e um trecho com o termo destacado.
- Texto da wiki mais curto e direto, sem perder conteúdo.
```

- [ ] **Passo 2:** commit do fragmento.
- [ ] **Passo 3:** invocar a skill `ciclo-de-entrega` e segui-la (confirmação do changelog pelo usuário, merge, release, push, deploy). A atualização da wiki é a própria Tarefa 6.
- [ ] **Passo 4:** `git -C C:\Users\eitor\Claude\ProjetoFinancas status --porcelain` → vazio.
