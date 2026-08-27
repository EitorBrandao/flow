# Changelog com dois níveis (tópico e detalhe) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer `changelog.d/`, `scripts/release.mjs`, o `CHANGELOG.md` gerado e a tela
Ajustes → Versão aceitarem e exibirem um segundo nível — detalhe indentado sob um tópico —
em vez de só bullets planos do mesmo nível.

**Architecture:** Um fragmento passa a ter linhas de três tipos: tópico (`- ` na coluna 0),
detalhe (`  - `, exatamente 2 espaços) e continuação (qualquer outra linha indentada, que
gruda no texto do bullet mais recente). `scripts/release.mjs` valida e monta essas linhas em
`{ texto, detalhes: string[] }[]` por seção, e escreve o `CHANGELOG.md` como lista markdown
aninhada. `src/ui/ajustes/changelog.ts` lê essa mesma estrutura de volta (do `CHANGELOG.md`
inteiro, incluindo o histórico antigo, 100% plano). `Versao.tsx` renderiza o detalhe como uma
`<ul>` aninhada, subordinada ao tópico.

**Tech Stack:** Node.js (script), TypeScript + React (UI), Vitest (testes).

## Global Constraints

- Todo texto voltado ao usuário (README, CLAUDE.md, mensagens de erro, UI, commits) é em
  português, sem termo solto em inglês.
- Nenhum dado financeiro real em nenhum arquivo versionado — testes e exemplos usam só texto
  sintético.
- Toda classe CSS nova entra em `docs/estilo/catalogo.md` no mesmo commit que a introduz.
- Não usar `{ timeout: n }` local em `findBy*`/`waitFor` — os timeouts globais (`vite.config.ts`,
  `src/test-setup.ts`) já são generosos de propósito.
- Todo trabalho deste plano acontece no worktree `.worktrees/changelog-niveis` (branch
  `changelog-niveis`), nunca direto na `main`.
- Edição de UI (`src/ui/**`, `src/styles.css`) segue `docs/estilo-visual.md`; a Task 3 inclui
  o passo de mockup aprovado antes da implementação, como o ciclo de entrega exige.
- Spec de referência: `docs/superpowers/specs/2026-08-20-changelog-niveis-design.md`.

---

### Task 1: `scripts/release.mjs` — tópico e detalhe no guard e na montagem do changelog

**Files:**
- Modify: `scripts/release.mjs:6-29` (comentário de topo), `scripts/release.mjs:157-223`
  (`coletarFragmentos` e `montarSecao`)
- Test: `scripts/release.test.mjs:282-336` (substituir dois testes), mais 3 testes novos

**Interfaces:**
- Consumes: nada de outra task — mudança isolada neste arquivo.
- Produces: nenhuma interface pública nova (script standalone). O formato de linha que ele
  valida (`- tópico`, `  - detalhe`, continuação) é o mesmo formato que a Task 2 lê de volta em
  `src/ui/ajustes/changelog.ts` — mantenha os dois em sincronia se um mudar depois.

- [ ] **Step 1: Substituir os dois testes de indentação por seu novo comportamento, e escrever os testes que ainda faltam**

Em `scripts/release.test.mjs`, dentro do `describe('validação de formato', ...)`, **substitua**
os dois testes a seguir (atualmente nas linhas 282–336):

```js
it('deve abortar se linha começa com espaço/tab (com hífen)', () => { ... });
it('deve abortar se linha começa com espaço/tab (sem hífen)', () => { ... });
```

por estes quatro:

```js
    it('aceita detalhe indentado com exatamente 2 espaços como sub-item do tópico', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-com-detalhe.md'),
          '- Tópico principal.\n  - Detalhe do tópico.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(0);
        const changelogContent = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
        expect(changelogContent).toContain('- Tópico principal.');
        expect(changelogContent).toContain('  - Detalhe do tópico.');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('gruda linha indentada sem hífen no texto do tópico anterior (continuação)', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-continuacao.md'),
          '- Tópico que quebrou\n  a frase em duas linhas.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(0);
        const changelogContent = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
        expect(changelogContent).toContain('- Tópico que quebrou a frase em duas linhas.');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se detalhe não tem exatamente 2 espaços de indentação', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-indent-errada.md'),
          '- Tópico.\n    - Detalhe indentado demais.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('exatamente 2 espaços de indentação');
        expect(result.stderr).toContain('adicionado-indent-errada.md');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });

    it('deve abortar se um detalhe aparece antes de qualquer tópico', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-orfao.md'),
          '  - Detalhe sem tópico.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('detalhe sem tópico');
        expect(result.stderr).toContain('adicionado-orfao.md');

        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });
```

