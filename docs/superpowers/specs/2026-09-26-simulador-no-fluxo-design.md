# Simulador no Fluxo (item 16)

Data: 2026-09-26. Branch: `simulador-fluxo`.

Depende do branch da **regra de sinal** ("valor mostrado sem sinal, a cor diz o sentido"),
que tem spec própria e entra antes. Este branch já nasce seguindo essa regra.

## Problema

A aba Simular saiu da navegação em 2026-07-17. A tela antiga só listava cenários e o total
dos seus lançamentos. Ela não respondia a pergunta que importa: **como este gasto futuro
mexe no meu saldo, mês a mês?**

## Decisões (com o usuário, 2026-09-25 e 2026-09-26)

1. **Entrada:** terceira opção do seletor do Fluxo — Lista · Gráfico · **Simular**. A barra
   de navegação não muda.
2. **Tela nova.** Da tela antiga fica só a ideia: cenários ligáveis, com itens hipotéticos.
3. **Mês a mês:** para cada mês, o saldo no último dia do mês **sem** os cenários, **com** os
   cenários, e a **diferença**.
4. **Vários cenários:** as duas visões. Um resumo no topo mostra o efeito combinado dos
   cenários ligados. Cada cenário, aberto, mostra o impacto **só dele**.
5. **Itens:** gasto e ganho, em três repetições — **Uma vez**, **Parcelado**, **Todo mês**.
   Compra no cartão fica fora.
6. **Troca de algo que já existe** (aluguel, salário): o usuário lança **só a diferença**.
   O cenário nunca suspende uma recorrência real. A tela dá essa dica ao escolher "Todo mês".
7. **Tabela estável:** ligar ou desligar cenários nunca muda a largura das colunas.
8. **Tabela sem rolagem** no celular do usuário: mês curto ("out/26"), sem "R$" nas células
   (um rótulo "Valores em R$" acima da tabela), coluna do mês com largura fixa, e as três
   colunas de valor dividem o resto da largura por igual.
9. **Sem sinal nos valores:** negativo em vermelho, positivo em verde (regra de sinal).
10. **Cabeçalho do cenário:** o checkbox liga e desliga. O resto do cabeçalho — nome, resumo
    e a seta — abre e fecha o cenário.

Mockup aprovado: `mockup-simular-tela-nova.html`, fora do git (os valores de exemplo em
real seriam barrados pelo verificador de dados reais).

## Modelo

**Sem mudança de schema.** Nenhuma `this.version(n)` nova, e nenhum campo novo.

| Item | Gravado como |
|---|---|
| Uma vez | `Lancamento` com `status: 'previsto'`, `cenarioId`, e a descrição em `nota` |
| Parcelado | `Recorrencia` com `parcelas: N` (N ≥ 2), `valor` = parcela, `cenarioId`, `nota` |
| Todo mês | `Recorrencia` com `parcelas: null`, `valor` = valor do mês, `cenarioId`, `nota` |

- Ganho ou gasto vem do `tipo` da categoria, como em Lançar. O valor gravado é sempre
  positivo.
- Parcela = `Math.round(total / N)`. Exemplo: 100000 centavos em 3x viram 3 × 33333 =
  99999. A lista mostra o total **real** (parcela × N), para não esconder o centavo.
- A recorrência de cenário é materializada como qualquer outra (`materializarRecorrencia`
  já copia `cenarioId` para os lançamentos gerados).
- A descrição vai em `nota`. A tela antiga gravava o nome do cenário na `nota` da
  recorrência; a tela nova grava a descrição do item.

## Domínio — `src/domain/simulacao.ts` (novo, puro)

- **`resumoMensal(serie: DiaSaldo[], hoje: ISODate): LinhaMes[]`**
  `LinhaMes = { mes: string /* AAAA-MM */, sem: number, com: number, dif: number }`.
  Um item por mês, do mês de `hoje` até o último mês da série. Usa o **último dia** do mês
  presente na série: `sem = saldoProjetado`, `com = saldoComCenarios`, `dif = com − sem`.
  `sem` já inclui os previstos reais (sem cenário).
- **`primeiroMesNegativo(linhas: LinhaMes[]): string | null`** — primeiro `mes` com
  `com < 0`.
