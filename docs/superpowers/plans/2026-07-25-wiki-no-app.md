# Wiki dentro do app — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA — use `superpowers:subagent-driven-development`
> (recomendada) ou `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixinhas (`- [ ]`) para acompanhamento.

**Objetivo:** trocar o link externo de `src/ui/ajustes/Wiki.tsx` por uma wiki versionada,
offline, escrita para quem nunca usou o app — capítulos em `docs/wiki/*.md` renderizados dentro
do Flow, com índice em gaveta, busca e nomes de exemplo sorteados.

**Arquitetura:** os capítulos entram no bundle por `import.meta.glob('…/docs/wiki/*.md', '?raw')`
— mesmo mecanismo que `Versao.tsx` já usa com o `CHANGELOG.md`. Um parser próprio
(`src/ui/ajustes/wiki.ts`) converte cada arquivo numa árvore de blocos tipada; `Wiki.tsx` renderiza
um capítulo por vez, com o índice numa gaveta lateral. Nenhuma dependência nova: o markdown
aceito é um **subconjunto fechado e verificado por teste**, não markdown genérico.

**Stack:** React 18 + TypeScript, Vitest + Testing Library, CSS próprio em `src/styles.css`.

## Restrições globais

- **Português** em código, UI, testes e documentação.
- **Nenhuma dependência npm nova** — nem `devDependency`. O renderizador é código próprio.
- **Nenhum dado financeiro real** em nada que entre no repositório. O conteúdo já foi
  despersonalizado; o guard `verificar-dados-reais.mjs --strict` roda no release e bloqueia.
- **Edição de UI exige `docs/estilo-visual.md`** antes de tocar em `src/ui/**` ou `src/styles.css`;
  classe ou componente novo se cataloga em `docs/estilo/catalogo.md` **no mesmo commit**, senão o
  guard do catálogo aborta o release.
- **Sem `{ timeout: n }`** em `findBy*`/`waitFor` — os timeouts globais já são generosos
  (`vite.config.ts` e `src/test-setup.ts`).
- Mudança **visível ao usuário** → fragmento em `changelog.d/`, release e deploy no fim (skill
  `ciclo-de-entrega`).

## De onde vem o conteúdo e as decisões

O material de origem é o mockup aprovado nesta sessão:
`C:\Users\eitor\Claude\flow-wiki-despersonalizada-2026-07-25.html` (fora do repositório). Ele já
está despersonalizado, tem a seção "Os primeiros passos", a seção "Código e versão", o índice em
gaveta e o sorteio de nomes. **Ele é a referência visual e de conteúdo deste plano** — as
decisões de produto por trás dele estão no item 1 do `TODO.md` local.

Decisões já tomadas (não reabrir durante a execução):

| Decisão | Escolha |
|---|---|
| Recorte dos capítulos | um arquivo por grupo do índice (9 arquivos) |
| Busca | filtra o índice; sem trechos nem destaque |
| Índice no celular | gaveta lateral com botão fixo |
| Nomes de exemplo | sorteados a cada abertura da tela |
| Links do repositório | intencionais — o app é open source |

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `docs/wiki/1-primeiros-passos.md` … `9-codigo.md` | conteúdo, um por grupo do índice |
| `docs/wiki/README.md` | o subconjunto de markdown aceito e por que ele é fechado |
| `src/ui/ajustes/wiki.ts` | parser (blocos + inline), sorteio e substituição de nomes, texto para busca |
| `src/ui/ajustes/wiki.test.ts` | testes do parser, incluindo a guarda de sintaxe não suportada |
| `src/ui/ajustes/Wiki.tsx` | tela: capítulo atual, gaveta do índice, busca |
| `src/ui/ajustes/Wiki.test.tsx` | testes da tela |
| `src/styles.css` | classes `.wiki-*` |
| `docs/estilo/catalogo.md` | catalogação das classes e do componente |
| `changelog.d/adicionado-wiki-no-app.md` | fragmento (visível ao usuário) |

---

### Tarefa 1: parser dos capítulos

**Arquivos:**
- Criar: `src/ui/ajustes/wiki.ts`
- Testar: `src/ui/ajustes/wiki.test.ts`

**Interfaces:**
- Consome: nada.
- Produz: `type Inline`, `type Bloco`, `interface Capitulo`, `sortearNomes(aleatorio?)`,
  `parseCapitulo(id, raw, nomes)`, `NOMES`.

O subconjunto aceito, e nada além dele:

```
# Título do capítulo          (uma vez, primeira linha)
## Tópico                     (vira <h3>)
parágrafo solto
- item de lista
> nota em destaque
: `termo` | definição         (linha de campos: termo | definição)

inline: **forte**, `código`, [texto](destino), {{nomeA}} {{nomeB}} {{boxA}} {{boxB}}
```

Qualquer outra marcação (`###`, tabela com `|` no começo, `*item`, `1.`, `![img]`) é **erro** —
o parser lança. É o contrário de ignorar em silêncio: capítulo com sintaxe não suportada quebra
o teste em vez de renderizar torto.

- [ ] **Passo 1: escrever os testes que falham**

```ts
// src/ui/ajustes/wiki.test.ts
import { describe, it, expect } from 'vitest';
import { NOMES, parseCapitulo, sortearNomes } from './wiki';

const NOMES_FIXOS = { a: 'Ana', b: 'Bruno' };

describe('sortearNomes', () => {
  it('devolve dois nomes distintos do conjunto', () => {
    const { a, b } = sortearNomes(() => 0.5);
    expect(NOMES).toContain(a);
    expect(NOMES).toContain(b);
    expect(a).not.toBe(b);
  });

  it('nunca repete o nome, mesmo quando o sorteio cai no mesmo índice', () => {
    // aleatorio() constante = i e j calculados a partir do mesmo número
    for (const constante of [0, 0.25, 0.5, 0.75, 0.999]) {
      const { a, b } = sortearNomes(() => constante);
      expect(a).not.toBe(b);
    }
  });
});

describe('parseCapitulo', () => {
  it('lê o título e os blocos na ordem', () => {
    const cap = parseCapitulo('teste', '# Primeiros passos\n\nUm parágrafo.\n\n## A primeira box\n\n- item um\n- item dois\n', NOMES_FIXOS);
    expect(cap.id).toBe('teste');
    expect(cap.titulo).toBe('Primeiros passos');
    expect(cap.blocos.map((b) => b.tipo)).toEqual(['paragrafo', 'topico', 'lista']);
  });

  it('junta linhas seguidas num parágrafo só', () => {
    const cap = parseCapitulo('t', '# T\n\nlinha um\nlinha dois\n\nlinha três\n', NOMES_FIXOS);
    const paragrafos = cap.blocos.filter((b) => b.tipo === 'paragrafo');
    expect(paragrafos).toHaveLength(2);
    expect(cap.texto).toContain('linha um linha dois');
  });

  it('reconhece nota, campos e lista', () => {
    const raw = '# T\n\n> uma nota\n\n: `saldoInicial` | centavos\n: `ativa` | pausar não apaga\n\n- só um item\n';
    const cap = parseCapitulo('t', raw, NOMES_FIXOS);
    expect(cap.blocos.map((b) => b.tipo)).toEqual(['nota', 'campos', 'lista']);
    const campos = cap.blocos[1];
    if (campos.tipo !== 'campos') throw new Error('bloco errado');
    expect(campos.itens).toHaveLength(2);
    expect(campos.itens[0].termo[0]).toEqual({ tipo: 'codigo', texto: 'saldoInicial' });
  });

  it('quebra o inline em forte, código e link', () => {
    const cap = parseCapitulo('t', '# T\n\numa **coisa** com `código` e [um link](#box).\n', NOMES_FIXOS);
    const bloco = cap.blocos[0];
    if (bloco.tipo !== 'paragrafo') throw new Error('bloco errado');
    expect(bloco.conteudo).toEqual([
      { tipo: 'texto', texto: 'uma ' },
      { tipo: 'forte', texto: 'coisa' },
      { tipo: 'texto', texto: ' com ' },
      { tipo: 'codigo', texto: 'código' },
      { tipo: 'texto', texto: ' e ' },
      { tipo: 'link', texto: 'um link', href: '#box' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('troca os marcadores de nome, em prosa e em nome de box', () => {
    const cap = parseCapitulo('t', '# T\n\n{{nomeA}} e {{nomeB}} usam `{{boxA}}` e `{{boxB}}`.\n', NOMES_FIXOS);
    expect(cap.texto).toContain('Ana e Bruno usam ana e bruno');
  });

  it('recusa sintaxe fora do subconjunto', () => {
    expect(() => parseCapitulo('t', '# T\n\n### fundo demais\n', NOMES_FIXOS)).toThrow(/não suportada/);
    expect(() => parseCapitulo('t', '# T\n\n| a | b |\n', NOMES_FIXOS)).toThrow(/não suportada/);
    expect(() => parseCapitulo('t', '# T\n\n1. primeiro\n', NOMES_FIXOS)).toThrow(/não suportada/);
  });

  it('recusa capítulo sem título', () => {
    expect(() => parseCapitulo('t', 'sem título\n', NOMES_FIXOS)).toThrow(/título/);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/ui/ajustes/wiki.test.ts`
Esperado: FAIL — `Failed to resolve import "./wiki"`.

- [ ] **Passo 3: implementar o parser**

```ts
// src/ui/ajustes/wiki.ts
// Renderizador próprio, com um subconjunto FECHADO de markdown — ver docs/wiki/README.md.
// Fechado de propósito: sintaxe não suportada lança em vez de ser ignorada, porque parser
// que engole o que não entende produz capítulo torto sem ninguém perceber.

export type Inline =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'forte'; texto: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'link'; texto: string; href: string };

export type Bloco =
  | { tipo: 'paragrafo'; conteudo: Inline[] }
  | { tipo: 'topico'; titulo: string; id: string }
  | { tipo: 'lista'; itens: Inline[][] }
  | { tipo: 'nota'; conteudo: Inline[] }
  | { tipo: 'campos'; itens: { termo: Inline[]; definicao: Inline[] }[] };

export interface Capitulo {
  id: string;
  titulo: string;
  blocos: Bloco[];
  /** tudo em texto puro, sem marcação — é sobre isto que a busca roda */
  texto: string;
}

