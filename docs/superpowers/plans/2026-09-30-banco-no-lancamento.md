# Banco no lançamento — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam a sintaxe de caixa de seleção (`- [ ]`).

**Objetivo:** vincular cada lançamento a um banco, com banco padrão pré-selecionado, saldo calculado por banco e filtro por banco no Fluxo e nas Análises.

**Arquitetura:** o vínculo é o campo opcional `Lancamento.bancoId` (já existe no tipo). O banco padrão é o campo opcional `Banco.padrao`; sem marca, vale o primeiro banco por `ordem`. Toda regra nova mora em funções puras de `src/domain/bancos.ts`. A persistência muda só em `src/db/repo.ts`. Nenhum campo é índice, então **não há `this.version(n)` nova**.

**Tecnologias:** React 18, TypeScript, Vite, Zustand, Dexie, Vitest, Testing Library. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-09-30-banco-no-lancamento-design.md`. **Mockup aprovado:** enviado no chat em 2026-09-30 (cinco telas). Um desvio do mockup precisa de nova aprovação do usuário.

## Restrições globais

Valem para todas as tarefas. Valores copiados da spec e do `CLAUDE.md`.

- Todo texto de UI, comentário, doc e mensagem de commit em **português**. Nunca misture inglês solto.
- Valores monetários são **centavos inteiros**. Datas são `"AAAA-MM-DD"`.
- **Sem dependência npm nova.** Sem mudar `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem `.claude/`.
- **Sem classe CSS nova, sem token novo** (nível 1 de `docs/estilo/nivel-1-editar-tela.md`). Só classes do `catalogo.md`. `style` inline só de layout.
- Aviso de validação (`.aviso`) vai **depois** dos botões do formulário.
- Componente novo em `src/ui/` entra em `docs/estilo/catalogo.md` no mesmo commit.
- Dados de teste **sintéticos**. Nenhum valor, saldo ou nome real em arquivo versionado.
- Arquivos em UTF-8 **sem BOM**. Use as ferramentas de edição, não `Set-Content`.
- Não edite `"version"` do `package.json` nem o topo do `CHANGELOG.md`. A mudança vira um fragmento em `changelog.d/`.
- Não use `{ timeout: n }` em `findBy*`. Não aperte os timeouts de teste.
- Todo trabalho fica no worktree `C:\Users\eitor\Claude\ProjetoFinancas\.worktrees\banco-no-lancamento`, branch `banco-no-lancamento`. **Não toque no checkout principal.**
- Commits terminam com as duas linhas de atribuição (ver o modelo de commit abaixo). O texto `chore(release)` é reservado: nunca o use em mensagem de commit.

**Modelo de commit** (troque só a primeira linha):

```bash
git commit -m "feat(bancos): descrição curta" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

## Mapa de arquivos

| Arquivo | Muda o quê |
|---|---|
| `src/domain/types.ts` | `Banco.padrao?`, `Recorrencia.bancoId?`, comentários |
| `src/domain/bancos.ts` (+ `.test.ts`) | `bancoPadrao`, `bancoIdDoCartao`, `bancoIdDoLancamento`, `saldoCalculadoBanco`, `lancamentoNoFiltro`, `dadosDoBanco`, `nomeBancoDoLancamento`, tipo `FiltroBanco` |
| `src/db/repo.ts` (+ `.test.ts`) | `bancoId` em lançamento e recorrência, `definirBancoPadrao`, `excluirBanco`, `sincronizarCartoes`, `transferirEntreBancos` |
| `src/backup/backup.test.ts` | testes dos campos novos (código de `backup.ts` não muda) |
| `src/dossie/invariantes.ts` (+ `.test.ts`) | dois invariantes de expectativa |
| `src/ui/SeletorBanco.tsx` (+ teste) | **novo**: pílulas de banco do lançamento e da recorrência |
| `src/ui/SeletorFiltroBanco.tsx` (+ teste) | **novo**: pílulas do filtro (Todos, bancos, Sem banco) |
| `src/ui/TelaLancar.tsx`, `LancEditor.tsx`, `ajustes/Recorrencias.tsx` | campo Banco |
| `src/ui/ajustes/Bancos.tsx` | selo padrão, "Tornar padrão", saldo calculado |
| `src/ui/TelaFluxo.tsx`, `TelaAnalises.tsx` | filtro por banco; banco em cada item do Fluxo |
| `src/ui/TransferenciaSheet.tsx` (+ teste) | texto do aviso |
| `docs/dominio.md`, `docs/wiki/*`, `docs/estilo/catalogo.md`, `docs/dossie/*`, `changelog.d/` | docs e changelog |

## Decisões que refinam a spec

A Tarefa 0 grava estas decisões na spec. Elas nasceram da leitura do código depois de a spec ser aprovada.

1. **Banco da fatura na leitura.** `bancoIdDoLancamento` devolve o `bancoId` gravado; numa fatura de cartão sem `bancoId`, devolve o `bancoId` do **cartão** (nunca o padrão, para trocar o padrão não mover o histórico). Assim as faturas antigas já contam no banco do cartão.
2. **Cenário fica sem banco** e sem campo. Cenário não entra em saldo nem em filtro por banco específico.
3. **`LancamentosSheet` não muda.** Ele agrupa por nota; o filtro das Análises já restringe o que ele mostra. O nome do banco por item aparece só no Fluxo.
4. **Segundo componente:** `SeletorFiltroBanco` (o filtro), além do `SeletorBanco`. Fluxo e Análises usam o mesmo.
5. **Invariantes novos são `expectativa`**, não `garantido`: `mesclar` de backup pode trazer referência a banco que o outro lado excluiu, ou dois padrões.
6. **`TransferenciaSheet`:** o aviso passa a falar só de transferências feitas antes desta versão.

---

### Tarefa 0: Preparar o worktree e gravar as decisões na spec

**Arquivos:**
- Modificar: `docs/superpowers/specs/2026-09-30-banco-no-lancamento-design.md`

- [ ] **Passo 1: Confirmar o worktree e instalar as dependências do lockfile**

```bash
cd C:/Users/eitor/Claude/ProjetoFinancas/.worktrees/banco-no-lancamento
git rev-parse --show-toplevel
git branch --show-current
npm ci
```

Esperado: a primeira linha termina em `.worktrees/banco-no-lancamento`; o branch é `banco-no-lancamento`; `npm ci` termina sem erro. `npm ci` só instala o que o lockfile já fixa: não é dependência nova.

- [ ] **Passo 2: Rodar a suíte de base**

```bash
npm test
```

Esperado: tudo verde. Se algo falhar **antes** de qualquer mudança, pare e avise o usuário.

- [ ] **Passo 3: Ajustar a spec**

Em `docs/superpowers/specs/2026-09-30-banco-no-lancamento-design.md`:

1. Na tabela "Regra de gravação", troque a linha da fatura por:
   `| Fatura de cartão (`origem: 'cartao'`) | Previstos e novos: `Cartao.bancoId`, ou o padrão da box. Na leitura, fatura sem `bancoId` gravado usa o banco do cartão. |`
2. Na mesma tabela, troque a linha de cenário por: `| Cenário | Sem banco. Não tem o campo. |`
3. Troque o parágrafo que começa com "Só grava banco em lançamento `previsto` ou novo." por:
   "Só grava banco em lançamento `previsto` ou novo. Lançamento `efetivo` que já existe não muda sozinho. A leitura (`bancoIdDoLancamento`) cobre o histórico: fatura sem `bancoId` gravado usa o banco do **cartão** (nunca o padrão). A sincronização de faturas (`sincronizarCartoes`) atualiza o `bancoId` dos previstos e dos novos, e nunca o das faturas já pagas."
4. Na seção "Filtro por banco", apague a frase "A lista de lançamentos da sheet `LancamentosSheet` e a `TransferenciaSheet` recebem a mesma linha." e escreva no lugar: "O nome do banco por item aparece só no Fluxo. `LancamentosSheet` não muda: ele agrupa por nota, e o filtro das Análises já restringe o que ele mostra."
5. Na seção "Campo Banco", depois do componente `SeletorBanco`, acrescente: "O filtro usa outro componente pequeno, `SeletorFiltroBanco` (`SeletorPills` com Todos, cada banco e Sem banco), compartilhado por Fluxo e Análises."
6. Na seção "Transferência e o saldo informado", acrescente no fim: "A `TransferenciaSheet` passa a avisar só sobre transferências feitas antes desta versão."
7. Na seção "Pontos de chamada", troque "`converterCenarioEmReal`, e a gravação de itens de cenário em `FormItemCenario` (`gravarItemNovo`)" por "`converterCenarioEmReal` (não muda: cenário fica sem banco)".
8. Na seção "Docs e entrega", acrescente ao lado dos invariantes: "Os dois invariantes novos são `expectativa`."

- [ ] **Passo 4: Commitar**

```bash
git add docs/superpowers/specs/2026-09-30-banco-no-lancamento-design.md docs/superpowers/plans/2026-09-30-banco-no-lancamento.md
git commit -m "docs(spec): plano do banco no lançamento e decisões que refinam a spec" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 1: Regras de domínio dos bancos

**Arquivos:**
- Modificar: `src/domain/types.ts:24-32` (Banco), `:55` (comentário de `bancoId`), `:59-70` (Recorrencia)
- Modificar: `src/domain/bancos.ts`
- Testar: `src/domain/bancos.test.ts`

**Interfaces:**
- Consome: `efeitoNoSaldo(valor, tipo)` de `src/domain/money.ts`.
- Produz (as tarefas seguintes usam estes nomes exatos):
  - `bancoPadrao(bancos: Banco[], boxId: ID): Banco | undefined`
  - `bancoIdDoCartao(cartao: Cartao, bancos: Banco[]): ID | undefined`
  - `bancoIdDoLancamento(l: Lancamento, cartoes: Cartao[], bancos: Banco[]): ID | undefined`
  - `saldoCalculadoBanco(banco: Banco, dados: DadosDeBanco): number | null`
  - `type FiltroBanco = 'todos' | 'sem-banco' | ID`
  - `lancamentoNoFiltro(l: Lancamento, filtro: FiltroBanco, cartoes: Cartao[], bancos: Banco[]): boolean`
  - `dadosDoBanco(dados: Dados, filtro: FiltroBanco): Dados`
  - `nomeBancoDoLancamento(l: Lancamento, dados: Pick<Dados, 'cartoes' | 'bancos'>): string`
  - `type DadosDeBanco = Pick<Dados, 'lancamentos' | 'categorias' | 'cartoes' | 'bancos'>`

- [ ] **Passo 1: Escrever os testes que falham**

Em `src/domain/bancos.test.ts`, troque as duas primeiras linhas de import por:

```ts
import type { Banco, Cartao, Categoria, CompraCartao, Dados, Lancamento } from './types';
import {
  bancoIdDoCartao, bancoIdDoLancamento, bancoPadrao, bancosDaBox, dadosDoBanco, lancamentoNoFiltro,
  nomeBancoDoLancamento, saldoCalculadoBanco, totalDeclaradoCent,
} from './bancos';
```

Depois da função `banco(...)` (linha 8), acrescente os auxiliares:

```ts
const cat = (id: string, tipo: 'ganho' | 'gasto'): Categoria => (
  { id, boxId: 'box1', nome: id, tipo, ordem: 0, arquivada: false, ...ts }
);
const CATEGORIAS = [cat('gasto', 'gasto'), cat('ganho', 'ganho')];

function lanc(id: string, patch: Partial<Lancamento>): Lancamento {
  return {
    id, boxId: 'box1', categoriaId: 'gasto', data: '2026-08-02', valor: 1000,
    status: 'efetivo', origem: 'manual', ...ts, ...patch,
  };
}

function cartao(id: string, bancoId?: string): Cartao {
  return {
    id, boxId: 'box1', nome: 'Cartão', diaFechamento: 10, diaVencimento: 20,
    categoriaFaturaId: 'catfat', ativo: true, ...(bancoId ? { bancoId } : {}), ...ts,
  };
}

function compra(id: string, cartaoId: string): CompraCartao {
  return {
    id, cartaoId, categoriaCartaoId: 'cc', data: '2026-08-02', valorTotal: 1000, parcelas: 1, ...ts,
  };
}

function dadosCom(parcial: Partial<Dados>): Dados {
  return {
    boxes: [], categorias: CATEGORIAS, lancamentos: [], recorrencias: [], cenarios: [], cartoes: [],
    categoriasCartao: [], comprasCartao: [], recorrenciasCartao: [], conferenciasFatura: [],
    viagens: [], bancos: [], ajustesFechamento: [], notasFiscais: [],
    config: {
      id: 'config', boxPadraoId: null, ultimoBackupEm: null, mudancasDesdeBackup: false,
      horizonteProjecao: '2027-12-31',
    },
    ...parcial,
  };
}
```

No fim do arquivo, acrescente:

```ts
describe('bancoPadrao', () => {
  it('devolve o banco marcado como padrão', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 0, null), { ...banco('b2', 'box1', 'Beta', 1, null), padrao: true }];
    expect(bancoPadrao(bancos, 'box1')?.id).toBe('b2');
  });

  it('sem nenhuma marca, devolve o primeiro por ordem', () => {
    const bancos = [banco('b1', 'box1', 'Alfa', 1, null), banco('b2', 'box1', 'Beta', 0, null)];
    expect(bancoPadrao(bancos, 'box1')?.id).toBe('b2');
  });

  it('box sem bancos devolve undefined', () => {
    expect(bancoPadrao([], 'box1')).toBeUndefined();
  });

  it('ignora o padrão marcado numa box diferente', () => {
    const bancos = [{ ...banco('b1', 'box2', 'Alfa', 0, null), padrao: true }];
    expect(bancoPadrao(bancos, 'box1')).toBeUndefined();
  });

  it('duas marcadas (backup mesclado): vale a primeira por ordem', () => {
    const bancos = [
      { ...banco('b1', 'box1', 'Alfa', 1, null), padrao: true },
      { ...banco('b2', 'box1', 'Beta', 0, null), padrao: true },
    ];
    expect(bancoPadrao(bancos, 'box1')?.id).toBe('b2');
  });
});

describe('bancoIdDoCartao', () => {
  const bancos = [banco('b1', 'box1', 'Alfa', 0, null), banco('b2', 'box1', 'Beta', 1, null)];

  it('devolve o banco do cartão', () => {
    expect(bancoIdDoCartao(cartao('c1', 'b2'), bancos)).toBe('b2');
  });

  it('cartão sem banco usa o padrão da box', () => {
    expect(bancoIdDoCartao(cartao('c1'), bancos)).toBe('b1');
  });

  it('banco do cartão que não existe mais cai no padrão', () => {
    expect(bancoIdDoCartao(cartao('c1', 'fantasma'), bancos)).toBe('b1');
  });

  it('box sem bancos devolve undefined', () => {
    expect(bancoIdDoCartao(cartao('c1'), [])).toBeUndefined();
  });
});

describe('bancoIdDoLancamento', () => {
  const bancos = [banco('b1', 'box1', 'Alfa', 0, null)];

  it('devolve o banco gravado', () => {
    expect(bancoIdDoLancamento(lanc('l1', { bancoId: 'b1' }), [], bancos)).toBe('b1');
  });

  it('lançamento sem banco devolve undefined', () => {
    expect(bancoIdDoLancamento(lanc('l1', {}), [], bancos)).toBeUndefined();
  });

  it('banco que não existe mais conta como sem banco', () => {
    expect(bancoIdDoLancamento(lanc('l1', { bancoId: 'fantasma' }), [], bancos)).toBeUndefined();
  });

  it('fatura sem banco gravado usa o banco do cartão, nunca o padrão', () => {
    const l = lanc('l1', { origem: 'cartao', cartaoId: 'c1', faturaMes: '2026-08' });
    expect(bancoIdDoLancamento(l, [cartao('c1', 'b1')], bancos)).toBe('b1');
    expect(bancoIdDoLancamento(l, [cartao('c1')], bancos)).toBeUndefined();
  });

  it('lançamento manual não herda o banco de nenhum cartão', () => {
    const l = lanc('l1', { cartaoId: 'c1' });
    expect(bancoIdDoLancamento(l, [cartao('c1', 'b1')], bancos)).toBeUndefined();
  });
});

describe('saldoCalculadoBanco', () => {
  const b1 = banco('b1', 'box1', 'Alfa', 0, 100000); // informado em 2026-08-01
  const b2 = banco('b2', 'box1', 'Beta', 1, null);
  const base = { categorias: CATEGORIAS, cartoes: [] as Cartao[], bancos: [b1, b2] };

  it('sem saldo informado devolve null', () => {
    expect(saldoCalculadoBanco(b2, { ...base, lancamentos: [] })).toBeNull();
  });

  it('soma o ganho e subtrai o gasto posteriores ao saldo informado', () => {
    const lancamentos = [
      lanc('l1', { bancoId: 'b1', valor: 2000 }),
      lanc('l2', { bancoId: 'b1', categoriaId: 'ganho', valor: 5000, data: '2026-08-03' }),
    ];
    // 100000 - 2000 + 5000
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(103000);
  });

  it('lançamento na própria data do saldo, ou antes, já está no saldo informado', () => {
    const lancamentos = [
      lanc('l1', { bancoId: 'b1', valor: 999, data: '2026-08-01' }),
      lanc('l2', { bancoId: 'b1', valor: 999, data: '2026-07-31' }),
    ];
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(100000);
  });

  it('ignora previsto, cenário, lançamento sem banco e lançamento de outro banco', () => {
    const lancamentos = [
      lanc('l1', { bancoId: 'b1', status: 'previsto' }),
      lanc('l2', { bancoId: 'b1', cenarioId: 'c1', status: 'previsto' }),
      lanc('l3', {}),
      lanc('l4', { bancoId: 'b2' }),
    ];
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(100000);
  });

  it('estorno (valor negativo num gasto) devolve o dinheiro ao saldo', () => {
    const lancamentos = [lanc('l1', { bancoId: 'b1', valor: -300 })];
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(100300);
  });

  it('fatura efetiva sem banco gravado sai do banco do cartão', () => {
    const fatura = lanc('l1', { origem: 'cartao', cartaoId: 'c1', faturaMes: '2026-08', valor: 4000 });
    expect(saldoCalculadoBanco(b1, { ...base, cartoes: [cartao('c1', 'b1')], lancamentos: [fatura] })).toBe(96000);
    expect(saldoCalculadoBanco(b1, { ...base, cartoes: [cartao('c1')], lancamentos: [fatura] })).toBe(100000);
  });

  it('referência a banco inexistente conta como sem banco', () => {
    const lancamentos = [lanc('l1', { bancoId: 'fantasma' })];
    expect(saldoCalculadoBanco(b1, { ...base, lancamentos })).toBe(100000);
  });
});

describe('filtro por banco', () => {
  const b1 = banco('b1', 'box1', 'Alfa', 0, null);
  const b2 = banco('b2', 'box1', 'Beta', 1, null);
  const lancamentos = [
    lanc('no-b1', { bancoId: 'b1' }),
    lanc('no-b2', { bancoId: 'b2' }),
    lanc('sem-banco', {}),
  ];
  // c-b2 aponta para b2; c-livre não tem banco e cai no padrão da box (b1, primeiro por ordem)
  const cartoes = [cartao('c-b2', 'b2'), cartao('c-livre')];
  const comprasCartao = [compra('k-b2', 'c-b2'), compra('k-livre', 'c-livre')];
  const dados = dadosCom({ lancamentos, cartoes, comprasCartao, bancos: [b1, b2] });

  it('"todos" devolve os mesmos dados', () => {
    expect(dadosDoBanco(dados, 'todos')).toBe(dados);
  });

  it('um banco fica com os lançamentos dele e com as compras dos cartões dele', () => {
    const f = dadosDoBanco(dados, 'b2');
    expect(f.lancamentos.map((l) => l.id)).toEqual(['no-b2']);
    expect(f.comprasCartao.map((c) => c.id)).toEqual(['k-b2']);
  });

  it('cartão sem banco conta no banco padrão', () => {
    const f = dadosDoBanco(dados, 'b1');
    expect(f.lancamentos.map((l) => l.id)).toEqual(['no-b1']);
    expect(f.comprasCartao.map((c) => c.id)).toEqual(['k-livre']);
  });

  it('"sem-banco" fica só com o que não tem banco', () => {
    const f = dadosDoBanco(dados, 'sem-banco');
    expect(f.lancamentos.map((l) => l.id)).toEqual(['sem-banco']);
    expect(f.comprasCartao).toEqual([]);
  });

  it('lancamentoNoFiltro segue a mesma regra, lançamento a lançamento', () => {
    const [noB1, noB2, semBanco] = lancamentos;
    expect(lancamentoNoFiltro(noB1, 'todos', cartoes, [b1, b2])).toBe(true);
    expect(lancamentoNoFiltro(noB1, 'b1', cartoes, [b1, b2])).toBe(true);
    expect(lancamentoNoFiltro(noB2, 'b1', cartoes, [b1, b2])).toBe(false);
    expect(lancamentoNoFiltro(semBanco, 'sem-banco', cartoes, [b1, b2])).toBe(true);
    expect(lancamentoNoFiltro(noB1, 'sem-banco', cartoes, [b1, b2])).toBe(false);
  });

  it('nomeBancoDoLancamento dá o nome, ou "Sem banco"', () => {
    const d = { cartoes, bancos: [b1, b2] };
    expect(nomeBancoDoLancamento(lancamentos[0], d)).toBe('Alfa');
    expect(nomeBancoDoLancamento(lancamentos[2], d)).toBe('Sem banco');
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx vitest run src/domain/bancos.test.ts
```

Esperado: falha de compilação/importação (`bancoPadrao` não exportado).

- [ ] **Passo 3: Mudar os tipos**

Em `src/domain/types.ts`, troque o bloco do `Banco` (linhas 24-32) por:

```ts
/** Conta bancária dentro de uma box. O saldo mostrado é calculado: o último saldo informado
 *  mais os lançamentos do banco depois da data informada (`saldoCalculadoBanco`,
 *  `domain/bancos.ts`). `padrao` marca o banco pré-selecionado nos lançamentos novos; sem
 *  nenhum marcado, vale o primeiro por `ordem` (`bancoPadrao`). */
