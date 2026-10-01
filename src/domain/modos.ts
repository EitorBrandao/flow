import type { Categoria, Config, ID, Lancamento, ModoUso, ModosUso, TelaModo, TipoCategoria } from './types';
import { TELAS_MODO } from './types';

export { TELAS_MODO } from './types';

export function modoDe(config: Config, tela: TelaModo): ModoUso {
  return config.modos?.[tela] ?? 'avancado';
}

export function modosEfetivos(config: Config): ModosUso {
  return Object.fromEntries(TELAS_MODO.map((t) => [t, modoDe(config, t)])) as ModosUso;
}

export function modosInstalacaoNova(): ModosUso {
  return Object.fromEntries(TELAS_MODO.map((t) => [t, 'simples'])) as ModosUso;
}

export function modosValidos(x: unknown): x is Partial<ModosUso> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.entries(x).every(
    ([k, v]) => (TELAS_MODO as readonly string[]).includes(k) && (v === 'simples' || v === 'avancado'),
  );
}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** Categoria do último lançamento manual da box com a mesma descrição (nota). Nulo se não houver. */
export function categoriaPorDescricao(p: {
  lancamentos: Lancamento[]; categorias: Categoria[]; boxId: ID; tipo: TipoCategoria; descricao: string;
}): ID | null {
  const chave = norm(p.descricao);
  if (!chave) return null;
  const porId = new Map(p.categorias.map((c) => [c.id, c]));
  let melhor: Lancamento | undefined;
  for (const l of p.lancamentos) {
    if (l.boxId !== p.boxId || l.cenarioId || l.origem !== 'manual' || norm(l.nota) !== chave) continue;
    const c = porId.get(l.categoriaId);
    if (!c || c.arquivada || c.tipo !== p.tipo) continue;
    if (!melhor || l.data > melhor.data || (l.data === melhor.data && l.criadoEm > melhor.criadoEm)) melhor = l;
  }
  return melhor?.categoriaId ?? null;
}