export interface Nomes { a: string; b: string }

/** Nomes de exemplo. Sorteados a cada abertura para não parecerem o dono do app. */
export const NOMES = [
  'Ana', 'Bruno', 'Carla', 'Davi', 'Elisa', 'Felipe', 'Gabi', 'Igor',
  'Lara', 'Mateus', 'Nina', 'Otávio', 'Paula', 'Rafa', 'Sofia', 'Tiago',
];

export function sortearNomes(aleatorio: () => number = Math.random): Nomes {
  const i = Math.floor(aleatorio() * NOMES.length) % NOMES.length;
  let j = Math.floor(aleatorio() * (NOMES.length - 1)) % (NOMES.length - 1);
  if (j >= i) j += 1; // pula o já sorteado: dois nomes sempre distintos
  return { a: NOMES[i], b: NOMES[j] };
}

function aplicarNomes(texto: string, nomes: Nomes): string {
  return texto
    .replace(/\{\{nomeA\}\}/g, nomes.a)
    .replace(/\{\{nomeB\}\}/g, nomes.b)
    .replace(/\{\{boxA\}\}/g, nomes.a.toLowerCase())
    .replace(/\{\{boxB\}\}/g, nomes.b.toLowerCase());
}

const RE_INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;

export function parseInline(texto: string): Inline[] {
  const partes: Inline[] = [];
  for (const pedaco of texto.split(RE_INLINE)) {
    if (!pedaco) continue;
    if (pedaco.startsWith('**') && pedaco.endsWith('**')) {
      partes.push({ tipo: 'forte', texto: pedaco.slice(2, -2) });
    } else if (pedaco.startsWith('`') && pedaco.endsWith('`')) {
      partes.push({ tipo: 'codigo', texto: pedaco.slice(1, -1) });
    } else if (pedaco.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(pedaco);
      if (m) partes.push({ tipo: 'link', texto: m[1], href: m[2] });
    } else {
      partes.push({ tipo: 'texto', texto: pedaco });
    }
  }
  return partes;
}

