# Modo simples e avançado — plano de implementação

> **Para agentes:** use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Os passos usam checkbox (`- [ ]`).

**Meta:** dar ao Flow dois modos de uso (Simples e Avançado) por tela, com Simples como padrão em instalações novas.

**Arquitetura:** `Config.modos` guarda o modo de cinco telas (Hoje, Fluxo, Cartão, Análises, Lançar). Cada tela lê o seu modo e esconde blocos no Simples. O Simples reusa as entidades existentes (Lançamento, ConferenciaFatura, Cenario). Não há entidade nova nem `version(n)` no Dexie.

**Tecnologia:** React 18, TypeScript, Zustand, Dexie, Vitest, Testing Library. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-01-modo-simples-avancado-design.md`. **Mockup aprovado:** `mockup-modos.html` v3 (pasta de rascunho da sessão; o CSS vem de `src/styles.css`).

## Restrições globais

- Todo texto de UI, doc e commit em **português**, sem palavras soltas em inglês.
- Worktree: `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\modo-simples-avancado`. Antes da primeira edição, rode `git rev-parse --show-toplevel`. **Não toque no checkout principal.**
- Valores em centavos inteiros. Datas `AAAA-MM-DD`. Dinheiro só por `src/domain/money.ts`.
- Campo `Config.modos` ausente = **Avançado**. Só instalação nova grava Simples.
- Toda persistência em `src/db/repo.ts`. A UI chama `repo.*` e depois `recarregar()`.
- Consultar `docs/estilo-visual.md` antes de editar `src/ui/**` ou `src/styles.css`. Classe ou componente novo entra em `docs/estilo/catalogo.md` (só na Tarefa 12).
- Botão que leva a um lugar nunca divide a tela com funcionalidade: "Sobre o app" é só menu; os botões de modo ficam na tela "Modo de uso".
- Sem mudança em `scripts/`, `vite.config.ts`, `tsconfig.json`, `package.json` e `.claude/`.
- Dados de teste e de exemplo são sintéticos.
- Não edite `"version"` nem o topo do `CHANGELOG.md`. A mudança vira fragmento em `changelog.d/` (Tarefa 12).
- Cada tarefa roda `npm test` completo antes de terminar, escreve casos-limite e faz commit com as linhas de atribuição:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01WH8gfo71TYX9WhvasFpUNa`.
- Dossiê (`npm run dossie`) e catálogo só na Tarefa 12, para evitar colisão entre tarefas.

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/domain/types.ts` | modifica | tipos `TelaModo`, `ModoUso`, `Config.modos` |
| `src/domain/modos.ts` (+ `.test.ts`) | cria | `modoDe`, `modosEfetivos`, `modosInstalacaoNova`, `modosValidos`, `categoriaPorDescricao` |
| `src/domain/simulacao.ts` | modifica | `menorSaldo`, `primeiroDiaNegativo` |
| `src/db/repo.ts` | modifica | `salvarModo`, padrão de instalação nova, `limparSimulacoesRapidas` |
| `src/backup/backup.ts` | modifica | validar `modos` |
| `src/test-setup.ts` | modifica | `limparDb` semeia Avançado |
| `src/state/store.ts` | modifica | `SecaoAjustes` ganha `'modos'`; `iniciar` limpa simulações rápidas |
| `src/ui/useModo.ts` | cria | hook `useModo(tela)` |
| `src/ui/ajustes/versaoAtual.ts` | cria | versão atual lida do changelog |
| `src/ui/ajustes/ModoDeUso.tsx` (+ teste) | cria | tela dos cinco botões |
| `src/ui/TelaAjustes.tsx` | modifica | grupo "Sobre o app", `Linha` com `valor` |
| `src/ui/TelaLancar.tsx` | modifica | Lançar simples |
| `src/ui/TelaHoje.tsx` | modifica | Hoje simples |
| `src/ui/TelaFluxo.tsx`, `SimuladorFluxo.tsx`, `SimuladorSimples.tsx` (novo) | modifica/cria | Fluxo e Simular simples |
| `src/ui/TelaCartao.tsx`, `CartaoSimples.tsx` (novo) | modifica/cria | Cartão simples |
| `src/ui/TelaAnalises.tsx` | modifica | Análises simples |
| `docs/wiki/`, `docs/estilo/catalogo.md`, `docs/dominio.md`, `changelog.d/` | modifica/cria | documentação (Tarefa 12) |

---

### Tarefa 1: Tipos e funções puras dos modos

**Arquivos:**
- Modifica: `src/domain/types.ts` (interface `Config`, linha ~169)
- Cria: `src/domain/modos.ts`, `src/domain/modos.test.ts`

**Interfaces — produz:**
```ts
export const TELAS_MODO = ['hoje', 'fluxo', 'cartao', 'analises', 'lancar'] as const;
export type TelaModo = (typeof TELAS_MODO)[number];
export type ModoUso = 'simples' | 'avancado';
export type ModosUso = Record<TelaModo, ModoUso>;
// Config.modos?: Partial<ModosUso>
export function modoDe(config: Config, tela: TelaModo): ModoUso;           // ausente → 'avancado'
export function modosEfetivos(config: Config): ModosUso;                    // completa com 'avancado'
export function modosInstalacaoNova(): ModosUso;                            // tudo 'simples'
export function modosValidos(x: unknown): x is Partial<ModosUso>;           // aceita undefined? não: só objeto
export function categoriaPorDescricao(p: {
  lancamentos: Lancamento[]; categorias: Categoria[]; boxId: ID; tipo: TipoCategoria; descricao: string;
}): ID | null;
```

- [ ] **Passo 1: escrever o teste que falha** em `src/domain/modos.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { categoriaPorDescricao, modoDe, modosEfetivos, modosInstalacaoNova, modosValidos } from './modos';
import type { Categoria, Config, Lancamento } from './types';

const config = (modos?: Config['modos']): Config => ({
  id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false,
  horizonteProjecao: '2027-12-31', ...(modos ? { modos } : {}),
});

describe('modoDe', () => {
  it('campo ausente vale avançado', () => {
    expect(modoDe(config(), 'hoje')).toBe('avancado');
  });
  it('chave ausente dentro de modos vale avançado', () => {
    expect(modoDe(config({ hoje: 'simples' }), 'fluxo')).toBe('avancado');
  });
  it('lê o modo gravado', () => {
    expect(modoDe(config({ cartao: 'simples' }), 'cartao')).toBe('simples');
  });
});

describe('modosEfetivos e modosInstalacaoNova', () => {
  it('completa as cinco telas', () => {
    expect(modosEfetivos(config({ hoje: 'simples' }))).toEqual({
      hoje: 'simples', fluxo: 'avancado', cartao: 'avancado', analises: 'avancado', lancar: 'avancado',
    });
  });
  it('instalação nova começa tudo em simples', () => {
    expect(Object.values(modosInstalacaoNova()).every((m) => m === 'simples')).toBe(true);
    expect(Object.keys(modosInstalacaoNova())).toHaveLength(5);
  });
});

describe('modosValidos', () => {
  it('aceita objeto parcial', () => expect(modosValidos({ hoje: 'simples' })).toBe(true));
  it('rejeita valor fora do conjunto', () => expect(modosValidos({ hoje: 'facil' })).toBe(false));
  it('rejeita chave desconhecida', () => expect(modosValidos({ lixo: 'simples' })).toBe(false));
  it('rejeita não-objeto e array', () => {
    expect(modosValidos('simples')).toBe(false);
    expect(modosValidos([])).toBe(false);
    expect(modosValidos(null)).toBe(false);
  });
});

describe('categoriaPorDescricao', () => {
  const cat = (id: string, tipo: Categoria['tipo'], arquivada = false): Categoria =>
    ({ id, boxId: 'b1', nome: id, tipo, ordem: 0, arquivada } as unknown as Categoria);
  const lanc = (id: string, over: Partial<Lancamento>): Lancamento =>
    ({ id, boxId: 'b1', categoriaId: 'c1', data: '2026-09-01', valor: 100, status: 'efetivo',
       origem: 'manual', criadoEm: '2026-09-01T10:00:00Z', alteradoEm: '2026-09-01T10:00:00Z', ...over } as Lancamento);
  const base = { boxId: 'b1', tipo: 'gasto' as const };

  it('acha a categoria da mesma descrição, sem diferenciar maiúsculas nem espaços', () => {
    const r = categoriaPorDescricao({ ...base, categorias: [cat('c1', 'gasto')], descricao: '  MERCADO ',
      lancamentos: [lanc('l1', { nota: 'mercado' })] });
    expect(r).toBe('c1');
  });
  it('usa o lançamento mais recente quando há categorias diferentes', () => {
    const r = categoriaPorDescricao({ ...base, categorias: [cat('c1', 'gasto'), cat('c2', 'gasto')], descricao: 'padaria',
      lancamentos: [lanc('l1', { nota: 'padaria', categoriaId: 'c1', data: '2026-08-01' }),
                    lanc('l2', { nota: 'padaria', categoriaId: 'c2', data: '2026-09-10' })] });
    expect(r).toBe('c2');
  });
  it('ignora descrição vazia, categoria arquivada, tipo diferente, outra box, cenário e origem não manual', () => {
    const lancamentos = [
      lanc('a', { nota: 'x', categoriaId: 'arq' }),
      lanc('b', { nota: 'x', categoriaId: 'ganho1' }),
      lanc('c', { nota: 'x', boxId: 'b2' }),
      lanc('d', { nota: 'x', cenarioId: 'cen' }),
      lanc('e', { nota: 'x', origem: 'cartao' }),
    ];
    const categorias = [cat('arq', 'gasto', true), cat('ganho1', 'ganho'), cat('c1', 'gasto')];
    expect(categoriaPorDescricao({ ...base, categorias, lancamentos, descricao: 'x' })).toBeNull();
    expect(categoriaPorDescricao({ ...base, categorias, lancamentos, descricao: '   ' })).toBeNull();
  });
});
```
Antes de rodar, confira em `src/domain/types.ts` o nome real do campo de categoria arquivada e ajuste o helper `cat` do teste.

- [ ] **Passo 2: rodar e ver falhar**
Run: `npx vitest run src/domain/modos.test.ts`
Esperado: FALHA, módulo `./modos` inexistente.

- [ ] **Passo 3: implementar.** Em `src/domain/types.ts`, acima de `Config`, adicione `export type TelaModo`, `ModoUso` e `ModosUso` (exatamente como em "Interfaces") e inclua em `Config`: `modos?: Partial<ModosUso>; // ausente = avançado; só instalação nova grava 'simples'`. Crie `src/domain/modos.ts`:
```ts
import type { Categoria, Config, ID, Lancamento, ModoUso, ModosUso, TelaModo, TipoCategoria } from './types';
import { TELAS_MODO } from './types';

export function modoDe(config: Config, tela: TelaModo): ModoUso {
  return config.modos?.[tela] ?? 'avancado';
}

export function modosEfetivos(config: Config): ModosUso {
  return Object.fromEntries(TELAS_MODO.map((t) => [t, modoDe(config, t)])) as ModosUso;
}

export function modosInstalacaoNova(): ModosUso {
  return Object.fromEntries(TELAS_MODO.map((t) => [t, 'simples'])) as ModosUso;
}

export function modosValidos(x: unknown): x is Partial<ModosUso> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.entries(x).every(
    ([k, v]) => (TELAS_MODO as readonly string[]).includes(k) && (v === 'simples' || v === 'avancado'),
  );
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** Categoria do último lançamento manual da box com a mesma descrição (nota). Nulo se não houver. */
export function categoriaPorDescricao(p: {
  lancamentos: Lancamento[]; categorias: Categoria[]; boxId: ID; tipo: TipoCategoria; descricao: string;
}): ID | null {
  const chave = norm(p.descricao);
  if (!chave) return null;
  const porId = new Map(p.categorias.map((c) => [c.id, c]));
  let melhor: Lancamento | undefined;
  for (const l of p.lancamentos) {
    if (l.boxId !== p.boxId || l.cenarioId || l.origem !== 'manual' || norm(l.nota) !== chave) continue;
    const c = porId.get(l.categoriaId);
    if (!c || c.arquivada || c.tipo !== p.tipo) continue;
    if (!melhor || l.data > melhor.data || (l.data === melhor.data && l.criadoEm > melhor.criadoEm)) melhor = l;
  }
  return melhor?.categoriaId ?? null;
}
```
`TELAS_MODO` é um valor: declare-o em `types.ts` (único lugar) e reexporte-o de `modos.ts` com `export { TELAS_MODO } from './types';`.

- [ ] **Passo 4: rodar e ver passar**
Run: `npx vitest run src/domain/modos.test.ts` → PASS. Depois `npx tsc -b` sem erros.

- [ ] **Passo 5: commit** — `feat(modos): tipos e funções puras do modo simples e avançado`.

---

### Tarefa 2: Persistência, padrão de instalação nova e isolamento dos testes

**Arquivos:**
- Modifica: `src/db/repo.ts` (`configPadrao` l.18-24, `carregarTudo` l.42-53, `salvarConfig` l.253), `src/test-setup.ts`, `src/state/store.ts` (`iniciar`)
- Testa: `src/db/repo.test.ts` (acrescentar), `src/state/store.test.ts` (acrescentar)

**Interfaces — consome:** `modosEfetivos`, `modosInstalacaoNova` (Tarefa 1). **Produz:**
```ts
export async function salvarModo(tela: TelaModo, modo: ModoUso): Promise<void>;
export const NOME_SIMULACAO_RAPIDA = 'Simulação rápida';
export async function limparSimulacoesRapidas(): Promise<void>; // apaga cenários com esse nome (e seus itens)
```

- [ ] **Passo 1: testes que falham** em `src/db/repo.test.ts`:
  - banco vazio, `carregarTudo()` → `config.modos` todos `'simples'` (instalação nova);
  - config já existente sem `modos` → `carregarTudo()` não grava `modos` (continua ausente);
  - `salvarModo('cartao','simples')` numa config sem `modos` → `modos` fica com as cinco chaves, `cartao: 'simples'` e as outras `'avancado'`; `mudancasDesdeBackup` continua `false`;
  - `salvarModo` duas vezes na mesma tela não duplica nem muda as outras;
  - `limparSimulacoesRapidas` apaga só cenários com `NOME_SIMULACAO_RAPIDA` (e seus lançamentos/recorrências), e mantém um cenário de outro nome.
  Como estes testes dependem de banco vazio **sem** o `limparDb` semeado, o teste da instalação nova usa `await Promise.all(db.tables.map((t) => t.clear()))` direto.

- [ ] **Passo 2: rodar e ver falhar**
Run: `npx vitest run src/db/repo.test.ts -t "modo"`.

- [ ] **Passo 3: implementar** em `repo.ts`:
```ts
function configInstalacaoNova(): Config {
  return { ...configPadrao(), modos: modosInstalacaoNova() };
}
// em carregarTudo: `config = configInstalacaoNova();` no ramo `if (!config)` (e só nele).

