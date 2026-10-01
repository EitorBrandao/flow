# A casa confere por box e cada visão tem os seus cenários — plano de implementação

> **Para agentes:** SUB-HABILIDADE OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** cada cenário tem dono (a casa ou uma box) e só existe na visão dele; Conferir na casa vira uma conferência por box; Bancos pede uma box na casa; Importar não marca a box `"casa"` como destino do extrato.

**Arquitetura:** campo opcional novo `Cenario.escopo` (sem índice, sem `this.version(n)`), regra pura de visão em `src/domain/cenarios.ts`, `cenariosLigados(dados, boxSel)` no store, cálculo puro da conferência por box em `src/domain/conferenciaPorBox.ts`, e edições de tela.

**Stack:** React 18, TypeScript, Zustand, Dexie, Vitest + Testing Library, fake-indexeddb.

Spec: `docs/superpowers/specs/2026-10-01-casa-confere-e-simula-design.md` (leia inteira). Mockup de Conferir, Importar e Bancos aprovado em 2026-10-01; o bloco do Simular do mockup foi trocado pela decisão da spec (nenhum campo Box no Simular).

## Restrições globais

- **Worktree:** `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\casa-c` (branch `casa-c`). Não toque no checkout principal. Antes da primeira edição, rode `git rev-parse --show-toplevel`: deve terminar em `.worktrees/casa-c`.
- Todo texto, comentário, teste e mensagem de commit em **português**. Sem palavra solta em inglês.
- Mensagens de commit terminam com estas duas linhas:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM
  ```
- Dados de teste **sintéticos** (`ana`, `bruno`; valores redondos).
- `boxSel === 'casa'` é o sentinela de consolidação; a box de nome `"casa"` é uma box real. Não confunda.
- **Regras de dados (`src/db/`, `src/backup/`):** um erro aqui custa dados do usuário. `Cenario.escopo` é opcional e sem índice: **não crie `this.version(n)`**. Em `src/backup/`, testes adversariais (JSON malformado, campo ausente, `config` nulo, `alteradoEm` no futuro). **Nunca relaxe `validarBackup`:** só pode ficar mais rígido.
- Não edite `package.json`, `scripts/`, `vite.config.ts`, `tsconfig.json`, `.claude/` nem o topo do `CHANGELOG.md`. Não instale dependência além de `npm ci`.
- Rode a suíte completa (`npm test`) e `npx tsc -b` antes de dizer que terminou cada tarefa.
- Não escreva escapes `\uXXXX` nem caracteres invisíveis nos arquivos (as ferramentas de escrita os convertem em literais).
- UTF-8 sem BOM. Antes de editar UI, leia `docs/estilo/nivel-1-editar-tela.md` e `docs/estilo/catalogo.md`.

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/domain/types.ts` | `Cenario.escopo?` |
| `src/domain/cenarios.ts` (+ `cenarios.test.ts`) | criar |
| `src/state/store.ts` | `cenariosLigados(dados, boxSel)` |
| `src/ui/TelaHoje.tsx`, `TelaFluxo.tsx`, `SimuladorFluxo.tsx`, `SimuladorSimples.tsx` | escopo dos cenários |
| `src/backup/backup.ts` (+ testes) | validar `escopo` |
| `src/ui/ajustes/Bancos.tsx` (+ teste) | aviso na casa |
| `src/ui/ajustes/Importar.tsx` (+ teste) | destino do extrato |
| `src/domain/conferenciaPorBox.ts` (+ teste) | criar |
| `src/ui/TelaHoje.tsx` (+ teste) | Conferir por box |
| `docs/wiki/*`, `docs/dominio.md`, `changelog.d/*` | documentação |

Pontos de chamada (grep): `cenariosLigados` em `TelaHoje` (2 usos), `TelaFluxo`, `SimuladorFluxo`; `src/dossie/retrato.ts:68` e `src/dossie/invariantes.ts:348` calculam o conjunto de ligados por conta própria (não usam o store). `dados.cenarios`: `SimuladorFluxo`, `SimuladorSimples`, `repo.ts` (`salvarCenario`, `apagarCenario`, `excluirCenario`, `converterCenarioEmReal`, limpeza de rascunhos), `backup.ts` (exportar, mesclar, importar). O app não tem exclusão de box. Nenhum caminho de pagamento muda.