export interface Banco extends Entidade {
  boxId: ID;
  nome: string;
  ordem: number;
  saldoDeclaradoCent: number | null;
  dataSaldoDeclarado: ISODate | null;
  padrao?: boolean;
}
```

Troque a linha do `bancoId` do `Lancamento` (linha 55) por:

```ts
  bancoId?: ID;          // banco do lançamento; sem valor = "sem banco" (histórico, ou box sem bancos)
```

No `Recorrencia`, depois de `cenarioId?: ID;`, acrescente:

```ts
  bancoId?: ID; // banco dos previstos que a regra gera; sem valor = previstos sem banco
```

- [ ] **Passo 4: Implementar em `src/domain/bancos.ts`**

Troque a primeira linha (`import type { Banco, ID } from './types';`) por:

```ts
import { efeitoNoSaldo } from './money';
import type { Banco, Cartao, Categoria, Dados, ID, Lancamento } from './types';
```

Acrescente no fim do arquivo:

```ts
/** Banco pré-selecionado numa box: o marcado com `padrao` e, sem nenhuma marca, o primeiro
 *  por `ordem`. Um backup mesclado pode trazer dois marcados; vale o primeiro por `ordem`. */
export function bancoPadrao(bancos: Banco[], boxId: ID): Banco | undefined {
  const daBox = bancosDaBox(bancos, [boxId]);
  return daBox.find((b) => b.padrao === true) ?? daBox[0];
}

/** Banco de um cartão: o dele, ou o padrão da box. Vínculo que aponta para banco que não existe
 *  mais cai no padrão. Devolve `undefined` quando a box não tem bancos. */
export function bancoIdDoCartao(cartao: Cartao, bancos: Banco[]): ID | undefined {
  if (cartao.bancoId != null && bancos.some((b) => b.id === cartao.bancoId)) return cartao.bancoId;
  return bancoPadrao(bancos, cartao.boxId)?.id;
}

/** Banco de um lançamento: o gravado. Fatura de cartão sem banco gravado usa o banco do
 *  cartão — nunca o padrão, para trocar o padrão não mover o histórico. Referência a banco que
 *  não existe mais conta como "sem banco" (`undefined`). */
export function bancoIdDoLancamento(
  l: Lancamento, cartoes: Cartao[], bancos: Banco[],
): ID | undefined {
  const id = l.bancoId
    ?? (l.origem === 'cartao' ? cartoes.find((c) => c.id === l.cartaoId)?.bancoId : undefined);
  return id != null && bancos.some((b) => b.id === id) ? id : undefined;
}

export type DadosDeBanco = Pick<Dados, 'lancamentos' | 'categorias' | 'cartoes' | 'bancos'>;

/** Saldo do banco: o último saldo informado mais o efeito dos lançamentos efetivos do banco com
 *  data DEPOIS da data informada (a data do saldo é fim de dia: o que caiu nela já está no
 *  saldo). Sem saldo informado devolve `null`. Previsto, cenário e lançamento sem banco ficam
 *  de fora. */
export function saldoCalculadoBanco(banco: Banco, dados: DadosDeBanco): number | null {
  if (banco.saldoDeclaradoCent == null || banco.dataSaldoDeclarado == null) return null;
  const tipos = new Map(dados.categorias.map((c: Categoria) => [c.id, c.tipo]));
  let saldo = banco.saldoDeclaradoCent;
  for (const l of dados.lancamentos) {
    if (l.status !== 'efetivo' || l.cenarioId || l.data <= banco.dataSaldoDeclarado) continue;
    if (bancoIdDoLancamento(l, dados.cartoes, dados.bancos) !== banco.id) continue;
    saldo += efeitoNoSaldo(l.valor, tipos.get(l.categoriaId) ?? 'gasto');
  }
  return saldo;
}

/** O que o filtro por banco mostra: tudo, só o que não tem banco, ou um banco (por ID). */
export type FiltroBanco = 'todos' | 'sem-banco' | ID;

export function lancamentoNoFiltro(
  l: Lancamento, filtro: FiltroBanco, cartoes: Cartao[], bancos: Banco[],
): boolean {
  if (filtro === 'todos') return true;
  const id = bancoIdDoLancamento(l, cartoes, bancos);
  return filtro === 'sem-banco' ? id === undefined : id === filtro;
}

/** Cópia de `Dados` só com os lançamentos e as compras de cartão do filtro. Compra de cartão
 *  conta no banco do cartão (`bancoIdDoCartao`). O resto do snapshot segue igual. */
export function dadosDoBanco(dados: Dados, filtro: FiltroBanco): Dados {
  if (filtro === 'todos') return dados;
  const cartaoPorId = new Map(dados.cartoes.map((c) => [c.id, c]));
  return {
    ...dados,
    lancamentos: dados.lancamentos.filter(
      (l) => lancamentoNoFiltro(l, filtro, dados.cartoes, dados.bancos),
    ),
    comprasCartao: dados.comprasCartao.filter((c) => {
      const cartao = cartaoPorId.get(c.cartaoId);
      const id = cartao ? bancoIdDoCartao(cartao, dados.bancos) : undefined;
      return filtro === 'sem-banco' ? id === undefined : id === filtro;
    }),
  };
}

/** Nome do banco de um lançamento, ou "Sem banco". */
export function nomeBancoDoLancamento(
  l: Lancamento, dados: Pick<Dados, 'cartoes' | 'bancos'>,
): string {
  const id = bancoIdDoLancamento(l, dados.cartoes, dados.bancos);
  return dados.bancos.find((b) => b.id === id)?.nome ?? 'Sem banco';
}
```

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx vitest run src/domain/bancos.test.ts
npx tsc -b
```

Esperado: todos os testes de `bancos.test.ts` passam; `tsc` sem erro.

- [ ] **Passo 6: Commitar**