/** Identificador de âncora a partir do título do tópico. */
export function idDoTopico(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const NAO_SUPORTADA = /^(#{3,}\s|\||\d+\.\s|\*\s|!\[|\t)/;

export function parseCapitulo(id: string, raw: string, nomes: Nomes): Capitulo {
  const linhas = aplicarNomes(raw, nomes).split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  let titulo = '';
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    if (paragrafo.length === 0) return;
    blocos.push({ tipo: 'paragrafo', conteudo: parseInline(paragrafo.join(' ')) });
    paragrafo = [];
  };

  for (const linha of linhas) {
    if (linha.trim() === '') { fecharParagrafo(); continue; }
    if (NAO_SUPORTADA.test(linha)) {
      throw new Error(`wiki: sintaxe não suportada no capítulo "${id}": ${linha.slice(0, 40)}`);
    }
    if (linha.startsWith('# ')) {
      fecharParagrafo();
      titulo = linha.slice(2).trim();
      continue;
    }
    if (linha.startsWith('## ')) {
      fecharParagrafo();
      const t = linha.slice(3).trim();
      blocos.push({ tipo: 'topico', titulo: t, id: idDoTopico(t) });
      continue;
    }
    if (linha.startsWith('> ')) {
      fecharParagrafo();
      blocos.push({ tipo: 'nota', conteudo: parseInline(linha.slice(2).trim()) });
      continue;
    }
    if (linha.startsWith('- ')) {
      fecharParagrafo();
      const item = parseInline(linha.slice(2).trim());
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.tipo === 'lista') ultimo.itens.push(item);
      else blocos.push({ tipo: 'lista', itens: [item] });
      continue;
    }
    if (linha.startsWith(': ')) {
      fecharParagrafo();
      const [termo, ...resto] = linha.slice(2).split('|');
      const item = { termo: parseInline(termo.trim()), definicao: parseInline(resto.join('|').trim()) };
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.tipo === 'campos') ultimo.itens.push(item);
      else blocos.push({ tipo: 'campos', itens: [item] });
      continue;
    }
    paragrafo.push(linha.trim());
  }
  fecharParagrafo();

  if (!titulo) throw new Error(`wiki: capítulo "${id}" sem título (primeira linha "# ...")`);

  const texto = textoPuro(titulo, blocos);
  return { id, titulo, blocos, texto };
}

