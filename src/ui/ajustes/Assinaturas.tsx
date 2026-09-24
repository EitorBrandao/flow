import { Pencil } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import * as repo from '../../db/repo';
import { formatarDataBR } from '../../domain/dates';
import { formatarBRL } from '../../domain/money';
import { boxIdEfetivo, useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';
import SeletorPills from '../SeletorPills';

interface CamposAssinaturaInicial {
  valor: number;
  dataInicio: string;
  diaDoMes: string;
  parcelas: string;
  descricao: string;
}
interface CamposAssinaturaSalvos {
  valor: number;
  dataInicio: string;
  diaDoMes: number;
  parcelas: number | null;
  descricao?: string;
}

/** Campos de uma assinatura, usados para criar (no topo) e para editar (dentro do item). */
function FormAssinatura({ inicial, rotuloSalvar, onSalvo, onCancelar }: {
  inicial: CamposAssinaturaInicial;
  rotuloSalvar: 'Criar' | 'Salvar';
  onSalvo: (campos: CamposAssinaturaSalvos) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [valor, setValor] = useState(inicial.valor);
  const [dataInicio, setDataInicio] = useState(inicial.dataInicio);
  const [diaDoMes, setDiaDoMes] = useState(inicial.diaDoMes);
  const [parcelas, setParcelas] = useState(inicial.parcelas);
  const [descricao, setDescricao] = useState(inicial.descricao);
  const uid = useId();

  async function salvar() {
    if (valor <= 0) return;
    const diaDoMesNum = Math.min(31, Math.max(1, Number(diaDoMes) || 1));
    const parcelasNum = parcelas ? Number(parcelas) : null;
    await onSalvo({
      valor, dataInicio, diaDoMes: diaDoMesNum, parcelas: parcelasNum,
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
    });
  }

  return (
    <>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} />
        </div>
      </div>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-inicio`}>Início</label>
          <CampoData id={`${uid}-inicio`} value={dataInicio} onChange={setDataInicio} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-dia`}>Dia do mês</label>
          <input id={`${uid}-dia`} type="number" min={1} max={31} value={diaDoMes}
            onChange={(e) => setDiaDoMes(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} placeholder="∞" value={parcelas}
            onChange={(e) => setParcelas(e.target.value)} />
        </div>
      </div>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-desc`}>Descrição (opcional)</label>
          <input id={`${uid}-desc`} placeholder="ex.: Netflix" value={descricao}
            onChange={(e) => setDescricao(e.target.value)} />
        </div>
      </div>
      <p className="sub">Categoria Assinaturas — automática, não precisa escolher.</p>
      <div className="form-botoes">
        {onCancelar && <button className="botao" onClick={onCancelar}>Cancelar</button>}
        <button className="botao botao-primario" onClick={salvar}>{rotuloSalvar}</button>
      </div>
    </>
  );
}

export default function Assinaturas() {
  const { dados, boxSel, hoje, recarregar } = useApp();
  const [cartaoId, setCartaoId] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Muda a cada criação para o formulário do topo voltar vazio (remonta com `key`).
  const [versaoNova, setVersaoNova] = useState(0);
  const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;

  useEffect(() => {
    const primeiroCartao = dados?.cartoes.find((c) => c.boxId === boxId && c.ativo);
    setCartaoId(primeiroCartao?.id ?? '');
    setEditandoId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  if (!dados) return null;
  if (boxId == null) {
    return (
      <div className="tela">
        <h2>Assinaturas</h2>
        <p className="sub">A box "casa" não foi encontrada — crie uma em Ajustes → Boxes.</p>
      </div>
    );
  }
  if (dados.cartoes.length === 0) {
    return <div className="tela"><h2>Assinaturas</h2><p className="sub">Cadastre um cartão primeiro.</p></div>;
  }
  const horizonte = dados.config.horizonteProjecao;
  const cartoesDaBox = dados.cartoes.filter((c) => c.boxId === boxId && c.ativo);
  const assinsDoCartao = dados.recorrenciasCartao.filter((a) => a.cartaoId === cartaoId);

  function trocarCartao(novoCartaoId: string) {
    setCartaoId(novoCartaoId);
    setEditandoId(null);
  }

  async function criar(campos: CamposAssinaturaSalvos) {
    const categoriaCartaoId = await repo.categoriaAssinaturasDe(cartaoId);
    await repo.salvarAssinatura({ cartaoId, categoriaCartaoId, ...campos }, horizonte);
    setVersaoNova((v) => v + 1);
    await recarregar();
  }

  async function atualizar(id: string, campos: CamposAssinaturaSalvos) {
    const original = assinsDoCartao.find((a) => a.id === id)!;
    const categoriaCartaoId = await repo.categoriaAssinaturasDe(cartaoId);
    await repo.salvarAssinatura({ ...original, ...campos, cartaoId, categoriaCartaoId }, horizonte);
    setEditandoId(null);
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

      {cartoesDaBox.length === 0 ? (
        <p className="sub">Nenhum cartão ativo nesta box.</p>
      ) : (
        <>
          <div className="campo">
            <label>Cartão</label>
            <SeletorPills
              opcoes={cartoesDaBox.map((c) => ({ id: c.id, nome: c.nome }))}
              selecionadaId={cartaoId}
              onSelecionar={trocarCartao}
            />
          </div>

          {!editandoId && (
            <>
              <h2>Nova assinatura</h2>
              <FormAssinatura
                key={`${cartaoId}-${versaoNova}`}
                inicial={{ valor: 0, dataInicio: hoje, diaDoMes: '1', parcelas: '', descricao: '' }}
                rotuloSalvar="Criar" onSalvo={criar}
              />
            </>
          )}

          <p className="rotulo-grupo">Assinaturas deste cartão</p>
          <div className="lista">
            {assinsDoCartao.map((a) => (
              editandoId === a.id ? (
                <div className="item item-coluna" key={a.id}>
                  <FormAssinatura
                    inicial={{
                      valor: a.valor, dataInicio: a.dataInicio, diaDoMes: String(a.diaDoMes),
                      parcelas: a.parcelas != null ? String(a.parcelas) : '', descricao: a.descricao ?? '',
                    }}
                    rotuloSalvar="Salvar"
                    onSalvo={(campos) => atualizar(a.id, campos)} onCancelar={() => setEditandoId(null)}
                  />
                </div>
              ) : (
                <div className="item item-coluna" key={a.id} style={{ opacity: a.ativa ? 1 : 0.5 }}>
                  <div className="linha-topo linha-topo-2-1">
                    <div className="cresce">
                      <div>{a.descricao ?? 'Assinatura'}</div>
                      <div className="sub">desde {formatarDataBR(a.dataInicio)}</div>
                      <div className="sub">todo dia {a.diaDoMes}, {a.parcelas == null ? 'sem fim' : `${a.parcelas}x`}</div>
                    </div>
                    <span className="valor-gasto">{formatarBRL(a.valor)}</span>
                  </div>
                  <div className="acoes">
                    <button className="botao" aria-label="Editar" onClick={() => setEditandoId(a.id)}><Pencil size={16} /></button>
                    <button className="botao" onClick={() => alternarAtiva(a.id)}>{a.ativa ? 'Pausar' : 'Ativar'}</button>
                    <button className="botao botao-perigo" onClick={() => excluir(a.id)}>Excluir</button>
                  </div>
                </div>
              )
            ))}
            {assinsDoCartao.length === 0 && <p className="sub">Nenhuma assinatura neste cartão.</p>}
          </div>
        </>
      )}
    </div>
  );
}
