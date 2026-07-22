import { useId, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Pencil } from 'lucide-react';
import * as repo from '../../db/repo';
import { diffOrdem, proximaOrdem } from '../../domain/categorias';
import type { CategoriaCartao } from '../../domain/types';
import { useApp } from '../../state/store';
import SeletorPills from '../SeletorPills';

interface ItemProps {
  cat: CategoriaCartao;
  editando: boolean;
  nomeEdit: string;
  uidEditar: string;
  onEditarNome: (v: string) => void;
  onIniciarEdicao: () => void;
  onCancelarEdicao: () => void;
  onSalvarEdicao: () => void;
  onAlternarArquivada: () => void;
}

function ItemCategoriaCartao({
  cat, editando, nomeEdit, uidEditar,
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
          <span className="cresce">{cat.nome}</span>
          <button className="botao" aria-label="Editar" onClick={onIniciarEdicao}><Pencil size={16} /></button>
          <button className="botao" onClick={onAlternarArquivada}>
            {cat.arquivada ? 'Restaurar' : 'Arquivar'}
          </button>
        </>
      )}
    </Reorder.Item>
  );
}

export default function CategoriasCartao() {
  const { dados, recarregar } = useApp();
  const [cartaoId, setCartaoId] = useState(dados?.cartoes[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  const uid = useId();
  if (!dados) return null;
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Categorias do cartão</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const cats = dados.categoriasCartao.filter((c) => c.cartaoId === cartaoId);
  const ativas = cats.filter((c) => !c.arquivada);
  const arquivadas = cats.filter((c) => c.arquivada);

  async function criar() {
    if (!nome.trim() || !cartaoId) return;
    await repo.salvarCategoriaCartao({ cartaoId, nome: nome.trim(), ordem: proximaOrdem(ativas) });
    await recarregar();
    setNome('');
  }

  async function reordenar(novaOrdem: CategoriaCartao[]) {
    await Promise.all(diffOrdem(novaOrdem).map((a) => repo.atualizarCategoriaCartao(a.id, { ordem: a.ordem })));
    await recarregar();
  }

  async function alternarArquivada(cat: CategoriaCartao) {
    const destino = cat.arquivada ? ativas : arquivadas;
    await repo.atualizarCategoriaCartao(cat.id, { arquivada: !cat.arquivada, ordem: proximaOrdem(destino) });
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
    await repo.atualizarCategoriaCartao(editandoId, { nome: nomeEdit.trim() });
    setEditandoId(null);
    setNomeEdit('');
    await recarregar();
  }

  function props(c: CategoriaCartao): ItemProps {
    return {
      cat: c,
      editando: editandoId === c.id,
      nomeEdit,
      uidEditar: `${uid}-editar`,
      onEditarNome: setNomeEdit,
      onIniciarEdicao: () => iniciarEdicao(c.id, c.nome),
      onCancelarEdicao: cancelarEdicao,
      onSalvarEdicao: salvarEdicao,
      onAlternarArquivada: () => alternarArquivada(c),
    };
  }

  return (
    <div className="tela">
      <h2>Categorias do cartão</h2>
      <div className="campo">
        <label>Cartão</label>
        <SeletorPills
          opcoes={dados.cartoes.map((c) => ({ id: c.id, nome: c.nome }))}
          selecionadaId={cartaoId}
          onSelecionar={setCartaoId}
        />
      </div>

      <div className="linha">
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor={`${uid}-nova`}>Nova categoria do cartão</label>
          <input id={`${uid}-nova`} placeholder="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={criar}>Criar</button>
      </div>

      <Reorder.Group as="div" className="lista" axis="y" values={ativas} onReorder={reordenar}>
        {ativas.map((c) => <ItemCategoriaCartao key={c.id} {...props(c)} />)}
      </Reorder.Group>

      {arquivadas.length > 0 && (
        <>
          <p className="rotulo-grupo">Arquivados</p>
          <Reorder.Group as="div" className="lista" axis="y" values={arquivadas} onReorder={reordenar}>
            {arquivadas.map((c) => <ItemCategoriaCartao key={c.id} {...props(c)} />)}
          </Reorder.Group>
        </>
      )}
    </div>
  );
}
