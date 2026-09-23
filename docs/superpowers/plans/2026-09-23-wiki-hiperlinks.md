# Hiperlinks na wiki — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`).

**Objetivo:** links entre capítulos e seções da wiki, e termos do glossário que abrem a definição num balão ancorado.

**Arquitetura:** o parser (`capitulos.ts`) resolve todo link interno para um `Inline` do tipo `ref` (capítulo + seção). Uma função pura (`validarLinks`) confere os destinos; um teste roda sobre os capítulos reais. A tela (`Wiki.tsx`) decide: `ref` para `glossario` com seção vira termo com balão; o resto navega.

**Tecnologia:** React 18, TypeScript, Vitest + Testing Library (jsdom). Sem dependência nova.

**Especificação:** `docs/superpowers/specs/2026-09-23-wiki-hiperlinks-design.md`.

## Restrições globais

- Todo texto (código, UI, docs, commits) em português.
- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\wiki-hiperlinks`, branch `wiki-hiperlinks`. Nunca editar a `main`.
- Nenhuma dependência npm nova. Não mexer em `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json`, `.claude/`.
- CSS só com tokens existentes (`--fg`, `--muted`, `--surface2`, `--ac`); raio 18px (item de lista). Nenhum token novo.
- Nomes de pessoa nos capítulos só pelos marcadores `{{nomeA}}`/`{{nomeB}}`/`{{boxA}}`/`{{boxB}}`.
- Não usar `{ timeout: n }` em `findBy*`.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017FzHH4B7r6fEmfS8JwUHVB
  ```
- Rodar testes de dentro do worktree: `npx vitest run <arquivo>`.

---

### Tarefa 1: Parser — links internos, `[[termo]]`, ids do glossário e validação

**Arquivos:**
- Modificar: `src/ui/ajustes/capitulos.ts`
- Testar: `src/ui/ajustes/capitulos.test.ts`

**Interfaces produzidas (usadas pelas tarefas 2 e 3):**
- `type Inline` ganha `{ tipo: 'ref'; texto: string; capitulo: string; secao?: string; codigo?: boolean }`.
- Bloco `campos`: cada item passa a ser `{ id: string; termo: Inline[]; definicao: Inline[] }`.
- `idDoCapitulo(caminho: string): string` — `'../../../docs/wiki/4-motor.md'` → `'motor'`.
- `validarLinks(capitulos: Capitulo[]): string[]` — lista de erros; vazia = tudo certo.
- `termosDoGlossario(glossario: Capitulo): Map<string, { termo: Inline[]; definicao: Inline[] }>` — chave = id do termo.

- [ ] **Passo 1: escrever os testes que falham**

Em `capitulos.test.ts`, trocar o import da linha 2 por:

```ts
import { NOMES, idDoCapitulo, parseCapitulo, sortearNomes, termosDoGlossario, validarLinks } from './capitulos';
```

Trocar o teste `'quebra o inline em forte, código e link'` inteiro por:

```ts
  it('quebra o inline em forte, código e link externo', () => {
    const cap = parseCapitulo('t', '# T\n\numa **coisa** com `código` e [um link](https://exemplo.com).\n', NOMES_FIXOS);
    const bloco = cap.blocos[0];
    if (bloco.tipo !== 'paragrafo') throw new Error('bloco errado');
    expect(bloco.conteudo).toEqual([
      { tipo: 'texto', texto: 'uma ' },
      { tipo: 'forte', texto: 'coisa' },
      { tipo: 'texto', texto: ' com ' },
      { tipo: 'codigo', texto: 'código' },
      { tipo: 'texto', texto: ' e ' },
      { tipo: 'link', texto: 'um link', href: 'https://exemplo.com' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('lê link interno para capítulo e para seção', () => {
    const cap = parseCapitulo('t', '# T\n\nveja [o motor](#motor) e [a fronteira](#motor/fronteira-do-hoje-e-pendentes).\n', NOMES_FIXOS);
    const bloco = cap.blocos[0];
    if (bloco.tipo !== 'paragrafo') throw new Error('bloco errado');
    expect(bloco.conteudo).toEqual([
      { tipo: 'texto', texto: 'veja ' },
      { tipo: 'ref', texto: 'o motor', capitulo: 'motor' },
      { tipo: 'texto', texto: ' e ' },
      { tipo: 'ref', texto: 'a fronteira', capitulo: 'motor', secao: 'fronteira-do-hoje-e-pendentes' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('lê [[termo]] como link para o glossário, com e sem crase', () => {
    const cap = parseCapitulo('t', '# T\n\num [[box casa]] e um [[`efetivo`]].\n', NOMES_FIXOS);
    const bloco = cap.blocos[0];
    if (bloco.tipo !== 'paragrafo') throw new Error('bloco errado');
    expect(bloco.conteudo).toEqual([
      { tipo: 'texto', texto: 'um ' },
      { tipo: 'ref', texto: 'box casa', capitulo: 'glossario', secao: 'box-casa' },
      { tipo: 'texto', texto: ' e um ' },
      { tipo: 'ref', texto: 'efetivo', capitulo: 'glossario', secao: 'efetivo', codigo: true },
      { tipo: 'texto', texto: '.' },
    ]);
    expect(cap.texto).toContain('um box casa e um efetivo.');
  });

  it('recusa [[ ]] malformado e link interno com mais de uma barra', () => {
    expect(() => parseCapitulo('t', '# T\n\num [[termo] solto\n', NOMES_FIXOS)).toThrow(/não reconhecida/);
    expect(() => parseCapitulo('t', '# T\n\num termo]] solto\n', NOMES_FIXOS)).toThrow(/não reconhecida/);
    expect(() => parseCapitulo('t', '# T\n\n[x](#a/b/c)\n', NOMES_FIXOS)).toThrow(/link interno/);
  });

  it('dá id a cada termo de campos, sem crase e sem acento', () => {
    const cap = parseCapitulo('t', '# T\n\n: `efetivo` | confirmado\n: horizonte de projeção | até onde\n', NOMES_FIXOS);
    const campos = cap.blocos[0];
    if (campos.tipo !== 'campos') throw new Error('bloco errado');
    expect(campos.itens.map((i) => i.id)).toEqual(['efetivo', 'horizonte-de-projecao']);
  });
```

