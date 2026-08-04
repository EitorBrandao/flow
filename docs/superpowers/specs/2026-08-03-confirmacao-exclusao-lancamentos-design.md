# Confirmação ao excluir/descartar lançamentos

## Problema

Excluir ou descartar um lançamento é a única ação destrutiva do app que não pede
confirmação. Todo o resto (recorrência, assinatura, viagem, compra de cartão, cenário)
já usa `window.confirm(...)` antes de apagar. Faltam dois pontos:

- `src/ui/LancEditor.tsx`, botão "Excluir" — apaga o lançamento (efetivo ou previsto)
  sem perguntar.
- `src/ui/TelaHoje.tsx`, botão "Descartar" da fila de pendentes — apaga o previsto sem
  perguntar.

## Solução

Seguir o padrão já estabelecido no repositório: `window.confirm(mensagem)` antes da
chamada a `repo.excluirLancamento`. Sem modal customizado, sem novo componente — é o
mesmo idioma usado em `Recorrencias.tsx`, `Assinaturas.tsx`, `Viagens.tsx`,
`FormCompra.tsx` e `TelaSimulador.tsx`.

### `LancEditor.tsx`

```js
async function excluir() {
  const msg = lanc.status === 'previsto' ? 'Excluir este previsto?' : 'Excluir este lançamento?';
  if (!window.confirm(msg)) return;
  await repo.excluirLancamento(lanc.id);
  await recarregar();
  onFechar();
}
```

### `TelaHoje.tsx`

```js
async function descartar(id: string) {
  if (!window.confirm('Descartar este previsto?')) return;
  await repo.excluirLancamento(id);
  await recarregar();
}
```

## Fora de escopo

- Comportamento de recorrência: um previsto de recorrência ativa pode ser recriado na
  próxima materialização — isso já existe hoje (`recurrence.ts`) e não muda. A tela já
  avisa disso separadamente ("edite a regra em Ajustes"); o texto do `confirm` não repete
  o aviso.
- Os botões de exclusão de recorrência, assinatura, viagem, compra de cartão e cenário
  já confirmam — não há mudança ali. Exceção conhecida, fora do escopo desta mudança:
  "Remover" conferência de fatura (`TelaCartao.tsx`, função `remover`) ainda apaga sem
  perguntar — é um registro de reconciliação redigitável, não um lançamento.
- Não é edição de UI visual (nenhuma classe/componente/token novo), então não aciona
  `docs/estilo-visual.md` nem o catálogo.

## Testes

TDD, seguindo o padrão de `vi.spyOn(window, 'confirm')` já usado em
`TelaCartao.test.tsx` e `Viagens.test.tsx`:

- `LancEditor.test.tsx`: clicar em "Excluir" chama `window.confirm`; se retornar `false`,
  o lançamento permanece (não chama `excluirLancamento`/`onFechar`); se retornar `true`,
  exclui normalmente.
- `TelaHoje.test.tsx`: clicar em "Descartar" chama `window.confirm`; `false` mantém o
  pendente na lista; `true` remove.