E, ainda dentro do `describe('fragmentos válidos', ...)`, acrescente este teste (mesmo nível dos
três que já existem ali):

```js
    it('mantém cada tópico com seus próprios detalhes ao juntar fragmentos diferentes', () => {
      const tmp = criarFixture();
      try {
        fs.writeFileSync(
          path.join(tmp, 'package.json'),
          JSON.stringify({ version: '1.0.0' }, null, 2)
        );
        fs.writeFileSync(path.join(tmp, 'CHANGELOG.md'), '# Changelog\n\n');
        fs.mkdirSync(path.join(tmp, 'changelog.d'));
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-a.md'),
          '- Tópico A.\n  - Detalhe A1.\n'
        );
        fs.writeFileSync(
          path.join(tmp, 'changelog.d', 'adicionado-b.md'),
          '- Tópico B.\n  - Detalhe B1.\n  - Detalhe B2.\n'
        );

        const result = executarRelease(tmp, 'patch');

        expect(result.exitCode).toBe(0);
        const changelogContent = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
        const linhas = changelogContent.split('\n').map((l) => l.trimEnd());
        const idxA = linhas.indexOf('- Tópico A.');
        const idxB = linhas.indexOf('- Tópico B.');
        expect(idxA).toBeGreaterThan(-1);
        expect(idxB).toBeGreaterThan(-1);
        expect(linhas[idxA + 1]).toBe('  - Detalhe A1.');
        expect(linhas[idxB + 1]).toBe('  - Detalhe B1.');
        expect(linhas[idxB + 2]).toBe('  - Detalhe B2.');
      } finally {
        fs.rmSync(tmp, { recursive: true });
      }
    });
```

- [ ] **Step 2: Rodar os testes e confirmar que falham do jeito esperado**

Run: `npx vitest run scripts/release.test.mjs`

Expected: FAIL — os dois testes novos de "aceita detalhe"/"continuação" falham porque hoje toda
linha indentada aborta; os testes de "indentação errada"/"órfão" falham porque a mensagem de
erro ainda não existe; o de "múltiplos fragmentos com detalhe" falha porque `  - Detalhe A1.`
não aparece no `CHANGELOG.md` (a linha some, tratada como órfã hoje).

- [ ] **Step 3: Atualizar o comentário de topo do arquivo**

Em `scripts/release.mjs`, troque a linha (dentro do bloco de comentário, na lista de
validações):

```js
//   - formato de bullet: cada linha deve começar com "- ", sem "**" ou indentação.
```

por:

```js
//   - formato de bullet: tópico começa com "- " na coluna 0; detalhe é "  - " (exatamente
//     2 espaços); qualquer outra indentação sem "- " é continuação do bullet anterior;
//     nenhuma linha pode conter "**".
```

- [ ] **Step 4: Reescrever `coletarFragmentos` e `montarSecao`**

Em `scripts/release.mjs`, substitua o bloco de `// --- 2. coletar fragmentos com validação`
até o fim de `montarSecao` (linhas 157–223 do arquivo atual) por:

