# Ajustes

Atrás do ícone ⚙️ no topo. Um menu simples leva a cada seção abaixo.

## Categorias

Por box selecionada: criar, renomear, reordenar (↑↓) e arquivar/restaurar. Ganhos aparecem antes dos gastos, cada grupo na ordem definida.

**Nova categoria — obrigatórios:** nome, box. **Tem padrão:** tipo (gasto).

## Recorrências

CRUD das regras que geram previstos automaticamente (veja o capítulo Conceitos e modelo de dados).

- Editar recalcula os previstos futuros ainda não confirmados na hora.
- "Pausar" desativa sem apagar a regra; "Ativar" retoma a materialização.
- Excluir remove a regra e seus previstos — os já confirmados como `efetivo` ficam.

**Obrigatórios:** valor, categoria. **Têm padrão:** início (hoje), dia do mês (1). **Opcional:** parcelas (vazio = sem fim).

## Boxes

Editar nome, saldo inicial e data de cada box; criar boxes novas; escolher a box padrão que abre ao iniciar o app.

Saldo inicial negativo é aceito (digitar com "−" na frente). Uma box sem saldo próprio (como a casa) aparece como "compartilhada" e não pode virar padrão.

**Nova box — obrigatório:** nome. **Têm padrão:** saldo inicial (0), data (hoje).
**Editar box — obrigatório:** nenhum; deixar saldo/data em branco torna a box "sem saldo próprio" (compartilhada).

## Cartões

Cadastrar/editar o cartão de cada box: nome, dia de fechamento, dia de vencimento e a categoria de gasto do Flow que recebe a fatura.

Só um cartão **ativo** por box — tentar ativar um segundo mostra aviso pedindo para desativar o atual primeiro.

**Obrigatórios:** nome, categoria da fatura (pré-preenchida com a categoria "cartão" da box, se existir). **Têm padrão:** box (a primeira com saldo próprio), dia de fechamento (28), dia de vencimento (5).

## Categorias do cartão

Mesmo padrão de Categorias, mas por cartão em vez de por box — sem separação ganho/gasto (é tudo gasto dentro da fatura).

**Obrigatórios:** nome, cartão (pré-selecionado o primeiro da lista).

## Assinaturas do cartão

CRUD das `RecorrenciaCartao` — gastos recorrentes no cartão (streaming, mensalidades…) que viram `CompraCartao` automaticamente todo mês.

Excluir mantém as compras passadas geradas pela assinatura; só as futuras somem.

**Obrigatórios:** valor, categoria do cartão. **Têm padrão:** início (hoje), dia do mês (1). **Opcionais:** parcelas (vazio = sem fim), descrição.

## Backup e restauração

- **Exportar:** gera um `.json` com tudo (schema + dados); no Android abre o menu de compartilhamento do sistema, no PC baixa o arquivo.
- **Restaurar:** escolher **substituir tudo** ou **mesclar** (por `id`; em conflito, vence o registro alterado mais recentemente). A confirmação é sempre pedida antes de aplicar.
- Backup de versão de schema mais nova que o app entende é rejeitado com mensagem clara — nada é alterado.
- Backup antigo (de antes da aba Cartão) restaura normalmente; as tabelas novas entram vazias.

**Restaurar — obrigatório:** selecionar um arquivo `.json` de backup do Flow.
