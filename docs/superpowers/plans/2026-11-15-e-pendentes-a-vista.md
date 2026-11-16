# Plano E — Pendentes à vista no Hoje

> **Para quem executa:** use a skill `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** quem abre o Hoje vê, acima do saldo, os dois pendentes mais antigos e confirma cada um num toque. Confirmar um pendente passa a oferecer "Desfazer".

**Arquitetura:** um componente novo, `PendentesResumo`, recebe a fila que o `TelaHoje` já calcula com `pendentes()`. Nenhuma função de domínio muda. O "Desfazer" da confirmação devolve o lançamento a `previsto`, com o valor e a data de antes, por `repo.atualizarLancamento`, que já aceita esses campos.

**Stack:** React 18, TypeScript, Zustand, Vitest, Testing Library.

**Depende de:** plano D1 entregue (`avisar`, `Retorno`).

**Spec:** `docs/superpowers/specs/2026-11-15-confirmacao-retorno-e-pendentes-design.md`. Mockup aprovado em 2026-11-15: card com itens, acima do saldo.

## Restrições globais

- Antes de editar a UI, leia `docs/estilo-visual.md`, `nivel-2-nova-classe.md`, `nivel-4-novo-componente.md` e `docs/estilo/interacao.md`.
- Classe e componente novos entram em `docs/estilo/catalogo.md` no mesmo commit.
- "Texto não dança": na lista do card, todo nome tem o mesmo tamanho e peso, e todo valor termina na mesma linha vertical.
- Consistência: a linha do card mostra o pendente com os mesmos textos, cores e sinal da fila da pílula Pendentes. Reaproveite `classeEfeito`, `efeitoNoSaldo`, `formatarBRL`, `notaExibivel` e `SeloBox`, como a fila faz.
- Nenhuma função de `src/domain/` ou `src/db/` muda. Nenhuma dependência nova.
- Dados de teste sintéticos. Recalcule à mão as datas dos testes: com `hoje` em 2026-07-02, entra na fila todo previsto com data até 2026-07-05.
- Não aperte timeouts de teste.
- Mudança visível: fragmento, wiki, varredura, release e deploy pela skill `ciclo-de-entrega`.

## Decisões a confirmar antes de executar

1. **Título do card.** O mockup aprovado diz "Para confirmar · N". A pílula da mesma tela diz "Pendentes · N". A regra de consistência pede um texto só. Este plano segue o mockup e deixa o texto na constante `TITULO`. Recomendação: trocar para "Pendentes".
2. **Texto do aviso.** O mockup mostrava "salário confirmado". Com categoria no feminino ("moradia confirmado") a frase fica errada. Este plano usa "Confirmado: salário", que serve para qualquer nome.

## Modelo por tarefa

| Tarefa | Complexidade | Implementa | Revisa |
|---|---|---|---|
| 1 Confirmar com Desfazer | intermediária | Haiku | Sonnet, depois Opus |
| 2 `PendentesResumo` | intermediária | Haiku | Sonnet, depois Opus |
| 3 Card no Hoje | intermediária | Haiku | Sonnet, depois Opus |
| 4 Wiki, changelog, dossiê, varredura | intermediária | sessão principal | Opus |

A ordem é sequencial: as três primeiras tarefas tocam `TelaHoje.tsx` ou dependem uma da outra.

## Pontos de chamada

- `pendentes()` (`src/domain/projection.ts:71`) só é chamada por `TelaHoje.tsx:469`. Não muda.
- `repo.confirmarPendente`: `TelaHoje.tsx:536` e `:541` (mudam: ganham aviso e Desfazer); `CartaoSimples.tsx:97`, `importar/aplicar.ts:83` e `:90`, `dossie/roteiro.ts:205` e `:216` (não mudam).
- `repo.atualizarLancamento` é chamada pelo Desfazer com `{ status: 'previsto', valor, data }`. Os três campos já estão no tipo do `patch`.

---

### Tarefa 1: Confirmar pendente com aviso e Desfazer

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx` (funções `confirmarCorrigido` e `confirmar`, linhas 533-543; chamadas nas linhas 709 e 714)
- Testar: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consome: `avisar` (plano D1). Depois do plano D1, a linha 436 já desestrutura `avisar`.
- Produz: `confirmar(l: Lancamento)` — antes recebia o `id`. A Tarefa 3 usa esta assinatura.

- [ ] **Passo 1: escreva os testes que falham.** Use a montagem do teste "mostra saldo e confirma um pendente" (linha 23): uma box, uma categoria, um previsto.

