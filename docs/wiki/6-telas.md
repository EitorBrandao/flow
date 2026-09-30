# Telas

Todas respeitam o seletor de box no topo (no exemplo: `{{boxA}}` / `{{boxB}}` / `casa`), exceto onde indicado.

> **Sobre "obrigatório" nesta wiki:** a UI não marca campos com asterisco — isso é só documentação. "Obrigatório" quer dizer que salvar não grava nada com o campo vazio ou inválido: o app diz o que falta, uma coisa por vez, num aviso abaixo dos botões. Campos com valor padrão (ex.: data = hoje, parcelas = 1) contam como preenchidos, mesmo sem o usuário tocar neles.

> **Janelas por cima da tela:** enquanto uma janela está aberta (a que sobe de baixo, o gráfico em tela cheia, o índice da wiki), o toque vale só para ela — a tela de trás não rola. Para fechar a que sobe de baixo, puxe para baixo pela barrinha do topo, pelo título ou pelo próprio conteúdo, quando ele já está no começo. Tocar no fundo escuro também fecha.

## Hoje

Tela inicial. Foco em "onde estou agora" e no que precisa de atenção. Três abas: Visão, Conferir e Pendentes.

- **Visão:** saldo efetivo em destaque; se o projetado difere, aparece logo abaixo. A pílula colorida mostra quanto o saldo muda nos próximos 28 dias: a cor diz o sentido — verde se sobe, vermelha se desce. Mini-gráfico da janela de 7 dias atrás a 28 dias à frente; embaixo, "Ver gráfico completo na aba Fluxo →" abre o Fluxo na aba Gráfico, com a projeção inteira.
- **Conferir:** uma frase no topo explica o uso. Campo para digitar o saldo que o app do banco mostra, mais a data; o app calcula a diferença ("bate certinho", "falta inserir no app" ou "sobra no app — confira duplicado"). "Bate certinho" só aparece com diferença zero: um centavo já conta como diferença, igual à conferência da fatura. O valor segue o ponto de vista do app: a cor diz o sentido — vermelho quando falta lançar algo, verde quando sobra. Com bancos cadastrados na box, vira uma linha por [[banco]], com o total informado abaixo — a diferença passa a ser calculada contra essa soma. Antes da diferença, "Total calculado no Flow" mostra o saldo de hoje segundo o app, o outro lado da conta. Aparece sempre, mesmo antes de você digitar algum valor.
- **Pendentes:** fila de previstos vencidos, com confirmar (✓) ou descartar (✕) em um toque. O rótulo da aba mostra quantos itens esperam. Fila vazia diz "Nada a confirmar" e lembra a regra: entram os previstos que já venceram ou vencem em até 3 dias. Se a conta veio com outro valor, toque no valor do item: os campos de data e valor abrem ali mesmo, e confirmar grava a correção. O ajuste vale só para aquela ocorrência — a recorrência que a gerou não muda. Fatura de cartão segue outro caminho, o do botão "Paguei outro valor" (veja o capítulo [Cartão de crédito](#cartao)).
- **Rodapé de backup:** abaixo do card de saldo, na Visão, sempre visível — mostra há quanto tempo foi o último backup. Fica discreto sem nada novo sem cópia, âmbar com mudanças sem backup, e vermelho quando, além disso, o último backup tem 7 dias ou mais (ou nunca foi feito). Tocar leva direto a Ajustes → Backup.

**Conferência de saldo — obrigatório:** saldo real no banco. **Tem padrão:** data (hoje).

> Com bancos cadastrados, enquanto nenhum saldo for informado a tela não mostra diferença nenhuma. Acusar um descasamento do tamanho do saldo inteiro só porque você ainda não digitou seria mentira.

Cada linha de banco tem um botão de sinal: informe negativa para contar no cheque especial. Salvar grava só os bancos cujo valor você realmente mudou — encostar num campo e desistir não mexe no que já estava lá.

Com dois ou mais bancos na box, cada linha ganha também o botão ↔: abre um formulário curto para transferir saldo a outro banco da mesma box (destino, valor, data). Confirmar ajusta o saldo dos dois na hora e aparece como um lançamento de saída e outro de entrada na aba Fluxo — sem contar como ganho ou gasto real em Análises, já que é só redistribuição do seu próprio dinheiro. Excluir a transferência (pelo Fluxo) apaga os dois lançamentos, mas não desfaz o ajuste de saldo nos bancos.

**Transferência entre bancos — obrigatórios:** banco de destino, valor. **Tem padrão:** data (hoje).

> As três abas ficam disponíveis mesmo antes do primeiro uso terminar: uma fatura de cartão pendente aparece em Pendentes mesmo com a Visão ainda mostrando o convite para escolher categorias.

## Lançar

O botão central (+) da barra. Fluxo mínimo: valor → categoria → Lançar.

- Teclado numérico decimal já abre pronto, sem precisar tocar em nada.
- Alterna **Gasto**/**Ganho** — troca a lista de categorias mostrada (da box selecionada, não arquivadas, na ordem definida em Ajustes → Categorias).
- Data padrão hoje; nota opcional; caixa "marcar como previsto".
- Data futura vira previsto automaticamente mesmo sem marcar a caixa.
- Ao salvar, mostra "Lançado ✓" por alguns segundos e limpa o formulário (mantendo a box e o tipo selecionados).
- Tocar no (+) mostra antes uma faixa de atalhos para o que você mais lança; cada um já traz a categoria, o destino (box ou cartão) e o valor da última vez — você confere e confirma.
- Atalho com ponto azul vai para cartão; sem ponto, é lançamento direto na box.
- Só conta o que você digitou — lançamentos e compras no cartão — nos últimos dois meses; recorrência, fatura e assinatura não viram atalho porque já entram sozinhas.
- Sem histórico de lançamentos, a faixa de atalhos não aparece.
- O cabeçalho da tela Adicionar tem o botão "Ler nota fiscal", com um ícone de câmera: escaneia o QR-code de uma nota fiscal (NFC-e) e extrai a [[chave de acesso]].
- Com a chave, você busca o XML fora do app (num site de consulta de NFC-e) e volta com ele — por upload de arquivo ou colando o texto.
- O Flow lê o XML e pré-preenche valor, data e descrição da compra; categoria e cartão continuam por sua conta.
- A nota também traz seus [itens](#glossario/item-da-nota): no formulário da compra, "Ver itens" mostra a lista de produtos com valor e percentual do total.
- Sem câmera disponível, ou se o QR não for lido, dá para digitar a chave de 44 dígitos à mão.

**Obrigatórios:** valor, categoria. **Têm padrão:** data (hoje). **Opcionais:** nota, marcar como previsto.

## Fluxo

A linha do tempo do dinheiro. Três abas: Lista (padrão), Gráfico e Simular.

- **Lista** mostra por padrão de 14 dias atrás até o horizonte de projeção; a lupa abre busca e filtros (texto, data única ou período; "+30 dias atrás" estende o início da janela para o passado). A busca por texto também alcança as compras dentro da fatura de um cartão: bater numa delas (descrição, categoria do cartão ou valor) mostra o lançamento da fatura na lista. Cada dia mostra seu saldo projetado no cabeçalho. Com filtro de data, o dia escolhido aparece mesmo sem lançamento — é como saber quanto você vai ter num dia sem nada. Num período, aparecem o primeiro e o último dia, mais os dias com lançamento. Cada dia futuro filtrado mostra também a diferença em relação a hoje, verde se o saldo sobe e vermelho se desce. Um dia fora da projeção mostra um traço no lugar do saldo: depois do fim, diz até quando a projeção vai; antes do começo, diz quando ela começa.
- **Gráfico** mostra o histórico e a projeção completa até o horizonte configurado, numa área maior que o mini-gráfico de Hoje; linha extra tracejada quando há cenário ligado; toque no card abre em tela cheia, onde dá para arrastar e ver o saldo de cada dia, e aproximar com dois dedos. Uma frase embaixo do card lembra isso e diz que a linha pontilhada vertical é hoje. Embaixo, o menor e o maior saldo do período; quando o período passa de um ano para outro, as datas das pontas mostram o ano, e o mínimo e o máximo descem para a linha de baixo.
- Tocar num lançamento, na Lista, abre o editor (valor, data, categoria, nota); previstos podem ser confirmados ali mesmo; previstos de recorrência avisam para editar a regra em Ajustes, se for para mudar valor ou data de vez. Exceção: um item de [cenário](#glossario/cenario) nunca tem Confirmar. O item "uma vez" continua com Salvar e Excluir, e a dica avisa que ele não pode ser confirmado e aponta para "Tornar real", em Fluxo › Simular. Já uma parcela de uma recorrência de cenário só mostra Fechar: os campos aparecem como texto, sem edição — a próxima materialização traria a parcela de volta mesmo excluída, então mudar ou excluir esse item é só pelo Simular. Uma transferência entre bancos (feita em Hoje → Conferir) abre, em vez disso, um resumo só de leitura, com os dois bancos, a data e o valor, e um botão para excluir as duas pernas — não dá para editar valor, data ou categoria de uma transferência, só apagar e refazer.

**Editor de lançamento — obrigatórios:** valor, data, categoria. **Opcional:** nota.

## Simular

Terceira opção do Fluxo, ao lado de Lista e Gráfico. [Cenários](#glossario/cenario) "e se?": ligar/desligar, criar, detalhar e converter em real. Não entra em [[efetivo]] nem em Análises até você tornar o cenário real.

- "Novo cenário" fica no topo, com uma frase explicando que cenário é uma hipótese que nunca altera o saldo real; o cenário nasce ligado e já aberto.
- "Cenários ligados": tabela mês a mês, Mês · Com · Diferença · Sem, valores em reais sem o "R$". Com e Sem são o saldo projetado, com e sem os cenários ligados. Diferença é o efeito deles naquele mês. Uma legenda embaixo da tabela explica Com, Sem e Diferença. Sem cenário nenhum ligado, um aviso diz que a tabela mostra só o saldo real. Com algum ligado: se o saldo com os cenários fica negativo em algum mês, um aviso vermelho mostra o primeiro desses meses; senão, um aviso comum (não vermelho) diz até quando o saldo segue positivo. O resumo do card de cada cenário mostra o mesmo aviso de negativo — "negativo em {mês}" — para o impacto isolado dele.
- Cada cenário aparece num card, com o quadradinho de ligar/desligar à esquerda. Tocar no nome ou na seta abre e fecha o card; o resumo mostra o número de itens e o efeito do cenário até o último mês da projeção. Aberto: a lista de itens, "Impacto só deste cenário" (a mesma tabela, mas com só este cenário ligado), o formulário "Novo item", e os botões "Tornar real" e "Excluir cenário" — os dois com confirmação.
- Item do cenário: gasto ou ganho, valor, categoria e uma entre três repetições — uma vez (data única), parcelado (o valor digitado é o total, dividido pelo número de parcelas) ou todo mês (repete até o fim da projeção). Para simular a troca de algo que já existe de verdade, como o aluguel ou o salário, lance só a diferença para o valor novo.
- Tocar num item abre para editar ou excluir; a repetição escolhida na criação não muda depois — para trocar, exclua o item e crie outro.
- Um lançamento de cenário nunca é confirmado, mesmo com a data já passada: para levá-lo aos dados reais, use "Tornar real" no cenário todo. Se algum item do cenário já tiver data passada (hoje inclusive), a confirmação de "Tornar real" avisa que esses itens vão para os Pendentes, em Hoje.

**Novo cenário — obrigatório:** nome.
**Item do cenário — obrigatórios:** valor, categoria. **Têm padrão:** data (hoje), parcelas (2, só quando parcelado).

## Cartão

Aba dedicada à fatura do cartão da box selecionada (ou os dois cartões empilhados, na visão casa). Cada fatura tem três abas: Resumo, Lançamentos e Conferência.

- Cada cartão abre com o nome dele num título, acima da navegação de mês — na visão casa, é o título que separa um cartão do outro.
- Mostra a fatura do mês atual por padrão, com navegação ‹ mês anterior / mês seguinte › — o mês aparece por nome (janeiro, fevereiro etc.).
- O nome do cartão e o seletor de mês ficam presos logo abaixo da barra do topo ao rolar. Na visão casa, com vários cartões, o bloco do cartão seguinte empurra o anterior.
- Cabeçalho da fatura, sempre visível fora das abas: total da fatura, dia de fechamento e de vencimento.
- **Resumo:** valor pago ou a pagar, com atalho para corrigir; o resumo por categoria do cartão aparece sempre que há ao menos uma. Tocar numa categoria filtra os lançamentos para ela, pula para a aba Lançamentos e deixa a categoria destacada no Resumo; tocar de novo tira o filtro.
- **Lançamentos:** busca por descrição, categoria, data ou valor; itens agrupados em À vista/Parceladas, com marcação de parcela (ex.: "3/12"); tocar abre edição; excluir remove a compra e todas as parcelas dela.
- **Conferência:** campo "valor no app do banco"; mostra a diferença nas mesmas frases da conferência de saldo em Hoje ("bate certinho", "falta inserir no cartão" ou "sobra no cartão — confira duplicado"), com a mesma regra de cor: a cor diz o sentido — vermelho quando faltam itens, verde quando os itens passam do banco. Checkbox "usar este valor no Flow" (desmarcada por padrão). O rótulo da aba mostra ✔️ ou ⚠️ assim que existe uma conferência salva — dá para saber se bate sem entrar na aba.
- Compra nova entra pelo botão **+** no meio da barra de baixo → **Compra no cartão** (valor, data, categoria do cartão, parcelas, descrição).
- Sem cartão cadastrado para a seleção: mostra atalho direto para cadastrar em Ajustes.
- Tocar numa fatura no Fluxo, ou tocar uma categoria de cartão em Análises, abre uma sheet com o cabeçalho do cartão (nome, mês, total, fechamento e vencimento), a lista da fatura — os itens, quando vem do Fluxo; as categorias, quando vem das Análises — e o link "Ver fatura completa na aba Cartão".

**Compra no cartão — obrigatórios:** valor, categoria do cartão. **Têm padrão:** data (hoje), parcelas (1). **Opcional:** descrição. Com 2 parcelas ou mais aparece também **Parcelas já pagas**, para registrar uma compra parcelada que já está em andamento: a data da compra recua um mês para cada parcela já paga.
**Conferência — obrigatório:** nenhum; campo vazio só limpa a conferência do mês (não bloqueia nada).

## Análises

Resumo e comparativos de um período. No topo, quatro opções:

- **Mês:** um mês, navegando com as setas ‹ › — o mês aparece por nome (janeiro, fevereiro etc.).
- **12 meses:** os 12 meses que terminam no mês atual; as setas deslizam a janela um mês por vez.
- **Ano:** de janeiro a dezembro. Abre no último ano fechado; o ano atual aparece marcado "até agora".
- **Período:** um intervalo livre, de um mês a outro (no máximo 24 meses), escolhido nas linhas "de" e "até". As setas da linha de baixo deslizam o intervalo inteiro.

A linha com as setas fica presa logo abaixo da barra do topo: dá para trocar o mês ou o período sem voltar ao começo da tela.

- Caixa "incluir previstos" — desligada, mostra só o que já é efetivo no período.
- **Resumo:** ganhos, gastos e sobra do período. Com mais de um mês, mostra também a média por mês.
- **Por categoria:** total de cada categoria e seu percentual da renda do período (só para categorias de gasto). Tocar numa categoria de cartão abre a fatura (veja o capítulo [Cartão de crédito](#cartao)). Uma [viagem](#conceitos/viagem) com gasto no período aparece aqui como linha própria. Com mais de um mês, tocar numa categoria abre uma barra por mês; tocar num mês abre os lançamentos (ou a fatura) daquele mês, com "‹ voltar ao período".
- **Evolução mensal:** ganhos e gastos de cada mês — os 6 meses até o mês escolhido, no modo Mês; os meses do período, nos outros. Com até 6 meses, a sobra de cada mês aparece sobre as barras; com mais, uma linha só mostra a sobra do período.
- **Viagens:** cada viagem cadastrada, com o total gasto nela. Tocar abre o detalhamento, agrupado pela descrição.
- **Comparativo:** por categoria. No modo Mês: mês atual × mês anterior × mesmo mês do ano passado × média móvel de 3 meses; a coluna do mês atual mostra o mês abreviado (out/2026). Nos outros modos: período × período anterior (os mesmos tantos meses, logo antes) × mesmo período do ano anterior × média por mês. Com 12 meses, o período anterior já é o ano anterior, e essa coluna aparece uma vez só. Uma linha sob o título diz os meses de cada coluna.
- **Categorias do cartão:** as categorias do cartão (Mercado, Restaurante etc.) com as mesmas colunas do Comparativo. O mês é o da fatura: cada parcela conta na fatura em que cai, então a coluna do mês bate com o Resumo da mesma fatura na aba Cartão. Com mais de um cartão, cada um vem num bloco com o nome dele. Dentro de cada bloco, as categorias vêm do maior para o menor valor na primeira coluna. A caixa "incluir previstos" não muda este card. Tocar no nome de uma categoria abre os meses dela em barras, com a média — os últimos 6 meses, no modo Mês; os meses do período, nos outros.
