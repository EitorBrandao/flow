# Changelog

Histórico de versões do Flow. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/),
com uma seção por versão contendo apenas o que foi **Adicionado**, **Alterado** ou **Removido**.

## [0.36.1] - 2026-09-23

### Alterado

- O gráfico da tela Hoje e do Fluxo mostra o menor saldo real do período em "mín", em vez de R$ 0,00.
  - Vale também para o "máx" quando todo o período fica no negativo.
- Valores negativos aparecem com o mesmo sinal de menos em todas as telas, inclusive a sobra das Análises.
- Os percentuais das Análises usam vírgula decimal, como o resto do app.

## [0.36.0] - 2026-09-23

### Alterado

- A fatura do cartão aparece do mesmo jeito em todas as telas.
  - O cabeçalho mostra o cartão, o mês por nome, o total e as datas de fechamento e vencimento com o ano.
  - O resumo por categoria aparece mesmo quando a fatura tem uma categoria só.
  - Fatura sem gasto mostra o total na cor normal, não em vermelho.
- Análises e Cartão trocam de mês com as mesmas setas, e o mês aparece por nome.

## [0.35.2] - 2026-09-23

### Alterado

- Telas mais consistentes entre si.
  - As sheets do botão "+" (Adicionar, Nova compra, Escanear nota) usam o mesmo tamanho de título das outras sheets.
  - A conferência de saldo em Hoje só diz "Bate certinho" com diferença zero, igual à conferência da fatura: um centavo já aparece como diferença.
  - Datas no formato DD/MM/AAAA em Hoje (conferido em), Recorrências, Assinaturas e Boxes; na tabela Comparativo de Análises, o mês aparece como MM/AAAA.
  - Na lista do Fluxo, o valor de cada lançamento aparece sem "+" nem "−", como nas outras telas; a cor continua dizendo se é ganho ou gasto.

## [0.35.1] - 2026-09-23

### Alterado

- Depois de mesclar um backup, a tela Hoje passa a avisar que há mudanças não salvas em backup.
  - Antes, mesclar marcava tudo como salvo, mesmo com mudanças que nunca foram copiadas.
  - Substituir tudo continua sem aviso: os dados passam a ser exatamente os do arquivo.

## [0.35.0] - 2026-09-23

### Alterado

- A tela Hoje mostra sempre, embaixo do saldo, há quanto tempo foi o último backup.
  - Fica âmbar quando há mudanças sem backup, e vermelho quando o último backup tem 7 dias ou mais, ou nunca foi feito.
  - Tocar leva direto para Ajustes → Backup.
  - Substitui o aviso que só aparecia no topo depois de 7 dias.
- Ajustes → Backup mostra há quanto tempo foi o último backup, com a data e a hora entre parênteses.

## [0.34.0] - 2026-09-23

### Adicionado

- A wiki agora tem links: um toque leva a outro capítulo ou a uma seção dele
  - Termos do glossário ficam com sublinhado pontilhado e mostram a definição logo abaixo, sem sair do capítulo

## [0.33.0] - 2026-09-23

### Alterado

- No Fluxo, filtrar por data mostra o saldo do dia escolhido mesmo quando não há lançamento nele.
  - Num período, aparecem sempre o primeiro e o último dia.
  - Cada dia futuro filtrado mostra a diferença em relação a hoje, em verde ou vermelho.
  - Um dia depois do fim da projeção mostra um traço e até quando a projeção vai, em vez de R$ 0,00.
- Na tela Hoje, a variação dos próximos 28 dias passa a usar sinal (+ ou −) no lugar da seta.

## [0.32.3] - 2026-09-22

### Alterado

- A conferência da fatura do cartão usa as mesmas frases da conferência de saldo: "Diferença:" seguido do valor, "falta inserir no cartão" ou "sobra no cartão", e "Bate certinho." quando fecha.

## [0.32.2] - 2026-09-22

### Alterado

- Na aba Conferência da fatura do cartão, a diferença entre o banco e os itens agora tem cor e sinal.
  - Vermelho e negativo quando falta lançar algum gasto no cartão.
  - Verde e positivo quando os itens somam mais que o banco.

