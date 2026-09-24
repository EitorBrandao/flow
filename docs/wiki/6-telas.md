# Telas

Todas respeitam o seletor de box no topo (no exemplo: `{{boxA}}` / `{{boxB}}` / `casa`), exceto onde indicado.

> **Sobre "obrigatório" nesta wiki:** a UI do app não marca campos com asterisco — isso é só documentação. "Obrigatório" quer dizer que o botão de salvar/criar não faz nada (silenciosamente) se o campo estiver vazio ou inválido. Campos com valor padrão pronto (ex.: data = hoje, parcelas = 1) contam como preenchidos mesmo sem o usuário tocar neles.

> **Janelas por cima da tela:** enquanto uma janela está aberta (a que sobe de baixo, o gráfico em tela cheia, o índice da wiki), o toque vale só para ela — a tela de trás não rola. Para fechar a janela que sobe de baixo, puxe para baixo pela barrinha do topo, pelo título ou pelo próprio conteúdo, quando ele já está no começo. Tocar no fundo escuro também fecha.

## Hoje

Tela inicial. Foco em "onde estou agora" e no que precisa de atenção. Três abas: Visão, Conferir e Pendentes.

- **Visão:** saldo efetivo em destaque; se o projetado difere, aparece logo abaixo. A pílula colorida mostra quanto o saldo muda nos próximos 28 dias, com sinal: verde e positiva se sobe, vermelha e negativa se desce. Mini-gráfico da janela de 7 dias atrás a 28 dias à frente.
- **Conferir:** campo para digitar o saldo que o app do banco mostra + data; o app calcula a diferença ("bate certinho", "falta inserir no app" ou "sobra no app — confira duplicado"). "Bate certinho" só aparece com diferença zero: um centavo já conta como diferença, igual à conferência da fatura. O valor da diferença é do ponto de vista do app: vermelho e negativo quando falta lançar algo, verde e positivo quando sobra. Se a box tiver bancos cadastrados, vira uma linha por [[banco]], com o total informado abaixo — a diferença passa a ser calculada contra essa soma.
- **Pendentes:** fila de previstos vencidos, com confirmar (✓) ou descartar (✕) em um toque. O rótulo da aba mostra quantos itens esperam. Se a conta veio com outro valor, toque no valor do item: ele abre os campos de data e valor ali mesmo, e confirmar grava o que você corrigiu. O ajuste vale só para aquela ocorrência — a recorrência que a gerou não muda. Fatura de cartão segue por outro caminho, o do botão "Paguei outro valor" (veja o capítulo [Cartão de crédito](#cartao)).
- **Rodapé de backup:** abaixo do card de saldo, na Visão, sempre visível — mostra há quanto tempo foi o último backup. Fica discreto quando não há nada novo sem cópia, âmbar quando há mudanças sem backup, e vermelho quando, além disso, o último backup tem 7 dias ou mais (ou nunca foi feito). Tocar leva direto para Ajustes → Backup.

**Conferência de saldo — obrigatório:** saldo real no banco. **Tem padrão:** data (hoje).

> Com bancos cadastrados, enquanto nenhum saldo for informado a tela não mostra diferença nenhuma. Acusar um descasamento do tamanho do saldo inteiro só porque você ainda não digitou seria mentira.

Cada linha de banco tem o botão de sinal, então conta no cheque especial se informa como negativa. Salvar grava só os bancos cujo valor você realmente mudou — encostar num campo e desistir não mexe no que já estava lá.

Com dois ou mais bancos na box, cada linha ganha também o botão ↔, que abre um formulário curto para transferir saldo para outro banco da mesma box (destino, valor, data). Confirmar ajusta o saldo dos dois bancos na hora e aparece como um lançamento de saída e outro de entrada na aba Fluxo — sem contar como ganho ou gasto real em Análises, já que é só redistribuição do seu próprio dinheiro. Excluir a transferência (pelo Fluxo) apaga os dois lançamentos, mas não desfaz o ajuste de saldo nos bancos.

**Transferência entre bancos — obrigatórios:** banco de destino, valor. **Tem padrão:** data (hoje).

> As três abas ficam disponíveis mesmo antes do primeiro uso terminar: uma fatura de cartão pendente aparece em Pendentes mesmo com a Visão ainda mostrando o convite para escolher categorias.

## Lançar

O botão central (+) da barra. Fluxo mínimo: valor → categoria → Lançar.

- Teclado numérico decimal aberto por padrão (`autoFocus`).
- Alterna **Gasto**/**Ganho** — troca a lista de categorias mostrada (da box selecionada, não arquivadas, na ordem definida em Ajustes → Categorias).
- Data padrão hoje; nota opcional; caixa "marcar como previsto".
- Data futura vira previsto automaticamente mesmo sem marcar a caixa.
- Ao salvar, mostra "Lançado ✓" por alguns segundos e limpa o formulário (mantendo a box e o tipo selecionados).
- Tocar no (+) mostra antes uma faixa de atalhos para o que você mais lança; cada atalho já traz a categoria, o destino (box ou cartão) e o valor da última vez — você confere e confirma.
- Atalho com ponto azul vai para cartão; sem ponto, é lançamento direto na box.
- Só conta o que você digitou — lançamentos e compras no cartão — nos últimos dois meses; recorrência, fatura e assinatura não viram atalho porque já entram sozinhas.
- Sem histórico de lançamentos, a faixa de atalhos não aparece.
- O cabeçalho da tela Adicionar tem um ícone de câmera: escaneia o QR-code de uma nota fiscal (NFC-e) e extrai a [[chave de acesso]].
- Com a chave, você busca o XML fora do app (num site de consulta de NFC-e) e volta com ele — por upload de arquivo ou colando o texto.
- O Flow lê o XML e pré-preenche valor, data e descrição da compra; categoria e cartão continuam por sua conta.
- A nota também traz seus [itens](#glossario/item-da-nota): no formulário da compra, "Ver itens" mostra a lista de produtos com valor e percentual do total.
- Sem câmera disponível, ou se o QR não for lido, dá pra digitar a chave de 44 dígitos à mão.

**Obrigatórios:** valor, categoria. **Têm padrão:** data (hoje). **Opcionais:** nota, marcar como previsto.

## Fluxo

A linha do tempo do dinheiro. Duas abas: Lista (padrão) e Gráfico.

- **Lista** mostra por padrão os últimos 14 dias para frente; o ícone de lupa abre busca e filtros (texto, data única ou período; botão "+30 dias atrás" estende a janela). A busca por texto também alcança as compras dentro da fatura de um cartão: bater numa delas (descrição, categoria do cartão ou valor) mostra o lançamento da fatura na lista. Cada dia mostra seu saldo projetado no cabeçalho. Com filtro de data, o dia escolhido aparece mesmo sem lançamento — é o jeito de saber quanto você vai ter num dia em que nada acontece. Num período, aparecem o primeiro e o último dia, mais os dias com lançamento. Cada dia futuro filtrado mostra também a diferença em relação a hoje, em verde se o saldo sobe e em vermelho se desce. Um dia depois do fim da projeção mostra um traço no lugar do saldo e até quando a projeção vai.
- **Gráfico** mostra o histórico e a projeção completa até o horizonte configurado, numa área maior que o mini-gráfico de Hoje; linha extra tracejada quando há cenário ligado; toque no card abre em tela cheia. Embaixo, o menor e o maior saldo do período; quando o período passa de um ano para outro, as datas das pontas mostram o ano, e o mínimo e o máximo descem para a linha de baixo.
- Tocar num lançamento, na Lista, abre o editor (valor, data, categoria, nota); previstos podem ser confirmados ali mesmo; previstos vindos de recorrência avisam para editar a regra em Ajustes se for para mudar valor/data permanentemente. Uma transferência entre bancos (feita em Hoje → Conferir) abre, em vez disso, um resumo só de leitura com os dois bancos, a data e o valor, e um botão para excluir as duas pernas — não dá para editar valor/data/categoria de uma transferência, só apagar e refazer.

**Editor de lançamento — obrigatórios:** valor, data, categoria. **Opcional:** nota.

## Cartão

Aba dedicada à fatura do cartão da box selecionada (ou os dois cartões empilhados, na visão casa). Cada fatura tem três abas: Resumo, Lançamentos e Conferência.

- Mostra a fatura do mês atual por padrão, com navegação ‹ mês anterior / mês seguinte › — o mês aparece por nome (janeiro, fevereiro etc.).
- Cabeçalho, sempre visível fora das abas: nome do cartão, total da fatura, dia de fechamento e de vencimento.
- **Resumo:** valor pago ou a pagar, com atalho para corrigir; resumo por categoria do cartão aparece sempre que há ao menos uma categoria — tocar numa categoria filtra os lançamentos para ela, pula para a aba Lançamentos e deixa a categoria destacada no Resumo; tocar de novo na mesma categoria tira o filtro.
- **Lançamentos:** busca por descrição, categoria, data ou valor; itens agrupados em À vista/Parceladas, com marcação de parcela (ex.: "3/12"); tocar abre edição; excluir remove a compra e todas as parcelas dela.
- **Conferência:** campo "valor no app do banco"; mostra a diferença nas mesmas frases da conferência de saldo em Hoje ("bate certinho", "falta inserir no cartão" ou "sobra no cartão — confira duplicado") — o valor da diferença segue a mesma regra da conferência de saldo em Hoje: vermelho e negativo quando faltam itens, verde e positivo quando os itens passam do banco; checkbox "usar este valor no Flow" (desmarcada por padrão). O rótulo da aba mostra ✔️ ou ⚠️ assim que existe uma conferência salva — dá para saber se bate sem entrar na aba.
- Compra nova entra pelo botão **+** no meio da barra de baixo → **Compra no cartão** (valor, data, categoria do cartão, parcelas, descrição).
- Sem cartão cadastrado para a seleção: mostra atalho direto para cadastrar em Ajustes.
- Tocar numa fatura no Fluxo, ou tocar uma categoria de cartão em Análises, abre uma sheet com o cabeçalho do cartão (nome, mês, total, fechamento e vencimento), a lista da fatura — os itens, quando vem do Fluxo; as categorias, quando vem das Análises — e o link "Ver fatura completa na aba Cartão".

**Compra no cartão — obrigatórios:** valor, categoria do cartão. **Têm padrão:** data (hoje), parcelas (1). **Opcional:** descrição. Com 2 parcelas ou mais aparece também **Parcelas já pagas**, para registrar uma compra parcelada que já está em andamento: a data da compra recua um mês para cada parcela já paga.
**Conferência — obrigatório:** nenhum; campo vazio só limpa a conferência do mês (não bloqueia nada).

## Análises

Resumo mensal e comparativos, navegando mês a mês com as setas ‹ › — o mês aparece por nome (janeiro, fevereiro etc.).

- Caixa "incluir previstos" — desligada, mostra só o que já é efetivo no mês.
- **Resumo:** ganhos, gastos e sobra do mês.
- **Por categoria:** total de cada categoria e seu percentual da renda do mês (só para categorias de gasto). Tocar numa categoria de cartão abre a fatura desse mês (veja o capítulo [Cartão de crédito](#cartao)).
- **Comparativo:** mês atual × mês anterior × mesmo mês do ano passado × média móvel de 3 meses, por categoria. A coluna do mês atual mostra o mês abreviado (out/2026).

## Simulador (oculta da navegação)

> A aba Simulador está temporariamente fora da barra de navegação — a tela e a lógica de cenários abaixo continuam existindo no código, esperando reativação.

Cenários "e se?": ligar/desligar, criar, detalhar e converter em real.

- Cada cenário tem um interruptor ligado/desligado e mostra o total dos seus lançamentos hipotéticos.
- "Detalhar" abre a lista de lançamentos e um formulário para adicionar mais: valor, categoria, data e número de parcelas.
- 1 parcela → um lançamento previsto pontual; mais de 1 → cria uma recorrência hipotética (valor total dividido pelo número de parcelas).
- "Tornar real" move os lançamentos/recorrência do cenário para os dados de verdade da box (com confirmação).
- "Excluir" apaga o cenário e todos os seus lançamentos hipotéticos (com confirmação).

**Adicionar hipotético — obrigatórios:** valor total, categoria. **Têm padrão:** data (hoje), parcelas (1).
