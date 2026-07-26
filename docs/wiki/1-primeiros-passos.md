# Os primeiros passos

O Flow começa **vazio**: sem box, sem categoria, sem cartão — nem a box "casa" vem pronta. Nada é criado para você, porque nada é enviado para lugar nenhum. Esta é a ordem que funciona, do zero até o app fazendo sentido.

> Já usa o Flow em outro aparelho? Não refaça nada: vá em Ajustes, Backup, e importe o arquivo `.json` exportado do aparelho antigo. Ele traz tudo — boxes, lançamentos, cartões e configurações.

## A primeira box

Uma box é um fluxo de caixa com saldo próprio — normalmente uma conta de banco. É o primeiro passo porque todo o resto pendura nela. Fica em Ajustes, Boxes.

- **Saldo inicial:** o saldo que o app do seu banco mostra agora. Pode ser negativo.
- **Data:** o dia a que esse saldo se refere — normalmente hoje. Tudo que você lançar antes dessa data não muda o saldo inicial, então comece por hoje e deixe o passado para trás.
- **Box compartilhada:** deixar o saldo em branco cria uma box sem saldo próprio. É assim que se cria a box "casa", onde entram os gastos divididos (energia, água). Ela não aparece como opção de box padrão.

**Obrigatório:** nome. **Têm padrão:** saldo inicial (0), data (hoje).

## A primeira categoria

Sem categoria não dá para lançar — a tela Lançar fica sem nada para escolher. Crie poucas para começar: uma de ganho (salário) e três ou quatro de gasto que você reconheça no extrato. Fica em Ajustes, Categorias, com a box certa selecionada no topo.

- Categorias pertencem a **uma box**: criar em uma não cria na outra.
- O **tipo** (ganho ou gasto) decide se o valor soma ou subtrai — o mesmo nome pode existir nos dois tipos, como "pix".
- A **ordem** (↑↓) é a ordem em que elas aparecem na tela Lançar. Vale pôr as do dia a dia no topo: é o que faz o lançamento caber em três toques.
- Vai usar cartão? Crie desde já uma categoria de gasto chamada "cartão" — é ela que vai receber a fatura.

**Obrigatórios:** nome, box. **Tem padrão:** tipo (gasto).

## O primeiro lançamento

O botão **+** no meio da barra de baixo. Valor → gasto ou ganho → categoria → Lançar. É o gesto que você vai repetir todo dia, e por isso ele é curto.

- O teclado numérico já abre pronto: digite o valor sem tocar em mais nada.
- **Data futura vira previsto automaticamente**, mesmo sem marcar a caixinha — é assim que se lança uma conta que ainda vai cair.
- A **nota** é opcional, mas é ela que salva o pix: "para quem" fica registrado aí.

**Obrigatórios:** valor, categoria. **Tem padrão:** data (hoje). **Opcionais:** nota, marcar como previsto.

## A primeira recorrência

Aqui o app deixa de ser um caderno e vira uma projeção. Uma recorrência é uma regra — salário, aluguel, parcela — que gera sozinha os lançamentos `previsto` dos próximos meses. Fica em Ajustes, Recorrências.

- Comece pelas duas ou três que mais pesam: o salário e as contas fixas grandes.
- **Parcelas** em branco = sem fim (salário, aluguel); com número = acaba sozinho (um empréstimo em 12x).
- Depois disso, o gráfico da aba Fluxo deixa de ser uma linha reta: ele passa a mostrar o mês inteiro antes de ele acontecer.

**Obrigatórios:** valor, categoria. **Têm padrão:** início (hoje), dia do mês (1). **Opcional:** parcelas (vazio = sem fim).

## O primeiro cartão

O cartão tem um mundo próprio: as compras não entram no fluxo de caixa uma a uma — elas viram **uma fatura só**, lançada na box no dia do vencimento. Sem contagem dupla. Fica em Ajustes, Cartões.

- A **categoria da fatura** é uma categoria de gasto da box (aquela "cartão" do passo anterior) — é nela que a fatura aparece no seu fluxo.
- **Dia de fechamento** e **dia de vencimento** saem da fatura do seu banco. Compra feita no próprio dia do fechamento cai na fatura seguinte.
- Um cartão ativo por box: para cadastrar outro, desative o atual primeiro.
- Depois do cartão, crie ao menos uma categoria do cartão — elas são separadas das categorias da box, porque o que você compra no cartão raramente segue o mesmo recorte do orçamento.

**Obrigatórios:** nome, categoria da fatura. **Têm padrão:** box, dia de fechamento (28), dia de vencimento (5).

## A primeira compra no cartão

Aba Cartão → **+ compra**.

- **Parcelas:** 1 é à vista. Em mais de uma, o app divide ao centavo e joga o resto na primeira parcela — e cada parcela cai na fatura do mês correspondente, sem você precisar lançar de novo.
- Assinaturas (streaming, mensalidades) não se lançam a cada mês: cadastre uma vez em Ajustes → Assinaturas do cartão.
- A fatura do mês aparece montada na própria aba Cartão, e o total dela vira aquele lançamento previsto na box, no vencimento.

**Obrigatórios:** valor, categoria do cartão. **Têm padrão:** data (hoje), parcelas (1). **Opcional:** descrição.

## A primeira conferência

O app não fala com o seu banco — quem garante que os dois batem é você, e a conferência existe para isso doer pouco.

- **Na tela Hoje:** digite o saldo que o app do banco mostra. O Flow responde "bate certinho", "falta inserir no app" (esqueceu um gasto) ou "sobra no app" (lançou duas vezes).
- **Na aba Cartão:** digite o valor da fatura que o banco mostra. Se você não quiser caçar item por item, marque "usar este valor no Flow" e o total do banco passa a valer na projeção.

Fazer isso uma vez por semana é o que mantém a projeção confiável.

## O primeiro backup

**Faça hoje, não depois.** Os dados vivem só neste aparelho, dentro do navegador. Não há conta, não há servidor, não há cópia automática: perdeu o aparelho, limpou os dados do navegador ou desinstalou o app — acabou. Fica em Ajustes, Backup, Exportar.

- No celular, o botão abre o menu de compartilhamento: dá para salvar direto no Drive, no OneDrive ou mandar para você mesmo.
- Para levar tudo para outro aparelho, é o mesmo arquivo: importe do outro lado.
- A tela Hoje avisa quando há mudanças e o último backup ficou velho — quando o aviso aparecer, ele está falando sério.