---

### Tarefa 1: Dono do cenário (domínio e store)

**Arquivos:**
- Editar: `src/domain/types.ts` (interface `Cenario`, ~linha 156)
- Criar: `src/domain/cenarios.ts`, `src/domain/cenarios.test.ts`
- Editar: `src/state/store.ts` (`cenariosLigados`, ~linha 150)
- Editar: os chamadores em `src/ui/TelaHoje.tsx`, `src/ui/TelaFluxo.tsx`, `src/ui/SimuladorFluxo.tsx`
- Testar: `src/state/store.test.ts` (se existir; senão em `cenarios.test.ts`)

**Interfaces:**
- Produz:
  ```ts
  // src/domain/cenarios.ts
  export function escopoDoCenario(c: Cenario): string          // c.escopo ?? 'casa'
  export function cenarioDaVisao(c: Cenario, boxSel: string): boolean
  // src/state/store.ts
  export function cenariosLigados(dados: Dados, boxSel: BoxSelecionada): Set<ID>
  ```

- [ ] **Passo 1: Testes que falham**

`src/domain/cenarios.test.ts` (monte `Cenario` com os campos obrigatórios de `src/domain/types.ts`, ver `Entidade`):
1. `escopoDoCenario` de cenário sem `escopo` devolve `'casa'`.
2. `escopoDoCenario` de cenário com `escopo: 'b-ana'` devolve `'b-ana'`.
3. `cenarioDaVisao(semEscopo, 'casa')` é verdadeiro; `cenarioDaVisao(semEscopo, 'b-ana')` é falso.
4. `cenarioDaVisao({escopo:'b-ana'}, 'b-ana')` verdadeiro; com `'casa'` e com `'b-bruno'`, falso.
5. `cenarioDaVisao({escopo:'casa'}, 'casa')` verdadeiro.
`cenariosLigados(dados, boxSel)`: com três cenários ligados (um da casa, um de ana, um de bruno) e um da casa desligado, devolve só o da casa em `'casa'`, só o de ana em `'b-ana'`; o desligado nunca entra.

- [ ] **Passo 2: Rodar e ver falhar** (`npx vitest run src/domain/cenarios.test.ts`).

- [ ] **Passo 3: Implementar**

`types.ts`, em `Cenario`:
```ts
  /** Visão dona do cenário: o id de uma box ou 'casa'. Ausente vale 'casa' (cenários criados antes do campo). */
  escopo?: string;
```
`src/domain/cenarios.ts`:
```ts
import type { Cenario } from './types';

/** Visão dona do cenário: o id de uma box ou 'casa'. Cenário antigo, sem o campo, é da casa. */
export function escopoDoCenario(c: Cenario): string {
  return c.escopo ?? 'casa';
}

/** O cenário só existe na visão que o criou: `boxSel` é 'casa' ou o id da box do topo. */
export function cenarioDaVisao(c: Cenario, boxSel: string): boolean {
  return escopoDoCenario(c) === boxSel;
}
```
`store.ts` (importe `cenarioDaVisao`):
```ts
/** Ids dos cenários ligados da visão atual (mostrados na projeção). Cada cenário só existe na
 *  visão que o criou: a casa soma só os da casa, e cada box só os dela. */
export function cenariosLigados(dados: Dados, boxSel: BoxSelecionada): Set<ID> {
  return new Set(dados.cenarios.filter((c) => c.ligado && cenarioDaVisao(c, boxSel)).map((c) => c.id));
}
```
Em `TelaHoje.tsx` (duas chamadas: a definição de `ligados` e, se houver outra, a segunda), `TelaFluxo.tsx` e `SimuladorFluxo.tsx`, passe `boxSel`: `cenariosLigados(dados, boxSel)`. Em `SimuladorFluxo`, o `useMemo` já depende de `boxSel`. Atualize os testes existentes que chamam `cenariosLigados(dados)`.

- [ ] **Passo 4: Rodar, suíte completa e commit**

