// Renderizador próprio, com um subconjunto FECHADO de markdown — ver docs/wiki/README.md.
// Fechado de propósito: sintaxe não suportada lança em vez de ser ignorada, porque parser
// que engole o que não entende produz capítulo torto sem ninguém perceber.

export type Inline =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'forte'; texto: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'link'; texto: string; href: string }
  /** link interno: capítulo, e seção opcional. `codigo` = texto veio entre crases */
  | { tipo: 'ref'; texto: string; capitulo: string; secao?: string; codigo?: boolean };

export interface ItemCampo { id: string; termo: Inline[]; definicao: Inline[] }

export type Bloco =
  | { tipo: 'paragrafo'; conteudo: Inline[] }
  | { tipo: 'topico'; titulo: string; id: string }
  | { tipo: 'lista'; itens: Inline[][] }
  | { tipo: 'nota'; conteudo: Inline[] }
  | { tipo: 'campos'; itens: ItemCampo[] };

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

// [[termo]] vem antes do link comum: os dois começam com "[".
const RE_INLINE = /(\[\[[^[\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;

/** `#capitulo` ou `#capitulo/secao` → ref. Qualquer outra forma com `#` lança. */
function refInterna(texto: string, href: string): Inline {
  const m = /^#([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/.exec(href);
  if (!m) throw new Error(`wiki: link interno malformado: "${href}" (use #capitulo ou #capitulo/secao)`);
  return m[2] ? { tipo: 'ref', texto, capitulo: m[1], secao: m[2] } : { tipo: 'ref', texto, capitulo: m[1] };
}

function refGlossario(bruto: string): Inline {
  const codigo = bruto.length > 2 && bruto.startsWith('`') && bruto.endsWith('`');
  const texto = codigo ? bruto.slice(1, -1) : bruto;
  const trimmed = texto.trim();
  if (!trimmed) throw new Error('wiki: [[ ]] vazio');
  const ref: Inline = { tipo: 'ref', texto: trimmed, capitulo: 'glossario', secao: idDoTopico(trimmed) };
  return codigo ? { ...ref, codigo: true } : ref;
}

export function parseInline(texto: string): Inline[] {
  const partes: Inline[] = [];
  for (const pedaco of texto.split(RE_INLINE)) {
    if (!pedaco) continue;
    if (pedaco.startsWith('[[') && pedaco.endsWith(']]')) {
      partes.push(refGlossario(pedaco.slice(2, -2).trim()));
    } else if (pedaco.startsWith('**') && pedaco.endsWith('**')) {
      partes.push({ tipo: 'forte', texto: pedaco.slice(2, -2) });
    } else if (pedaco.startsWith('`') && pedaco.endsWith('`')) {
      partes.push({ tipo: 'codigo', texto: pedaco.slice(1, -1) });
    } else if (pedaco.startsWith('[') && /^\[([^\]]+)\]\(([^)]+)\)$/.test(pedaco)) {
      const [, t, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(pedaco)!;
      partes.push(href.startsWith('#') ? refInterna(t, href) : { tipo: 'link', texto: t, href });
    } else {
      // Texto que sobrou — não pode conter marcação não reconhecida
      const marcacaoInvalida = pedaco.match(/\*|`|\]\(|\{\{|\[\[|\]\]/);
      if (marcacaoInvalida) {
        throw new Error(`Marcação não reconhecida no texto: "${pedaco.slice(0, 60)}..."`);
      }
      partes.push({ tipo: 'texto', texto: pedaco });
    }
  }
  return partes;
}

/** Identificador de âncora a partir do título do tópico. */
export function idDoTopico(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Id estável do capítulo: nome do arquivo sem pasta, extensão e número. Renumerar não quebra link. */
export function idDoCapitulo(caminho: string): string {
  return caminho.split('/').pop()!.replace(/\.md$/, '').replace(/^\d+-/, '');
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
      const termoInline = parseInline(termo.trim());
      const item: ItemCampo = {
        id: idDoTopico(inlineTexto(termoInline)),
        termo: termoInline,
        definicao: parseInline(resto.join('|').trim()),
      };
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

function textoDoBloco(b: Bloco): string[] {
  if (b.tipo === 'topico') return [b.titulo];
  if (b.tipo === 'lista') return b.itens.map(inlineTexto);
  if (b.tipo === 'campos') return b.itens.map((i) => `${inlineTexto(i.termo)} ${inlineTexto(i.definicao)}`);
  return [inlineTexto(b.conteudo)];
}

function textoPuro(titulo: string, blocos: Bloco[]): string {
  return [titulo, ...blocos.flatMap(textoDoBloco)].join(' ');
}

/** Normaliza para busca: sem acento, sem caixa. */
export function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface SecaoTexto { id?: string; titulo?: string; texto: string }

/** Texto puro por seção. O primeiro item é a introdução (título do capítulo + texto antes do primeiro ##). */
export function secoesDoCapitulo(c: Capitulo): SecaoTexto[] {
  const secoes: { id?: string; titulo?: string; pedacos: string[] }[] = [{ pedacos: [c.titulo] }];
  for (const b of c.blocos) {
    if (b.tipo === 'topico') secoes.push({ id: b.id, titulo: b.titulo, pedacos: [b.titulo] });
    else secoes[secoes.length - 1].pedacos.push(...textoDoBloco(b));
  }
  return secoes.map(({ pedacos, ...resto }) => ({ ...resto, texto: pedacos.join(' ') }));
}

export interface Resultado {
  capitulo: string; tituloCapitulo: string;
  secao?: string; tituloSecao?: string;
  antes: string; achado: string; depois: string;
}

const CONTEXTO = 40;

/** Posição [início, fim) no texto original do primeiro trecho que casa com `alvo` já normalizado. */
function localizar(texto: string, alvo: string): [number, number] | null {
  let norm = '';
  const origem: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const n = normalizar(texto[i]);
    for (let j = 0; j < n.length; j++) origem.push(i);
    norm += n;
  }
  const k = norm.indexOf(alvo);
  if (k < 0) return null;
  return [origem[k], origem[k + alvo.length - 1] + 1];
}

/** Busca na wiki: um resultado por seção, com trecho em volta da primeira ocorrência. */
export function buscar(capitulos: Capitulo[], termo: string): Resultado[] {
  const alvo = normalizar(termo.trim());
  if (!alvo) return [];
  const resultados: Resultado[] = [];
  for (const c of capitulos) {
    for (const s of secoesDoCapitulo(c)) {
      const pos = localizar(s.texto, alvo);
      if (!pos) continue;
      const [ini, fim] = pos;
      let a = Math.max(0, ini - CONTEXTO);
      let b = Math.min(s.texto.length, fim + CONTEXTO);
      if (a > 0) { const e = s.texto.indexOf(' ', a); a = e >= 0 && e < ini ? e + 1 : ini; }
      if (b < s.texto.length) { const e = s.texto.lastIndexOf(' ', b); b = e >= fim ? e : fim; }
      resultados.push({
        capitulo: c.id, tituloCapitulo: c.titulo,
        ...(s.id ? { secao: s.id, tituloSecao: s.titulo } : {}),
        antes: (a > 0 ? '…' : '') + s.texto.slice(a, ini),
        achado: s.texto.slice(ini, fim),
        depois: s.texto.slice(fim, b) + (b < s.texto.length ? '…' : ''),
      });
    }
  }
  return resultados;
}

function inlinesDoBloco(b: Bloco): Inline[] {
  if (b.tipo === 'topico') return [];
  if (b.tipo === 'lista') return b.itens.flat();
  if (b.tipo === 'campos') return b.itens.flatMap((i) => [...i.termo, ...i.definicao]);
  return b.conteudo;
}

/** Ids que um link `#capitulo/…` pode alcançar: seções e termos de campos. */
function destinosDe(cap: Capitulo): Set<string> {
  const ids = new Set<string>();
  for (const b of cap.blocos) {
    if (b.tipo === 'topico') ids.add(b.id);
    if (b.tipo === 'campos') for (const i of b.itens) ids.add(i.id);
  }
  return ids;
}

/** Confere todo link interno. Devolve um erro por destino inexistente; lista vazia = tudo certo. */
export function validarLinks(capitulos: Capitulo[]): string[] {
  const porId = new Map(capitulos.map((c) => [c.id, c]));
  const erros: string[] = [];
  for (const cap of capitulos) {
    for (const p of cap.blocos.flatMap(inlinesDoBloco)) {
      if (p.tipo !== 'ref') continue;
      const alvo = `#${p.capitulo}${p.secao ? `/${p.secao}` : ''}`;
      const destino = porId.get(p.capitulo);
      if (!destino) erros.push(`${cap.id}: capítulo inexistente em ${alvo}`);
      else if (p.secao && !destinosDe(destino).has(p.secao)) erros.push(`${cap.id}: seção ou termo inexistente em ${alvo}`);
    }
  }
  return erros;
}

export function termosDoGlossario(glossario: Capitulo): Map<string, Omit<ItemCampo, 'id'>> {
  const termos = new Map<string, Omit<ItemCampo, 'id'>>();
  for (const b of glossario.blocos) {
    if (b.tipo === 'campos') for (const i of b.itens) termos.set(i.id, { termo: i.termo, definicao: i.definicao });
  }
  return termos;
}
