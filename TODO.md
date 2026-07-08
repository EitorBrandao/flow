# TODO — Flow

Backlog pós-v1. Cada item tem contexto, proposta e decisões em aberto; detalhar em spec
(`docs/superpowers/specs/`) antes de implementar os maiores.

## 1. Saldo em dias específicos do futuro

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

## 2. Detalhamento do Pix nas Análises

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

## 3. Importar extrato bancário

**Contexto:** hoje o import via xlsx (`src/importer/xlsx.ts`) é o único caminho de entrada em
massa de lançamentos. Extratos bancários (ex.: export do banco em OFX/CSV/PDF) não são
suportados — lançar cada item manualmente na aba Lançar não escala para o histórico real.

**Proposta:**
- Suportar pelo menos um formato de extrato bancário comum (CSV ou OFX) como novo caminho de
  importação, reaproveitando a infraestrutura de dedupe/preview do importador de xlsx.
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
  tudo. Reforça a importância do backup — testar exportação/importação de backup e o import
  de xlsx dentro do WebView (lição registrada: WebView tem lacunas de API vs. Chrome).
- Assinatura: para uso próprio, APK debug por sideload basta; guardar keystore se um dia
  quiser release.

**Decisões em aberto:**
- Vale antes simplesmente instalar o PWA (pendência antiga) e só ir de APK se o PWA
  decepcionar (ex.: acesso a arquivos, ícone, fullscreen)?