## [0.32.1] - 2026-09-22

### Alterado

- Na aba Conferir da tela Hoje, a diferença entre o banco e o app agora tem cor e sinal.
  - Vermelho e negativo quando falta lançar algo no app.
  - Verde e positivo quando sobra algo no app.

## [0.32.0] - 2026-09-20

### Adicionado

- Conferência por extrato: tocar numa pílula do resumo filtra a lista por aquele estado.
  - Tocar de novo na mesma pílula mostra todos os itens.
  - O botão de confirmar continua aplicando a lista inteira, filtrada ou não.

### Alterado

- Conferência da fatura: o passo de destino mostra só os cartões da box selecionada.
- Conferência da fatura: lançamentos comuns da box não aparecem mais como sobra.
  - A sobra de uma fatura olha só as compras daquele cartão; a de um extrato de conta, só os lançamentos da box.

## [0.31.4] - 2026-09-19

### Alterado

- Conferência por extrato: lançamentos que você já tinha feito à mão passam a ser reconhecidos na fatura, mesmo com descrição diferente da do banco.
  - Compra parcelada já lançada é reconhecida pela parcela da fatura e não aparece mais como nova.
  - A leitura da fatura em PDF considera só o detalhamento das compras: some o cartão repetido da primeira página e caem as linhas ignoradas.
  - Compras do começo do ciclo não recebem mais o aviso de ano incerto.
  - Quando um item casa só por valor e data, com descrição diferente, ele avisa para você conferir se é o mesmo lançamento.

## [0.31.3] - 2026-09-19

### Alterado

- Conferência por extrato: a tela mostra quais linhas do arquivo não foram reconhecidas.
  - O "Copiar texto extraído" aparece sempre que alguma linha fica de fora ou nada é reconhecido.
  - Compra parcelada antiga na fatura não faz mais lançamentos de meses anteriores aparecerem como sobra.

## [0.31.2] - 2026-09-19

### Alterado

- Conferência por extrato: a fatura em PDF do Santander passa a ter os lançamentos reconhecidos.
  - Quando nada é reconhecido, a tela mostra quantas linhas ficaram de fora e oferece "Copiar texto extraído", para diagnóstico.

## [0.31.1] - 2026-09-19

### Alterado

- Conferência por extrato: ler a fatura em PDF de novo, pelo botão "Trocar", não dá mais erro.
  - Um erro ao ler o arquivo agora aparece em português, com o detalhe técnico junto.

## [0.31.0] - 2026-09-18

### Adicionado

- Conferência por extrato, em Ajustes: envie o extrato da conta em CSV (Nubank) ou a fatura em PDF (Santander), e o app compara cada linha com o que você já lançou.
  - Cada item aparece em ordem de data, marcado como confere, previsto, divergente, novo, sobra ou interno.
  - Nada é gravado até você revisar a lista e confirmar.
  - Compra parcelada na fatura é remontada como a compra original, e as parcelas futuras voltam a aparecer na projeção.
  - O pagamento da fatura dá baixa na fatura prevista, em vez de virar compra.
  - Aplicação e resgate da caixinha do Nubank não entram no fluxo de caixa.
  - Lançamentos novos entram em "A classificar", para você reclassificar depois.

## [0.30.0] - 2026-09-18

### Adicionado

- Botão "Bloquear"/"Permitir" em cada cartão, em Ajustes → Cartões.
  - Um cartão bloqueado não aparece mais no menu Adicionar → "Compra no cartão".
  - A fatura e as assinaturas do cartão continuam funcionando normalmente — é útil para um cartão que só existe para receber assinaturas.
  - É independente de "Ativar"/"Desativar", que continua desligando o cartão por completo.

## [0.29.0] - 2026-09-17

### Adicionado

- Transferir saldo entre bancos da mesma conta, direto na Hoje → Conferir.
  - Aparece o botão ↔ em cada banco quando a conta tem dois ou mais cadastrados.
  - Ajusta o saldo dos dois bancos na hora, sem precisar conferir os dois separadamente.
  - Aparece no Fluxo como uma saída e uma entrada, mas não conta como ganho ou gasto em Análises.
  - Dá pra ver o detalhe e excluir a transferência clicando nela no Fluxo.