export async function salvarModo(tela: TelaModo, modo: ModoUso): Promise<void> {
  const atual = (await db.config.get('config')) ?? configPadrao();
  await salvarConfig({ modos: { ...modosEfetivos(atual), [tela]: modo } });
}

export const NOME_SIMULACAO_RAPIDA = 'Simulação rápida';
export async function limparSimulacoesRapidas(): Promise<void> {
  const rascunhos = await db.cenarios.filter((c) => c.nome === NOME_SIMULACAO_RAPIDA).toArray();
  for (const c of rascunhos) await excluirCenario(c.id);
}
```
`salvarModo` não chama `marcarMudanca` (padrão de `salvarConfig`): trocar de modo não é mudança de dados a salvar em backup.
Em `store.ts`, no `iniciar`, depois de `carregarTudo()` inicial e antes do `materializarTodas`, chame `await repo.limparSimulacoesRapidas();` (limpa rascunho de simulação deixado por fechamento abrupto).
Em `src/test-setup.ts`, `limparDb` passa a semear o Avançado, para a suíte existente continuar a ver todas as telas completas:
```ts
export async function limparDb() {
  await Promise.all(db.tables.map((t) => t.clear()));
  await repo.salvarConfig({ modos: modosEfetivos(/* config padrão vazia */ { id: 'config' } as Config) });
}
```
(`modosEfetivos` sobre config sem `modos` devolve tudo `'avancado'`; importe `repo` e os tipos necessários.)

- [ ] **Passo 4: rodar a suíte inteira**
Run: `npm test`. Esperado: tudo verde. Se um teste existente comparar `config` por igualdade estrita e falhar por causa de `modos`, ajuste **o teste** (acrescente `modos` esperado), nunca o código.

- [ ] **Passo 5: commit** — `feat(modos): persistência de modos e padrão simples na instalação nova`.

---

### Tarefa 3: Backup valida `modos`

**Arquivos:** modifica `src/backup/backup.ts` (config validada em ~l.38-40; `dados.config = {...}` ~l.63); testa `src/backup/backup.test.ts`.

- [ ] **Passo 1: testes que falham:** (a) backup sem `modos` valida e a config volta sem `modos`; (b) com `modos` válido passa e preserva; (c) `modos: { hoje: 'facil' }` lança `Error` com mensagem em português; (d) `modos: []` e `modos: 'x'` lançam; (e) `mesclar(atual, doBackup)` mantém `atual.config.modos` (config local vence); (f) `substituirTudo` com backup que tem `modos` grava os do backup (teste em `repo.test.ts`).
- [ ] **Passo 2:** rodar `npx vitest run src/backup/backup.test.ts` → falha em (c) e (d).
- [ ] **Passo 3: implementar** logo depois da checagem da config:
```ts
if ('modos' in d.config && d.config.modos !== undefined && !modosValidos(d.config.modos)) {
  throw new Error('Backup corrompido: modos de uso inválidos.');
}
```
- [ ] **Passo 4:** `npm test` verde.
- [ ] **Passo 5:** commit — `feat(backup): valida os modos de uso`.

---

### Tarefa 4: Tela "Modo de uso", menu "Sobre o app" e versão no botão

**Arquivos:**
- Modifica: `src/state/store.ts` (`SecaoAjustes`, l.13), `src/ui/TelaAjustes.tsx`, `src/ui/ajustes/Versao.tsx`
- Cria: `src/ui/useModo.ts`, `src/ui/ajustes/versaoAtual.ts`, `src/ui/ajustes/ModoDeUso.tsx`, `src/ui/ajustes/ModoDeUso.test.tsx`
- Testa também: `src/ui/TelaAjustes.test.tsx`

**Interfaces — produz:**
```ts
// src/ui/useModo.ts
export function useModo(tela: TelaModo): ModoUso; // useApp((s) => modoDe(s.dados.config, tela))
// src/ui/ajustes/versaoAtual.ts
export const versoesDoApp: ChangelogVersao[];     // parseChangelog(changelogRaw)
export const versaoAtual: string;                 // versoesDoApp[0]?.versao ?? ''
```

- [ ] **Passo 1: testes que falham.**
  - `ModoDeUso.test.tsx`: semeia box e `iniciar()`; renderiza `<ModoDeUso />`; mostra os cinco rótulos (`Hoje`, `Fluxo`, `Cartão`, `Análises`, `Lançar (+)`); com config sem `modos` cada um mostra `Avançado`; clicar em `Simples` do "Hoje" chama `salvarModo` e passa a mostrar o selo "Simples" (verifique em `db.config.get('config')` que `modos.hoje === 'simples'` e que as outras quatro seguem `'avancado'`); em instalação nova (sem semear `limparDb`) as cinco começam `Simples`.
  - `TelaAjustes.test.tsx`: o grupo "Sobre o app" lista, nesta ordem, `Modo de uso`, `Wiki`, `Versão`; a linha "Versão" mostra o número lido de `versaoAtual` (use `expect(screen.getByText(versaoAtual))`); tocar em "Versão" abre o histórico; tocar em "Modo de uso" abre `ModoDeUso` com o botão "‹ Sobre o app"; **a tela-menu não contém nenhum botão Simples/Avançado**.
- [ ] **Passo 2:** rodar os dois arquivos → falham.
- [ ] **Passo 3: implementar.**
  - `store.ts`: acrescente `'modos'` à união `SecaoAjustes`.
  - `versaoAtual.ts`: importa `changelogRaw from '../../../CHANGELOG.md?raw'` e `parseChangelog`; exporta `versoesDoApp` e `versaoAtual`. `Versao.tsx` passa a usar `versoesDoApp` (um só lugar lê a versão).
  - `useModo.ts`: `import { useApp } from '../state/store'; import { modoDe } from '../domain/modos';`.
  - `TelaAjustes.tsx`: no grupo `sobre`, itens `modos` ("Modo de uso"), `wiki`, `versao` (nessa ordem). `Linha` ganha a propriedade opcional `valor?: string`, desenhada à direita, **antes** do `ChevronRight`, com a classe `sub`. Na lista de itens de um grupo, `valor={i.id === 'versao' ? versaoAtual : undefined}` e `detalhe={i.id === 'modos' ? 'Simples ou avançado, por tela' : …}`. Na subtela: `{secao === 'modos' && <ModoDeUso />}`.
  - `ModoDeUso.tsx`: um `.card` com a frase "Escolha o quanto de detalhe cada tela mostra. Seus dados são os mesmos nos dois modos e nada se perde ao trocar."; por tela, um `.item.item-coluna` com o nome, um selo (`.badge`: "Simples" ou "Avançado"), `.pills` com os botões Simples e Avançado (`button.ativo`) e uma linha `.sub` com o resumo da tabela da spec. Cada clique faz `await repo.salvarModo(tela, modo); await recarregar();`. Reproduza a composição do mockup v3 (tela "Modo de uso"), com as classes reais e sem estilo novo.
  - Resumos (`.sub`), um por tela e modo — use exatamente estes textos:
    - Hoje: Simples "Saldo, projeção e conferência com um número só." / Avançado "Conferir por banco, transferência entre bancos, cheque especial."
    - Fluxo: Simples "Lista, gráfico e Simular (“e se eu gastar…”)." / Avançado "Filtro por banco, cenários completos, “Tornar real”."
    - Cartão: Simples "Só o valor da fatura e o vencimento." / Avançado "Compras, parcelas, categorias, assinaturas, conferência."
    - Análises: Simples "Só o mês: resumo, categorias e evolução." / Avançado "Períodos longos, Viagens, Comparativo, categorias do cartão."
    - Lançar: Simples "Valor, Gasto/Ganho e descrição opcional. Igual em qualquer tela." / Avançado "Todos os campos. Igual em qualquer tela."
- [ ] **Passo 4:** `npm test` verde.
- [ ] **Passo 5:** commit — `feat(modos): tela Modo de uso e versão visível em Sobre o app`.

---

### Tarefa 5: Lançar simples

**Arquivos:** modifica `src/ui/TelaLancar.tsx` (171 linhas); testa `src/ui/TelaLancar.test.tsx` (acrescentar; se não existir, crie no estilo de `TelaHoje.test.tsx`).

**Consome:** `useModo('lancar')`, `categoriaPorDescricao`, `repo.categoriaAClassificarDe(boxId, tipo)` (repo l.514), `bancoPadrao(dados.bancos, boxId)` (`domain/bancos.ts`), `repo.salvarLancamento`.

- [ ] **Passo 1: testes que falham** (modo Simples via `repo.salvarModo('lancar','simples')` antes de `iniciar()`):
  - só aparecem: valor, Gasto/Ganho, descrição (rótulo "Do que foi? (opcional)"), botão "Lançar"; **não** aparecem categoria, banco, data, "Marcar como previsto", viagem;
  - lança um Gasto de 48 reais com descrição "mercado" repetida de um lançamento anterior: grava com a **categoria anterior**, `data === hoje`, `status 'efetivo'`, `origem 'manual'`, `nota 'mercado'`, `bancoId` = banco padrão da box (se houver);
  - descrição sem correspondência: usa a categoria "A classificar" do tipo (criada por `categoriaAClassificarDe`, **uma só**, mesmo em dois lançamentos seguidos);
  - sem descrição: "A classificar";
  - duplo clique rápido em "Lançar": um único lançamento;
  - no modo Avançado, o formulário atual continua igual (todos os campos presentes).
  - Box: usa `config.boxPadraoId`; sem box padrão e com mais de uma box, mantém o seletor de Box visível (uma vez).
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3: implementar.** Leia `TelaLancar.tsx` e `docs/estilo/nivel-1-editar-tela.md`. No Simples: renderize só os blocos listados; calcule `categoriaId` no clique com `categoriaPorDescricao({...})` ?? `await repo.categoriaAClassificarDe(boxId, tipo)`; use `hoje` do store; proteja o duplo toque com um `useRef`/estado `salvando` que bloqueia o segundo clique até o fim do `await`. No Avançado, não mude nada. Mantenha **uma** `TelaLancar`: esconda blocos com `modo === 'avancado' && (...)`, sem duplicar o componente. Em "A classificar", o lançamento deve ficar visível para reclassificar no editor do Fluxo (já é assim).
- [ ] **Passo 4:** `npm test` verde. **Passo 5:** commit — `feat(modos): Lançar simples`.

---

### Tarefa 6: Hoje simples

**Arquivos:** modifica `src/ui/TelaHoje.tsx` (509 linhas); testa `src/ui/TelaHoje.test.tsx` (acrescentar).

- [ ] **Passo 1: testes que falham** (Simples = `salvarModo('hoje','simples')` antes de `iniciar()`):
  - Visão mostra saldo, projeção e gráfico; **sem** o rodapé detalhado de backup (`button.backup-rodape`), mas mantém o aviso de backup só quando já passou do limite vermelho existente (veja o código; se não houver como separar, esconda todo o rodapé no Simples e deixe uma linha única "Faça um backup em Ajustes › Backup e restauração." quando `mudancasDesdeBackup` for verdadeiro);
  - Conferir: um único campo "Saldo real no banco" (total de tudo), **sem** sinal ±, **sem** `↔`, **sem** lista por banco; mesmo com bancos cadastrados, o Simples mostra o campo único;
  - salvar um valor grava pelo mesmo caminho de hoje (visão `casa`: `config.saldoDeclaradoCent`/`dataSaldoDeclarado`; box específica: `salvarBox`), sem criar lançamento;
  - a diferença usa **as mesmas frases** de hoje ("Bate certinho.", "falta inserir no app", "sobra no app…") e o mesmo "Total calculado no Flow";
  - Pendentes continua igual; Avançado continua idêntico ao atual (regressão: os testes atuais passam sem alteração).
  - Caso-limite: usuário com bancos e Simples **não** perde os saldos por banco ao voltar ao Avançado (nenhum `atualizarBanco` é chamado pelo Simples).
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3: implementar.** Em `TelaHoje.tsx`, leia `ConferenciaSaldo` (l.29), `ConferenciaBancos` (l.153) e o ponto de decisão (l.296-312). No Simples, a aba Conferir renderiza sempre `ConferenciaSaldo` (a variante sem bancos), escondendo o seletor de sinal. Reuse `TotalFlow` e `Diferenca`. Nada de componente novo se der para evitar; se criar classe, registre em "Pendências do catálogo" no commit para a Tarefa 12.
- [ ] **Passo 4:** `npm test` verde. **Passo 5:** commit — `feat(modos): Hoje simples`.

---

### Tarefa 7: Fluxo simples e Simular simples

**Arquivos:**
- Modifica: `src/domain/simulacao.ts`, `src/ui/TelaFluxo.tsx` (300 linhas), `src/ui/SimuladorFluxo.tsx`
- Cria: `src/ui/SimuladorSimples.tsx`, `src/ui/SimuladorSimples.test.tsx`
- Testa: `src/domain/simulacao.test.ts`, `src/ui/TelaFluxo.test.tsx`

**Interfaces — produz:**
```ts
// src/domain/simulacao.ts
export function menorSaldo(serie: DiaSaldo[], campo: 'saldoProjetado' | 'saldoComCenarios', hoje: ISODate): number;
export function primeiroDiaNegativo(serie: DiaSaldo[], campo: 'saldoProjetado' | 'saldoComCenarios', hoje: ISODate): ISODate | null;
```
Ambas olham só dias `>= hoje`. Série vazia: `menorSaldo` devolve `0`.

- [ ] **Passo 1: testes que falham.**
  - `simulacao.test.ts`: série de 3 dias com saldos `[100, -50, 20]` → `menorSaldo` `-50`; `primeiroDiaNegativo` devolve a data do segundo; dias anteriores a `hoje` são ignorados; série sem negativo → `null`; série vazia → `0`.
  - `TelaFluxo.test.tsx` (Simples): na aba Lista **não** aparece `SeletorFiltroBanco` nem o saldo por dia (`cabecalho-dia` mostra só a data); o gráfico e a lista continuam; a aba Simular existe nos dois modos; Avançado igual ao atual.
  - `SimuladorSimples.test.tsx`: preencher valor `1500,00` e data futura, escolher "Uma vez" → mostra "Menor saldo sem a compra" e "Menor saldo com a compra" com os valores esperados (calcule à mão com saldo semeado sintético); quando o menor saldo com a compra é negativo, mostra `aviso aviso-urgente` "O saldo ficaria negativo em DD/MM."; "Parcelado" pede nº de parcelas e "Todo mês" repete; **um** cenário `NOME_SIMULACAO_RAPIDA` existe depois da simulação; uma segunda simulação **substitui** a primeira (continua um só); ao desmontar sem "Guardar", o cenário é apagado (`db.cenarios` sem `NOME_SIMULACAO_RAPIDA`); "Guardar" renomeia para `Simulação de DD/MM` (o cenário fica e **não** é apagado ao desmontar).
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3: implementar.**
  - `simulacao.ts`: as duas funções (loop simples sobre `serie.filter((d) => d.data >= hoje)`).
  - `SimuladorSimples.tsx`: campos com `CampoValor` e `CampoData` reais (veja `FormItemCenario.tsx`), `OPCOES_REPETICAO` e `gravarItemNovo(cenarioId, boxId, valores, horizonte)` (`FormItemCenario.tsx:34`) com `tipo: 'gasto'` e categoria `await repo.categoriaAClassificarDe(boxId, 'gasto')`. Ao simular: apague o rascunho anterior (`repo.excluirCenario`), crie `{ id: novoId(), nome: NOME_SIMULACAO_RAPIDA, ligado: true, … }` com `repo.salvarCenario`, grave o item, `recarregar()`. Calcule com `projetarBoxes(ids, {…, cenariosLigados: new Set([cenarioId])})` e as funções novas: "sem" = `saldoProjetado`, "com" = `saldoComCenarios`. Use `useEffect` com limpeza que apaga o rascunho ao desmontar, a menos que `guardado`. Siga a composição do mockup v3 (tela Fluxo › Simular, Simples), com classes reais.
  - `TelaFluxo.tsx`: no Simples, não renderize `SeletorFiltroBanco` (nem o aviso do filtro) nem o saldo por dia no `cabecalho-dia`. Na aba Simular: `modo === 'simples' ? <SimuladorSimples /> : <SimuladorFluxo />`. No Avançado nada muda.
  - Consistência: o aviso de saldo negativo usa a mesma classe `aviso aviso-urgente` e o mesmo tom do `SimuladorFluxo`.
- [ ] **Passo 4:** `npm test` verde. **Passo 5:** commit — `feat(modos): Fluxo simples e Simular leve`.

---

### Tarefa 8: Cartão simples (valor da fatura pela Conferência)

**Arquivos:**
- Modifica: `src/ui/TelaCartao.tsx` (356 linhas)
- Cria: `src/ui/CartaoSimples.tsx`, `src/ui/CartaoSimples.test.tsx`

**Consome:** `repo.salvarConferenciaFatura(cartaoId, mes, valorAppCent, usarValorApp, horizonte)` (repo l.744), `repo.confirmarPendente(id)` (repo l.115), `PagamentoFaturaSheetModal`, `SeletorMes`, `calcularFaturas`/`dados.conferenciasFatura`/`dados.lancamentos` (como `CartaoFatura`, l.126-178).

- [ ] **Passo 1: testes que falham** (Simples = `salvarModo('cartao','simples')`; cartão sintético com fechamento dia 5 e vencimento dia 12; `hoje` fixo; mês de vencimento no futuro):
  - mostra, por cartão, o seletor de mês, o campo "Valor da fatura", o campo "Vencimento" (somente leitura, calculado de `datasFaturaDoMes`) e o botão "Salvar fatura";
  - salvar um valor de fatura grava uma `ConferenciaFatura` com `usarValorApp: true` e `valorAppCent` igual ao valor digitado, em centavos, **não** cria `CompraCartao`, e depois de `sincronizarCartoes` existe **um** lançamento previsto de fatura no vencimento com esse valor;
  - salvar de novo com outro valor atualiza a **mesma** conferência (`db.conferenciasFatura` com um registro só) e o previsto;
  - mês com compras detalhadas: o campo já vem com a soma das compras; salvar outro valor marca `usarValorApp` e **não apaga** as compras;
  - com o lançamento previsto existente: aparecem "Paguei tudo" (chama `repo.confirmarPendente(lancFatura.id)` → o lançamento vira `efetivo`) e "Paguei outro valor" (abre `PagamentoFaturaSheetModal`);
  - mês cujo vencimento já passou e **sem** lançamento: mostra o `aviso` "O vencimento desta fatura já passou. O valor fica registrado na Conferência, mas não entra no Fluxo." e **nenhum** botão de pagamento;
  - valor zerado ou vazio: botão "Salvar fatura" desabilitado com a pista de campo faltando abaixo dos botões (padrão do app);
  - visão `casa` empilha os cartões; sem cartão mostra o convite "Cadastrar cartão" existente;
  - voltar ao Avançado mostra a mesma conferência marcada na aba Conferência.
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3: implementar.** `CartaoSimples` recebe `{ cartao }` e replica a leitura de `CartaoFatura` (mês, `lancFatura`, fatura calculada, conferência do mês). `TelaCartao.tsx`: `modo === 'simples' ? <CartaoSimples cartao={c} /> : <CartaoFatura … />` por cartão. Mantenha `AvisoFaturaForaDoFluxo` quando fizer sentido. Reuse `CampoValor` e `CampoData`/rótulos reais; mostre o vencimento como `.sub`, sem campo editável (o vencimento vem do cadastro do cartão).
- [ ] **Passo 4:** `npm test` verde. **Passo 5:** commit — `feat(modos): Cartão simples usa a conferência da fatura`.

---

### Tarefa 9: Análises simples

**Arquivos:** modifica `src/ui/TelaAnalises.tsx` (363 linhas); testa `src/ui/TelaAnalises.test.tsx` (acrescentar).

- [ ] **Passo 1: testes que falham.** No Simples: `SeletorPeriodo` mostra só "Mês" (ou nada, se for só um); **não** aparecem "12 meses", "Ano", "Período", checkbox "incluir previstos", `SeletorFiltroBanco`, card "Viagens", card "Comparativo", `CategoriasCartaoCard`; aparecem resumo (Ganhos/Gastos/Sobra), "Por categoria" e "Evolução mensal". Os números do Simples **iguais** aos do Avançado para o mesmo mês (compare os valores de Ganhos, Gastos e Sobra nos dois modos com os mesmos dados). Trocar de Avançado com período "Ano" para Simples volta ao período "Mês". Avançado igual ao atual.
- [ ] **Passo 2:** rodar → falha.
- [ ] **Passo 3: implementar.** Leia `TelaAnalises.tsx`. No Simples, force o período "Mês" (estado inicial e reset por `useEffect` quando o modo muda), esconda os blocos listados, e **não** altere `aggregations.ts`. Os drill-downs de categoria continuam abrindo as sheets existentes.
- [ ] **Passo 4:** `npm test` verde. **Passo 5:** commit — `feat(modos): Análises simples`.

---

### Tarefa 10: Primeiro uso escolhe o modo?

Fora do escopo desta entrega: a instalação nova já começa em Simples (Tarefa 2). Não crie pergunta inicial. (YAGNI; a spec não pede.)

---

### Tarefa 11: Consistência entre modos (teste transversal)

**Arquivos:** cria `src/ui/modos.consistencia.test.tsx`.

- [ ] **Passo 1:** com os mesmos dados sintéticos (box, categorias, lançamentos efetivos e previstos, um cartão com compras e conferência), renderize `TelaHoje`, `TelaFluxo` e `TelaAnalises` nos dois modos e compare:
  - o saldo grande de Hoje é idêntico;
  - o total do mês em Análises é idêntico;
  - um lançamento criado pelo Lançar simples aparece em Fluxo (Simples e Avançado) e em Análises, com o mesmo valor e a mesma cor/sinal (classes `valor-gasto`/`valor-ganho`);
  - a diferença da conferência de saldo (Hoje) e a da fatura (Cartão › Conferência) usam as mesmas frases nos dois modos.
- [ ] **Passo 2:** rode; se algo divergir, **conserte a tela divergente**, não o teste. **Passo 3:** `npm test` verde. **Passo 4:** commit — `test(modos): consistência entre simples e avançado`.

---

### Tarefa 12: Documentação, catálogo, dossiê, changelog e varredura

**Arquivos:**
- Modifica: `docs/wiki/` (capítulo sobre os modos; ajuste em Ajustes › Sobre o app e nas telas afetadas), `docs/dominio.md` (campo `Config.modos`, regra "ausente = Avançado", Cartão simples via conferência), `docs/estilo/catalogo.md` (toda classe/componente novo: `SimuladorSimples`, `CartaoSimples`, `ModoDeUso`, e qualquer classe nova de `styles.css`)
- Cria: `changelog.d/adicionado-modo-simples-avancado.md`

- [ ] **Passo 1:** leia `docs/wiki/README.md` (subconjunto fechado de markdown), `changelog.d/README.md` e `docs/estilo/catalogo.md`.
- [ ] **Passo 2:** escreva o capítulo da wiki (frases curtas, ASD-STE100; cubra os cinco controles, o padrão Simples, base antiga em Avançado, e onde mudar). Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts`.
- [ ] **Passo 3:** fragmento (formato plano, dois níveis no máximo, **sem negrito**, sem valores reais), por exemplo:
```
- Modo simples e avançado: cada tela (Hoje, Fluxo, Cartão, Análises e Lançar) tem o seu modo, em Ajustes › Sobre o app › Modo de uso
  - O app novo começa no modo Simples; quem já usa o app continua no Avançado
  - A versão do app aparece direto no botão "Versão", em Sobre o app
```
- [ ] **Passo 4:** `node scripts/verificar-catalogo.mjs` (sem erro), `node scripts/verificar-dados-reais.mjs` (sem achado), `npm run dossie` e, se o dossiê mudou, revise o diff com a skill `revisar-dossie`. `npm test` e `npm run build` verdes.
- [ ] **Passo 5:** varredura com Playwright (pasta de rascunho da sessão, fora do `package.json`): Galaxy S25+ (411 × 744, screen 412 × 892, `deviceScaleFactor` 2,63, `isMobile`, `hasTouch`, `locale` `pt-BR`); `npx vite` do worktree, porta própria, só `localhost`; dados sintéticos pelo `src/db/repo.ts` dentro de `page.evaluate`. Percorra, nos dois modos, Ajustes › Sobre o app › Modo de uso, Hoje, Fluxo (Lista, Gráfico, Simular), Cartão, Análises e o (+). Confira também: instalação nova abre em Simples; base com dados abre em Avançado; trocar o modo não perde dado; versão visível no botão. Envie as capturas pelo chat com `SendUserFile`. Encerre o `vite` antes de qualquer `git worktree remove`.
- [ ] **Passo 6:** commit — `docs(modos): wiki, catálogo, domínio e fragmento de changelog`.

