# Lançamentos frequentes — plano de implementação

> **Para quem executa com agentes:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam
> caixinhas (`- [ ]`) para acompanhamento.

**Objetivo:** dar à sheet Adicionar uma faixa de atalhos para as combinações de categoria +
destino que o usuário mais repete, de modo que lançar o gasto de todo dia deixe de exigir
preencher tudo de novo.

**Arquitetura:** uma função pura em `src/domain/aggregations.ts` conta as combinações dentro
de uma janela de 60 dias e devolve no máximo 6 chips. `AdicionarSheet` renderiza a faixa e
decide o destino de cada toque: chip de cartão abre o `FormCompra` dentro da própria sheet,
semeado pela prop nova `inicial`; chip de box escreve um rascunho no store, fecha a sheet e
troca para a aba Lançar, onde `TelaLancar` consome e limpa o rascunho.

**Stack:** React 18, TypeScript, Zustand, Vitest + Testing Library (jsdom + fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-08-20-lancamentos-frequentes-design.md`.

## Restrições globais

- Código, comentários, UI, commits e docs em **português**.
- Valores monetários são **centavos inteiros**; datas são strings ISO `"AAAA-MM-DD"`.
- **Todo format e parse de dinheiro vive em `src/domain/money.ts`** — nenhum outro arquivo
  formata valor.
- `src/domain/` é **puro, sem E/S**. Não importe `src/db/`, `src/state/` nem React ali.
- **Nenhum dado financeiro real** em teste, fixture ou doc. Nomes e valores sintéticos.
- **Classe nova em `src/styles.css` entra em `docs/estilo/catalogo.md` no mesmo commit** — o
  guard do release bloqueia o contrário. Só tokens existentes: nada de cor, raio ou fonte
  fora de `:root` e das escalas de `docs/estilo/fundamentos.md`.
- Não toque em `scripts/`, `vite.config.ts`, `tsconfig.json`, scripts do `package.json` nem
  `.claude/`.
- Não edite `"version"` em `package.json` nem o topo do `CHANGELOG.md` — isso é da
  integração.
- Não aperte timeouts de teste e não passe `{ timeout: n }` em `findBy*`.
- Trabalhe no worktree `.worktrees/frequentes`, branch `frequentes`. Nunca na `main`.
- Rode a suíte com `npx vitest run <arquivo>` para um arquivo e `npm test` para tudo.

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `src/domain/money.ts` | ganha `formatarSemSimbolo` | 1 |
| `src/domain/aggregations.ts` | ganha `frequentes`, `ChipFrequente`, `DestinoFrequente` | 1 |
| `src/domain/aggregations.test.ts` | testes da contagem, janela, exclusões e ordem | 1 |
| `src/state/store.ts` | ganha `rascunhoLancar` + `setRascunhoLancar` | 2 |
| `src/ui/TelaLancar.tsx` | consome e limpa o rascunho | 2 |
| `src/ui/FormCompra.tsx` | ganha a prop `inicial` | 3 |
| `src/ui/AdicionarSheet.tsx` | renderiza a faixa e roteia o toque | 4 |
| `src/styles.css` + `docs/estilo/catalogo.md` | as quatro classes da faixa | 4 |
| `docs/wiki/` + `changelog.d/` | o que o usuário lê | 5 |

---

### Tarefa 1 — a contagem, no domínio

**Arquivos:**
- Modificar: `src/domain/money.ts`
- Modificar: `src/domain/aggregations.ts`
- Testes: `src/domain/aggregations.test.ts`

**Interfaces:**
- Consome: `addDias` de `src/domain/dates.ts`; `categoriasCartaoReservadasIds` de
  `src/domain/categorias.ts`; os tipos `Dados`, `ID`, `ISODate` de `src/domain/types.ts`.
- Produz: `frequentes(dados, opcoes): ChipFrequente[]`, mais os tipos `ChipFrequente` e
  `DestinoFrequente`, e `formatarSemSimbolo(centavos): string`. As tarefas 4 e 5 dependem
  destes nomes exatos.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente ao **fim** de `src/domain/aggregations.test.ts`. Note que as fixtures são próprias
deste bloco (sufixo `F`) para não acoplar com os testes que já existem no arquivo.

```ts
import type { Cartao, CategoriaCartao, CompraCartao, Dados } from './types';
import { frequentes } from './aggregations';

const tsF = { criadoEm: '2026-01-01T00:00:00Z', alteradoEm: '2026-01-01T00:00:00Z' };
const HOJE = '2026-08-20';

const catsF: Categoria[] = [
  { id: 'cafe', boxId: 'b1', nome: 'Café', tipo: 'gasto', ordem: 0, arquivada: false, ...tsF },
  { id: 'merc', boxId: 'b1', nome: 'Mercado', tipo: 'gasto', ordem: 1, arquivada: false, ...tsF },
  { id: 'velha', boxId: 'b1', nome: 'Velha', tipo: 'gasto', ordem: 2, arquivada: true, ...tsF },
  { id: 'extra', boxId: 'b2', nome: 'De outra box', tipo: 'gasto', ordem: 0, arquivada: false, ...tsF },
];

const cartoesF: Cartao[] = [
  { id: 'c1', boxId: 'b1', nome: 'Cartão A', diaFechamento: 20, diaVencimento: 28,
    categoriaFaturaId: 'fat1', categoriaParcelamentoId: 'parc', ativo: true, ...tsF },
  { id: 'c2', boxId: 'b1', nome: 'Cartão B', diaFechamento: 10, diaVencimento: 18,
    categoriaFaturaId: 'fat2', ativo: false, ...tsF },
];

const catsCartaoF: CategoriaCartao[] = [
  { id: 'cc1', cartaoId: 'c1', nome: 'Farmácia', ordem: 0, arquivada: false, ...tsF },
  { id: 'parc', cartaoId: 'c1', nome: 'Parcelamento', ordem: 1, arquivada: false, ...tsF },
  { id: 'cc2', cartaoId: 'c2', nome: 'Posto', ordem: 0, arquivada: false, ...tsF },
];

function lancF(p: Partial<Lancamento> & Pick<Lancamento, 'id' | 'data' | 'valor' | 'categoriaId'>): Lancamento {
  return { boxId: 'b1', status: 'efetivo', origem: 'manual', ...tsF, ...p };
}

function compraF(p: Partial<CompraCartao> & Pick<CompraCartao, 'id' | 'data' | 'valorTotal' | 'categoriaCartaoId'>): CompraCartao {
  return { cartaoId: 'c1', parcelas: 1, ...tsF, ...p };
}

function dadosF(p: Partial<Dados> = {}): Dados {
  return {
    boxes: [], categorias: catsF, lancamentos: [], recorrencias: [], cenarios: [],
    cartoes: cartoesF, categoriasCartao: catsCartaoF, comprasCartao: [],
    recorrenciasCartao: [], conferenciasFatura: [], viagens: [], bancos: [],
    config: {
      id: 'config', boxPadraoId: null, ultimoBackupEm: null,
      mudancasDesdeBackup: false, horizonteProjecao: '2027-12-31',
    },
    ...p,
  };
}

const OPCOES = { hoje: HOJE, boxId: 'b1', cartaoIds: ['c1', 'c2'] };

it('frequentes: a janela de 60 dias corta o que é mais antigo', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      // 'cafe' é o mais usado, mas todos os usos estão a 70 dias — fora da janela
      lancF({ id: 'a1', data: '2026-06-11', valor: 850, categoriaId: 'cafe' }),
      lancF({ id: 'a2', data: '2026-06-11', valor: 850, categoriaId: 'cafe' }),
      lancF({ id: 'a3', data: '2026-06-11', valor: 850, categoriaId: 'cafe' }),
      // 'merc' foi usado 1× a 50 dias — dentro
      lancF({ id: 'b1', data: '2026-07-01', valor: 18730, categoriaId: 'merc' }),
    ],
  }), OPCOES);
  expect(r.map((c) => c.destino)).toEqual([{ tipo: 'box', categoriaId: 'merc' }]);
});

