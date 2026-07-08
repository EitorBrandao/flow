# Ponto de entrada único "+" — popup Lançamento / Compra no cartão

**Data:** 2026-07-08
**Status:** aprovado em brainstorming (mockup interativo validado pelo usuário)
**Mockup de referência:** `mockup-cartao.html` (scratchpad da sessão; Artifact publicado durante o brainstorming)

## Objetivo

Hoje existem dois pontos de entrada desencontrados para "adicionar algo": o FAB "+" central
da tab bar (sempre visível, abre a aba Lançar) e um botão "+ compra" por cartão na aba Cartão
(abre um formulário inline no rodapé daquele card). Este spec consolida os dois num único
ponto de entrada — o FAB "+" — que abre um popup deixando escolher entre lançamento comum e
compra no cartão. Também ajusta a apresentação da fatura: lançamentos escondidos por padrão
(só cabeçalho visível) e, quando expandidos, agrupados em "À vista" / "Parceladas".

**Sem mudança de comportamento em `domain/`, `db/`, `state/`, `importer/`, `backup/`** — só
`src/ui/**`.

## Decisões (validadas com o usuário)

1. **Um único "+":** o FAB central da tab bar (visível em toda aba) passa a abrir um popup em
   vez de navegar direto pra Lançar. O botão "+ compra" por cartão e qualquer "+" no topo da
   aba Cartão são removidos.
2. **Popup = `Sheet` existente** (sobe do fundo, já usado no `LancEditor`) — não um componente
   novo ancorado ao botão. Prioriza consistência visual sobre a fidelidade literal ao "nasce do
   botão".
3. **Passo 1 — menu:** duas opções, "Lançamento" e "Compra no cartão".
   - **Lançamento:** fecha o Sheet e navega para a aba Lançar (`setAba('lancar')`) — sem
     nenhuma mudança na `TelaLancar` em si.
   - **Compra no cartão:** ramifica pela quantidade de cartões ativos da seleção atual
     (`boxSel`):
     - **0 cartões:** passo de aviso — "Nenhum cartão cadastrado" + botão que leva a Ajustes
       para cadastrar um.
     - **1 cartão:** pula direto para o formulário, já vinculado a esse cartão.
     - **2+ cartões:** passo intermediário "Compra em qual cartão?" (lista os cartões ativos)
       antes do formulário.
4. **Formulário de compra (`FormCompra`)** é o mesmo já existente (valor, data, categoria,
   parcelas, parcelas já pagas, descrição) — reaproveitado sem mudança de campos ou validação,
   tanto para criar quanto para editar. Passa a viver sempre dentro de um `Sheet`: perde o
   `<div className="card"><h3>...` que hoje o envolve (o `Sheet` já é a superfície) e usa
   `<h2>` para o título, como o `LancEditor` já faz.
5. **Editar uma compra existente** (tocar um item da fatura) também passa a abrir em `Sheet`
   — hoje é inline no rodapé do card. Elimina o padrão duplicado (inline vs. popup) para o
   mesmo formulário.
6. **Fatura por padrão mostra só o cabeçalho** (nav de mês, saldo da fatura, fecha/vence) —
   a lista de lançamentos fica escondida atrás de um botão "Ver lançamentos" (texto azul,
   seta que gira ao abrir; vira "Ocultar lançamentos" quando expandida).
7. **Lançamentos agrupados e ordenados:** ao expandir, os itens aparecem em duas seções com
   rótulo maiúsculo pequeno (mesmo estilo de `.rotulo`) — **"À vista"** primeiro, depois
   **"Parceladas"** — cada seção ordenada com os mais recentes primeiro. Se a fatura só tem
   itens de um dos dois tipos, mostra a lista simples sem rótulos de grupo (caso de hoje).

## Componentes afetados

### Novo: `AdicionarSheet` (`src/ui/AdicionarSheet.tsx`)

Componente novo, montado uma vez em `Shell.tsx` (não em `TelaCartao`), porque o FAB que o
aciona é parte do casco fixo, visível em qualquer aba — o popup precisa da lista de cartões
ativos independente de qual aba está aberta no momento.