```tsx
  it('confirmar avisa e o Desfazer devolve o previsto como estava', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'moradia', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02', retorno: null });
    render(<TelaHoje />);
    await userEvent.click(screen.getByRole('tab', { name: /Pendentes/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar moradia' }));

    await waitFor(() => expect(useApp.getState().retorno?.texto).toBe('Confirmado: moradia'));
    expect((await db.lancamentos.get(previsto.id))!.status).toBe('efetivo');

    await useApp.getState().retorno!.desfazer!();
    const depois = (await db.lancamentos.get(previsto.id))!;
    expect(depois.status).toBe('previsto');
    expect(depois.valor).toBe(50000);
    expect(depois.data).toBe('2026-07-01');
  });

  it('confirmar com valor e data corrigidos: o Desfazer devolve o valor e a data originais', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'jardinagem', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 11990, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02', retorno: null });
    render(<TelaHoje />);
    await userEvent.click(screen.getByRole('tab', { name: /Pendentes/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Corrigir valor de jardinagem' }));
    await userEvent.type(screen.getByLabelText('Valor pago'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar jardinagem' }));

    await waitFor(() => expect(useApp.getState().retorno?.texto).toBe('Confirmado: jardinagem'));
    expect((await db.lancamentos.get(previsto.id))!.valor).not.toBe(11990);

    await useApp.getState().retorno!.desfazer!();
    const depois = (await db.lancamentos.get(previsto.id))!;
    expect(depois).toMatchObject({ status: 'previsto', valor: 11990, data: '2026-07-01' });
  });
```

O `CampoValor` é de "caixa eletrônico": digitar `5` acrescenta um dígito aos centavos (11990 vira 119905). O teste só precisa que o valor mude; por isso confere `not.toBe(11990)`.

Acrescente um terceiro teste para a fatura. Ache no arquivo a montagem de um pendente que é fatura de cartão (procure por "Paguei outro valor") e reaproveite:

```tsx
  it('confirmar uma fatura avisa, mas não oferece Desfazer', async () => {
    // ...montagem existente de um pendente de fatura...
    await userEvent.click(screen.getByRole('button', { name: /^Confirmar / }));

    await waitFor(() => expect(useApp.getState().retorno).not.toBeNull());
    expect(useApp.getState().retorno!.desfazer).toBeUndefined();
  });
```

- [ ] **Passo 2:** rode `npx vitest run src/ui/TelaHoje.test.tsx`. Esperado: os três falham.

- [ ] **Passo 3: implemente.** Troque `confirmarCorrigido` e `confirmar` por:

```tsx
  // Desfazer devolve o previsto como estava: status, valor e data de antes da confirmação.
  // Fatura de cartão não oferece Desfazer: o pagamento dela mexe em mais de um registro.
  function avisarConfirmado(l: Lancamento) {
    avisar(
      `Confirmado: ${nomeCat(l.categoriaId)}`,
      ehFatura(l)
        ? undefined
        : () => repo.atualizarLancamento(l.id, { status: 'previsto', valor: l.valor, data: l.data }),
    );
  }

  // O campo edita a magnitude; o sinal vem do previsto original, para um estorno negativo não
  // virar positivo em silêncio. Trocar o sinal continua sendo trabalho do LancEditor.
  async function confirmarCorrigido(l: Lancamento) {
    const valor = l.valor < 0 ? -valorCorrigido : valorCorrigido;
    setCorrigindo(null);
    await repo.confirmarPendente(l.id, valor, dataCorrigida);
    await recarregar();
    avisarConfirmado(l);
  }

  async function confirmar(l: Lancamento) {
    await repo.confirmarPendente(l.id);
    await recarregar();
    avisarConfirmado(l);
  }
```

`nomeCat` é definida depois, na linha 470; como `avisarConfirmado` só roda num clique, a ordem não importa, mas a função precisa ficar **depois** do `if (!dados) return null;`, onde `confirmar` já está.

Na linha 714, troque `onClick={() => confirmar(l.id)}` por `onClick={() => confirmar(l)}`.

