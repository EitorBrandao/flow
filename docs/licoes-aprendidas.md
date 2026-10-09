# Lições aprendidas

Este arquivo reúne o que o projeto aprendeu errando. Cada lição vem de um incidente real e diz o que checar da próxima vez. Quem vai mexer numa área economiza a redescoberta.

Regras deste arquivo:

- Uma lição tem três partes: o que aconteceu, por que importa, o que fazer.
- Nenhuma lição traz valor, nome, saldo ou descrição reais. O repositório é público (ver "Dados e privacidade").
- Lição que virou guarda automática fica registrada, mas sem repetir o passo a passo. A tabela "Guardas automáticas", no `CLAUDE.md`, é a fonte.
- Lição que o código tornou obsoleta sai daqui. O histórico do git guarda o texto antigo.
- Quem fecha um incidente novo acrescenta a lição na seção do tema, no mesmo branch.

O backlog (`TODO.md`) e o histórico dele (`TODO-CONCLUIDOS.md`) são locais, fora do git. As lições de processo daqueles arquivos vivem aqui, porque um clone limpo não os tem.

## Sessões, branches e deploy

- **O checkout é estado compartilhado.** Sessões concorrentes rodam no mesmo diretório. Elas trocam de branch, fazem rebase e criam branches no meio do fluxo das outras. Já houve commit órfão e commit no branch alheio. *Faça:* todo trabalho com commits vai para um worktree próprio em `.worktrees/`. Confirme com `git rev-parse --show-toplevel` antes da primeira edição.
- **`npm run deploy` publica o que está no checkout, não "tudo que já foi feito".** Duas vezes, um deploy a partir de uma `main` sem o trabalho de outro branch apagou do site features já publicadas. Ninguém viu erro. O sinal foi o changelog visível pulando versões. *Faça:* antes de cada deploy, rode `git worktree list` e `git log --all --oneline --grep="chore(release)"`. Procure release que não está na ancestralidade do HEAD. O guard `scripts/predeploy.mjs` cobre parte disso (ver "Guardas automáticas"): ele varre os refs locais (`git log --all`) atrás de commits `chore(release)` fora do HEAD. Escapam dele o trabalho de outro branch que ainda não tem release e o ref que só existe no remoto e nunca foi buscado.
- **Conhecer o risco não basta.** A lição acima recorreu no mesmo dia em que foi escrita. Uma checagem que depende de lembrar perde para uma sessão longa. *Faça:* transforme a checagem em passo obrigatório, de preferência em guarda.
- **Recuperar de uma versão duplicada.** Duas sessões criaram a mesma versão. *Faça:* traga a `main` para o branch (`git merge origin/main`), renumere as versões do branch para depois da já publicada, rode suíte e build, e só então publique. Nunca insira versão "no meio" de uma já lançada.
- **Duas sessões podem construir a mesma feature.** Dois worktrees abertos implementaram o mesmo aviso de lançamento repetido, com regras diferentes. *Faça:* antes de começar, rode `git worktree list` e leia o `git log` dos outros branches.
- **`git stash` é proibido.** A pilha é compartilhada entre worktrees e sessões. *Faça:* isole trabalho com um commit temporário.
- **`git checkout <arquivo>` desfaz tudo que não foi commitado naquele arquivo.** Um experimento de uma linha apagou 50 linhas de trabalho. *Faça:* desfaça o experimento revertendo a própria edição. Ou faça commit do trabalho antes.
- **Remover worktree trava com servidor aberto.** O `node` filho do `vite` continua vivo. *Faça:* encerre o processo que ocupa a porta antes de `git worktree remove`.

## Subagentes e revisão

