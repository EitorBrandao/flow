# Modo simples e avançado — desenho

Data: 2026-10-01. Estado: aguardando revisão do usuário.

## Objetivo

O app hoje exige que o usuário preencha tudo: lançamentos, categorias, bancos, compras do cartão. Quem quer só o essencial desiste.

Esta feature cria dois modos de uso: **Simples** e **Avançado**. O modo Simples pede o mínimo para o app mostrar o saldo e a projeção. O modo Avançado mantém o app como ele é hoje.

Os dados são os mesmos nos dois modos. Trocar de modo só esconde ou mostra campos, abas e telas. Nada se perde ao trocar.

## Mockup aprovado

`mockup-modos.html` (v3, enviado ao usuário em 2026-10-01). O mockup usa o CSS real de `src/styles.css`. A implementação segue o mockup à risca. Um desvio precisa de nova aprovação.

## Decisões já tomadas

1. **Cinco controles independentes**: Hoje, Fluxo, Cartão, Análises e Lançar (+). Cada um tem o seu botão Simples/Avançado.
2. **Lançar tem modo próprio.** Ele abre igual a partir de qualquer tela. O modo das abas nunca o muda.
3. **Padrão: Simples** em todos os controles.
4. **Simular existe nos dois modos** (aba Fluxo). No Simples é a versão leve.
5. **Onde fica:** Ajustes › Sobre o app › **Modo de uso**.
   - "Sobre o app" é só menu: Modo de uso ›, Wiki ›, Versão.
   - "Modo de uso" é uma tela própria, com "‹" para voltar. Ela só tem os cinco botões.
   - Regra do projeto: botão que leva a um lugar nunca divide a tela com funcionalidade.
6. As telas funcionais (Hoje, Fluxo, Cartão, Análises e Lançar) não têm botão de modo.
7. **A versão aparece no próprio botão.** Em "Sobre o app", a linha "Versão" mostra o número da versão atual (por exemplo, `0.54.1`) à direita, sem precisar abrir. Tocar na linha continua abrindo o histórico de versões. A linha mantém o "›" das outras linhas do menu.
   - O número vem do mesmo `parseChangelog` que `Versao.tsx` usa hoje. Um só lugar lê a versão, para as duas telas nunca discordarem.
   - `Linha` (`TelaAjustes.tsx`) ganha uma propriedade `valor`, exibida à direita, antes do "›".
   - A linha "Sobre o app" do menu principal continua com o detalhe "Wiki · Modo de uso · Versão". O número não entra ali.

## O que cada modo mostra

| Tela | Simples | Avançado |
|---|---|---|
| **Hoje** | Saldo, projeção de 28 dias e gráfico. Conferir com um campo: o saldo real total. Pendentes. | Tudo o que existe hoje: Conferir por banco, transferência ↔, sinal (cheque especial) e rodapé de backup detalhado. |
| **Fluxo** | Abas Lista, Gráfico e Simular. Simular leve: "E se eu gastar…" com valor, data e Uma vez / Parcelado / Todo mês. Mostra o menor saldo com e sem a compra, e o aviso de saldo negativo. | Tudo o que existe hoje: filtro por banco, saldo por dia, cenários completos, tabela Com/Sem/Diferença, "Tornar real". |
| **Cartão** | Por cartão e mês: valor da fatura e vencimento. Botões "Paguei tudo" e "Paguei outro valor". | Tudo o que existe hoje: compras, parcelas, categorias do cartão, assinaturas, conferência, pagar a menor, corrigir fatura. |
| **Análises** | Só o período Mês: resumo, por categoria e evolução mensal. | Tudo o que existe hoje: 12 meses, Ano, Período, Viagens, Comparativo, Categorias do cartão, filtro por banco, "incluir previstos". |
| **Lançar (+)** | Valor, Gasto/Ganho e descrição opcional. Data de hoje. Categoria automática. | Todos os campos de hoje: categoria, data, nota, previsto, banco, viagem, repetir. |

Ajustes mantém todos os grupos nos dois modos. Os modos não escondem Ajustes.

## Como o modo Simples grava os dados

A regra de ouro: o Simples **reusa as entidades e funções existentes**. Ele não cria entidade nova nem lançamento de origem nova. Assim a matriz `status` × `origem`, o backup e o dossiê continuam válidos.

- **Lançar simples.** Grava um `Lancamento` `manual`, `efetivo`, com a data de hoje e o banco padrão (se houver). Categoria: a do último lançamento com a mesma descrição (comparação exata, sem diferenciar maiúsculas). Sem correspondência, usa a categoria reservada "A classificar".
- **Hoje simples, conferir.** Informar o saldo real total grava o saldo declarado pelo mesmo caminho que "Total calculado no Flow" usa hoje (`saldoDeclaradoCent`, `dataSaldoDeclarado`, e o saldo informado da box). Não cria lançamento de ajuste. A diferença aparece com as mesmas frases, cores e sinal da conferência atual.
- **Cartão simples.** O campo "valor da fatura" é o mesmo campo da Conferência do cartão: grava uma `ConferenciaFatura` com `usarValorApp: true` e `valorAppCent` igual ao valor digitado, para o cartão e o mês de vencimento. Nenhuma compra é criada. `diffSincronizacao` já trata esse caso: com conferência marcada e sem fatura calculada, ele cria o previsto no vencimento (`datasFaturaDoMes`). O valor e o vencimento seguem as regras de hoje (previsto só com vencimento depois de hoje). No Avançado, o usuário vê a mesma conferência marcada, na aba Conferência. Pagar usa o fluxo atual de pagamento.
- **Simular simples.** "E se eu gastar…" cria um `Cenario` com um item. A tela mostra o menor saldo da projeção com e sem o cenário. Tocar em "Guardar" mantém o cenário (aparece no Avançado). Sem guardar, o cenário é apagado ao sair.
- **Análises simples.** Só esconde períodos e cards. Os números vêm das mesmas funções de `aggregations.ts`.

