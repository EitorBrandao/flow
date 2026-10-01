# Período do Simular Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seletor de período (até 60 meses) no Simular, tabelas com 12 meses de altura e rolagem, e tabelas minimizáveis.

**Architecture:** Lógica pura em `src/domain/simulacao.ts` (período, extensão de recorrências em memória). UI em `SeletorPeriodoSimular.tsx` (novo), `SimuladorFluxo.tsx`, `TabelaSimulacao.tsx` e `CenarioCard.tsx`. Spec: `docs/superpowers/specs/2026-09-30-periodo-simular-design.md`.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library.

## Global Constraints

- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\periodo-simular`. Não toque no checkout principal. Rode `git rev-parse --show-toplevel` antes da primeira edição.
- Todo texto de UI, código, comentários e commits em português. Nada de inglês solto. Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2`.
- Valores em centavos inteiros. Datas `AAAA-MM-DD`. Meses `AAAA-MM`.
- Não edite `scripts/`, configs de build, `.claude/`, `package.json` (versão) nem `CHANGELOG.md`. Não instale dependências.
- Dados de teste sintéticos. Arquivos UTF-8 sem BOM.
- Antes de dizer que terminou: `npm test` completo verde.
- UI: só classes do `docs/estilo/catalogo.md`, exceto `.rolavel-12` (nível 2). Sem `style` inline com cor, raio ou fonte.
- Timeouts de teste não mudam. Não use `{ timeout }` em `findBy*`.

---

### Task 1: Domínio — período e extensão de recorrências

**Files:**
- Modify: `src/domain/simulacao.ts`
- Test: `src/domain/simulacao.test.ts`

**Interfaces:**
- Produces (em `src/domain/simulacao.ts`):
  - `export const MAX_MESES_SIMULACAO = 60;`
  - `export interface PeriodoSimulacao { de: string; ate: string }` (meses `AAAA-MM`, inclusivos)
  - `export function periodoPadrao(hoje: ISODate, horizonte: ISODate): PeriodoSimulacao`
  - `export function ajustarDeSim(p: PeriodoSimulacao, novoDe: string, mesHoje: string): PeriodoSimulacao`
  - `export function ajustarAteSim(p: PeriodoSimulacao, novoAte: string, mesHoje: string): PeriodoSimulacao`
  - `export function estenderRecorrencias(dados: Pick<Dados,'recorrencias'|'lancamentos'|'config'>, ate: ISODate): Lancamento[]`
  - `export function resumoMensal(serie: DiaSaldo[], hoje: ISODate, ate?: string): LinhaMes[]` — o 2º parâmetro continua sendo `hoje`; `ate` (mês `AAAA-MM`) corta meses depois dele.
- Consumes: `ocorrencias` de `./recurrence`; `addMeses`, `mesDe` de `./dates`; `mesesEntre` de `./periodo`.

Regras (copiadas da spec):
- `periodoPadrao`: `de = mesDe(hoje)`, `ate = mesDe(horizonte)`.
- `ajustarDeSim`: `novoDe` nunca antes de `mesHoje`; se `novoDe > p.ate`, `ate = novoDe`; se passar de 60 meses, `ate = addMeses(novoDe, 59)`.
- `ajustarAteSim`: se `novoAte < p.de`, `de = novoAte`, mas `de` nunca antes de `mesHoje` (então `novoAte` também não fica antes de `mesHoje`: use `max(novoAte, mesHoje)`); se passar de 60 meses, `de = addMeses(novoAte, -59)` (e `de` nunca antes de `mesHoje`; se `de` ficar antes, `de = mesHoje` e `ate = addMeses(mesHoje, 59)`).
- `estenderRecorrencias`: para cada recorrência com `ativa`, para cada data de `ocorrencias(rec, ate)` com `data > config.horizonteProjecao`, devolve um `Lancamento` sintético: `id: \`ext-${rec.id}-${data}\``, `boxId`, `categoriaId`, `valor`, `nota` (se houver), `bancoId` (se houver), `cenarioId` (se houver), `data`, `status: 'previsto'`, `origem: 'recorrencia'`, `recorrenciaId: rec.id`, `criadoEm`/`alteradoEm` = `rec.criadoEm`/`rec.alteradoEm`. Pula datas que já existem em `dados.lancamentos` com o mesmo `recorrenciaId` e `data`. `ate` é uma data `AAAA-MM-DD`.