```js
// --- 2. coletar fragmentos com validação --------------------------------
function coletarFragmentos(dir) {
  if (!fs.existsSync(dir)) return { itens: {}, arquivos: [] };
  const arquivos = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort();
  const itens = {};
  for (const nome of arquivos) {
    const tipo = nome.split('-')[0].toLowerCase();
    if (!SECOES.includes(tipo)) {
      abortar(`fragmento "${nome}" precisa começar com adicionado-, alterado- ou removido-.`);
    }
    const conteudoBruto = fs.readFileSync(path.join(dir, nome), 'utf8');
    const linhas = conteudoBruto
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+$/, ''));
    const linhasUteis = linhas.filter((l) => l.trim() !== '');

    // Guard: fragmento vazio
    if (linhasUteis.length === 0) {
      abortar(`fragmento vazio: "${nome}"`);
    }

    // Tópicos deste fragmento, cada um com seus próprios detalhes.
    const topicos = [];
    let topicoAtual = null;

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (linha.trim() === '') continue; // pula linhas vazias
      const numLinha = i + 1; // número da linha no arquivo (1-indexed)

      // Negrito nunca é permitido, em nenhum tipo de linha.
      if (linha.includes('**')) {
        abortar(
          `fragmento "${nome}" linha ${numLinha}: não pode conter "**" (negrito). Veja changelog.d/README.md.`
        );
      }

      // Tópico: "- " na coluna 0.
      const topicoMatch = /^- (.+)$/.exec(linha);
      if (topicoMatch) {
        topicoAtual = { texto: topicoMatch[1], detalhes: [] };
        topicos.push(topicoAtual);
        continue;
      }

      // Detalhe: exatamente 2 espaços + "- ".
      const detalheMatch = /^ {2}- (.+)$/.exec(linha);
      if (detalheMatch) {
        if (!topicoAtual) {
          abortar(
            `fragmento "${nome}" linha ${numLinha}: detalhe sem tópico — a primeira linha ` +
            `útil do fragmento precisa ser um tópico, sem indentação. Veja changelog.d/README.md.`
          );
        }
        topicoAtual.detalhes.push(detalheMatch[1]);
        continue;
      }

      // Indentação com "- " que não seja exatamente 2 espaços: não existe terceiro nível.
      if (/^\s*- /.test(linha)) {
        abortar(
          `fragmento "${nome}" linha ${numLinha}: detalhe precisa de exatamente 2 espaços de ` +
          `indentação. Veja changelog.d/README.md.`
        );
      }

      // Qualquer outra linha indentada: continuação do bullet mais recente (detalhe, se
      // houver algum; senão o próprio tópico).
      if (/^\s/.test(linha)) {
        if (!topicoAtual) {
          abortar(
            `fragmento "${nome}" linha ${numLinha}: linha indentada sem tópico anterior. ` +
            `Veja changelog.d/README.md.`
          );
        }
        const texto = linha.replace(/^\s+/, '');
        if (topicoAtual.detalhes.length > 0) {
          const ultimo = topicoAtual.detalhes.length - 1;
          topicoAtual.detalhes[ultimo] += ` ${texto}`;
        } else {
          topicoAtual.texto += ` ${texto}`;
        }
        continue;
      }

      // Não indentada e não começa com "- ".
      abortar(
        `fragmento "${nome}" linha ${numLinha}: deve começar com "- ". Veja changelog.d/README.md.`
      );
    }

    (itens[tipo] ??= []).push(...topicos);
  }
  return { itens, arquivos };
}

// --- 3. montar a seção de changelog ---------------------------------------
function montarSecao(versao, data, itens, eol) {
  const partes = [`## [${versao}] - ${data}`, ''];
  for (const tipo of SECOES) {
    const topicos = itens[tipo];
    if (!topicos || topicos.length === 0) continue;
    partes.push(`### ${TITULOS[tipo]}`, '');
    for (const topico of topicos) {
      partes.push(`- ${topico.texto}`);
      for (const detalhe of topico.detalhes) {
        partes.push(`  - ${detalhe}`);
      }
    }
    partes.push('');
  }
  return partes.join(eol);
}
```

- [ ] **Step 5: Rodar os testes de novo e confirmar que passam**

Run: `npx vitest run scripts/release.test.mjs`

Expected: PASS — todos os testes do arquivo, incluindo os que já existiam antes desta task.

- [ ] **Step 6: Commit**

```bash
git add scripts/release.mjs scripts/release.test.mjs
git commit -m "release: aceita tópico e detalhe no fragmento de changelog"
```

---

### Task 2: `src/ui/ajustes/changelog.ts` — `ChangelogItem` com detalhes

**Files:**
- Modify: `src/ui/ajustes/changelog.ts` (arquivo inteiro, 45 linhas)
- Test: `src/ui/ajustes/changelog.test.ts` (arquivo inteiro, 71 linhas)

**Interfaces:**
- Consumes: nada de outra task.
- Produces (consumido pela Task 3):
  ```ts
  export interface ChangelogItem { texto: string; detalhes: string[] }
  export interface ChangelogSecao { titulo: string; itens: ChangelogItem[] }
  export interface ChangelogVersao { versao: string; data: string; secoes: ChangelogSecao[] }
  export function parseChangelog(raw: string): ChangelogVersao[]
  ```

- [ ] **Step 1: Reescrever `changelog.test.ts` com os casos de tópico/detalhe**

Substitua o arquivo `src/ui/ajustes/changelog.test.ts` inteiro por:

```ts
import { parseChangelog } from './changelog';