```bash
git add src/domain/types.ts src/domain/bancos.ts src/domain/bancos.test.ts
git commit -m "feat(bancos): regras de domínio do banco padrão, saldo calculado e filtro" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 2: Persistência do banco no lançamento e na recorrência

**Arquivos:**
- Modificar: `src/db/repo.ts` (`NovoLancamento` ~linha 77, `atualizarLancamento` ~93, `materializarRecorrencia` ~151, `NovaRecorrencia` ~177, `excluirBanco` ~367; nova `definirBancoPadrao` depois de `atualizarBanco`)
- Testar: `src/db/repo.test.ts`

**Interfaces:**
- Consome: nada novo de outras tarefas (tipos da Tarefa 1).
- Produz:
  - `NovoLancamento.bancoId?: ID`; `atualizarLancamento` aceita `bancoId` no patch.
  - `NovaRecorrencia.bancoId?: ID`; `materializarRecorrencia` faz os previstos herdarem e seguirem `rec.bancoId`.
  - `definirBancoPadrao(id: ID): Promise<void>`.
  - `excluirBanco` apaga o `bancoId` de lançamentos e recorrências.

- [ ] **Passo 1: Escrever os testes que falham**

Em `src/db/repo.test.ts`, logo antes de `it('confirma um pendente com valor e data corrigidos'` (fim do `describe('bancos'`), acrescente:

```ts
describe('banco no lançamento', () => {
  async function boxComDoisBancos() {
    const { box, ganho, gasto } = await boxECategoria();
    const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    return { box, ganho, gasto, um, dois };
  }

  it('salvarLancamento grava o banco e atualizarLancamento troca', async () => {
    const { box, gasto, um, dois } = await boxComDoisBancos();
    const l = await repo.salvarLancamento({
      boxId: box.id, categoriaId: gasto.id, data: '2026-08-02', valor: 4290, status: 'efetivo', bancoId: um.id,
    });
    expect((await db.lancamentos.get(l.id))?.bancoId).toBe(um.id);

    await repo.atualizarLancamento(l.id, { bancoId: dois.id });

    expect((await db.lancamentos.get(l.id))?.bancoId).toBe(dois.id);
  });

  it('recorrência: os previstos herdam o banco da regra e o seguem', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { box, gasto, um, dois } = await boxComDoisBancos();
      const rec = await repo.salvarRecorrencia({
        boxId: box.id, categoriaId: gasto.id, valor: 5000, dataInicio: '2026-08-05',
        diaDoMes: 5, parcelas: 3, bancoId: um.id,
      }, '2026-12-31');
      const previstos = () => db.lancamentos.where('recorrenciaId').equals(rec.id).toArray();

      expect((await previstos()).map((l) => l.bancoId)).toEqual([um.id, um.id, um.id]);

      await repo.salvarRecorrencia({ ...rec, bancoId: dois.id }, '2026-12-31');
      expect((await previstos()).map((l) => l.bancoId)).toEqual([dois.id, dois.id, dois.id]);

      const semBanco = { ...rec };
      delete semBanco.bancoId;
      await repo.salvarRecorrencia(semBanco, '2026-12-31');
      expect((await previstos()).map((l) => l.bancoId)).toEqual([undefined, undefined, undefined]);
    } finally { vi.useRealTimers(); }
  });

  it('definirBancoPadrao marca um banco e desmarca os outros da mesma box', async () => {
    const { um, dois } = await boxComDoisBancos();
    const agora = agoraISO();
    const outraBox: Box = {
      id: novoId(), nome: 'ju', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora,
    };
    await repo.salvarBox(outraBox);
    const alheio = await repo.salvarBanco({ boxId: outraBox.id, nome: 'Banco Alheio', ordem: 0 });
    await db.bancos.update(alheio.id, { padrao: true });

    await repo.definirBancoPadrao(dois.id);
    expect((await db.bancos.get(dois.id))?.padrao).toBe(true);
    expect((await db.bancos.get(um.id))?.padrao).toBeFalsy();
    expect((await db.bancos.get(alheio.id))?.padrao).toBe(true);

    await repo.definirBancoPadrao(um.id);
    expect((await db.bancos.get(um.id))?.padrao).toBe(true);
    expect((await db.bancos.get(dois.id))?.padrao).toBe(false);
    expect((await db.bancos.get(alheio.id))?.padrao).toBe(true);
  });

  it('definirBancoPadrao recusa banco que não existe', async () => {
    await expect(repo.definirBancoPadrao('fantasma')).rejects.toThrow('Banco não encontrado.');
  });

  it('excluirBanco apaga o bancoId de lançamentos e recorrências, e só os dele', async () => {
    const { box, gasto, um, dois } = await boxComDoisBancos();
    const noUm = await repo.salvarLancamento({
      boxId: box.id, categoriaId: gasto.id, data: '2026-08-02', valor: 1000, status: 'efetivo', bancoId: um.id,
    });
    const noDois = await repo.salvarLancamento({
      boxId: box.id, categoriaId: gasto.id, data: '2026-08-02', valor: 1000, status: 'efetivo', bancoId: dois.id,
    });
    const rec = await repo.salvarRecorrencia({
      boxId: box.id, categoriaId: gasto.id, valor: 1000, dataInicio: '2099-01-01',
      diaDoMes: 1, parcelas: 1, bancoId: um.id,
    }, '2099-12-31');

    await repo.excluirBanco(um.id);

    expect((await db.lancamentos.get(noUm.id))?.bancoId).toBeUndefined();
    expect((await db.lancamentos.get(noDois.id))?.bancoId).toBe(dois.id);
    expect((await db.recorrencias.get(rec.id))?.bancoId).toBeUndefined();
    const previsto = (await db.lancamentos.where('recorrenciaId').equals(rec.id).toArray())[0];
    expect(previsto.bancoId).toBeUndefined();
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx vitest run src/db/repo.test.ts -t "banco no lançamento"
```

Esperado: falha de tipo/execução (`bancoId` fora de `NovoLancamento`, `definirBancoPadrao` inexistente).

- [ ] **Passo 3: Implementar em `src/db/repo.ts`**

1. `NovoLancamento`: troque o corpo por

```ts
export interface NovoLancamento {
  boxId: ID; categoriaId: ID; data: ISODate; valor: number;
  nota?: string; status: StatusLancamento; cenarioId?: ID; viagemId?: ID; bancoId?: ID;
}
```

2. `atualizarLancamento`: troque a linha do tipo do patch por

```ts
  patch: Partial<Pick<Lancamento, 'valor' | 'data' | 'nota' | 'categoriaId' | 'status' | 'viagemId' | 'bancoId'>>,
```

3. `materializarRecorrencia`: no `bulkAdd`, depois da linha `...(rec.cenarioId ? { cenarioId: rec.cenarioId } : {}),` acrescente

```ts
    ...(rec.bancoId ? { bancoId: rec.bancoId } : {}),
```

E no `.modify((l) => { ... })` dos previstos remanescentes, troque o comentário e o bloco por

```ts
  // previstos remanescentes acompanham a regra atual (valor/categoria/nota/banco); efetivos são história
  await db.lancamentos.where('recorrenciaId').equals(rec.id)
    .filter((l) => l.status === 'previsto')
    .modify((l) => {
      l.valor = rec.valor;
      l.categoriaId = rec.categoriaId;
      if (rec.nota) l.nota = rec.nota;
      else delete l.nota;
      if (rec.bancoId) l.bancoId = rec.bancoId;
      else delete l.bancoId;
      l.alteradoEm = agora;
    });
```

4. `NovaRecorrencia`: troque por

```ts
export interface NovaRecorrencia {
  boxId: ID; categoriaId: ID; valor: number; dataInicio: ISODate;
  diaDoMes: number; parcelas: number | null; nota?: string; cenarioId?: ID; bancoId?: ID;
}
```

5. Depois de `atualizarBanco`, acrescente:

```ts
/** Marca o banco como padrão da box dele e desmarca os outros da mesma box, numa transação só.
 *  Sem nenhuma marca, o padrão é o primeiro por `ordem` (`bancoPadrao`, `domain/bancos.ts`). */
export async function definirBancoPadrao(id: ID): Promise<void> {
  await db.transaction('rw', db.bancos, db.config, async () => {
    const alvo = await db.bancos.get(id);
    if (!alvo) throw new Error('Banco não encontrado.');
    const agora = agoraISO();
    // `boxId` não é índice de `bancos`: `.filter()`, não `.where()`.
    const daBox = await db.bancos.filter((b) => b.boxId === alvo.boxId).toArray();
    for (const b of daBox) {
      const deveSerPadrao = b.id === id;
      if ((b.padrao === true) !== deveSerPadrao) {
        await db.bancos.update(b.id, { padrao: deveSerPadrao, alteradoEm: agora });
      }
    }
    await marcarMudanca();
  });
}
```

6. `excluirBanco`: troque a função inteira (e o comentário acima dela) por

```ts
/** Excluir um banco desliga tudo que apontava para ele: cartões, lançamentos e recorrências
 *  perdem o `bancoId` e passam a "sem banco". Referência a banco inexistente é inconsistência
 *  silenciosa — o mesmo cuidado que `converterCenarioEmReal` toma com as recorrências. */
export async function excluirBanco(id: ID): Promise<void> {
  await db.transaction('rw', db.bancos, db.cartoes, db.lancamentos, db.recorrencias, db.config, async () => {
    const agora = agoraISO();
    // `bancoId` não é índice em nenhuma dessas tabelas: `.filter()` e não `.where()` — mesmo
    // idioma de `converterCenarioEmReal`.
    await db.cartoes.filter((c) => c.bancoId === id).modify((c) => {
      delete c.bancoId;
      c.alteradoEm = agora;
    });
    await db.lancamentos.filter((l) => l.bancoId === id).modify((l) => {
      delete l.bancoId;
      l.alteradoEm = agora;
    });
    await db.recorrencias.filter((r) => r.bancoId === id).modify((r) => {
      delete r.bancoId;
      r.alteradoEm = agora;
    });
    await db.bancos.delete(id);
    await marcarMudanca();
  });
}
```

- [ ] **Passo 4: Rodar e ver passar**

```bash
npx vitest run src/db/repo.test.ts
npx tsc -b
```

Esperado: tudo verde (os testes antigos de `excluirBanco` com cartão seguem passando).

- [ ] **Passo 5: Commitar**

```bash
git add src/db/repo.ts src/db/repo.test.ts
git commit -m "feat(bancos): banco no lançamento e na recorrência, banco padrão e exclusão sem referência morta" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 3: Fatura no banco do cartão e transferência sem ajustar o saldo informado

**Arquivos:**
- Modificar: `src/db/repo.ts` (`sincronizarCartoes` ~linha 813, `transferirEntreBancos` ~878, `excluirTransferencia` ~924, import do topo)
- Modificar: `src/ui/TransferenciaSheet.tsx`
- Modificar: `src/ui/TelaHoje.tsx` (só comentários que digam "ajusta o saldo")
- Testar: `src/db/repo.test.ts`, `src/ui/TelaHoje.test.tsx`, `src/ui/TransferenciaSheet.test.tsx`

**Interfaces:**
- Consome: `bancoIdDoCartao(cartao, bancos)` (Tarefa 1).
- Produz: faturas `previstas` e novas com `bancoId`; `transferirEntreBancos` sem escrita em `bancos`.

- [ ] **Passo 1: Escrever os testes novos que falham**

Em `src/db/repo.test.ts`, depois do `describe('banco no lançamento'` (Tarefa 2), acrescente:

```ts
describe('banco da fatura do cartão', () => {
  async function cartaoComFatura(bancoDoCartao: 'um' | 'dois' | null) {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    const bancoId = bancoDoCartao === 'um' ? um.id : bancoDoCartao === 'dois' ? dois.id : undefined;
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Cartão', diaFechamento: 28, diaVencimento: 5, ...(bancoId ? { bancoId } : {}),
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-05', valorTotal: 90000, parcelas: 1,
    }, '2027-12-31');
    const fatura = (await db.lancamentos.toArray()).find((l) => l.origem === 'cartao')!;
    return { um, dois, cartao, catCartao, fatura };
  }

  it('a fatura nova sai do banco do cartão', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { dois, fatura } = await cartaoComFatura('dois');
      expect(fatura.bancoId).toBe(dois.id);
    } finally { vi.useRealTimers(); }
  });

  it('cartão sem banco usa o padrão da box e acompanha a troca do padrão', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { um, dois, fatura } = await cartaoComFatura(null);
      expect(fatura.bancoId).toBe(um.id);

      await repo.definirBancoPadrao(dois.id);
      await repo.sincronizarCartoes('2027-12-31');

      expect((await db.lancamentos.get(fatura.id))?.bancoId).toBe(dois.id);
    } finally { vi.useRealTimers(); }
  });

  it('trocar o banco do cartão move só as faturas previstas, nunca as pagas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      const { um, dois, cartao, catCartao, fatura } = await cartaoComFatura('um');
      await repo.salvarCompraCartao({
        cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-08-05', valorTotal: 10000, parcelas: 1,
      }, '2027-12-31');
      await repo.confirmarPendente(fatura.id); // a fatura de 2026-08 vira efetiva

      await repo.salvarCartao({ ...cartao, bancoId: dois.id }, '2027-12-31');

      const faturas = (await db.lancamentos.toArray()).filter((l) => l.origem === 'cartao');
      const paga = faturas.find((l) => l.faturaMes === '2026-08')!;
      const prevista = faturas.find((l) => l.faturaMes === '2026-09')!;
      expect(paga).toMatchObject({ status: 'efetivo', bancoId: um.id });
      expect(prevista).toMatchObject({ status: 'previsto', bancoId: dois.id });
    } finally { vi.useRealTimers(); }
  });
});
```

Em `src/db/repo.test.ts`, no `describe('transferirEntreBancos'`, troque o **primeiro** `it` (título e as quatro últimas linhas de `expect`) e o teste `'trata saldo não informado como zero'`:

- Título do primeiro `it`: `'cria as duas categorias ocultas e grava os dois lançamentos ligados, sem mexer no saldo informado'`.
- Apague as quatro linhas `expect((await db.bancos.get(origem.id))?.saldoDeclaradoCent).toBe(250000);` … `expect((await db.bancos.get(destino.id))?.dataSaldoDeclarado).toBe('2026-07-05');` e coloque no lugar:

```ts
    // o saldo informado não é escrito: o saldo calculado conta as duas pernas (`domain/bancos.ts`)
    expect(await db.bancos.get(origem.id)).toMatchObject({ saldoDeclaradoCent: 300000, dataSaldoDeclarado: '2026-07-01' });
    expect(await db.bancos.get(destino.id)).toMatchObject({ saldoDeclaradoCent: null, dataSaldoDeclarado: null });
```

- Troque o `it('trata saldo não informado como zero', ...)` inteiro por:

```ts
  it('não escreve saldo informado em banco que nunca foi informado', async () => {
    const { box } = await boxECategoria();
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    const b = await repo.salvarBanco({ boxId: box.id, nome: 'B', ordem: 1 });

    await repo.transferirEntreBancos(a.id, b.id, 10000, '2026-07-05');

    expect((await db.bancos.get(a.id))?.saldoDeclaradoCent).toBeNull();
    expect((await db.bancos.get(b.id))?.saldoDeclaradoCent).toBeNull();
  });
```

No `describe('excluirTransferencia'`, troque o primeiro `it` (título e as duas últimas linhas) por:

```ts
  it('apaga as duas pernas', async () => {
    const { box } = await boxECategoria();
    const a = await repo.salvarBanco({ boxId: box.id, nome: 'A', ordem: 0 });
    const b = await repo.salvarBanco({ boxId: box.id, nome: 'B', ordem: 1 });
    await repo.transferirEntreBancos(a.id, b.id, 10000, '2026-07-05');
    const perna = (await db.lancamentos.toArray()).find((l) => l.origem === 'transferencia')!;

    await repo.excluirTransferencia(perna.transferenciaId!);

    expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia')).toHaveLength(0);
    expect((await db.bancos.get(a.id))?.saldoDeclaradoCent).toBeNull();
    expect((await db.bancos.get(b.id))?.saldoDeclaradoCent).toBeNull();
  });
```

Em `src/ui/TelaHoje.test.tsx`, troque o teste `'confirmar a transferência ajusta os dois saldos e cria os dois lançamentos ligados'` inteiro por:

```tsx
  it('confirmar a transferência cria os dois lançamentos ligados e não mexe nos saldos informados', async () => {
    const box = await comBoxESaldo();
    const bancoA = await repo.salvarBanco({ boxId: box.id, nome: 'Bradesco', ordem: 0 });
    const bancoB = await repo.salvarBanco({ boxId: box.id, nome: 'Nubank', ordem: 1 });
    await repo.atualizarBanco(bancoA.id, { saldoDeclaradoCent: 300000, dataSaldoDeclarado: '2026-07-01' });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    render(<TelaHoje />);
    await abrirAba('Conferir');
    await userEvent.click(screen.getByRole('button', { name: 'Transferir de Bradesco' }));
    await userEvent.click(screen.getByLabelText('Valor'));
    await userEvent.keyboard('50000');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar transferência' }));

    await vi.waitFor(async () => {
      expect((await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia')).toHaveLength(2);
    });
    expect((await db.bancos.get(bancoA.id))?.saldoDeclaradoCent).toBe(300000);
    expect((await db.bancos.get(bancoB.id))?.saldoDeclaradoCent).toBeNull();
    const pernas = (await db.lancamentos.toArray()).filter((l) => l.origem === 'transferencia');
    expect(pernas[0].transferenciaId).toBe(pernas[1].transferenciaId);
  });
```

- [ ] **Passo 2: Rodar e ver falhar**

```bash
npx vitest run src/db/repo.test.ts -t "banco da fatura|transferirEntreBancos|excluirTransferencia"
npx vitest run src/ui/TelaHoje.test.tsx -t "transferência"
```

Esperado: as faturas sem `bancoId` e as transferências que ainda ajustam o saldo reprovam.

- [ ] **Passo 3: Implementar em `src/db/repo.ts`**

1. No import do topo, acrescente depois da linha `import { compararCategorias, ...`:

```ts
import { bancoIdDoCartao } from '../domain/bancos';
```

2. Em `sincronizarCartoes`, troque a lista de tabelas da transação e acrescente a leitura dos bancos:

```ts
  await db.transaction('rw', [
    db.cartoes, db.comprasCartao, db.recorrenciasCartao, db.conferenciasFatura, db.ajustesFechamento,
    db.lancamentos, db.notasFiscais, db.bancos,
  ], async () => {
    for (const ass of await db.recorrenciasCartao.toArray()) {
      await materializarAssinatura(ass, hoje, horizonte, {
        permitirCicloAtual: ass.id === opts?.permitirCicloAtualPara,
      });
    }
    const bancos = await db.bancos.toArray();
    for (const cartao of await db.cartoes.toArray()) {
```

Dentro do laço, depois de `const agora = agoraISO();`, acrescente:

```ts
      // A fatura sai do banco do cartão (ou do padrão da box). Só previstos e novos mudam:
      // fatura paga é história e não anda quando o cartão troca de banco.
      const bancoDaFatura = bancoIdDoCartao(cartao, bancos);
```

No `bulkAdd(diff.criar.map(...))`, troque o objeto por

```ts
      await db.lancamentos.bulkAdd(diff.criar.map((n): Lancamento => ({
        id: novoId(), boxId: cartao.boxId, categoriaId: cartao.categoriaFaturaId,
        data: n.data, valor: n.valor, status: 'previsto', origem: 'cartao',
        cartaoId: cartao.id, faturaMes: n.faturaMes,
        ...(bancoDaFatura ? { bancoId: bancoDaFatura } : {}),
        criadoEm: agora, alteradoEm: agora,
      })));
      await db.lancamentos.where('cartaoId').equals(cartao.id)
        .filter((l) => l.origem === 'cartao' && l.status === 'previsto' && l.bancoId !== bancoDaFatura)
        .modify((l) => {
          if (bancoDaFatura) l.bancoId = bancoDaFatura;
          else delete l.bancoId;
          l.alteradoEm = agora;
        });
```

3. Troque o comentário e o corpo de `transferirEntreBancos` (da linha `/** Move saldo declarado ...` até o `}` da função) por:

```ts
/** Move dinheiro de um banco para outro DA MESMA BOX, gravando dois lançamentos ligados
 *  (`transferenciaId` compartilhado) numa categoria oculta "Transferência" — um de saída
 *  (gasto) na origem, um de entrada (ganho) no destino. Não escreve no saldo informado dos
 *  bancos: o saldo calculado (`saldoCalculadoBanco`, `domain/bancos.ts`) já conta as duas
 *  pernas, que têm data posterior à do saldo informado. Ver `docs/superpowers/specs/2026-09-16-
 *  transferencia-entre-bancos-design.md` e `2026-09-30-banco-no-lancamento-design.md`. */
export async function transferirEntreBancos(
  bancoOrigemId: ID, bancoDestinoId: ID, valorCent: number, data: ISODate,
): Promise<void> {
  if (bancoOrigemId === bancoDestinoId) throw new Error('Escolha dois bancos diferentes.');
  if (valorCent <= 0) throw new Error('O valor da transferência precisa ser maior que zero.');
  const origem = await db.bancos.get(bancoOrigemId);
  const destino = await db.bancos.get(bancoDestinoId);
  if (!origem || !destino) throw new Error('Banco não encontrado.');
  if (origem.boxId !== destino.boxId) throw new Error('Transferência só entre bancos da mesma box.');

  await db.transaction('rw', db.categorias, db.boxes, db.lancamentos, db.config, async () => {
    const categoriaSaidaId = await categoriaTransferenciaSaidaDe(origem.boxId);
    const categoriaEntradaId = await categoriaTransferenciaEntradaDe(origem.boxId);
    const agora = agoraISO();
    const transferenciaId = novoId();
    const nota = `${origem.nome} → ${destino.nome}`;
    const lancamentos: Lancamento[] = [
      {
        id: novoId(), boxId: origem.boxId, categoriaId: categoriaSaidaId, data, valor: valorCent,
        nota, status: 'efetivo', origem: 'transferencia', bancoId: origem.id, transferenciaId,
        criadoEm: agora, alteradoEm: agora,
      },
      {
        id: novoId(), boxId: destino.boxId, categoriaId: categoriaEntradaId, data, valor: valorCent,
        nota, status: 'efetivo', origem: 'transferencia', bancoId: destino.id, transferenciaId,
        criadoEm: agora, alteradoEm: agora,
      },
    ];
    await db.lancamentos.bulkAdd(lancamentos);
    await marcarMudanca();
  });
}
```

4. Troque o comentário de `excluirTransferencia` por:

```ts
/** Apaga as duas pernas de uma transferência. O saldo calculado dos dois bancos volta ao que
 *  era. Uma transferência feita ANTES do banco no lançamento (v0.29 a v0.50) já tinha
 *  ajustado o `saldoDeclaradoCent` dos bancos; esse ajuste antigo não é desfeito — corrigir é
 *  manual, em Ajustes → Bancos. `transferenciaId` não é índice: `.filter()`, não `.where()`. */
```

- [ ] **Passo 4: Ajustar `TransferenciaSheet.tsx` e `TelaHoje.tsx`**

Em `src/ui/TransferenciaSheet.tsx`:

- Troque o comentário de cabeçalho (linhas 8-11) por:

```tsx
/** Sheet somente leitura com o detalhe de uma transferência entre bancos (nota já traz
 *  "banco origem → banco destino", gravada por `repo.transferirEntreBancos`). Excluir apaga
 *  as duas pernas juntas. Só em transferência feita antes do banco no lançamento o saldo
 *  informado dos bancos já tinha sido ajustado e não volta sozinho — daí o aviso. */
```

- Troque a mensagem do `window.confirm` por `'Excluir esta transferência? Os dois lançamentos serão apagados.'`.
- Troque o parágrafo `.aviso` por:

```tsx
      <p className="aviso" style={{ marginTop: 14 }}>
        Excluir apaga os dois lançamentos. Numa transferência feita antes desta versão, o saldo
        informado dos bancos já tinha sido ajustado e não volta sozinho — corrija em Ajustes → Bancos
        se precisar.
      </p>
```

Depois rode `Grep` por `ajusta o saldo|ajuste de saldo|ajustando` em `src/ui/TelaHoje.tsx` e `src/ui/ajustes/`. Em cada comentário ou texto encontrado que diga que a transferência ajusta o saldo informado, reescreva para "cria os dois lançamentos; o saldo calculado dos bancos muda por eles". Não mude texto de tela sem antes olhar o teste que o cobre.

- [ ] **Passo 5: Rodar e ver passar**

```bash
npx vitest run src/db/repo.test.ts src/ui/TelaHoje.test.tsx src/ui/TransferenciaSheet.test.tsx
npx tsc -b
```

Esperado: tudo verde. Se um teste antigo de UI reprovar por texto do aviso, atualize o teste para o texto novo.

- [ ] **Passo 6: Commitar**

```bash
git add src/db/repo.ts src/db/repo.test.ts src/ui/TransferenciaSheet.tsx src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx src/ui/TransferenciaSheet.test.tsx
git commit -m "feat(bancos): fatura sai do banco do cartão e transferência para de ajustar o saldo informado" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 4: Backup e invariantes do dossiê

**Arquivos:**
- Testar: `src/backup/backup.test.ts`
- Modificar: `src/dossie/invariantes.ts`
- Testar: `src/dossie/invariantes.test.ts`
- Regenerar: `docs/dossie/*`

`src/backup/backup.ts` **não muda**: os campos novos são opcionais e `validarBackup` só confere as tabelas. Esta tarefa prova isso com testes.

- [ ] **Passo 1: Testes de backup**

Em `src/backup/backup.test.ts`, no fim do arquivo, acrescente:

```ts
it('round-trip preserva o banco padrão, o banco do lançamento e o da recorrência', () => {
  const d = dados();
  d.bancos = [{
    id: 'bk1', boxId: 'b1', nome: 'Banco Um', ordem: 0, saldoDeclaradoCent: null,
    dataSaldoDeclarado: null, padrao: true, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];
  d.lancamentos = [{
    id: 'l1', boxId: 'b1', categoriaId: 'c1', data: '2026-08-02', valor: 1000, status: 'efetivo',
    origem: 'manual', bancoId: 'bk1', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];
  d.recorrencias = [{
    id: 'r1', boxId: 'b1', categoriaId: 'c1', valor: 1000, dataInicio: '2026-08-01', diaDoMes: 5,
    parcelas: null, ativa: true, origem: 'manual', bancoId: 'bk1', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];

  const volta = validarBackup(JSON.parse(JSON.stringify(gerarBackup(d))));

  expect(volta.dados.bancos[0].padrao).toBe(true);
  expect(volta.dados.lancamentos[0].bancoId).toBe('bk1');
  expect(volta.dados.recorrencias[0].bancoId).toBe('bk1');
});

it('backup antigo, sem os campos de banco padrão e de banco do lançamento, continua válido', () => {
  const d = dados();
  d.bancos = [{
    id: 'bk1', boxId: 'b1', nome: 'Banco Um', ordem: 0, saldoDeclaradoCent: null,
    dataSaldoDeclarado: null, criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];
  d.lancamentos = [{
    id: 'l1', boxId: 'b1', categoriaId: 'c1', data: '2026-08-02', valor: 1000, status: 'efetivo',
    origem: 'manual', criadoEm: 'x', alteradoEm: '2026-01-01T00:00:00Z',
  }];

  const volta = validarBackup(JSON.parse(JSON.stringify(gerarBackup(d))));

  expect(volta.dados.bancos[0].padrao).toBeUndefined();
  expect(volta.dados.lancamentos[0].bancoId).toBeUndefined();
});

it('mesclar: o banco padrão e o banco do lançamento seguem o registro mais recente', () => {
  const base = {
    id: 'bk1', boxId: 'b1', nome: 'Banco Um', ordem: 0, saldoDeclaradoCent: null,
    dataSaldoDeclarado: null, criadoEm: 'x',
  };
  const atual = dados();
  const backup = dados();
  atual.bancos = [{ ...base, padrao: true, alteradoEm: '2026-01-01T00:00:00Z' }];
  backup.bancos = [{ ...base, padrao: false, alteradoEm: '2026-02-01T00:00:00Z' }];
  const lancBase = {
    id: 'l1', boxId: 'b1', categoriaId: 'c1', data: '2026-08-02', valor: 1000, status: 'efetivo' as const,
    origem: 'manual' as const, criadoEm: 'x',
  };
  atual.lancamentos = [{ ...lancBase, bancoId: 'bk1', alteradoEm: '2026-03-01T00:00:00Z' }];
  backup.lancamentos = [{ ...lancBase, alteradoEm: '2026-02-01T00:00:00Z' }];

  const m = mesclar(atual, backup);

  expect(m.bancos[0].padrao).toBe(false);
  expect(m.lancamentos[0].bancoId).toBe('bk1');
});
```

- [ ] **Passo 2: Rodar os testes de backup**

```bash
npx vitest run src/backup/backup.test.ts
```

Esperado: passam sem mudar `backup.ts`. Se algum falhar, **não relaxe `validarBackup`**: investigue e avise o usuário.

- [ ] **Passo 3: Teste dos invariantes novos (falha primeiro)**

Em `src/dossie/invariantes.test.ts`, depois do teste `'detecta referência quebrada e nomeia o registro'`, acrescente:

```ts
it('lançamento que aponta para banco inexistente reprova "banco do lançamento existe"', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  retratos[0].dados.lancamentos[0].bancoId = 'banco-fantasma';
  const achado = checarTudo(retratos)
    .find((r) => r.nome === 'banco do lançamento existe' && !r.ok);
  expect(achado).toBeDefined();
  expect(achado!.classe).toBe('expectativa');
  expect(achado!.detalhe).toContain('banco-fantasma');
});

it('dois bancos padrão na mesma box reprovam "no máximo um banco padrão por box"', async () => {
  const retratos = await executarRoteiro(ROTEIRO);
  // acha um corte em que alguma box já tem dois bancos (o roteiro cria `banco azul` e
  // `banco amarelo` na box `carteira`: `src/dossie/roteiro.ts:57` e `:145`)
  const gruposDe = (bancos: { boxId: string; padrao?: boolean }[]) => {
    const porBox = new Map<string, typeof bancos>();
    for (const b of bancos) porBox.set(b.boxId, [...(porBox.get(b.boxId) ?? []), b]);
    return [...porBox.values()].find((g) => g.length >= 2);
  };
  const corte = [...retratos].reverse().find((r) => gruposDe(r.dados.bancos) !== undefined);
  expect(corte).toBeDefined();
  const grupo = gruposDe(corte!.dados.bancos)!;
  grupo[0].padrao = true;
  grupo[1].padrao = true;
  const achado = checarTudo(retratos)
    .find((r) => r.nome === 'no máximo um banco padrão por box' && !r.ok);
  expect(achado).toBeDefined();
  expect(achado!.classe).toBe('expectativa');
});
```

Se nenhum corte tiver dois bancos numa mesma box, o `expect(corte).toBeDefined()` acusa: nesse caso o roteiro mudou, e o teste precisa criar os dois bancos por conta própria.

Rode e veja falhar:

```bash
npx vitest run src/dossie/invariantes.test.ts -t "banco"
```

- [ ] **Passo 4: Implementar os invariantes**

Em `src/dossie/invariantes.ts`, logo depois do invariante `'referências resolvem'` (termina na linha 129), acrescente:

```ts
  // `excluirBanco` limpa o `bancoId` dos lançamentos. Fica como expectativa, e não como
  // garantido, porque `mesclar` de backup pode trazer um lançamento que aponta para um banco
  // que o outro lado excluiu — a leitura trata isso como "sem banco" (`bancoIdDoLancamento`).
  {
    nome: 'banco do lançamento existe',
    classe: 'expectativa',
    checar(r) {
      const bancos = new Set(r.dados.bancos.map((b) => b.id));
      const culpado = r.dados.lancamentos.find((l) => l.bancoId != null && !bancos.has(l.bancoId));
      return culpado
        ? { ok: false, detalhe: `lançamento ${culpado.id} aponta para o banco ${culpado.bancoId}, que não existe` }
        : OK;
    },
  },

  // `definirBancoPadrao` deixa um só marcado por box; um backup mesclado pode trazer dois, e
  // `bancoPadrao` então vale o primeiro por `ordem`.
  {
    nome: 'no máximo um banco padrão por box',
    classe: 'expectativa',
    checar(r) {
      const vistos = new Map<string, string>();
      for (const b of r.dados.bancos) {
        if (b.padrao !== true) continue;
        const outroId = vistos.get(b.boxId);
        if (outroId) {
          return { ok: false, detalhe: `bancos ${outroId} e ${b.id} são padrão na mesma box ${b.boxId}` };
        }
        vistos.set(b.boxId, b.id);
      }
      return OK;
    },
  },
```

- [ ] **Passo 5: Rodar e regenerar o dossiê**

```bash
npx vitest run src/dossie
```

O teste `dossie.test.ts` acusa o dossiê desatualizado (há invariantes novos). Regenere e rode de novo:

```bash
npm run dossie
npx vitest run src/dossie
git diff --stat docs/dossie
```

Esperado: `docs/dossie/01-invariantes.md` ganha as duas linhas novas; `03-telas.md` muda se a tela Lançar ainda não tem o campo (não muda nesta tarefa). Tudo verde.

- [ ] **Passo 6: Commitar**

```bash
git add src/backup/backup.test.ts src/dossie/invariantes.ts src/dossie/invariantes.test.ts docs/dossie
git commit -m "test(bancos): backup com os campos novos e invariantes do banco no dossiê" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 5: Campo Banco em Lançar, Editar lançamento e Recorrências

**Antes de editar a UI:** leia `docs/estilo-visual.md` e `docs/estilo/nivel-1-editar-tela.md`. Esta tarefa é nível 1 (sem classe nova) **mais** um componente novo pequeno, `SeletorBanco`, que só compõe `SeletorPills`. O componente novo entra no catálogo na Tarefa 8 (mesmo branch; o verificador roda no release). Se preferir o catálogo já aqui, faça o Passo 8 desta tarefa.

**Arquivos:**
- Criar: `src/ui/SeletorBanco.tsx`, `src/ui/SeletorBanco.test.tsx`
- Modificar: `src/ui/TelaLancar.tsx`, `src/ui/LancEditor.tsx`, `src/ui/ajustes/Recorrencias.tsx`
- Testar: `src/ui/TelaLancar.test.tsx`, `src/ui/LancEditor.test.tsx`, `src/ui/ajustes/Recorrencias.test.tsx`

**Interfaces:**
- Consome: `bancoPadrao`, `bancosDaBox` (Tarefa 1); `repo.salvarLancamento({ bancoId })`, `repo.atualizarLancamento(id, { bancoId })`, `repo.salvarRecorrencia({ bancoId })` (Tarefa 2).
- Produz: `SeletorBanco({ bancos: Banco[], selecionadaId: string | null, onSelecionar: (id: string) => void })`. Devolve `null` com menos de dois bancos.

- [ ] **Passo 1: Testes do `SeletorBanco`**

Crie `src/ui/SeletorBanco.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Banco } from '../domain/types';
import SeletorBanco from './SeletorBanco';

const ts = { criadoEm: '2026-08-01T12:00:00.000Z', alteradoEm: '2026-08-01T12:00:00.000Z' };
const banco = (id: string, nome: string, ordem: number): Banco => (
  { id, boxId: 'box1', nome, ordem, saldoDeclaradoCent: null, dataSaldoDeclarado: null, ...ts }
);
const BANCOS = [banco('b1', 'Banco Um', 0), banco('b2', 'Banco Dois', 1)];

it('não aparece com menos de dois bancos', () => {
  const { container } = render(
    <SeletorBanco bancos={[BANCOS[0]]} selecionadaId="b1" onSelecionar={() => {}} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('marca o banco selecionado e avisa quando a pessoa escolhe outro', async () => {
  const onSelecionar = vi.fn();
  render(<SeletorBanco bancos={BANCOS} selecionadaId="b1" onSelecionar={onSelecionar} />);

  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'false');

  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));

  expect(onSelecionar).toHaveBeenCalledWith('b2');
});

it('sem seleção, nenhuma pílula fica marcada', () => {
  render(<SeletorBanco bancos={BANCOS} selecionadaId={null} onSelecionar={() => {}} />);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'false');
});
```

- [ ] **Passo 2: Criar `src/ui/SeletorBanco.tsx`**

```tsx
import type { Banco } from '../domain/types';
import SeletorPills from './SeletorPills';

interface Props {
  bancos: Banco[];
  /** `null` = nenhum marcado (lançamento antigo, sem banco). */
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}

/** Pílulas para escolher o banco de um lançamento ou de uma recorrência. Com menos de dois
 *  bancos não há o que escolher: o campo some, e quem grava usa o único banco (ou nenhum). */
export default function SeletorBanco({ bancos, selecionadaId, onSelecionar }: Props) {
  if (bancos.length < 2) return null;
  return (
    <div className="campo">
      <label>Banco</label>
      <SeletorPills
        rotulo="Banco"
        opcoes={bancos.map((b) => ({ id: b.id, nome: b.nome }))}
        selecionadaId={selecionadaId ?? ''}
        onSelecionar={onSelecionar}
      />
    </div>
  );
}
```

Rode: `npx vitest run src/ui/SeletorBanco.test.tsx` — esperado: passa.

- [ ] **Passo 3: Testes de `TelaLancar` (falham primeiro)**

Em `src/ui/TelaLancar.test.tsx`, no fim do arquivo, acrescente:

```tsx
async function boxComDoisBancos({ padraoDois = false }: { padraoDois?: boolean } = {}) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  if (padraoDois) await repo.definirBancoPadrao(dois.id);
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
  return { box, um, dois };
}

it('com dois bancos, o banco padrão vem marcado e o lançamento sai nele', async () => {
  const { um } = await boxComDoisBancos();

  render(<TelaLancar />);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.type(screen.getByLabelText('Valor'), '42,90');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  expect((await db.lancamentos.toArray())[0].bancoId).toBe(um.id);
});

it('troca o banco no lançamento e volta ao padrão depois de lançar', async () => {
  const { dois } = await boxComDoisBancos();

  render(<TelaLancar />);
  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));
  await userEvent.type(screen.getByLabelText('Valor'), '10,00');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  expect((await db.lancamentos.toArray())[0].bancoId).toBe(dois.id);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
});

