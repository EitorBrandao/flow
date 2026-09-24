# Visão geral

Flow é um app de controle financeiro pessoal. Troca a planilha de fluxo de caixa diário — uma aba por ano, saldo projetado na coluna do lado — por um PWA que roda no celular e no PC, sem servidor atrás.

- **100% local:** dados no `IndexedDB` do aparelho (via Dexie). Sem servidor, sem conta, sem sincronização automática entre dispositivos.
- **Offline por completo:** instalável como PWA no Android; funciona igual no navegador do PC.
- **Duas pessoas, uma casa:** no exemplo desta documentação, {{nomeA}} e {{nomeB}} têm cada um sua box com saldo próprio. Uma visão **casa** consolida as duas, mais os gastos compartilhados (energia, água, ajustes). Quem usa sozinho tem uma box só — a casa continua separando o que é dela.
- **Lançar rápido, entender fundo:** a entrada manual é de poucos toques. O motor de projeção e as análises fazem o trabalho pesado: mostram para onde o dinheiro vai.

> A barra inferior tem 5 abas: **Hoje**, **Fluxo**, o botão central **+** (Lançar), **Cartão** e **Análises**. Ajustes fica atrás do ícone ⚙️ no topo, junto do seletor de box (no exemplo: `{{boxA}}` / `{{boxB}}` / `casa`).

> A aba **Simulador** (cenários) está temporariamente oculta da navegação, a pedido do usuário — o código e a lógica de cenários continuam intactos, só falta o botão na barra. Veja [Simulador](#telas/simulador-oculta-da-navegacao), no capítulo Telas, e a documentação interna, para reativar.
