# Saldo de um dia futuro no Fluxo e rodapé de backup na Hoje

Status: aprovada em 2026-09-23 — não implementada

Duas entregas independentes, desenhadas juntas porque saíram da mesma revisão do backlog.
São os itens 8 (entrega 1) e 5 do `TODO.md`. Cada uma vai num branch próprio, na ordem A → B,
com mockup aprovado antes do código.

---

## A. Item 8, entrega 1 — o dia filtrado sempre aparece

### Problema

A aba Fluxo → Lista só monta os dias que têm lançamento (`TelaFluxo.tsx:111-113`, `diasSet`
sai de `porDia.keys()`). Quem filtra um dia futuro calmo para saber "quanto vou ter no dia X?"
recebe "Nenhum resultado para a busca." e nenhum saldo. A pergunta costuma ser feita sobre um
dia em que nada acontece — exatamente onde a tela não responde.

Há um segundo defeito, latente: o cabeçalho usa `saldoPorDia.get(dia) ?? 0`
(`TelaFluxo.tsx:186-187`). Um dia fora da série de `projetarBoxes` mostraria **R$ 0,00** como
se fosse o saldo. Hoje não aparece porque ninguém tem lançamento depois do horizonte. A
correção acima abre esse caminho, então as duas entram juntas.

### Comportamento

**Filtro de dia único.** O dia escolhido sempre entra na lista. Sem lançamento, o bloco do dia
mostra o cabeçalho normal (data e saldo) e, abaixo, a linha `.sub` "Nenhum lançamento neste
dia.". A frase "Nenhum resultado para a busca." deixa de aparecer para filtro de data.

**Filtro de período.** O primeiro e o último dia do período sempre entram. Os dias do meio
continuam aparecendo só se tiverem lançamento — um período de três meses não vira noventa
cabeçalhos vazios.

**Diferença em relação a hoje.** Com filtro de data ligado, todo dia **futuro** listado
(`dia > hoje`) ganha a pílula `.delta` que a Hoje já usa, com a mesma base de cálculo:

- `delta = saldoProjetado(dia) − saldoEfetivo(hoje)` — a mesma conta do card de saldo da Hoje
  (`TelaHoje.tsx`, "nos próximos 28 dias").
- Texto: `+R$ 450,00 em relação a hoje` / `−R$ 450,00 em relação a hoje`. O sinal fica colado
  ao valor e o menos é o `−` (U+2212), como nos valores da Lista e na diferença das
  conferências (`TelaFluxo.tsx:206`, `TelaHoje.tsx:84`, `TelaCartao.tsx:78-79`).
- Cor relativa ao sinal: `.delta.pos` (verde) para diferença positiva, `.delta.neg`
  (vermelho) para negativa.
- Delta zero não mostra pílula, como na Hoje.
- Dia de hoje ou do passado não mostra pílula.
- Sem filtro de data, a lista normal não muda.

**Dia sem saldo na série.** Quando `saldoPorDia` não tem o dia:

- O cabeçalho mostra `—` no lugar do valor, sem cor de sinal. Nunca `R$ 0,00`.
- Se o dia for depois de `config.horizonteProjecao`, o bloco mostra a linha `.sub`
  "A projeção vai até DD/MM/AAAA.".
- O horizonte não tem controle na UI (é 31/12 do ano seguinte, estendido sozinho por
  `horizonteMinimo` em `repo.ts`). Por isso não há "estender horizonte" a oferecer.

### Fora de escopo

- **Tooltip no `BalanceChart`** (tocar/arrastar no gráfico mostra o saldo do dia). Vira a
  entrega 2 do item 8: é outro componente, com gesto próprio, e toca Hoje, Fluxo e o gráfico
  expandido.
- Mudar o horizonte de projeção.

### Consistência entre telas

- A pílula de diferença é a mesma `.delta` da Hoje, com a mesma base de cálculo. Nenhuma frase
  nova além de "em relação a hoje", que é o equivalente de "nos próximos 28 dias".
- **A pílula da Hoje passa a usar sinal também** (decidido em 2026-09-23). Hoje ela usa seta
  (`▲ R$ 800,00 nos próximos 28 dias`); com a pílula nova usando sinal, o mesmo conceito —
  diferença de saldo projetado — apareceria de dois jeitos. No mesmo branch, a da Hoje vira
  `+R$ 800,00 nos próximos 28 dias` / `−R$ 800,00 nos próximos 28 dias`, com as mesmas
  classes `.delta.pos`/`.delta.neg` que já tem. O teste da Hoje que confere o texto da pílula
  muda junto, e o dossiê é regenerado.
- O `—` para ausência de valor é o marcador que o app já usa: a média sem dado em Análises
  (`TelaAnalises.tsx:162`) e o total sem valor na Hoje (`TelaHoje.tsx:235`).

### CSS

Nível 1 do guia (só classes existentes: `.cabecalho-dia`, `.total-dia`, `.delta`, `.sub`). Se o
mockup pedir espaçamento próprio para a linha da pílula, vira nível 2 e entra no catálogo.

### Testes (`src/ui/TelaFluxo.test.tsx`)

- Filtrar um dia futuro sem lançamento mostra o cabeçalho com o saldo projetado e "Nenhum
  lançamento neste dia.", e não mostra "Nenhum resultado para a busca.".
- Filtrar um período sem lançamento nas pontas mostra o primeiro e o último dia; um dia do
  meio sem lançamento não aparece.
- Dia futuro filtrado mostra a diferença em relação a hoje, com o sinal e a cor certos nas duas
  direções; dia de hoje e dia passado não mostram.
- Dia depois do horizonte mostra `—` e "A projeção vai até …", e o texto `R$ 0,00` não aparece
  no cabeçalho.
