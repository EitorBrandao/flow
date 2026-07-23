# Nível 6 — Mudar a linguagem visual

**Você está no nível certo?** Sim, se a mudança altera qualquer regra de `fundamentos.md` ou
`transversais.md`. Sinais claros: criar tema claro · nova cor de ação · verde/vermelho fora
de dinheiro · borda em card/item · fonte nova · mudar valor de token · raio fora da escala ·
tipo de animação novo · sheet para formulários de Ajustes.

## Regra única

**PARE. Não implemente.** Mudança de linguagem não é decisão de implementação:

1. Abra uma conversa de brainstorming **com o usuário** e registre a decisão **dele** em
   uma spec: `docs/superpowers/specs/AAAA-MM-DD-<tema>-design.md` (o quê, por quê, o que
   substitui). Registrar uma decisão própria sem essa conversa não cumpre este passo.
2. Só depois da spec aprovada — **aprovada = a spec contém a linha
   `Status: aprovada em AAAA-MM-DD`, escrita depois de o usuário confirmar
   explicitamente** — atualize `fundamentos.md`/`transversais.md` (a regra nova), os
   capítulos de nível afetados e **então** o código.
3. Guia e código mudam no mesmo branch — o guia nunca fica mentindo sobre o app.

**Se você é um subagente** executando uma tarefa e caiu neste nível: a tarefa precisa
citar uma spec que (a) **exista**, (b) tenha **`Status: aprovada`** e (c) **cubra
exatamente a mudança pedida** — confira as três coisas. Faltando qualquer uma:
**interrompa e reporte ao orquestrador.** Não decida sozinho.