## [0.28.0] - 2026-09-08

### Adicionado

- Itens da nota fiscal na compra do cartão.
  - Anexe o XML da NFC-e a uma compra, nova ou já salva, e veja a lista de produtos com valor e percentual do total.
  - A lista vem do maior para o menor valor; quando a soma dos itens não fecha com a compra, uma linha final mostra a diferença.
  - O valor e a data da compra nunca mudam ao anexar a nota.
  - Só os itens ficam guardados, nunca o arquivo XML; excluir a compra apaga a nota junto.

## [0.27.0] - 2026-09-03

### Adicionado

- Ajuste excepcional do dia de fechamento de uma fatura.
  - Fica na aba Conferência da fatura, logo abaixo da conferência de valor.
  - Vale só para o mês daquela fatura — o dia de fechamento padrão do cartão não muda.

## [0.26.0] - 2026-08-31

### Adicionado

- Compra no cartão a partir da nota fiscal: escaneie o QR-code da NFC-e, busque o XML fora do app e volte com ele para pré-preencher valor, data e descrição.
  - Sem câmera, ou se o QR não for lido, dá pra digitar a chave de acesso à mão.
  - Categoria e cartão continuam por sua conta — o XML não indica isso.

## [0.25.0] - 2026-08-27

### Alterado

- Na fila de Pendentes, tocar no valor de um previsto abre a correção ali mesmo.
  - Dá para ajustar o valor e a data antes de confirmar, num gesto só.
  - O ajuste vale só para aquela ocorrência: a recorrência que gerou o previsto não muda.
  - Fatura de cartão continua com "Paguei outro valor", que abre a folha de parcelamento.

## [0.24.0] - 2026-08-27

### Alterado

- Busca do Fluxo agora encontra a fatura do cartão pela descrição, categoria ou valor de uma compra dentro dela.

## [0.23.0] - 2026-08-21

### Alterado

- O changelog agora aceita tópico e detalhe: um item pode vir com uma lista de detalhes indentados abaixo dele, em vez de só bullets soltos do mesmo nível.
  - Vale para os fragmentos em changelog.d/, para o CHANGELOG.md e para a tela Ajustes → Versão.
  - Um fragmento sem nenhum detalhe continua funcionando exatamente como antes.

## [0.22.0] - 2026-08-20

### Adicionado

- O botão + agora mostra atalhos para o que você mais lança.
  - Cada atalho já vem com a categoria, o cartão ou a box e o valor da última vez.
  - Abre o formulário preenchido para você conferir antes de confirmar — nada é lançado só de tocar.
- Os atalhos saem do que você mesmo digitou nos últimos dois meses, em lançamentos e em compras no cartão.
  - Recorrência, fatura e assinatura não viram atalho porque já entram sozinhas.
  - Quem ainda não tem histórico continua vendo a tela como ela era.

## [0.21.0] - 2026-08-10

### Alterado

- Hoje agora tem três abas: Visão, Conferir e Pendentes, em vez de tudo empilhado numa tela só.
- Fluxo agora tem duas abas: Lista (padrão, com busca e filtros atrás do ícone de lupa) e Gráfico, que ficou maior.
- Cartão agora tem três abas dentro do card da fatura: Resumo, Lançamentos e Conferência.
  - O cabeçalho da fatura continua sempre visível.
- A aba Conferência do cartão mostra ✔️ ou ⚠️ no próprio rótulo assim que existe uma conferência salva, sem precisar entrar na aba pra saber se bate.

## [0.20.2] - 2026-08-09

### Alterado

- Campos de valor: clicar num campo agora seleciona o valor inteiro em vez de zerá-lo.
  - O primeiro número digitado substitui o que estava lá, e encostar no campo sem digitar não altera mais nada.
  - Vale para todas as telas com campo de dinheiro.
- Ajustes, Bancos e Boxes: o rótulo do saldo voltou para cima do campo e o botão de sinal ficou ao lado do valor, em vez de flutuar sozinho à direita.
- Ajustes, Bancos: Salvar e Cancelar saíram do topo do formulário para o fim, onde não parecem salvar só o nome.