- A lista sem filtro continua igual (teste de regressão sobre os testes existentes).

### Entrega

- Regenerar o dossiê (`npm run dossie`) se o texto capturado do Fluxo mudar.
- Wiki: `docs/wiki/6-telas.md`, seção Fluxo — o dia filtrado sempre aparece, com o saldo e a
  diferença em relação a hoje.
- Fragmento `changelog.d/alterado-saldo-dia-futuro.md`, citando também a pílula da Hoje, que troca a seta pelo sinal.

---

## B. Item 5 — rodapé de backup na Visão

### Problema

O aviso de backup da Hoje (`TelaHoje.tsx:276-278`, render na linha 336) só aparece quando há
mudanças **e** o último backup passou de 7 dias. É invisível na janela em que o dado novo
ainda não tem cópia nenhuma, e some assim que você exporta — nunca vira hábito. Para quem
chega agora ao app, é o que separa "perdi o celular" de "perdi tudo".

### Comportamento

Um indicador **sempre visível** no rodapé da aba Visão, logo abaixo do card de saldo. Não
aparece no primeiro uso (`estadoPrimeiroUso`), porque ali a Visão mostra outra coisa. Tocar
leva a Ajustes → Backup (`abrirAjustes('backup')`, como o aviso atual).

**Três estados:**

| Estado | Quando | Aparência |
|---|---|---|
| neutro | `mudancasDesdeBackup` falso | linha discreta, cor `--muted` |
| aviso | há mudanças e o último backup tem menos de 7 dias | `.aviso` (âmbar) |
| urgente | há mudanças e o backup nunca foi feito ou tem 7 dias ou mais | `.aviso.aviso-urgente` (vermelho) |

**Texto** — as frases de Ajustes → Backup, para as duas telas dizerem o mesmo:

- `Último backup: hoje` / `ontem` / `há N dias` / `nunca`.
- Com mudanças: acrescenta ` · há mudanças não salvas em backup` (frase atual de `Backup.tsx:75`).
- A idade é contada em **dias de calendário**, entre a data local de `ultimoBackupEm` e `hoje`
  do store. O limite de 7 dias passa a usar a mesma contagem — hoje ele usa milissegundos
  (`SETE_DIAS_MS`), o que faria o texto dizer "há 7 dias" num estado que ainda não é urgente.

**O aviso do topo sai.** O rodapé o substitui. Consequência aceita: nas abas Conferir e
Pendentes não há mais aviso de backup; a Visão é a aba padrão da Hoje.

**Ajustes → Backup alinha o texto.** A linha passa a ser
`Último backup: há 3 dias (22/09/2026, 19:46)` — idade relativa primeiro, data completa entre
parênteses — e `Último backup: nunca` sem parênteses. O sufixo de mudanças continua igual.

### Unidades

- **`estadoBackup(config, hoje)`** — função pura, sem E/S, em `src/domain/`. Recebe
  `ultimoBackupEm`, `mudancasDesdeBackup` e `hoje`; devolve `{ nivel: 'neutro' | 'aviso' |
  'urgente', idade: string }`, onde `idade` é "hoje", "ontem", "há N dias" ou "nunca". A
  conversão do timestamp para data local fica aqui, testável com relógio fixo.
- `TelaHoje` e `Backup.tsx` montam a frase a partir de `idade`; nenhuma das duas calcula dias.

### CSS (nível 2)

- `.backup-rodape` — só forma: botão sem borda, bloco de largura total, alinhado à esquerda.
  Classe de componente, no bloco da `TelaHoje`.
- `.backup-rodape-neutro` — cor do estado neutro: sem fundo, texto `--muted`, 13px.
- `.aviso-urgente` — variante **compartilhada** de `.aviso`, usada junto dela
  (`className="aviso aviso-urgente"`): `background: var(--neg-bg); color: var(--neg)`. Fica
  logo depois de `.aviso` em `styles.css`, para vencer pela ordem. Tokens existentes; nenhum
  token novo.
- **Por que classes soltas e não `.aviso.urgente`:** o `verificar-catalogo.mjs` só reconhece
  classe que abre a linha do seletor. Um modificador que só existe composto precisaria entrar
  na lista `EXCECOES` do script — e `scripts/` só muda com pedido explícito.
- As três entram em `docs/estilo/catalogo.md` no mesmo commit.

### Testes

- `estadoBackup`: nunca feito com e sem mudanças; hoje; ontem; 6 dias com mudanças (aviso);
  7 dias com mudanças (urgente); 30 dias sem mudanças (neutro); virada de dia local
  (backup às 23:50 de ontem conta como "ontem", não "hoje").
- `TelaHoje.test.tsx`: o rodapé aparece nos três estados com o texto e a classe certos; tocar
  abre Ajustes → Backup; não aparece no primeiro uso; o aviso antigo do topo não existe mais.
- `Backup` (Ajustes): mostra a idade relativa com a data entre parênteses, e "nunca" sem data.

### Entrega

- Dossiê: regenerar se o texto capturado da Hoje mudar.
- Wiki: `6-telas.md:14` (o banner vira rodapé sempre visível, com três estados),
  `1-primeiros-passos.md:84` (o aviso agora é permanente) e `7-ajustes.md`, seção Backup, se
  descrever o texto da linha.
- Fragmento `changelog.d/alterado-rodape-backup.md`.

---

## Ordem e dependências

A e B não dividem arquivo de código. Os dois mexem em `docs/wiki/6-telas.md`, em seções
diferentes — o segundo merge pode precisar de um rebase simples. Cada um passa pelo ciclo
de entrega completo, com mockup aprovado antes do código.
