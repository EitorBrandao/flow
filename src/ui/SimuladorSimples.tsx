import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as repo from '../db/repo';
import { formatarDataBR } from '../domain/dates';
import { classeSaldo, formatarBRL, formatarSaldo } from '../domain/money';
import { projetarBoxes } from '../domain/projection';
import { menorSaldo, primeiroDiaNegativo, type Repeticao } from '../domain/simulacao';
import { agoraISO, novoId, type ID, type ISODate } from '../domain/types';
import { boxIdEfetivo, boxIdsSelecionadas, useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import { gravarItemNovo, OPCOES_REPETICAO } from './FormItemCenario';
import SeletorPills from './SeletorPills';

/** Fluxo › Simular no modo Simples: "E se eu gastar…" com um valor, uma data e a repetição.
 *  Grava um cenário de rascunho (`NOME_SIMULACAO_RAPIDA`) com um item e mostra o menor saldo
 *  da projeção com e sem a compra. Sem "Guardar", o rascunho é apagado ao sair. */
export default function SimuladorSimples() {
  const { dados, boxSel, hoje, recarregar } = useApp();
  const uid = useId();
  const [valor, setValor] = useState(0);
  const [data, setData] = useState<ISODate | ''>('');
  const [repeticao, setRepeticao] = useState<Repeticao>('unica');
  const [parcelasTexto, setParcelasTexto] = useState('2');
  const [ocupado, setOcupado] = useState(false);
  const [cenarioId, setCenarioId] = useState<ID | null>(null);
  const [guardado, setGuardado] = useState(false);
  // O efeito de limpeza roda ao desmontar: lê o que vale naquele momento, não o do render.
  const rascunhoRef = useRef<ID | null>(null);

  useEffect(() => () => {
    const id = rascunhoRef.current;
    if (!id) return;
    rascunhoRef.current = null;
    void repo.excluirCenario(id).then(() => useApp.getState().recarregar()).catch(() => {});
  }, []);

  const boxId = dados ? boxIdEfetivo(dados, boxSel) : null;
  const parcelas = Number(parcelasTexto) || 0;
  const valido = boxId != null && valor > 0 && data !== '' && data >= hoje
    && (repeticao !== 'parcelado' || (parcelas >= 2 && Math.round(valor / parcelas) >= 1));

  // Projeção com o rascunho ligado: "sem" é o saldo projetado, "com" soma o rascunho.
  const resultado = useMemo(() => {
    if (!dados || !cenarioId || !dados.cenarios.some((c) => c.id === cenarioId)) return null;
    const serie = projetarBoxes(boxIdsSelecionadas(dados, boxSel), {
      boxes: dados.boxes, categorias: dados.categorias, lancamentos: dados.lancamentos,
      cenariosLigados: new Set([cenarioId]), horizonte: dados.config.horizonteProjecao,
    });
    return {
      sem: menorSaldo(serie, 'saldoProjetado', hoje),
      com: menorSaldo(serie, 'saldoComCenarios', hoje),
      negativoEm: primeiroDiaNegativo(serie, 'saldoComCenarios', hoje),
    };
  }, [dados, boxSel, hoje, cenarioId]);
  if (!dados) return null;

  async function simular() {
    if (!valido || ocupado || !dados || boxId == null || data === '') return;
    setOcupado(true);
    try {
      // Recomeça: o rascunho anterior (e seus itens) sai. Um cenário já guardado fica.
      if (rascunhoRef.current) {
        await repo.excluirCenario(rascunhoRef.current);
        rascunhoRef.current = null;
      }
      const agora = agoraISO();
      const id = novoId();
      await repo.salvarCenario({ id, nome: repo.NOME_SIMULACAO_RAPIDA, ligado: true, criadoEm: agora, alteradoEm: agora });
      rascunhoRef.current = id;
      const categoriaId = await repo.categoriaAClassificarDe(boxId, 'gasto');
      await gravarItemNovo(id, boxId, {
        valor, descricao: '', tipo: 'gasto', categoriaId, repeticao, data, parcelas,
      }, dados.config.horizonteProjecao);
      await recarregar();
      setGuardado(false);
      setCenarioId(id);
    } finally {
      setOcupado(false);
    }
  }

  async function guardar() {
    const id = rascunhoRef.current;
    const cenario = id ? dados?.cenarios.find((c) => c.id === id) : undefined;
    if (!id || !cenario || ocupado) return;
    setOcupado(true);
    try {
      const [, mes, dia] = hoje.split('-');
      await repo.salvarCenario({ ...cenario, nome: `Simulação de ${dia}/${mes}` });
      // Guardado: o cenário deixa de ser rascunho e não é apagado ao sair.
      rascunhoRef.current = null;
      await recarregar();
      setGuardado(true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="card lista">
        <div className="rotulo-grupo">E se eu gastar…</div>
        <div className="form-linha">
          <div className="campo">
            <label htmlFor={`${uid}-valor`}>Valor</label>
            <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} />
          </div>
          <div className="campo">
            <label htmlFor={`${uid}-data`}>Quando</label>
            <CampoData id={`${uid}-data`} value={data} onChange={setData} min={hoje} />
          </div>
        </div>
        <SeletorPills
          rotulo="Repetição" opcoes={OPCOES_REPETICAO} selecionadaId={repeticao}
          onSelecionar={(id) => setRepeticao(id as Repeticao)}
        />
        {repeticao === 'parcelado' && (
          <div className="campo">
            <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
            <input
              id={`${uid}-parcelas`} inputMode="numeric" value={parcelasTexto}
              onChange={(e) => setParcelasTexto(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}
        {repeticao === 'parcelado' && parcelas >= 2 && valor > 0 && (
          <p className="sub" style={{ margin: 0 }}>
            O valor é o total: cada parcela sai por {formatarBRL(Math.round(valor / parcelas))}.
          </p>
        )}
        <button className="botao botao-primario" disabled={!valido || ocupado} onClick={simular}>Simular</button>
      </div>

      {resultado && (
        <div className="card lista">
          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <span>Menor saldo sem a compra</span>
            <strong className={classeSaldo(resultado.sem)}>{formatarSaldo(resultado.sem)}</strong>
          </div>
          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <span>Menor saldo com a compra</span>
            <strong className={classeSaldo(resultado.com)}>{formatarSaldo(resultado.com)}</strong>
          </div>
          {resultado.negativoEm && (
            <p className="aviso aviso-urgente" style={{ margin: 0 }}>
              O saldo ficaria negativo em {formatarDataBR(resultado.negativoEm).slice(0, 5)}.
            </p>
          )}
          {guardado ? (
            <p className="sub" style={{ margin: 0 }}>Guardada. Ela aparece em Simular, no modo Avançado.</p>
          ) : (
            <button className="botao" disabled={ocupado} onClick={guardar}>Guardar</button>
          )}
        </div>
      )}
    </>
  );
}
