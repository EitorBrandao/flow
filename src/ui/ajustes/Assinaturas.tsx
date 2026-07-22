import { useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarBRL } from '../../domain/money';
import { useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';
import SeletorPills from '../SeletorPills';

export default function Assinaturas() {
  const { dados, hoje, recarregar } = useApp();
  const [cartaoId, setCartaoId] = useState(dados?.cartoes.find((c) => c.ativo)?.id ?? '');
  const [valor, setValor] = useState<number>(0);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [diaDoMes, setDiaDoMes] = useState('1');
  const [parcelas, setParcelas] = useState('');
  const [descricao, setDescricao] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const uid = useId();
  if (!dados) return null;
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Assinaturas</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const horizonte = dados.config.horizonteProjecao;
  const assinsDoCartao = dados.recorrenciasCartao.filter((a) => a.cartaoId === cartaoId);

  function limparForm() {
    setValor(0); setDataInicio(hoje); setDiaDoMes('1');
    setParcelas(''); setDescricao(''); setEditandoId(null);
  }

  function trocarCartao(novoCartaoId: string) {
    setCartaoId(novoCartaoId);
    limparForm();
  }

  function editar(id: string) {
    const a = dados!.recorrenciasCartao.find((x) => x.id === id)!;
    setEditandoId(id);
    setCartaoId(a.cartaoId);
    setValor(a.valor);
    setDataInicio(a.dataInicio);
    setDiaDoMes(String(a.diaDoMes));
    setParcelas(a.parcelas != null ? String(a.parcelas) : '');
    setDescricao(a.descricao ?? '');
  }

  async function salvar() {
    if (valor <= 0 || !cartaoId) return;
    const categoriaCartaoId = await repo.categoriaAssinaturasDe(cartaoId);
    const campos = {
      cartaoId, categoriaCartaoId, valor, dataInicio,
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
      <h2>Assinaturas</h2>

      <h2>{editandoId ? 'Editar assinatura' : 'Nova assinatura'}</h2>
      <div className="campo">
        <label>Cartão</label>
        <SeletorPills
          opcoes={dados.cartoes.filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }))}
          selecionadaId={cartaoId}
          onSelecionar={trocarCartao}
        />
      </div>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor}
            onChange={setValor} style={{ width: 100 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Início</label>
          <CampoData id={`${uid}-inicio`} value={dataInicio} onChange={setDataInicio} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-dia`}>Dia do mês</label>
          <input id={`${uid}-dia`} type="number" min={1} max={31} value={diaDoMes}
            onChange={(e) => setDiaDoMes(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} placeholder="∞" value={parcelas}
            onChange={(e) => setParcelas(e.target.value)} style={{ width: 64 }} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-desc`}>Descrição (opcional)</label>
        <input id={`${uid}-desc`} placeholder="ex.: Netflix" value={descricao}
          onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <p className="sub">Categoria Assinaturas — automática, não precisa escolher.</p>
      <button className="botao botao-primario" onClick={salvar}>{editandoId ? 'Salvar' : 'Criar'}</button>
      {editandoId && <button className="botao" onClick={limparForm}>Cancelar</button>}

      <p className="rotulo-grupo">Assinaturas deste cartão</p>
      <div className="lista">
        {assinsDoCartao.map((a) => (
          <div className="item item-coluna" key={a.id} style={{ opacity: a.ativa ? 1 : 0.5 }}>
            <div className="linha-topo linha-topo-2-1">
              <div className="cresce">
                <div>{a.descricao ?? 'Assinatura'}</div>
                <div className="sub">desde {a.dataInicio}</div>
                <div className="sub">todo dia {a.diaDoMes}, {a.parcelas == null ? 'sem fim' : `${a.parcelas}x`}</div>
              </div>
              <span className="valor-gasto">{formatarBRL(a.valor)}</span>
            </div>
            <div className="acoes">
              <button className="botao" onClick={() => editar(a.id)}>Editar</button>
              <button className="botao" onClick={() => alternarAtiva(a.id)}>{a.ativa ? 'Pausar' : 'Ativar'}</button>
              <button className="botao botao-perigo" onClick={() => excluir(a.id)}>Excluir</button>
            </div>
          </div>
        ))}
        {assinsDoCartao.length === 0 && <p className="sub">Nenhuma assinatura neste cartão.</p>}
      </div>
    </div>
  );
}