it('frequentes: as duas pontas da janela são inclusivas', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'ini', data: '2026-06-22', valor: 100, categoriaId: 'cafe' }), // hoje-59
      lancF({ id: 'fim', data: HOJE, valor: 200, categoriaId: 'merc' }),
    ],
  }), OPCOES);
  expect(r).toHaveLength(2);
});

it('frequentes: o valor não entra na chave — três valores viram um chip só', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'm1', data: '2026-08-01', valor: 99999, categoriaId: 'merc' }),
      lancF({ id: 'm3', data: '2026-08-15', valor: 18730, categoriaId: 'merc' }), // mais recente
      lancF({ id: 'm2', data: '2026-08-08', valor: 50000, categoriaId: 'merc' }),
    ],
  }), OPCOES);
  expect(r).toHaveLength(1);
  expect(r[0].usos).toBe(3);
  // o da data mais recente — não o maior (99999), não o primeiro do array (99999),
  // não o último do array (50000)
  expect(r[0].valorCent).toBe(18730);
});

it('frequentes: o limite corta pelas mais usadas', () => {
  const lancamentos: Lancamento[] = [];
  const cats: Categoria[] = [];
  // 8 categorias; a de índice i tem (i + 1) usos, então as 6 melhores são i = 7..2
  for (let i = 0; i < 8; i += 1) {
    cats.push({ id: `k${i}`, boxId: 'b1', nome: `Cat ${i}`, tipo: 'gasto', ordem: i, arquivada: false, ...tsF });
    for (let n = 0; n <= i; n += 1) {
      lancamentos.push(lancF({ id: `k${i}-${n}`, data: '2026-08-10', valor: 100 + i, categoriaId: `k${i}` }));
    }
  }
  const r = frequentes(dadosF({ categorias: cats, lancamentos }), OPCOES);
  expect(r).toHaveLength(6);
  expect(r.map((c) => c.rotulo)).toEqual(['Cat 7', 'Cat 6', 'Cat 5', 'Cat 4', 'Cat 3', 'Cat 2']);
});

it('frequentes: só conta o que o usuário digitou', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'ok', data: '2026-08-10', valor: 850, categoriaId: 'cafe' }),
      lancF({ id: 'x1', data: '2026-08-11', valor: 850, categoriaId: 'merc', origem: 'recorrencia' }),
      lancF({ id: 'x2', data: '2026-08-12', valor: 850, categoriaId: 'merc', origem: 'cartao' }),
      lancF({ id: 'x3', data: '2026-08-13', valor: 850, categoriaId: 'merc', cenarioId: 'cen' }),
      lancF({ id: 'x4', data: '2026-08-14', valor: 850, categoriaId: 'velha' }), // arquivada
      lancF({ id: 'x5', data: '2026-08-15', valor: 850, categoriaId: 'extra', boxId: 'b2' }), // outra box
      lancF({ id: 'x6', data: '2026-08-16', valor: 850, categoriaId: 'sumiu' }), // categoria inexistente
    ],
  }), OPCOES);
  expect(r.map((c) => c.rotulo)).toEqual(['Café']);
});

