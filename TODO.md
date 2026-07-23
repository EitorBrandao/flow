# TODO — Flow

Backlog pós-v1. Cada item tem contexto, proposta e decisões em aberto; detalhar em spec
(`docs/superpowers/specs/`) antes de implementar os maiores.

Prioridade atual: item 1 (drill-down do Pix) é a próxima feature — maior dor no dia a dia
hoje, escolhida em 2026-07-08.

## 1. Detalhamento do Pix nas Análises

**Contexto:** "pix" é uma categoria comum (existe como ganho e como gasto) que agrega
transferências para destinos totalmente diferentes. Na aba Análises ela aparece só como um
total mensal — um balde opaco que pode ser a maior linha de gasto sem dizer nada.

**Proposta:**
- Drill-down por categoria: tocar numa linha da tabela "Por categoria" (`src/ui/TelaAnalises.tsx`)
  abre a lista dos lançamentos daquela categoria no mês — data, nota e valor.
- Para o pix, a nota (vinda do extrato importado ou digitada) identifica a contraparte;
  opcionalmente agrupar por nota para ver "para quem / de quem" com subtotais.
- Nova função em `src/domain/aggregations.ts` (ex.: `lancamentosDaCategoria(mes, categoriaId, boxIds)`),
  respeitando o filtro de boxes e o toggle "incluir previstos".

**Decisões em aberto:**
- Só listar os lançamentos, ou agrupar por contraparte (exige normalizar notas — caixa,
  espaços, prefixos do banco)?
- O drill-down vale para todas as categorias (provavelmente sim — de graça) ou só pix?

## 2. Saldo em dias específicos do futuro

**Contexto:** o motor já existe — `projetarBoxes` (`src/domain/projection.ts`) devolve o
saldo projetado de cada dia até `config.horizonteProjecao`. Falta só uma forma direta de
consultar "quanto vou ter no dia X?" sem ler o gráfico a olho.

**Proposta:**
- Um seletor de data (input `date`) na aba Fluxo, acima ou abaixo do gráfico: escolhe o dia,
  vê o saldo projetado naquele dia — respeitando boxes selecionadas e cenários ligados.
- Extra natural: tocar/arrastar no `BalanceChart` mostra tooltip com dia + saldo (o mesmo
  dado, acesso mais rápido).
- Data além do horizonte de projeção: avisar e/ou oferecer estender o horizonte.

**Decisões em aberto:**
- Onde mora o controle: Fluxo, Hoje, ou os dois?
- Mostrar também o delta em relação ao saldo de hoje ("R$ 3.200, −R$ 450 vs. hoje")?

## 3. Importar extrato bancário

**Contexto:** não há nenhum caminho de entrada em massa de lançamentos hoje (o import via
planilha xlsx foi descontinuado). Extratos bancários (ex.: export do banco em OFX/CSV/PDF)
não são suportados — lançar cada item manualmente na aba Lançar não escala para o histórico real.

**Proposta:**
- Suportar pelo menos um formato de extrato bancário comum (CSV ou OFX) como novo caminho de
  importação, com preview e dedupe antes de confirmar.
- Mapear categoria automaticamente quando possível (por nota/contraparte), com fallback para
  categorização manual antes de confirmar o import.

**Decisões em aberto:**
- Qual banco/formato priorizar primeiro (depende do banco que o usuário usa no dia a dia)?
- OFX é mais estruturado que CSV mas exige parser dedicado — vale a pena vs. CSV genérico
  com mapeamento de colunas configurável?

## 4. Transformar o app num .apk

**Contexto:** hoje o Flow é PWA (vite-plugin-pwa), local-first com IndexedDB/Dexie — nada
de servidor. Instalar o PWA no Android já era pendência; um .apk é o passo além.

**Rotas possíveis:**
- **Capacitor (recomendado):** empacota o build do Vite dentro do APK; roda 100% offline,
  sem precisar hospedar nada. Passos: `@capacitor/core` + `@capacitor/cli` + plataforma
  android → `npx cap add android` → `npm run build` + `npx cap sync` → gerar APK debug
  via gradle (`assembleDebug`) e instalar por sideload. Exige Android SDK na máquina.
- **TWA / Bubblewrap:** exige o PWA hospedado em HTTPS público — não temos hosting; descartado
  por ora.

**Riscos / atenção:**
- Os dados (IndexedDB) passam a viver dentro do WebView do app: desinstalar o app apaga
  tudo. Reforça a importância do backup — testar exportação/importação de backup dentro do
  WebView (lição registrada: WebView tem lacunas de API vs. Chrome).