## [0.20.1] - 2026-08-05

### Alterado

- Wiki: o capítulo do cartão passa a explicar como pagar a fatura por outro valor, informar a data em que você pagou e registrar o parcelamento feito no banco.
- Wiki: novo trecho sobre bancos em Ajustes, e a tela Hoje passa a descrever a conferência de saldo por banco.
- Wiki: glossário ganhou "banco" e "parcelamento de fatura".

## [0.20.0] - 2026-08-05

### Adicionado

- Ajustes ganhou a tela Bancos: dá para cadastrar as contas de cada box e informar quanto tem em cada uma.
- Um cartão pode pertencer a um banco, para você ver quais cartões saem de qual conta.
- Tela Hoje: quando a box tem bancos, a conferência de saldo passa a ter uma linha por banco, com o total informado e a diferença para o que o Flow projeta.
  - Cada banco tem o botão de sinal, então conta no cheque especial pode ser informada como negativa.
- Enquanto nenhum banco tiver saldo informado, a tela não mostra diferença nenhuma — em vez de acusar um descasamento que só existe porque você ainda não digitou.
- Quem não cadastrar nenhum banco não vê diferença: a conferência continua exatamente como era, e excluir todos os bancos devolve o valor que já estava lá.

## [0.19.0] - 2026-08-04

### Alterado

- Excluir um lançamento ou descartar um previsto agora pede confirmação antes de apagar

## [0.18.0] - 2026-08-03

### Adicionado

- Pagamento de fatura: agora dá para informar em que dia você pagou, o que permite registrar um pagamento adiantado. O saldo projetado passa a mostrar a saída no dia certo, e não mais no vencimento.
- Numa fatura ainda em aberto o campo já vem com hoje; numa fatura já paga ele preserva a data registrada, para corrigir o valor não mudar o dia sem querer.
- Quando a data escolhida é anterior ao vencimento, a tela diz que o pagamento é adiantado e a partir de quando o valor sai da conta.

## [0.17.2] - 2026-08-03

### Alterado

- Correção: ao pagar uma fatura em parte, os campos de parcelamento agora aparecem sozinhos, sem depender de marcar uma caixa que passava despercebida. Antes dava para pagar parcial e o restante sumir da projeção sem o app avisar.
- Pagamento de fatura: quando sobra valor sem parcelamento informado, a tela avisa em destaque que esse valor some da projeção e não volta em nenhuma fatura.

## [0.17.1] - 2026-08-03

### Alterado

- Contas previstas agora aparecem na fila de Pendentes até 3 dias antes do vencimento, em vez de só no dia ou depois dele.

## [0.17.0] - 2026-08-03

### Adicionado

- Fatura do cartão: agora dá para registrar que você pagou só uma parte e parcelou o restante no banco. As parcelas entram sozinhas nas faturas seguintes, com o saldo projetado acompanhando.
- O parcelamento aparece na fatura seguinte como "Parcelamento", igual a qualquer compra parcelada, com a contagem de parcelas.
- Você digita quantas parcelas e quanto é cada uma, como o banco mostra — o app não calcula juros, só mostra quanto deles você está pagando.
- Hoje: numa fatura pendente, "Descartar" dá lugar a "Paguei outro valor" — fatura sempre acontece, o que varia é quanto foi pago dela.
- Cartão: a fatura mostra quanto foi pago (ou quanto falta pagar) e deixa corrigir ou parcelar depois, quando você só lembra dias depois.

## [0.16.1] - 2026-07-29

### Alterado

- Ajustes, Boxes: a box recém-criada já fica selecionada no topo, e tentar criar sem nome agora avisa em vez de não fazer nada.
- Ajustes, Boxes: a data do saldo já vem preenchida com hoje quando a box ainda não tem uma.
- Ajustes, Viagens: início e fim já vêm com hoje, e salvar sem preencher tudo agora avisa o que falta.
- Lançar: quando o botão está desabilitado, a tela diz o que falta — inclusive quando a box não tem nenhuma categoria.

## [0.16.0] - 2026-07-29

### Adicionado

- Clique numa categoria do resumo da fatura para filtrar os lançamentos do cartão por ela.
- Campo de busca por texto na lista de lançamentos do cartão (descrição, categoria, data ou valor).