No fim do `describe('parseCapitulo', ...)` não muda mais nada. Depois do `describe('parseCapitulo', ...)` (antes de `describe('capítulos de docs/wiki', ...)`), acrescentar:

```ts
describe('idDoCapitulo', () => {
  it('tira pasta, extensão e número do nome do arquivo', () => {
    expect(idDoCapitulo('../../../docs/wiki/4-motor.md')).toBe('motor');
    expect(idDoCapitulo('8-glossario.md')).toBe('glossario');
    expect(idDoCapitulo('1-primeiros-passos')).toBe('primeiros-passos');
  });
});

describe('validarLinks', () => {
  const glossario = parseCapitulo('glossario', '# Glossário\n\n: pendente | espera confirmação\n', NOMES_FIXOS);
  const motor = parseCapitulo('motor', '# Motor\n\n## Fronteira do hoje\n\ntexto\n', NOMES_FIXOS);

  it('aceita destinos que existem', () => {
    const ok = parseCapitulo('conceitos', '# C\n\n[m](#motor), [f](#motor/fronteira-do-hoje) e [[pendente]].\n', NOMES_FIXOS);
    expect(validarLinks([glossario, motor, ok])).toEqual([]);
  });

  it('reprova capítulo, seção e termo inexistentes, dizendo onde está o link', () => {
    const ruim = parseCapitulo('conceitos', '# C\n\n- [x](#nada)\n- [y](#motor/sumiu)\n\n: campo | um [[inventado]]\n', NOMES_FIXOS);
    const erros = validarLinks([glossario, motor, ruim]);
    expect(erros).toHaveLength(3);
    expect(erros[0]).toMatch(/conceitos.*#nada/);
    expect(erros[1]).toMatch(/conceitos.*#motor\/sumiu/);
    expect(erros[2]).toMatch(/conceitos.*#glossario\/inventado/);
  });
});

describe('termosDoGlossario', () => {
  it('indexa termo e definição pelo id', () => {
    const g = parseCapitulo('glossario', '# Glossário\n\n: `efetivo` | Lançamento confirmado.\n', NOMES_FIXOS);
    const termos = termosDoGlossario(g);
    expect(termos.get('efetivo')?.definicao).toEqual([{ tipo: 'texto', texto: 'Lançamento confirmado.' }]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: FALHA (`idDoCapitulo`/`validarLinks`/`termosDoGlossario` não exportados; `ref` inexistente).

- [ ] **Passo 3: implementar em `capitulos.ts`**

Trocar o tipo `Inline` e o bloco `campos`:

```ts
export type Inline =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'forte'; texto: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'link'; texto: string; href: string }
  /** link interno: capítulo, e seção opcional. `codigo` = texto veio entre crases */
  | { tipo: 'ref'; texto: string; capitulo: string; secao?: string; codigo?: boolean };

export interface ItemCampo { id: string; termo: Inline[]; definicao: Inline[] }

export type Bloco =
  | { tipo: 'paragrafo'; conteudo: Inline[] }
  | { tipo: 'topico'; titulo: string; id: string }
  | { tipo: 'lista'; itens: Inline[][] }
  | { tipo: 'nota'; conteudo: Inline[] }
  | { tipo: 'campos'; itens: ItemCampo[] };