---

## Autorrevisão

- **Cobertura da spec:** modos e padrão (T1, T2); backup (T3); Sobre o app, Modo de uso, versão no botão (T4); Lançar simples e categoria por descrição (T5); Hoje (T6); Fluxo, Simular leve e limpeza do rascunho (T2, T7); Cartão pela conferência e caso de vencimento passado (T8); Análises (T9); consistência (T11); wiki, catálogo, dossiê, changelog, varredura (T12). A Tarefa 10 registra o que ficou fora de propósito.
- **Tipos:** `TelaModo`, `ModoUso`, `ModosUso`, `modoDe`, `modosEfetivos`, `modosInstalacaoNova`, `modosValidos`, `categoriaPorDescricao` (T1) são usados com os mesmos nomes nas outras tarefas. `salvarModo`, `NOME_SIMULACAO_RAPIDA`, `limparSimulacoesRapidas` (T2) idem.
- **Pontos de chamada de `Config` (planejamento):** `carregarTudo`, `marcarMudanca`, `salvarConfig`, `substituirTudo`, `validarBackup`, `mesclar`, `store.iniciar` — todos cobertos em T2 e T3.
- **Risco aberto:** `limparDb` semeando Avançado (T2) pode quebrar teste que compara `config` por igualdade; a correção é no teste.
