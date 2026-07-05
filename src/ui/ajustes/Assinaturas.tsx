import { useState } from 'react';
import * as repo from '../../db/repo';
import { formatarBRL, parseValorDigitado } from '../../domain/money';
import { useApp } from '../../state/store';

export default function Assinaturas() {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [dataInicio, setDataInicio] = useState(hoje);
  const [diaDoMes, setDiaDoMes] = useState('1');
  const [parcelas, setParcelas] = useState('');
  const [descricao, setDescricao] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  if (!dados) return null;
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Assinaturas</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const horizonte = dados.config.horizonteProjecao;
  const nomeCat = (id: string) => dados.categoriasCartao.find((c) => c.id === id)?.nome ?? '?';
  const cartaoDe = (catId: string) => dados.categoriasCartao.find((c) => c.id === catId)?.cartaoId;

  function limparForm() {
    setValor(''); setCategoriaId(''); setDataInicio(hoje); setDiaDoMes('1');
    setParcelas(''); setDescricao(''); setEditandoId(null);
  }

  function editar(id: string) {
    const a = dados!.recorrenciasCartao.find((x) => x.id === id)!;
    setEditandoId(id);
    setValor((a.valor / 100).toFixed(2).replace('.', ','));
    setCategoriaId(a.categoriaCartaoId);
    setDataInicio(a.dataInicio);
    setDiaDoMes(String(a.diaDoMes));
    setParcelas(a.parcelas != null ? String(a.parcelas) : '');
    setDescricao(a.descricao ?? '');
  }

  async function salvar() {
    const cents = parseValorDigitado(valor);
    const cartaoId = cartaoDe(categoriaId);
    if (cents == null || !cartaoId) return;
    const campos = {
      cartaoId, categoriaCartaoId: categoriaId, valor: cents, dataInicio,
      diaDoMes: Math.min(31, Math.max(1, Number(diaDoMes) || 1)),
      parcelas: parcelas ? Number(parcelas) : null,
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
    };
    if (editandoId) {
      const original = dados!.recorrenciasCartao.find((x) => x.id === editandoId)!;
      await repo.salvarAssinatura({ ...original, ...campos }, horizonte);
    } else {
      await repo.salvarAssinatura(campos, horizonte);
    }
    limparForm();
    await recarregar();
  }

  async function alternarAtiva(id: string) {
    const a = dados!.recorrenciasCartao.find((x) => x.id === id)!;
    await repo.salvarAssinatura({ ...a, ativa: !a.ativa }, horizonte);
    await recarregar();
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir a assinatura e suas compras futuras? (passadas são mantidas)')) return;
    await repo.excluirAssinatura(id, horizonte);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Assinaturas do cartão</h2>
      <div className="lista">
        {dados.recorrenciasCartao.map((a) => (
          <div className="item" key={a.id} style={{ opacity: a.ativa ? 1 : 0.5 }}>
            <div className="cresce">
              {a.descricao ?? nomeCat(a.categoriaCartaoId)}
              <div className="sub">
                dia {a.diaDoMes} · {a.parcelas == null ? 'sem fim' : `${a.parcelas}x`} · desde {a.dataInicio}
              </div>
            </div>
            <span>{formatarBRL(a.valor)}</span>
            <button className="botao" onClick={() => editar(a.id)}>Editar</button>
            <button className="botao" onClick={() => alternarAtiva(a.id)}>{a.ativa ? 'Pausar' : 'Ativar'}</button>
            <button className="botao botao-perigo" onClick={() => excluir(a.id)}>Excluir</button>
          </div>
        ))}
        {dados.recorrenciasCartao.length === 0 && <p className="sub">Nenhuma assinatura.</p>}
      </div>
      <h2>{editandoId ? 'Editar assinatura' : 'Nova assinatura'}</h2>
      <div className="linha">
        <input aria-label="Valor" placeholder="valor" inputMode="decimal" value={valor}
          onChange={(e) => setValor(e.target.value)} style={{ width: 100 }} />
        <select aria-label="Categoria do cartão" value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">categoria…</option>
          {dados.categoriasCartao.filter((c) => !c.arquivada).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({dados.cartoes.find((k) => k.id === c.cartaoId)?.nome ?? '?'})
            </option>
          ))}
        </select>
        <input aria-label="Início" type="date" value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)} />
        <input aria-label="Dia do mês" type="number" min={1} max={31} value={diaDoMes}
          onChange={(e) => setDiaDoMes(e.target.value)} style={{ width: 64 }} />
        <input aria-label="Parcelas" type="number" min={1} placeholder="∞" value={parcelas}
          onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
      </div>
      <div className="linha">
        <input aria-label="Descrição" placeholder="descrição (ex.: Netflix)" value={descricao}
          onChange={(e) => setDescricao(e.target.value)} className="cresce" />
        <button className="botao botao-primario" onClick={salvar}>{editandoId ? 'Salvar' : 'Criar'}</button>
        {editandoId && <button className="botao" onClick={limparForm}>Cancelar</button>}
      </div>
    </div>
  );
}
