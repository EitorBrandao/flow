# Plano C — Varredura fixa com Playwright

> **Para quem executa:** use a skill `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** a varredura "como usuário" deixa de ser reescrita a cada sessão. Um roteiro versionado percorre as telas, mede alinhamento, estouro e alvo de toque, exige as capturas, e falha quando aparece um achado que não estava na lista de conhecidos.

**Arquitetura:** o roteiro mora em `scripts/varredura/` e não entra no `package.json`. O Playwright continua instalado só na pasta de rascunho da sessão: o roteiro o resolve a partir da pasta de onde é chamado. Os achados já existentes ficam em `conhecidos.json`; só achado novo derruba a varredura. Cada feature acrescenta os próprios passos com `--extra`.

**Stack:** Node (ESM), Playwright (fora do projeto), Vitest para a única função pura.

**Origem:** itens R1 e R2 da revisão de 2026-11-15 (alinhamento pedido mais de uma vez; capturas que faltaram). Decisão do usuário: o roteiro mora em `scripts/varredura/`, fora do `package.json`; mexer em `scripts/` está autorizado para este plano.

## Restrições globais

- Só mudam: arquivos novos em `scripts/varredura/` e a seção "Teste como usuário (Playwright)" do `CLAUDE.md`. Nada em `package.json`, `vite.config.ts` nem `.claude/`.
- Nenhuma dependência nova no projeto. `playwright` continua fora do `package.json`.
- A varredura só abre `localhost`. O roteiro recusa qualquer outro endereço: no site publicado estão os dados reais.
- Dados de teste são sintéticos, gravados pelo `src/db/repo.ts` dentro do navegador. Nenhum valor escrito como texto em moeda nos arquivos: a semente usa centavos inteiros.
- Tela fixa: viewport 411 × 744, screen 412 × 892, `deviceScaleFactor` 2,63, `isMobile`, `hasTouch`, `locale` `pt-BR`.
- Mudança não visível ao usuário: termina no merge.
- O código deste plano foi escrito sem ser executado. A Tarefa 4 existe para rodá-lo de verdade e corrigir seletor ou medida que não bater.

## Modelo por tarefa

| Tarefa | Complexidade | Implementa | Revisa |
|---|---|---|---|
| 1 | simples | Haiku | Opus |
| 2 | intermediária | Haiku | Sonnet, depois Opus |
| 3 | intermediária | Haiku | Sonnet, depois Opus |
| 4 | intermediária, precisa de navegador | Sonnet | Opus |
| 5 | simples | Haiku | Opus |

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/varredura/comparar.mjs` | função pura: separa achado novo de achado conhecido |
| `scripts/varredura/comparar.test.mjs` | teste da função pura |
| `scripts/varredura/medir.mjs` | medidas feitas dentro da página |
| `scripts/varredura/semente.mjs` | dados sintéticos |
| `scripts/varredura/varredura.mjs` | roteiro base, capturas, relatório, código de saída |
| `scripts/varredura/conhecidos.json` | achados já existentes, aceitos até serem corrigidos |
| `scripts/varredura/README.md` | como rodar e como ler o relatório |
| `CLAUDE.md` | aponta para o roteiro |

---

### Tarefa 1: Comparação com os achados conhecidos

**Arquivos:**
- Criar: `scripts/varredura/comparar.mjs`
- Testar: `scripts/varredura/comparar.test.mjs`

**Interfaces:**
- Produz: `chaveDoAchado(a: {passo, tipo, alvo}): string` e `comparar(achados, conhecidos): { novos, resolvidos }`. `achados` é uma lista de `{passo, tipo, alvo, detalhe}`. `conhecidos` é uma lista de chaves (strings).

- [ ] **Passo 1: escreva o teste que falha**

