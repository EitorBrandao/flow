# Glossário

: efetivo | Lançamento confirmado; entra no saldo real.
: previsto | Ainda não aconteceu (ou não foi confirmado); entra só na projeção.
: pendente | [Previsto](#glossario/previsto) cuja data já chegou/passou — espera confirmação na tela Hoje.
: box casa | Visão consolidada das boxes pessoais + gastos compartilhados; sem saldo próprio, calculada na hora.
: cenário | Conjunto de lançamentos hipotéticos, ligável/desligável, para simular "e se?" — aba Simulador temporariamente oculta da navegação.
: fatura | Não fica pronta guardada em lugar nenhum: o app monta ela na hora, a partir das compras do cartão e do ciclo de fechamento.
: ciclo de fechamento | Janela de datas de compra que cai numa mesma fatura, contada a partir do dia de fechamento do cartão.
: conferência | Comparação manual entre o saldo/fatura do app do banco e o que está lançado no Flow.
: banco | Conta bancária dentro de uma box, com saldo informado por você. Serve para conferir cada conta em separado; não é calculado a partir dos lançamentos.
: parcelamento de fatura | Sobra de uma fatura paga em parte, dividida em parcelas pelo banco ou jogada inteira no mês seguinte. Vira uma compra do cartão e entra nas faturas seguintes.
: horizonte de projeção | Até onde o app calcula o saldo projetado à frente.
: atalho de lançamento | Combinação de categoria e destino (box ou cartão) que você mais repetiu nos últimos dois meses, com o valor da última vez. Aparece ao tocar no (+), para encurtar o caminho — abre o formulário preenchido, sem gravar nada.
: chave de acesso | Número de 44 dígitos que identifica uma nota fiscal eletrônica; extraído do QR-code, é usado para buscar o XML da nota fora do Flow.
: item da nota | Uma linha de produto do XML da nota fiscal (nome e valor); o Flow usa os itens para mostrar como o total de uma compra do cartão se distribuiu.
: transferência entre bancos | Mover saldo declarado de um banco para outro da mesma box (Hoje → Conferir). Ajusta o saldo dos dois na hora e cria um lançamento de saída e um de entrada, visíveis no Fluxo mas fora dos totais de Análises — não é ganho nem gasto real.
: conferência por extrato | Importar o extrato do banco ou a fatura do cartão em Ajustes e comparar cada linha com o que já está lançado, item a item, antes de decidir o que gravar. Diferente da conferência manual: aqui é o Flow que classifica, e você só ajusta o que discorda.
: sobra | Num extrato importado, um lançamento que está no Flow mas não aparece no arquivo do banco, dentro do período que o arquivo cobre. Chama atenção para um lançamento duplicado ou inventado; a ação padrão é manter, nunca excluir.
: a classificar | Categoria criada sob demanda, na box ou no cartão, para o lançamento novo de uma conferência por extrato — "a classificar (entrada)" quando é entrada na box. Reclassifique quando quiser, em Categorias ou em Categorias do cartão.