- [ ] **Passo 4:** rode `npx vitest run src/ui/TelaHoje.test.tsx`, depois `npm test`. Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx
git commit -m "feat(hoje): confirmar pendente avisa e oferece Desfazer"
```

---

### Tarefa 2: Componente `PendentesResumo`

**Arquivos:**
- Criar: `src/ui/PendentesResumo.tsx`
- Modificar: `src/styles.css`, `docs/estilo/catalogo.md`
- Testar: `src/ui/PendentesResumo.test.tsx`

**Interfaces:**
- Produz: componente padrão `PendentesResumo` com as propriedades `{ fila: Lancamento[]; categorias: Categoria[]; boxes: Box[]; mostrarBox: boolean; onConfirmar: (l: Lancamento) => void; onVerTodos: () => void }`.
- Produz: classes `.pendente-linha`, `.botao-confirmar-curto`.

- [ ] **Passo 1: escreva os testes que falham**

```tsx
// src/ui/PendentesResumo.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { Box, Categoria, Lancamento } from '../domain/types';
import PendentesResumo from './PendentesResumo';

const AGORA = '2026-07-01T00:00:00.000Z';
const boxes: Box[] = [{ id: 'b1', nome: 'carteira', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: AGORA, alteradoEm: AGORA }];
const categorias = [
  { id: 'c1', boxId: 'b1', nome: 'salário', tipo: 'ganho', ordem: 0 },
  { id: 'c2', boxId: 'b1', nome: 'moradia', tipo: 'gasto', ordem: 1 },
  { id: 'c3', boxId: 'b1', nome: 'jardinagem', tipo: 'gasto', ordem: 2 },
] as Categoria[];
const previsto = (id: string, categoriaId: string, data: string, valor: number, nota?: string) => ({
  id, boxId: 'b1', categoriaId, data, valor, nota, status: 'previsto', origem: 'manual', criadoEm: AGORA, alteradoEm: AGORA,
}) as Lancamento;

const tres = [
  previsto('p1', 'c1', '2026-06-29', 650000, 'Pagamento do mês'),
  previsto('p2', 'c2', '2026-06-30', 185000, 'Aluguel'),
  previsto('p3', 'c3', '2026-07-01', 11990),
];

function montar(fila: Lancamento[], mostrarBox = false) {
  const onConfirmar = vi.fn();
  const onVerTodos = vi.fn();
  render(
    <PendentesResumo
      fila={fila} categorias={categorias} boxes={boxes} mostrarBox={mostrarBox}
      onConfirmar={onConfirmar} onVerTodos={onVerTodos}
    />,
  );
  return { onConfirmar, onVerTodos };
}

