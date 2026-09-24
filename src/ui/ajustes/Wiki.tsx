import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import {
  buscar, idDoCapitulo, normalizar, parseCapitulo, sortearNomes, termosDoGlossario,
  type Bloco, type Capitulo, type Inline, type ItemCampo,
} from './capitulos';
import { useTravarRolagem } from '../useTravarRolagem';

// Carrega capítulos (exclui README que não é um capítulo)
const BRUTOS_TODOS = import.meta.glob('../../../docs/wiki/*.md', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
const BRUTOS = Object.fromEntries(
  Object.entries(BRUTOS_TODOS).filter(([caminho]) => !caminho.includes('README'))
);

/** Espaço entre a barra e o título de destino. O mesmo valor decide a seção atual: um salto para a seção a deixa como atual. */
const FOLGA = 8;

interface Acoes {
  ir: (capitulo: string, secao?: string) => void;
  alternarTermo: (id: string, alvo: HTMLElement) => void;
  termoAberto: string | null;
}
const AcoesWiki = createContext<Acoes | null>(null);

function Trechos({ partes }: { partes: Inline[] }) {
  const acoes = useContext(AcoesWiki);
  return (
    <>
      {partes.map((p, i) => {
        if (p.tipo === 'forte') return <strong key={i}>{p.texto}</strong>;
        if (p.tipo === 'codigo') return <code key={i}>{p.texto}</code>;
        if (p.tipo === 'link') return <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">{p.texto}</a>;
        if (p.tipo === 'ref') {
          const rotulo = p.codigo ? <code>{p.texto}</code> : p.texto;
          if (p.capitulo === 'glossario' && p.secao) {
            const id = p.secao;
            return (
              <button
                key={i} type="button" data-termo
                className={`wiki-termo${acoes?.termoAberto === id ? ' aberto' : ''}`}
                aria-expanded={acoes?.termoAberto === id}
                onClick={(e) => acoes?.alternarTermo(id, e.currentTarget)}
              >{rotulo}</button>
            );
          }
          const href = `#${p.capitulo}${p.secao ? `/${p.secao}` : ''}`;
          return (
            <a
              key={i} href={href} className="wiki-link"
              onClick={(e: MouseEvent) => { e.preventDefault(); acoes?.ir(p.capitulo, p.secao); }}
            >{rotulo}</a>
          );
        }
        return <span key={i}>{p.texto}</span>;
      })}
    </>
  );
}

function BlocoRender({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === 'topico') return <h3 id={bloco.id}>{bloco.titulo}</h3>;
  if (bloco.tipo === 'paragrafo') return <p><Trechos partes={bloco.conteudo} /></p>;
  if (bloco.tipo === 'nota') return <p className="aviso"><Trechos partes={bloco.conteudo} /></p>;
  if (bloco.tipo === 'lista') {
    return <ul>{bloco.itens.map((item, i) => <li key={i}><Trechos partes={item} /></li>)}</ul>;
  }
  return (
    <dl className="wiki-campos">
      {bloco.itens.map((item) => (
        <div key={item.id} id={item.id}>
          <dt><Trechos partes={item.termo} /></dt>
          <dd><Trechos partes={item.definicao} /></dd>
        </div>
      ))}
    </dl>
  );
}

interface Balao { id: string; top: number; seta: number }

export default function Wiki() {
  const [nomes] = useState(() => sortearNomes());
  const capitulos: Capitulo[] = useMemo(
    () => Object.entries(BRUTOS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([caminho, raw]) => parseCapitulo(idDoCapitulo(caminho), raw, nomes)),
    [nomes],
  );
  const glossario = useMemo(() => {
    const g = capitulos.find((c) => c.id === 'glossario');
    return g ? termosDoGlossario(g) : new Map<string, Omit<ItemCampo, 'id'>>();
  }, [capitulos]);
  const [atualId, setAtualId] = useState(capitulos[0].id);
  const [indiceAberto, setIndiceAberto] = useState(false);
  useTravarRolagem(indiceAberto);
  const [busca, setBusca] = useState('');
  const [destino, setDestino] = useState<{ secao?: string } | null>(null);
  const [balao, setBalao] = useState<Balao | null>(null);
  const [secaoAtual, setSecaoAtual] = useState<string | null>(null);
  const corpo = useRef<HTMLElement>(null);
  const barra = useRef<HTMLButtonElement>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const alvo = normalizar(busca.trim());
  const resultados = useMemo(() => buscar(capitulos, busca), [capitulos, busca]);
  const atual = capitulos.find((c) => c.id === atualId) ?? capitulos[0];
  const secoes = atual.blocos.filter((b): b is Extract<Bloco, { tipo: 'topico' }> => b.tipo === 'topico');
  const tituloSecao = secoes.find((s) => s.id === secaoAtual)?.titulo;

  // Depois de trocar de capítulo por link: rola até a seção, ou ao topo do capítulo.
  useEffect(() => {
    if (!destino) return;
    const el = (destino.secao && document.getElementById(destino.secao)) || corpo.current;
    el?.scrollIntoView?.({ block: 'start' });
    setDestino(null);
  }, [destino, atualId]);

  // A barra gruda logo abaixo do .topo do app; títulos e campos param FOLGA px abaixo da barra ao rolar até eles.
  useEffect(() => {
    const medir = () => {
      const topo = document.querySelector<HTMLElement>('.topo')?.offsetHeight ?? 0;
      const altura = barra.current?.offsetHeight ?? 0;
      raiz.current?.style.setProperty('--wiki-topo', `${topo}px`);
      raiz.current?.style.setProperty('--wiki-rolagem', `${topo + altura + FOLGA}px`);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  // Seção atual: o último título cujo topo já chegou à base da barra mais a FOLGA — onde um salto para a seção o deixa.
  useEffect(() => {
    const atualizar = () => {
      const limite = (barra.current?.getBoundingClientRect().bottom ?? 0) + FOLGA + 1;
      let id: string | null = null;
      corpo.current?.querySelectorAll<HTMLElement>('h3[id]').forEach((h) => {
        if (h.getBoundingClientRect().top <= limite) id = h.id;
      });
      setSecaoAtual(id);
    };
    atualizar();
    window.addEventListener('scroll', atualizar, { passive: true });
    return () => window.removeEventListener('scroll', atualizar);
  }, [atualId]);

  // Balão aberto: fecha ao tocar fora dele (o termo cuida do próprio toque), ao rolar, ou ao pressionar Esc.
  useEffect(() => {
    if (!balao) return;
    const fechar = () => setBalao(null);
    const aoTocar = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest('.wiki-balao') || t.closest('[data-termo]')) return;
      fechar();
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('click', aoTocar);
    window.addEventListener('scroll', fechar, true);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('click', aoTocar);
      window.removeEventListener('scroll', fechar, true);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [balao]);

  const acoes: Acoes = {
    ir: (capitulo, secao) => { setBalao(null); setAtualId(capitulo); setDestino({ secao }); },
    alternarTermo: (id, el) => {
      if (balao?.id === id) { setBalao(null); return; }
      if (el.closest('.wiki-balao') && balao) {
        setBalao({ ...balao, id });
        return;
      }
      const ra = corpo.current!.getBoundingClientRect();
      const rt = el.getBoundingClientRect();
      const meio = rt.left - ra.left + rt.width / 2 - 7;
      setBalao({ id, top: rt.bottom - ra.top + 10, seta: Math.max(14, Math.min(ra.width - 28, meio)) });
    },
    termoAberto: balao?.id ?? null,
  };
  const termo = balao ? glossario.get(balao.id) : undefined;

  return (
    <div className="tela" ref={raiz}>
      <h2>Wiki</h2>
      <button ref={barra} className="wiki-barra" aria-label="Índice" onClick={() => setIndiceAberto(true)}>
        <span aria-hidden="true">☰</span>
        <span className="wiki-barra-texto">
          {atual.titulo}
          {tituloSecao && <span className="wiki-barra-secao"> · {tituloSecao}</span>}
        </span>
      </button>

      <AcoesWiki.Provider value={acoes}>
        <article className="wiki-corpo" ref={corpo}>
          <h3 className="wiki-titulo">{atual.titulo}</h3>
          {atual.blocos.map((b, i) => <BlocoRender key={i} bloco={b} />)}
          {balao && termo && (
            <div
              className="wiki-balao" role="dialog"
              aria-label={`Definição: ${termo.termo.map((p: Inline) => p.texto).join('')}`}
              style={{ top: balao.top, '--seta': `${balao.seta}px` } as CSSProperties}
            >
              <p className="wiki-balao-termo"><Trechos partes={termo.termo} /></p>
              <p className="wiki-balao-def"><Trechos partes={termo.definicao} /></p>
            </div>
          )}
        </article>
      </AcoesWiki.Provider>

      {indiceAberto && (
        <>
          <button className="wiki-fundo" aria-label="Fechar índice" onClick={() => setIndiceAberto(false)} />
          <nav className="wiki-gaveta">
            <label className="rotulo" htmlFor="wiki-busca">Buscar na wiki</label>
            <input
              id="wiki-busca" className="campo-busca" type="search" value={busca}
              onChange={(e) => setBusca(e.target.value)} aria-label="Buscar na wiki"
            />
            {!alvo && capitulos.map((c) => (
              <Fragment key={c.id}>
                <button
                  className={`wiki-item${c.id === atual.id ? ' ativo' : ''}`}
                  onClick={() => { setBalao(null); setAtualId(c.id); setIndiceAberto(false); }}
                >
                  {c.titulo}
                </button>
                {c.id === atual.id && secoes.map((s) => (
                  <button
                    key={s.id} className={`wiki-item wiki-secao${s.id === secaoAtual ? ' ativo' : ''}`}
                    onClick={() => { setIndiceAberto(false); acoes.ir(c.id, s.id); }}
                  >
                    {s.titulo}
                  </button>
                ))}
              </Fragment>
            ))}
            {alvo && resultados.map((r) => (
              <button
                key={`${r.capitulo}/${r.secao ?? ''}`} className="wiki-item wiki-resultado"
                onClick={() => { setIndiceAberto(false); acoes.ir(r.capitulo, r.secao); }}
              >
                <span className="wiki-resultado-onde">{r.tituloCapitulo}{r.tituloSecao && ` · ${r.tituloSecao}`}</span>
                <span className="wiki-resultado-trecho">{r.antes}<mark>{r.achado}</mark>{r.depois}</span>
              </button>
            ))}
            {alvo && resultados.length === 0 && <p className="sub">Nada encontrado.</p>}
          </nav>
        </>
      )}
    </div>
  );
}
