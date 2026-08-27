export interface ChangelogItem {
  texto: string;
  detalhes: string[];
}

export interface ChangelogSecao {
  titulo: string;
  itens: ChangelogItem[];
}

export interface ChangelogVersao {
  versao: string;
  data: string;
  secoes: ChangelogSecao[];
}

export function parseChangelog(raw: string): ChangelogVersao[] {
  const versoes: ChangelogVersao[] = [];
  let versaoAtual: ChangelogVersao | null = null;
  let secaoAtual: ChangelogSecao | null = null;
  let itemAtual: ChangelogItem | null = null;

  for (const linha of raw.split(/\r?\n/)) {
    const versaoMatch = linha.match(/^## \[(.+?)\] - (.+)$/);
    if (versaoMatch) {
      versaoAtual = { versao: versaoMatch[1], data: versaoMatch[2], secoes: [] };
      versoes.push(versaoAtual);
      secaoAtual = null;
      itemAtual = null;
      continue;
    }
    const secaoMatch = linha.match(/^### (.+)$/);
    if (secaoMatch && versaoAtual) {
      secaoAtual = { titulo: secaoMatch[1], itens: [] };
      versaoAtual.secoes.push(secaoAtual);
      itemAtual = null;
      continue;
    }
    // tópico: "- " na coluna 0.
    const itemMatch = linha.match(/^- (.+)$/);
    if (itemMatch && secaoAtual) {
      itemAtual = { texto: itemMatch[1], detalhes: [] };
      secaoAtual.itens.push(itemAtual);
      continue;
    }
    // detalhe: exatamente 2 espaços + "- ", sob o tópico mais recente.
    const detalheMatch = linha.match(/^ {2}- (.+)$/);
    if (detalheMatch && itemAtual) {
      itemAtual.detalhes.push(detalheMatch[1]);
      continue;
    }
    // continuação: qualquer outra linha indentada, sem "- " próprio, gruda no bullet mais
    // recente — no último detalhe, se houver algum, senão no texto do tópico.
    const continuacaoMatch = linha.match(/^\s+(\S.*)$/);
    if (continuacaoMatch && itemAtual) {
      if (itemAtual.detalhes.length > 0) {
        const ultimo = itemAtual.detalhes.length - 1;
        itemAtual.detalhes[ultimo] += ` ${continuacaoMatch[1]}`;
      } else {
        itemAtual.texto += ` ${continuacaoMatch[1]}`;
      }
    }
  }

  return versoes;
}