it('respeita o banco marcado como padrão em Ajustes', async () => {
  await boxComDoisBancos({ padraoDois: true });

  render(<TelaLancar />);

  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'false');
});

it('com um banco só, não mostra o campo e grava nele', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const unico = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Único', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  expect(screen.queryByRole('radio', { name: 'Banco Único' })).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Valor'), '5,00');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  expect((await db.lancamentos.toArray())[0].bancoId).toBe(unico.id);
});

it('sem bancos, o lançamento sai sem banco', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaLancar />);
  await userEvent.type(screen.getByLabelText('Valor'), '5,00');
  await userEvent.click(screen.getByRole('button', { name: 'mercado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Lançar' }));

  expect(await screen.findByText(/Lançado/)).toBeInTheDocument();
  expect((await db.lancamentos.toArray())[0].bancoId).toBeUndefined();
});
```

Rode: `npx vitest run src/ui/TelaLancar.test.tsx` — esperado: os quatro primeiros novos reprovam.

- [ ] **Passo 4: Implementar em `TelaLancar.tsx`**

1. Imports: acrescente

```tsx
import { bancoPadrao, bancosDaBox } from '../domain/bancos';
import SeletorBanco from './SeletorBanco';
```

2. Depois de `const [salvo, setSalvo] = useState(false);` acrescente:

```tsx
  // `null` = "o banco padrão da box"; só vira ID quando a pessoa escolhe outro.
  const [bancoEscolhido, setBancoEscolhido] = useState<string | null>(null);