- **Relatório de subagente é texto, não prova.** Já houve relatório que descrevia outro trabalho, e branch sem nenhum commit. Já houve "37 testes passando" que cobriam só uma pasta, com a suíte cheia vermelha. *Faça:* confira `git log <base>..<branch>` e `git diff --stat <base>...<branch>`. Rode a suíte cheia e `npx tsc -b` você mesmo. O Vitest não checa tipos.
- **Subagente escreve fora do worktree.** Um deles gravou no checkout principal, apesar da ordem. Outro commitou rascunho numa pasta ignorada. *Faça:* ponha o caminho absoluto do worktree no prompt. Antes de encerrar, rode `git -C <checkout principal> status --porcelain`. A saída deve vir vazia.
- **O shell do subagente abre na pasta da sessão, não na da tarefa.** *Faça:* mande começar toda chamada de shell com `cd <worktree da tarefa>`.
- **Tarefas paralelas colidem em arquivo gerado ou compartilhado.** É o caso do dossiê e do `catalogo.md`. *Faça:* tire essa etapa das tarefas e rode uma vez, numa tarefa final. Avise que o teste do dossiê reprova nas paralelas até a regeneração.
- **Defeito grave mora na costura, não na peça.** Cada revisão por tarefa aprovou a sua peça. Mesmo assim, uma compra parcelada gravava o valor de uma parcela como total. Uma entrada caía em categoria de gasto. A decisão do usuário ia para o item errado quando a lista era refeita. *Faça:* peça uma revisão final do branch inteiro e releia o brief de cada tarefa contra a anterior.
- **A revisão final pega o que a de tarefa não vê.** Exemplos: um seletor esquecido ao esconder uma entidade, a doc de domínio que ninguém atualizou, texto de confirmação desatualizado, descompasso entre telas. *Faça:* nunca pule a revisão final.
- **Teste que não importa o módulo não testa nada.** Um teste de migração de schema declarava os próprios schemas e nunca importava o banco real. Passava mesmo sem o schema real. *Faça:* ao revisar um teste novo, procure o import do módulo testado. Pergunte: "isto falha se eu quebrar a implementação?".
- **Teste com a mesma suposição da implementação codifica o defeito.** Um parser e o teste dele esperavam 5 transações onde havia 6. Só uma fixture tirada do arquivo real desfez o empate. *Faça:* recalcule à mão todo valor esperado.
- **Teste que afirma só o tamanho de uma lista derivada não afirma nada.** *Faça:* afirme uma propriedade real, como a unicidade do rótulo.
- **Revisor que declara igualdade precisa checar os bytes.** Duas strings diferiam por um espaço não separável. *Faça:* compare com `grep -nP '[^\x00-\x7F]'` ou um diff.
- **O implementador Haiku transforma `\uXXXX` em caractere literal.** Isso esvaziou um teste de mojibake. *Faça:* avise no prompt e confira com `grep -nP '[^\x00-\x7F]'`.
- **Rodar suíte e build logo depois de várias rodadas de subagentes pode estourar a memória.** O processo em segundo plano foi encerrado. *Faça:* não reinicie sem o usuário liberar.
- **O trailer de commit do subagente sai com o nome do modelo dele.** *Faça:* fixe o trailer exato no prompt.

## Testes

- **Suíte verde pode sair com código 1.** Rejeição de promessa não tratada aparece como "Unhandled Errors", fora da lista de testes. A causa foi `db.delete()` e `db.open()` entre testes, enquanto um `recarregar()` do teste anterior ainda rodava. *Faça:* se o CI falha e o local passa, rode a suíte 10 a 20 vezes e procure "Unhandled Errors" e `DatabaseClosedError`. A correção estrutural já existe: `limparDb()` em `src/test-setup.ts` limpa as tabelas sem fechar a conexão.
- **`fake-indexeddb/auto` é o primeiro import de `src/test-setup.ts`.** O setup roda antes dos imports de cada teste. Sem isso, `new FlowDB()` lança `MissingAPIError`.
- **Suíte instável costuma ter dois relógios.** O `testTimeout` do Vitest é um. O `asyncUtilTimeout` do Testing Library é outro, e o primeiro não o afeta. *Faça:* antes de mexer, rode uma vez com o timeout absurdamente alto e leia as durações. Depois procure `timeout:` solto nos testes, porque um timeout local é um teto que anula o global. O `CLAUDE.md` guarda os valores atuais.
- **Guarda instável é guarda morto.** O teste do dossiê piscava vermelho porque um módulo carregado sob demanda não terminava dentro da janela. A correção foi preaquecer o módulo, não afrouxar o timeout.
- **O `jsdom` não aplica CSS nem simula gesto.** Um arrasto que "não faz nada" no celular pode ser falta de `touch-action: none` no elemento que inicia o gesto. *Faça:* verifique gesto novo com Playwright e toque real (CDP `Input.dispatchTouchEvent`). Desligue a correção para provar a causa. Janela sobreposta nova chama `useTravarRolagem`.
- **Teste de data depende do dia em que roda.** Um teste do simulador falhou por isso. *Faça:* fixe a data no teste.
- **O guard do dossiê falha em clone Windows sem `.gitattributes`.** Com `core.autocrlf=true`, regenerar suja a árvore e o checkout seguinte converte de novo. Um agente que contou o tropeço como nota de processo revelou o defeito. *Faça:* reporte tropeço lateral, não o engula.
- **Diff vazio do dossiê tem dois sentidos.** Ou nada mudou, ou mudou onde o dossiê não olha. Os limites estão em `.claude/skills/revisar-dossie/SKILL.md`.
- **Procurar o texto no código não prova que ele aparece na tela.** Uma busca por "DIFERENÇA" não achou nada, porque o cabeçalho está em minúsculas no código e o CSS o mostra em maiúsculas. Só rodar o app mostrou que o defeito seguia ali. *Faça:* para dizer que um achado de tela já fechou ou ainda existe, abra a tela, no celular simulado, com dados sintéticos.
- **Uma suíte com nome de arquivo parecido quebra no Windows.** `wiki.ts` ao lado de `Wiki.tsx` fez a importação resolver para o parser. Os testes passaram. Só `npm run build` pegou. *Faça:* rode o build antes de integrar.
- **O servidor de teste pode servir outra pasta que não a do worktree.** O `npx vite` subiu a partir do checkout principal, porque o diretório do shell tinha voltado para a raiz. A varredura rodou contra o código antigo e mostrou a frase velha. *Faça:* suba o servidor com `cd <worktree> && npx vite`, e antes de varrer confirme que a porta serve o código novo: `curl` num arquivo de `src/` e procure um texto que só existe no branch, ou leia a linha de comando do processo da porta.