```js
// scripts/varredura/comparar.test.mjs
import { describe, it, expect } from 'vitest';
import { chaveDoAchado, comparar } from './comparar.mjs';

const a = (passo, tipo, alvo) => ({ passo, tipo, alvo, detalhe: '' });

describe('varredura: comparar', () => {
  it('a chave ignora dígitos do alvo, que mudam com a data', () => {
    expect(chaveDoAchado(a('hoje', 'alvo', 'button.pill "Pendentes · 4"')))
      .toBe(chaveDoAchado(a('hoje', 'alvo', 'button.pill "Pendentes · 12"')));
  });

  it('a chave separa passos e tipos diferentes', () => {
    expect(chaveDoAchado(a('hoje', 'alvo', 'x'))).not.toBe(chaveDoAchado(a('fluxo', 'alvo', 'x')));
    expect(chaveDoAchado(a('hoje', 'alvo', 'x'))).not.toBe(chaveDoAchado(a('hoje', 'estouro', 'x')));
  });

  it('achado fora dos conhecidos é novo', () => {
    const r = comparar([a('hoje', 'alvo', 'x'), a('hoje', 'alvo', 'y')], [chaveDoAchado(a('hoje', 'alvo', 'x'))]);
    expect(r.novos.map((n) => n.alvo)).toEqual(['y']);
    expect(r.resolvidos).toEqual([]);
  });

  it('conhecido que não apareceu é resolvido', () => {
    const sumiu = chaveDoAchado(a('hoje', 'alvo', 'x'));
    expect(comparar([], [sumiu]).resolvidos).toEqual([sumiu]);
  });

  it('o mesmo achado duas vezes conta uma vez só', () => {
    expect(comparar([a('hoje', 'alvo', 'x'), a('hoje', 'alvo', 'x')], []).novos).toHaveLength(1);
  });

  it('listas vazias devolvem listas vazias', () => {
    expect(comparar([], [])).toEqual({ novos: [], resolvidos: [] });
  });
});
```

- [ ] **Passo 2:** rode `npx vitest run scripts/varredura/comparar.test.mjs`. Esperado: falha, o módulo não existe.

- [ ] **Passo 3: implemente**

```js
// scripts/varredura/comparar.mjs
// Separa achado novo de achado conhecido. Função pura, para poder ser testada sem navegador.

/** Chave estável de um achado. Dígitos viram "#": datas e contagens mudam de um dia para o outro. */
export function chaveDoAchado({ passo, tipo, alvo }) {
  return `${passo} | ${tipo} | ${String(alvo).replace(/\d+/g, '#')}`;
}

/** `novos`: achados fora da lista de conhecidos. `resolvidos`: conhecidos que não apareceram. */
export function comparar(achados, conhecidos) {
  const aceitos = new Set(conhecidos);
  const vistos = new Set();
  const novos = [];
  for (const achado of achados) {
    const chave = chaveDoAchado(achado);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    if (!aceitos.has(chave)) novos.push(achado);
  }
  return { novos, resolvidos: conhecidos.filter((c) => !vistos.has(c)) };
}
```

- [ ] **Passo 4:** rode de novo. Esperado: 6 testes passam.

- [ ] **Passo 5: commit**

```bash
git add scripts/varredura/comparar.mjs scripts/varredura/comparar.test.mjs
git commit -m "feat(varredura): separa achado novo de achado conhecido"
```

---

### Tarefa 2: Medidas e semente

**Arquivos:**
- Criar: `scripts/varredura/medir.mjs`
- Criar: `scripts/varredura/semente.mjs`

**Interfaces:**
- Produz: `medir(): Array<{tipo, alvo, detalhe}>` — roda **dentro da página**, via `page.evaluate(medir)`; por isso não importa nada e não usa nada de fora da própria função. Tipos: `estouro`, `alvo`, `alinhamento`, `primario-fora`.
- Produz: `semear(): Promise<void>` — também roda dentro da página.

- [ ] **Passo 1: escreva `medir.mjs`**

```js
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
  const texto = (el) => (el.getAttribute('aria-label') ?? el.innerText ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
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
    const r = el.getBoundingClientRect();
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
```

