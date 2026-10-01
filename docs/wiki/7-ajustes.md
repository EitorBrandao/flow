# Ajustes

Atrás do ícone ⚙️ no topo. O menu tem cinco grupos; toque num grupo para ver as seções dele. O botão "‹" no topo da seção volta ao grupo, e o do grupo volta ao menu.

- **Contas:** Boxes e Bancos.
- **Planejamento:** Categorias, Recorrências e Viagens.
- **Cartão:** Cartões, Categorias do cartão e Assinaturas do cartão.
- **Dados:** Importar e conferir, e Backup e restauração.
- **Sobre o app:** Wiki e Versão.

Nas seções de cadastro, o formulário no topo serve para criar; para editar, toque no lápis do próprio item.

## Categorias

Por box selecionada: criar, renomear, reordenar (arraste pela alça ⋮⋮) e arquivar/restaurar. Ganhos aparecem antes dos gastos, cada grupo na ordem definida.

**Nova categoria — obrigatórios:** nome, box. **Tem padrão:** tipo (gasto).

## Recorrências

CRUD das regras que geram previstos automaticamente (veja [Recorrência](#conceitos/recorrencia), no capítulo Conceitos e modelo de dados).

- Ao editar (toque no lápis), recalcula na hora os previstos ainda não confirmados — pendentes (data já passada) inclusive.
- "Desativar" para a regra e tira os previstos dela ainda não confirmados; os confirmados ficam. "Ativar" volta a gerar os previstos a partir de hoje.
- Excluir remove a regra e seus previstos — os já confirmados ficam.

**Obrigatórios:** valor, categoria. **Têm padrão:** início (hoje), dia do mês (1). **Opcional:** parcelas (vazio = sem fim). Com dois ou mais bancos na box, a recorrência também escolhe o banco (padrão: o banco padrão da box); os previstos saem dele.

## Boxes

Toque no lápis de cada box para editar nome, saldo inicial e data; crie boxes novas pelo formulário no topo; escolha a box padrão que abre ao iniciar o app.

Saldo inicial negativo é aceito (digitar com "−" na frente). Uma box sem saldo próprio (como a casa) serve aos gastos divididos, e escolher "casa" no topo soma todas as suas boxes. Ela não pode virar padrão.

**Nova box — obrigatório:** nome. **Têm padrão:** saldo (0), data do saldo (hoje). Lançamentos até a data do saldo, ela inclusive, já estão dentro dele e não o mudam.
**Ao editar — obrigatório:** nenhum; desmarcar "Esta box tem saldo próprio" torna a box compartilhada.

## Bancos

Uma box representa a **pessoa**, e uma pessoa costuma ter mais de uma conta. Aqui você cadastra os [bancos](#glossario/banco) de cada box e informa quanto tem em cada um.

Serve para conferir: a tela Hoje passa a mostrar uma linha por banco, e a diferença contra a projeção é calculada sobre a soma. Sem bancos cadastrados, a conferência usa um único campo de saldo.

> O saldo de cada banco é o último saldo **informado por você** mais os lançamentos efetivos desse banco depois da data informada. O que caiu no mesmo dia do saldo informado já está nele: só contam os lançamentos de depois dessa data. Informar um novo valor, na tela Hoje, recomeça a conta. Lançamento sem banco não entra na conta de nenhum banco.

Cada banco mostra o saldo, a data em que você o informou e quantos cartões estão vinculados a ele. Com dois ou mais bancos na box, um deles é o **padrão**: aparece com o selo "padrão" e vem marcado em todo lançamento novo. Toque em "Tornar padrão" para trocar. Excluir um banco desliga o vínculo dos cartões, dos lançamentos e das recorrências que apontavam para ele — nada é apagado.

No editor de lançamento, a fatura paga, o previsto de recorrência e a transferência não trocam de banco: a fatura segue o banco do cartão e o previsto segue a regra da recorrência.

**Obrigatórios:** nome. **Têm padrão:** box (a selecionada no topo; na visão casa, a box "casa"), saldo (não informado).

## Cartões

Cadastre cartões no formulário no topo; para editar, toque no lápis do item. Configure nome, dia de fechamento, dia de vencimento e, se a box tiver bancos cadastrados, o banco dono do cartão. A fatura do cartão sai desse banco; sem banco no cartão, sai do banco padrão da box. A categoria de gasto que recebe a [[fatura]] o app cria sozinho, com o nome do cartão.

Uma box pode ter vários cartões **ativos** ao mesmo tempo. "Desativar" desliga o cartão por completo: para de sincronizar a fatura como lançamento, e some da tela Cartão e do menu Adicionar.

Cada cartão tem ainda um segundo controle, independente: **"Bloquear"/"Permitir"**. Ele só afeta o menu Adicionar → "Compra no cartão": um cartão bloqueado não entra na lista de escolha, nem no [atalho](#glossario/atalho-de-lancamento) que pula direto pro formulário quando sobra um só. A fatura continua sincronizando, e as assinaturas continuam gerando compra todo mês. Serve para um cartão que só existe para receber assinaturas, sem você nunca lançar uma compra avulsa nele.

**Obrigatório:** nome. **Têm padrão:** box (a primeira com saldo próprio), dia de fechamento (28), dia de vencimento (5), banco (sem banco). O campo de banco só aparece se a box tiver algum cadastrado.

## Categorias do cartão

Mesmo padrão de Categorias, mas por cartão em vez de por box — sem separação ganho/gasto (é tudo gasto dentro da fatura).

**Obrigatórios:** nome, cartão (pré-selecionado o primeiro da lista).

## Assinaturas do cartão

Gastos recorrentes no cartão — streaming, mensalidades — cadastrados uma vez só: uma compra nova aparece sozinha todo mês, na fatura certa.

Excluir mantém as compras passadas geradas pela assinatura; só as futuras somem.

**Obrigatórios:** valor, categoria do cartão. **Têm padrão:** início (hoje), dia do mês (1). **Opcionais:** parcelas (vazio = sem fim), descrição.

## Viagens

Cadastro das [viagens](#conceitos/viagem): nome, data inicial, data final e, se quiser, um orçamento. O app recusa um período que se sobrepõe a outra viagem. Viagem com orçamento mostra, na lista, quanto já foi gasto e quanto falta.

Excluir tira só a marcação de viagem; os lançamentos e as compras continuam existindo.

**Obrigatórios:** nome, data inicial, data final. **Opcional:** orçamento.

## Backup e restauração

- **Exportar:** gera um `.json` com tudo; no Android abre o menu de compartilhamento do sistema, no PC baixa o arquivo.
- **Restaurar:** escolher **substituir tudo** ou **mesclar** (registro a registro; em conflito, vence o alterado mais recentemente). A confirmação é sempre pedida antes de aplicar.
- Depois de **mesclar**, a tela Hoje avisa que há mudanças não salvas em backup: o resultado não está inteiro em nenhum arquivo, e recuperá-lo exigiria os dois. Faça um backup novo para juntar tudo num arquivo só. Depois de **substituir tudo**, não há aviso: os dados são exatamente os do arquivo.
- Backup com formato de dados mais novo do que este app ainda entende é rejeitado, com mensagem clara — nada é alterado.
- Backup antigo (de antes da aba Cartão) restaura normalmente; o que ainda não existia na época — cartões, compras e assinaturas — entra vazio.

**Restaurar — obrigatório:** selecionar um arquivo `.json` de backup do Flow.

## Importar e conferir

Serve para dois casos: você passou uns dias sem lançar, ou quer conferir o Flow contra o banco. Em vez de digitar tudo de novo, entregue o arquivo do banco: o Flow compara cada linha com o que já está lançado.

A tela avisa que outros bancos ainda não são lidos. Hoje o Flow lê três arquivos: o extrato da conta Nubank e a fatura do cartão Nubank, os dois em CSV,
e a fatura do cartão Santander, em PDF. Baixe o arquivo direto no site ou no aplicativo do banco.

A tela tem três passos, e nada é gravado antes do terceiro:

- **Arquivo.** Escolher o CSV ou o PDF. O Flow reconhece o formato sozinho; se não reconhecer, você escolhe manualmente.
- **Destino.** Para o extrato de conta: a box e, se ela tiver mais de um banco cadastrado, o banco. Para a fatura: o cartão de cada bloco — a fatura pode trazer mais de um cartão, e "Não importar" é resposta válida para um bloco. A lista de cartões mostra só os da box selecionada no momento; na visão consolidada de todas as boxes, aparecem os cartões de qualquer uma.
Se dois blocos vão para o mesmo cartão (por exemplo, titular e adicional), o Flow os confere juntos, como uma fatura só.
- **Conferir.** A lista mostra cada linha do arquivo já comparada com o Flow. Só ao tocar em "Confirmar" algo é gravado.

> Você pode sair da tela no meio da conferência: o arquivo, os destinos e as decisões ficam guardados enquanto o app estiver aberto, e o menu de Ajustes mostra "Conferência em andamento" em Importar e conferir. Só "Confirmar" ou "Escolher outro arquivo" apagam o que foi guardado.

> Quando alguma linha do arquivo não é reconhecida, "Ver linhas não reconhecidas" mostra o texto de cada uma — para diagnóstico. Nas faturas, "Copiar texto extraído" também aparece nesse caso, com o texto bruto que o Flow leu do arquivo. Os dois contêm os dados da sua fatura ou do seu extrato.

Cada item da lista chega classificado num destes seis estados:

: Confere | Já existe um lançamento igual no Flow. Sem botão: não há nada a fazer.
: Previsto | Casa com um previsto ou uma recorrência ainda não confirmada. "Confirmar" dá baixa nele; "Descartar" ignora a linha.
: Divergente | Casa por data e descrição, mas o valor é outro. "Confirmar", que já mostra o valor do banco, grava esse valor; "Descartar" ignora a linha.
: Novo | Não existe nada parecido no Flow. "Adicionar" cria o lançamento ou a compra do cartão; "Descartar" ignora a linha. Algumas linhas novas vêm sem botão, só com aviso — como um pagamento de fatura sem fatura correspondente, que pede para você olhar o cadastro do cartão em vez de criar algo solto.
: [[Sobra]] | Está lançado no Flow, dentro do período do arquivo, mas não aparece no banco. "Manter" deixa como está; "Excluir do app" apaga. A ação padrão é sempre manter — excluir nunca é automático, porque o banco pode não ter processado ainda.
: Interno | Movimento que não é ganho nem gasto de verdade. "Ignorar" não grava nada.

> Acima da lista, cada estado é uma pílula com a contagem e, embaixo, a soma dos valores dos itens daquele estado; as pílulas de previsto e divergente só aparecem quando há itens nesses estados; toque numa pílula para ver só os itens daquele estado, e toque de novo para ver todos — o filtro só muda o que aparece, nunca o que "Confirmar" grava.

> Um botão no topo da lista, "Marcar todos como ignorar", zera as decisões de uma vez, para você escolher só o que quer aceitar; com um filtro ativo, ele vira "Marcar os visíveis como ignorar" e afeta só o que está filtrado.

**A aplicação na caixinha do Nubank** aparece como Interno, com um botão a mais: "É saída de verdade". O Flow não sabe se você só guardou o dinheiro — que continua seu, é movimento interno — ou mandou para uma reserva que não entra mais no saldo, uma saída de verdade. Por isso ele pergunta, em vez de decidir sozinho. O resgate da caixinha, ao contrário, é sempre interno, sem pergunta: o dinheiro sai dela para ser gasto, e esse gasto já aparece como outra linha do extrato.

**Uma compra parcelada** da fatura volta a ser a compra original: o Flow lê a data da compra e o total de parcelas, remonta o valor cheio e passa a projetar sozinho as parcelas futuras — como se você tivesse lançado a compra inteira no dia em que ela aconteceu. Se o total remontado não bater com a fatura por arredondamento, "Corrigir compra" deixa ajustar o valor antes de confirmar.

**A fatura do Nubank não traz o dia da compra das parcelas antigas.** Da segunda parcela em diante, o arquivo traz a data em que o ciclo da fatura abriu. O Flow estima a data da compra pelo número da parcela e marca a linha com "(estimada)". Em "Corrigir compra", o calendário só aceita o ciclo em que a primeira parcela caiu; "Voltar para a data estimada" desfaz a correção. Se a compra já estiver cadastrada no app, a parcela aparece como Confere, com a data do app.

**Um lançamento novo** entra na categoria ["A classificar"](#glossario/a-classificar) — ou "A classificar (entrada)", quando é uma entrada de dinheiro na box. É uma categoria comum e visível, igual a qualquer outra: reclassifique quando quiser, em Categorias ou em Categorias do cartão.

O que esta versão não faz:

- Não grava [[estorno]] de cartão — ele aparece como Interno, com a explicação na lista.
- Não deixa escolher o banco de um lançamento de conta.
- Não lê a fatura do cartão Nubank, nem arquivo OFX ou zip.

## Wiki

Esta documentação. O botão Índice abre a lista de capítulos e a busca, que procura no texto inteiro, sem acento e sem diferença de maiúscula.

- **Link azul:** leva a outro capítulo, ou a uma seção dele. Link para um site abre numa aba nova.
- **Termo com sublinhado pontilhado:** é um termo do glossário. Tocar nele abre a definição logo abaixo, sem sair do capítulo. Tocar fora, tocar de novo no termo ou rolar a tela fecha o balão. No computador, a tecla Esc também fecha.