## Dados, banco e backup

- **Validador compartilhado que devolve `null` em silêncio vira "nada aconteceu".** Um parser de valor rejeitava zero, o que vale para lançamento mas não para saldo inicial. Digitar zero apagava o saldo sem erro. *Faça:* quando o relato é "não deu erro, mas não salvou", suspeite de validador reaproveitado fora do contexto. Rode grep por todos os pontos de chamada.
- **Verificação que passa com dado vazio não prova nada.** Uma conferência comparava o arquivo consigo mesmo. Com zero linhas, dizia "confere". *Faça:* "0 divergências, 0 itens" é sinal de alerta, não de sucesso.
- **Confirme que você depura os mesmos bytes que o usuário usa.** Uma cópia local desatualizada do arquivo contradisse o que o usuário via. Uma cópia truncada pelo celular parecia bug de parser. *Faça:* se só a primeira linha ou coluna lê, suspeite do arquivo antes do parser.
- **Esconder uma entidade exige grep por todo ponto de seleção.** O plano listou três telas. A revisão final achou mais duas que reabriam o buraco. *Faça:* antes de fechar um plano "esconder X de toda seleção manual", rode grep pela lista de X em `src/ui/` e confira cada resultado.
- **Plano que muda função de domínio lista todos os pontos de chamada.** Inclua exclusão, importação, backup e pagamento. Um ponto esquecido já causou perda silenciosa de dado.
- **Duas features podem se compor numa armadilha.** Um valor "efetivo" fica congelado. Uma conferência posterior não o altera mais. *Faça:* diante de "o número do cartão não bate", confira nesta ordem: o status do lançamento da fatura, a conferência existente, e o total recalculado a partir das compras. Não trate o lançamento efetivo como verdade. (A perda da sobra no pagamento parcial já foi corrigida; a ordem de checagem continua válida.)
- **A cor e o sinal de um lançamento vêm da categoria, não do sinal do valor.** Duas pernas de uma transferência com sinais opostos exigem duas categorias, uma de gasto e uma de ganho. *Faça:* antes de projetar um par de lançamentos ligados, leia `tipoCat` e `projetarBoxes`.
- **Uma nova `this.version(n)` do Dexie exige teste de upgrade no mesmo commit.** Sessões paralelas podem criar o mesmo `n`. *Faça:* antes do merge, compare o maior `n` com o da `main`. O teste de schema também falha de propósito quando alguém adiciona versão, para forçar o salto a ser escrito.
- **Uma API da web que existe no Node pode faltar na WebView.** `crypto.randomUUID` funcionou em dev e em teste e falhou num Android real. *Faça:* para todo uso novo de API da web, pergunte se precisa de plano B. Leia o texto exato do erro na tela.
- **A passagem para outro armazenamento perde dado se não houver backup.** Desinstalar o app ou trocar de origem apaga o IndexedDB. *Faça:* sempre teste exportar e importar backup no ambiente novo antes de largar o antigo.
- **Mesclar por id duplica o que cada instalação cria sozinha, com id novo.** A box "casa" nasce em todo aparelho com um id próprio. O Mesclar de um backup num app novo trazia a casa do backup como segunda box. Ninguém viu, porque cada tela escolhe "a casa" pelo nome e pega a primeira. *Faça:* para toda entidade que o app cria sozinha, decida como o backup a reconhece (aqui, o nome) e teste o Mesclar com ela dos dois lados, com ids diferentes. Rode o fluxo pela tela de Backup e confira que nenhum registro aponta para uma box inexistente.
- **Corrigir a causa não conserta o estrago que ela já fez.** O Mesclar deixou de duplicar a casa, mas quem já tinha mesclado continuava com duas. A correção veio em dois pedaços: a regra que impede o erro novo e uma união idempotente, no `iniciar()`, que repara o antigo. *Faça:* ao fechar um defeito de dados, pergunte "quem já foi afetado?". A união troca ids, mantém tudo e marca `alteradoEm`, para um backup antigo não a desfazer.
- **Operações "acha ou cria" concorrentes duplicam.** Faça a busca e a escrita na mesma transação.
- **O backup nunca relaxa.** `validarBackup` só pode ficar mais rígido. Toda mudança em `src/backup/` leva testes adversariais.

