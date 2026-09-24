import { Pencil } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import * as repo from '../../db/repo';
import { categoriasFaturaIds } from '../../domain/fatura';
import { categoriasTransferenciaIds } from '../../domain/transferencia';
import { formatarDataBR } from '../../domain/dates';
import { formatarBRL } from '../../domain/money';
import type { TipoCategoria } from '../../domain/types';
import { boxIdEfetivo, useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';
import SeletorCategoria from '../SeletorCategoria';
import SeletorPills, { OPCOES_TIPO } from '../SeletorPills';

interface CamposRecorrenciaInicial {
  tipo: TipoCategoria;
  valor: number;
  categoriaId: string | null;
  dataInicio: string;
  diaDoMes: string;
  parcelas: string;
}
interface CamposRecorrenciaSalvos {
  categoriaId: string;
  valor: number;
  dataInicio: string;
  diaDoMes: number;
  parcelas: number | null;
}

/** Campos de uma recorrência, usados para criar (no topo) e para editar (dentro do item). */
function FormRecorrencia({ inicial, rotuloSalvar, onSalvo, onCancelar }: {
  inicial: CamposRecorrenciaInicial;
  rotuloSalvar: 'Criar' | 'Salvar';
  onSalvo: (campos: CamposRecorrenciaSalvos) => Promise<void>;
  onCancelar?: () => void;
}) {
  const { dados, boxSel } = useApp();
  const [tipo, setTipo] = useState<TipoCategoria>(inicial.tipo);
  const [valor, setValor] = useState(inicial.valor);
  const [categoriaId, setCategoriaId] = useState<string | null>(inicial.categoriaId);
  const [dataInicio, setDataInicio] = useState(inicial.dataInicio);
  const [diaDoMes, setDiaDoMes] = useState(inicial.diaDoMes);
  const [parcelas, setParcelas] = useState(inicial.parcelas);
  const [aviso, setAviso] = useState('');
  const uid = useId();

  const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;
  const ocultas = dados
    ? new Set([...categoriasFaturaIds(dados.cartoes), ...categoriasTransferenciaIds(dados.boxes)])
    : new Set<string>();
  const categoriasDaBox = dados
    ? dados.categorias.filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id))
    : [];

  function trocarTipo(novoTipo: TipoCategoria) {
    setTipo(novoTipo);
    setCategoriaId(null);
  }

  async function salvar() {
    const acao = rotuloSalvar === 'Criar' ? 'criar' : 'salvar';
    // Uma frase por vez, na ordem dos campos — mesmo critério da tela Lançar.
    if (valor <= 0) {
      setAviso(`Digite um valor para ${acao}.`);
      return;
    }
    if (categoriaId == null) {
      setAviso(`Escolha uma categoria para ${acao}.`);
      return;
    }
    setAviso('');
    const diaDoMesNum = Math.min(31, Math.max(1, Number(diaDoMes) || 1));
    const parcelasNum = parcelas ? Number(parcelas) : null;
    await onSalvo({ categoriaId, valor, dataInicio, diaDoMes: diaDoMesNum, parcelas: parcelasNum });
  }

  return (
    <>
      <div className="form-linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} autoFocus={onCancelar != null} valorCentavos={valor} onChange={setValor} />
        </div>
      </div>
      <SeletorPills
        rotulo="Tipo" opcoes={OPCOES_TIPO} selecionadaId={tipo}
        onSelecionar={(id) => trocarTipo(id as TipoCategoria)}
      />
      <div className="campo">
        <label>Categoria</label>
        <SeletorCategoria categorias={categoriasDaBox} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
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
      <div className="form-botoes">
        {onCancelar && <button className="botao" onClick={onCancelar}>Cancelar</button>}
        <button className="botao botao-primario" onClick={salvar}>{rotuloSalvar}</button>
      </div>
      {aviso && <p className="aviso">{aviso}</p>}
    </>
  );
}