```

3. No efeito do `rascunhoLancar`, dentro de `if (cat) {`, depois de `setPrevisto(false);` acrescente `setBancoEscolhido(null);`.

4. Depois de `const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;` acrescente:

```tsx
  useEffect(() => {
    setBancoEscolhido(null);
  }, [boxId]);
  const bancos = dados && boxId ? bancosDaBox(dados.bancos, [boxId]) : [];
  const bancoId = bancoEscolhido ?? (dados && boxId ? bancoPadrao(dados.bancos, boxId)?.id : undefined);
```

5. Em `lancar()`: no objeto de `repo.salvarLancamento`, depois de `...(viagemAtiva && viagemMarcada ? { viagemId: viagemAtiva.id } : {}),` acrescente `...(bancoId ? { bancoId } : {}),`. Na linha `setPrevisto(false); setViagemMarcada(true); setSalvo(true);` acrescente `setBancoEscolhido(null);` antes dela.

6. No JSX, logo depois de `<SeletorCategoria ... />` e antes de `<div className="linha">` (Data/Nota), acrescente:

```tsx
      <SeletorBanco bancos={bancos} selecionadaId={bancoId ?? null} onSelecionar={setBancoEscolhido} />
```

Rode: `npx vitest run src/ui/TelaLancar.test.tsx` — esperado: tudo verde.

- [ ] **Passo 5: `LancEditor` — testes e implementação**

Em `src/ui/LancEditor.test.tsx`, no fim, acrescente:

```tsx
async function editorComDoisBancos(bancoDoLancamento: 'um' | null) {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  const lanc = await repo.salvarLancamento({
    boxId: box.id, categoriaId: categoria.id, data: '2026-07-01', valor: 4290, status: 'efetivo',
    ...(bancoDoLancamento ? { bancoId: um.id } : {}),
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
  return { lanc, um, dois };
}

it('troca o banco de um lançamento e salva', async () => {
  const { lanc, dois } = await editorComDoisBancos('um');

  render(<LancEditor lanc={lanc} onFechar={() => {}} />);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(async () => {
    expect((await db.lancamentos.get(lanc.id))?.bancoId).toBe(dois.id);
  });
});

it('lançamento antigo, sem banco, abre sem pílula marcada e salvar mantém sem banco', async () => {
  const { lanc } = await editorComDoisBancos(null);

  render(<LancEditor lanc={lanc} onFechar={() => {}} />);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'false');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(async () => {
    expect((await db.lancamentos.get(lanc.id))?.alteradoEm).not.toBe(lanc.alteradoEm);
  });
  expect((await db.lancamentos.get(lanc.id))?.bancoId).toBeUndefined();
});

it('previsto de recorrência não mostra o campo Banco: quem manda é a regra', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-07-01T12:00:00'));
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const categoria = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
    const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    await repo.salvarRecorrencia(
      { boxId: box.id, categoriaId: categoria.id, valor: 5000, dataInicio: '2026-08-05', diaDoMes: 5, parcelas: 1, bancoId: um.id },
      '2026-12-31',
    );
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
    const previsto = useApp.getState().dados!.lancamentos.find((l) => l.recorrenciaId != null)!;

    render(<LancEditor lanc={previsto} onFechar={() => {}} />);

    expect(screen.queryByRole('radio', { name: 'Banco Um' })).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});
```

Rode `npx vitest run src/ui/LancEditor.test.tsx` — os dois primeiros novos reprovam.

Em `src/ui/LancEditor.tsx`:

1. Imports: acrescente `import { bancosDaBox } from '../domain/bancos';` e `import SeletorBanco from './SeletorBanco';`.
2. Depois de `const [nota, setNota] = ...` acrescente:

```tsx
  const [bancoId, setBancoId] = useState<string | null>(lanc.bancoId ?? null);
```

3. Depois de `if (!dados) return null;` acrescente `const bancos = bancosDaBox(dados.bancos, [lanc.boxId]);`.
4. Em `aplicar`, no objeto do `repo.atualizarLancamento`, depois de `valor: cents, data, categoriaId, nota: nota || undefined,` acrescente `...(bancoId && bancoId !== lanc.bancoId ? { bancoId } : {}),`.
5. Depois de `const parcelaDeRecorrenciaCenario = ...;` acrescente:

```tsx
  // Quem manda no banco de fatura, transferência, previsto de recorrência e cenário não é o
  // editor: é o cartão, a transferência, a regra e o cenário (que fica sem banco).
  const podeEscolherBanco = !doCenario && !previstoDeRecorrencia
    && lanc.origem !== 'cartao' && lanc.origem !== 'transferencia';
```

6. No JSX, dentro do ramo editável, logo depois do `<div className="campo">` da Categoria (fecha antes do da Nota), acrescente:

```tsx
            {podeEscolherBanco && (
              <SeletorBanco bancos={bancos} selecionadaId={bancoId} onSelecionar={setBancoId} />
            )}
```

Rode `npx vitest run src/ui/LancEditor.test.tsx` — tudo verde.

- [ ] **Passo 6: `Recorrencias` — testes e implementação**

Em `src/ui/ajustes/Recorrencias.test.tsx`, no fim, acrescente:

```tsx
async function boxComDoisBancosECategoria() {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'assinatura', tipo: 'gasto', ordem: 0 });
  const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
  return { box, um, dois };
}

