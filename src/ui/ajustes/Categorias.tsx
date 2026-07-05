import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil } from 'lucide-react';
import * as repo from '../../db/repo';
import type { TipoCategoria } from '../../domain/types';
import { useApp } from '../../state/store';

export default function Categorias() {
  const { dados, recarregar } = useApp();
  const [boxId, setBoxId] = useState<string>(dados?.boxes[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const uid = useId();
  if (!dados) return null;
  const cats = dados.categorias
    .filter((c) => c.boxId === boxId)
    .sort((a, b) => (a.tipo === b.tipo ? a.ordem - b.ordem : a.tipo === 'ganho' ? -1 : 1));

  async function criar() {
    if (!nome.trim() || !boxId) return;
    const ordem = Math.max(-1, ...cats.filter((c) => c.tipo === tipo).map((c) => c.ordem)) + 1;
    await repo.salvarCategoria({ boxId, nome: nome.trim(), tipo, ordem });
    await recarregar();
    setNome('');
  }

  async function mover(id: string, direcao: -1 | 1) {
    const cat = cats.find((c) => c.id === id)!;
    const irmas = cats.filter((c) => c.tipo === cat.tipo);
    const i = irmas.findIndex((c) => c.id === id);
    const alvo = irmas[i + direcao];
    if (!alvo) return;
    await repo.atualizarCategoria(cat.id, { ordem: alvo.ordem });
    await repo.atualizarCategoria(alvo.id, { ordem: cat.ordem });
    await recarregar();
  }

  async function alternarArquivada(id: string, arquivada: boolean) {
    await repo.atualizarCategoria(id, { arquivada: !arquivada });
    await recarregar();
  }

  function iniciarEdicao(id: string, nomeAtual: string) {
    setEditandoId(id);
    setNomeEdit(nomeAtual);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNomeEdit('');
  }

  async function salvarEdicao() {
    if (!editandoId || !nomeEdit.trim()) return;
    await repo.atualizarCategoria(editandoId, { nome: nomeEdit.trim() });
    setEditandoId(null);
    setNomeEdit('');
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Categorias</h2>
      <div className="campo">
        <label htmlFor={`${uid}-box`}>Box</label>
        <select id={`${uid}-box`} value={boxId} onChange={(e) => setBoxId(e.target.value)}>
          {dados.boxes.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </select>
      </div>
      <div className="lista">
        {cats.map((c) => (
          <div className="item" key={c.id} style={{ opacity: c.arquivada ? 0.5 : 1 }}>
            {editandoId === c.id ? (
              <>
                <div className="campo cresce">
                  <label htmlFor={`${uid}-editar`}>Editar nome</label>
                  <input id={`${uid}-editar`} value={nomeEdit} onChange={(e) => setNomeEdit(e.target.value)} />
                </div>
                <button className="botao botao-primario" onClick={salvarEdicao}>Salvar</button>
                <button className="botao" onClick={cancelarEdicao}>Cancelar</button>
              </>
            ) : (
              <>
                <span className="cresce">
                  {c.nome} <span className="badge">{c.tipo}</span>
                  {c.arquivada && <span className="badge">arquivada</span>}
                </span>
                <button className="botao" aria-label="Subir" onClick={() => mover(c.id, -1)}><ArrowUp size={16} /></button>
                <button className="botao" aria-label="Descer" onClick={() => mover(c.id, 1)}><ArrowDown size={16} /></button>
                <button className="botao" aria-label="Editar" onClick={() => iniciarEdicao(c.id, c.nome)}><Pencil size={16} /></button>
                <button className="botao" onClick={() => alternarArquivada(c.id, c.arquivada)}>
                  {c.arquivada ? 'Restaurar' : 'Arquivar'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="linha">
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor={`${uid}-nova`}>Nova categoria</label>
          <input id={`${uid}-nova`} placeholder="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-tipo`}>Tipo</label>
          <select id={`${uid}-tipo`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoCategoria)}>
            <option value="gasto">gasto</option>
            <option value="ganho">ganho</option>
          </select>
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={criar}>Criar</button>
      </div>
    </div>
  );
}