- [ ] **Passo 2: escreva `semente.mjs`**

```js
// scripts/varredura/semente.mjs
// Dados sintéticos da varredura. Roda dentro da página (page.evaluate) e grava pelo próprio
// repo do app. Valores em centavos inteiros; nomes inventados; datas relativas a hoje.

export async function semear() {
  const repo = await import(/* @vite-ignore */ `${document.baseURI.replace(/\/$/, '')}/src/db/repo.ts`);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const agora = new Date().toISOString();
  const avancado = { hoje: 'avancado', fluxo: 'avancado', cartao: 'avancado', analises: 'avancado', lancar: 'avancado' };

  await repo.salvarConfig({ modos: avancado });
  await repo.salvarBox({
    id: 'box-carteira', nome: 'carteira', saldoInicial: 420_000, dataSaldoInicial: dia(-40),
    criadoEm: agora, alteradoEm: agora, modos: avancado,
  });
  const banco = await repo.salvarBanco({ boxId: 'box-carteira', nome: 'banco azul', ordem: 0 });

  const categorias = {};
  const lista = [['salário', 'ganho'], ['mercado', 'gasto'], ['moradia', 'gasto'], ['jardinagem', 'gasto'], ['lazer', 'gasto']];
  for (const [ordem, [nome, tipo]] of lista.entries()) {
    categorias[nome] = await repo.salvarCategoria({ boxId: 'box-carteira', nome, tipo, ordem });
  }

  // Previstos manuais: recorrência não materializa o passado, então não gera pendente vencido.
  const previstos = [['salário', -2, 650_000, 'Pagamento do mês'], ['moradia', -1, 185_000, 'Aluguel'], ['jardinagem', 0, 11_990, ''], ['lazer', 2, 26_000, 'Ingresso de show']];
  for (const [categoria, quando, valor, nota] of previstos) {
    await repo.salvarLancamento({
      boxId: 'box-carteira', categoriaId: categorias[categoria].id, data: dia(quando),
      valor, nota, status: 'previsto', bancoId: banco.id,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    await repo.salvarLancamento({
      boxId: 'box-carteira', categoriaId: categorias.mercado.id, data: dia(-i * 2),
      valor: 4_500 + i * 1_111, nota: `Feira ${i + 1}`, status: 'efetivo', bancoId: banco.id,
    });
  }
}
```

- [ ] **Passo 3:** confira que nada quebrou na suíte: `npx vitest run scripts/varredura/`. Esperado: os 6 testes da Tarefa 1 passam (estes dois arquivos não têm teste; rodam na Tarefa 4).

- [ ] **Passo 4: commit**

```bash
git add scripts/varredura/medir.mjs scripts/varredura/semente.mjs
git commit -m "feat(varredura): medidas de tela e semente sintética"
```

---

### Tarefa 3: Roteiro base e relatório

**Arquivos:**
- Criar: `scripts/varredura/varredura.mjs`
- Criar: `scripts/varredura/conhecidos.json`

**Interfaces:**
- Consome: `medir` e `semear` (Tarefa 2), `comparar` e `chaveDoAchado` (Tarefa 1).
- Produz: linha de comando `node <repo>/scripts/varredura/varredura.mjs <url> [--extra arquivo.mjs] [--atualizar-conhecidos]`. Um arquivo extra exporta `passos`: uma lista de `{ nome: string, ir: async (page, ajuda) => void }`. `ajuda` traz `{ aba(rotulo), pilula(nome) }`.
- Saída, na pasta de onde foi chamado: `varredura/<nome>.png` por passo, `varredura/relatorio.json`, `varredura/relatorio.md`. Código de saída 1 com achado novo ou captura faltando; 2 com erro de uso.

- [ ] **Passo 1: crie `conhecidos.json` vazio**

```json
[]
```

- [ ] **Passo 2: escreva `varredura.mjs`**