const EXEMPLO = `# Changelog

texto introdutório qualquer.

## [0.2.0] - 2026-07-05

### Adicionado

- item novo A
- item novo B

### Removido

- item removido

## [0.1.0] - 2026-07-03

### Adicionado

- primeira versão
`;

it('agrupa versões em ordem, com data e seções', () => {
  const versoes = parseChangelog(EXEMPLO);
  expect(versoes).toHaveLength(2);
  expect(versoes[0].versao).toBe('0.2.0');
  expect(versoes[0].data).toBe('2026-07-05');
  expect(versoes[1].versao).toBe('0.1.0');
});

it('separa itens por seção dentro da mesma versão', () => {
  const [v020] = parseChangelog(EXEMPLO);
  expect(v020.secoes).toEqual([
    {
      titulo: 'Adicionado',
      itens: [
        { texto: 'item novo A', detalhes: [] },
        { texto: 'item novo B', detalhes: [] },
      ],
    },
    {
      titulo: 'Removido',
      itens: [{ texto: 'item removido', detalhes: [] }],
    },
  ]);
});

it('ignora texto fora de versão/seção', () => {
  const versoes = parseChangelog('texto solto\n- item órfão\n');
  expect(versoes).toEqual([]);
});

it('junta linhas de continuação de um tópico sem detalhe', () => {
  const comQuebra = `## [0.3.0] - 2026-07-19

### Alterado

- primeira linha do item
  segunda linha do mesmo item
  terceira linha do mesmo item.
- item seguinte, numa linha só
`;
  const [v030] = parseChangelog(comQuebra);
  expect(v030.secoes[0].itens).toEqual([
    {
      texto: 'primeira linha do item segunda linha do mesmo item terceira linha do mesmo item.',
      detalhes: [],
    },
    { texto: 'item seguinte, numa linha só', detalhes: [] },
  ]);
});

it('lida com quebras de linha CRLF (Windows)', () => {
  const crlf = EXEMPLO.replace(/\n/g, '\r\n');
  const versoes = parseChangelog(crlf);
  expect(versoes).toHaveLength(2);
  expect(versoes[0].versao).toBe('0.2.0');
  expect(versoes[0].data).toBe('2026-07-05');
  expect(versoes[0].secoes[0].itens).toEqual([
    { texto: 'item novo A', detalhes: [] },
    { texto: 'item novo B', detalhes: [] },
  ]);
});

it('reconhece detalhe indentado com exatamente 2 espaços sob um tópico', () => {
  const comDetalhe = `## [0.4.0] - 2026-07-20

### Adicionado

- Tópico principal.
  - Primeiro detalhe.
  - Segundo detalhe.
- Tópico sem detalhe.
`;
  const [v040] = parseChangelog(comDetalhe);
  expect(v040.secoes[0].itens).toEqual([
    { texto: 'Tópico principal.', detalhes: ['Primeiro detalhe.', 'Segundo detalhe.'] },
    { texto: 'Tópico sem detalhe.', detalhes: [] },
  ]);
});