- [ ] **Step 1: Testes que falham.** Em `src/domain/simulacao.test.ts`, acrescente blocos `describe` (recalcule os valores à mão):
  - `periodoPadrao('2026-09-15','2027-12-31')` → `{ de:'2026-09', ate:'2027-12' }`.
  - `ajustarDeSim({de:'2026-09',ate:'2027-12'}, '2026-08', '2026-09')` → `de` fica `'2026-09'`.
  - `ajustarDeSim(..., '2028-02', '2026-09')` → `{de:'2028-02', ate:'2028-02'}`.
  - `ajustarDeSim({de:'2026-09',ate:'2031-08'}, '2026-10', '2026-09')` → `ate` vira `'2031-09'` (60 meses: out/2026 a set/2031). Confira: 2026-10 + 59 meses = 2031-09.
  - `ajustarAteSim({de:'2026-09',ate:'2027-12'}, '2026-07', '2026-09')` → `{de:'2026-09', ate:'2026-09'}`.
  - `ajustarAteSim({de:'2026-09',ate:'2027-12'}, '2026-12', '2026-09')` → `{de:'2026-09', ate:'2026-12'}`.
  - `ajustarAteSim({de:'2026-09',ate:'2027-12'}, '2032-01', '2026-09')` → `{de:'2027-02', ate:'2032-01'}` (60 meses terminando em jan/2032).
  - `estenderRecorrencias`: horizonte `2026-12-31`; recorrência mensal dia 10, sem fim, início `2026-09-10`, ativa → com `ate = '2027-03-31'` devolve 3 lançamentos (`2027-01-10`, `2027-02-10`, `2027-03-10`). Parcelada com 3 parcelas desde `2026-11-10` → nada (a 3ª, `2027-01-10`, já passou do horizonte: devolve 1 lançamento em `2027-01-10`). Recorrência com `ativa:false` → `[]`. Com `ate = '2026-12-31'` → `[]`. Dia 31, início `2026-12-31`, sem fim: `2027-02-28` aparece. Recorrência de cenário mantém `cenarioId`. Lançamento real já existente com mesmo `recorrenciaId` e `data` não é duplicado.
  - `resumoMensal(serie, hoje, '2026-10')` corta novembro (reaproveite a série do teste existente: resultado só com `2026-09` e `2026-10`).
- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run src/domain/simulacao.test.ts` → FAIL (funções não existem).
- [ ] **Step 3: Implementar** em `src/domain/simulacao.ts` as funções acima. Importe `ocorrencias` de `./recurrence`, `addMeses` de `./dates` e `mesesEntre` de `./periodo`. Em `resumoMensal`, `if (ate && mes > ate) continue;`.
- [ ] **Step 4: Rodar e ver passar.** `npx vitest run src/domain/simulacao.test.ts` → PASS. Depois `npx tsc -b` sem erros.
- [ ] **Step 5: Commit.** `git add src/domain/simulacao.ts src/domain/simulacao.test.ts` e `git commit -m "feat(simular): período de até 60 meses e recorrências estendidas em memória"` (com as linhas de atribuição).

---

### Task 2: Tabela com rolagem e minimizável

**Files:**
- Modify: `src/styles.css`, `src/ui/TabelaSimulacao.tsx`, `src/ui/CenarioCard.tsx`, `docs/estilo/catalogo.md`
- Test: `src/ui/TabelaSimulacao.test.tsx`, `src/ui/SimuladorFluxo.test.tsx`

**Interfaces:**
- Produces: `TabelaSimulacao` ganha as props `aberta: boolean` e `onAlternar: () => void`. Ela renderiza, acima da tabela, um `<button type="button" className="botao-ver-mais" aria-expanded={aberta} onClick={onAlternar}>` com o texto `Tabela por mês` seguido de `▲` (aberta) ou `▼` (fechada), em `<span aria-hidden="true">`. Quando `aberta` é falso, a tabela, "Valores em R$" e a legenda não são renderizadas.
- Consumes: `LinhaMes` de Task 1 (inalterado).

- [ ] **Step 1: Testes que falham.** Em `src/ui/TabelaSimulacao.test.tsx` (leia o arquivo antes; siga o estilo dele):
  - com `aberta` e 14 linhas sintéticas, o contêiner da tabela (`table.closest('.rolavel')`) tem a classe `rolavel-12`.
  - o botão "Tabela por mês" tem `aria-expanded="true"`; clicar chama `onAlternar`.
  - com `aberta={false}`, `screen.queryByRole('table')` é nulo e o botão tem `aria-expanded="false"`.
  Atualize as chamadas existentes do componente para passar `aberta` e `onAlternar={() => {}}`.
  Em `src/ui/SimuladorFluxo.test.tsx`: minimizar a tabela combinada (clicar no botão dentro da região "Cenários ligados") esconde a tabela e mantém visível a frase de resumo ("saldo segue positivo…"); abrir um cenário, minimizar a tabela dele, fechar e reabrir o cenário mantém a tabela minimizada.
- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run src/ui/TabelaSimulacao.test.tsx src/ui/SimuladorFluxo.test.tsx`.
- [ ] **Step 3: Implementar.**
  - `src/styles.css`, logo depois de `.rolavel`: 
    ```css
    /* Simular: a tabela mostra 12 meses de altura e rola na vertical. O cabeçalho fica fixo no topo
       da área que rola; o canto (1ª coluna do cabeçalho) fica acima da coluna do mês, que é
       sticky à esquerda (z-index 2). A altura é de 13 linhas: o cabeçalho e 12 meses. */
    .rolavel-12 { max-height: calc(13 * 37px); overflow-y: auto; }
    .rolavel-12 thead th { position: sticky; top: 0; z-index: 3; background: var(--surface); }
    .rolavel-12 thead th:first-child { z-index: 4; }
    ```
    Meça a altura real da linha no navegador (Task 5 faz a varredura) e ajuste o `37px` se preciso.
  - `TabelaSimulacao.tsx`: o `<div className="rolavel">` vira `<div className="rolavel rolavel-12">`; adicione o botão e o condicional descritos em Interfaces.
  - `SimuladorFluxo.tsx`: `const [tabelaAberta, setTabelaAberta] = useState(true);` e passe `aberta`/`onAlternar` à tabela combinada. Coloque o `useState` junto dos outros, antes do `return` condicional.
  - `CenarioCard.tsx`: `const [tabelaAberta, setTabelaAberta] = useState(true);` junto dos outros hooks (antes do `if (!dados) return null`). Passe as props.
  - `docs/estilo/catalogo.md`: catalogue `.rolavel-12` no formato das outras entradas (leia o arquivo e copie o padrão).
