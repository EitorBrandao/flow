import { useId, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Pencil } from 'lucide-react';
import * as repo from '../../db/repo';
import { diffOrdem, proximaOrdem } from '../../domain/categorias';
import { categoriasFaturaIds } from '../../domain/fatura';
import type { Categoria, TipoCategoria } from '../../domain/types';
import { useApp } from '../../state/store';

interface ItemProps {
  cat: Categoria;
  editando: boolean;
  nomeEdit: string;
  uidEditar: string;
  mostrarBadgeTipo: boolean;
  onEditarNome: (v: string) => void;
  onIniciarEdicao: () => void;
  onCancelarEdicao: () => void;
  onSalvarEdicao: () => void;
  onAlternarArquivada: () => void;
}

function ItemCategoria({
  cat, editando, nomeEdit, uidEditar, mostrarBadgeTipo,
  onEditarNome, onIniciarEdicao, onCancelarEdicao, onSalvarEdicao, onAlternarArquivada,
}: ItemProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={cat} as="div" className="item" style={{ opacity: cat.arquivada ? 0.5 : 1 }}
      dragListener={false} dragControls={controls}
    >
      {editando ? (
        <>
          <div className="campo cresce">
            <label htmlFor={uidEditar}>Editar nome</label>
            <input id={uidEditar} value={nomeEdit} onChange={(e) => onEditarNome(e.target.value)} />
          </div>
          <button className="botao botao-primario" onClick={onSalvarEdicao}>Salvar</button>
          <button className="botao" onClick={onCancelarEdicao}>Cancelar</button>
        </>
      ) : (
        <>
          <button className="botao" aria-label="Arrastar para reordenar" onPointerDown={(e) => controls.start(e)}>
            <GripVertical size={16} />
          </button>
          <span className="cresce">
            {cat.nome} {mostrarBadgeTipo && <span className="badge">{cat.tipo}</span>}
          </span>
          <button className="botao" aria-label="Editar" onClick={onIniciarEdicao}><Pencil size={16} /></button>
          <button className="botao" onClick={onAlternarArquivada}>
            {cat.arquivada ? 'Restaurar' : 'Arquivar'}
          </button>
        </>
      )}
    </Reorder.Item>
  );
}

export default function Categorias() {
  const { dados, recarregar } = useApp();
  const [boxId, setBoxId] = useState<string>(dados?.boxes[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const uid = useId();
  if (!dados) return null;
  const ocultas = categoriasFaturaIds(dados.cartoes);
  const cats = dados.categorias.filter((c) => c.boxId === boxId && !ocultas.has(c.id));
  const ganhos = cats.filter((c) => c.tipo === 'ganho' && !c.arquivada);
  const gastos = cats.filter((c) => c.tipo === 'gasto' && !c.arquivada);
  const arquivadas = cats.filter((c) => c.arquivada);

  async function criar() {
    if (!nome.trim() || !boxId) return;
    const irmas = cats.filter((c) => c.tipo === tipo && !c.arquivada);
    await repo.salvarCategoria({ boxId, nome: nome.trim(), tipo, ordem: proximaOrdem(irmas) });
    await recarregar();
    setNome('');
  }

  async function reordenar(novaOrdem: Categoria[]) {
    await Promise.all(diffOrdem(novaOrdem).map((a) => repo.atualizarCategoria(a.id, { ordem: a.ordem })));
    await recarregar();
  }

  async function alternarArquivada(cat: Categoria) {
    const destino = cat.arquivada ? cats.filter((c) => c.tipo === cat.tipo && !c.arquivada) : arquivadas;
    await repo.atualizarCategoria(cat.id, { arquivada: !cat.arquivada, ordem: proximaOrdem(destino) });
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

  function props(c: Categoria, mostrarBadgeTipo: boolean): ItemProps {
    return {
      cat: c,
      editando: editandoId === c.id,
      nomeEdit,
      uidEditar: `${uid}-editar`,
      mostrarBadgeTipo,
      onEditarNome: setNomeEdit,
      onIniciarEdicao: () => iniciarEdicao(c.id, c.nome),
      onCancelarEdicao: cancelarEdicao,
      onSalvarEdicao: salvarEdicao,
      onAlternarArquivada: () => alternarArquivada(c),
    };
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

      <p className="rotulo-grupo">Ganho</p>
      <Reorder.Group as="div" className="lista" axis="y" values={ganhos} onReorder={reordenar}>
        {ganhos.map((c) => <ItemCategoria key={c.id} {...props(c, false)} />)}
      </Reorder.Group>

      <p className="rotulo-grupo">Gasto</p>
      <Reorder.Group as="div" className="lista" axis="y" values={gastos} onReorder={reordenar}>
        {gastos.map((c) => <ItemCategoria key={c.id} {...props(c, false)} />)}
      </Reorder.Group>

      {arquivadas.length > 0 && (
        <>
          <p className="rotulo-grupo">Arquivados</p>
          <Reorder.Group as="div" className="lista" axis="y" values={arquivadas} onReorder={reordenar}>
            {arquivadas.map((c) => <ItemCategoria key={c.id} {...props(c, true)} />)}
          </Reorder.Group>
        </>
      )}
    </div>
  );
}