it('frequentes: status não filtra — previsto digitado à mão conta', () => {
  const r = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'p1', data: '2026-08-10', valor: 850, categoriaId: 'cafe', status: 'previsto' }),
    ],
  }), OPCOES);
  expect(r).toHaveLength(1);
  expect(r[0].usos).toBe(1);
});

it('frequentes: compra de cartão vira chip com destino de cartão', () => {
  const r = frequentes(dadosF({
    comprasCartao: [
      compraF({ id: 'k1', data: '2026-08-10', valorTotal: 6240, categoriaCartaoId: 'cc1' }),
      compraF({ id: 'k2', data: '2026-08-12', valorTotal: 3000, categoriaCartaoId: 'cc1' }),
    ],
  }), OPCOES);
  expect(r).toHaveLength(1);
  expect(r[0].destino).toEqual({ tipo: 'cartao', cartaoId: 'c1', categoriaCartaoId: 'cc1' });
  expect(r[0].rotulo).toBe('Farmácia');
  expect(r[0].valorCent).toBe(3000);
  expect(r[0].chave).toBe('cartao:c1:cc1');
});

it('frequentes: compra automática, categoria reservada e cartão inativo ficam de fora', () => {
  const r = frequentes(dadosF({
    comprasCartao: [
      compraF({ id: 'y1', data: '2026-08-10', valorTotal: 6240, categoriaCartaoId: 'cc1', recorrenciaCartaoId: 'ass' }),
      compraF({ id: 'y2', data: '2026-08-11', valorTotal: 6240, categoriaCartaoId: 'parc' }),
      compraF({ id: 'y3', data: '2026-08-12', valorTotal: 6240, categoriaCartaoId: 'cc2', cartaoId: 'c2' }),
    ],
  }), OPCOES);
  expect(r).toEqual([]);
});

it('frequentes: cartão fora de cartaoIds não entra, mesmo estando ativo', () => {
  const r = frequentes(dadosF({
    comprasCartao: [compraF({ id: 'z1', data: '2026-08-10', valorTotal: 6240, categoriaCartaoId: 'cc1' })],
  }), { ...OPCOES, cartaoIds: [] });
  expect(r).toEqual([]);
});

it('frequentes: boxId null apaga os chips de box mas mantém os de cartão', () => {
  const r = frequentes(dadosF({
    lancamentos: [lancF({ id: 'n1', data: '2026-08-10', valor: 850, categoriaId: 'cafe' })],
    comprasCartao: [compraF({ id: 'n2', data: '2026-08-10', valorTotal: 6240, categoriaCartaoId: 'cc1' })],
  }), { ...OPCOES, boxId: null });
  expect(r.map((c) => c.rotulo)).toEqual(['Farmácia']);
});

it('frequentes: empate em usos desempata pela data mais recente, depois pela chave', () => {
  // 'cafe' e 'merc' têm 1 uso cada; 'merc' é mais recente e DEVE vir primeiro, mesmo com
  // 'cafe' vindo antes em ordem alfabética, em ordem de chave e em ordem de array.
  const r1 = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'e1', data: '2026-08-10', valor: 850, categoriaId: 'cafe' }),
      lancF({ id: 'e2', data: '2026-08-11', valor: 100, categoriaId: 'merc' }),
    ],
  }), OPCOES);
  expect(r1.map((c) => c.rotulo)).toEqual(['Mercado', 'Café']);

  // usos e data iguais: aí sim a chave crescente decide ('box:cafe' < 'box:merc')
  const r2 = frequentes(dadosF({
    lancamentos: [
      lancF({ id: 'e3', data: '2026-08-10', valor: 100, categoriaId: 'merc' }),
      lancF({ id: 'e4', data: '2026-08-10', valor: 850, categoriaId: 'cafe' }),
    ],
  }), OPCOES);
  expect(r2.map((c) => c.rotulo)).toEqual(['Café', 'Mercado']);
});

it('frequentes: sem histórico devolve lista vazia', () => {
  expect(frequentes(dadosF(), OPCOES)).toEqual([]);
});
```

E em `src/domain/money.test.ts`, acrescente:

```ts
it('formatarSemSimbolo mostra centavos e milhar, sem R$', () => {
  expect(formatarSemSimbolo(850)).toBe('8,50');
  expect(formatarSemSimbolo(187030)).toBe('1.870,30');
  expect(formatarSemSimbolo(0)).toBe('0,00');
  expect(formatarSemSimbolo(100)).toBe('1,00'); // não '1'
});
```

Acerte o `import` no topo de `money.test.ts` para incluir `formatarSemSimbolo`.

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/domain/aggregations.test.ts src/domain/money.test.ts
```

Esperado: erro de compilação — `frequentes` e `formatarSemSimbolo` não existem.

- [ ] **Passo 3: implementar `formatarSemSimbolo`**

Ao fim de `src/domain/money.ts`:

```ts
/** Valor com centavos, sem "R$" — para caber em pílula estreita (ex.: "8,50", "1.870,30"). */
export function formatarSemSimbolo(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
```

- [ ] **Passo 4: implementar `frequentes`**

Ao fim de `src/domain/aggregations.ts`. Acerte os `import` do topo do arquivo: `addDias` vem
de `./dates` (já há um import de `./dates`), `categoriasCartaoReservadasIds` de
`./categorias` (já há um import de `./categorias`), e `Dados` entra na lista de tipos
importados de `./types`.