- [ ] **Step 4: Rodar e ver passar.** Os dois arquivos de teste + `node scripts/verificar-catalogo.mjs` (sem `--strict`, para ver avisos; deve listar `.rolavel-12` como catalogada).
- [ ] **Step 5: Commit.** `feat(simular): tabela com 12 meses de altura, rolagem e minimizável`.

---

### Task 3: Seletor de período e integração no Simular

**Files:**
- Create: `src/ui/SeletorPeriodoSimular.tsx`, `src/ui/SeletorPeriodoSimular.test.tsx`
- Modify: `src/ui/SimuladorFluxo.tsx`, `src/ui/SimuladorFluxo.test.tsx`, `docs/estilo/catalogo.md`

**Interfaces:**
- Produces: `export default function SeletorPeriodoSimular(props: { periodo: PeriodoSimulacao; mesHoje: string; horizonte: ISODate; onMudar: (p: PeriodoSimulacao) => void })`.
- Consumes: tudo da Task 1; `TabelaSimulacao` da Task 2.

Markup (copie do mockup aprovado; classes reais): um `<div className="card" style={{ padding: '8px 16px' }}>` com duas `<div className="linha" style={{ justifyContent: 'space-between' }}>`. Cada linha: `<button className="botao" aria-label="Mês inicial anterior">‹</button>`, depois `<span>` com `<span className="sub">de</span>` e dois `<span className="campo"><select aria-label="Mês inicial">…</select></span>` / `<select aria-label="Ano inicial">`, depois `<button className="botao" aria-label="Mês inicial seguinte">›</button>`. A linha "até" usa "Mês final"/"Ano final"/"até". Abaixo, `<div className="linha" style={{ justifyContent: 'center' }}><span className="sub">N meses · máximo de 60</span></div>` ("1 mês" no singular). Opções do mês: nomes de `nomeDoMes` sem o ano (use `new Date(2000, i, 1)` com `toLocaleDateString('pt-BR',{month:'long'})`, ou um array fixo `janeiro…dezembro`). Anos: do ano de `mesHoje` até esse ano + 5. As setas e os selects chamam `ajustarDeSim`/`ajustarAteSim` e depois `onMudar`. Se `periodo.ate > mesDe(horizonte)`, mostre abaixo do contador `<p className="sub">Depois de {mesAbreviado(mesDe(horizonte))}, a tabela não inclui faturas de cartão.</p>`.

