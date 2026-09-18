/** Lê texto CSV numa matriz de strings. A primeira linha não recebe tratamento especial.
 *  Trata BOM, aspas, vírgula dentro de aspas, aspas duplicadas e fim de linha do Windows.
 *  Linha vazia é descartada. Nunca lança: CSV malformado vira o que der para ler.
 *
 *  Por que não uma dependência: são 40 linhas, e cada pacote novo é superfície de ataque num
 *  app que guarda dados financeiros só no navegador do usuário. */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroDeAspas = false;

  const fecharCampo = () => { linha.push(campo); campo = ''; };
  const fecharLinha = () => {
    fecharCampo();
    if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
    linha = [];
  };

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else { dentroDeAspas = false; }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === ',') { fecharCampo(); continue; }
    if (c === '\r') continue;
    if (c === '\n') { fecharLinha(); continue; }
    campo += c;
  }
  if (campo !== '' || linha.length > 0) fecharLinha();
  return linhas;
}
