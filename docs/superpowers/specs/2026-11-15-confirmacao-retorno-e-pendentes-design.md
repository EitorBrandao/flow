# Confirmação própria, retorno ao salvar e pendentes à vista — desenho

**Data:** 2026-11-15
**Origem:** revisão de 2026-11-15, itens U1, U2, U3, D5 e V2.
**Mockup:** aprovado pelo usuário em 2026-11-15, pelo chat, depois de dois ajustes nos botões do editor. O mockup usou o CSS real do app e dados sintéticos.
**Planos:** `2026-11-15-d1-confirmacao-propria.md`, `2026-11-15-d2-retorno-ao-salvar.md`, `2026-11-15-e-pendentes-a-vista.md`.

## Problema

1. O app pede confirmação com o diálogo nativo do navegador (`window.confirm`), em 13 pontos. O diálogo não segue o visual do app, não mostra o que vai ser apagado, e aparece igual para um descarte simples e para uma substituição de todos os dados.
2. Quase nenhum salvar dá retorno. O usuário toca em Salvar, o sheet fecha, e nada diz se gravou. Só quatro pontos avisam.
3. No editor de lançamento, a ação principal não se destaca: Salvar e Fechar são cinza, e o único botão com cor é Excluir.
4. Os pendentes ficam atrás de uma pílula. Quem abre o Hoje vê o saldo e o gráfico, e só descobre que há o que confirmar se ler o número da pílula.
5. O guia de estilo não tem um capítulo de interação. Cada tela resolveu confirmação e retorno do seu jeito.

## Decisões do usuário

| Tema | Decisão |
|---|---|
| Confirmação de exclusão | Exclusão simples apaga na hora e mostra "Desfazer". O que apaga em cascata pede confirmação num sheet. |
| Aviso de retorno | Pílula acima da barra de navegação, no lugar e no formato do aviso de atualização. |
| Sheet de confirmação | Título em pergunta, resumo do item, uma frase de efeito, dois botões. |
| Botões do editor | Excluir à esquerda, em vermelho. À direita: Fechar com contorno e sem fundo, Salvar cinza, Confirmar azul. Sem Confirmar, Salvar é o azul. |
| Pendentes no Hoje | Card com os dois mais antigos e confirmar num toque, acima do saldo. |
| Entregas | D em duas: primeiro a confirmação própria, depois o retorno em todo salvar. E depois. |

## Regras de interação

Estas regras viram o capítulo `docs/estilo/interacao.md`, criado no plano D1 e aplicado às demais telas no plano D2.

1. **O app nunca usa `window.confirm`, `window.alert` nem `window.prompt`.** Um teste bloqueia.
2. **Exclusão simples: apaga na hora, com "Desfazer".** É simples quando apaga um registro só e o registro pode voltar idêntico. Hoje são três casos: excluir lançamento ou previsto pelo editor, descartar um pendente, e excluir um item de cenário que não se repete.
3. **Exclusão em cascata ou irreversível: sheet de confirmação.** Vale para tudo que apaga mais de um registro, muda outros registros, ou não tem volta.
4. **Toda gravação dá retorno.** Uma frase curta, no passado, sem ponto final: "Alteração salva", "Categoria criada".
5. **Um nível de destaque por papel.** Numa linha de botões há no máximo um azul, que é a ação que o usuário veio fazer. A ação que só sai da tela (Fechar, Cancelar) tem contorno e não tem fundo. A ação destrutiva fica à esquerda, longe da principal.
6. **O retorno não substitui o aviso de validação.** Erro de preenchimento continua abaixo do botão, em `.aviso`.

## Componentes novos

### `Retorno` (plano D1)

- Estado no store único: `retorno: { id, texto, desfazer? } | null`, com `avisar(texto, desfazer?)` e `limparRetorno()`.
- Componente `src/ui/Retorno.tsx`, montado uma vez no `Shell`, em portal no `body`.
- Some sozinho: 3 s sem "Desfazer", 6 s com "Desfazer".
- Um retorno novo substitui o anterior. O "Desfazer" do anterior deixa de existir: é o comportamento esperado, e o texto do capítulo de interação diz isso.
- "Desfazer" roda a função recebida, recarrega os dados e fecha o retorno.
- Fica acima dos sheets (`z-index` 60). O aviso de atualização usa a mesma faixa por 2 s na primeira abertura depois de atualizar; se os dois coincidirem, o retorno cobre o aviso.

### `ConfirmarSheet` (plano D1)

- `src/ui/ConfirmarSheet.tsx`, em portal no `body`, sobre o `Sheet` que já existe.
- Propriedades: `titulo`, `resumo` (opcional, o item em questão), `apoio` (opcional, a frase de efeito), `rotuloConfirmar`, `perigo` (vermelho cheio quando apaga; azul quando só converte ou mescla), `onCancelar`, `onConfirmar`.
- `ConfirmarRepetidoSheet` continua existindo. Ele só troca o botão Cancelar para o contorno, para as duas confirmações ficarem iguais.

### `PendentesResumo` (plano E)

- `src/ui/PendentesResumo.tsx`: card do Hoje com os dois pendentes mais antigos.
- Some quando a fila está vazia.
- "Ver os N" aparece quando há mais de dois, e leva à pílula Pendentes.