it('fila vazia não mostra nada', () => {
  const { container } = render(
    <PendentesResumo fila={[]} categorias={categorias} boxes={boxes} mostrarBox={false} onConfirmar={vi.fn()} onVerTodos={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('mostra a contagem total e só os dois primeiros da fila', () => {
  montar(tres);
  expect(screen.getByText('Para confirmar · 3')).toBeInTheDocument();
  expect(screen.getByText('salário')).toBeInTheDocument();
  expect(screen.getByText('moradia')).toBeInTheDocument();
  expect(screen.queryByText('jardinagem')).not.toBeInTheDocument();
});

it('mostra data em formato brasileiro e a nota', () => {
  montar(tres);
  expect(screen.getByText('29/06/2026 · Pagamento do mês')).toBeInTheDocument();
});

it('com um ou dois pendentes não mostra "Ver os N"', () => {
  montar(tres.slice(0, 2));
  expect(screen.getByText('Para confirmar · 2')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Ver os/ })).not.toBeInTheDocument();
});

it('com mais de dois, "Ver os N" chama onVerTodos', async () => {
  const { onVerTodos } = montar(tres);
  await userEvent.click(screen.getByRole('button', { name: 'Ver os 3 →' }));
  expect(onVerTodos).toHaveBeenCalledOnce();
});

it('o ✓ confirma o pendente da própria linha', async () => {
  const { onConfirmar } = montar(tres);
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar moradia' }));
  expect(onConfirmar).toHaveBeenCalledOnce();
  expect(onConfirmar).toHaveBeenCalledWith(tres[1]);
});

it('ganho usa a classe de entrada e gasto a de saída, como a fila de Pendentes', () => {
  montar(tres);
  expect(screen.getByText(/6\.500,00/)).toHaveClass('valor-ganho');
  expect(screen.getByText(/1\.850,00/)).toHaveClass('valor-gasto');
});

it('na visão casa mostra o selo da box', () => {
  montar(tres, true);
  expect(screen.getAllByText('carteira').length).toBeGreaterThan(0);
});
```

Recalcule: 650000 centavos são seis mil e quinhentos reais; 185000 são mil oitocentos e cinquenta. As duas expressões do teste casam com o texto formatado desses valores. O teste é um arquivo `*.test.tsx`: o verificador de dados reais não aplica o padrão genérico de moeda nele.

Confira em `src/ui/SeloBox.tsx` como o selo escreve o nome da box. Se ele abrevia ou usa inicial, ajuste a última asserção para o texto que ele realmente mostra.

- [ ] **Passo 2:** rode `npx vitest run src/ui/PendentesResumo.test.tsx`. Esperado: falha, o componente não existe.

- [ ] **Passo 3: componente**

```tsx
// src/ui/PendentesResumo.tsx
import { formatarDataBR } from '../domain/dates';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import { notaExibivel } from '../domain/notas';
import type { Box, Categoria, Lancamento } from '../domain/types';
import SeloBox from './SeloBox';

/** Quantos pendentes o card mostra; o resto fica a um toque, na pílula Pendentes. */
const MAXIMO = 2;
const TITULO = 'Para confirmar';

interface Props {
  /** A fila de `pendentes()`, já ordenada do mais antigo para o mais novo. */
  fila: Lancamento[];
  categorias: Categoria[];
  boxes: Box[];
  /** Na visão casa, cada linha diz de que box é. */
  mostrarBox: boolean;
  onConfirmar: (l: Lancamento) => void;
  onVerTodos: () => void;
}

// Card da Visão do Hoje: os pendentes mais antigos, com confirmar num toque. Corrigir valor,
// descartar e pagar fatura com outro valor continuam na pílula Pendentes — o card é o atalho
// do caso comum, não uma segunda fila.
export default function PendentesResumo({ fila, categorias, boxes, mostrarBox, onConfirmar, onVerTodos }: Props) {
  if (fila.length === 0) return null;
  const categoria = (id: string) => categorias.find((c) => c.id === id);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="secao">
        <span className="rotulo">{TITULO} · {fila.length}</span>
        {fila.length > MAXIMO && (
          <button type="button" className="acao" onClick={onVerTodos}>Ver os {fila.length} →</button>
        )}
      </div>
      {fila.slice(0, MAXIMO).map((l) => {
        const cat = categoria(l.categoriaId);
        const nome = cat?.nome ?? '?';
        const nota = notaExibivel(l.nota, nome);
        return (
          <div className="pendente-linha" key={l.id}>
            <div className="cresce">
              <div>
                {nome}
                {mostrarBox && <SeloBox boxId={l.boxId} boxes={boxes} />}
                {l.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
              </div>
              <div className="sub">{formatarDataBR(l.data)}{nota ? ` · ${nota}` : ''}</div>
            </div>
            <span className={classeEfeito(efeitoNoSaldo(l.valor, cat?.tipo ?? 'gasto'))}>{formatarBRL(l.valor)}</span>
            <button
              type="button" className="botao botao-primario botao-confirmar-curto"
              aria-label={`Confirmar ${nome}`} onClick={() => onConfirmar(l)}
            >
              ✓
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

Confira três coisas contra o `TelaHoje.tsx` antes de rodar:

1. A fila usa `l.data.split('-').reverse().join('/')`; `formatarDataBR` deve dar o mesmo texto. Se não der, use a mesma expressão da fila: o texto tem de ser idêntico nas duas.
2. `tipoCat` do `TelaHoje` (procure a definição perto da linha 470): se ela tem um valor padrão diferente de `'gasto'`, use o mesmo aqui.
3. A assinatura de `efeitoNoSaldo` e de `notaExibivel` em `src/domain/money.ts` e `src/domain/notas.ts`.

- [ ] **Passo 4: CSS.** No fim de `src/styles.css`:

```css
/* ---- Pendentes à vista (PendentesResumo.tsx) ---- */
.pendente-linha { display: flex; align-items: center; gap: 10px; }
.pendente-linha .cresce { flex: 1; min-width: 0; }
/* ✓ sozinho: largura e altura de alvo de toque, sem o padding do botão de texto */
.botao-confirmar-curto { min-width: 44px; min-height: 44px; padding: 0; }
```

- [ ] **Passo 5: catálogo.** Em `docs/estilo/catalogo.md`, na tabela de classes:

```markdown
| `.pendente-linha` / `.botao-confirmar-curto` | linha de um pendente no card do Hoje (`PendentesResumo.tsx`): nome e data à esquerda, valor e o botão ✓ à direita. `.botao-confirmar-curto` (junto com `.botao.botao-primario`) é o ✓ sem texto, com 44px de largura e de altura |
```

Na lista de componentes:

```markdown
- **`PendentesResumo.tsx`** — card da Visão do Hoje com os dois pendentes mais antigos e confirmar num toque. Some com a fila vazia; "Ver os N" leva à pílula Pendentes. Mostra o pendente com os mesmos textos e cores da fila.
```

- [ ] **Passo 6:** rode `npx vitest run src/ui/PendentesResumo.test.tsx`, `node scripts/verificar-catalogo.mjs`, depois `npm test`. Esperado: 8 testes passam; o verificador não acusa nada; a suíte inteira passa.

- [ ] **Passo 7: commit**

```bash
git add src/ui/PendentesResumo.tsx src/ui/PendentesResumo.test.tsx src/styles.css docs/estilo/catalogo.md
git commit -m "feat(ui): card de pendentes para a Visão do Hoje"
```

---

### Tarefa 3: Card no Hoje

**Arquivos:**
- Modificar: `src/ui/TelaHoje.tsx` (bloco `{abaHoje === 'visao' && (...)}`, a partir da linha 565)
- Testar: `src/ui/TelaHoje.test.tsx`

**Interfaces:**
- Consome: `PendentesResumo` (Tarefa 2); `confirmar(l)` (Tarefa 1); `fila`, `setAbaHoje`, `boxSel`, `dados` (já existem).

- [ ] **Passo 1: escreva os testes que falham**

```tsx
  it('a Visão mostra o card de pendentes acima do saldo', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'moradia', tipo: 'gasto', ordem: 0 });
    await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02', retorno: null });
    render(<TelaHoje />);

    const titulo = await screen.findByText('Para confirmar · 1');
    const saldo = screen.getByText(/Saldo hoje/);
    // o card vem antes do saldo no documento
    expect(titulo.compareDocumentPosition(saldo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('confirmar pelo card tira o item, atualiza a pílula e some com o card', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'moradia', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02', retorno: null });
    render(<TelaHoje />);

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar moradia' }));

    await waitFor(() => expect(screen.queryByText(/Para confirmar/)).not.toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Pendentes · 0' })).toBeInTheDocument();
    expect((await db.lancamentos.get(previsto.id))!.status).toBe('efetivo');
    expect(useApp.getState().retorno!.texto).toBe('Confirmado: moradia');
  });

  it('sem pendentes a Visão não mostra o card', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    await repo.salvarCategoria({ boxId: box.id, nome: 'moradia', tipo: 'gasto', ordem: 0 });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
    render(<TelaHoje />);

    await screen.findByText(/Saldo hoje/);
    expect(screen.queryByText(/Para confirmar/)).not.toBeInTheDocument();
  });

  it('"Ver os N" troca para a pílula Pendentes', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'moradia', tipo: 'gasto', ordem: 0 });
    for (const data of ['2026-06-29', '2026-06-30', '2026-07-01']) {
      await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data, valor: 50000, status: 'previsto' });
    }
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
    render(<TelaHoje />);

    await userEvent.click(await screen.findByRole('button', { name: 'Ver os 3 →' }));

    expect(screen.getByRole('tab', { name: 'Pendentes · 3' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('button', { name: 'Descartar' })).toHaveLength(3);
  });

  it('previsto além de 3 dias não entra no card', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'carteira', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'moradia', tipo: 'gasto', ordem: 0 });
    await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-06', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
    render(<TelaHoje />);

    await screen.findByText(/Saldo hoje/);
    expect(screen.queryByText(/Para confirmar/)).not.toBeInTheDocument();
  });
```

Recalculado: com `hoje` em 2026-07-02 e antecedência de 3 dias, o limite é 2026-07-05. O previsto de 2026-07-06 fica de fora; os de 29/06, 30/06 e 01/07 entram.

No primeiro e no quarto teste, a categoria precisa existir para a Visão não mostrar o `PrimeiroUso` no lugar do saldo. Se `/Saldo hoje/` não aparecer, é isso: confira `estadoPrimeiroUso` no store.

- [ ] **Passo 2:** rode `npx vitest run src/ui/TelaHoje.test.tsx`. Esperado: os cinco falham.

- [ ] **Passo 3: implemente.** Importe o componente:

```tsx
import PendentesResumo from './PendentesResumo';
```

No bloco da Visão, o card entra antes da escolha entre `PrimeiroUso` e o saldo. Troque:

```tsx
      {abaHoje === 'visao' && (
        primeiroUso ? (
```

por:

```tsx
      {/* Antes do saldo, e também no primeiro uso: um pendente (uma fatura, por exemplo) pode
          existir antes de as categorias estarem cadastradas, e precisa ficar à vista. */}
      {abaHoje === 'visao' && (
        <PendentesResumo
          fila={fila} categorias={dados.categorias} boxes={dados.boxes} mostrarBox={boxSel === 'casa'}
          onConfirmar={confirmar} onVerTodos={() => setAbaHoje('pendentes')}
        />
      )}
      {abaHoje === 'visao' && (
        primeiroUso ? (
```

- [ ] **Passo 4:** rode `npx vitest run src/ui/TelaHoje.test.tsx`, depois `npm test`. Esperado: tudo passa. Um teste antigo que clicava em `getByRole('button', { name: /Confirmar/ })` na Visão pode agora achar o ✓ do card: se o Testing Library reclamar de mais de um elemento, o teste antigo passa a ir primeiro à pílula Pendentes, ou usa o nome exato do botão.

- [ ] **Passo 5: commit**

```bash
git add src/ui/TelaHoje.tsx src/ui/TelaHoje.test.tsx
git commit -m "feat(hoje): pendentes à vista na Visão, acima do saldo"
```

---

### Tarefa 4: Wiki, changelog, dossiê e varredura

**Arquivos:**
- Modificar: `docs/wiki/6-telas.md` (linhas 13 a 17)
- Criar: `changelog.d/adicionado-pendentes-a-vista.md`

- [ ] **Passo 1: wiki.** No item da Visão (procure "**Visão:**" perto da linha 15), acrescente no começo: "Quando há previstos para confirmar, um card no topo mostra os dois mais antigos, com o botão ✓ para confirmar num toque e, se houver mais, um atalho para a aba Pendentes." No item de Pendentes (linha 17), acrescente: "Confirmar mostra um aviso com Desfazer por alguns segundos; fatura de cartão não tem Desfazer." Valide: `npx vitest run src/ui/ajustes/capitulos.test.ts`.

- [ ] **Passo 2: fragmento.**

```markdown
- Pendentes à vista no Hoje: um card acima do saldo mostra os dois previstos mais antigos.
  - O botão ✓ confirma num toque; "Ver os N" leva à aba Pendentes.
- Confirmar um pendente agora tem Desfazer por alguns segundos.
```

- [ ] **Passo 3: dossiê.** `npm run dossie`; commite se mudou e invoque `revisar-dossie`.

- [ ] **Passo 4: varredura.** Arquivo de passos, na pasta de rascunho:

```js
// passos-e.mjs
export const passos = [
  { nome: 'e-hoje-com-card', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula('Visão'); } },
  { nome: 'e-confirmado', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula('Visão'); await p.locator('.pendente-linha button').first().click(); await p.getByText(/^Confirmado: /).waitFor(); } },
  { nome: 'e-ver-todos', ir: async (p, a) => { await a.aba('Hoje'); await a.pilula('Visão'); await p.getByRole('button', { name: /^Ver os/ }).click(); } },
];
```

Rode: `node <worktree>/scripts/varredura/varredura.mjs http://localhost:5199/ --extra passos-e.mjs`
Esperado: código de saída 0. A semente do roteiro tem quatro previstos na fila; depois de confirmar um, sobram três, e "Ver os 3" ainda aparece.

Confira nas capturas, contra o mockup aprovado: o card vem antes do saldo; os dois valores terminam na mesma linha vertical; o ✓ tem 44 px; o aviso não cobre a barra. Fotografe também a visão casa (seletor de box em "casa"), para ver o selo da box na linha. Envie as capturas ao usuário.

- [ ] **Passo 5: commit**

```bash
git add docs/wiki/6-telas.md changelog.d/adicionado-pendentes-a-vista.md docs/dossie
git commit -m "docs: pendentes à vista na wiki e no changelog"
```

---

## Encerramento

- [ ] `npm test` inteiro verde; `node scripts/verificar-catalogo.mjs --strict` com saída 0.
- [ ] Fragmento mostrado ao usuário.
- [ ] `TODO.md`: o item "Pendentes à vista no Hoje" sai para o `TODO-CONCLUIDOS.md`.
- [ ] Skill `ciclo-de-entrega`: merge, release `minor`, push, deploy.
- [ ] `git -C <checkout principal> status --porcelain` vazio.

## Fora do escopo

- Corrigir valor, descartar e "Paguei outro valor" dentro do card: continuam só na pílula Pendentes.
- Desfazer da confirmação de fatura.
- Mudar a antecedência de 3 dias ou a ordem da fila.