### Alterado

- Corrigido: criar ou editar uma assinatura de cartão cujo dia do mês já tinha passado no ciclo atual agora inclui a cobrança na fatura do mês corrente.

## [0.15.1] - 2026-07-26

### Alterado

- Botão de alternar sinal (+/−) do saldo agora fica à esquerda do campo de valor, em Hoje e em Boxes.

## [0.15.0] - 2026-07-26

### Adicionado

- Tela Hoje: quem abre o app sem nada cadastrado vê um cartão que leva a criar a primeira box ou a importar um backup de outro aparelho, no lugar do saldo zerado.
- Ajustes, Categorias: box sem nenhuma categoria passa a oferecer uma lista sugerida, criando de uma vez as que você marcar.
- Ajustes, Recorrências: sem nenhuma recorrência cadastrada, a tela explica que são elas que enchem a projeção do Fluxo.
- Os atalhos dessas telas abrem direto a tela de Ajustes certa, em vez de parar no menu.

## [0.14.0] - 2026-07-26

### Adicionado

- Wiki: a documentação do app agora abre dentro do Flow, offline, sem depender de link externo.
- Wiki: índice por capítulos com busca, e uma seção de primeiros passos para quem está começando.

## [0.13.0] - 2026-07-25

### Alterado

- Importar um backup com a configuração ausente ou corrompida agora avisa com uma mensagem clara, em vez de falhar sem explicar.
- Importar um backup não deixa mais duas conferências de fatura do mesmo cartão e mês conviverem: fica valendo a mais recente, tanto ao substituir quanto ao mesclar.
- Ajustes → Categorias, Recorrências, Cartões, Assinaturas e Categorias do cartão: o seletor de box próprio de cada tela foi removido — agora todas seguem a box escolhida no chip do topo do app, como um "perfil". Pra mexer nas categorias, cartões ou recorrências de outra pessoa, troca o chip do topo primeiro.
- A box "casa" (compartilhada, sem saldo próprio) passa a ser criada automaticamente na primeira vez que o app abre, se ainda não existir.
- Simulador: o seletor de categoria de um lançamento hipotético não mostra mais categorias de outras boxes.

## [0.12.2] - 2026-07-24

### Alterado

- Ajustes → Cartões: a lista de cartões cadastrados agora mostra só os da box selecionada, em vez de todos os cartões de todas as boxes juntos.
- Ajustes → Assinaturas e Categorias do cartão: adicionado um seletor de box antes do seletor de cartão, para nenhum cartão de outra box aparecer como opção.

## [0.12.1] - 2026-07-23

### Alterado

- Os valores de mínimo e máximo abaixo do gráfico de saldo (abas Hoje e Fluxo, e no gráfico expandido do Fluxo) agora aparecem em verde ou vermelho conforme o próprio sinal.

## [0.12.0] - 2026-07-23

### Adicionado

- Gráficos na aba Análises: composição por categoria em barras, evolução dos últimos 6 meses (ganho, gasto e sobra) com linha de tendência, e barrinhas de ganho/gasto no card resumo.
- Primeira coluna da tabela Comparativo fica fixa ao rolar horizontalmente no celular, sem cortar nomes de categoria longos.

## [0.11.7] - 2026-07-23

### Alterado

- Lançamentos passam a ser ordenados por data e hora de criação (com precisão de milissegundos), mais recente primeiro — antes, lançamentos do mesmo dia podiam aparecer em ordem arbitrária.

## [0.11.6] - 2026-07-23

### Removido

- Título "Fluxo"/"Análises"/"Ajustes" no início de cada tela — ficou redundante com o nome da aba agora fixo no topo.

## [0.11.5] - 2026-07-23

### Alterado

- Nome da aba atual aparece no cabeçalho fixo do topo, entre a box selecionada e a engrenagem de Ajustes.
- Engrenagem de Ajustes sempre volta ao menu inicial, mesmo clicada de dentro de uma seção (ex.: Boxes, Categorias) já aberta.

## [0.11.4] - 2026-07-23

### Alterado