- Assinatura: para uso próprio, APK debug por sideload basta; guardar keystore se um dia
  quiser release.

**Decisões em aberto:**
- Vale antes simplesmente instalar o PWA (pendência antiga) e só ir de APK se o PWA
  decepcionar (ex.: acesso a arquivos, ícone, fullscreen)?

## 5. Reativar aba Simular

**Contexto:** a aba "Simular" (`TelaSimulador.tsx`, cenários) foi ocultada temporariamente da
navegação em `src/ui/Shell.tsx` (item removido do array `ABAS`) a pedido do usuário, em
2026-07-17. O código da tela e a lógica de cenários continuam intactos — só o botão de
navegação some.

**Proposta:** quando o usuário pedir, devolver a entrada `{ id: 'simulador', rotulo: 'Simular' }`
ao array `ABAS` em `src/ui/Shell.tsx`.

## 6. Botão de reordenar em Recorrências

**Contexto:** a lista de Recorrências (`src/ui/ajustes/Recorrencias.tsx`) hoje aparece na
ordem em que vem de `dados.recorrencias` (ordem de criação/carregamento), sem controle do
usuário. Levantado em 2026-07-17 durante o ajuste de contraste/word-wrap da mesma tela.

**Proposta:** um botão/toggle pra reordenar a lista — da mais recente para a mais antiga
(por `dataInicio`) ou em ordem alfabética (por nome da categoria/descrição).

**Decisões em aberto:**
- É uma ordenação (clica e alterna critério) ou dois botões separados?
- "Mais recente" ordena por `dataInicio` decrescente — confirmar se é essa a leitura de
  "recente" (data de início da recorrência, não data do último lançamento gerado).
- Vale o mesmo controle em Assinaturas (`src/ui/ajustes/Assinaturas.tsx`), que tem a mesma
  estrutura de lista?

## 7. Bug de cor no Simulador (baixa prioridade — aba sem uso no momento)

**Contexto:** `TelaSimulador.tsx` (linha ~135) pinta todo item de cenário hipotético com a
classe `valor-gasto` (vermelho), sem checar o tipo da categoria escolhida. Como
`FormHipotetico` permite escolher qualquer categoria (inclusive tipo "ganho"), um cenário
de aumento salarial ou outro ganho hipotético aparece incorretamente em vermelho, como se
fosse gasto. Achado em 2026-07-17 durante a auditoria de cores monetárias no app; não
corrigido a pedido do usuário porque a aba Simular está oculta e sem uso (ver item 5).

**Proposta:** replicar o padrão de `tipoCat()` já usado em `TelaHoje.tsx`/`TelaFluxo.tsx` —
olhar `categoria.tipo` do lançamento do cenário e escolher `valor-ganho`/`valor-gasto`
condicionalmente, em vez do `valor-gasto` fixo.

## 8. Conectar com app do banco para captar lançamentos automaticamente

**Contexto:** hoje todo lançamento entra manualmente ou via recorrência — não há nenhuma
captura automática do que acontece na conta real. Complementa o item 3 (import de extrato),
mas em vez de importar em lote seria captar em tempo real, direto do app do banco.

**Proposta:**
- Investigar conectar via API oficial do banco (Open Finance/Open Banking no Brasil é o
  caminho institucional) para ler transações.
- Alternativa caso a API não seja viável (custo, burocracia, banco sem suporte): ler as
  notificações do app do banco no Android (ex.: `NotificationListenerService`) e extrair
  valor/estabelecimento do texto da notificação de transação.
- Em qualquer caminho, cair no mesmo fluxo de confirmação/categorização que um import manual
  teria, nunca lançar direto sem revisão do usuário.

**Decisões em aberto:**
- Qual banco priorizar (o que o usuário usa no dia a dia)?
- Open Finance exige app rodando num contexto com mais infraestrutura (backend, credenciais
  de instituição) — ainda cabe no modelo local-first/sem servidor do Flow, ou é um desvio de
  arquitetura?
- Ler notificações exige o app empacotado como Android nativo/híbrido (depende do item 4,
  transformar em .apk) — PWA puro não tem acesso a `NotificationListenerService`.
- Risco de parsing frágil (texto de notificação muda sem aviso do banco) — vale a pena vs.
  esperar o item 3 (extrato) amadurecer primeiro?