`npx vitest run src/domain/cenarios.test.ts` passa; `npm test` verde (cenários antigos, sem `escopo`, valem na casa: testes de Hoje/Fluxo que usam cenário numa box concreta podem falhar; nesse caso ajuste o teste para dar `escopo` do id da box, e relate); `npx tsc -b` limpo.

```bash
git add src/domain/types.ts src/domain/cenarios.ts src/domain/cenarios.test.ts src/state/store.ts src/ui
git commit -m "feat(cenarios): cada cenário pertence a uma visão (casa ou box)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 2: Backup valida o `escopo`

**Arquivos:**
- Editar: `src/backup/backup.ts` (`validarBackup`, ~linha 25-100)
- Testar: o arquivo de teste de backup existente (`src/backup/backup.test.ts`; confira com `ls src/backup`)

- [ ] **Passo 1: Testes que falham (adversariais)**

Com o backup mínimo válido que os testes existentes usam:
1. Cenário sem `escopo`: aceito, e `escopo` continua ausente no resultado.
2. Cenário com `escopo: 'casa'` e com `escopo: '<id de box>'`: aceito, preservado.
3. `escopo: 123`, `escopo: null`, `escopo: {}`, `escopo: ['x']`, `escopo: ''` (texto vazio): **rejeitado** com `Backup corrompido: …` (mensagem clara, sem lançar erro de tipo).
4. `mesclar` de backup com cenário com `escopo` preserva o campo e não duplica o cenário já existente com o mesmo id.
5. Ida e volta: `gerarBackup` com cenário com `escopo` e `validarBackup` no resultado devolvem o mesmo `escopo`.
6. Os testes adversariais existentes continuam passando sem mudança.

- [ ] **Passo 2: Rodar e ver falhar.**

- [ ] **Passo 3: Implementar**

Em `validarBackup`, depois da checagem das tabelas obrigatórias, acrescente:
```ts
  // escopo do cenário: opcional (ausente = casa), mas se vier tem que ser texto não vazio.
  for (const c of d.cenarios as Array<Record<string, unknown>>) {
    if (c && 'escopo' in c && c.escopo !== undefined && (typeof c.escopo !== 'string' || c.escopo === '')) {
      throw new Error('Backup corrompido: escopo de cenário inválido.');
    }
  }
```
Ajuste ao padrão do arquivo se ele já valida elementos de tabela de outro jeito. Não relaxe nenhuma checagem existente.

- [ ] **Passo 4: Rodar, suíte completa e commit** (`npm test`, `npx tsc -b`).

```bash
git add src/backup
git commit -m "feat(backup): valida o escopo opcional do cenário

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 3: Simular só mostra e cria os cenários da visão

**Arquivos:**
- Editar: `src/ui/SimuladorFluxo.tsx`, `src/ui/SimuladorSimples.tsx`
- Testar: `src/ui/SimuladorFluxo.test.tsx`, `src/ui/SimuladorSimples.test.tsx`, `src/ui/TelaFluxo.test.tsx` ou `TelaHoje.test.tsx` (projeção)

**Interfaces:**
- Consome: `cenarioDaVisao` (`src/domain/cenarios.ts`), `cenariosLigados(dados, boxSel)` (Tarefa 1).

- [ ] **Passo 1: Testes que falham**

Cenário de teste: duas boxes `ana` e `bruno` com saldo próprio; um cenário `A` com `escopo` = id de ana, um `B` com `escopo` = id de bruno, um `C` sem `escopo` (da casa); cada um com um item (lançamento com `cenarioId` e `boxId` coerente), todos ligados.
1. Simular com `boxSel` = id de ana lista só `A` (não `B` nem `C`); com a casa, só `C`; "Nenhum cenário ainda." quando a visão não tem nenhum.
2. Criar cenário com a casa grava `escopo: 'casa'`; criar com ana grava `escopo` = id de ana (confira em `db.cenarios`).
3. Item novo adicionado a um cenário da casa vai para a box `"casa"` (como hoje); em ana, para ana. (Se os testes existentes já cobrem, mantenha-os passando.)
4. Projeção: o gráfico/`projetarBoxes` de Hoje ou Fluxo na casa não soma o item de `A` nem de `B`; em ana, não soma o de `C` nem o de `B`. Use a série mostrada na tela ou chame `projetarBoxes` com `cenariosLigados(dados, boxSel)`.
5. Simular simples: o rascunho criado em ana tem `escopo` de ana; "Guardar" mantém o `escopo`.
6. Cenário ligado de outra visão nunca aparece na contagem "Cenários ligados · N" da visão atual.