```js
#!/usr/bin/env node
// Varredura fixa do Flow: percorre as telas na tela do celular do usuário, mede, fotografa e
// compara com os achados conhecidos.
//
// Uso (a partir da pasta de rascunho da sessão, onde o playwright está instalado):
//   node <repo>/scripts/varredura/varredura.mjs http://localhost:5199/ [--extra passos.mjs] [--atualizar-conhecidos]
//
// O playwright NÃO é dependência do projeto: é resolvido a partir da pasta de onde este
// script é chamado. Ver scripts/varredura/README.md.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { medir } from './medir.mjs';
import { semear } from './semente.mjs';
import { chaveDoAchado, comparar } from './comparar.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--') && /^https?:/.test(a));
const atualizar = args.includes('--atualizar-conhecidos');
const iExtra = args.indexOf('--extra');
const extra = iExtra >= 0 ? args[iExtra + 1] : null;

function sair(msg) { console.error(`varredura: ${msg}`); process.exit(2); }

if (!url) sair('informe o endereço do app, por exemplo http://localhost:5199/');
// No site publicado estão os dados reais do usuário: a varredura só abre a própria máquina.
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) sair('só é permitido localhost.');

let chromium;
try {
  const exigir = createRequire(path.join(process.cwd(), 'varredura.cjs'));
  ({ chromium } = await import(pathToFileURL(exigir.resolve('playwright')).href));
} catch {
  sair('playwright não encontrado nesta pasta. Na pasta de rascunho: npm i playwright && npx playwright install chromium');
}

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVO_CONHECIDOS = path.join(AQUI, 'conhecidos.json');
const SAIDA = path.resolve('varredura');
fs.mkdirSync(SAIDA, { recursive: true });

const ajuda = (page) => ({
  aba: (rotulo) => page.locator(`nav.navegacao button[aria-label="${rotulo}"]`).click(),
  pilula: (nome) => page.getByRole('tab', { name: nome }).click(),
});

// Roteiro base: as telas que toda entrega visível pode ter afetado.
const PASSOS_BASE = [
  { nome: 'hoje-visao', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula('Visão'); } },
  { nome: 'hoje-pendentes', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula(/Pendentes/); } },
  { nome: 'hoje-conferir', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula('Conferir'); } },
  { nome: 'fluxo-lista', ir: async (p, a) => { await a.aba('Fluxo'); } },
  { nome: 'fluxo-editor', ir: async (p, a) => { await a.aba('Fluxo'); await p.locator('main .item').filter({ hasText: 'Feira 1' }).first().click(); }, sair: async (p) => { await p.keyboard.press('Escape'); } },
  { nome: 'adicionar', ir: async (p, a) => { await a.aba('Adicionar'); }, sair: async (p) => { await p.keyboard.press('Escape'); } },
  { nome: 'lancar', ir: async (p, a) => { await a.aba('Adicionar'); await p.getByRole('button', { name: /^Lançamento/ }).click(); } },
  { nome: 'cartao', ir: async (p, a) => { await a.aba('Cartão'); } },
  { nome: 'analises', ir: async (p, a) => { await a.aba('Análises'); } },
  { nome: 'ajustes', ir: async (p) => { await p.locator('button[aria-label="Ajustes"]').click(); } },
];

let passos = PASSOS_BASE;
if (extra) {
  const modulo = await import(pathToFileURL(path.resolve(extra)).href);
  if (!Array.isArray(modulo.passos)) sair(`${extra} precisa exportar "passos".`);
  passos = [...PASSOS_BASE, ...modulo.passos];
}

const browser = await chromium.launch();
const contexto = await browser.newContext({
  viewport: { width: 411, height: 744 }, screen: { width: 412, height: 892 },
  deviceScaleFactor: 2.63, isMobile: true, hasTouch: true, locale: 'pt-BR',
});
const page = await contexto.newPage();
const errosDePagina = [];
page.on('pageerror', (e) => errosDePagina.push(String(e).split('\n')[0]));
// Nenhum diálogo nativo deve existir no app; se aparecer, vira achado e é dispensado.
const dialogos = [];
page.on('dialog', async (d) => { dialogos.push(d.message()); await d.dismiss(); });

await page.goto(url);
await page.waitForSelector('nav.navegacao');
await page.evaluate(semear);
await page.reload();
await page.waitForSelector('nav.navegacao');
await page.locator('select[aria-label="Box"]').selectOption({ label: 'carteira' });

const achados = [];
const falhas = [];
const capturas = [];
for (const passo of passos) {
  try {
    await passo.ir(page, ajuda(page));
    await page.waitForTimeout(450); // espera as animações de entrada
    const arquivo = path.join(SAIDA, `${passo.nome}.png`);
    await page.screenshot({ path: arquivo });
    capturas.push(arquivo);
    for (const m of await page.evaluate(medir)) achados.push({ passo: passo.nome, ...m });
    if (passo.sair) { await passo.sair(page); await page.waitForTimeout(300); }
  } catch (e) {
    falhas.push({ passo: passo.nome, erro: String(e).split('\n')[0].slice(0, 200) });
  }
}
for (const mensagem of dialogos) achados.push({ passo: 'geral', tipo: 'dialogo-nativo', alvo: mensagem.slice(0, 40), detalhe: 'window.confirm ou alert' });
for (const erro of errosDePagina) achados.push({ passo: 'geral', tipo: 'erro-de-script', alvo: erro.slice(0, 60), detalhe: '' });
await browser.close();

const conhecidos = JSON.parse(fs.readFileSync(ARQUIVO_CONHECIDOS, 'utf8'));
const { novos, resolvidos } = comparar(achados, conhecidos);
const semCaptura = passos.filter((p) => !fs.existsSync(path.join(SAIDA, `${p.nome}.png`))).map((p) => p.nome);

if (atualizar) {
  const chaves = [...new Set(achados.map(chaveDoAchado))].sort();
  fs.writeFileSync(ARQUIVO_CONHECIDOS, `${JSON.stringify(chaves, null, 2)}\n`);
  console.log(`varredura: conhecidos.json regravado com ${chaves.length} achado(s).`);
}

fs.writeFileSync(path.join(SAIDA, 'relatorio.json'), JSON.stringify({ novos, resolvidos, falhas, semCaptura, achados }, null, 1));
const linhas = [
  '# Varredura',
  '',
  `Passos: ${passos.length} · capturas: ${capturas.length} · achados: ${achados.length} · novos: ${novos.length} · resolvidos: ${resolvidos.length}`,
  '',
  '## Achados novos',
  ...(novos.length ? novos.map((n) => `- ${n.passo} · ${n.tipo} · ${n.alvo} · ${n.detalhe}`) : ['Nenhum.']),
  '',
  '## Conhecidos que sumiram (tire de conhecidos.json)',
  ...(resolvidos.length ? resolvidos.map((r) => `- ${r}`) : ['Nenhum.']),
  '',
  '## Passos que falharam',
  ...(falhas.length ? falhas.map((f) => `- ${f.passo}: ${f.erro}`) : ['Nenhum.']),
  '',
  '## Capturas (envie ao usuário pelo chat)',
  ...capturas.map((c) => `- ${c}`),
  '',
];
fs.writeFileSync(path.join(SAIDA, 'relatorio.md'), linhas.join('\n'));
console.log(linhas.join('\n'));

const reprovou = !atualizar && (novos.length > 0 || falhas.length > 0 || semCaptura.length > 0);
process.exit(reprovou ? 1 : 0);
```