Integração em `SimuladorFluxo.tsx`:
- `const [periodo, setPeriodo] = useState<PeriodoSimulacao | null>(null);` e `const p = periodo ?? periodoPadrao(hoje, dados.config.horizonteProjecao)` (dentro do `useMemo`, use `periodo` como dependência e resolva o padrão ali; o seletor recebe o período resolvido).
- Dentro do `useMemo`: `const fim = ultimoDiaDoMes(...)` do mês `p.ate` (`ultimaData = dataComDia(ano, mes, ultimoDiaDoMes(ano, mes))`); `const extras = estenderRecorrencias(dados, fim)`; `projetarBoxes(ids, { ..., lancamentos: [...dados.lancamentos, ...extras], horizonte: fim > dados.config.horizonteProjecao ? fim : dados.config.horizonteProjecao })` — mantenha pelo menos o horizonte do app. `resumoMensal(serie, \`${p.de}-01\`, p.ate)`. O primeiro argumento de `resumoMensal` é uma data: o mês inicial vem de `p.de`.
- Renderize `<SeletorPeriodoSimular>` num `<section aria-label="Período">` com `<p className="rotulo-grupo">Período</p>` logo antes de "Cenários ligados".
- As frases de resumo ("negativo em", "segue positivo até") continuam usando as linhas do período inteiro.

- [ ] **Step 1: Testes que falham.** `SeletorPeriodoSimular.test.tsx`: seta › em "Mês final" avança um mês e chama `onMudar` com o `ate` novo; select "Ano inicial" não oferece anos antes do ano de hoje; contador "13 meses · máximo de 60" para `2026-09`→`2027-09`; "1 mês" no singular; com `ate` depois do horizonte aparece o aviso das faturas; sem passar, não aparece. `SimuladorFluxo.test.tsx`: padrão mostra de set/2026 até dez/2027 (`preparar()` usa hoje `2026-09-15`; horizonte vem de `repo.carregarTudo`: confira o valor real no teste antes de afirmar); mudar "Ano final" para 2030 acrescenta meses até dez/2030 com saldo sem = 100000 em todos; uma recorrência mensal de gasto criada por `repo.salvarRecorrencia` aparece em 2030 (saldo cai mês a mês além do horizonte); mudar o início para out/2026 remove set/2026 da tabela.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** conforme acima. Catalogue `SeletorPeriodoSimular` em `docs/estilo/catalogo.md`.
- [ ] **Step 4: Rodar e ver passar**, depois `npx tsc -b` e `node scripts/verificar-catalogo.mjs`.
- [ ] **Step 5: Commit.** `feat(simular): seletor de período de até 60 meses`.

---

### Task 4: Documentação, changelog e fechamento

**Files:**
- Modify: wiki (`docs/wiki/`, capítulo do Simular — ache por grep), `docs/dossie/` (gerado)
- Create: `changelog.d/adicionado-periodo-simular.md`, `changelog.d/alterado-tabela-simular-rolagem.md`

- [ ] **Step 1:** Leia `changelog.d/README.md` e `docs/wiki/README.md` (subconjunto fechado de markdown). Escreva os dois fragmentos no formato exigido, sem valores reais: o primeiro sobre o seletor de período (até 5 anos, mês e ano, setas); o segundo sobre a tabela com 12 meses de altura, rolagem e botão para minimizar (inclui as tabelas dos cenários).
- [ ] **Step 2:** Atualize o capítulo da wiki que explica o Simular: período, rolagem, minimizar, e o aviso de que faturas de cartão não passam do horizonte do app. Valide com `npx vitest run src/ui/ajustes/capitulos.test.ts`.
- [ ] **Step 3:** `npm run dossie`, depois `npm test` completo e `npm run build`. Tudo verde.
- [ ] **Step 4:** `node scripts/verificar-catalogo.mjs` e `node scripts/verificar-dados-reais.mjs`: sem avisos novos.
- [ ] **Step 5: Commit.** `docs: wiki, changelog e dossiê do período do Simular`.

---

## Auto-revisão da spec

- Seletor de período e teto de 60: Task 1 (regras) e Task 3 (UI).
- Recorrências além do horizonte, em memória: Task 1 (`estenderRecorrencias`) e Task 3 (integração). Aviso das faturas: Task 3.
- Tabela com 12 meses e rolagem, nas duas tabelas: Task 2.
- Minimizar, estado por tabela, resumo visível: Task 2.
- Wiki, changelog, catálogo, dossiê: Tasks 2, 3 e 4. Item 32 do `TODO.md`: o controlador move para `TODO-CONCLUIDOS.md` no checkout principal, depois do merge.
- Varredura com Playwright e medida da altura da linha: feitas pelo controlador depois da Task 4, antes do merge.