- [ ] **Passo 2: Rodar e ver falhar.**

- [ ] **Passo 3: Implementar**

`SimuladorFluxo.tsx`:
- Derive `const cenariosVisao = dados.cenarios.filter((c) => cenarioDaVisao(c, boxSel))` (dentro do `useMemo`, antes de montar `porCenario`, e fora dele para a lista). `porCenario` usa `cenariosVisao`; a lista de `CenarioCard` e o "Nenhum cenário ainda." usam `cenariosVisao`.
- `criar()`: `repo.salvarCenario({ id, nome, ligado: true, escopo: boxSel, criadoEm: agora, alteradoEm: agora })`.
- `boxIdNovo` continua `boxIdEfetivo(dados, boxSel)`.
`SimuladorSimples.tsx`: ao criar o rascunho, grave `escopo: boxSel`; o `resultado` e o "Guardar" só usam cenário da visão (`dados.cenarios.some((c) => c.id === cenarioId && cenarioDaVisao(c, boxSel))`). Ao guardar (`{ rascunho: _rascunho, ...guardada }`) o `escopo` já segue junto.
Leia `repo.ts` (`salvarCenario`, `apagarCenario`, `converterCenarioEmReal`, limpeza de rascunhos) e relate se algum deles perde o `escopo`; nenhum deve.

- [ ] **Passo 4: Rodar, suíte completa e commit** (`npm test`, `npx tsc -b`).