- [ ] **Passo 3:** confira a sintaxe sem navegador.

Rode: `node --check scripts/varredura/varredura.mjs && node scripts/varredura/varredura.mjs`
Esperado: o `--check` não imprime nada; a segunda chamada imprime `varredura: informe o endereço do app...` e sai com código 2.

Rode: `node scripts/varredura/varredura.mjs https://exemplo.com/`
Esperado: `varredura: só é permitido localhost.` e código 2.

- [ ] **Passo 4: commit**

```bash
git add scripts/varredura/varredura.mjs scripts/varredura/conhecidos.json
git commit -m "feat(varredura): roteiro base com capturas e relatório"
```

---

### Tarefa 4: Rodar de verdade, corrigir e gravar a linha de base

Esta tarefa precisa de navegador. Ela é a prova de que as Tarefas 2 e 3 funcionam.

- [ ] **Passo 1:** prepare a pasta de rascunho e o app.

```bash
# na pasta de rascunho da sessão
npm i playwright && npx playwright install chromium
# no worktree, em outro terminal ou em segundo plano
npm ci && npx vite --port 5199 --strictPort --host localhost
```

- [ ] **Passo 2:** rode a varredura a partir da pasta de rascunho.

Rode: `node <worktree>/scripts/varredura/varredura.mjs http://localhost:5199/`
Esperado: 10 capturas em `varredura/`, a seção "Passos que falharam" com "Nenhum.", e código de saída 1, porque a linha de base ainda está vazia.