it('junta continuação de linha no último detalhe, não no texto do tópico', () => {
  const comDetalheQuebrado = `## [0.5.0] - 2026-07-21

### Alterado

- Tópico.
  - Detalhe que quebrou
    numa segunda linha.
`;
  const [v050] = parseChangelog(comDetalheQuebrado);
  expect(v050.secoes[0].itens).toEqual([
    { texto: 'Tópico.', detalhes: ['Detalhe que quebrou numa segunda linha.'] },
  ]);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/ui/ajustes/changelog.test.ts`

Expected: FAIL — os `toEqual` esperam objetos `{ texto, detalhes }`, mas `parseChangelog` ainda
devolve `string[]`; os dois testes novos de detalhe também falham porque `detalhes` não existe.

- [ ] **Step 3: Reescrever `changelog.ts`**

Substitua o arquivo `src/ui/ajustes/changelog.ts` inteiro por:

```ts
export interface ChangelogItem {
  texto: string;
  detalhes: string[];
}

export interface ChangelogSecao {
  titulo: string;
  itens: ChangelogItem[];
}

export interface ChangelogVersao {
  versao: string;
  data: string;
  secoes: ChangelogSecao[];
}

export function parseChangelog(raw: string): ChangelogVersao[] {
  const versoes: ChangelogVersao[] = [];
  let versaoAtual: ChangelogVersao | null = null;
  let secaoAtual: ChangelogSecao | null = null;
  let itemAtual: ChangelogItem | null = null;

  for (const linha of raw.split(/\r?\n/)) {
    const versaoMatch = linha.match(/^## \[(.+?)\] - (.+)$/);
    if (versaoMatch) {
      versaoAtual = { versao: versaoMatch[1], data: versaoMatch[2], secoes: [] };
      versoes.push(versaoAtual);
      secaoAtual = null;
      itemAtual = null;
      continue;
    }
    const secaoMatch = linha.match(/^### (.+)$/);
    if (secaoMatch && versaoAtual) {
      secaoAtual = { titulo: secaoMatch[1], itens: [] };
      versaoAtual.secoes.push(secaoAtual);
      itemAtual = null;
      continue;
    }
    // tópico: "- " na coluna 0.
    const itemMatch = linha.match(/^- (.+)$/);
    if (itemMatch && secaoAtual) {
      itemAtual = { texto: itemMatch[1], detalhes: [] };
      secaoAtual.itens.push(itemAtual);
      continue;
    }
    // detalhe: exatamente 2 espaços + "- ", sob o tópico mais recente.
    const detalheMatch = linha.match(/^ {2}- (.+)$/);
    if (detalheMatch && itemAtual) {
      itemAtual.detalhes.push(detalheMatch[1]);
      continue;
    }
    // continuação: qualquer outra linha indentada, sem "- " próprio, gruda no bullet mais
    // recente — no último detalhe, se houver algum, senão no texto do tópico.
    const continuacaoMatch = linha.match(/^\s+(\S.*)$/);
    if (continuacaoMatch && itemAtual) {
      if (itemAtual.detalhes.length > 0) {
        const ultimo = itemAtual.detalhes.length - 1;
        itemAtual.detalhes[ultimo] += ` ${continuacaoMatch[1]}`;
      } else {
        itemAtual.texto += ` ${continuacaoMatch[1]}`;
      }
    }
  }

  return versoes;
}
```

- [ ] **Step 4: Rodar os testes de novo e confirmar que passam**

Run: `npx vitest run src/ui/ajustes/changelog.test.ts`

Expected: PASS — todos os 8 testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ajustes/changelog.ts src/ui/ajustes/changelog.test.ts
git commit -m "changelog: ChangelogItem com detalhes, parser reconhece tópico e detalhe"
```

---

### Task 3: `src/ui/ajustes/Versao.tsx` — renderizar o detalhe subordinado ao tópico

**Files:**
- Create: mockup estático (ver Step 1) — arquivo temporário, não entra no commit
- Modify: `src/ui/ajustes/Versao.tsx` (arquivo inteiro, 39 linhas)
- Modify: `src/styles.css` (acrescenta bloco ao fim do arquivo)
- Modify: `docs/estilo/catalogo.md` (acrescenta uma linha na tabela de classes)
- Create: `src/ui/ajustes/Versao.detalhe.test.tsx`

**Interfaces:**
- Consumes de Task 2: `ChangelogItem { texto: string; detalhes: string[] }`,
  `parseChangelog(raw: string): ChangelogVersao[]` — ambos de `./changelog`.
- Produces: classe CSS `.versao-detalhes`, catalogada.

Antes de qualquer edição de `src/ui/**` ou `src/styles.css`: este é o guia de estilo em vigor
— `docs/estilo/nivel-2-nova-classe.md` (classe compartilhada de tela específica, prefixada
`versao-`, só tokens existentes).

- [ ] **Step 1: Montar o mockup e pedir aprovação antes de tocar no código**

Publique como Artifact (ou envie como arquivo HTML, se preferir) uma página estática com o
trecho relevante da tela Versão, reproduzindo fielmente `.card`, `.secao`, `.rotulo-grupo` e a
lista existentes, e a `.versao-detalhes` proposta:

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Mockup — changelog com detalhe</title>
<style>
  :root {
    --bg: #0b0d11; --fg: #e9edf3; --muted: #8b95a3;
    --surface: #1c2331; --surface2: #29334a; --line: #232936;
    --ac: #3b9df8; --ac-dim: rgba(59, 157, 248, .14);
  }
  body { background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; padding: 20px; }
  .card { background: var(--surface); border-radius: 20px; padding: 20px; max-width: 420px; }
  .secao { display: flex; align-items: baseline; justify-content: space-between; padding: 0 2px; }
  .sub { color: var(--muted); font-size: 13px; }
  .rotulo-grupo {
    color: var(--muted); font-size: 12px; font-weight: 600;
    letter-spacing: .05em; text-transform: uppercase; margin: 12px 0 6px;
  }
  ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 6px; }
  .versao-detalhes {
    margin: 4px 0 0;
    padding-left: 18px;
    color: var(--muted);
    font-size: 13px;
  }
  .versao-detalhes li { margin-bottom: 2px; }
</style>
</head>
<body>
  <div class="card">
    <div class="secao"><strong>0.23.0</strong><span class="sub">20/08/2026</span></div>
    <p class="rotulo-grupo">Alterado</p>
    <ul>
      <li>
        O changelog agora aceita tópico e detalhe.
        <ul class="versao-detalhes">
          <li>Vale para os fragmentos, para o CHANGELOG.md gerado e para esta tela.</li>
          <li>Um tópico sem nenhum detalhe continua funcionando como antes.</li>
        </ul>
      </li>
      <li>Tópico sem detalhe nenhum, exatamente como hoje.</li>
    </ul>
  </div>
</body>
</html>
```

Espere a aprovação explícita antes do Step 2. Se algo mudar (recuo, cor, tamanho de fonte),
ajuste a classe `.versao-detalhes` nos steps seguintes para bater com o que foi aprovado.

- [ ] **Step 2: Escrever o teste de renderização do detalhe (falhando)**

Crie `src/ui/ajustes/Versao.detalhe.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Versao from './Versao';

vi.mock('../../../CHANGELOG.md?raw', () => ({
  default: `# Changelog

## [0.6.0] - 2026-07-22

### Adicionado

- Tópico com detalhe.
  - Primeiro detalhe do tópico.
  - Segundo detalhe do tópico.
- Tópico sem detalhe.
`,
}));

it('renderiza os detalhes de um tópico numa lista subordinada', () => {
  render(<Versao />);
  expect(screen.getByText('Tópico com detalhe.')).toBeInTheDocument();
  expect(screen.getByText('Primeiro detalhe do tópico.')).toBeInTheDocument();
  expect(screen.getByText('Segundo detalhe do tópico.')).toBeInTheDocument();
});

it('não renderiza lista de detalhes quando o tópico não tem nenhum', () => {
  render(<Versao />);
  const topico = screen.getByText('Tópico sem detalhe.');
  expect(topico.closest('li')?.querySelector('ul')).toBeNull();
});
```

Run: `npx vitest run src/ui/ajustes/Versao.detalhe.test.tsx`

Expected: FAIL — `Versao.tsx` ainda renderiza `item` como string (`item.texto` é `undefined`
hoje, já que o tipo mudou na Task 2 mas o componente não foi atualizado).

- [ ] **Step 3: Atualizar `Versao.tsx`**

Substitua o arquivo `src/ui/ajustes/Versao.tsx` inteiro por:

```tsx
import changelogRaw from '../../../CHANGELOG.md?raw';
import { parseChangelog } from './changelog';

function dataBonita(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function Versao() {
  const versoes = parseChangelog(changelogRaw);
  const atual = versoes[0];

  return (
    <div className="tela">
      <h2>Versão</h2>
      {atual && (
        <p className="sub">Você está na versão {atual.versao}, de {dataBonita(atual.data)}.</p>
      )}
      {versoes.map((v) => (
        <div className="card" key={v.versao}>
          <div className="secao">
            <strong>{v.versao}</strong>
            <span className="sub">{dataBonita(v.data)}</span>
          </div>
          {v.secoes.map((s) => (
            <div key={s.titulo}>
              <p className="rotulo-grupo">{s.titulo}</p>
              <ul>
                {s.itens.map((item) => (
                  <li key={item.texto}>
                    {item.texto}
                    {item.detalhes.length > 0 && (
                      <ul className="versao-detalhes">
                        {item.detalhes.map((detalhe) => (
                          <li key={detalhe}>{detalhe}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Acrescentar a classe `.versao-detalhes` em `src/styles.css`**

Ao final de `src/styles.css` (depois do bloco `/* ---- Frequentes (AdicionarSheet.tsx) ---- */`,
que hoje termina em `.frequentes-ponto { ... }`), acrescente:

```css

/* ---- Detalhe de tópico (Versao.tsx) ---- */
.versao-detalhes {
  margin: 4px 0 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 13px;
}
.versao-detalhes li { margin-bottom: 2px; }
```

- [ ] **Step 5: Catalogar a classe**

Em `docs/estilo/catalogo.md`, na tabela `## Classes (em \`src/styles.css\`)`, acrescente uma
linha depois de `.frequentes-ponto`:

```md
| `.versao-detalhes` | lista de detalhes recuada sob um tópico do changelog, na tela Versão (`Versao.tsx`) — `--muted`, 13px |
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/ui/ajustes/Versao.detalhe.test.tsx src/ui/ajustes/Versao.test.tsx`

Expected: PASS — os dois testes novos, e os dois testes que já existiam em `Versao.test.tsx`
(que usam o `CHANGELOG.md` real, todo plano, e continuam passando sem mudança).

- [ ] **Step 7: Rodar o verificador de catálogo**

Run: `node scripts/verificar-catalogo.mjs`

Expected: saída sem divergência — `.versao-detalhes` aparece tanto em `styles.css` quanto em
`catalogo.md`.

- [ ] **Step 8: Commit**

```bash
git add src/ui/ajustes/Versao.tsx src/ui/ajustes/Versao.detalhe.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "Versão: detalhe de tópico renderiza numa lista subordinada"
```

---

### Task 4: Documentação — `changelog.d/README.md` e `CLAUDE.md`

**Files:**
- Modify: `changelog.d/README.md` (arquivo inteiro, 45 linhas)
- Modify: `CLAUDE.md:116`

**Interfaces:**
- Consumes: nenhuma (só texto).
- Produces: nenhuma.

- [ ] **Step 1: Reescrever `changelog.d/README.md`**

Substitua o arquivo inteiro por:

```md
# changelog.d/ — fragmentos de changelog

Cada mudança visível ao usuário entra aqui como **um arquivo próprio**, em vez de
editar o topo do `CHANGELOG.md` direto. Como cada feature mexe num arquivo
diferente, **sessões/branches paralelos nunca colidem** no changelog.

**"Visível ao usuário"** = muda o que ele vê ou o resultado que obtém — inclui
correção de cálculo ou de comportamento, por mais sutil. Refactor puro, docs e
tooling não viram fragmento.

## Como criar um fragmento

Nome do arquivo: `<tipo>-<slug>.md`, onde `<tipo>` é um de:

- `adicionado-` → recurso novo
- `alterado-` → mudança de comportamento existente
- `removido-` → algo que saiu

Exemplos: `adicionado-exportar-backup.md`, `alterado-cores-valores.md`.

O conteúdo tem dois níveis: **tópico** e, opcionalmente, **detalhe**. O parser do
app (`src/ui/ajustes/changelog.ts`) só entende exatamente isto — markdown rico
(negrito, terceiro nível) passa no release e quebra a tela de Versão depois:

- **Tópico**: toda linha começa com `- `, sem indentação.
- **Detalhe**: uma linha do tópico, indentada com **exatamente 2 espaços** antes
  do `- `. Fica subordinado ao tópico mais recente.
- **Sem negrito** (`**`) em nenhuma linha, tópico ou detalhe.
- Um tópico sem nenhum detalhe é só um bullet solto, como sempre foi.

```
- Botão de exportar backup na tela de Ajustes.
  - Fica no rodapé, ao lado de "Importar".
  - Funciona mesmo sem conexão de rede.
- Aviso quando o backup falha silenciosamente.
```

## Regra de ouro

Branches de feature **só** criam fragmentos aqui. Eles **nunca** editam
`package.json` (`version`) nem o topo do `CHANGELOG.md`.

## Na integração (uma vez, no branch `main`)

`npm run release -- <patch|minor|major>` junta todos os fragmentos numa nova
seção `## [X.Y.Z] - AAAA-MM-DD` no topo do `CHANGELOG.md`, apaga os fragmentos,
bumpa a versão em `package.json` e cria o commit + tag do release. Veja
`scripts/release.mjs`.

Escolha do bump: só correções → `patch`; recurso ou comportamento novo
(`adicionado-`/`alterado-`) → `minor`; remoção de recurso ou quebra de
compatibilidade de dados/backup → `major`.
```

- [ ] **Step 2: Atualizar a linha correspondente em `CLAUDE.md`**

Em `CLAUDE.md`, na linha 116, troque:

```
- **Versão e changelog só mudam na integração.** Essa regra evita colisão entre sessões paralelas. Branches de feature **nunca** editam `"version"` em `package.json`, nem o topo do `CHANGELOG.md`. Toda mudança visível ao usuário vira um **fragmento** em `changelog.d/`: um arquivo `<tipo>-<slug>.md`, com `tipo` igual a `adicionado`, `alterado` ou `removido`, e bullets planos (ver `changelog.d/README.md`). O número da versão é decidido **uma única vez**, na integração, por `npm run release`.
```

por:

```
- **Versão e changelog só mudam na integração.** Essa regra evita colisão entre sessões paralelas. Branches de feature **nunca** editam `"version"` em `package.json`, nem o topo do `CHANGELOG.md`. Toda mudança visível ao usuário vira um **fragmento** em `changelog.d/`: um arquivo `<tipo>-<slug>.md`, com `tipo` igual a `adicionado`, `alterado` ou `removido`, em até dois níveis — tópico e, opcionalmente, detalhe indentado (ver `changelog.d/README.md`). O número da versão é decidido **uma única vez**, na integração, por `npm run release`.
```

- [ ] **Step 3: Commit**

```bash
git add changelog.d/README.md CLAUDE.md
git commit -m "docs: changelog.d/README.md e CLAUDE.md descrevem tópico e detalhe"
```

---

### Task 5: Fragmento de changelog e verificação final

**Files:**
- Create: `changelog.d/alterado-changelog-niveis.md`

**Interfaces:**
- Consumes: nada de código — só confirma que as Tasks 1–4 já estão commitadas.
- Produces: nada consumido por outra task.

- [ ] **Step 1: Escrever o fragmento, já no novo formato de dois níveis**

Crie `changelog.d/alterado-changelog-niveis.md`:

```
- O changelog agora aceita tópico e detalhe: um item pode vir com uma lista de detalhes indentados abaixo dele, em vez de só bullets soltos do mesmo nível.
  - Vale para os fragmentos em changelog.d/, para o CHANGELOG.md e para a tela Ajustes → Versão.
  - Um fragmento sem nenhum detalhe continua funcionando exatamente como antes.
```

- [ ] **Step 2: Rodar a suíte inteira**

Run: `npm test`

Expected: PASS — todos os testes, incluindo os de `scripts/release.test.mjs`,
`src/ui/ajustes/changelog.test.ts`, `src/ui/ajustes/Versao.test.tsx` e
`src/ui/ajustes/Versao.detalhe.test.tsx`.

- [ ] **Step 3: Rodar o build**

Run: `npm run build`

Expected: build conclui sem erro de TypeScript (o novo tipo `ChangelogItem` é usado de forma
consistente em `changelog.ts` e `Versao.tsx`).

- [ ] **Step 4: Rodar os verificadores**

Run: `node scripts/verificar-catalogo.mjs`
Expected: sem divergência.

Run: `node scripts/verificar-dados-reais.mjs`
Expected: sem achado — o fragmento e os exemplos usam só texto sintético.

Não rode `npm run release` (nem em dry-run) neste worktree para "conferir" o resultado: ele
escreve `CHANGELOG.md`/`package.json` no disco e **apaga o fragmento** mesmo em dry-run — e,
como o fragmento nunca foi commitado, não dá para restaurá-lo com `git checkout` depois. O
comportamento de montagem já está coberto, em diretório isolado, pelos testes da Task 1
(`scripts/release.test.mjs`) — não repita a checagem contra os arquivos reais deste worktree.

- [ ] **Step 5: Commit do fragmento**

```bash
git add changelog.d/alterado-changelog-niveis.md
git commit -m "changelog: fragmento da mudança para tópico e detalhe"
```

---

## Depois do plano

Este plano **não** faz merge na `main`, release nem deploy — isso é o ciclo de entrega
(`ciclo-de-entrega`), com o ponto de confirmação da revisão do changelog. Ao terminar a Task 5,
pare e siga esse ciclo a partir do branch `changelog-niveis`.