it('nova recorrência vem com o banco padrão marcado e grava nele', async () => {
  const { um } = await boxComDoisBancosECategoria();

  render(<Recorrencias />);
  expect(screen.getByRole('radio', { name: 'Banco Um' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.type(screen.getByLabelText('Valor'), '50,00');
  await userEvent.click(screen.getByRole('button', { name: 'assinatura' }));
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(async () => {
    expect(await db.recorrencias.count()).toBe(1);
  });
  expect((await db.recorrencias.toArray())[0].bancoId).toBe(um.id);
});

it('nova recorrência grava o banco escolhido', async () => {
  const { dois } = await boxComDoisBancosECategoria();

  render(<Recorrencias />);
  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));
  await userEvent.type(screen.getByLabelText('Valor'), '50,00');
  await userEvent.click(screen.getByRole('button', { name: 'assinatura' }));
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));

  await waitFor(async () => {
    expect(await db.recorrencias.count()).toBe(1);
  });
  expect((await db.recorrencias.toArray())[0].bancoId).toBe(dois.id);
});
```

Rode `npx vitest run src/ui/ajustes/Recorrencias.test.tsx` — os dois novos reprovam.

Em `src/ui/ajustes/Recorrencias.tsx`:

1. Imports: acrescente `import { bancoPadrao, bancosDaBox } from '../../domain/bancos';` e `import SeletorBanco from '../SeletorBanco';`.
2. Nos dois `interface`s: em `CamposRecorrenciaInicial` acrescente `bancoId: string | null;`; em `CamposRecorrenciaSalvos` acrescente `bancoId?: string;`.
3. No `FormRecorrencia`, depois de `const [aviso, setAviso] = useState('');` acrescente:

```tsx
  // `null` = "o banco padrão da box"; só vira ID quando a pessoa escolhe outro.
  const [bancoEscolhido, setBancoEscolhido] = useState<string | null>(inicial.bancoId);
```

E depois de `const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;` acrescente:

```tsx
  const bancos = dados && boxId ? bancosDaBox(dados.bancos, [boxId]) : [];
  const bancoId = bancoEscolhido ?? (dados && boxId ? bancoPadrao(dados.bancos, boxId)?.id : undefined);
```

4. Em `salvar`, troque a chamada por

```tsx
    await onSalvo({
      categoriaId, valor, dataInicio, diaDoMes: diaDoMesNum, parcelas: parcelasNum,
      ...(bancoId ? { bancoId } : {}),
    });
```

5. No JSX do `FormRecorrencia`, logo depois do `<div className="campo">` da Categoria, acrescente:

```tsx
      <SeletorBanco bancos={bancos} selecionadaId={bancoId ?? null} onSelecionar={setBancoEscolhido} />
```

6. No componente `Recorrencias`: na criação, troque `inicial={{ ...ultimosCampos, valor: 0, parcelas: '' }}` por `inicial={{ ...ultimosCampos, valor: 0, parcelas: '', bancoId: null }}`; na edição, no objeto `inicial`, acrescente `bancoId: r.bancoId ?? null,` depois de `dataInicio: r.dataInicio, diaDoMes: ..., parcelas: ...,` (dentro do mesmo objeto).

Rode `npx vitest run src/ui/ajustes/Recorrencias.test.tsx` — tudo verde.

- [ ] **Passo 7: Rodar a área toda**

```bash
npx vitest run src/ui/TelaLancar.test.tsx src/ui/LancEditor.test.tsx src/ui/ajustes/Recorrencias.test.tsx src/ui/SeletorBanco.test.tsx src/ui/AdicionarSheet.test.tsx
npx tsc -b
```

Esperado: verde e sem erro de tipo.

- [ ] **Passo 8: Catalogar o componente e commitar**

Em `docs/estilo/catalogo.md`, na lista "Componentes compartilhados", logo depois do item `**SeletorPills.tsx**` (termina em "...reforçando a sensação de "perfil" (ver `docs/superpowers/specs/`).") acrescente:

```markdown
- **`SeletorBanco.tsx`** — pílulas (`SeletorPills`) para escolher o banco de um lançamento ou de
  uma recorrência. Props `bancos`, `selecionadaId` (`null` = nenhum marcado, lançamento antigo sem
  banco) e `onSelecionar`. Devolve `null` com menos de dois bancos: o campo some. O banco padrão
  vem marcado por quem usa (`bancoPadrao`, `domain/bancos.ts`). Usado em `TelaLancar.tsx`,
  `LancEditor.tsx` e `ajustes/Recorrencias.tsx`.
```

```bash
git add src/ui/SeletorBanco.tsx src/ui/SeletorBanco.test.tsx src/ui/TelaLancar.tsx src/ui/TelaLancar.test.tsx src/ui/LancEditor.tsx src/ui/LancEditor.test.tsx src/ui/ajustes/Recorrencias.tsx src/ui/ajustes/Recorrencias.test.tsx docs/estilo/catalogo.md
git commit -m "feat(bancos): campo Banco em Lançar, Editar lançamento e Recorrências, com o padrão pré-selecionado" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 6: Ajustes → Bancos (selo padrão, "Tornar padrão", saldo calculado)

**Arquivos:**
- Modificar: `src/ui/ajustes/Bancos.tsx`
- Testar: `src/ui/ajustes/Bancos.test.tsx`

**Interfaces:**
- Consome: `bancoPadrao`, `saldoCalculadoBanco` (Tarefa 1); `repo.definirBancoPadrao` (Tarefa 2).
- Produz: nada que outra tarefa use.

- [ ] **Passo 1: Testes que falham**

Em `src/ui/ajustes/Bancos.test.tsx`, no fim do arquivo, acrescente:

```tsx
it('com dois bancos, o primeiro leva o selo padrão e só o outro oferece "Tornar padrão"', async () => {
  const box = await comBox();
  await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  await recarregarDados();

  render(<Bancos />);

  expect(await screen.findAllByText('padrão')).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Tornar padrão' })).toHaveLength(1);
});

it('"Tornar padrão" passa o selo para o outro banco', async () => {
  const box = await comBox();
  await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  await recarregarDados();

  render(<Bancos />);
  await userEvent.click(await screen.findByRole('button', { name: 'Tornar padrão' }));

  await waitFor(async () => {
    expect((await db.bancos.get(dois.id))?.padrao).toBe(true);
  });
  const itemDois = screen.getByText('Banco Dois').closest('.item') as HTMLElement;
  await waitFor(() => {
    expect(within(itemDois).getByText('padrão')).toBeInTheDocument();
  });
  expect(screen.getAllByText('padrão')).toHaveLength(1);
});

it('com um banco só, não mostra o selo nem o botão', async () => {
  const box = await comBox();
  await repo.salvarBanco({ boxId: box.id, nome: 'Banco Único', ordem: 0 });
  await recarregarDados();

  render(<Bancos />);

  expect(await screen.findByText('Banco Único')).toBeInTheDocument();
  expect(screen.queryByText('padrão')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tornar padrão' })).not.toBeInTheDocument();
});

it('mostra o saldo calculado: o informado mais o movimento depois da data informada', async () => {
  const box = await comBox();
  const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  await repo.atualizarBanco(banco.id, { saldoDeclaradoCent: 100000, dataSaldoDeclarado: '2026-08-01' });
  const gasto = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: gasto.id, data: '2026-08-03', valor: 2000, status: 'efetivo', bancoId: banco.id,
  });
  await recarregarDados();

  render(<Bancos />);

  // 100000 - 2000 = 98000
  expect(await screen.findByText(formatarSaldo(98000))).toBeInTheDocument();
  expect(screen.queryByText(formatarSaldo(100000))).not.toBeInTheDocument();
});
```

Rode `npx vitest run src/ui/ajustes/Bancos.test.tsx` — os quatro novos reprovam.

- [ ] **Passo 2: Implementar em `Bancos.tsx`**

1. Imports: troque `import { bancosDaBox } from '../../domain/bancos';` por

```tsx
import { bancoPadrao, bancosDaBox, saldoCalculadoBanco } from '../../domain/bancos';
```

2. Depois de `excluir(id)` acrescente:

```tsx
  async function tornarPadrao(id: string) {
    await repo.definirBancoPadrao(id);
    await recarregar();
  }
```

3. No `.map((b) => {` da lista, logo depois de `const emEdicao = editandoId === b.id;` acrescente:

```tsx
          const bancosDaMesmaBox = bancos.filter((x) => x.boxId === b.boxId);
          // O selo só faz sentido quando há de onde escolher: com um banco só, ele é óbvio.
          const temPadrao = bancosDaMesmaBox.length >= 2;
          const ehPadrao = temPadrao && bancoPadrao(dados.bancos, b.boxId)?.id === b.id;
          const saldo = saldoCalculadoBanco(b, dados);
```

4. Troque a abertura do item por `<div className="item item-coluna" key={b.id}>` (sem o condicional `emEdicao`).

5. Troque **todo o ramo de visualização** (o `<> ... </>` depois de `) : (`, que hoje tem `.cresce` + Editar + Excluir) por:

```tsx
                <>
                  <div className="linha-topo">
                    <div className="cresce">
                      {b.nome}
                      {ehPadrao && <span className="badge" style={{ marginLeft: 6 }}>padrão</span>}
                      <div className="sub">
                        {saldo != null ? (
                          <>
                            <span className={classeSaldo(saldo)}>{formatarSaldo(saldo)}</span>
                            {` informado em ${formatarDataBR(b.dataSaldoDeclarado!)}`}
                          </>
                        ) : 'saldo ainda não informado'}
                        {' · '}{textoContagemCartoes(cartoesDoBanco(b.id))}
                      </div>
                    </div>
                    <button className="botao" aria-label="Editar" onClick={() => editar(b.id)}><Pencil size={16} /></button>
                  </div>
                  <div className="acoes">
                    {temPadrao && !ehPadrao && (
                      <button className="botao" onClick={() => tornarPadrao(b.id)}>Tornar padrão</button>
                    )}
                    <button className="botao botao-perigo" onClick={() => excluir(b.id)}>Excluir</button>
                  </div>
                </>
```

6. Depois do `</div>` que fecha `<div className="lista">` (antes do `</div>` final da tela), acrescente:

```tsx
      {bancos.length > 0 && (
        <p className="sub">
          O saldo mostrado é o último saldo informado mais os lançamentos do banco depois dessa data.
          Informar de novo, na tela Hoje, recomeça a conta. Lançamento sem banco não entra na conta
          de nenhum banco.
        </p>
      )}
```

- [ ] **Passo 3: Rodar e ver passar**

```bash
npx vitest run src/ui/ajustes/Bancos.test.tsx
npx tsc -b
```

Esperado: tudo verde. Se um teste antigo procurar o botão "Excluir" ou o texto do saldo e reprovar, o motivo é a mudança de estrutura (item em coluna): ajuste só a **consulta** do teste, nunca o comportamento.

- [ ] **Passo 4: Commitar**

```bash
git add src/ui/ajustes/Bancos.tsx src/ui/ajustes/Bancos.test.tsx
git commit -m "feat(bancos): banco padrão e saldo calculado em Ajustes → Bancos" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 7: Filtro por banco no Fluxo e nas Análises

**Arquivos:**
- Criar: `src/ui/SeletorFiltroBanco.tsx`, `src/ui/SeletorFiltroBanco.test.tsx`
- Modificar: `src/ui/TelaFluxo.tsx`, `src/ui/TelaAnalises.tsx`
- Testar: `src/ui/TelaFluxo.test.tsx`, `src/ui/TelaAnalises.test.tsx`

**Interfaces:**
- Consome: `FiltroBanco`, `bancosDaBox`, `lancamentoNoFiltro`, `nomeBancoDoLancamento`, `dadosDoBanco` (Tarefa 1).
- Produz: `SeletorFiltroBanco({ bancos: Banco[], valor: FiltroBanco, onMudar: (v: FiltroBanco) => void })`. Devolve `null` com menos de dois bancos.

- [ ] **Passo 1: `SeletorFiltroBanco` — teste e componente**

Crie `src/ui/SeletorFiltroBanco.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Banco } from '../domain/types';
import SeletorFiltroBanco from './SeletorFiltroBanco';