## Armazenamento

- `Config` ganha o campo opcional `modos`: `{ hoje, fluxo, cartao, analises, lancar }`, cada um `'simples' | 'avancado'`.
- **Campo ausente = Avançado.** Quem já tem dados, ou importa um backup antigo, continua vendo tudo. Nada some sem o usuário pedir.
- **Instalação nova** grava `modos` todo em `'simples'` ao iniciar. É esse o "padrão Simples".
- Não precisa de nova `this.version(n)` no Dexie, porque `config` já é um documento.
- Backup: `mesclar` mantém a `config` local, então os modos do aparelho não mudam. "Substituir" grava a `config` do backup, inclusive `modos`. Backup sem `modos` vale como Avançado.
- `validarBackup` aceita `modos` ausente e rejeita valores fora de `'simples' | 'avancado'`.

## Arquitetura

- `src/domain/types.ts`: tipo `ModoUso` e `Config.modos`.
- `src/domain/modos.ts` (novo, lógica pura): `modoDe(config, tela)` (ausente → `'avancado'`) e `modosPadraoInstalacaoNova()`.
- `src/db/repo.ts`: `salvarModo(tela, modo)` e a gravação do padrão na primeira instalação. Toda persistência continua no repo.
- `src/state/store.ts`: depois de gravar, chama `recarregar()`, como as outras mutations.
- `src/ui/ajustes/`: a tela "Modo de uso" e o item de menu em "Sobre o app".
- `src/ui/TelaAjustes.tsx`: a ordem do grupo "Sobre o app" passa a ser Modo de uso, Wiki, Versão. A linha "Versão" mostra o número da versão.
- Cada tela (`TelaHoje`, `TelaFluxo`, `TelaCartao`, `TelaAnalises`, sheet de Lançar) lê o seu modo e decide o que renderiza. Evite um segundo componente por modo: esconda blocos, não duplique a tela.

## Consistência entre telas

O mesmo conceito aparece do mesmo jeito nos dois modos: mesmo texto, mesma cor, mesmo sinal. O Simples nunca mostra um número diferente do Avançado para a mesma coisa. Em especial:

- O saldo e a projeção de Hoje vêm de `projetarBoxes`, nos dois modos.
- A diferença da conferência de saldo e a de fatura usam as mesmas frases.
- Um valor lançado no Simples aparece no Fluxo, em Análises e no Avançado sem conversão.

## Casos-limite

- Trocar para Simples com dados avançados já gravados (bancos, parcelas, viagens): os dados ficam. A tela só esconde o que não cabe. Um lançamento com banco continua no saldo daquele banco.
- Cartão simples num mês que já tem compras detalhadas: o campo já vem com a soma das compras. Digitar outro valor marca "usar este valor" na conferência, como no Avançado. As compras não somem.
- Cartão simples: mudar o valor duas vezes edita a mesma conferência (única por cartão e mês, `dedupConferencias`). Nunca cria duas.
- Cartão simples num mês cujo vencimento já passou: o previsto não nasce (regra atual). O plano deve verificar como "Paguei tudo" e "Paguei outro valor" se comportam sem fatura calculada, e ajustar sem criar lançamento novo de origem.
- Visão "casa": o Cartão simples empilha os cartões, como hoje.
- Box "casa" e lançamento em box: o Simples usa a box padrão. Sem box padrão e com mais de uma box, o Lançar simples pede a box uma vez.
- Duplo toque em Salvar não duplica (mesma guarda dos lançamentos atuais).

## Testes

- Unitários (`modos.test.ts`): campo ausente → Avançado; padrão de instalação nova; valor inválido.
- Repo: `salvarModo` persiste; instalação nova grava Simples; base existente não muda.
- Backup: mesclar mantém os modos locais; substituir grava os do backup; backup sem `modos`; valor inválido rejeitado.
- Cartão simples: criar, editar duas vezes (uma compra só), mês com compras detalhadas, vencimento e pagamento.
- Lançar simples: categoria por descrição repetida, sem correspondência, banco padrão, duplo toque.
- UI: cada tela nos dois modos (Testing Library) e a tela "Modo de uso".
- Varredura com Playwright no Galaxy S25+ (411 × 744), nos dois modos, em cada tela. Dados sintéticos.
- Dossiê: regenerar com `npm run dossie` se o roteiro passar a cobrir os modos.

## Documentação e entrega

- Fragmento em `changelog.d/adicionado-modo-simples-avancado.md`, em formato plano.
- Wiki (`docs/wiki/`): capítulo novo sobre os modos, e ajuste em "Sobre o app". Validar com `npx vitest run src/ui/ajustes/capitulos.test.ts`.
- Catálogo (`docs/estilo/catalogo.md`): toda classe ou componente novo entra.
- Consultar `docs/estilo-visual.md` antes de editar a UI. A tela "Modo de uso" é uma nova tela (nível 5).

## Decisões

Confirmadas pelo usuário em 2026-10-01:

1. **Usuários que já têm dados** ficam em Avançado (campo ausente = Avançado). Só instalações novas começam em Simples.
2. **Categoria do Lançar simples:** mesma descrição → mesma categoria; sem correspondência → "A classificar".
3. **Simular simples:** o cenário não guardado é apagado ao sair.

4. **Cartão simples usa a Conferência.** O valor da fatura é o campo da Conferência (`usarValorApp`), sem compra nem entidade nova. Proposto pelo usuário.

Em aberto: nenhuma.
