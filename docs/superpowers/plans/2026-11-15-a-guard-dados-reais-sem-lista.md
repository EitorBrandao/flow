# Plano A — Guard de dados reais que não passa em silêncio sem a lista privada

> **Para quem executa:** use a skill `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** o release aborta quando a lista privada de termos reais não existe na máquina, em vez de passar sem enxergar nomes e termos reais.

**Arquitetura:** o verificador ganha a flag `--exigir-lista` e um caminho de lista injetável por variável de ambiente (só para teste). O release passa a flag sempre, salvo com `RELEASE_SEM_LISTA_PRIVADA=1`. Código de terceiros em `public/tesseract/` deixa de ser comparado com os termos privados, porque gera coincidência em código minificado.

**Stack:** Node (ESM), Vitest, git.

**Origem:** itens D1 e D2 da revisão de 2026-11-15. Decisões do usuário na mesma data: sem a lista o release aborta; uma variável explícita libera; mexer em `scripts/` está autorizado para este plano.

## Restrições globais

- Só mudam: `scripts/verificar-dados-reais.mjs`, `scripts/verificar-dados-reais.test.mjs`, `scripts/release.mjs`, `scripts/release.test.mjs`, `CLAUDE.md`, `docs/licoes-aprendidas.md`. Nada em `.claude/`.
- Nenhum termo da lista privada aparece em arquivo, commit, saída de comando ou relatório. Os testes usam termos inventados.
- O verificador nunca imprime o trecho casado. Essa regra continua valendo no código novo.
- Mudança não visível ao usuário: sem fragmento de changelog, sem release, sem deploy. Termina no merge.
- Trabalhe num worktree em `.worktrees/`. Rode `npm test` inteiro antes de dizer que terminou.
- Não use o texto reservado das mensagens de release em nenhuma mensagem de commit.

## Modelo por tarefa

| Tarefa | Complexidade | Implementa | Revisa |
|---|---|---|---|
| 0 | manual | usuário (ou sessão local com o ok dele) | — |
| 1 | intermediária | Haiku | Sonnet, depois Opus |
| 2 | intermediária | Haiku | Sonnet, depois Opus |
| 3 | simples | Haiku | Opus |
| 4 | manual, só no PC do usuário | sessão principal | Opus |

## Arquivos

| Arquivo | Responsabilidade neste plano |
|---|---|
| `scripts/verificar-dados-reais.mjs` | caminho da lista, `--exigir-lista`, pasta de terceiros |
| `scripts/verificar-dados-reais.test.mjs` | testes novos; fecha a lacuna "não testável" dos termos privados |
| `scripts/release.mjs` | passa `--exigir-lista`; trata o código de saída 2; variável de liberação |
| `scripts/release.test.mjs` | lista de teste em todo release de fixture; dois testes novos |
| `CLAUDE.md` | linha "Dados reais" da tabela de guardas |
| `docs/licoes-aprendidas.md` | lição na seção "Dados e privacidade" |

---

### Tarefa 0: Tornar específico o termo da linha 261 da lista privada

Esta tarefa é fora do repositório. A lista fica em `~/.claude/flow-dados-reais.txt` e só existe no PC do usuário.

- [ ] **Passo 1:** abra a linha 261 da lista. O termo é uma palavra comum do português, de 8 letras, e casa com texto legítimo da wiki (`docs/wiki/6-telas.md:57`).
- [ ] **Passo 2:** troque o termo por uma forma que só case com o dado real: o nome completo, ou a palavra com o complemento que a torna única. Cada linha da lista é uma expressão regular.
- [ ] **Passo 3:** confira.

Rode: `node scripts/verificar-dados-reais.mjs`
Esperado: a ocorrência de `docs/wiki/6-telas.md:57` sumiu. A de `public/tesseract/` continua até a Tarefa 1.

---

### Tarefa 1: Verificador — caminho injetável, pasta de terceiros e `--exigir-lista`

**Arquivos:**
- Modificar: `scripts/verificar-dados-reais.mjs`
- Testar: `scripts/verificar-dados-reais.test.mjs`

**Interfaces:**
- Produz: flag `--exigir-lista` (código de saída **2** quando a lista não existe ou não tem termo ativo); variável `FLOW_DADOS_REAIS_LISTA` (caminho alternativo da lista, para teste).

- [ ] **Passo 1: escreva os testes que falham**

No `describe('verificar-dados-reais')`, depois da função `rodar`, acrescente o auxiliar e os testes:

```js
  /** Roda o verificador com uma lista privada de teste (ou sem lista, com caminho inexistente). */
  function rodarComLista(termos, ...args) {
    const lista = path.join(tmpDir, '..', `lista-${path.basename(tmpDir)}.txt`);
    if (termos !== null) fs.writeFileSync(lista, termos.join('\n'));
    const r = spawnSync('node', [SCRIPT, tmpDir, ...args], {
      encoding: 'utf8',
      env: { ...process.env, FLOW_DADOS_REAIS_LISTA: termos === null ? `${lista}.nao-existe` : lista },
    });
    if (termos !== null) fs.rmSync(lista, { force: true });
    return { saida: r.stdout || '', exitCode: r.status };
  }

  it('termo da lista privada vale em arquivo de teste e no dossiê gerado', () => {
    versionar({
      'src/ui/Algo.test.tsx': "expect(tela).toHaveTextContent('padaria-inventada-xyz');\n",
      'docs/dossie/02-motor.md': '- compra em padaria-inventada-xyz\n',
    });

    const { saida, exitCode } = rodarComLista(['padaria-inventada-xyz'], '--strict');

    expect(exitCode).toBe(1);
    expect(saida).toContain('src/ui/Algo.test.tsx:1');
    expect(saida).toContain('docs/dossie/02-motor.md:1');
    expect(saida).not.toContain('padaria-inventada-xyz');
  });

  it('código de terceiros em public/tesseract/ não é comparado com os termos privados', () => {
    versionar({
      'public/tesseract/nucleo.wasm.js': 'var a="padaria-inventada-xyz";\n',
      'public/outro.js': 'var b="padaria-inventada-xyz";\n',
    });

    const { saida } = rodarComLista(['padaria-inventada-xyz']);

    expect(saida).not.toContain('public/tesseract/nucleo.wasm.js');
    expect(saida).toContain('public/outro.js:1');
  });

  it('código de terceiros continua sob o padrão genérico de moeda', () => {
    // Montado em partes: escrito por extenso, o valor casaria com o padrão de moeda quando o
    // verificador varresse o plano em docs/ de onde este teste foi copiado.
    const valor = ['R$ 7', '777,77'].join('.');
    versionar({ 'public/tesseract/nucleo.wasm.js': `var c="${valor}";\n` });

    expect(rodarComLista(['padaria-inventada-xyz']).saida).toContain('public/tesseract/nucleo.wasm.js:1');
  });

  it('--exigir-lista sai 2 quando a lista não existe', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    const { saida, exitCode } = rodarComLista(null, '--strict', '--exigir-lista');

    expect(exitCode).toBe(2);
    expect(saida).toContain('Lista privada ausente');
  });

  it('--exigir-lista sai 2 quando a lista só tem comentário e linha vazia', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    expect(rodarComLista(['# só comentário', ''], '--exigir-lista').exitCode).toBe(2);
  });

  it('--exigir-lista com lista válida e repositório limpo sai 0', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    expect(rodarComLista(['padaria-inventada-xyz'], '--strict', '--exigir-lista').exitCode).toBe(0);
  });

  it('sem --exigir-lista a falta da lista não muda o código de saída', () => {
    versionar({ 'docs/nota.md': 'nenhum valor aqui\n' });

    expect(rodarComLista(null, '--strict').exitCode).toBe(0);
  });