const ts = { criadoEm: '2026-08-01T12:00:00.000Z', alteradoEm: '2026-08-01T12:00:00.000Z' };
const banco = (id: string, nome: string, ordem: number): Banco => (
  { id, boxId: 'box1', nome, ordem, saldoDeclaradoCent: null, dataSaldoDeclarado: null, ...ts }
);
const BANCOS = [banco('b1', 'Banco Um', 0), banco('b2', 'Banco Dois', 1)];

it('não aparece com menos de dois bancos', () => {
  const { container } = render(
    <SeletorFiltroBanco bancos={[BANCOS[0]]} valor="todos" onMudar={() => {}} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('oferece Todos, cada banco e Sem banco, e marca o valor atual', () => {
  render(<SeletorFiltroBanco bancos={BANCOS} valor="b2" onMudar={() => {}} />);

  expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(
    ['Todos', 'Banco Um', 'Banco Dois', 'Sem banco'],
  );
  expect(screen.getByRole('radio', { name: 'Banco Dois' })).toHaveAttribute('aria-checked', 'true');
});

it('avisa o filtro escolhido: "todos", "sem-banco" ou o ID do banco', async () => {
  const onMudar = vi.fn();
  render(<SeletorFiltroBanco bancos={BANCOS} valor="todos" onMudar={onMudar} />);

  await userEvent.click(screen.getByRole('radio', { name: 'Banco Um' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Sem banco' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));

  expect(onMudar.mock.calls.map((c) => c[0])).toEqual(['b1', 'sem-banco', 'todos']);
});
```

Crie `src/ui/SeletorFiltroBanco.tsx`:

```tsx
import type { FiltroBanco } from '../domain/bancos';
import type { Banco } from '../domain/types';
import SeletorPills from './SeletorPills';

interface Props {
  bancos: Banco[];
  valor: FiltroBanco;
  onMudar: (valor: FiltroBanco) => void;
}

/** Pílulas do filtro por banco (Fluxo e Análises): Todos, cada banco e "Sem banco". Com menos
 *  de dois bancos não há o que filtrar: o filtro some. */
export default function SeletorFiltroBanco({ bancos, valor, onMudar }: Props) {
  if (bancos.length < 2) return null;
  return (
    <div className="campo">
      <label>Banco</label>
      <SeletorPills
        rotulo="Filtrar por banco"
        opcoes={[
          { id: 'todos', nome: 'Todos' },
          ...bancos.map((b) => ({ id: b.id, nome: b.nome })),
          { id: 'sem-banco', nome: 'Sem banco' },
        ]}
        selecionadaId={valor}
        onSelecionar={(id) => onMudar(id)}
      />
    </div>
  );
}
```

Rode `npx vitest run src/ui/SeletorFiltroBanco.test.tsx` — passa.

- [ ] **Passo 2: Testes do Fluxo (falham primeiro)**

Em `src/ui/TelaFluxo.test.tsx`, no fim, acrescente:

```tsx
async function seedDoisBancosComLancamentos() {
  const { box, catMercado } = await seedBoxComCategoria();
  const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  const hoje = '2026-07-05';
  const base = { boxId: box.id, categoriaId: catMercado.id, data: hoje, status: 'efetivo' as const };
  await repo.salvarLancamento({ ...base, valor: 4290, nota: 'compra do um', bancoId: um.id });
  await repo.salvarLancamento({ ...base, valor: 1800, nota: 'compra do dois', bancoId: dois.id });
  await repo.salvarLancamento({ ...base, valor: 950, nota: 'compra sem banco' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje });
  return { box, um, dois };
}

it('mostra o banco de cada lançamento e filtra a lista por banco', async () => {
  await seedDoisBancosComLancamentos();

  render(<TelaFluxo />);
  expect(await screen.findByText('compra do um')).toBeInTheDocument();
  expect(screen.getByText('compra do dois')).toBeInTheDocument();
  expect(screen.getByText('compra sem banco')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));
  expect(screen.getByText('compra do dois')).toBeInTheDocument();
  expect(screen.queryByText('compra do um')).not.toBeInTheDocument();
  expect(screen.queryByText('compra sem banco')).not.toBeInTheDocument();
  expect(screen.getByText(/o saldo de cada dia continua sendo o da box inteira/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('radio', { name: 'Sem banco' }));
  expect(screen.getByText('compra sem banco')).toBeInTheDocument();
  expect(screen.queryByText('compra do dois')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));
  expect(screen.getByText('compra do um')).toBeInTheDocument();
  expect(screen.queryByText(/o saldo de cada dia continua sendo o da box inteira/)).not.toBeInTheDocument();
});

it('com um banco só, não mostra o filtro nem o banco em cada lançamento', async () => {
  const { box, catMercado } = await seedBoxComCategoria();
  const unico = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Único', ordem: 0 });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: catMercado.id, data: '2026-07-05', valor: 4290, status: 'efetivo',
    nota: 'compra do único', bancoId: unico.id,
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-05' });

  render(<TelaFluxo />);

  expect(await screen.findByText('compra do único')).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Todos' })).not.toBeInTheDocument();
  expect(screen.queryByText('Banco Único')).not.toBeInTheDocument();
});
```

Rode `npx vitest run src/ui/TelaFluxo.test.tsx -t "banco"` — reprovam.

- [ ] **Passo 3: Implementar no Fluxo**

Em `src/ui/TelaFluxo.tsx`:

1. Imports: acrescente

```tsx
import { bancosDaBox, lancamentoNoFiltro, nomeBancoDoLancamento, type FiltroBanco } from '../domain/bancos';
```

e, junto dos outros componentes, `import SeletorFiltroBanco from './SeletorFiltroBanco';`.

2. Depois de `const [filtrosAbertos, setFiltrosAbertos] = useState(false);` acrescente:

```tsx
  const [filtroBanco, setFiltroBanco] = useState<FiltroBanco>('todos');
```

e, logo depois do `useEffect` de `fluxoAba`:

```tsx
  useEffect(() => {
    setFiltroBanco('todos');
  }, [boxSel]);
```

3. Depois de `const inicioLista = addDias(hoje, -diasAtras);` acrescente `const bancosSel = bancosDaBox(dados.bancos, ids);`.

4. No laço `for (const l of dados.lancamentos) {`, depois de `if (!ids.includes(l.boxId)) continue;` acrescente:

```tsx
    if (!lancamentoNoFiltro(l, filtroBanco, dados.cartoes, dados.bancos)) continue;
```

5. No JSX da aba Lista, logo depois do `<>` que abre `{abaFluxo === 'lista' && (`, antes do `<div className="linha" style={{ justifyContent: 'space-between' }}>`, acrescente:

```tsx
          <SeletorFiltroBanco bancos={bancosSel} valor={filtroBanco} onMudar={setFiltroBanco} />
          {filtroBanco !== 'todos' && (
            <p className="sub">O filtro vale só para a lista: o saldo de cada dia continua sendo o da box inteira.</p>
          )}
```

6. No item do lançamento, depois de `{l.nota && <div className="sub">{l.nota}</div>}` acrescente:

```tsx
                        {bancosSel.length >= 2 && <div className="sub">{nomeBancoDoLancamento(l, dados)}</div>}
```

Rode `npx vitest run src/ui/TelaFluxo.test.tsx` — verde (inclusive os testes antigos, com dois bancos, que agora mostram a linha do banco).

- [ ] **Passo 4: Teste e implementação nas Análises**

Em `src/ui/TelaAnalises.test.tsx`, no fim, acrescente (abra o começo do arquivo antes e reaproveite os imports que ele já tem: `render`, `screen`, `userEvent`, `repo`, `useApp`, `agoraISO`, `novoId`, `limparDb`; acrescente os que faltarem):

```tsx
it('com dois bancos, o filtro por banco restringe as categorias do resumo', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const mercado = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const lazer = await repo.salvarCategoria({ boxId: box.id, nome: 'lazer', tipo: 'gasto', ordem: 1 });
  const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: mercado.id, data: '2026-07-10', valor: 4290, status: 'efetivo', bancoId: um.id,
  });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: lazer.id, data: '2026-07-11', valor: 1800, status: 'efetivo', bancoId: dois.id,
  });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-15' });

  render(<TelaAnalises />);
  expect((await screen.findAllByText('mercado')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('lazer').length).toBeGreaterThan(0);

  await userEvent.click(screen.getByRole('radio', { name: 'Banco Dois' }));

  await waitFor(() => {
    expect(screen.queryByText('mercado')).not.toBeInTheDocument();
  });
  expect(screen.getAllByText('lazer').length).toBeGreaterThan(0);
});
```

Se `waitFor` ou `TelaAnalises` não estiverem importados no arquivo, importe (`import { render, screen, waitFor } from '@testing-library/react';`).

Rode `npx vitest run src/ui/TelaAnalises.test.tsx -t "filtro por banco"` — reprova.

Em `src/ui/TelaAnalises.tsx`:

1. Import do React: `import { Suspense, lazy, useEffect, useState } from 'react';`.
2. Acrescente:

```tsx
import { bancosDaBox, dadosDoBanco, type FiltroBanco } from '../domain/bancos';
```

e `import SeletorFiltroBanco from './SeletorFiltroBanco';`.

3. Troque `const { dados, boxSel, hoje, setAba } = useApp();` por `const { dados: dadosTodos, boxSel, hoje, setAba } = useApp();`.
4. Depois de `const [categoriaCartaoAberta, setCategoriaCartaoAberta] = ...;` acrescente:

```tsx
  const [filtroBanco, setFiltroBanco] = useState<FiltroBanco>('todos');
  useEffect(() => {
    setFiltroBanco('todos');
  }, [boxSel]);
```

5. Troque `if (!dados) return null;` por:

```tsx
  if (!dadosTodos) return null;
  // Todo o resto da tela lê `dados`: com o filtro ligado, ele já vem só com os lançamentos e as
  // compras de cartão do banco escolhido (`dadosDoBanco`).
  const dados = dadosDoBanco(dadosTodos, filtroBanco);
```

6. Depois de `const ids = boxIdsSelecionadas(dados, boxSel);` acrescente `const bancosSel = bancosDaBox(dadosTodos.bancos, ids);`.
7. No JSX, logo depois do `<label className="linha">` de "incluir previstos" (fecha em `</label>`), acrescente:

```tsx
      <SeletorFiltroBanco bancos={bancosSel} valor={filtroBanco} onMudar={setFiltroBanco} />
```

Rode `npx vitest run src/ui/TelaAnalises.test.tsx` — verde.

- [ ] **Passo 5: Catalogar e commitar**

Em `docs/estilo/catalogo.md`, logo depois do item `**SeletorBanco.tsx**` (Tarefa 5) acrescente:

```markdown
- **`SeletorFiltroBanco.tsx`** — filtro por banco: pílulas (`SeletorPills`) "Todos", cada banco da
  box e "Sem banco". Props `bancos`, `valor` (`FiltroBanco`, de `domain/bancos.ts`) e `onMudar`.
  Devolve `null` com menos de dois bancos. Usado no `TelaFluxo.tsx` (só a lista; o saldo do dia
  segue o da box inteira) e no `TelaAnalises.tsx` (filtra os agregados por `dadosDoBanco`).
```

```bash
git add src/ui/SeletorFiltroBanco.tsx src/ui/SeletorFiltroBanco.test.tsx src/ui/TelaFluxo.tsx src/ui/TelaFluxo.test.tsx src/ui/TelaAnalises.tsx src/ui/TelaAnalises.test.tsx docs/estilo/catalogo.md
git commit -m "feat(bancos): filtro por banco no Fluxo e nas Análises, e o banco em cada item do Fluxo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 8: Docs, wiki, dossiê e changelog

**Arquivos:**
- Modificar: `docs/dominio.md`, `docs/wiki/6-telas.md`, `docs/wiki/7-ajustes.md`, `docs/wiki/8-glossario.md`, `docs/estilo/catalogo.md` (entrada do `LancEditor`)
- Criar: `changelog.d/adicionado-banco-no-lancamento.md`
- Regenerar: `docs/dossie/*`

- [ ] **Passo 1: `docs/dominio.md`**

Troque o item **Banco** (linhas 27-39, do `- **Banco** —` até `inexistente.`) por:

```markdown
- **Banco** — conta bancária **dentro** de uma box, com `nome`, `ordem`, `padrao` (opcional) e o
  par `saldoDeclaradoCent`/`dataSaldoDeclarado`. Existe porque a box modela a *pessoa*, e uma
  pessoa costuma ter várias contas. **O saldo mostrado é calculado**: `saldoCalculadoBanco`
  (`src/domain/bancos.ts`) soma ao último saldo informado o efeito dos lançamentos efetivos do
  banco com data **depois** da data informada. Lançamento com `bancoId` de banco inexistente, e
  lançamento sem banco (histórico, ou box sem bancos), não entram na conta de nenhum banco.
  `Lancamento.bancoId` vale para todo lançamento: manual (`TelaLancar`, `LancEditor`), previsto
  de recorrência (herda `Recorrencia.bancoId`), fatura de cartão e as duas pernas de uma
  transferência. Na leitura, uma fatura sem `bancoId` gravado usa o banco do **cartão**
  (`bancoIdDoLancamento`), nunca o padrão. Um `Cartao` aponta para um banco (`bancoId`,
  opcional e sem índice); `sincronizarCartoes` (`src/db/repo.ts`) grava o banco do cartão (ou o
  padrão da box) nas faturas novas e previstas, e nunca nas já pagas.
  **O banco padrão** (`bancoPadrao`) é o marcado com `padrao`; sem marca, o primeiro por
  `ordem`. `definirBancoPadrao` (`src/db/repo.ts`) deixa um só marcado por box, mas um backup
  mesclado pode trazer dois — nesse caso vale o primeiro por `ordem` (**expectativa não
  garantida**, checada no dossiê). Excluir o banco (`excluirBanco`) apaga o `bancoId` dos
  cartões, lançamentos e recorrências que apontavam para ele.
  `transferirEntreBancos` grava as duas pernas com `bancoId` e **não escreve** no saldo
  informado: o saldo calculado dos dois bancos muda pelas pernas. Uma transferência antiga já
  tinha ajustado o saldo informado e gravado `dataSaldoDeclarado` igual à data dela; como só
  contam lançamentos de data posterior, as pernas antigas não contam duas vezes.
```

No mesmo arquivo, procure `Lancamento.bancoId` de uso geral e a frase "entrega 2, ainda aberta" (`Grep` por `entrega 2`): se sobrar alguma, apague a frase. Rode `Grep` por `informado pelo usuário, não|saldoDeclaradoCent` em `docs/dominio.md` e confira cada ocorrência contra o texto novo.

- [ ] **Passo 2: Wiki**

`docs/wiki/6-telas.md`:

- Na seção Lançar, depois do item `- Data padrão hoje; nota opcional; caixa "marcar como previsto".` acrescente:
  `- Com dois ou mais bancos na box, aparece o campo **Banco**, já marcado no banco padrão. Toque em outro para trocar; depois de lançar, ele volta ao padrão.`
- Na mesma seção, troque a última linha por:
  `**Obrigatórios:** valor, categoria. **Têm padrão:** data (hoje) e banco (o padrão da box, quando ela tem dois ou mais bancos). **Opcionais:** nota, marcar como previsto.`
- Na seção Fluxo, depois do item `- **Lista** mostra ...` (o primeiro bullet), acrescente:
  `- Com dois ou mais bancos na box, a Lista mostra o banco sob cada lançamento e um filtro por banco (Todos, cada banco ou Sem banco). O filtro vale só para a lista: o saldo de cada dia continua sendo o da box inteira.`
- No item do Editor de lançamento (`**Editor de lançamento — obrigatórios:** valor, data, categoria. **Opcional:** nota.`), troque o fim por `**Opcionais:** nota e banco (com dois ou mais bancos na box).`
- Na seção Análises, depois da lista das quatro opções do topo (último bullet `**Período:** ...`), acrescente uma linha em branco e:
  `Com dois ou mais bancos na box, um filtro por banco (Todos, cada banco ou Sem banco) restringe o resumo e os comparativos aos lançamentos, e às compras de cartão, desse banco.`
- Na seção Hoje, troque as duas frases "Confirmar ajusta o saldo dos dois na hora e aparece como um lançamento de saída e outro de entrada na aba Fluxo — ... Excluir a transferência (pelo Fluxo) apaga os dois lançamentos, mas não desfaz o ajuste de saldo nos bancos." por:
  `Confirmar cria um lançamento de saída no banco de origem e um de entrada no destino, visíveis na aba Fluxo — sem contar como ganho ou gasto real em Análises, já que é só redistribuição do seu próprio dinheiro. O saldo calculado dos dois bancos, em Ajustes → Bancos, muda por eles. Excluir a transferência (pelo Fluxo) apaga os dois lançamentos. Numa transferência feita antes desta versão, o saldo informado dos bancos já tinha sido ajustado e não volta sozinho: corrija em Ajustes → Bancos.`

`docs/wiki/7-ajustes.md`:

- Seção Bancos: troque o bloco `> Nesta versão o saldo do banco é **informado por você, não calculado**. ...` por:
  `> O saldo de cada banco é o último saldo **informado por você** mais os lançamentos efetivos desse banco depois da data informada. Informar de novo, na tela Hoje, recomeça a conta. Lançamento sem banco não entra na conta de nenhum banco.`
- Troque o parágrafo `Cada banco mostra o saldo informado com a data e quantos cartões ...` por:
  `Cada banco mostra o saldo, a data em que você o informou e quantos cartões estão vinculados a ele. Com dois ou mais bancos na box, um deles é o **padrão**: aparece com o selo "padrão" e vem marcado em todo lançamento novo. Toque em "Tornar padrão" para trocar. Excluir um banco desliga o vínculo dos cartões, dos lançamentos e das recorrências que apontavam para ele — nada é apagado.`
- Seção Recorrências: acrescente ao fim do primeiro parágrafo de campos (ache o parágrafo com "**Obrigatórios:**" da seção) a frase `Com dois ou mais bancos na box, a recorrência também escolhe o banco (padrão: o banco padrão da box); os previstos saem dele.` Se a seção não tiver esse parágrafo, acrescente a frase como bullet no fim dela.
- Seção Cartões: depois da frase "Configure nome, dia de fechamento, dia de vencimento e, se a box tiver bancos cadastrados, o banco dono do cartão.", acrescente `A fatura do cartão sai desse banco; sem banco no cartão, sai do banco padrão da box.`

`docs/wiki/8-glossario.md`:

- Troque a linha do `banco` por:
  `: banco | Conta bancária dentro de uma box. Você informa o saldo de vez em quando; o Flow soma os lançamentos do banco depois dessa data. Um dos bancos da box é o padrão, marcado em todo lançamento novo.`
- Troque a linha da `transferência entre bancos` por:
  `: transferência entre bancos | Mover dinheiro de um banco para outro da mesma box (Hoje → Conferir). Cria um lançamento de saída e um de entrada, visíveis no Fluxo mas fora dos totais de Análises — não é ganho nem gasto real. O saldo calculado dos dois bancos muda na hora.`

`docs/estilo/catalogo.md`: no item `**LancEditor.tsx**`, troque "(valor, data, categoria, nota, sinal ganho/gasto)" por "(valor, data, categoria, banco, nota, sinal ganho/gasto)" e acrescente ao fim "; o campo Banco (`SeletorBanco`) não aparece para fatura, transferência, previsto de recorrência nem cenário."

- [ ] **Passo 3: Fragmento de changelog**

Crie `changelog.d/adicionado-banco-no-lancamento.md` (UTF-8 sem BOM, sem negrito, detalhe com exatamente 2 espaços):

```markdown
- Cada lançamento agora pode ficar num banco.
  - Em Lançar e em Editar lançamento, o campo Banco vem marcado no banco padrão da box, e você troca em cada lançamento.
  - As recorrências também escolhem o banco, e a fatura de cada cartão sai do banco do cartão.
  - Em Ajustes, Bancos, você escolhe o banco padrão, e o saldo de cada banco passa a somar os lançamentos feitos depois do saldo informado.
  - No Fluxo e nas Análises, um filtro mostra só os lançamentos de um banco, ou os que não têm banco.
- A transferência entre bancos deixa de mexer no saldo informado: o saldo de cada banco muda pelos dois lançamentos da transferência.
```

- [ ] **Passo 4: Validar docs**

```bash
npx vitest run src/ui/ajustes/capitulos.test.ts
node scripts/verificar-catalogo.mjs --strict
node scripts/verificar-dados-reais.mjs --strict
npm run dossie
npx vitest run src/dossie
```

Esperado: `capitulos.test.ts` passa (a wiki só usa o subconjunto fechado de markdown); os dois verificadores saem com código 0; o dossiê regenera sem erro. Se `capitulos.test.ts` lançar exceção, o markdown novo saiu do subconjunto: corrija a linha apontada.

- [ ] **Passo 5: Commitar**

```bash
git add docs changelog.d
git commit -m "docs(bancos): modelo, wiki, catálogo, dossiê e changelog do banco no lançamento" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01A2Tk5f8CChgvK234VPC1F2"
```

---

### Tarefa 9: Verificação completa e varredura com Playwright

**Arquivos:** nenhum no repositório. O Playwright roda na pasta de rascunho da sessão e **nunca** entra no `package.json`.

- [ ] **Passo 1: Suíte e build completos**

```bash
npm test
npm run build
```

Esperado: `npm test` todo verde; `npm run build` sem erro de tipo. Cole a linha final de cada um no relato.

- [ ] **Passo 2: Varredura como usuário**

Siga `reference_varredura_playwright.md` (memória) e a seção "Teste como usuário (Playwright)" do `CLAUDE.md`:

1. Na pasta de rascunho da sessão: `npm init -y`, `npm i playwright`, `npx playwright install chromium`.
2. No worktree, suba `npx vite --port 5198 --host localhost` em segundo plano. Guarde o PID do processo que ocupa a porta.
3. Script `varredura-bancos.mjs`, com o contexto do Galaxy S25+ (`viewport: { width: 411, height: 744 }`, `screen: { width: 412, height: 892 }`, `deviceScaleFactor: 2.63`, `isMobile: true`, `hasTouch: true`, `locale: 'pt-BR'`). Semeie dados **sintéticos** dentro de `page.evaluate`:

```js
await page.goto('http://localhost:5198/');
await page.evaluate(async () => {
  const repo = await import('/src/db/repo.ts');
  const { novoId, agoraISO } = await import('/src/domain/types.ts');
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const mercado = await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await repo.salvarCategoria({ boxId: box.id, nome: 'salário', tipo: 'ganho', ordem: 1 });
  const um = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
  const dois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
  await repo.atualizarBanco(um.id, { saldoDeclaradoCent: 125000, dataSaldoDeclarado: '2026-09-28' });
  const hoje = new Date().toISOString().slice(0, 10);
  await repo.salvarLancamento({ boxId: box.id, categoriaId: mercado.id, data: hoje, valor: 4290, status: 'efetivo', bancoId: um.id, nota: 'compra do um' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: mercado.id, data: hoje, valor: 1800, status: 'efetivo', bancoId: dois.id, nota: 'compra do dois' });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: mercado.id, data: hoje, valor: 950, status: 'efetivo', nota: 'compra sem banco' });
});
await page.reload();
```

4. Percorra e tire uma captura de cada passo (`page.screenshot({ path, fullPage: true })`):
   - **Lançar** (botão +, passo de lançamento manual): o Banco Um vem marcado; escolha Banco Dois; lance; confirme que o lançamento aparece no Fluxo com "Banco Dois".
   - **Editar lançamento:** toque em "compra sem banco" no Fluxo; as pílulas abrem sem marca; escolha uma; salve.
   - **Ajustes → Bancos:** selo "padrão" no Banco Um; "Tornar padrão" no Banco Dois; toque e veja o selo passar; o saldo do Banco Um mostra o valor calculado.
   - **Ajustes → Recorrências:** o campo Banco aparece e vem marcado no padrão.
   - **Fluxo:** o filtro Todos / Banco Um / Banco Dois / Sem banco esconde e mostra os lançamentos certos; a linha "o saldo de cada dia continua sendo o da box inteira" aparece só com filtro ligado.
   - **Análises:** o filtro por banco muda os totais.
   - **Hoje → Conferir:** faça uma transferência de Banco Um para Banco Dois e confirme que os saldos informados **não** mudam e que o saldo calculado em Ajustes → Bancos muda.
5. Confira em cada tela: nenhum texto cortado em 411 px, nenhuma rolagem lateral, pílulas que quebram linha sem sobrepor, mesmo texto e mesma cor de "Sem banco" em todo lugar.
6. Encerre o servidor **matando o processo que ocupa a porta 5198** (o `node` filho do `vite` pode continuar vivo).
7. Envie as capturas ao usuário pelo chat com `SendUserFile`.

- [ ] **Passo 3: Conferir o checkout principal**

```bash
git -C C:/Users/eitor/Claude/ProjetoFinancas status --porcelain
git status --porcelain
git log --oneline main..HEAD
```

Esperado: as duas saídas de `status` vazias; o `log` lista os commits deste plano.

- [ ] **Passo 4: Entregar**

Mostre o fragmento de changelog ao usuário (ele não espera resposta) e siga a skill `ciclo-de-entrega`: merge na `main`, `npm run release -- minor`, push e `npm run deploy`. **Antes do merge**, compare o maior `this.version(n)` de `src/db/database.ts` com o da `main`: este plano não cria versão nova, então não deve haver colisão.

---

## Autorrevisão contra a spec

| Requisito da spec | Onde |
|---|---|
| `Lancamento.bancoId` de uso geral; `Recorrencia.bancoId`; `Banco.padrao`; sem versão Dexie | Tarefa 1 (tipos), Tarefa 2 |
| `bancoPadrao` derivado; `definirBancoPadrao`; padrão some com o banco excluído | Tarefas 1 e 2 |
| Regra de gravação: manual, recorrência, fatura, transferência, cenário | Tarefas 2, 3 e 5 (cenário fica sem banco, decisão 2) |
| Só previstos e novos gravam banco na sincronização | Tarefa 3 |
| `saldoCalculadoBanco` (data posterior, efetivo, sem cenário) | Tarefa 1 |
| Transferência deixa de ajustar o saldo informado; legado não conta duas vezes | Tarefas 1 (data posterior) e 3 |
| `SeletorBanco` em Lançar, Editar e Recorrências; some com 0 ou 1 banco | Tarefa 5 |
| Ajustes → Bancos: selo, "Tornar padrão", saldo calculado, nota | Tarefa 6 |
| Filtro por banco no Fluxo e nas Análises; `dadosDoBanco` | Tarefas 1 e 7 |
| Banco em cada item do Fluxo; aviso do saldo do dia | Tarefa 7 |
| Backup: campos opcionais, `mesclar`, referência morta, `excluirBanco` limpa | Tarefas 2 e 4 |
| Dossiê: dois invariantes novos | Tarefa 4 |
| Docs: `dominio.md`, wiki, catálogo, changelog | Tarefas 5, 7 e 8 |
| Playwright em 411 × 744 com dados sintéticos | Tarefa 9 |

**Nomes consistentes:** `bancoPadrao`, `bancoIdDoCartao`, `bancoIdDoLancamento`, `saldoCalculadoBanco`, `lancamentoNoFiltro`, `dadosDoBanco`, `nomeBancoDoLancamento`, `FiltroBanco`, `definirBancoPadrao`, `SeletorBanco`, `SeletorFiltroBanco` aparecem com a mesma grafia em todas as tarefas.

**Riscos que o executor deve vigiar:**
- Os testes antigos de `Bancos.test.tsx`, `TelaHoje.test.tsx` e `TelaFluxo.test.tsx` procuram botões e textos que mudam de lugar. Ajuste só a consulta, nunca o comportamento.
- `sincronizarCartoes` roda a cada `iniciar()`. O `modify` de banco só grava quando o valor difere, então é idempotente: confirme que `alteradoEm` não muda numa segunda chamada seguida (o teste "acompanha a troca do padrão" cobre a primeira; se houver dúvida, chame `sincronizarCartoes` duas vezes e compare `alteradoEm`).
- A tela Hoje → Conferir mostra o saldo **informado** de cada banco, que agora não se atualiza com a transferência. Isso é o desenho aprovado; se a Playwright mostrar que confunde, **avise o usuário** em vez de mudar a conferência por conta própria.