```ts
export type DestinoFrequente =
  | { tipo: 'box'; categoriaId: ID }
  | { tipo: 'cartao'; cartaoId: ID; categoriaCartaoId: ID };

export interface ChipFrequente {
  chave: string;      // 'box:<categoriaId>' | 'cartao:<cartaoId>:<categoriaCartaoId>'
  destino: DestinoFrequente;
  rotulo: string;     // nome da categoria
  valorCent: number;  // valor da ocorrência mais recente
  usos: number;
}

interface Acumulado extends ChipFrequente {
  ultimaData: ISODate;
}

/**
 * Combinações de categoria + destino que o usuário mais digitou na janela, para virarem
 * atalhos na sheet Adicionar. Só conta o que foi digitado à mão: recorrência, fatura,
 * assinatura e parcelamento entram sozinhos no app, e um atalho para eles convidaria a
 * lançar em duplicidade. `status` não filtra — o que separa gesto de automação é `origem`.
 *
 * A janela é medida pela `data` do lançamento, não por `criadoEm`: quem digita hoje o gasto
 * do mês passado quer que ele conte no mês passado.
 */
export function frequentes(
  dados: Dados,
  opcoes: {
    hoje: ISODate;
    boxId: ID | null;
    cartaoIds: readonly ID[];
    janelaDias?: number;
    limite?: number;
  },
): ChipFrequente[] {
  const janelaDias = opcoes.janelaDias ?? 60;
  const limite = opcoes.limite ?? 6;
  const inicio = addDias(opcoes.hoje, -(janelaDias - 1));
  const dentro = (d: ISODate) => d >= inicio && d <= opcoes.hoje;

  const acc = new Map<string, Acumulado>();
  function registrar(
    chave: string, destino: DestinoFrequente, rotulo: string, data: ISODate, valorCent: number,
  ) {
    const atual = acc.get(chave);
    if (!atual) {
      acc.set(chave, { chave, destino, rotulo, valorCent, usos: 1, ultimaData: data });
      return;
    }
    atual.usos += 1;
    // empate de data: vence quem aparece por último no array — arbitrário, mas estável
    if (data >= atual.ultimaData) { atual.ultimaData = data; atual.valorCent = valorCent; }
  }

  if (opcoes.boxId != null) {
    const cats = new Map(
      dados.categorias
        .filter((c) => c.boxId === opcoes.boxId && !c.arquivada)
        .map((c) => [c.id, c] as const),
    );
    for (const l of dados.lancamentos) {
      if (l.origem !== 'manual' || l.cenarioId) continue;
      if (l.boxId !== opcoes.boxId || !dentro(l.data)) continue;
      const cat = cats.get(l.categoriaId);
      if (!cat) continue;
      registrar(`box:${cat.id}`, { tipo: 'box', categoriaId: cat.id }, cat.nome, l.data, l.valor);
    }
  }

  const permitidos = new Set(
    dados.cartoes.filter((c) => c.ativo && opcoes.cartaoIds.includes(c.id)).map((c) => c.id),
  );
  const reservadas = categoriasCartaoReservadasIds(dados.cartoes);
  const catsCartao = new Map(
    dados.categoriasCartao
      .filter((c) => !c.arquivada && !reservadas.has(c.id))
      .map((c) => [c.id, c] as const),
  );
  for (const co of dados.comprasCartao) {
    if (co.recorrenciaCartaoId) continue;
    if (!permitidos.has(co.cartaoId) || !dentro(co.data)) continue;
    const cat = catsCartao.get(co.categoriaCartaoId);
    if (!cat || cat.cartaoId !== co.cartaoId) continue;
    registrar(
      `cartao:${co.cartaoId}:${cat.id}`,
      { tipo: 'cartao', cartaoId: co.cartaoId, categoriaCartaoId: cat.id },
      cat.nome, co.data, co.valorTotal,
    );
  }

  return [...acc.values()]
    .sort((a, b) => (
      b.usos - a.usos
      || (a.ultimaData < b.ultimaData ? 1 : a.ultimaData > b.ultimaData ? -1 : 0)
      || (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0)
    ))
    .slice(0, limite)
    .map(({ chave, destino, rotulo, valorCent, usos }) => ({ chave, destino, rotulo, valorCent, usos }));
}
```

- [ ] **Passo 5: rodar e ver passar**

```
npx vitest run src/domain/aggregations.test.ts src/domain/money.test.ts
```

Esperado: todos verdes.

- [ ] **Passo 6: provar que os testes discriminam (mutação)**

Não pule este passo. Nesta base, teste que passa com o código quebrado já apareceu em 7 de 9
tarefas. Faça **uma mutação de cada vez**, rode, confirme a falha, desfaça:

| Mutação | Teste que precisa falhar |
|---|---|
| trocar `l.origem !== 'manual'` por `false` | "só conta o que o usuário digitou" |
| trocar `d >= inicio` por `true` | "a janela de 60 dias corta o que é mais antigo" |
| trocar `data >= atual.ultimaData` por `false` | "o valor não entra na chave" |
| remover o desempate por `ultimaData` do `sort` | "empate em usos desempata..." |
| trocar `!c.arquivada` por `true` (categorias de box) | "só conta o que o usuário digitou" |
| trocar `co.recorrenciaCartaoId` por `false` | "compra automática, categoria reservada..." |

Cole no relato a saída de pelo menos duas dessas mutações.

- [ ] **Passo 7: commitar**

```bash
git add src/domain/money.ts src/domain/money.test.ts src/domain/aggregations.ts src/domain/aggregations.test.ts
git commit -m "Conta as combinações que o usuário mais lança"
```