```

Apague também o parágrafo de comentário que diz que a metade dos termos privados "não é testável aqui" (logo acima do teste `padrão genérico não vale no dossiê gerado...`): o primeiro teste novo cobre essa metade.

- [ ] **Passo 2: rode e veja falhar**

Rode: `npx vitest run scripts/verificar-dados-reais.test.mjs`
Esperado: os 7 testes novos falham (o verificador ignora `FLOW_DADOS_REAIS_LISTA` e não conhece `--exigir-lista`). Os antigos passam.

- [ ] **Passo 3: implemente**

Em `scripts/verificar-dados-reais.mjs`:

1. No cabeçalho, na lista `PARAMETROS`, acrescente:

```js
//   --exigir-lista - exit 2 se a lista privada não existir ou não tiver termo ativo. O release
//               passa esta flag: sem a lista, o verificador não enxerga nome nem termo real,
//               e "nenhum achado" seria uma resposta vazia (releases de sessões na nuvem
//               passaram assim até 2026-11).
//
// AMBIENTE:
//   FLOW_DADOS_REAIS_LISTA - caminho alternativo da lista privada. Existe para os testes;
//               no uso normal a lista é ~/.claude/flow-dados-reais.txt.
```

2. Depois de `RE_ARQUIVO_GERADO`, acrescente:

```js
// Código de terceiros, minificado, publicado como veio: comparar com os termos privados gera
// coincidência em sequência de letras sem sentido (visto em 2026-11). O padrão genérico de
// moeda CONTINUA valendo aqui — só os termos privados são pulados.
const PASTAS_DE_TERCEIROS = ['public/tesseract/'];
```

3. Em "argumentos", depois da linha `const strict = ...`:

```js
const exigirLista = argumentos.includes('--exigir-lista');
```

4. Troque a função `termosPrivados` inteira por:

```js
function caminhoListaPrivada() {
  return process.env.FLOW_DADOS_REAIS_LISTA
    || path.join(os.homedir(), '.claude', 'flow-dados-reais.txt');
}