function inlineTexto(partes: Inline[]): string {
  return partes.map((p) => p.texto).join('');
}

function textoPuro(titulo: string, blocos: Bloco[]): string {
  const pedacos = [titulo];
  for (const b of blocos) {
    if (b.tipo === 'topico') pedacos.push(b.titulo);
    else if (b.tipo === 'lista') pedacos.push(...b.itens.map(inlineTexto));
    else if (b.tipo === 'campos') pedacos.push(...b.itens.map((i) => `${inlineTexto(i.termo)} ${inlineTexto(i.definicao)}`));
    else pedacos.push(inlineTexto(b.conteudo));
  }
  return pedacos.join(' ');
}

/** Normaliza para busca: sem acento, sem caixa. */
export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
```

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/ui/ajustes/wiki.test.ts`
Esperado: PASS, 8 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/ui/ajustes/wiki.ts src/ui/ajustes/wiki.test.ts
git commit -m "Parser dos capitulos da wiki, com subconjunto fechado de markdown"
```

---

### Tarefa 2: os capítulos

**Arquivos:**
- Criar: `docs/wiki/1-primeiros-passos.md`, `2-visao-geral.md`, `3-conceitos.md`, `4-motor.md`,
  `5-cartao.md`, `6-telas.md`, `7-ajustes.md`, `8-glossario.md`, `9-codigo.md`
- Criar: `docs/wiki/README.md`
- Testar: `src/ui/ajustes/wiki.test.ts` (acrescentar o bloco de guarda)

**Interfaces:**
- Consome: `parseCapitulo` da Tarefa 1.
- Produz: os nove arquivos, com títulos e âncoras que a Tarefa 3 lista.

Fonte do conteúdo: as nove `<section class="sec">` do mockup, na ordem — `primeiros`,
`visao-geral`, `conceitos`, `motor`, `cartao`, `telas`, `ajustes`, `glossario`, `codigo`.
Conversão mecânica:

| No mockup | No markdown |
|---|---|
| `<h2>` da seção | `# Título` |
| `<h3>` do bloco | `## Título` |
| `<p>` | parágrafo |
| `<ul><li>` | `- item` |
| `<div class="nota">` | `> nota` |
| `<dl class="campos">` (`dt`/`dd`) | `: termo \| definição` |
| `<p class="campos-req">` | parágrafo comum, começando com `**Obrigatórios:**` |
| `<table class="tabela">` do glossário | linhas `: termo \| significado` |
| `<span class="pill">efetivo</span>` | `` `efetivo` `` |
| `Ana`/`Bruno`/`ana`/`bruno` | `{{nomeA}}`/`{{nomeB}}`/`{{boxA}}`/`{{boxB}}` |
| `href="#ancora"` | `[texto](#ancora)` |

