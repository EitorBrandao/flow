# Consistência entre telas — parte 3: formulários de Ajustes e textos

Status: aprovada em 2026-09-23 — não implementada

Item 26 do `TODO.md`, itens 9 a 13 e "menores" da auditoria de consistência de 2026-09-23,
mais os restos da parte 2 (item 25). Duas entregas, cada uma com mockup e release próprios:

- **Entrega A** — o padrão de formulário nas oito subtelas de Ajustes que cadastram coisas:
  Boxes, Bancos, Categorias, Categorias do cartão, Cartões, Recorrências, Assinaturas e
  Viagens.
- **Entrega B** — textos, pílulas e detalhes menores.

Regra que motiva tudo (`CLAUDE.md`): o mesmo conceito aparece do mesmo jeito em toda tela.

## Entrega A — o padrão de formulário de Ajustes

Decisões tomadas com o usuário em 2026-09-23.

1. **Título da tela.** Toda subtela abre com o próprio `h2` ("Cartões", "Viagens"…). Cartões
   hoje não tem.
2. **Criar no topo.** O formulário de criação fica no topo, com `h2` "Nova …"/"Novo …", antes
   da lista. Boxes hoje o põe depois da lista (contra `docs/estilo/nivel-5-nova-tela.md`,
   regra 3).
3. **Editar na própria linha.** O botão de editar é o ícone de lápis (`Pencil` do
   `lucide-react`, `aria-label="Editar"`), em `.botao`. Tocar nele abre os campos **dentro do
   item da lista** (`.item.item-coluna`), com Cancelar e Salvar. O formulário do topo serve
   só para criar.
   - As telas com muitos campos (Cartões, Recorrências, Assinaturas, Viagens) usam no item
     aberto o mesmo formulário da criação: cada tela extrai um componente local de campos
     (ex.: `FormViagem`), usado nos dois lugares.
   - Boxes perde o editor sempre aberto (`EditorBox` dentro de cada card): passa a abrir pelo
     lápis, como as outras.
   - Um item aberto por vez: abrir outro fecha o anterior sem salvar.
4. **Enquanto um item está aberto, o formulário de criação some.** Consequência da regra 6 de
   `nivel-5-nova-tela.md` ("no máximo uma ação principal azul por tela"): o Salvar do item
   aberto é o primário da tela nesse momento. Cancelar ou Salvar traz o formulário de volta.
5. **Botões.** Um único primário por formulário: a ação principal (Criar ou Salvar). Cancelar
   e as demais ações são `.botao` comum. Os botões do formulário ficam numa `.linha`
   própria, alinhados à direita, na ordem **Cancelar, Salvar** (primário por último). O
   formulário de criação não tem Cancelar. Assinaturas hoje empilha os botões em largura
   cheia; Categorias hoje põe Salvar antes de Cancelar.
6. **Registro.** O padrão entra em `docs/estilo/nivel-5-nova-tela.md`, seção "Integração",
   junto da regra 10 (formulário inline), para as próximas subtelas nascerem nele.

Fora da entrega A: os textos dos botões de liga/desliga, títulos de grupo e o controle de
escolha (entrega B).

### O que não muda

- As regras de negócio de cada tela (validações, avisos, `viagensSobrepoem`, horizonte das
  recorrências e dos cartões). Salvar pelo item aberto chama o mesmo `repo.*` que o
  formulário do topo chamava ao editar.
- Reordenar categorias por arraste (a alça continua na linha fechada).
- Os outros botões da linha fechada (Excluir, Arquivar, Desativar, Bloquear, Tornar padrão).

## Entrega B — textos, pílulas e detalhes

1. **Escolha entre poucas opções: `.pills`.** Gasto/Ganho em Lançar e em Recorrências, e o
   tipo em Categorias (hoje `<select>`), passam a usar `.pills`, com `role="radiogroup"` e
   `aria-checked` — como as pílulas de Box e Cartão.
2. **Liga/desliga:** "Desativar" / "Ativar" em Recorrências, Assinaturas e Cartões (hoje
   Recorrências e Assinaturas dizem "Pausar").
3. **Título de grupo:** "Nesta box" em Recorrências, Assinaturas, Cartões e Bancos (hoje
   "Nesta box", "Cadastrados nesta box", "Bancos desta box"). Viagens, que não dependem de
   box, ganham "Cadastradas".
4. **"Arquivados" → "Arquivadas"** em Categorias e Categorias do cartão.
5. **`AssinaturasResumoSheet`** segue de fato o padrão da `LancamentosSheet`: título do grupo
   com o recuo e o subtotal, itens com `recuo-2`.
6. **Viagens nas Análises** viram `button.item`, como as listas do Fluxo e do Cartão (hoje
   `div.item` com `onClick`, sem teclado).
7. **Comparativo das Análises:** o cabeçalho da coluna troca `10/2026` por `out/2026` (mês
   abreviado, para caber na coluna).
8. **Wiki, seção Análises:** sai a frase "o detalhamento do cartão ainda não está integrado
   aqui" — a sheet de fatura das Análises já existe.

## Fora de escopo

- A fonte do total da fatura na sheet aberta pelo Fluxo — item 20.
- Reordenar recorrências (item 9) — vem depois da entrega A, que mexe na mesma lista.

## Entrega

Cada entrega: mockup aprovado antes do código; wiki (`docs/wiki/7-ajustes.md` e, na B,
`6-telas.md`); dossiê regenerado; catálogo se houver classe nova; fragmento próprio em
`changelog.d/`.
