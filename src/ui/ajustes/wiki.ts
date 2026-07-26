// Renderizador próprio, com um subconjunto FECHADO de markdown — ver docs/wiki/README.md.
// Fechado de propósito: sintaxe não suportada lança em vez de ser ignorada, porque parser
// que engole o que não entende produz capítulo torto sem ninguém perceber.

export type Inline =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'forte'; texto: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'link'; texto: string; href: string };

export type Bloco =
  | { tipo: 'paragrafo'; conteudo: Inline[] }
  | { tipo: 'topico'; titulo: string; id: string }
  | { tipo: 'lista'; itens: Inline[][] }
  | { tipo: 'nota'; conteudo: Inline[] }
  | { tipo: 'campos'; itens: { termo: Inline[]; definicao: Inline[] }[] };

export interface Capitulo {
  id: string;
  titulo: string;
  blocos: Bloco[];
  /** tudo em texto puro, sem marcação — é sobre isto que a busca roda */
  texto: string;
}

export interface Nomes { a: string; b: string }

/** Nomes de exemplo. Sorteados a cada abertura para não parecerem o dono do app. */
export const NOMES = [
  'Ana', 'Bruno', 'Carla', 'Davi', 'Elisa', 'Felipe', 'Gabi', 'Igor',
  'Lara', 'Mateus', 'Nina', 'Otávio', 'Paula', 'Rafa', 'Sofia', 'Tiago',
];

export function sortearNomes(aleatorio: () => number = Math.random): Nomes {
  const i = Math.floor(aleatorio() * NOMES.length) % NOMES.length;
  let j = Math.floor(aleatorio() * (NOMES.length - 1)) % (NOMES.length - 1);
  if (j >= i) j += 1; // pula o já sorteado: dois nomes sempre distintos
  return { a: NOMES[i], b: NOMES[j] };
}

function aplicarNomes(texto: string, nomes: Nomes): string {
  return texto
    .replace(/\{\{nomeA\}\}/g, nomes.a)
    .replace(/\{\{nomeB\}\}/g, nomes.b)
    .replace(/\{\{boxA\}\}/g, nomes.a.toLowerCase())
    .replace(/\{\{boxB\}\}/g, nomes.b.toLowerCase());
}

const RE_INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;

export function parseInline(texto: string): Inline[] {
  const partes: Inline[] = [];
  for (const pedaco of texto.split(RE_INLINE)) {
    if (!pedaco) continue;
    if (pedaco.startsWith('**') && pedaco.endsWith('**')) {
      partes.push({ tipo: 'forte', texto: pedaco.slice(2, -2) });
    } else if (pedaco.startsWith('`') && pedaco.endsWith('`')) {
      partes.push({ tipo: 'codigo', texto: pedaco.slice(1, -1) });
    } else if (pedaco.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(pedaco);
      if (m) partes.push({ tipo: 'link', texto: m[1], href: m[2] });
    } else {
      partes.push({ tipo: 'texto', texto: pedaco });
    }
  }
  return partes;
}

/** Identificador de âncora a partir do título do tópico. */
export function idDoTopico(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const NAO_SUPORTADA = /^(#{3,}\s|\||\d+\.\s|\*(?!\*)|!\[|\t)/;

export function parseCapitulo(id: string, raw: string, nomes: Nomes): Capitulo {
  const linhas = aplicarNomes(raw, nomes).split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  let titulo = '';
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    if (paragrafo.length === 0) return;
    blocos.push({ tipo: 'paragrafo', conteudo: parseInline(paragrafo.join(' ')) });
    paragrafo = [];
  };

  for (const linha of linhas) {
    if (linha.trim() === '') { fecharParagrafo(); continue; }
    if (NAO_SUPORTADA.test(linha)) {
      throw new Error(`wiki: sintaxe não suportada no capítulo "${id}": ${linha.slice(0, 40)}`);
    }
    if (linha.startsWith('# ')) {
      fecharParagrafo();
      if (titulo) {
        throw new Error(`wiki: capítulo "${id}" tem mais de um título (primeira linha "# ...")`);
      }
      titulo = linha.slice(2).trim();
      continue;
    }
    if (linha.startsWith('## ')) {
      fecharParagrafo();
      const t = linha.slice(3).trim();
      blocos.push({ tipo: 'topico', titulo: t, id: idDoTopico(t) });
      continue;
    }
    if (linha.startsWith('> ')) {
      fecharParagrafo();
      blocos.push({ tipo: 'nota', conteudo: parseInline(linha.slice(2).trim()) });
      continue;
    }
    if (linha.startsWith('- ')) {
      fecharParagrafo();
      const item = parseInline(linha.slice(2).trim());
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.tipo === 'lista') ultimo.itens.push(item);
      else blocos.push({ tipo: 'lista', itens: [item] });
      continue;
    }
    if (linha.startsWith(': ')) {
      fecharParagrafo();
      const partes = linha.slice(2).split('|');
      if (partes.length < 2) {
        throw new Error(`wiki: sintaxe não suportada no capítulo "${id}": ${linha.slice(0, 40)}`);
      }
      const [termo, ...resto] = partes;
      const item = { termo: parseInline(termo.trim()), definicao: parseInline(resto.join('|').trim()) };
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.tipo === 'campos') ultimo.itens.push(item);
      else blocos.push({ tipo: 'campos', itens: [item] });
      continue;
    }
    paragrafo.push(linha.trim());
  }
  fecharParagrafo();

  if (!titulo) throw new Error(`wiki: capítulo "${id}" sem título (primeira linha "# ...")`);

  const texto = textoPuro(titulo, blocos);
  return { id, titulo, blocos, texto };
}

function inlineTexto(partes: Inline[]): string {
  return partes.map((p) => p.texto).join('');
}

function textoPuro(titulo: string, blocos: Bloco[]): string {
  const pedacos = [titulo];
  for (const b of blocos) {
    if (b.tipo === 'topico') pedacos.push(b.titulo);
    else if (b.tipo === 'lista') pedacos.push(...b.itens.map(inlineTexto));
    else if (b.tipo === 'campos') pedacos.push(...b.itens.map((i) => `${inlineTexto(i.termo)} ${inlineTexto(i.definicao)}`));
    else pedacos.push(inlineTexto(b.conteudo));
  }
  return pedacos.join(' ');
}

/** Normaliza para busca: sem acento, sem caixa. */
export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