```bash
git add src/ui
git commit -m "feat(simular): cada visão mostra e cria só os seus cenários

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 4: Bancos pede uma box na casa; Importar não marca a box casa

**Arquivos:**
- Editar: `src/ui/ajustes/Bancos.tsx` (~linhas 40-60)
- Editar: `src/ui/ajustes/Importar.tsx` (~linhas 55-60, 151, 365-380)
- Testar: `src/ui/ajustes/Bancos.test.tsx` (ou o teste existente da tela; `grep -l "Bancos" src/ui/ajustes/*.test.tsx src/ui/*.test.tsx`), `src/ui/ajustes/Importar.test.tsx`

**Interfaces:**
- Consome: `AvisoEscolhaBox` (`src/ui/ajustes/AvisoEscolhaBox.tsx`, prop `assunto`), `boxIdConcreta` (`src/state/store.ts`).

- [ ] **Passo 1: Testes que falham**

Bancos (duas boxes com saldo próprio, `ana` e `bruno`, um banco em cada):
1. Com `boxSel: 'casa'`: aparece o `<h2>` "Bancos" e o texto "Os bancos são de cada box. Escolha uma box no topo para ver ou editar."; não aparecem o campo "Nome do banco" nem os nomes dos bancos; a mensagem `A box "casa" não foi encontrada` não aparece.
2. Com `boxSel` = id de ana: comportamento de hoje (os testes existentes passam sem mudança).

Importar (monte um extrato de conta válido como os testes existentes de Importar):
3. Com `boxSel: 'casa'`: depois de ler o extrato, o grupo "Box de destino" tem só as boxes com saldo próprio (`ana`, `bruno`; sem `casa`) e **nenhuma** está marcada (`aria-checked` falso em todas); o botão de confirmar o passo 3 está bloqueado (como com `destinoCompleto` falso).
4. Escolher `bruno` marca só ela e libera o passo 3.
5. Com `boxSel` = id de ana: o grupo vem com ana marcada, como hoje.
6. Fatura de cartão (CSV Nubank ou PDF Santander, como os testes existentes): na casa, os destinos continuam sendo cartões ativos de qualquer box.

- [ ] **Passo 2: Rodar e ver falhar.**

- [ ] **Passo 3: Implementar**

`Bancos.tsx`: troque o bloco que usa `boxIdsSelecionadas`/`boxIdEfetivo` por `const boxId = boxIdConcreta(boxSel)`; se `boxId == null`, devolva `<div className="tela"><h2>Bancos</h2><AvisoEscolhaBox assunto="Os bancos" /></div>` (depois dos hooks, como as outras telas). `bancos = bancosDaBox(dados.bancos, [boxId])`; `boxIdCriacao` vira `boxId`. Remova a mensagem de box `"casa"` não encontrada. O efeito `[boxSel]` que zera a edição continua.
`Importar.tsx`: onde `boxIdEscolhida` recebe `boxIdEfetivo(dados!, boxSel)` (linha ~151), use `boxIdConcreta(boxSel)` (nulo na casa). No grupo "Box de destino" (~linha 370), liste `dados.boxes.filter((b) => b.saldoInicial !== null)`. `cartoesAtivos` (~linha 57) continua tratando a casa à parte; troque o `boxIdEfetivo(dados, boxSel)` dele por `boxSel` (já é um id concreto nesse ramo).
Confirme com grep que nenhum `boxIdEfetivo` sobra em `Bancos.tsx` e `Importar.tsx`.

- [ ] **Passo 4: Rodar, suíte completa, catálogo e commit**

`npm test`, `npx tsc -b`, `node scripts/verificar-catalogo.mjs --strict`.

```bash
git add src/ui
git commit -m "feat(casa): Bancos pede uma box e o extrato não marca a box casa

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 5: Conferir por box na casa

**Arquivos:**
- Criar: `src/domain/conferenciaPorBox.ts`, `src/domain/conferenciaPorBox.test.ts`
- Editar: `src/ui/TelaHoje.tsx` (aba Conferir, ~linhas 498-514, e os componentes `ConferenciaSaldo`/`ConferenciaBancos`)
- Testar: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consome: `saldosPorBox(ids, EntradaProjecao, hoje)` (`src/domain/saldoPorBox.ts`, devolve `{boxId, nome, saldoEfetivo}[]`; já filtra boxes com saldo próprio ou com lançamento), `totalDeclaradoCent(bancos)` e `bancosDaBox` (`src/domain/bancos.ts`).
- Produz:
  ```ts
  // src/domain/conferenciaPorBox.ts
  export interface LinhaConferenciaBox {
    boxId: ID; nome: string;
    bancos: Banco[];                 // bancos da box (vazio = a box se confere sozinha)
    declaradoCent: number | null;    // soma dos bancos informados, ou o saldo declarado da box; null = nada informado
    flowCent: number;                // saldo efetivo de hoje da box no Flow
  }
  export interface ConferenciaCasa {
    linhas: LinhaConferenciaBox[];
    totalInformadoCent: number | null;   // soma dos declarados informados; null se nenhum
    totalFlowCent: number;               // soma de flowCent das linhas
    faltam: string[];                    // nomes das boxes sem saldo informado
    diffCent: number | null;             // totalInformado - totalFlow, só quando faltam está vazio
  }
  export function conferenciaDaCasa(dados: Dados, boxIds: readonly ID[], hoje: ISODate, ligados: ReadonlySet<ID>): ConferenciaCasa
  ```

Regras (da spec): entram só as boxes da seleção com `saldoInicial !== null`; a box `"casa"` (sem saldo próprio) não entra. `declaradoCent` de uma box com bancos = `totalDeclaradoCent(bancos da box)`; de uma box sem bancos = `Box.saldoDeclaradoCent ?? null`. `faltam` lista as boxes com `declaradoCent === null`. `diffCent` só existe com `faltam` vazio e pelo menos uma linha. `flowCent` vem de `saldosPorBox`. Ordem das linhas: a ordem de `dados.boxes`.

- [ ] **Passo 1: Testes de domínio que falham** (`conferenciaPorBox.test.ts`; construtores de teste como em `saldoPorBox.test.ts`):
1. Duas boxes sem bancos, ambas informadas (`ana` 100000 com saldo real 100000; `bruno` 50000 com saldo real 40000): `totalInformadoCent` 140000, `totalFlowCent` 150000, `diffCent` -10000, `faltam` vazio.
2. Box com dois bancos informados soma os bancos (300 + 150 = 450) e ignora o `saldoDeclaradoCent` da box.
3. Box com bancos e nenhum informado, e outra informada: `faltam` = [nome da primeira], `diffCent` null, `totalInformadoCent` = soma só do que foi informado.
4. Nenhuma informada: `totalInformadoCent` null, `faltam` com todas.
5. A box `"casa"` (sem saldo próprio) com lançamento não entra nas linhas nem em `totalFlowCent`.
6. `boxIds` com uma box só devolve uma linha.
7. `totalFlowCent` igual à soma das linhas, e cada `flowCent` igual a `saldosPorBox`.

- [ ] **Passo 2: Testes de UI que falham** (`TelaHoje.test.tsx`, aba Conferir, `boxSel: 'casa'`; use `abrirAba(/Conferir/)`):
1. Uma seção por box (`ana`, `bruno`); a box sem bancos mostra "Saldo da box" e a com bancos mostra os nomes dos bancos; a box `"casa"` não aparece.
2. Sem nenhuma box informada: "Informe o saldo de ana, bruno para conferir." e nenhuma diferença.
3. Informar o saldo de ana, salvar: grava `Box.saldoDeclaradoCent` de ana (confira em `db.boxes`); a frase continua pedindo bruno.
4. Informar o de um banco de bruno, salvar: grava no banco (`db.bancos`); com todas informadas aparece "Total informado", "Total calculado no Flow" e a diferença com as frases de `Diferenca` ("falta inserir no app" ou "sobra no app…").
5. Numa box concreta, a aba é a de hoje (os testes existentes passam sem mudança).
6. Rolagem e sinal: o botão `+`/`−` de cada linha alterna o sinal e o valor negativo é gravado.

- [ ] **Passo 3: Rodar e ver falhar.**

- [ ] **Passo 4: Implementar**

`conferenciaPorBox.ts` conforme a interface. Em `TelaHoje.tsx`, com `boxSel === 'casa'`, a aba Conferir renderiza um componente novo local `ConferenciaCasa` (no mesmo arquivo, ao lado de `ConferenciaBancos`) no lugar de `ConferenciaSaldo`/`ConferenciaBancos`: dentro do `.conferencia-bancos`, `<p className="rotulo-grupo">Saldo real em cada box</p>`, e para cada linha um grupo com `<p className="rotulo-grupo">{nome}</p>` e linhas `.linha-banco.recuo-1` com o botão de sinal (`.botao-sinal`) e `CampoValor`, igual à `ConferenciaBancos`. Box com bancos: uma linha por banco, rótulo = nome do banco; box sem bancos: uma linha, rótulo "Saldo da box". Rodapé como em `ConferenciaBancos`: `.total` "Total informado", `TotalFlow` com `totalFlowCent`, e a frase de diferença (`Diferenca`) ou "Informe o saldo de {faltam.join(', ')} para conferir." quando `diffCent` for nulo. Botão Salvar grava só o que mudou: `repo.atualizarBanco(id, { saldoDeclaradoCent, dataSaldoDeclarado: hoje })` para banco e `repo.salvarBox({ ...box, saldoDeclaradoCent, dataSaldoDeclarado: hoje })` para box, e depois `recarregar()`. Reaproveite o estado de magnitudes/negativos/editados de `ConferenciaBancos` (extraia um hook ou copie o padrão, sem refatorar além do necessário). Use a chave do componente com os ids das boxes e bancos, como `ConferenciaBancos` já faz. `Config.saldoDeclaradoCent` deixa de ser lido pela casa; não o apague.
Mantenha `ConferenciaSaldo` e `ConferenciaBancos` como estão para as boxes concretas.

- [ ] **Passo 5: Rodar, suíte completa e commit** (`npm test`, `npx tsc -b`, `node scripts/verificar-catalogo.mjs --strict`).

```bash
git add src/domain/conferenciaPorBox.ts src/domain/conferenciaPorBox.test.ts src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx
git commit -m "feat(casa): Conferir mostra uma conferência por box

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

### Tarefa 6: Documentação, changelog e dossiê

**Arquivos:**
- Editar: `docs/wiki/6-telas.md`, `docs/wiki/7-ajustes.md`, `docs/wiki/3-conceitos.md`, `docs/wiki/8-glossario.md` (se preciso), `docs/dominio.md`
- Criar: `changelog.d/alterado-conferir-por-box-na-casa.md`, `changelog.d/alterado-cenarios-por-visao.md`, `changelog.d/alterado-bancos-e-extrato-na-casa.md`
- Regenerar: `docs/dossie/`

- [ ] **Passo 1: Wiki e domínio**

Leia `docs/wiki/README.md` (subconjunto fechado de markdown; marcadores `{{boxA}}`/`{{boxB}}`, sem nome fixo) e confira no código o que cada tela faz agora.
- `6-telas.md`: Hoje → Conferir na casa é uma conferência por box (box com bancos mostra os bancos, box sem bancos o saldo da própria box; a diferença só aparece com todas informadas; a box casa não entra). Fluxo → Simular: cada visão tem os seus cenários; cenário criado na casa só existe na casa, e o de uma box só nela; os que já existiam viraram da casa.
- `7-ajustes.md`: Bancos, na visão casa, só pede uma box; Importar e conferir: o destino do extrato lista só boxes com saldo próprio e, na casa, vem sem box marcada.
- `3-conceitos.md` e `8-glossario.md` (termo cenário), se falarem de cenário sem dono.
- `docs/dominio.md`: `Cenario.escopo` (`'casa'` ou id de box; ausente = casa), `cenarioDaVisao`, `cenariosLigados(dados, boxSel)`; Bancos e o extrato deixaram de gravar na box `"casa"` pela UI; `boxIdEfetivo` agora só em Simular (item novo), `AdicionarSheet` e `CenarioCard`. A regra de visão é da interface e da projeção; o repo não a impõe (**expectativa não garantida**). `Config.saldoDeclaradoCent` da casa não é mais lido pela UI.
- Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 2: Fragmentos de changelog** (leia `changelog.d/README.md`: bullets sem negrito, no máximo 2 níveis)

`alterado-conferir-por-box-na-casa.md`:
```
- Com casa no topo, Hoje → Conferir faz uma conferência por box.
  - Box com bancos mostra os bancos; box sem bancos mostra o saldo da própria box.
  - A diferença só aparece quando toda box tem saldo informado.
```
`alterado-cenarios-por-visao.md`:
```
- Cada cenário do Simular só existe na visão em que foi criado: a casa ou uma box.
  - O gráfico e a projeção de cada visão somam só os cenários dela.
  - Os cenários que já existiam passaram a ser da casa.
```
`alterado-bancos-e-extrato-na-casa.md`:
```
- Com casa no topo, Bancos pede para escolher uma box.
- Ao importar um extrato com casa no topo, nenhuma box vem marcada como destino.
```

- [ ] **Passo 3: Dossiê** — `npm run dossie`; leia `git diff --stat docs/dossie/`. Mudanças só nas telas afetadas (Hoje na casa, Simular). Algo fora disso: pare e relate como DONE_WITH_CONCERNS sem commitar o dossiê.

- [ ] **Passo 4: Verificações finais** — `npm test`, `npm run build`, `node scripts/verificar-catalogo.mjs --strict`, `node scripts/verificar-dados-reais.mjs --strict`, `npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 5: Commit**

```bash
git add docs changelog.d
git commit -m "docs(casa): wiki, domínio, changelog e dossiê da entrega C

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018ggn1joCi8AH3JJ2MCLkgM"
```

---

## Depois das tarefas (coordenador)

1. Revisão final do branch inteiro; um único lote de correções.
2. Varredura com Playwright (Galaxy S25+), duas boxes e a casa: Conferir na casa (sem bancos e com bancos), Simular nas três visões (cenário criado na casa não aparece em ana, e vice-versa; cenário antigo na casa), Bancos na casa, Importar extrato na casa.
3. Mostrar os fragmentos de changelog; skill `ciclo-de-entrega`: merge na `main`, `npm run release`, push, `npm run deploy`.
4. Mover VB-23 e VB-24 do item 34 do `TODO.md` para `TODO-CONCLUIDOS.md`; limpar o worktree.