- [ ] **Passo 3:** se algum passo falhou, o seletor não bate com o app. Abra o componente da tela, corrija o seletor em `PASSOS_BASE` e rode de novo. Não troque um seletor por `waitForTimeout`.

- [ ] **Passo 4:** leia os achados um a um, olhando a captura do passo.

- Achado verdadeiro e já existente: fica, vira linha de base.
- Achado falso (a medida errou): corrija a medida em `medir.mjs`. Exemplos prováveis: a coluna `.card` tem filho recuado de propósito; um `input` de opacidade zero entrou como alvo. Uma medida que acusa o que está certo ensina a ignorar o relatório.
- Confira que os achados da varredura manual de 2026-11-15 aparecem: os alvos de 36 px da barra e das pílulas, e o botão Lançar atrás da barra. Se não aparecem, a medida está frouxa.

- [ ] **Passo 5:** grave a linha de base.

Rode: `node <worktree>/scripts/varredura/varredura.mjs http://localhost:5199/ --atualizar-conhecidos`
Depois rode sem a flag. Esperado: "Achados novos: Nenhum." e código de saída 0.

- [ ] **Passo 6:** prove que a varredura reprova. No worktree, mude temporariamente `min-height: 42px` para `min-height: 30px` em `.botao` (`src/styles.css`), rode a varredura e veja o código de saída 1 com achados novos do tipo `alvo`. **Desfaça a mudança** com `git checkout src/styles.css` e confira com `git status --porcelain`.

- [ ] **Passo 7:** envie as capturas ao usuário pelo chat, com o resumo do `relatorio.md`. Encerre o processo da porta 5199.

- [ ] **Passo 8: commit**

```bash
git add scripts/varredura/
git commit -m "feat(varredura): linha de base dos achados conhecidos"
```

---

### Tarefa 5: Documentação

**Arquivos:**
- Criar: `scripts/varredura/README.md`
- Modificar: `CLAUDE.md` (seção "Teste como usuário (Playwright)")
- Modificar: `docs/licoes-aprendidas.md` (seção "Interface e consistência")

- [ ] **Passo 1: escreva o README**

````markdown
# Varredura fixa

Percorre as telas do Flow na tela do celular do usuário, mede e fotografa. Soma ao `npm test`; não o substitui.

## Como rodar

O Playwright não é dependência do projeto. Instale-o na pasta de rascunho da sessão e chame o roteiro de lá.

```
# pasta de rascunho
npm i playwright && npx playwright install chromium

# worktree da entrega
npx vite --port 5199 --strictPort --host localhost

# pasta de rascunho
node <worktree>/scripts/varredura/varredura.mjs http://localhost:5199/
```

O roteiro só aceita `localhost`. No site publicado estão os dados reais.

## O que ele mede

