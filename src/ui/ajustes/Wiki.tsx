import { useMemo, useState } from 'react';
import { normalizar, parseCapitulo, sortearNomes, type Bloco, type Capitulo, type Inline } from './capitulos';

// Carrega capítulos (exclui README que não é um capítulo)
const BRUTOS_TODOS = import.meta.glob('../../../docs/wiki/*.md', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;
const BRUTOS = Object.fromEntries(
  Object.entries(BRUTOS_TODOS).filter(([caminho]) => !caminho.includes('README'))
);

function idDoArquivo(caminho: string): string {
  return caminho.split('/').pop()!.replace(/\.md$/, '');
}

function Trechos({ partes }: { partes: Inline[] }) {
  return (
    <>
      {partes.map((p, i) => {
        if (p.tipo === 'forte') return <strong key={i}>{p.texto}</strong>;
        if (p.tipo === 'codigo') return <code key={i}>{p.texto}</code>;
        if (p.tipo === 'link') return <a key={i} href={p.href} target={p.href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{p.texto}</a>;
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
      {bloco.itens.map((item, i) => (
        <div key={i}>
          <dt><Trechos partes={item.termo} /></dt>
          <dd><Trechos partes={item.definicao} /></dd>
        </div>
      ))}
    </dl>
  );
}

export default function Wiki() {
  const [nomes] = useState(() => sortearNomes());
  const capitulos: Capitulo[] = useMemo(
    () => Object.entries(BRUTOS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([caminho, raw]) => parseCapitulo(idDoArquivo(caminho), raw, nomes)),
    [nomes],
  );
  const [atualId, setAtualId] = useState(capitulos[0].id);
  const [indiceAberto, setIndiceAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const alvo = normalizar(busca.trim());
  const filtrados = alvo ? capitulos.filter((c) => normalizar(c.titulo).includes(alvo)) : capitulos;
  const atual = capitulos.find((c) => c.id === atualId) ?? capitulos[0];

  return (
    <div className="tela">
      <h2>Wiki</h2>
      <button className="botao wiki-abrir-indice" aria-label="Índice" onClick={() => setIndiceAberto(true)}>☰ Índice</button>

      <article className="wiki-corpo">
        <h3 className="wiki-titulo">{atual.titulo}</h3>
        {atual.blocos.map((b, i) => <BlocoRender key={i} bloco={b} />)}
      </article>

      {indiceAberto && (
        <>
          <button className="wiki-fundo" aria-label="Fechar índice" onClick={() => setIndiceAberto(false)} />
          <nav className="wiki-gaveta">
            <label className="rotulo" htmlFor="wiki-busca">Buscar na wiki</label>
            <input
              id="wiki-busca" className="campo-busca" type="search" value={busca}
              onChange={(e) => setBusca(e.target.value)} aria-label="Buscar na wiki"
            />
            {filtrados.map((c) => (
              <button
                key={c.id} className={`wiki-item${c.id === atual.id ? ' ativo' : ''}`}
                onClick={() => { setAtualId(c.id); setIndiceAberto(false); }}
              >
                {c.titulo}
              </button>
            ))}
            {filtrados.length === 0 && <p className="sub">Nada encontrado.</p>}
          </nav>
        </>
      )}
    </div>
  );
}
