# src/ui/

Uma `Tela*.tsx` por tela: `TelaHoje`, `TelaFluxo`, `TelaLancar`, `TelaCartao`, `TelaAnalises` e `TelaAjustes`. Simular é a terceira pílula (`AbaFluxo`) dentro do `TelaFluxo`, não uma aba própria: `SimuladorFluxo.tsx`, com `CenarioCard.tsx` por cenário.

- `Shell.tsx`: controla a navegação. `ABAS` lista só as abas da barra. Ajustes entra pelo botão do topo. Lançar entra pelo `AdicionarSheet`.
- Ajustes: é uma tela-menu com treze subtelas, agrupadas em cinco grupos (Contas, Planejamento, Cartão, Dados, Sobre o app), em `src/ui/ajustes/`.
- Sheets e modais compartilhados: `Sheet.tsx`, `AdicionarSheet.tsx`, `LancamentosSheet.tsx`.

Antes de editar a UI, consulte `docs/estilo-visual.md` (regra completa em `CLAUDE.md`, seção "Regras do repositório").