- Alcinha de arrastar dos sheets fica branca, em vez do cinza azulado anterior — melhora a visibilidade sobre o fundo do sheet.

## [0.11.3] - 2026-07-23

### Alterado

- Resumo da fatura (ao tocar num lançamento de cartão): itens agrupados em À vista/Parceladas, na mesma ordem usada na aba Cartão, em vez da ordem bruta anterior.
- Resumo da fatura: os botões "Editar" e "Fechar" saem; no lugar, um link "Ver fatura completa na aba Cartão" (fechar o sheet continua possível arrastando a alcinha ou tocando fora).

## [0.11.2] - 2026-07-23

### Alterado

- Alcinha de arrastar para fechar os sheets: área de toque aumentada — antes só funcionava tocando exatamente na barrinha de 4px, agora responde em toda a faixa ao redor dela.

## [0.11.1] - 2026-07-23

### Alterado

- Sheets (modais deslizantes, como o detalhe de fatura do cartão) agora rolam corretamente quando o conteúdo é maior que a tela — antes o gesto de arrastar para fechar bloqueava a rolagem do conteúdo.
- A alcinha para arrastar e fechar o sheet fica fixa no topo, visível mesmo com o conteúdo rolado.
- Detalhe da fatura do cartão (ao tocar num lançamento): nome do cartão, mês e total ficam fixos no topo do sheet enquanto a lista de itens rola por baixo.

## [0.11.0] - 2026-07-22

### Adicionado

- Seletor de Box em Recorrências (Ajustes), escopando a lista e as categorias àquela box.
- Linha "Assinaturas" na aba Análises, somando assinaturas de todos os cartões — abre um
  resumo agrupado por cartão.

### Alterado

- Recorrências: formulário sobe pro topo da tela; categoria vira grid de botões (com
  alternância Gasto/Ganho), no lugar do `<select>` nativo.
- Cartões: uma box pode ter mais de um cartão ativo ao mesmo tempo; formulário de novo
  cartão sobe pro topo.
- Categorias do cartão: seletor de cartão vira botões, no lugar do `<select>` nativo.
- Assinaturas: escolhe o cartão em vez da categoria (a categoria "Assinaturas" fica
  automática); lista escopada ao cartão selecionado; formulário sobe pro topo.
- Menu de Ajustes reordenado por hierarquia (Boxes primeiro).
- Seletor de categoria em Lançar, Compra no cartão, editar lançamento e Simulador trocam o
  `<select>` nativo por grid de botões (evita o picker nativo do Android com botão "Done").

### Removido

- Campo de categoria manual no formulário de Assinaturas.
- Bloqueio que impedia mais de um cartão ativo por box.

## [0.10.0] - 2026-07-22

### Adicionado

- Viagem: agrupamento de gastos de cartão e débito feitos num período de viagem, com
  cadastro em Ajustes → Viagens (nome, data inicial e final).
- Lançar e Nova compra (cartão): checkbox "Viagem: {nome}" aparece quando a data cai
  dentro do período de uma viagem cadastrada, já vem marcado.
- Análises: linha "viagem - dd/mm/aaaa ~ dd/mm/aaaa" no resumo por categoria e novo card
  "Viagens" com o total de cada uma; ambos abrem o detalhamento por descrição/nota, com
  subtotal de cada grupo e total geral.

### Alterado

- Compras parceladas marcadas numa viagem continuam aparecendo no mês certo da fatura
  enquanto houver parcela pendente, mesmo depois do fim da viagem.
- Excluir uma viagem em Ajustes desvincula os lançamentos e compras marcados, em vez de
  apagá-los.

## [0.9.1] - 2026-07-20

### Corrigido

- Nova compra (Cartão): o campo Categoria tinha uma opção fantasma ("categoria…", depois
  deixada em branco) que aparecia na lista ao abrir o seletor; agora a lista mostra só as
  categorias reais, e o campo começa sem nada selecionado.

### Alterado

- Gráfico de saldo (cartão pequeno e modal expandido): a linha passa a ser sempre branca,
  em vez de verde fixa. No expandido, o marcador do dia selecionado e o valor em destaque
  agora ficam verdes ou vermelhos conforme o sinal do saldo daquele dia.