---

### Tarefa 2 — o rascunho, do store até a tela Lançar

**Arquivos:**
- Modificar: `src/state/store.ts`
- Modificar: `src/ui/TelaLancar.tsx`
- Teste: `src/ui/TelaLancar.test.tsx`

**Interfaces:**
- Consome: nada da tarefa 1.
- Produz: `RascunhoLancar { categoriaId: ID; valorCent: number }`, o campo
  `rascunhoLancar: RascunhoLancar | null` e a ação `setRascunhoLancar(r: RascunhoLancar | null): void`
  em `useApp`. A tarefa 4 chama `setRascunhoLancar`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente ao fim de `src/ui/TelaLancar.test.tsx`. O arquivo não tem helper de montagem — os
testes montam a box inline, e o código abaixo segue esse mesmo padrão. `agoraISO`, `novoId`,
`repo` e `useApp` já estão importados no topo do arquivo.

```ts
it('consome o rascunho: preenche valor, categoria e tipo, e limpa o rascunho', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  const ganho = await repo.salvarCategoria({ boxId: box.id, nome: 'bico', tipo: 'ganho', ordem: 1 });
  await useApp.getState().iniciar();
  useApp.setState({
    boxSel: box.id, hoje: '2026-07-02',
    rascunhoLancar: { categoriaId: ganho.id, valorCent: 4500 },
  });

  render(<TelaLancar />);

  // a categoria semeada é de GANHO, e a tela abre em 'gasto': se o tipo não virar sozinho,
  // ela nem aparece na grade. É por isso que a fixture tem uma categoria de cada tipo.
  expect(await screen.findByRole('button', { name: 'bico' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Valor')).toHaveValue('R$ 45,00');
  // o rascunho é de uso único: sem limpar, voltar para a tela ressuscitaria o valor
  expect(useApp.getState().rascunhoLancar).toBeNull();
});

it('rascunho com categoria que não existe mais não quebra a tela e é descartado', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'mercado', tipo: 'gasto', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({
    boxSel: box.id, hoje: '2026-07-02',
    rascunhoLancar: { categoriaId: 'sumiu', valorCent: 4500 },
  });

  render(<TelaLancar />);

  expect(await screen.findByRole('heading', { name: 'Lançar' })).toBeInTheDocument();
  expect(useApp.getState().rascunhoLancar).toBeNull();
});
```

`getByLabelText('Valor')` é a query que os testes vizinhos já usam para o `CampoValor` —
não mude o componente para acomodar teste.

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/ui/TelaLancar.test.tsx
```

Esperado: erro de tipo em `rascunhoLancar` (não existe em `AppState`).

- [ ] **Passo 3: acrescentar o campo ao store**

Em `src/state/store.ts`, junto das outras declarações:

```ts
/** Semente de um lançamento vinda dos atalhos da sheet Adicionar; de uso único. */
export interface RascunhoLancar { categoriaId: ID; valorCent: number }
```

Dentro de `interface AppState`, ao lado de `ajustesSecao`:

```ts
  rascunhoLancar: RascunhoLancar | null;
  setRascunhoLancar(r: RascunhoLancar | null): void;
```

Dentro de `create<AppState>((set) => ({ ... }))`, ao lado de `ajustesSecao: null`:

```ts
  rascunhoLancar: null,
  setRascunhoLancar: (rascunhoLancar) => set({ rascunhoLancar }),
