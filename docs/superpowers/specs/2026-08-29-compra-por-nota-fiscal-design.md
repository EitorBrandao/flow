# Compra no cartão a partir da nota fiscal (QR-code/XML)

## Contexto

Hoje, lançar uma compra no cartão (`FormCompra`) exige digitar valor, data, categoria e descrição à mão. Essa spec cobre a primeira metade de um pedido maior — "OCR e leitor de XML a partir do QR-code" — usando a NFC-e (nota fiscal de consumidor eletrônica) como fonte de dado estruturado e confiável.

A segunda metade (OCR de foto de comprovante, sem QR-code fiscal) fica para uma spec separada, depois desta em produção. Os dois mecanismos são independentes o bastante — câmera+QR+XML padronizado vs. câmera+reconhecimento de imagem+heurística de texto — para não caber num único documento.

## Restrição técnica que moldou o desenho

O QR-code da NFC-e aponta pra uma URL da Sefaz do estado do estabelecimento (formato padrão nacional: `.../nfce/qrcode?p=<chave 44 dígitos>|<versão>|<ambiente>|<tipo>|<hash>`). O conteúdo do próprio QR **não** carrega valor nem estabelecimento — só a chave de acesso. E o Flow, sendo um PWA local-first sem servidor, não consegue buscar a página de destino: testei ao vivo o portal de SP (`fazenda.sp.gov.br/nfce/qrcode`) e ele não manda `Access-Control-Allow-Origin` em nenhuma resposta, então um `fetch()` do navegador é bloqueado por CORS. Os dois proxies públicos de CORS mais comuns (`allorigins.win`, `codetabs.com`) estavam fora do ar no teste, e um terceiro (`corsproxy.io`) passou a exigir chave de API paga — confirmando que essa rota é frágil demais pra depender dela.

A solução adotada: o Flow só extrai a **chave de acesso** do QR-code. A busca do XML em si acontece **fora do app**, num site de consulta de NFC-e à escolha do usuário (ex.: consultadanfe.com) — que já resolve esse problema do lado servidor deles. O Flow não linka nem depende de nenhum site específico continuar existindo: só mostra a chave e deixa o usuário resolver como quiser. O papel do Flow é parsear o XML padrão (schema NFe/NFC-e nacional), que é estruturado e estável — bem mais confiável que raspar HTML de portais estaduais que mudam de layout sem aviso.

## Fluxo do usuário

1. Na sheet "Adicionar", um ícone de câmera aparece no cabeçalho, ao lado do título "Adicionar" (espelhado, lado direito).
2. O ícone abre a tela de escaneamento: câmera ligada, decodificando QR-code via `jsQR`.
3. Ao achar um QR-code de NFC-e válido, extrai a chave de 44 dígitos da URL. Se a câmera falhar (permissão negada, sem câmera) ou o QR não for reconhecido, um campo de texto permite digitar ou colar a chave manualmente — sempre há uma saída.
4. Com a chave em mãos, o Flow mostra: a chave extraída, um botão de copiar, e a instrução "cole essa chave num site de consulta de NFC-e para baixar o XML".
5. Usuário sai do Flow, busca o XML onde preferir, volta com o arquivo ou o texto.
6. De volta no Flow: uma tela aceita upload de arquivo `.xml` **ou** colar o texto do XML — as duas vias, porque sites diferentes entregam de jeitos diferentes.
7. O Flow parseia o XML e segue pro fluxo já existente de escolher cartão (ou pula direto se só há um cartão ativo) → `FormCompra`, com **valor, data e descrição pré-preenchidos**. Categoria e parcelas continuam manuais — nada no XML indica isso.
8. Se o parse falhar total ou parcialmente (formato inesperado, campo faltando), mostra uma mensagem de erro mas preenche no formulário o que conseguiu extrair; o resto fica em branco pro usuário completar. Nunca bloqueia o usuário de seguir pro `FormCompra` manual.

## Arquitetura

- **`src/domain/notaFiscal.ts`** (novo, lógica pura, sem E/S):
  - `extrairChaveDoQrCode(texto: string): string | undefined` — reconhece o formato padrão nacional da URL do QR-code e extrai a chave de 44 dígitos. Devolve `undefined` se não casar (sem lançar exceção).
  - `parsearNotaFiscal(xml: string): { valorTotal?: number; data?: ISODate; descricao?: string }` — faz o parse do XML da NFC-e via `DOMParser` (nativo do browser, sem dependência nova). Cada campo vem `undefined` quando ausente ou o XML como um todo é irreconhecível; a função nunca lança exceção — XML malformado é dado de entrada esperado, não bug.
  - Mapeamento de campos: `total/ICMSTot/vNF` (string decimal, ex. `"123.45"`) → `valorTotal` em centavos; `ide/dhEmi` (datetime ISO 8601 com timezone) → só a parte de data, formato `ISODate`; `emit/xNome` (razão social do estabelecimento) → `descricao`.
- **`src/ui/EscanearNotaSheet.tsx`** (novo): orquestra os passos câmera → chave → upload/colar XML → resultado. Usa `jsQR` pra decodificar frames da câmera capturados via `getUserMedia` + `canvas`.
- **`AdicionarSheet.tsx`**: ganha o ícone de câmera no cabeçalho (usando o slot `cabecalho` do `Sheet`, hoje não usado por essa tela) que abre `EscanearNotaSheet`. Ao concluir a extração, o resultado segue pro fluxo existente de escolher cartão → `FormCompra`, do mesmo jeito que hoje os chips de "Frequentes" passam `inicial` — só que com `data` e `descricao` além de `valorTotal`. Isso exige estender o tipo do `inicial` em `FormCompra` (hoje só `{ valorTotal, categoriaCartaoId }`) para aceitar `data` e `descricao` opcionais.

## Dependência nova

`jsQR` decodifica QR-code a partir de um frame de imagem/canvas, em JS puro, sem dependências próprias. Alternativa descartada: a API nativa `BarcodeDetector` do Chrome evitaria essa dependência, mas tem suporte mais restrito entre navegadores — `jsQR` foi a escolha explícita do usuário. Segue o processo padrão do repositório na implementação: `npm audit`, lockfile no mesmo commit, justificativa registrada.

## Testes

- `notaFiscal.test.ts`: parse de XML válido (todos os campos), XML parcial (campo faltando → `undefined`, não exceção), XML malformado ou vazio, extração de chave a partir de URLs de QR-code válidas e inválidas/de outro formato.
- `EscanearNotaSheet.test.tsx`: cobre o caminho de digitar a chave manualmente e o de colar/enviar o XML, e o preenchimento resultante repassado ao `FormCompra`. A decodificação de vídeo em si (câmera real) não é testável em jsdom — fica de fora, coberta só manualmente.

## Fora de escopo

- OCR de foto de comprovante sem QR-code fiscal (spec separada, depois desta).
- Qualquer integração automática com sites de consulta de NFC-e (deep link, abrir aba automaticamente) — decisão explícita de não amarrar o Flow a um serviço de terceiro específico.
- Itens da nota (`det/prod`) — só o total entra no `CompraCartao`. Um analisador de itens/distribuição do total é candidato a uma ferramenta separada, fora do Flow.
- Parcelamento: a NFC-e não indica parcelas de cartão de crédito; o campo continua manual, default 1.
