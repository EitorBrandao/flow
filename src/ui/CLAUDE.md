# src/ui/

Uma `Tela*.tsx` por tela: `TelaHoje`, `TelaFluxo`, `TelaLancar`, `TelaCartao`, `TelaAnalises`, `TelaAjustes` e `TelaSimulador`. `TelaSimulador` existe, mas nenhum `setAba` a alcança.

- `Shell.tsx`: controla a navegação. `ABAS` lista só as abas da barra. Ajustes entra pelo botão do topo. Lançar entra pelo `AdicionarSheet`.
- Ajustes: é uma tela-menu com dez subtelas, em `src/ui/ajustes/`.
- Sheets e modais compartilhados: `Sheet.tsx`, `AdicionarSheet.tsx`, `LancamentosSheet.tsx`.

Antes de editar a UI, consulte `docs/estilo-visual.md` (regra completa em `CLAUDE.md`, seção "Regras do repositório").