```

- [ ] **Passo 4: consumir na tela Lançar**

Em `src/ui/TelaLancar.tsx`, troque a linha do `useApp`:

```tsx
const { dados, boxSel, hoje, recarregar, rascunhoLancar, setRascunhoLancar } = useApp();
```

E acrescente, junto dos outros `useEffect` do topo do componente:

```tsx
// A sheet Adicionar não renderiza esta tela, então manda o atalho pelo store. A dependência
// é o rascunho, não a montagem: o + pode ser aberto com a tela Lançar já visível.
useEffect(() => {
  if (!rascunhoLancar || !dados) return;
  const cat = dados.categorias.find((c) => c.id === rascunhoLancar.categoriaId);
  if (cat) {
    setTipo(cat.tipo);
    setCategoriaId(cat.id);
    setCents(rascunhoLancar.valorCent);
  }
  setRascunhoLancar(null);
}, [rascunhoLancar, dados, setRascunhoLancar]);
```

- [ ] **Passo 5: rodar e ver passar**

```
npx vitest run src/ui/TelaLancar.test.tsx
```

- [ ] **Passo 6: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| remover `setTipo(cat.tipo)` | "consome o rascunho..." (a categoria de ganho some da grade) |
| remover `setRascunhoLancar(null)` | "consome o rascunho..." (rascunho não zerou) |
| trocar `if (cat)` por `if (true)` e usar `cat!.tipo` | "rascunho com categoria que não existe mais" |

- [ ] **Passo 7: commitar**

```bash
git add src/state/store.ts src/ui/TelaLancar.tsx src/ui/TelaLancar.test.tsx
git commit -m "Tela Lançar aceita um rascunho semeado por outra tela"
```

---

### Tarefa 3 — semear o formulário de compra

**Arquivos:**
- Modificar: `src/ui/FormCompra.tsx:12-18`
- Teste: `src/ui/FormCompra.test.tsx`

**Interfaces:**
- Consome: nada das tarefas anteriores.
- Produz: a prop `inicial?: { valorTotal: number; categoriaCartaoId: ID }` em `FormCompra`.
  A tarefa 4 passa essa prop.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente ao fim de `src/ui/FormCompra.test.tsx`. O arquivo já tem o helper `montarCartao()`,
que devolve `{ box, cartao, catCartao }` — a categoria de cartão dele se chama `mercado`.

```ts
it('inicial semeia valor e categoria de uma compra nova', async () => {
  const { box, cartao, catCartao } = await montarCartao();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(
    <FormCompra
      cartao={cartao}
      inicial={{ valorTotal: 6240, categoriaCartaoId: catCartao.id }}
      onFechar={() => {}}
    />,
  );

  expect(await screen.findByRole('button', { name: 'mercado' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Valor')).toHaveValue('R$ 62,40');
  expect(screen.getByLabelText('Parcelas')).toHaveValue('1');
});

it('editando uma compra, inicial é ignorado', async () => {
  const { box, cartao, catCartao } = await montarCartao();
  const outra = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'posto', ordem: 1 });
  const compra = await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-06-10',
    valorTotal: 10000, parcelas: 3,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-01' });

  render(
    <FormCompra
      cartao={cartao}
      compra={compra}
      inicial={{ valorTotal: 6240, categoriaCartaoId: outra.id }}
      onFechar={() => {}}
    />,
  );

  // a compra que está sendo editada manda; inicial não pode sobrescrever dado gravado
  expect(await screen.findByRole('button', { name: 'mercado' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Valor')).toHaveValue('R$ 100,00');
  expect(screen.getByLabelText('Parcelas')).toHaveValue('3');
});
```

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/ui/FormCompra.test.tsx
```

Esperado: erro de tipo — `inicial` não existe nas props.

- [ ] **Passo 3: implementar**

Em `src/ui/FormCompra.tsx`, troque a assinatura e os dois `useState` semeados:

```tsx
export default function FormCompra({ cartao, compra, inicial, onFechar }: {
  cartao: Cartao;
  compra?: CompraCartao;
  /** Semente de uma compra NOVA (atalho da sheet Adicionar). `compra` tem precedência. */
  inicial?: { valorTotal: number; categoriaCartaoId: string };
  onFechar: () => void;
}) {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState(compra?.valorTotal ?? inicial?.valorTotal ?? 0);
  const [data, setData] = useState(compra?.data ?? hoje);
  const [categoriaId, setCategoriaId] = useState<string | null>(
    compra?.categoriaCartaoId ?? inicial?.categoriaCartaoId ?? null,
  );
```

Nada mais muda no arquivo.

- [ ] **Passo 4: rodar e ver passar**

```
npx vitest run src/ui/FormCompra.test.tsx
```

- [ ] **Passo 5: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| trocar a ordem para `inicial?.valorTotal ?? compra?.valorTotal ?? 0` | "editando uma compra, inicial é ignorado" |
| remover `?? inicial?.categoriaCartaoId` | "inicial semeia valor e categoria" |

- [ ] **Passo 6: commitar**

```bash
git add src/ui/FormCompra.tsx src/ui/FormCompra.test.tsx
git commit -m "FormCompra aceita valor e categoria semeados"
```

---

### Tarefa 4 — a faixa na sheet Adicionar

**Arquivos:**
- Modificar: `src/ui/AdicionarSheet.tsx`
- Modificar: `src/styles.css` (fim do arquivo)
- Modificar: `docs/estilo/catalogo.md`
- Teste: `src/ui/AdicionarSheet.test.tsx`

**Interfaces:**
- Consome: `frequentes` e `ChipFrequente` (tarefa 1), `formatarSemSimbolo` (tarefa 1),
  `setRascunhoLancar` (tarefa 2), a prop `inicial` de `FormCompra` (tarefa 3).
- Produz: nada para tarefas seguintes.

**Leia antes:** `docs/estilo/nivel-2-nova-classe.md` e `docs/estilo/catalogo.md`.

- [ ] **Passo 1: escrever os testes que falham**

Acrescente ao fim de `src/ui/AdicionarSheet.test.tsx`. As datas são fixas e o cálculo usa
`hoje` do store, então **fixe o `hoje` do store** em vez de mexer no relógio.

```ts
async function montarComHistorico() {
  const box = await montarBox();
  const cartao = await repo.salvarCartao({
    boxId: box.id, nome: 'Cartão A', diaFechamento: 20, diaVencimento: 28,
  }, '2027-12-31');
  const catCartao = await repo.salvarCategoriaCartao({
    cartaoId: cartao.id, nome: 'Farmácia', ordem: 0,
  });
  const catBox = await repo.salvarCategoria({
    boxId: box.id, nome: 'Café', tipo: 'gasto', ordem: 0,
  });
  await repo.salvarLancamento({
    boxId: box.id, categoriaId: catBox.id, data: '2026-08-10', valor: 850, status: 'efetivo',
  });
  await repo.salvarCompraCartao({
    cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-08-12',
    valorTotal: 6240, parcelas: 1,
  }, '2027-12-31');
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-20' });
  return { box, cartao, catBox, catCartao };
}

it('sem histórico, a faixa de frequentes não aparece', async () => {
  const box = await montarBox();
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-08-20' });
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  expect(await screen.findByText('Lançamento')).toBeInTheDocument();
  expect(screen.queryByText('Frequentes')).not.toBeInTheDocument();
});

it('chip de cartão abre o formulário preenchido, sem escolher cartão', async () => {
  await montarComHistorico();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  await userEvent.click(await screen.findByRole('button', { name: /Farmácia/ }));

  expect(await screen.findByRole('heading', { name: 'Nova compra' })).toBeInTheDocument();
  // o passo "Compra em qual cartão?" não pode ter acontecido
  expect(screen.queryByRole('heading', { name: 'Compra em qual cartão?' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Farmácia' })).toHaveClass('selecionada');
  expect(screen.getByLabelText('Valor')).toHaveValue('R$ 62,40');
});

it('chip de box fecha a sheet, vai para Lançar e grava o rascunho', async () => {
  const { catBox } = await montarComHistorico();
  const onFechar = vi.fn();
  useApp.setState({ aba: 'hoje' });
  render(<AdicionarSheet aberto onFechar={onFechar} />);

  await userEvent.click(await screen.findByRole('button', { name: /Café/ }));

  expect(onFechar).toHaveBeenCalledOnce();
  expect(useApp.getState().aba).toBe('lancar');
  expect(useApp.getState().rascunhoLancar).toEqual({ categoriaId: catBox.id, valorCent: 850 });
});

it('o chip diz de que cartão é, para quem não enxerga o ponto azul', async () => {
  await montarComHistorico();
  render(<AdicionarSheet aberto onFechar={() => {}} />);

  expect(await screen.findByRole('button', { name: 'Farmácia, no Cartão A, 62,40' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Café, nesta box, 8,50' })).toBeInTheDocument();
});
```

- [ ] **Passo 2: rodar e ver falhar**

```
npx vitest run src/ui/AdicionarSheet.test.tsx
```

Esperado: os quatro testes novos falham por não achar os chips.

- [ ] **Passo 3: implementar a faixa**

Em `src/ui/AdicionarSheet.tsx`. Acrescente aos imports:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { frequentes, type ChipFrequente } from '../domain/aggregations';
import { formatarSemSimbolo } from '../domain/money';
import { boxIdEfetivo, boxIdsSelecionadas, useApp } from '../state/store';
```

Dentro do componente, junto dos outros hooks e **antes** do `if (!dados) return null`:

```tsx
const { dados, boxSel, hoje, setAba, setRascunhoLancar } = useApp();
const [inicialCompra, setInicialCompra] =
  useState<{ valorTotal: number; categoriaCartaoId: string } | null>(null);

// Escopo assimétrico de propósito: cada chip só existe se o formulário de destino puder
// recebê-lo. Chip de box vai para a tela Lançar, que usa boxIdEfetivo; chip de cartão abre
// o FormCompra aqui, sobre a mesma lista de cartões que esta sheet já monta.
const chips = useMemo(() => {
  if (!dados) return [];
  const ids = boxIdsSelecionadas(dados, boxSel);
  const cartaoIds = dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId)).map((c) => c.id);
  return frequentes(dados, { hoje, boxId: boxIdEfetivo(dados, boxSel), cartaoIds });
}, [dados, boxSel, hoje]);
```

No `useEffect` que já existe (o de `!aberto`), acrescente `setInicialCompra(null);` junto de
`setPasso('menu')` e `setCartaoEscolhido(null)`.

Depois de `const cartoesAtivos = ...`, acrescente o roteamento e o rótulo acessível:

```tsx
function nomeCartaoDe(chip: ChipFrequente): string | null {
  if (chip.destino.tipo !== 'cartao') return null;
  return dados!.cartoes.find((c) => c.id === chip.destino.cartaoId)?.nome ?? null;
}

function tocarChip(chip: ChipFrequente) {
  if (chip.destino.tipo === 'cartao') {
    const cartao = dados!.cartoes.find((c) => c.id === chip.destino.cartaoId);
    if (!cartao) return;
    setCartaoEscolhido(cartao);
    setInicialCompra({
      valorTotal: chip.valorCent, categoriaCartaoId: chip.destino.categoriaCartaoId,
    });
    setPasso('form');
    return;
  }
  setRascunhoLancar({ categoriaId: chip.destino.categoriaId, valorCent: chip.valorCent });
  onFechar();
  setAba('lancar');
}
```

No bloco `passo === 'menu'`, **acima** do `<div className="lista">`:

```tsx
{chips.length > 0 && (
  <>
    <p className="rotulo-grupo">Frequentes</p>
    <div className="frequentes">
      {chips.map((chip) => {
        const nomeCartao = nomeCartaoDe(chip);
        const valor = formatarSemSimbolo(chip.valorCent);
        return (
          <button
            key={chip.chave}
            className="frequentes-chip"
            aria-label={`${chip.rotulo}, ${nomeCartao ? `no ${nomeCartao}` : 'nesta box'}, ${valor}`}
            onClick={() => tocarChip(chip)}
          >
            {nomeCartao && <span className="frequentes-ponto" aria-hidden="true" />}
            {chip.rotulo}
            <span className="frequentes-detalhe">{valor}</span>
          </button>
        );
      })}
    </div>
    {chips.some((c) => c.destino.tipo === 'cartao') && (
      <p className="sub">● vai para o cartão</p>
    )}
  </>
)}
```

E troque a última linha do JSX, que hoje é exatamente isto:

```tsx
{passo === 'form' && cartaoEscolhido && (
  <FormCompra cartao={cartaoEscolhido} onFechar={onFechar} />
)}
```

por isto:

```tsx
{passo === 'form' && cartaoEscolhido && (
  <FormCompra
    cartao={cartaoEscolhido}
    {...(inicialCompra ? { inicial: inicialCompra } : {})}
    onFechar={onFechar}
  />
)}
```

- [ ] **Passo 4: as classes, em `src/styles.css`**

Ao fim do arquivo, em bloco próprio:

```css
/* ---- Frequentes (AdicionarSheet.tsx) ---- */
.frequentes { display: flex; flex-wrap: wrap; gap: 8px; }
.frequentes-chip {
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--surface2); border: none; color: var(--fg);
  padding: 8px 14px; border-radius: 999px; font-size: 14px; font-weight: 600;
  min-height: 38px;
}
.frequentes-detalhe {
  color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums;
}
.frequentes-ponto {
  width: 6px; height: 6px; border-radius: 999px; background: var(--ac); flex: 0 0 auto;
}
```

O fundo é `--surface2`, não `--surface`: a sheet já é `--surface` e a pílula sumiria dentro
dela. É o mesmo motivo por que `.botao` usa `--surface2`.

- [ ] **Passo 5: catalogar, no mesmo commit**

Em `docs/estilo/catalogo.md`, na tabela de classes, quatro linhas:

```
| `.frequentes` | faixa de atalhos no topo da sheet Adicionar |
| `.frequentes-chip` | pílula de atalho (categoria + valor) dentro de `.frequentes` |
| `.frequentes-detalhe` | o valor dentro do chip, em `--muted` e `tabular-nums` |
| `.frequentes-ponto` | ponto azul que marca atalho com destino de cartão |
```

Acerte o formato exato de coluna ao que a tabela do arquivo já usa.

- [ ] **Passo 6: rodar tudo e ver passar**

```
npx vitest run src/ui/AdicionarSheet.test.tsx
node scripts/verificar-catalogo.mjs
npm test
npm run build
```

Esperado: suíte verde, catálogo sem pendência, build limpo.

- [ ] **Passo 7: provar que os testes discriminam (mutação)**

| Mutação | Teste que precisa falhar |
|---|---|
| trocar `chips.length > 0` por `true` | nenhum — **é o ponto**: confirme que "sem histórico" continua passando, e então troque para `chips.length >= 0` e renderize um chip fixo para ver o teste falhar |
| remover `setInicialCompra(...)` de `tocarChip` | "chip de cartão abre o formulário preenchido" |
| remover `setRascunhoLancar(...)` | "chip de box fecha a sheet..." |
| remover o `aria-label` | "o chip diz de que cartão é" |

- [ ] **Passo 8: commitar**

```bash
git add src/ui/AdicionarSheet.tsx src/ui/AdicionarSheet.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "Atalhos para o que você mais lança, no topo da sheet Adicionar"
```

---

### Tarefa 5 — o que o usuário lê

**Arquivos:**
- Modificar: `docs/wiki/6-telas.md`, seção `## Lançar` (é onde o botão `+` é descrito, na
  linha "O botão central (+) da barra")