## Dados e privacidade

- **Dado real vazou para documentos de um repositório público.** Os dois documentos fundadores traziam saldos, nomes de abas, nomes de terceiros e categorias que revelavam a vida privada. Ficaram semanas ali. Nenhuma checagem automática alcançaria: o hook só olha diffs novos, e só funciona com a lista privada. *Faça:* trate todo documento anterior a uma regra como não auditado. Para auditar, rode `node scripts/verificar-dados-reais.mjs` e varra `docs/` inteiro, não só os arquivos recentes.
- **Limpar a árvore não basta.** Depois de reescrever o histórico, o GitHub continuou servindo o commit antigo pelo SHA. A única correção completa foi recriar o repositório. *Faça:* nunca deixe o dado entrar. Esse custo é o motivo da regra do `CLAUDE.md`.
- **Dado tem forma de exibição e forma de armazenamento.** O app guarda centavos inteiros. Uma limpeza por texto formatado deixou o mesmo valor, como inteiro, em arquivos de teste. Detector genérico não vê o inteiro. *Faça:* ao limpar, liste todas as representações: exibição, centavos e somas derivadas. A lista privada de termos serve para isso.
- **Termo curto na lista privada gera falso positivo.** Três dígitos entre `\b` casam dentro de um valor com milhar e centavos. Uma palavra comum bloqueou um release. A primeira correção do padrão estava errada, e o próprio verificador a pegou. *Faça:* mantenha a lista e teste cada termo contra o `package-lock.json`.
- **Uma isenção larga desliga mais do que se pediu.** O dossiê foi isentado dos dois scans, quando só o padrão genérico de moeda precisava de isenção. *Faça:* estreite a isenção ao padrão necessário.
- **O método para obter o formato de um arquivo real sem expor o conteúdo.** O usuário roda o arquivo numa conversa à parte. A conversa devolve só a forma, com o conteúdo trocado. Os dados reais nunca entram na sessão. Isso revelou armadilhas que a imaginação não achou.
- **Auditoria com backup real: use um oráculo independente.** Reescreva o cálculo em Node a partir do JSON, sem reaproveitar funções do app. Rode também `checarTudo` do dossiê sobre o backup real. Os valores batiam. As divergências estavam em texto e regra entre telas.

## Interface e consistência