- **`extremosPossiveis(sem: number[], efeitos: number[][]): { min: number[]; max: number[] }`**
  — `efeitos[i][k]` é o `dif` do cenário `i` sozinho no mês `k`. Para cada mês,
  `min = sem + Σ efeitos negativos` e `max = sem + Σ efeitos positivos`. Toda combinação de
  cenários ligados fica dentro desse intervalo. Serve para fixar a largura das colunas.
- **`itensDoCenario(dados: Dados, cenarioId: ID): ItemCenario[]`** — une os lançamentos do
  cenário **sem** `recorrenciaId` (itens "Uma vez") e as recorrências do cenário
  (Parcelado/Todo mês), ordenados pela data de início.

As séries vêm de `projetarBoxes` (`src/domain/projection.ts`), sem mudança nela:

- combinado: `cenariosLigados` = os cenários ligados (`cenariosLigados(dados)`);
- por cenário: `cenariosLigados = new Set([id])`, **ligado ou não**.

## Tela

`src/ui/SimuladorFluxo.tsx` (novo), dentro de `TelaFluxo.tsx`, quando o seletor está em
"Simular". De cima para baixo:

1. **Novo cenário** — campo de nome e botão Criar (formulário antes da lista). Criar fica
   desativado com o nome vazio. Cenário novo nasce ligado.
2. **Cenários ligados · N** — card com o aviso e a tabela combinada.
   - Algum mês negativo: `.aviso .aviso-urgente` — "Com os cenários ligados, o saldo fica
     negativo em {mês}."
   - Nenhum negativo: `.sub` — "Com os cenários ligados, o saldo segue positivo até {mês}."
   - Nenhum ligado: `.sub` — "Nenhum cenário ligado: a tabela mostra só o saldo real." A
     tabela **continua visível** (com = sem, diferença "—"), para a tela não pular.
3. **Cenários** — um card por cenário.
   - Cabeçalho: checkbox (liga e desliga); um botão com o resto do cabeçalho — nome, linha
     "{n} itens · até {mês}: {efeito no último mês}", "· negativo em {mês}" quando houver, e a
     seta ▼/▲ — que abre e fecha. `aria-expanded` no botão.
   - Aberto: **Itens** (lista; tocar abre o editor do item), **Impacto só deste cenário**
     (tabela do cenário sozinho), **Novo item** (formulário), e as ações **Tornar real** e
     **Excluir cenário**, ambas com confirmação.
   - Um cenário aberto por vez.

**Formulário de item** (novo e edição usam o mesmo): valor (`CampoValor`), descrição,
Gasto/Ganho (`SeletorPills`), categoria (`SeletorCategoria`, filtrada pelo tipo, sem as
categorias de fatura e de transferência, sem arquivadas), repetição (Uma vez · Parcelado ·
Todo mês), data ("Data" em Uma vez, "A partir de" nos outros), parcelas (só em Parcelado).
Dicas em `.sub`:

- Parcelado: "O valor é o total: cada parcela sai por {parcela}."
- Todo mês: "Repete todo mês até o fim da projeção. Para algo que já existe, como aluguel ou
  salário, lance só a diferença."

Adicionar fica desativado sem valor, sem categoria, ou com Parcelado e menos de 2 parcelas.

**Editar item** — tocar num item abre um `Sheet` com o formulário preenchido e os botões
Salvar e Excluir item (com confirmação). Valor, descrição, categoria, data e parcelas mudam.
A repetição **não** muda: para trocar, o usuário exclui e cria outro. Salvar:

- Uma vez → `repo.atualizarLancamento`;
- Parcelado/Todo mês → `repo.salvarRecorrencia` com a recorrência existente (re-materializa).

Excluir: `repo.excluirLancamento` ou `repo.excluirRecorrencia`.

**Box:** a tabela segue o seletor do topo (`boxIdsSelecionadas`), como o resto do Fluxo;
"casa" consolida. Item novo vai para `boxIdEfetivo(dados, boxSel)`. Sem box efetiva, a
tela mostra a mesma mensagem da tela antiga.

### Tabela

- Colunas: **Mês · Com · Diferença · Sem**. Mês curto: nova função `mesCurto` em
  `src/domain/dates.ts` ("2026-10" → "out/26").
- Células sem "R$" e sem sinal: `formatarSemSimbolo(Math.abs(v))` (ou o formatador que a
  regra de sinal criar, se ela criar um). Rótulo `.sub` "Valores em R$" acima da tabela,
  alinhado à direita.
- Cores: Com e Sem em `strong.total-dia.pos|neg`; Diferença em `strong.valor-ganho|valor-gasto`;
  zero vira "—".