- Modificar: `docs/wiki/8-glossario.md`
- Criar: `changelog.d/adicionado-lancamentos-frequentes.md`

**Interfaces:** nenhuma.

**Leia antes:** `docs/wiki/README.md` — o parser aceita um subconjunto **fechado** de
markdown e **lança exceção** fora dele. `changelog.d/README.md` — bullets planos, sem negrito
nem aninhamento.

- [ ] **Passo 1: escrever o trecho da wiki**

Na seção `## Lançar` de `docs/wiki/6-telas.md`, acrescente bullets no mesmo formato dos que
já estão lá (bullet plano, uma frase, sem aninhamento), com estes fatos:

- O topo da sheet mostra atalhos para o que você mais lançou nos últimos dois meses.
- Cada atalho já sabe a categoria, o destino e o valor da última vez; você confere e confirma.
- Atalho com ponto azul vai para um cartão; sem ponto, é lançamento na box.
- Só conta o que você digitou: recorrência, fatura e assinatura não viram atalho, porque já
  entram sozinhas.
- Sem histórico, os atalhos não aparecem.

No glossário, uma entrada para **atalho de lançamento**.

- [ ] **Passo 2: validar o parser da wiki**

```
npx vitest run src/ui/ajustes/capitulos.test.ts
```

Esperado: verde. Se lançar exceção, o markdown saiu do subconjunto aceito — simplifique.