/** Termos privados, se existirem. A lista nunca entra no repositório. */
function termosPrivados() {
  const caminho = caminhoListaPrivada();
  try {
    if (!fs.existsSync(caminho)) return [];
    return fs.readFileSync(caminho, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((termo) => {
        try {
          return { nome: 'termo da lista privada', re: new RegExp(termo, 'g') };
        } catch {
          return null; // regex inválida na lista: ignora, não derruba a varredura
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
```

5. Em `varrer`, troque as duas linhas que definem `soPrivados` e `padroes` por:

```js
    const soPrivados = RE_ARQUIVO_TESTE.test(arquivo) || RE_ARQUIVO_GERADO.test(arquivo);
    const deTerceiros = PASTAS_DE_TERCEIROS.some((pasta) => arquivo.startsWith(pasta));
    const padroes = deTerceiros ? PADROES : soPrivados ? privados : [...PADROES, ...privados];
```

6. Em "saída", antes de `const achados = varrer(raiz);`:

```js
if (exigirLista && termosPrivados().length === 0) {
  console.log(
    '✗ Lista privada ausente ou sem termo ativo (~/.claude/flow-dados-reais.txt).'
    + '\n  Sem ela a varredura só enxerga valores em real, não nomes nem termos.'
    + '\n  Rode nesta máquina só depois de criar a lista, ou rode na máquina que a tem.'
  );
  process.exit(2);
}
```

- [ ] **Passo 4: rode e veja passar**

Rode: `npx vitest run scripts/verificar-dados-reais.test.mjs`
Esperado: todos passam.

- [ ] **Passo 5: commit**

```bash
git add scripts/verificar-dados-reais.mjs scripts/verificar-dados-reais.test.mjs
git commit -m "feat(guard): verificador de dados reais exige a lista privada quando pedido"
```

---

### Tarefa 2: Release passa `--exigir-lista` e ganha a variável de liberação

**Arquivos:**
- Modificar: `scripts/release.mjs` (função `validarDadosReais`, hoje na linha 132; cabeçalho de variáveis, linha 36)
- Testar: `scripts/release.test.mjs`

**Interfaces:**
- Consome: `--exigir-lista` e o código de saída 2 da Tarefa 1; `FLOW_DADOS_REAIS_LISTA`.
- Produz: variável `RELEASE_SEM_LISTA_PRIVADA=1`.

- [ ] **Passo 1: dê uma lista de teste a todo release de fixture**

Sem isto, todos os testes de release existentes passam a abortar no CI, que não tem a lista. No topo de `scripts/release.test.mjs`, depois da constante `SCRIPT`:

```js
// Todo release de fixture roda com uma lista privada de teste: o release exige a lista
// (--exigir-lista), e nem o CI nem um clone limpo têm a lista real. De quebra, os testes
// deixam de depender da lista real da máquina de quem roda.
const LISTA_DE_TESTE = path.join(os.tmpdir(), 'flow-lista-de-teste-release.txt');
fs.writeFileSync(LISTA_DE_TESTE, 'termo-inventado-para-teste-de-release\n');
```

Confira se `os` já está importado no arquivo; se não, acrescente `import os from 'node:os';`.

Nas duas funções auxiliares, ponha a lista antes do `...env` (para um teste poder sobrescrever):

```js
function executarRelease(tmpDir, tipo, env = {}) {
  const nodeEnv = { ...process.env, FLOW_DADOS_REAIS_LISTA: LISTA_DE_TESTE, ...env, RELEASE_DRY_RUN: '1' };
```

```js
function executarReleaseGit(tmpDir, tipo, env = {}) {
  const nodeEnv = { ...process.env, FLOW_DADOS_REAIS_LISTA: LISTA_DE_TESTE, ...env };
```

- [ ] **Passo 2: escreva os testes que falham**

Dentro de `describe('guard de dados reais')`, depois do último `it`:

```js
    it('deve abortar quando a lista privada não existe na máquina', () => {
      const tmp = criarFixture();
      try {
        fixtureGit(tmp);
        execFileSync('git', ['add', '.'], { cwd: tmp });

        const result = executarRelease(tmp, 'patch', {
          FLOW_DADOS_REAIS_LISTA: path.join(tmp, 'lista-que-nao-existe.txt'),
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('lista privada');
        const pkg = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
        expect(pkg.version).toBe('1.0.0');
        expect(fs.existsSync(path.join(tmp, 'changelog.d', 'adicionado-x.md'))).toBe(true);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it('RELEASE_SEM_LISTA_PRIVADA=1 libera o release sem a lista, com aviso', () => {
      const tmp = criarFixture();
      try {
        fixtureGit(tmp);
        execFileSync('git', ['add', '.'], { cwd: tmp });

        const result = executarRelease(tmp, 'patch', {
          FLOW_DADOS_REAIS_LISTA: path.join(tmp, 'lista-que-nao-existe.txt'),
          RELEASE_SEM_LISTA_PRIVADA: '1',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout + result.stderr).toContain('RELEASE_SEM_LISTA_PRIVADA=1');
        expect(result.stdout).toContain('1.0.0 → 1.0.1');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it('a liberação não desliga o padrão de moeda', () => {
      const tmp = criarFixture();
      try {
        fixtureGit(tmp);
        fs.writeFileSync(path.join(tmp, 'nota.md'), `Conta de luz: ${VALOR_FORA_DAS_EXCECOES} no mês.\n`);
        execFileSync('git', ['add', '.'], { cwd: tmp });

        const result = executarRelease(tmp, 'patch', {
          FLOW_DADOS_REAIS_LISTA: path.join(tmp, 'lista-que-nao-existe.txt'),
          RELEASE_SEM_LISTA_PRIVADA: '1',
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('dados financeiros reais');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
```

- [ ] **Passo 3: rode e veja falhar**

Rode: `npx vitest run scripts/release.test.mjs -t "guard de dados reais"`
Esperado: o primeiro teste novo falha (o release ainda não exige a lista). Os outros dois podem passar por acaso; o que vale é o primeiro falhar.

- [ ] **Passo 4: implemente**

Em `scripts/release.mjs`, no bloco de comentário das variáveis (junto de `RELEASE_DRY_RUN=1`), acrescente:

```js
//   RELEASE_SEM_LISTA_PRIVADA=1 → libera o release numa máquina sem ~/.claude/flow-dados-reais.txt.
//                        Só a pedido explícito do usuário: sem a lista, o guard de dados reais
//                        não enxerga nomes nem termos, só valores em real.
```

Troque a função `validarDadosReais` inteira por:

```js
// Mesmo desenho do guard do catálogo, e pelo mesmo motivo: código de saída, nunca texto.
// Promovido de relatório a guard em 2026-07-25, depois de calibrado contra o repositório
// inteiro (as exceções sintéticas vivem em EXCECOES_VALOR, dentro do verificador).
// O verificador varre `git ls-files` — fora de um repositório git ele não acha nada e sai 0.
// Desde 2026-11 o release exige a lista privada (--exigir-lista, exit 2): sessões na nuvem
// não têm a lista, e o guard passava nelas sem olhar termo nenhum.
function validarDadosReais() {
  const verificadorPath = fileURLToPath(new URL('./verificar-dados-reais.mjs', import.meta.url));
  const semLista = process.env.RELEASE_SEM_LISTA_PRIVADA === '1';
  if (semLista) {
    console.warn(
      '  release: RELEASE_SEM_LISTA_PRIVADA=1 — a lista privada não é exigida; ' +
      'nomes e termos reais NÃO estão sendo checados neste release.'
    );
  }
  const args = [verificadorPath, '--strict', ...(semLista ? [] : ['--exigir-lista']), raiz];
  const r = spawnSync('node', args, { cwd: raiz, encoding: 'utf8' });
  if (r.error) abortar(`erro ao rodar o verificador de dados reais: ${r.error.message}`);
  if (r.stdout) console.log(r.stdout.trimEnd());
  if (r.stderr) console.error(r.stderr.trimEnd());
  if (r.status === 2) {
    abortar(
      'lista privada de dados reais ausente nesta máquina (~/.claude/flow-dados-reais.txt). ' +
      'Sem ela o release não enxerga nomes nem termos reais. Rode o release na máquina que ' +
      'tem a lista. RELEASE_SEM_LISTA_PRIVADA=1 libera, só a pedido explícito do usuário.'
    );
  }
  if (r.status !== 0) {
    abortar(
      'possíveis dados financeiros reais em arquivo versionado — confira cada arquivo:linha ' +
      'do relatório acima. Sintético aprovado vai para EXCECOES_VALOR em ' +
      'scripts/verificar-dados-reais.mjs; real precisa sair antes do release.'
    );
  }
}
```

- [ ] **Passo 5: rode a suíte dos scripts e a suíte inteira**

Rode: `npx vitest run scripts/`
Esperado: tudo passa.
Rode: `npm test`
Esperado: tudo passa.

- [ ] **Passo 6: commit**

```bash
git add scripts/release.mjs scripts/release.test.mjs
git commit -m "feat(guard): release aborta sem a lista privada de dados reais"
```

---

### Tarefa 3: Documentação da guarda

**Arquivos:**
- Modificar: `CLAUDE.md` (tabela "Guardas automáticas", linha "Dados reais"; e as "duas consequências" logo abaixo)
- Modificar: `docs/licoes-aprendidas.md` (seção "Dados e privacidade")

- [ ] **Passo 1:** em `CLAUDE.md`, troque a linha "Dados reais" da tabela por:

```markdown
| Dados reais | `scripts/verificar-dados-reais.mjs --strict --exigir-lista`, chamado pelo release | valor em real fora das exceções sintéticas, ou termo de `~/.claude/flow-dados-reais.txt`, em **qualquer** arquivo versionado. Aborta também quando a lista privada não existe na máquina. Arquivo de teste e dossiê gerado pulam só o padrão genérico de moeda — os termos privados valem neles também. `public/tesseract/` (código de terceiros) pula só os termos privados. Rode sozinho quando quiser: `node scripts/verificar-dados-reais.mjs` — sem `--strict` ele só avisa (exit 0) |
```

- [ ] **Passo 2:** na lista "Duas consequências valem por escrito", troque o título para "Três consequências valem por escrito" e acrescente o item:

```markdown
- **`RELEASE_SEM_LISTA_PRIVADA=1` libera o release numa máquina sem a lista privada.** Uma sessão na nuvem não tem a lista: nela o release aborta, e isso é o comportamento certo. O caminho normal é integrar e rodar o release no PC do usuário. Use a variável só com pedido explícito do usuário.
```

- [ ] **Passo 3:** em `docs/licoes-aprendidas.md`, no fim da seção "Dados e privacidade", acrescente:

```markdown
- **O guard de dados reais passava sem olhar nada.** Sem a lista privada, o verificador devolvia "nenhum termo" e o release seguia. Várias versões saíram de sessões na nuvem assim. Ninguém notou, porque um guard que passa não chama atenção. *Faça:* um guard que depende de um arquivo local falha quando o arquivo falta. Ao criar um guard, teste o caso "a entrada dele não existe" e decida, por escrito, se ele aborta ou segue.
```

- [ ] **Passo 4:** confira o formato.

Rode: `npm test`
Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add CLAUDE.md docs/licoes-aprendidas.md
git commit -m "docs: guard de dados reais exige a lista privada"
```

---

### Tarefa 4: Auditoria do que saiu sem a lista (só no PC do usuário)

As versões da v0.69.0 à v0.72.3 saíram de sessões sem a lista. A árvore atual já foi conferida em 2026-11-15 e só acusou as duas coincidências tratadas acima. Falta o que entrou e saiu nesse intervalo.

- [ ] **Passo 1:** confirme que a árvore atual está limpa, com a lista.

Rode: `node scripts/verificar-dados-reais.mjs --strict --exigir-lista`
Esperado: `✓ Nenhum dado financeiro real aparente...` e código de saída 0. Se acusar algo, pare e mostre `arquivo:linha` ao usuário, sem o trecho.

- [ ] **Passo 2:** varra as linhas acrescentadas no intervalo. Salve o script abaixo **na pasta de rascunho da sessão**, não no repositório, e rode-o a partir da raiz do checkout principal:

```js
// auditar-intervalo.mjs — uso: node <rascunho>/auditar-intervalo.mjs v0.68.0 HEAD
// Compara cada linha acrescentada no intervalo com a lista privada. Nunca imprime o termo
// nem a linha: só commit, arquivo e a linha da lista que casou.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [de, ate] = process.argv.slice(2);
const termos = fs.readFileSync(path.join(os.homedir(), '.claude', 'flow-dados-reais.txt'), 'utf8')
  .split(/\r?\n/)
  .map((t, i) => ({ linha: i + 1, t: t.trim() }))
  .filter(({ t }) => t && !t.startsWith('#'))
  .flatMap(({ linha, t }) => { try { return [{ linha, re: new RegExp(t) }]; } catch { return []; } });

const log = execFileSync('git', ['log', '-p', '-U0', '--format=@@commit %h', `${de}..${ate}`], {
  encoding: 'utf8', maxBuffer: 1024 * 1024 * 512,
});
let commit = '';
let arquivo = '';
const achados = new Set();
for (const l of log.split('\n')) {
  if (l.startsWith('@@commit ')) commit = l.slice(9);
  else if (l.startsWith('+++ b/')) arquivo = l.slice(6);
  else if (l.startsWith('+') && !l.startsWith('+++') && !arquivo.startsWith('public/tesseract/')) {
    for (const { linha, re } of termos) if (re.test(l)) achados.add(`${commit} ${arquivo} (linha ${linha} da lista)`);
  }
}
console.log(achados.size ? [...achados].join('\n') : 'Nada no intervalo.');
```

Rode: `node <rascunho>/auditar-intervalo.mjs v0.68.0 HEAD`
Esperado: `Nada no intervalo.`

- [ ] **Passo 3:** se houver achado, **pare**. Mostre ao usuário a lista de `commit arquivo`. Dado real num repositório público precisa sair do histórico, não só do arquivo, e isso é decisão dele.

- [ ] **Passo 4:** registre o resultado no item correspondente do `TODO.md` (arquivo local, no checkout principal) e apague o script do rascunho.

---

## Encerramento

- [ ] `npm test` inteiro verde.
- [ ] `git -C <checkout principal> status --porcelain` vazio.
- [ ] Skill `ciclo-de-entrega`: mudança não visível, termina no merge na `main`.
- [ ] Item do `TODO.md` fechado; lição já registrada na Tarefa 3.

## Fora do escopo

- `.claude/hooks/scan-dados-reais.mjs` continua como está: é um lembrete que só avisa, e `.claude/` não entra neste plano.
- Levar a lista privada para sessões na nuvem. A lista é dado sensível; ela não sai do PC.