## Classes novas

| Classe | Para quê | Plano |
|---|---|---|
| `.retorno-pista`, `.retorno`, `.retorno-acao` | faixa, pílula e ação do aviso de retorno | D1 |
| `.botao-discreto` | modificador de `.botao`: contorno por dentro, sem fundo, para a ação que só sai da tela | D1 |
| `.botao-perigo-cheio` | modificador de `.botao`: fundo vermelho, só dentro do sheet de confirmação | D1 |
| `.sheet-botoes` (+ `.empurra`) | rodapé de botões de um sheet: destrutivo à esquerda, o resto à direita | D1 |
| `.pendente-linha`, `.botao-confirmar-curto` | linha de pendente do card e o botão ✓ com alvo de 44 px | E |

Todas usam só tokens que já existem. O texto do botão vermelho cheio usa `var(--bg)`, porque o guia só admite cor escrita à mão no branco sobre azul. No mockup esse texto era um quase-preto; a diferença não se vê.

O contorno do `.botao-discreto` é uma novidade de linguagem: nenhum botão do app tinha contorno. O usuário pediu assim. O capítulo de interação registra a regra, e o catálogo registra a classe.

## Os 13 pontos de `window.confirm`

| Onde | Ação | Passa a ser |
|---|---|---|
| `LancEditor.tsx:51` | excluir lançamento ou previsto | na hora, com Desfazer |
| `TelaHoje.tsx:545` | descartar previsto | na hora, com Desfazer |
| `ItemCenarioSheet.tsx:48` | excluir item do cenário | "uma vez": na hora, com Desfazer. Com repetição: sheet |
| `TransferenciaSheet.tsx:27` | excluir transferência (dois lançamentos) | sheet, perigo |
| `FormCompra.tsx:215` | excluir compra e parcelas | sheet, perigo |
| `CartaoSimples.tsx:84` | remover o valor informado da fatura | sheet, perigo |
| `CenarioCard.tsx:47` | tornar o cenário real | sheet, azul |
| `CenarioCard.tsx:52` | excluir cenário e itens | sheet, perigo |
| `ajustes/Bancos.tsx:107` | excluir banco | sheet, perigo |
| `ajustes/Recorrencias.tsx:195` | excluir recorrência e previstos | sheet, perigo |
| `ajustes/Assinaturas.tsx:164` | excluir assinatura e compras futuras | sheet, perigo |
| `ajustes/Viagens.tsx:103` | excluir viagem | sheet, perigo |
| `ajustes/Backup.tsx:57` | restaurar backup | sheet; "Substituir" é perigo, "Mesclar" é azul |

Os textos de hoje se dividem: a pergunta vira o título, e a explicação vira a frase de apoio. Nenhuma informação se perde.

## Desfazer: o que volta

- **Exclusão de lançamento:** o registro inteiro volta, com o mesmo `id`, por uma função nova do repositório, `restaurarLancamento`. Ela recusa lançamento efetivo de cenário, como as outras gravações.
- **Confirmação de pendente (plano E):** o lançamento volta a `previsto`, com o valor e a data de antes. Fatura de cartão confirmada **não** oferece Desfazer nesta entrega: o pagamento de fatura mexe em mais de um registro, e desfazer isso pede um desenho próprio.
- O Desfazer vale enquanto o aviso está na tela. Depois disso, o caminho é o de sempre: editar ou lançar de novo.

## Pontos de chamada

Exigência do `CLAUDE.md` para plano que muda fluxo de dados.

- `repo.excluirLancamento`: `LancEditor.tsx:52`, `TelaHoje.tsx:546`, `ItemCenarioSheet.tsx:49`, `importar/aplicar.ts:124`. Os três primeiros ganham Desfazer. A importação não muda: ela já mostra a conferência inteira antes de gravar.
- `repo.confirmarPendente`: `TelaHoje.tsx:536` e `:541`, `CartaoSimples.tsx:97`, `importar/aplicar.ts:83` e `:90`, `dossie/roteiro.ts:205` e `:216`. Só os dois do `TelaHoje` ganham Desfazer.
- `repo.restaurarLancamento` é nova. Só a UI a chama, e só de dentro de um Desfazer.
- Backup, exportação e mesclagem não mudam.

## Fora do escopo

- Desfazer do pagamento de fatura, de transferência e de qualquer exclusão em cascata.
- Histórico de ações ou Desfazer depois que o aviso some.
- Trocar os avisos de validação de lugar.
- Os outros achados da varredura (V1, V3 a V14).

## Decisões do usuário depois do mockup (2026-11-16)

Estes três pontos divergem do mockup aprovado. O usuário aprovou cada um no chat.

1. **Cancelar do sheet de confirmação: com contorno.** O mockup mostrava Cancelar cinza. Todo Fechar e Cancelar que divide a linha com a ação principal usa o mesmo contorno (`.botao-discreto`).
2. **Título do card de pendentes: "Pendentes · N".** É o mesmo texto da pílula da mesma tela. A regra de consistência do projeto pede o mesmo texto para o mesmo conceito.
3. **Texto do aviso ao confirmar: "Confirmado: <categoria>".** A forma do mockup ficava errada com categoria no feminino.