- [ ] **Passo 3: escrever o fragmento de changelog**

`changelog.d/adicionado-lancamentos-frequentes.md`:

```markdown
### Adicionado

- O botão + agora mostra atalhos para o que você mais lança: cada um já vem com a categoria, o cartão ou a box, e o valor da última vez.
- O atalho abre o formulário preenchido, para você conferir antes de confirmar — nada é lançado só de tocar.
- Contam só os lançamentos que você digitou nos últimos 60 dias; recorrência, fatura e assinatura não viram atalho porque já entram sozinhas.
- Quem ainda não tem histórico não vê nada de novo: a tela fica igual ao que era.
```

Confira o formato exato de cabeçalho contra `changelog.d/README.md` e contra um fragmento
antigo do histórico do git.

- [ ] **Passo 4: rodar os guards**

```
node scripts/verificar-dados-reais.mjs
npm test
```

- [ ] **Passo 5: commitar**

```bash
git add docs/wiki changelog.d/adicionado-lancamentos-frequentes.md
git commit -m "Wiki e changelog dos atalhos de lançamento"
```

---

## Ao fim de todas as tarefas

Não integre sozinho. O ciclo de entrega (`.claude/skills/ciclo-de-entrega/SKILL.md`) exige
confirmação do usuário sobre o fragmento de changelog antes do merge, e o mockup já foi
aprovado em 2026-08-20 (opção B, valor sem `R$`, faixa acima).

Verificação final, antes de chamar o usuário:

```
npm test
npm run build
node scripts/verificar-catalogo.mjs
node scripts/verificar-dados-reais.mjs
```
