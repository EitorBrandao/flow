# Visão geral

Flow é um app de controle financeiro pessoal: troca a planilha de fluxo de caixa diário — uma aba por ano, saldo projetado na coluna do lado — por um PWA que roda no celular e no PC, sem servidor nenhum atrás.

- **100% local:** dados no `IndexedDB` do aparelho (via Dexie). Sem servidor, sem conta, sem sincronização automática entre dispositivos.
- **Offline por completo:** instalável como PWA no Android; funciona igual no navegador do PC.
- **Duas pessoas, uma casa:** no exemplo desta documentação, {{nomeA}} e {{nomeB}} têm cada um sua box com saldo próprio; uma visão **casa** consolida as duas mais os gastos compartilhados (energia, água, ajustes). Quem usa sozinho tem uma box só — a casa continua servindo para separar o que é da casa.
- **Lançar rápido, entender fundo:** o fluxo de entrada manual é de poucos toques; o motor de projeção e as análises fazem o trabalho pesado de mostrar para onde o dinheiro está indo.

> A barra inferior tem 5 abas: **Hoje**, **Fluxo**, o botão central **+** (Lançar), **Cartão** e **Análises**. Ajustes fica atrás do ícone ⚙️ no topo, junto do seletor de box (no exemplo: `{{boxA}}` / `{{boxB}}` / `casa`).

> A aba **Simulador** (cenários) foi ocultada temporariamente da navegação, a pedido do usuário — o código e a lógica de cenários continuam intactos, só falta o botão na barra. Veja o capítulo sobre Telas e a documentação interna para reativar.