| Tipo | O que é |
|---|---|
| `estouro` | a página rola para o lado |
| `alvo` | botão, link, campo ou aba com menos de 38 px de altura |
| `alinhamento` | irmãos de uma coluna que começam ou terminam de 1 a 8 px um do outro |
| `primario-fora` | ação principal atrás da barra de navegação ao abrir a tela |
| `dialogo-nativo` | o app abriu `window.confirm` ou `alert` |
| `erro-de-script` | erro não tratado na página |

## Como ler o resultado

A saída fica em `varredura/`, na pasta de onde você chamou: uma captura por passo, `relatorio.md` e `relatorio.json`.

- **Código de saída 0:** nenhum achado novo. Envie as capturas ao usuário.
- **Código de saída 1:** há achado novo, passo que falhou ou captura faltando. Corrija a tela. Não acrescente o achado aos conhecidos para passar.
- **"Conhecidos que sumiram":** você corrigiu algo. Tire a linha de `conhecidos.json` no mesmo branch.

`--atualizar-conhecidos` regrava `conhecidos.json` com tudo o que a rodada achou. Use só quando o usuário aceitar um achado como ele é.

## Passos da sua entrega

Toda entrega visível acrescenta os próprios passos, num arquivo da pasta de rascunho:

```js
// passos-da-entrega.mjs
export const passos = [
  { nome: 'minha-tela', ir: async (page, ajuda) => { await ajuda.aba('Fluxo'); await page.getByRole('button', { name: 'Novo' }).click(); } },
];
```

```
node <worktree>/scripts/varredura/varredura.mjs http://localhost:5199/ --extra passos-da-entrega.mjs
```

Um passo pode ter `sair`, para fechar o que abriu: `sair: async (page) => { await page.keyboard.press('Escape'); }`.

## Limites

O Chromium sem tela não abre o teclado virtual. Câmera, leitura de comprovante e de nota fiscal não são varridas.
````

- [ ] **Passo 2:** em `CLAUDE.md`, na seção "### Teste como usuário (Playwright)", acrescente depois do primeiro item:

```markdown
- O roteiro fixo está em `scripts/varredura/` (ver o `README.md` de lá). Rode-o em toda entrega visível, com os passos da entrega em `--extra`. Ele mede alinhamento, estouro lateral e alvo de toque, e falha com achado novo. Não escreva um roteiro novo do zero.
- Uma varredura sem capturas enviadas ao usuário não conta como feita.
```

- [ ] **Passo 3:** em `docs/licoes-aprendidas.md`, no fim da seção "Interface e consistência":

```markdown
- **O mesmo desalinho foi pedido mais de uma vez.** Cada sessão escrevia a própria varredura, na pasta de rascunho, e a varredura sumia com a sessão. Nenhuma media alinhamento. *Faça:* use o roteiro fixo de `scripts/varredura/`. Quando o usuário apontar um defeito visual que o roteiro não pegou, acrescente a medida ao roteiro no mesmo branch da correção.
```

- [ ] **Passo 4:** rode `npm test`. Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add scripts/varredura/README.md CLAUDE.md docs/licoes-aprendidas.md
git commit -m "docs(varredura): como rodar o roteiro fixo"
```

---

## Encerramento

- [ ] `npm test` inteiro verde.
- [ ] `node scripts/verificar-dados-reais.mjs` sem achado novo nos arquivos deste plano.
- [ ] `git -C <checkout principal> status --porcelain` vazio.
- [ ] Skill `ciclo-de-entrega`: mudança não visível, termina no merge na `main`.
- [ ] Item do `TODO.md` fechado.

## Fora do escopo

- Corrigir os achados da linha de base. Eles viram itens do backlog (plano B, Tarefa 1).
- Pôr o roteiro no CI. O CI não tem navegador instalado, e instalar é dependência nova.
- Citar o roteiro na skill `ciclo-de-entrega`: ela mora em `.claude/`. O passo 3.4 da skill já manda ler a seção do `CLAUDE.md` que este plano atualiza.