A tabela do glossário vira lista de campos porque o subconjunto não tem tabela — e não deve
ter: tabela em tela de 375px é o defeito que já apareceu no mockup.

**Os títulos são contrato:** a Tarefa 3 testa o índice pelo nome do capítulo, então use
exatamente estes na linha `# `:

| Arquivo | `# Título` |
|---|---|
| `1-primeiros-passos.md` | Os primeiros passos |
| `2-visao-geral.md` | Visão geral |
| `3-conceitos.md` | Conceitos e modelo de dados |
| `4-motor.md` | Motor por baixo dos panos |
| `5-cartao.md` | Cartão de crédito |
| `6-telas.md` | Telas |
| `7-ajustes.md` | Ajustes |
| `8-glossario.md` | Glossário |
| `9-codigo.md` | Código e versão |

- [ ] **Passo 1: escrever a guarda que falha**

Acrescentar ao fim de `src/ui/ajustes/wiki.test.ts`:

```ts
describe('capítulos de docs/wiki', () => {
  const brutos = import.meta.glob('../../../docs/wiki/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const arquivos = Object.entries(brutos).filter(([caminho]) => !caminho.endsWith('README.md'));

  it('existem nove capítulos numerados', () => {
    expect(arquivos).toHaveLength(9);
  });

  it.each(arquivos)('%s parseia e não deixa marcação crua', (caminho, raw) => {
    const cap = parseCapitulo(caminho, raw, NOMES_FIXOS);
    expect(cap.titulo.length).toBeGreaterThan(0);
    expect(cap.blocos.length).toBeGreaterThan(0);
    // marcação que sobrou é sinal de sintaxe que o parser não entendeu
    expect(cap.texto).not.toMatch(/\*\*|`|\]\(|\{\{/);
  });

  it('nenhum capítulo cita nome de pessoa fixo no lugar do marcador', () => {
    for (const [, raw] of arquivos) {
      expect(raw).not.toMatch(/\bAna\b|\bBruno\b/);
    }
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/ui/ajustes/wiki.test.ts -t "capítulos"`
Esperado: FAIL — `expected [] to have length 9`.

- [ ] **Passo 3: escrever os nove capítulos e o README**

Converter cada seção do mockup conforme a tabela acima. Exemplo do começo do primeiro arquivo,
para fixar o formato:

```markdown
# Os primeiros passos

O Flow começa **vazio**: sem box, sem categoria, sem cartão — nem a box "casa" vem pronta.
Nada é criado para você, porque nada é enviado para lugar nenhum. Esta é a ordem que funciona,
do zero até o app fazendo sentido.

> Já usa o Flow em outro aparelho? Não refaça nada: vá em Ajustes, Backup, e importe o arquivo
> `.json` exportado do aparelho antigo. Ele traz tudo.

## A primeira box

Uma box é um fluxo de caixa com saldo próprio — normalmente uma conta de banco. É o primeiro
passo porque todo o resto pendura nela. Fica em Ajustes, Boxes.

- **Saldo inicial:** o saldo que o app do seu banco mostra agora. Pode ser negativo.
- **Data:** o dia a que esse saldo se refere — normalmente hoje.
- **Box compartilhada:** deixar o saldo em branco cria uma box sem saldo próprio. É assim que
  se cria a box "casa", onde entram os gastos divididos.

**Obrigatório:** nome. **Têm padrão:** saldo inicial (0), data (hoje).
```

Atenção na conversão: a nota `>` é uma linha só por bloco — quebra de linha dentro dela vira
outro bloco. Se precisar de duas frases, mantenha na mesma linha.

`docs/wiki/README.md` documenta o subconjunto (a tabela de sintaxe acima), diz que sintaxe fora
dele **lança**, e explica os quatro marcadores de nome.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/ui/ajustes/wiki.test.ts`
Esperado: PASS — 8 testes do parser + 11 da guarda (9 capítulos + 2).

- [ ] **Passo 5: commitar**

```bash
git add docs/wiki src/ui/ajustes/wiki.test.ts
git commit -m "Capitulos da wiki em docs/wiki, com guarda de sintaxe"
```

---

### Tarefa 3: a tela

**Arquivos:**
- Substituir: `src/ui/ajustes/Wiki.tsx` (hoje 27 linhas, só um link externo)
- Testar: `src/ui/ajustes/Wiki.test.tsx` (novo — é o único arquivo de `src/ui/ajustes/` sem teste)

**Interfaces:**
- Consome: `parseCapitulo`, `sortearNomes`, `normalizar`, `Capitulo`, `Bloco`, `Inline` da Tarefa 1;
  os nove arquivos da Tarefa 2.
- Produz: a tela; nenhuma API para outras tarefas.

- [ ] **Passo 1: escrever os testes que falham**

```tsx
// src/ui/ajustes/Wiki.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wiki from './Wiki';

describe('Wiki', () => {
  it('abre no primeiro capítulo', async () => {
    render(<Wiki />);
    expect(await screen.findByRole('heading', { name: 'Os primeiros passos' })).toBeInTheDocument();
  });

  it('troca de capítulo pelo índice', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Glossário' }));
    expect(await screen.findByRole('heading', { name: 'Glossário' })).toBeInTheDocument();
  });

  it('a busca filtra o índice, sem acento e sem caixa', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'CARTAO');
    expect(await screen.findByRole('button', { name: 'Cartão de crédito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Glossário' })).not.toBeInTheDocument();
  });

  it('avisa quando a busca não acha nada', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.type(screen.getByLabelText('Buscar na wiki'), 'jabuticaba');
    expect(await screen.findByText(/nada encontrado/i)).toBeInTheDocument();
  });

  it('usa nomes do conjunto nos exemplos, nunca um nome fixo', async () => {
    render(<Wiki />);
    await userEvent.click(screen.getByRole('button', { name: 'Índice' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Conceitos e modelo de dados' }));
    const corpo = await screen.findByRole('article');
    expect(corpo.textContent).not.toMatch(/\{\{/);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run src/ui/ajustes/Wiki.test.tsx`
Esperado: FAIL — não existe botão "Índice"; a tela ainda é o link externo.

- [ ] **Passo 3: escrever a tela**

Antes de escrever: ler `docs/estilo-visual.md` e o capítulo do nível correspondente (é
componente e classes novas). Estrutura:

```tsx
// src/ui/ajustes/Wiki.tsx
import { useMemo, useState } from 'react';
import { normalizar, parseCapitulo, sortearNomes, type Bloco, type Capitulo, type Inline } from './wiki';

const BRUTOS = import.meta.glob('../../../docs/wiki/*.md', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

function idDoArquivo(caminho: string): string {
  return caminho.split('/').pop()!.replace(/\.md$/, '');
}

function Trechos({ partes }: { partes: Inline[] }) {
  return (
    <>
      {partes.map((p, i) => {
        if (p.tipo === 'forte') return <strong key={i}>{p.texto}</strong>;
        if (p.tipo === 'codigo') return <code key={i}>{p.texto}</code>;
        if (p.tipo === 'link') return <a key={i} href={p.href} target={p.href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{p.texto}</a>;
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
      {bloco.itens.map((item, i) => (
        <div key={i}>
          <dt><Trechos partes={item.termo} /></dt>
          <dd><Trechos partes={item.definicao} /></dd>
        </div>
      ))}
    </dl>
  );
}

export default function Wiki() {
  const [nomes] = useState(() => sortearNomes());
  const capitulos: Capitulo[] = useMemo(
    () => Object.entries(BRUTOS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([caminho, raw]) => parseCapitulo(idDoArquivo(caminho), raw, nomes)),
    [nomes],
  );
  const [atualId, setAtualId] = useState(capitulos[0].id);
  const [indiceAberto, setIndiceAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const alvo = normalizar(busca.trim());
  const filtrados = alvo ? capitulos.filter((c) => normalizar(c.texto).includes(alvo)) : capitulos;
  const atual = capitulos.find((c) => c.id === atualId) ?? capitulos[0];

  return (
    <div className="tela">
      <h2>Wiki</h2>
      <button className="botao wiki-abrir-indice" onClick={() => setIndiceAberto(true)}>☰ Índice</button>

      <article className="wiki-corpo">
        <h3 className="wiki-titulo">{atual.titulo}</h3>
        {atual.blocos.map((b, i) => <BlocoRender key={i} bloco={b} />)}
      </article>

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
                onClick={() => { setAtualId(c.id); setIndiceAberto(false); }}
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

Classes reaproveitadas, todas já catalogadas: `.tela`, `.botao`, `.campo-busca`, `.rotulo`,
`.aviso` (a nota em destaque) e `.sub`. As `.wiki-*` são as únicas novas — e por isso vão para o
catálogo na Tarefa 4.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `npx vitest run src/ui/ajustes/Wiki.test.tsx`
Esperado: PASS, 5 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/ui/ajustes/Wiki.tsx src/ui/ajustes/Wiki.test.tsx
git commit -m "Wiki dentro do app: capitulo, indice em gaveta e busca"
```

---

### Tarefa 4: estilo, catálogo e fechamento

**Arquivos:**
- Modificar: `src/styles.css` (classes `.wiki-*`)
- Modificar: `docs/estilo/catalogo.md`
- Criar: `changelog.d/adicionado-wiki-no-app.md`

- [ ] **Passo 1: escrever o CSS**

Ao fim de `src/styles.css`, usando só tokens que já existem (`--surface`, `--surface2`,
`--line`, `--muted`, `--ac`, `--ac-dim`). O `z-index` acompanha o `.sheet-backdrop` (50), que é
o modal mais alto do app hoje:

```css
/* --- Wiki ------------------------------------------------------------- */
.wiki-abrir-indice { align-self: flex-start; }

.wiki-corpo { max-width: 70ch; }
.wiki-corpo h3 { margin: 22px 0 6px; font-size: 17px; }
.wiki-corpo p { margin: 0 0 10px; }
.wiki-corpo ul { margin: 0 0 12px; padding-left: 20px; }
.wiki-corpo li { margin-bottom: 5px; }
/* nome de campo longo quebra em vez de empurrar a página para o lado */
.wiki-corpo code { overflow-wrap: anywhere; }
.wiki-titulo { margin-top: 4px; }

/* Empilhado de propósito: duas colunas numa tela de 375px viram um filete
   ilegível — foi o defeito visto no mockup em 2026-07-25. */
.wiki-campos { margin: 4px 0 14px; }
.wiki-campos dt { color: var(--muted); font-size: 13px; margin-top: 10px; }
.wiki-campos dd { margin: 2px 0 0; }

.wiki-fundo {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(0, 0, 0, .55); border: none; padding: 0;
}
.wiki-gaveta {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 51;
  width: min(86vw, 330px); padding: 16px 14px;
  background: var(--surface); border-right: 1px solid var(--line);
  overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: 6px;
}
.wiki-item {
  background: none; border: none; border-radius: 10px;
  padding: 10px 12px; text-align: left; min-height: 44px;
}
.wiki-item.ativo { background: var(--ac-dim); color: var(--ac); }
```

- [ ] **Passo 2: catalogar**

Acrescentar em `docs/estilo/catalogo.md` cada classe `.wiki-*` criada e o componente `Wiki`.
Rodar: `node scripts/verificar-catalogo.mjs`
Esperado: `✓ Catálogo e código em dia.`

- [ ] **Passo 3: suíte completa**

Rodar: `npm test`
Esperado: todos verdes, incluindo os ~24 testes novos.

- [ ] **Passo 4: fragmento de changelog**

```markdown
- Wiki: a documentação do app agora abre dentro do Flow, offline, sem depender de link externo.
- Wiki: índice por capítulos com busca, e uma seção de primeiros passos para quem está começando.
```

- [ ] **Passo 5: commitar**

```bash
git add src/styles.css docs/estilo/catalogo.md changelog.d/adicionado-wiki-no-app.md
git commit -m "Estilo da wiki, catalogo e fragmento de changelog"
```

---

## Verificação de ponta a ponta

1. `npm test` — suíte inteira verde.
2. `npm run build` — o `?raw` dos nove capítulos entra no bundle sem erro de tipo.
3. `node scripts/verificar-catalogo.mjs` e `node scripts/verificar-dados-reais.mjs` — ambos limpos.
4. `npm run dev`, ir em Ajustes → Wiki e conferir **no celular** (é o alvo do app):
   - o botão do índice alcança a gaveta de qualquer ponto do capítulo;
   - a gaveta fecha ao escolher capítulo e ao tocar fora;
   - recarregar troca os nomes de exemplo;
   - nenhuma coluna ou bloco de código estoura a largura da tela;
   - os links externos da seção "Código e versão" abrem fora do app.
5. Fechar pelo `ciclo-de-entrega`: fragmento já existe → merge na `main` → `npm run release -- minor`
   → push → `npm run deploy`.

## O que este plano não faz

- **Não corrige a defasagem do conteúdo** herdada do artifact (ele documenta um commit antigo).
  Ao converter, tirar as referências a número de item do `TODO.md` e a commit; a versão do app
  é responsabilidade da tela Ajustes → Versão.
- **Não implementa busca com trechos e destaque** — decisão registrada: a busca filtra o índice.
- **Não mexe na aba Simular** (item 16 do backlog) nem no primeiro preenchimento guiado (item 2),
  ainda que a wiki fale dos dois.
