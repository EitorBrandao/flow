import { useState } from 'react';
import * as repo from '../../db/repo';
import { useApp } from '../../state/store';

export default function CategoriasCartao() {
  const { dados, recarregar } = useApp();
  const [cartaoId, setCartaoId] = useState(dados?.cartoes[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState('');
  if (!dados) return null;
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Categorias do cartão</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const cats = dados.categoriasCartao
    .filter((c) => c.cartaoId === cartaoId)
    .sort((a, b) => a.ordem - b.ordem);

  async function criar() {
    if (!nome.trim() || !cartaoId) return;
    const ordem = Math.max(-1, ...cats.map((c) => c.ordem)) + 1;
    await repo.salvarCategoriaCartao({ cartaoId, nome: nome.trim(), ordem });
    await recarregar();
    setNome('');
  }

  async function mover(id: string, direcao: -1 | 1) {
    const cat = cats.find((c) => c.id === id)!;
    const i = cats.findIndex((c) => c.id === id);
    const alvo = cats[i + direcao];
    if (!alvo) return;
    await repo.atualizarCategoriaCartao(cat.id, { ordem: alvo.ordem });
    await repo.atualizarCategoriaCartao(alvo.id, { ordem: cat.ordem });
    await recarregar();
  }

  async function alternarArquivada(id: string, arquivada: boolean) {
    await repo.atualizarCategoriaCartao(id, { arquivada: !arquivada });
    await recarregar();
  }

  async function salvarEdicao() {
    if (!editandoId || !nomeEdit.trim()) return;
    await repo.atualizarCategoriaCartao(editandoId, { nome: nomeEdit.trim() });
    setEditandoId(null);
    setNomeEdit('');
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Categorias do cartão</h2>
      <select aria-label="Cartão" value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
        {dados.cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <div className="lista">
        {cats.map((c) => (
          <div className="item" key={c.id} style={{ opacity: c.arquivada ? 0.5 : 1 }}>
            {editandoId === c.id ? (
              <>
                <input aria-label="Editar nome" className="cresce" value={nomeEdit}
                  onChange={(e) => setNomeEdit(e.target.value)} />
                <button className="botao botao-primario" onClick={salvarEdicao}>Salvar</button>
                <button className="botao" onClick={() => { setEditandoId(null); setNomeEdit(''); }}>Cancelar</button>
              </>
            ) : (
              <>
                <span className="cresce">
                  {c.nome}{c.arquivada && <span className="badge"> arquivada</span>}
                </span>
                <button className="botao" aria-label="Subir" onClick={() => mover(c.id, -1)}>↑</button>
                <button className="botao" aria-label="Descer" onClick={() => mover(c.id, 1)}>↓</button>
                <button className="botao" aria-label="Editar"
                  onClick={() => { setEditandoId(c.id); setNomeEdit(c.nome); }}>✏️</button>
                <button className="botao" onClick={() => alternarArquivada(c.id, c.arquivada)}>
                  {c.arquivada ? 'Restaurar' : 'Arquivar'}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="linha">
        <input aria-label="Nova categoria do cartão" placeholder="nova categoria" value={nome}
          onChange={(e) => setNome(e.target.value)} style={{ flex: 1 }} />
        <button className="botao botao-primario" onClick={criar}>Criar</button>
      </div>
    </div>
  );
}