## [0.9.0] - 2026-07-19

### Adicionado

- Seção "Arquivados" em Categorias e Categorias do cartão (Ajustes), separando categorias
  arquivadas das listas ativas.

### Alterado

- Categorias e Categorias do cartão (Ajustes): reordenar passa a ser por arraste (alça),
  no lugar dos botões ↑/↓; formulário de criar categoria subiu para o topo da tela.

## [0.8.3] - 2026-07-19

### Corrigido

- Changelog na tela de Ajustes: itens que quebram linha no `CHANGELOG.md` (linhas de
  continuação indentadas) apareciam cortados na primeira linha; o parser agora junta a
  continuação ao item.

## [0.8.2] - 2026-07-19

### Alterado

- Análises: clicar na categoria de fatura de um cartão (ex.: "Nubank") não abre mais o
  sheet genérico agrupado por nota (que só repetia o total, já que a fatura é um único
  lançamento por mês) — agora mostra o detalhamento por categoria de compra do cartão,
  com um link para ver a fatura completa na aba Cartão.

## [0.8.1] - 2026-07-19

### Alterado

- Sheet de lançamentos por categoria (Análises): grupos com um único lançamento não
  mostram mais a linha de data (redundante com o subtotal); linha do grupo e da data
  recuam visualmente para indicar o nível de hierarquia.

## [0.8.0] - 2026-07-19

### Adicionado

- Componente `CampoData`: botão com ícone de calendário no lugar do input de data nativo,
  usado em todos os formulários com data do app.
- Cor própria (verde/vermelho) para o totalizador do dia na aba Fluxo, separada da cor da
  transação individual.

### Alterado

- Maior contraste entre o fundo e os cards/itens de lista em toda a UI.
- Recorrências e Assinaturas: descrição, data e recorrência em linhas separadas, evitando
  quebra de texto ruim; botões de ação numa linha própria.
- Valores monetários (Recorrências, Assinaturas, fatura do cartão, tabela "Comparativo" em
  Análises) passam a ser coloridos por ganho/gasto onde antes ficavam sem cor.
- Aba Fluxo: valor de cada transação sem negrito, destacando o totalizador do dia.

## [0.7.0] - 2026-07-17

### Adicionado

- Este changelog e exibição da versão atual na tela de Ajustes.

## [0.6.0] - 2026-07-17

### Removido

- Importação de lançamentos e saldo inicial a partir de planilha Excel (descontinuada).

### Alterado

- Aba Simulador fica oculta da navegação (cenários seguem existindo no domínio).

## [0.5.0] - 2026-07-10

### Adicionado

- Linha do dia de hoje sempre visível e destacada na lista padrão do Fluxo.

### Alterado

- Ordenação de categorias passa a vir da fonte de dados, consistente em todas as telas.
- Exportar backup deixa de falhar em silêncio.

## [0.4.0] - 2026-07-08

### Adicionado

- Gráfico de saldo expandido com pan/zoom, scrub e busca por período na aba Fluxo.
- Popup unificado "Adicionar" para lançamento ou compra no cartão, aberto pelo FAB.
- Categoria de fatura do cartão criada e renomeada automaticamente, oculta em toda a UI.
- Drill-down de lançamentos por categoria na aba Análises.

## [0.3.0] - 2026-07-05

### Alterado

- Redesign visual dark-first: novos tokens e tema, tab bar com FAB, bottom sheet com
  arraste, gráfico de saldo com gradiente, card herói do saldo e ícones no menu de ajustes.

## [0.2.0] - 2026-07-04

### Adicionado

- Aba Cartão de crédito: fatura derivada do ciclo de fechamento/vencimento, compras
  parceladas, assinaturas recorrentes no cartão e conferência com o valor do banco.

## [0.1.0] - 2026-07-03

### Adicionado

- Primeira versão do Flow: fluxo de caixa diário com saldo projetado por box.
- Categorias, lançamentos manuais e recorrências.
- Telas Hoje, Fluxo, Análises, Simulador e Ajustes.
- Importação de saldo inicial e lançamentos a partir de planilha Excel.
- Backup e restauração em JSON.
- PWA instalável, com funcionamento offline.
