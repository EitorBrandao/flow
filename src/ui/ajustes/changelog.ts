export interface ChangelogSecao {
  titulo: string;
  itens: string[];
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

  for (const linha of raw.split(/\r?\n/)) {
    const versaoMatch = linha.match(/^## \[(.+?)\] - (.+)$/);
    if (versaoMatch) {
      versaoAtual = { versao: versaoMatch[1], data: versaoMatch[2], secoes: [] };
      versoes.push(versaoAtual);
      secaoAtual = null;
      continue;
    }
    const secaoMatch = linha.match(/^### (.+)$/);
    if (secaoMatch && versaoAtual) {
      secaoAtual = { titulo: secaoMatch[1], itens: [] };
      versaoAtual.secoes.push(secaoAtual);
      continue;
    }
    const itemMatch = linha.match(/^- (.+)$/);
    if (itemMatch && secaoAtual) {
      secaoAtual.itens.push(itemMatch[1]);
    }
  }

  return versoes;
}