- Props: `aberto: boolean` + `onFechar: () => void` — `Shell` guarda só esse booleano (mesmo
  padrão do `Sheet`/`LancEditor`: pai controla abrir/fechar, filho controla o formulário).
- Estado interno: `passo: 'menu' | 'sem-cartao' | 'escolher-cartao' | 'form'` +
  `cartaoEscolhido: Cartao | null`. Reseta para `'menu'` e `cartaoEscolhido = null` sempre que
  `aberto` volta a `false`.
- Chama `useApp()` diretamente para obter `dados`, `boxSel`, `setAba` — deriva a lista de
  cartões ativos da seleção atual com a mesma lógica já usada em `TelaCartao`
  (`boxIdsSelecionadas` + `c.ativo`).
- Renderiza um único `<Sheet>` cujo conteúdo muda por passo; `rotulo` do Sheet muda por passo
  para acessibilidade (ex.: "Adicionar", "Compra em qual cartão?", "Nova compra").
- No passo `'form'`, renderiza `<FormCompra cartao={cartaoEscolhido} onFechar={fecharTudo} />`
  (modo criação, sem prop `compra`).

### Extraído: `FormCompra` (`src/ui/FormCompra.tsx`)

Hoje `FormCompra` é uma função privada dentro de `TelaCartao.tsx`. Passa a ser exportado num
arquivo próprio porque agora tem dois consumidores (`AdicionarSheet`, para criar, e
`CartaoFatura`, para editar) — extrair evita que `Shell`/`AdicionarSheet` importe um detalhe
interno de `TelaCartao`. Mesmas props e lógica de hoje (`cartao`, `compra?`, `onFechar`);
só muda o wrapper visual (item 4 acima).

### `Shell.tsx`

- Novo estado local `menuAberto: boolean` (só isso — o resto do fluxo é interno ao
  `AdicionarSheet`).
- Botão `.central` da nav: `onClick` troca de `() => setAba('lancar')` para
  `() => setMenuAberto(true)`.
- Monta `<AdicionarSheet aberto={menuAberto} onFechar={() => setMenuAberto(false)} />` uma vez,
  fora da troca de abas (visível/disponível em qualquer aba).

### `TelaCartao.tsx` / `CartaoFatura`

- Remove o estado `formAberto` e o botão "+ compra" (criação não é mais responsabilidade
  daqui).
- Mantém o estado `editando`; ao invés de renderizar `FormCompra` inline, renderiza
  `<Sheet aberto={!!editando} onFechar={...} rotulo="Editar compra"><FormCompra cartao={cartao} compra={editando} onFechar={...} /></Sheet>`.
- `fatura.itens`: passa a ser dividido em dois grupos (`totalParcelas === 1` → "À vista";
  `totalParcelas > 1` → "Parceladas"), cada grupo ordenado por `data` decrescente. Lista
  inteira escondida atrás do novo botão "Ver lançamentos" (estado local `mostrarLista`,
  por card).

## Testes

- `TelaCartao.test.tsx`: remove os testes do fluxo "+ compra" inline (não existe mais);
  adiciona testes de edição abrindo em Sheet, e do agrupamento/ordenação dos itens da fatura
  e do toggle "Ver lançamentos".
- Novo `AdicionarSheet.test.tsx`: cobre os 4 ramos (Lançamento; Compra com 0/1/2+ cartões).
- `Shell.tsx` não tem teste hoje; se fizer sentido durante a implementação, um teste mínimo
  verificando que o FAB abre o popup em vez de trocar de aba diretamente.

## Critérios de sucesso

1. `npm run test` verde.
2. `npm run build` sem erros.
3. Fluxo conferido no celular via `npm run preview -- --host`: FAB abre o popup em qualquer
   aba; os 3 cenários de quantidade de cartões funcionam; editar compra abre em Sheet; fatura
   colapsada por padrão com agrupamento correto ao expandir.

## Fora de escopo

- Mudar o formulário `FormCompra` em si (campos, validação, parcelas).
- Mudar a aba Lançar (`TelaLancar`) — só o caminho de navegação até ela muda.
- Popup ancorado visualmente ao botão (nasce do fundo da tela, como o `Sheet` já faz hoje).
- Editar Ajustes/cadastro de cartão em si — o botão do passo "sem cartão" só navega pra lá.