```

Trocar `RE_INLINE` e `parseInline` inteiros por:

```ts
// [[termo]] vem antes do link comum: os dois começam com "[".
const RE_INLINE = /(\[\[[^[\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;

/** `#capitulo` ou `#capitulo/secao` → ref. Qualquer outra forma com `#` lança. */
function refInterna(texto: string, href: string): Inline {
  const m = /^#([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/.exec(href);
  if (!m) throw new Error(`wiki: link interno malformado: "${href}" (use #capitulo ou #capitulo/secao)`);
  return m[2] ? { tipo: 'ref', texto, capitulo: m[1], secao: m[2] } : { tipo: 'ref', texto, capitulo: m[1] };
}

function refGlossario(bruto: string): Inline {
  const codigo = bruto.length > 2 && bruto.startsWith('`') && bruto.endsWith('`');
  const texto = codigo ? bruto.slice(1, -1) : bruto;
  const ref: Inline = { tipo: 'ref', texto, capitulo: 'glossario', secao: idDoTopico(texto) };
  return codigo ? { ...ref, codigo: true } : ref;
}

export function parseInline(texto: string): Inline[] {
  const partes: Inline[] = [];
  for (const pedaco of texto.split(RE_INLINE)) {
    if (!pedaco) continue;
    if (pedaco.startsWith('[[') && pedaco.endsWith(']]')) {
      partes.push(refGlossario(pedaco.slice(2, -2).trim()));
    } else if (pedaco.startsWith('**') && pedaco.endsWith('**')) {
      partes.push({ tipo: 'forte', texto: pedaco.slice(2, -2) });
    } else if (pedaco.startsWith('`') && pedaco.endsWith('`')) {
      partes.push({ tipo: 'codigo', texto: pedaco.slice(1, -1) });
    } else if (pedaco.startsWith('[') && /^\[([^\]]+)\]\(([^)]+)\)$/.test(pedaco)) {
      const [, t, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(pedaco)!;
      partes.push(href.startsWith('#') ? refInterna(t, href) : { tipo: 'link', texto: t, href });
    } else {
      // Texto que sobrou — não pode conter marcação não reconhecida
      const marcacaoInvalida = pedaco.match(/\*|`|\]\(|\{\{|\[\[|\]\]/);
      if (marcacaoInvalida) {
        throw new Error(`Marcação não reconhecida no texto: "${pedaco.slice(0, 60)}..."`);
      }
      partes.push({ tipo: 'texto', texto: pedaco });
    }
  }
  return partes;
}
```

Logo depois de `idDoTopico`, acrescentar:

```ts
/** Id estável do capítulo: nome do arquivo sem pasta, extensão e número. Renumerar não quebra link. */
export function idDoCapitulo(caminho: string): string {
  return caminho.split('/').pop()!.replace(/\.md$/, '').replace(/^\d+-/, '');
}
```

No ramo `': '` de `parseCapitulo`, trocar a linha `const item = { termo: ..., definicao: ... };` por:

```ts
      const termoInline = parseInline(termo.trim());
      const item: ItemCampo = {
        id: idDoTopico(inlineTexto(termoInline)),
        termo: termoInline,
        definicao: parseInline(resto.join('|').trim()),
      };
```

No fim do arquivo, acrescentar:

```ts
function inlinesDoBloco(b: Bloco): Inline[] {
  if (b.tipo === 'topico') return [];
  if (b.tipo === 'lista') return b.itens.flat();
  if (b.tipo === 'campos') return b.itens.flatMap((i) => [...i.termo, ...i.definicao]);
  return b.conteudo;
}

/** Ids que um link `#capitulo/…` pode alcançar: seções e termos de campos. */
function destinosDe(cap: Capitulo): Set<string> {
  const ids = new Set<string>();
  for (const b of cap.blocos) {
    if (b.tipo === 'topico') ids.add(b.id);
    if (b.tipo === 'campos') for (const i of b.itens) ids.add(i.id);
  }
  return ids;
}

/** Confere todo link interno. Devolve um erro por destino inexistente; lista vazia = tudo certo. */
export function validarLinks(capitulos: Capitulo[]): string[] {
  const porId = new Map(capitulos.map((c) => [c.id, c]));
  const erros: string[] = [];
  for (const cap of capitulos) {
    for (const p of cap.blocos.flatMap(inlinesDoBloco)) {
      if (p.tipo !== 'ref') continue;
      const alvo = `#${p.capitulo}${p.secao ? `/${p.secao}` : ''}`;
      const destino = porId.get(p.capitulo);
      if (!destino) erros.push(`${cap.id}: capítulo inexistente em ${alvo}`);
      else if (p.secao && !destinosDe(destino).has(p.secao)) erros.push(`${cap.id}: seção ou termo inexistente em ${alvo}`);
    }
  }
  return erros;
}

export function termosDoGlossario(glossario: Capitulo): Map<string, Omit<ItemCampo, 'id'>> {
  const termos = new Map<string, Omit<ItemCampo, 'id'>>();
  for (const b of glossario.blocos) {
    if (b.tipo === 'campos') for (const i of b.itens) termos.set(i.id, { termo: i.termo, definicao: i.definicao });
  }
  return termos;
}
```

Observação: `refGlossario` usa `idDoTopico`, que é declarada depois. Funções declaradas com `function` sobem (hoisting); não precisa mover.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: PASSA. Os testes de `capítulos de docs/wiki` continuam verdes (nenhum capítulo usa `#` hoje).

Rodar também: `npx tsc -b` — esperado sem erro. (`Wiki.tsx` ainda não conhece `ref`, mas o `return <span>{p.texto}</span>` final cobre o tipo novo; a tarefa 3 faz o resto.)

- [ ] **Passo 5: commit**

```bash
git add src/ui/ajustes/capitulos.ts src/ui/ajustes/capitulos.test.ts
git commit -m "feat: parser da wiki lê links entre capítulos e termos do glossário"
```

---

### Tarefa 2: Conteúdo — referências cruzadas, termos marcados e teste de integridade

**Arquivos:**
- Modificar: `docs/wiki/1-primeiros-passos.md`, `2-visao-geral.md`, `3-conceitos.md`, `4-motor.md`, `5-cartao.md`, `6-telas.md`, `7-ajustes.md`
- Testar: `src/ui/ajustes/capitulos.test.ts`

**Interfaces consumidas:** `idDoCapitulo`, `parseCapitulo`, `validarLinks` (tarefa 1).

Ids dos capítulos: `primeiros-passos`, `visao-geral`, `conceitos`, `motor`, `cartao`, `telas`, `ajustes`, `glossario`, `codigo`.

Ids dos termos do glossário: `efetivo`, `previsto`, `pendente`, `box-casa`, `cenario`, `materializar`, `fatura`, `ciclo-de-fechamento`, `conferencia`, `banco`, `parcelamento-de-fatura`, `horizonte-de-projecao`, `atalho-de-lancamento`, `chave-de-acesso`, `item-da-nota`, `transferencia-entre-bancos`, `conferencia-por-extrato`, `sobra`, `a-classificar`.

- [ ] **Passo 1: escrever o teste de integridade (falha só se houver link quebrado)**

Em `describe('capítulos de docs/wiki', ...)`, acrescentar:

```ts
  it('todo link interno aponta para capítulo, seção ou termo que existe', () => {
    const caps = arquivos.map(([caminho, raw]) => parseCapitulo(idDoCapitulo(caminho), raw, NOMES_FIXOS));
    expect(validarLinks(caps)).toEqual([]);
  });

  it('os capítulos usam links internos (a conversão das referências em prosa aconteceu)', () => {
    const todos = arquivos.map(([, raw]) => raw).join('\n');
    expect(todos).toMatch(/\]\(#motor\/consolidacao-da-casa\)/);
    expect(todos).toMatch(/\[\[pendente\]\]/);
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: FALHA no segundo teste novo (ainda não há links).

- [ ] **Passo 3: converter as referências em prosa (texto exato)**

`3-conceitos.md` linha 13 — trocar `Veja o capítulo Motor por baixo dos panos, seção Consolidação da casa.` por:
`Veja [Consolidação da casa](#motor/consolidacao-da-casa), no capítulo Motor por baixo dos panos.`

`3-conceitos.md` linha 33 — trocar a linha inteira por (texto final, já com os termos marcados):
`` [[`efetivo`]] entra no saldo real; [[`previsto`]] só entra na projeção. Um previsto cuja data já passou vira um [[pendente]] — veja [Fronteira do hoje e pendentes](#motor/fronteira-do-hoje-e-pendentes), no capítulo Motor por baixo dos panos. ``

`5-cartao.md` linha 15 — trocar `(ver "Sincronização com o Flow", abaixo)` por `(ver [Sincronização com o Flow](#cartao/sincronizacao-com-o-flow), abaixo)` e `ver capítulo Ajustes, seção Cartões.` por `ver [Cartões](#ajustes/cartoes), no capítulo Ajustes.`

`6-telas.md` linha 13 — trocar `(veja o capítulo Cartão)` por `(veja o capítulo [Cartão de crédito](#cartao))`.

`7-ajustes.md` linha 13 — trocar `(veja o capítulo Conceitos e modelo de dados)` por `(veja [Recorrência](#conceitos/recorrencia), no capítulo Conceitos e modelo de dados)`.

`2-visao-geral.md` linha 12 — trocar `Veja o capítulo sobre Telas e a documentação interna para reativar.` por `Veja [Simulador](#telas/simulador-oculta-da-navegacao), no capítulo Telas, e a documentação interna para reativar.`

- [ ] **Passo 4: marcar termos do glossário**

Regra: em cada capítulo de 1 a 7, marcar só a **primeira ocorrência** de cada termo do glossário, e só quando o sentido é o do glossário. Nunca marcar dentro de título (`#`/`##`), nem dentro de `**negrito**` ou de `` `código` `` já existentes (a marcação não aninha — troque `**pendente**` por `[[pendente]]` só se o negrito era só destaque do termo). Forma diferente do termo usa a versão longa: `[previstos](#glossario/previsto)`. Termo que no texto já está entre crases vira `` [[`efetivo`]] ``.

Marcações obrigatórias (o teste de tela da tarefa 3 depende delas):
- `3-conceitos.md` linha 33: já feita no passo 3 (`[[pendente]]`).
- `3-conceitos.md` linha 13: `A box **casa** é especial` → `A [[box casa]] é especial`.

Marcações sugeridas nos outros capítulos (aplicar se o sentido bater; não inventar ocorrência):
- `1-primeiros-passos.md`: `a box **casa**` (linha 3) → `a [[box casa]]`; primeira ocorrência de "fatura" fora de negrito (linha 52, "é nela que a fatura aparece") → `[[fatura]]`; "a conferência existe para isso" (linha 71) → `a [[conferência]] existe para isso`. "sobra no app" não é o termo `sobra` do glossário (é da conferência manual) — **não marcar**.
- `4-motor.md`: "horizonte de projeção" (linha 7) → `[[horizonte de projeção]]`; "materialização" (linha 20) → `[materialização](#glossario/materializar)`; "dos cenários ligados" (linha 11) está dentro de definição de campo, fora de código → `dos [cenários](#glossario/cenario) ligados`.
- `5-cartao.md`, `6-telas.md`, `7-ajustes.md`: primeira ocorrência de `fatura`, `ciclo de fechamento`, `parcelamento de fatura`, `conferência por extrato`, `sobra`, `a classificar`, `transferência entre bancos`, `banco`, `atalho de lançamento`, `chave de acesso`, `item da nota`, quando aparecerem em prosa, lista ou definição, fora de título, negrito e código.

- [ ] **Passo 5: rodar e ver passar**

Rodar: `npx vitest run src/ui/ajustes/capitulos.test.ts`
Esperado: PASSA, inclusive o teste de integridade (qualquer id errado aparece na mensagem, com o capítulo e o destino).

- [ ] **Passo 6: commit**

```bash
git add docs/wiki src/ui/ajustes/capitulos.test.ts
git commit -m "docs: wiki com links entre capítulos e termos do glossário marcados"
```

---

### Tarefa 3: Tela — navegação por link e balão do glossário

**Arquivos:**
- Modificar: `src/ui/ajustes/Wiki.tsx`, `src/styles.css` (bloco da wiki, linhas ~348–380), `docs/estilo/catalogo.md` (linhas da wiki, ~56–62)
- Testar: `src/ui/ajustes/Wiki.test.tsx`

**Interfaces consumidas:** `Inline` (`ref`), `idDoCapitulo`, `termosDoGlossario` (tarefa 1); conteúdo marcado (tarefa 2).

Antes de editar: ler `docs/estilo-visual.md` e `docs/estilo/nivel-2-nova-classe.md`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescentar em `Wiki.test.tsx`, dentro do `describe`:

```tsx
  async function abrirConceitos() {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Conceitos e modelo de dados' }));
  }

  it('link interno troca de capítulo', async () => {
    await abrirConceitos();
    await userEvent.click(await screen.findByRole('link', { name: 'Consolidação da casa' }));
    expect(await screen.findByRole('heading', { name: 'Motor por baixo dos panos' })).toBeInTheDocument();
  });

  it('termo do glossário abre a definição no lugar e fecha ao tocar fora', async () => {
    await abrirConceitos();
    await userEvent.click(await screen.findByRole('button', { name: 'pendente' }));
    const balao = await screen.findByRole('dialog', { name: 'Definição: pendente' });
    expect(balao).toHaveTextContent(/espera confirmação na tela Hoje/);
    expect(screen.getByRole('heading', { name: 'Conceitos e modelo de dados' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('heading', { name: 'Conceitos e modelo de dados' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tocar de novo no mesmo termo fecha o balão', async () => {
    await abrirConceitos();
    const termo = await screen.findByRole('button', { name: 'pendente' });
    await userEvent.click(termo);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.click(termo);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/ui/ajustes/Wiki.test.tsx`
Esperado: FALHA (não há `link` "Consolidação da casa" nem `dialog`).

- [ ] **Passo 3: implementar `Wiki.tsx`**

Substituir o arquivo inteiro por:

```tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import {
  idDoCapitulo, normalizar, parseCapitulo, sortearNomes, termosDoGlossario,
  type Bloco, type Capitulo, type Inline,
} from './capitulos';

// Carrega capítulos (exclui README que não é um capítulo)
const BRUTOS_TODOS = import.meta.glob('../../../docs/wiki/*.md', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
const BRUTOS = Object.fromEntries(
  Object.entries(BRUTOS_TODOS).filter(([caminho]) => !caminho.includes('README'))
);

interface Acoes {
  ir: (capitulo: string, secao?: string) => void;
  alternarTermo: (id: string, alvo: HTMLElement) => void;
  termoAberto: string | null;
}
const AcoesWiki = createContext<Acoes | null>(null);

function Trechos({ partes }: { partes: Inline[] }) {
  const acoes = useContext(AcoesWiki);
  return (
    <>
      {partes.map((p, i) => {
        if (p.tipo === 'forte') return <strong key={i}>{p.texto}</strong>;
        if (p.tipo === 'codigo') return <code key={i}>{p.texto}</code>;
        if (p.tipo === 'link') return <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">{p.texto}</a>;
        if (p.tipo === 'ref') {
          const rotulo = p.codigo ? <code>{p.texto}</code> : p.texto;
          if (p.capitulo === 'glossario' && p.secao) {
            const id = p.secao;
            return (
              <button
                key={i} type="button" data-termo
                className={`wiki-termo${acoes?.termoAberto === id ? ' aberto' : ''}`}
                aria-expanded={acoes?.termoAberto === id}
                onClick={(e) => acoes?.alternarTermo(id, e.currentTarget)}
              >{rotulo}</button>
            );
          }
          const href = `#${p.capitulo}${p.secao ? `/${p.secao}` : ''}`;
          return (
            <a
              key={i} href={href} className="wiki-link"
              onClick={(e: MouseEvent) => { e.preventDefault(); acoes?.ir(p.capitulo, p.secao); }}
            >{rotulo}</a>
          );
        }
        return <span key={i}>{p.texto}</span>;
      })}
    </>
  );
}

function BlocoRender({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === 'topico') return <h3 id={bloco.id}>{bloco.titulo}</h3>;
  if (bloco.tipo === 'paragrafo') return <p><Trechos partes={bloco.conteudo} /></p>;
  if (bloco.tipo === 'nota') return <p className="aviso"><Trechos partes={bloco.conteudo} /></p>;
  if (bloco.tipo === 'lista') {
    return <ul>{bloco.itens.map((item, i) => <li key={i}><Trechos partes={item} /></li>)}</ul>;
  }
  return (
    <dl className="wiki-campos">
      {bloco.itens.map((item) => (
        <div key={item.id} id={item.id}>
          <dt><Trechos partes={item.termo} /></dt>
          <dd><Trechos partes={item.definicao} /></dd>
        </div>
      ))}
    </dl>
  );
}

interface Balao { id: string; top: number; seta: number }

export default function Wiki() {
  const [nomes] = useState(() => sortearNomes());
  const capitulos: Capitulo[] = useMemo(
    () => Object.entries(BRUTOS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([caminho, raw]) => parseCapitulo(idDoCapitulo(caminho), raw, nomes)),
    [nomes],
  );
  const glossario = useMemo(() => {
    const g = capitulos.find((c) => c.id === 'glossario');
    return g ? termosDoGlossario(g) : new Map();
  }, [capitulos]);
  const [atualId, setAtualId] = useState(capitulos[0].id);
  const [indiceAberto, setIndiceAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [destino, setDestino] = useState<{ secao?: string } | null>(null);
  const [balao, setBalao] = useState<Balao | null>(null);
  const corpo = useRef<HTMLElement>(null);

  const alvo = normalizar(busca.trim());
  const filtrados = alvo ? capitulos.filter((c) => normalizar(c.texto).includes(alvo)) : capitulos;
  const atual = capitulos.find((c) => c.id === atualId) ?? capitulos[0];

  // Depois de trocar de capítulo por link: rola até a seção, ou ao topo do capítulo.
  useEffect(() => {
    if (!destino) return;
    const el = (destino.secao && document.getElementById(destino.secao)) || corpo.current;
    el?.scrollIntoView?.({ block: 'start' });
    setDestino(null);
  }, [destino, atualId]);

  // Balão aberto: fecha ao tocar fora dele (o termo cuida do próprio toque) ou ao rolar.
  useEffect(() => {
    if (!balao) return;
    const fechar = () => setBalao(null);
    const aoTocar = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest('.wiki-balao') || t.closest('[data-termo]')) return;
      fechar();
    };
    document.addEventListener('click', aoTocar);
    window.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('click', aoTocar);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [balao]);

  const acoes: Acoes = {
    ir: (capitulo, secao) => { setBalao(null); setAtualId(capitulo); setDestino({ secao }); },
    alternarTermo: (id, el) => {
      if (balao?.id === id) { setBalao(null); return; }
      const ra = corpo.current!.getBoundingClientRect();
      const rt = el.getBoundingClientRect();
      const meio = rt.left - ra.left + rt.width / 2 - 7;
      setBalao({ id, top: rt.bottom - ra.top + 10, seta: Math.max(14, Math.min(ra.width - 28, meio)) });
    },
    termoAberto: balao?.id ?? null,
  };
  const termo = balao ? glossario.get(balao.id) : undefined;

  return (
    <div className="tela">
      <h2>Wiki</h2>
      <button className="botao wiki-abrir-indice" aria-label="Índice" onClick={() => setIndiceAberto(true)}>☰ Índice</button>

      <AcoesWiki.Provider value={acoes}>
        <article className="wiki-corpo" ref={corpo}>
          <h3 className="wiki-titulo">{atual.titulo}</h3>
          {atual.blocos.map((b, i) => <BlocoRender key={i} bloco={b} />)}
          {balao && termo && (
            <div
              className="wiki-balao" role="dialog"
              aria-label={`Definição: ${termo.termo.map((p: Inline) => p.texto).join('')}`}
              style={{ top: balao.top, '--seta': `${balao.seta}px` } as CSSProperties}
            >
              <p className="wiki-balao-termo"><Trechos partes={termo.termo} /></p>
              <p className="wiki-balao-def"><Trechos partes={termo.definicao} /></p>
            </div>
          )}
        </article>
      </AcoesWiki.Provider>

      {indiceAberto && (
        <>
          <button className="wiki-fundo" aria-label="Fechar índice" onClick={() => setIndiceAberto(false)} />
          <nav className="wiki-gaveta">
            <label className="rotulo" htmlFor="wiki-busca">Buscar na wiki</label>
            <input
              id="wiki-busca" className="campo-busca" type="search" value={busca}
              onChange={(e) => setBusca(e.target.value)} aria-label="Buscar na wiki"
            />
            {filtrados.map((c) => (
              <button
                key={c.id} className={`wiki-item${c.id === atual.id ? ' ativo' : ''}`}
                onClick={() => { setBalao(null); setAtualId(c.id); setIndiceAberto(false); }}
              >
                {c.titulo}
              </button>
            ))}
            {filtrados.length === 0 && <p className="sub">Nada encontrado.</p>}
          </nav>
        </>
      )}
    </div>
  );
}
```

Notas:
- O link externo sempre abre em nova aba (`#` agora é sempre interno).
- O balão fica dentro do `article`, que ganha `position: relative` no CSS; por isso a largura do balão é a do corpo da wiki.
- O termo dentro do glossário também abre balão (mesmo `Trechos`).

- [ ] **Passo 4: CSS em `src/styles.css`**

Trocar `.wiki-corpo { max-width: 70ch; }` por:

```css
.wiki-corpo { max-width: 70ch; position: relative; }
```

Logo depois de `.wiki-titulo { margin-top: 4px; }`, acrescentar:

```css
.wiki-link { color: var(--ac); text-underline-offset: 3px; }
/* Termo do glossário: cor do texto, pontilhado apagado — não compete com o azul de ação. */
.wiki-termo {
  background: none; border: none; padding: 0; font: inherit; color: var(--fg); cursor: pointer;
  text-decoration: underline dotted var(--muted); text-decoration-thickness: 2px; text-underline-offset: 4px;
}
.wiki-termo.aberto { color: var(--ac); text-decoration-color: var(--ac); }
/* Dentro de nota, termo e link herdam a cor da nota. */
.aviso .wiki-link, .aviso .wiki-termo { color: inherit; text-decoration-color: currentColor; }

.wiki-balao {
  position: absolute; left: 0; right: 0; z-index: 5;
  background: var(--surface2); border-radius: 18px; padding: 14px 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .5);
}
/* Setinha apontando para o meio do termo; --seta vem do Wiki.tsx. */
.wiki-balao::before {
  content: ''; position: absolute; top: -7px; left: var(--seta, 40px);
  width: 14px; height: 14px; background: var(--surface2); transform: rotate(45deg); border-radius: 3px;
}
/* Dois níveis de classe: precisa vencer .wiki-corpo p, que também alcança o balão. */
.wiki-balao .wiki-balao-termo { font-weight: 700; margin: 0 0 4px; }
.wiki-balao .wiki-balao-def { margin: 0; font-size: 15px; }
```

- [ ] **Passo 5: catálogo**

Em `docs/estilo/catalogo.md`, depois da linha de `.wiki-titulo`, acrescentar:

```markdown
| `.wiki-link` | link interno da wiki (outro capítulo ou seção) — `--ac`, sublinhado; dentro de `.aviso` herda a cor da nota |
| `.wiki-termo` | termo do glossário no texto da wiki — botão sem aparência de botão, `--fg` com sublinhado pontilhado em `--muted`; `.aberto` em `--ac` enquanto o balão está aberto |
| `.wiki-balao` | balão com a definição do termo, ancorado 10px abaixo da linha do termo, largura do corpo; `--surface2`, raio 18px, sombra; setinha (`::before`) posicionada por `--seta` |
| `.wiki-balao-termo` / `.wiki-balao-def` | termo em negrito e definição em 15px dentro do `.wiki-balao` |
```

E na linha de `.wiki-corpo`, acrescentar ao fim da descrição: `; position: relative (âncora do .wiki-balao)`.

- [ ] **Passo 6: rodar e ver passar**

Rodar: `npx vitest run src/ui/ajustes/Wiki.test.tsx src/ui/ajustes/capitulos.test.ts`
Esperado: PASSA.

Rodar: `node scripts/verificar-catalogo.mjs`
Esperado: nenhum aviso sobre `wiki-link`, `wiki-termo`, `wiki-balao`, `wiki-balao-termo`, `wiki-balao-def`.

Rodar: `npx tsc -b`
Esperado: sem erro.

- [ ] **Passo 7: commit**

```bash
git add src/ui/ajustes/Wiki.tsx src/ui/ajustes/Wiki.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat: wiki navega por links e mostra termos do glossário num balão"
```

---

### Tarefa 4: Documentação da wiki, seção "Wiki" em Ajustes e fragmento de changelog

**Arquivos:**
- Modificar: `docs/wiki/README.md`, `docs/wiki/7-ajustes.md`
- Criar: `changelog.d/alterado-wiki-hiperlinks.md`

- [ ] **Passo 1: `docs/wiki/README.md`**

Na tabela do subconjunto, trocar a linha de `Link interno` por duas linhas:

```markdown
| Link interno | `[texto](#capitulo)` ou `[texto](#capitulo/secao)` | `[Fronteira do hoje](#motor/fronteira-do-hoje-e-pendentes)` |
| Termo do glossário | `[[termo]]` ou `[texto](#glossario/termo)` | `[[pendente]]`, `[previstos](#glossario/previsto)` |
```

Substituir a subseção `### Links` inteira por:

```markdown
### Links

Três tipos de link são permitidos:

1. **Link interno** (`[texto](#capitulo)` ou `[texto](#capitulo/secao)`): leva a outro capítulo, ou a uma seção dele. Vale também para o próprio capítulo. O id do capítulo é o nome do arquivo sem o número (`4-motor.md` → `motor`); renumerar não quebra link. O id da seção é o título em minúsculas, sem acento, com hífens (`## Fronteira do hoje e pendentes` → `fronteira-do-hoje-e-pendentes`).

2. **Termo do glossário** (`[[termo]]`): abre a definição num balão, sem sair do capítulo. O id do termo segue a mesma regra do id de seção (`box casa` → `box-casa`). Forma diferente do termo usa a versão longa: `[previstos](#glossario/previsto)`. Termo em código: `` [[`efetivo`]] ``. Marque só a primeira ocorrência do termo em cada capítulo, e só quando o sentido é o do glossário.

3. **Link externo** (`[texto](url)`): aponta para um site e abre em nova aba.

Todo link interno é conferido por `npm test` (`validarLinks`, em `capitulos.test.ts`). Capítulo, seção ou termo inexistente reprova a suíte — e a mensagem diz em que capítulo está o link quebrado.
```

- [ ] **Passo 2: seção "Wiki" em `docs/wiki/7-ajustes.md`**

Ler o capítulo e pôr a seção na posição em que a Wiki aparece no menu de Ajustes (conferir a ordem em `src/ui/TelaAjustes.tsx`; se a Wiki for o último item, acrescentar no fim do arquivo). Texto:

```markdown
## Wiki

Esta documentação. O botão Índice abre a lista de capítulos e a busca, que procura no texto inteiro, sem acento e sem diferença de maiúscula.

- **Link azul:** leva a outro capítulo, ou a uma seção dele.
- **Termo com sublinhado pontilhado:** é um termo do glossário. Tocar nele abre a definição logo abaixo, sem sair do capítulo. Tocar fora, tocar de novo no termo ou rolar a tela fecha o balão.
```

- [ ] **Passo 3: fragmento de changelog**

Ler `changelog.d/README.md` para o formato. Criar `changelog.d/alterado-wiki-hiperlinks.md`:

```markdown
- A wiki agora tem links: um toque leva a outro capítulo ou a uma seção dele
  - Termos do glossário ficam com sublinhado pontilhado e mostram a definição logo abaixo, sem sair do capítulo
```

(Ajustar ao formato exato que o `changelog.d/README.md` pedir.)

- [ ] **Passo 4: verificação completa**

Rodar: `npx vitest run src/ui/ajustes/capitulos.test.ts` — PASSA.
Rodar: `npm test` — tudo verde. Se o dossiê acusar desatualizado, rodar `npm run dossie` e incluir `docs/dossie/` no commit.
Rodar: `npm run build` — sem erro.
Rodar: `node scripts/verificar-dados-reais.mjs` — sem achado nos arquivos novos.

- [ ] **Passo 5: commit**

```bash
git add docs/wiki changelog.d/alterado-wiki-hiperlinks.md
git commit -m "docs: README da wiki, seção Wiki em Ajustes e fragmento de changelog"
```

A confirmação do changelog com o usuário, o merge, o release e o deploy seguem a skill `ciclo-de-entrega` — fora deste plano.
