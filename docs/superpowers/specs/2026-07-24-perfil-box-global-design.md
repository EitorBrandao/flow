# Sensação de "perfil": box do topo manda em tudo

Status: aprovada em 2026-07-24 — implementada

Data: 2026-07-24

## Contexto

Após corrigir o vazamento pontual em Ajustes → Cartões (lista misturava cartões de todas as
boxes), o usuário pediu um passo além: nenhuma referência ou seleção de outra box deve
aparecer em lugar nenhum do app, com sensação de "perfil" — cada box vê só as suas
recorrências, cartões, categorias etc.

Auditoria do app inteiro (grep por `dados.cartoes`/`dados.categorias`/`dados.categoriasCartao`
em `src/ui/**/*.tsx`) encontrou:

- Hoje/Fluxo/Cartão/Análises/Lançar/Adicionar já filtram corretamente pela box selecionada no
  chip do topo (`boxSel`, via `boxIdsSelecionadas`) — sem vazamento.
- As 5 telas de Ajustes que mexem em entidades por-box (Categorias, Recorrências, Cartões,
  Assinaturas, Categorias do cartão) tinham cada uma **seu próprio seletor de box local**,
  desconectado do chip do topo — introduzido em
  `docs/superpowers/specs/2026-07-22-ajustes-recorrencias-cartoes-design.md`. Isso quebra a
  sensação de perfil: trocar a box lá em cima não muda o que Ajustes mostra.
- `TelaSimulador.tsx` (`FormHipotetico`): o seletor de categoria do lançamento hipotético não
  filtra por box nenhuma — mistura categorias de todas as boxes sem nenhum seletor.

## Decisão

**O chip de box do topo (`Shell.tsx`) passa a ser a única fonte de seleção de box no app.**
As 5 telas de Ajustes citadas perdem seu seletor de box local; usam a mesma seleção global.

Novo helper `boxIdEfetivo(dados, boxSel)` em `src/state/store.ts`, generalizando a lógica que
já existia só em `TelaLancar.tsx`: se `boxSel` não é o sentinela `'casa'`, retorna o próprio
id; se é `'casa'`, resolve pro id da box literal de nome `"casa"` (a box compartilhada, sem
saldo próprio). `TelaLancar.tsx` passa a usar o helper em vez da lógica inline duplicada.

**A box "casa" agora é autocriada** em `iniciar()` (`store.ts`) se ainda não existir — elimina
a necessidade de um fluxo de "primeira vez" e garante que `boxIdEfetivo` quase nunca retorna
`null` na prática. Roda também pra instalações existentes, na próxima vez que abrirem o app.
Mantém-se um aviso defensivo ("crie uma box chamada 'casa'...") pro caso raro de alguém
renomear essa box depois — não existe exclusão de box no app hoje.

Quando o chip está em "casa", as 5 telas de Ajustes operam sobre essa box literal (cartões,
categorias e recorrências "compartilhados" ficam nela) — mesmo padrão que `TelaLancar.tsx` já
usava pra lançamento avulso.

## Mudanças por arquivo

- **`src/state/store.ts`**: `boxIdEfetivo()` novo; `iniciar()` cria a box "casa" se faltar.
- **`src/ui/TelaLancar.tsx`**: usa `boxIdEfetivo` em vez da lógica inline (puro refactor).
- **`src/ui/ajustes/Cartoes.tsx`**: remove o `<select>` "Box do cartão" (form e lista); usa
  `boxIdEfetivo(dados, boxSel)`.
- **`src/ui/ajustes/Categorias.tsx`**: remove o `<select>` de Box; idem.
- **`src/ui/ajustes/Recorrencias.tsx`**: remove o `SeletorPills` de Box; idem.
- **`src/ui/ajustes/Assinaturas.tsx`** e **`CategoriasCartao.tsx`**: removem o `SeletorPills`
  de Box introduzido na sessão anterior; mantêm o `SeletorPills` de Cartão, agora filtrado
  pela box efetiva. `useEffect([boxId])` reresolve o cartão selecionado pro primeiro da nova
  box e limpa o formulário ao trocar via chip do topo — evita salvar num cartão/box errado se
  o usuário trocar o chip no meio de uma edição.
- **`src/ui/TelaSimulador.tsx`** (`FormHipotetico`): seletor de categoria do lançamento
  hipotético passa a filtrar por `boxIdEfetivo`; remove o helper `boxDe()` que ficou
  redundante (a categoria escolhida já pertence à box efetiva por construção).

## Fora de escopo

- **`Boxes.tsx`** continua listando todas as boxes — é a tela que gerencia os próprios
  perfis, não uma tela "de dentro" de um perfil.
- **`Viagens.tsx`** continua global — viagem não tem `boxId` no domínio, por desenho anterior.
- Cenários (`Cenario`) continuam sem `boxId` próprio — o `FormHipotetico` já resolve a box de
  cada lançamento hipotético a partir da categoria escolhida, então o filtro no seletor já
  garante que novos itens vão pra box certa, sem precisar mudar o schema de `Cenario`.

## Testes

Cada tela alterada troca seu teste de "trocar de box" (antes clicava numa pill/`<select>`
local) por `useApp.setState({ boxSel })` + `rerender()`, confirmando que a troca acontece só
pelo chip do topo. Novo teste em `store.test.ts` cobrindo a autocriação da box "casa" (e a
ausência de duplicata quando ela já existe) e o comportamento de `boxIdEfetivo`. Novo teste em
`TelaSimulador.test.tsx` cobrindo o vazamento do seletor de categoria entre boxes.