export default function Recorrencias() {
  const { dados, boxSel, hoje, recarregar } = useApp();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  // Muda a cada criação para o formulário do topo voltar vazio (remonta com `key`).
  const [versaoNova, setVersaoNova] = useState(0);
  // O formulário antigo não zerava tipo, categoria, início e dia depois de criar — só valor
  // e parcelas. Guardado à parte porque o remount por `versaoNova` reinicia TODO o estado
  // local do FormRecorrencia.
  const [ultimosCampos, setUltimosCampos] = useState<{
    tipo: TipoCategoria; categoriaId: string | null; dataInicio: string; diaDoMes: string;
  }>({ tipo: 'gasto', categoriaId: null, dataInicio: hoje, diaDoMes: '1' });
  const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;

  useEffect(() => {
    setEditandoId(null);
    setUltimosCampos({ tipo: 'gasto', categoriaId: null, dataInicio: hoje, diaDoMes: '1' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);

  if (!dados) return null;
  if (boxId == null) {
    return (
      <div className="tela">
        <h2>Recorrências</h2>
        <p className="sub">A box "casa" não foi encontrada — crie uma em Ajustes → Boxes.</p>
      </div>
    );
  }
  const recs = dados.recorrencias.filter((r) => !r.cenarioId && r.boxId === boxId);
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const tipoCat = (id: string) => dados.categorias.find((c) => c.id === id)?.tipo;

  async function criar(campos: CamposRecorrenciaSalvos) {
    await repo.salvarRecorrencia({ boxId: boxId!, ...campos }, dados!.config.horizonteProjecao);
    setUltimosCampos({
      tipo: tipoCat(campos.categoriaId) ?? 'gasto',
      categoriaId: campos.categoriaId,
      dataInicio: campos.dataInicio,
      diaDoMes: String(campos.diaDoMes),
    });
    setVersaoNova((v) => v + 1);
    await recarregar();
  }

  async function atualizar(id: string, campos: CamposRecorrenciaSalvos) {
    const original = recs.find((r) => r.id === id)!;
    await repo.salvarRecorrencia({ ...original, ...campos }, dados!.config.horizonteProjecao);
    setEditandoId(null);
    await recarregar();
  }

  async function alternarAtiva(id: string) {
    const rec = recs.find((r) => r.id === id)!;
    await repo.salvarRecorrencia({ ...rec, ativa: !rec.ativa }, dados!.config.horizonteProjecao);
    await recarregar();
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir a recorrência e seus previstos? (confirmados são mantidos)')) return;
    await repo.excluirRecorrencia(id);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Recorrências</h2>

      {recs.length === 0 && (
        <div className="card">
          <p className="rotulo">Recorrências geram previstos</p>
          <p>Cada recorrência cria lançamentos automaticamente para os próximos meses — é o que enche a projeção do Fluxo. Sem elas, o gráfico fica uma linha reta.</p>
          <p>Comece pelas que mais pesam: salário, aluguel e as contas fixas grandes.</p>
        </div>
      )}

      {!editandoId && (
        <>
          <h2>Nova recorrência</h2>
          <FormRecorrencia
            key={`${boxId}-${versaoNova}`}
            inicial={{ ...ultimosCampos, valor: 0, parcelas: '' }}
            rotuloSalvar="Criar" onSalvo={criar}
          />
        </>
      )}

      <p className="rotulo-grupo">Nesta box</p>
      <div className="lista">
        {recs.map((r) => (
          editandoId === r.id ? (
            <div className="item item-coluna" key={r.id}>
              <FormRecorrencia
                inicial={{
                  tipo: tipoCat(r.categoriaId) ?? 'gasto', valor: r.valor, categoriaId: r.categoriaId,
                  dataInicio: r.dataInicio, diaDoMes: String(r.diaDoMes), parcelas: r.parcelas != null ? String(r.parcelas) : '',
                }}
                rotuloSalvar="Salvar"
                onSalvo={(campos) => atualizar(r.id, campos)} onCancelar={() => setEditandoId(null)}
              />
            </div>
          ) : (
            <div className="item item-coluna" key={r.id} style={{ opacity: r.ativa ? 1 : 0.5 }}>
              <div className="linha-topo linha-topo-2-1">
                <div className="cresce">
                  <div>{nomeCat(r.categoriaId)}{r.nota ? ` · ${r.nota}` : ''}</div>
                  <div className="sub">desde {formatarDataBR(r.dataInicio)}</div>
                  <div className="sub">todo dia {r.diaDoMes}, {r.parcelas == null ? 'sem fim' : `${r.parcelas}x`}</div>
                </div>
                <span className={tipoCat(r.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                  {formatarBRL(r.valor)}
                </span>
              </div>
              <div className="acoes">
                <button className="botao" aria-label="Editar" onClick={() => setEditandoId(r.id)}><Pencil size={16} /></button>
                <button className="botao" onClick={() => alternarAtiva(r.id)}>{r.ativa ? 'Desativar' : 'Ativar'}</button>
                <button className="botao botao-perigo" onClick={() => excluir(r.id)}>Excluir</button>
              </div>
            </div>
          )
        ))}
        {recs.length === 0 && <p className="sub">Nenhuma recorrência nesta box.</p>}
      </div>
    </div>
  );
}
