# Telas

Todas respeitam o seletor de box no topo (no exemplo: `{{boxA}}` / `{{boxB}}` / `casa`), exceto onde indicado.

> **Sobre "obrigatório" nesta wiki:** a UI do app não marca campos com asterisco — isso é só documentação. "Obrigatório" quer dizer que o botão de salvar/criar não faz nada (silenciosamente) se o campo estiver vazio ou inválido. Campos com valor padrão pronto (ex.: data = hoje, parcelas = 1) contam como preenchidos mesmo sem o usuário tocar neles.

## Hoje

Tela inicial. Foco em "onde estou agora" e no que precisa de atenção. Três abas: Visão, Conferir e Pendentes.

- **Visão:** saldo efetivo em destaque; se o projetado difere, aparece logo abaixo. Mini-gráfico da janela de 7 dias atrás a 28 dias à frente.
- **Conferir:** campo para digitar o saldo que o app do banco mostra + data; o app calcula a diferença ("bate certinho", "falta inserir no app" ou "sobra no app — confira duplicado"). Se a box tiver bancos cadastrados, vira uma linha por banco, com o total informado abaixo — a diferença passa a ser calculada contra essa soma.
- **Pendentes:** fila de previstos vencidos, com confirmar (✓) ou descartar (✕) em um toque. O rótulo da aba mostra quantos itens esperam.
- **Aviso de backup:** banner acima das abas, quando há mudanças e o último backup passou de 7 dias — toca e vai direto para Ajustes → Backup.

**Conferência de saldo — obrigatório:** saldo real no banco. **Tem padrão:** data (hoje).

> Com bancos cadastrados, enquanto nenhum saldo for informado a tela não mostra diferença nenhuma. Acusar um descasamento do tamanho do saldo inteiro só porque você ainda não digitou seria mentira.

Cada linha de banco tem o botão de sinal, então conta no cheque especial se informa como negativa. Salvar grava só os bancos cujo valor você realmente mudou — encostar num campo e desistir não mexe no que já estava lá.

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

**Obrigatórios:** valor, categoria. **Têm padrão:** data (hoje). **Opcionais:** nota, marcar como previsto.

## Fluxo

A linha do tempo do dinheiro. Duas abas: Lista (padrão) e Gráfico.

- **Lista** mostra por padrão os últimos 14 dias para frente; o ícone de lupa abre busca e filtros (texto, data única ou período; botão "+30 dias atrás" estende a janela). Cada dia mostra seu saldo projetado no cabeçalho.
- **Gráfico** mostra o histórico e a projeção completa até o horizonte configurado, numa área maior que o mini-gráfico de Hoje; linha extra tracejada quando há cenário ligado; toque no card abre em tela cheia.
- Tocar num lançamento, na Lista, abre o editor (valor, data, categoria, nota); previstos podem ser confirmados ali mesmo; previstos vindos de recorrência avisam para editar a regra em Ajustes se for para mudar valor/data permanentemente.

**Editor de lançamento — obrigatórios:** valor, data, categoria. **Opcional:** nota.

## Cartão

Aba dedicada à fatura do cartão da box selecionada (ou os dois cartões empilhados, na visão casa). Cada fatura tem três abas: Resumo, Lançamentos e Conferência.

- Mostra a fatura do mês atual por padrão, com navegação ‹ mês anterior / mês seguinte ›.
- Cabeçalho, sempre visível fora das abas: total da fatura, dia de fechamento e de vencimento.
- **Resumo:** valor pago ou a pagar, com atalho para corrigir; resumo por categoria do cartão quando há mais de uma categoria na fatura — tocar numa categoria já pula para Lançamentos filtrado por ela.
- **Lançamentos:** busca por descrição, categoria, data ou valor; itens agrupados em À vista/Parceladas, com marcação de parcela (ex.: "3/12"); tocar abre edição; excluir remove a compra e todas as parcelas dela.
- **Conferência:** campo "valor no app do banco"; mostra "falta bater R$ X" ou "✓ batido"; checkbox "usar este valor no Flow" (desmarcada por padrão). O rótulo da aba mostra ✔️ ou ⚠️ assim que existe uma conferência salva — dá para saber se bate sem entrar na aba.
- Botão "+ compra" na própria tela (valor, data, categoria do cartão, parcelas, descrição).
- Sem cartão cadastrado para a seleção: mostra atalho direto para cadastrar em Ajustes.

**+ compra — obrigatórios:** valor, categoria do cartão. **Têm padrão:** data (hoje), parcelas (1). **Opcional:** descrição.
**Conferência — obrigatório:** nenhum; campo vazio só limpa a conferência do mês (não bloqueia nada).

## Análises

Resumo mensal e comparativos, navegando mês a mês (◀ ▶).

- Caixa "incluir previstos" — desligada, mostra só o que já é efetivo no mês.
- **Resumo:** ganhos, gastos e sobra do mês.
- **Por categoria:** total de cada categoria e seu percentual da renda do mês (só para categorias de gasto).
- **Comparativo:** mês atual × mês anterior × mesmo mês do ano passado × média móvel de 3 meses, por categoria.

O detalhamento do cartão fica na própria aba Cartão — ainda não está integrado aqui.

## Simulador (oculta da navegação)

> A aba Simulador está temporariamente fora da barra de navegação — a tela e a lógica de cenários abaixo continuam existindo no código, esperando reativação.

Cenários "e se?": ligar/desligar, criar, detalhar e converter em real.

- Cada cenário tem um interruptor ligado/desligado e mostra o total dos seus lançamentos hipotéticos.
- "Detalhar" abre a lista de lançamentos e um formulário para adicionar mais: valor, categoria, data e número de parcelas.
- 1 parcela → um lançamento previsto pontual; mais de 1 → cria uma recorrência hipotética (valor total dividido pelo número de parcelas).
- "Tornar real" move os lançamentos/recorrência do cenário para os dados de verdade da box (com confirmação).
- "Excluir" apaga o cenário e todos os seus lançamentos hipotéticos (com confirmação).

**Adicionar hipotético — obrigatórios:** valor total, categoria. **Têm padrão:** data (hoje), parcelas (1).
