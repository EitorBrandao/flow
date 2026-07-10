# Nível 6 — Mudar a linguagem visual

**Você está no nível certo?** Sim, se a mudança altera qualquer regra de `fundamentos.md` ou
`transversais.md`. Sinais claros: criar tema claro · nova cor de ação · verde/vermelho fora
de dinheiro · borda em card/item · fonte nova · mudar valor de token · raio fora da escala ·
tipo de animação novo · sheet para formulários de Ajustes.

## Regra única

**PARE. Não implemente.** Mudança de linguagem não é decisão de implementação:

1. Abra uma conversa de brainstorming com o usuário e registre a decisão em uma spec:
   `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md` (o quê, por quê, o que substitui).
2. Só depois da spec aprovada: atualize `fundamentos.md`/`transversais.md` (a regra nova),
   os capítulos de nível afetados e **então** o código.
3. Guia e código mudam no mesmo branch — o guia nunca fica mentindo sobre o app.

**Se você é um subagente** executando uma tarefa e caiu neste nível sem que a tarefa cite
uma spec aprovada: **interrompa e reporte ao orquestrador.** Não decida sozinho.