- **Largura:** classe nova `table.tabela.tabela-fixa` — `table-layout: fixed`, `width: 100%`,
  padding de célula 8px, primeira coluna sem os 112px de `.tabela`. A coluna do mês recebe
  largura fixa; as três de valor, nenhuma (dividem o resto por igual). O `min-width` da
  tabela vem do texto mais longo entre os `extremosPossiveis` de **todos** os cenários e o
  `sem`, em `ch` (os dígitos são tabulares). Abaixo desse mínimo, `.rolavel` rola — nenhum
  valor fica espremido, e ligar ou desligar cenários não muda nada.
- A classe entra em `src/styles.css` e em `docs/estilo/catalogo.md` (nível 2 do guia).

## Navegação

- `AbaFluxo` ganha `'simular'`; `TelaFluxo.tsx` ganha a terceira pílula.
- Sai o valor `'simulador'` de `Aba` (`src/state/store.ts`) e de `NOMES_ABA`, o render em
  `Shell.tsx`, e o comentário de `ABAS`.
- `src/ui/TelaSimulador.tsx` e `TelaSimulador.test.tsx` são apagados.

## Correções que entram junto

- **F2 — cenário nunca `efetivo`.** `repo.atualizarLancamento` e `repo.confirmarPendente`
  lançam erro ao tentar gravar `status: 'efetivo'` num lançamento com `cenarioId`.
  `LancEditor.tsx` esconde "Confirmar" quando `lanc.cenarioId`. Um lançamento de cenário
  ainda abre o `LancEditor` pela Lista do Fluxo (badge "cenário"): editar e excluir seguem.
- **Cor do ganho:** a tela antiga pintava todo item de vermelho. A nova usa o tipo da
  categoria.

## Pontos de chamada

- `src/state/store.ts` — `Aba`, `AbaFluxo`.
- `src/ui/Shell.tsx` — `ABAS` (comentário), `NOMES_ABA`, render de `TelaSimulador`.
- `src/ui/TelaFluxo.tsx` — pílulas, render do simulador.
- `src/ui/LancEditor.tsx` — botão Confirmar.
- `src/db/repo.ts` — `atualizarLancamento`, `confirmarPendente` (trava da F2).
  `salvarLancamento`, `salvarRecorrencia`, `excluirLancamento`, `excluirRecorrencia`,
  `salvarCenario`, `excluirCenario`, `converterCenarioEmReal` sem mudança.
- Sem mudança, conferidos: `projection.ts` (já separa cenário), `pendentes` (já exclui
  cenário), `aggregations.ts` (Análises já excluem cenário), `Recorrencias.tsx` (já esconde
  recorrência de cenário), `backup.ts` (tabela `cenarios` já no backup e no `mesclar`).
- Docs: `docs/dominio.md` (tabela status × origem, ressalva da F2 vira garantia),
  `docs/estilo/catalogo.md`, `src/ui/CLAUDE.md`, wiki (`2-visao-geral.md`, `6-telas.md`,
  `8-glossario.md`).

## Testes

- `simulacao.test.ts`: `resumoMensal` (fim de mês, mês parcial no início, série vazia),
  `primeiroMesNegativo`, `extremosPossiveis` (efeitos mistos por cenário), `itensDoCenario`
  (lançamento avulso + recorrência, sem duplicar os lançamentos materializados). Todo valor
  esperado recalculado à mão.
- `dates.test.ts`: `mesCurto`, virada de ano.
- `repo.test.ts`: trava da F2 nas duas funções; lançamento sem cenário continua confirmando.
- `SimuladorFluxo.test.tsx`: criar cenário; adicionar item dos três tipos; ligar e desligar
  muda o resumo; um cenário aberto por vez; seta e nome abrem, checkbox não abre; editar e
  excluir item; Adicionar desativado nos casos inválidos; ganho em verde.
- `LancEditor`: sem "Confirmar" em lançamento de cenário.
- Dossiê regenerado (`npm run dossie`).
- Varredura com Playwright no Galaxy S25+ (411 × 744): tabela sem rolagem, colunas
  paradas ao ligar e desligar.

## Entrega

- Fragmento `changelog.d/adicionado-simulador-no-fluxo.md`.
- Wiki: capítulo Telas (seção Fluxo › Simular, sai "oculta da navegação"), visão geral e
  glossário.
- Fecha o item 16 e a F2 do `TODO.md` (local).