- **Consistência entre telas é requisito.** O mesmo conceito deve aparecer igual em toda tela. Divergências nasceram quando uma tela mudou e a outra não. *Faça:* antes de mudar como a UI mostra um conceito, rode grep pelo texto, pela classe e pela função de domínio.
- **Texto não dança.** Mesma coluna ou lista, mesmo tamanho, peso e alinhamento, inclusive para zero. Teste a rolagem lateral de tabela no mockup.
- **Formulário vem antes da lista**, em telas que têm os dois.
- **Menu de navegação não divide a tela com função.** Itens que levam a lugares ficam em tela própria. Toggle e campo vão numa subtela.
- **O visual passa por mockup aprovado antes da spec.** O mockup usa as classes e os tokens reais de `src/styles.css`. Inclua um seletor de cor ao vivo em mockups de cor. Confira todo link do mockup antes de enviar.
- **Todo HTML entregue leva `<meta charset="utf-8">` na primeira linha.** Sem isso, os acentos viram mojibake no celular.
- **Uma lembrança que dispara uma vez por sessão se gasta no primeiro gatilho.** O hook de estilo disparou num arquivo de teste e calou pelo resto da sessão. *Faça:* escolha a chave de repetição na granularidade da decisão. Exclua antes os caminhos onde a regra não vale.
- **Uma wiki ou doc pode afirmar o falso com autoridade.** Uma frase da wiki dizia que a box `casa` não vinha pronta. Eu tinha conferido uma camada (`repo.carregarTudo`) e não o comportamento (`iniciar()` cria a box). *Faça:* confira o comportamento ponta a ponta, não uma camada.
- **Um bug pode reabrir o próprio buraco da feature.** O contador do primeiro uso incluía a categoria que o app cria sozinho com o cartão. Quem cadastrava cartão primeiro perdia o guia. *Faça:* teste o fluxo na ordem inversa também.
- **Marcação crua pode chegar à tela.** O parser da wiki agora lança exceção para sintaxe fora do subconjunto. O changelog aceita dois níveis de lista. Confira a gramática em `src/ui/ajustes/changelog.ts` e `docs/wiki/README.md` antes de escrever.
- **Um aviso que compara por um campo precisa conhecer o campo antes de salvar.** O aviso de lançamento repetido passou a comparar a categoria. No modo Simples a categoria só nasce ao salvar (atalho, descrição ou "A classificar"). *Faça:* use a mesma função nos dois momentos, sem criar nada para o aviso. Se a categoria ainda não existe, não há o que comparar. O teste antigo do Simples passava sem descrição e deixou de valer: refaça o cenário, não afrouxe a regra.
- **Teste de seleção chaveada só pelo nome colide.** "Pix" existe como ganho e como gasto.

## Planejamento e backlog

- **Entregar não fecha o item.** Nada no ciclo de entrega olhava o backlog. Em um mês, cinco itens ficaram abertos depois de entregues. Um deles foi reescrito como prioridade 17 dias depois de pronto. *Faça:* antes do merge, pergunte "que item do `TODO.md` isto fecha, inteiro ou em parte?". "Nenhum" é resposta válida, se dita. Ao revisar o backlog, confira cada item contra o `CHANGELOG.md` e o código. Reescrever a lista não é conferi-la.
- **Trabalho que entra por conversa direta nunca é comparado com a fila.** Várias entregas grandes nasceram assim, sem item. *Faça:* registre-as em `TODO-CONCLUIDOS.md` na revisão seguinte.
- **Números de item nunca mudam nem se reaproveitam.** Outros itens e o histórico apontam para eles. Um número foi usado duas vezes, e a revisão de 2026-10-08 renumerou o item novo.
- **Meça antes de estimar.** Para o impacto de uma dependência no bundle, use `npm view <pacote> dist.unpackedSize`.
- **Um plano em português usa "Tarefa N".** O extrator do skill procura "Task N". *Faça:* use um extrator próprio.
- **Plano e código de exemplo que se contradizem: a prosa é o requisito.** Uma regex de exemplo deixava passar a sintaxe que a prosa mandava recusar.
- **Quando você pode ler o diff gerado, leia.** O dossiê mostrou um estado que nenhum usuário consegue produzir. Só a leitura do diff revelou.
- **Cobertura tem limite.** O dossiê não cobre sheet de botão nem subtela de Ajustes. Um diff vazio não prova que nada mudou.

## Comandos e ambiente (Windows)

- **Salve arquivos em UTF-8 sem BOM.** No PowerShell 5.1, `Set-Content` e `Out-File` não garantem isso. Um BOM já quebrou o verificador em modo estrito.
- **Backslash some em heredoc e `sed` na ferramenta Bash.** Escreva regex com a ferramenta de edição.
- **`npm run release` não atualiza a versão do `package-lock.json`.** Todo `npm install` depois suja a árvore e bloqueia o deploy. É uma mudança em `scripts/`, então depende de pedido do usuário.
