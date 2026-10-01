import { useEffect, useMemo, useRef, useState } from 'react';
import * as repo from '../db/repo';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import LinhaOrcamentoViagem from './LinhaOrcamentoViagem';
import SeletorCategoria from './SeletorCategoria';
import SeletorBanco from './SeletorBanco';
import SeletorPills, { OPCOES_TIPO } from './SeletorPills';
import { categoriasFaturaIds } from '../domain/fatura';
import { categoriasTransferenciaIds } from '../domain/transferencia';
import { bancoPadrao, bancosDaBox } from '../domain/bancos';
import type { TipoCategoria } from '../domain/types';
import { avisoDataNoSaldo } from '../domain/projection';
import { gastoDaViagem, viagemAtivaEm } from '../domain/viagem';
import { useApp } from '../state/store';

export default function TelaLancar() {
  const { dados, boxSel, hoje, recarregar, rascunhoLancar, setRascunhoLancar } = useApp();
  const [cents, setCents] = useState(0);
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [data, setData] = useState(hoje);
  const [nota, setNota] = useState('');
  const [previsto, setPrevisto] = useState(false);
  const [viagemMarcada, setViagemMarcada] = useState(true);
  const [salvo, setSalvo] = useState(false);
  // `null` = "o banco padrão da box"; só vira ID quando a pessoa escolhe outro.
  const [bancoEscolhido, setBancoEscolhido] = useState<string | null>(null);
  // Só vale com "casa" no topo: a box que pagou o gasto. Fica escolhida depois de lançar,
  // porque a pessoa costuma lançar vários gastos seguidos da mesma box.
  const [boxEscolhidaId, setBoxEscolhidaId] = useState<string | null>(null);
  const salvoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viagemAtiva = viagemAtivaEm(dados?.viagens ?? [], data);

  useEffect(() => {
    setViagemMarcada(true);
  }, [viagemAtiva?.id ?? null]);

  // A sheet Adicionar não renderiza esta tela, então manda o atalho pelo store. A dependência
  // é o rascunho, não a montagem: o + pode ser aberto com a tela Lançar já visível.
  useEffect(() => {
    if (!rascunhoLancar || !dados) return;
    const cat = dados.categorias.find((c) => c.id === rascunhoLancar.categoriaId);
    if (cat) {
      setTipo(cat.tipo);
      setCategoriaId(cat.id);
      setCents(rascunhoLancar.valorCent);
      // O atalho é sempre "lançar agora": zera o que a tela já tinha, para não herdar
      // data futura, nota velha ou o previsto de um preenchimento anterior abandonado.
      setData(hoje);
      setNota('');
      setPrevisto(false);
      setBancoEscolhido(null);
    }
    setRascunhoLancar(null);
  }, [rascunhoLancar, dados, hoje, setRascunhoLancar]);

  useEffect(() => () => {
    if (salvoTimeoutRef.current != null) clearTimeout(salvoTimeoutRef.current);
  }, []);

  const naCasa = boxSel === 'casa';
  // A box "casa" é a que não tem saldo próprio e guarda o histórico compartilhado: não recebe
  // lançamento novo por aqui. Quem lança na casa escolhe a box de quem pagou.
  const boxesReais = dados ? dados.boxes.filter((b) => b.nome !== 'casa') : [];
  const boxId: string | null = !dados ? null
    : naCasa ? (boxesReais.some((b) => b.id === boxEscolhidaId) ? boxEscolhidaId : null)
      : boxSel;

  // Trocar de box zera o banco; a categoria só fica se for da box nova.
  useEffect(() => {
    setBancoEscolhido(null);
    setCategoriaId((atual) => (
      atual != null && dados?.categorias.find((c) => c.id === atual)?.boxId === boxId ? atual : null
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxId]);
  const bancos = dados && boxId ? bancosDaBox(dados.bancos, [boxId]) : [];
  const bancoId = bancoEscolhido ?? (dados && boxId ? bancoPadrao(dados.bancos, boxId)?.id : undefined);

  const ocultas = useMemo(
    () => new Set([
      ...categoriasFaturaIds(dados?.cartoes ?? []),
      ...categoriasTransferenciaIds(dados?.boxes ?? []),
    ]),
    [dados],
  );
  const categorias = useMemo(
    () => (dados?.categorias ?? [])
      .filter((c) => c.boxId === boxId && c.tipo === tipo && !c.arquivada && !ocultas.has(c.id)),
    [dados, boxId, tipo, ocultas],
  );

  const boxAtual = dados?.boxes.find((b) => b.id === boxId);
  const avisoSaldo = avisoDataNoSaldo(boxAtual, data);

  const valido = boxId != null && cents > 0 && categoriaId != null && data !== '';

  // Uma frase por vez, na ordem em que a pessoa preenche — dizer tudo que falta de uma vez
  // vira ruído, e o campo seguinte já vai aparecer sozinho quando o anterior for resolvido.
  // Sem valor, nada: o campo Valor já abre em foco, e a frase aparecia antes de qualquer toque.
  const oQueFalta = categorias.length === 0
    ? 'Nenhuma categoria nesta box — crie em Ajustes, Categorias.'
    : cents === 0 ? ''
      : categoriaId == null ? 'Escolha uma categoria.'
        : data === '' ? 'Escolha uma data.'
          : '';

  async function lancar() {
    if (!valido) return;
    await repo.salvarLancamento({
      boxId: boxId!, categoriaId: categoriaId!, data, valor: cents,
      ...(nota ? { nota } : {}),
      status: previsto ? 'previsto' : (data > hoje ? 'previsto' : 'efetivo'),
      ...(viagemAtiva && viagemMarcada ? { viagemId: viagemAtiva.id } : {}),
      ...(bancoId ? { bancoId } : {}),
    });
    await recarregar();
    setCents(0); setCategoriaId(null); setNota(''); setData(hoje);
    setPrevisto(false); setViagemMarcada(true); setBancoEscolhido(null); setSalvo(true);
    if (salvoTimeoutRef.current != null) clearTimeout(salvoTimeoutRef.current);
    salvoTimeoutRef.current = setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <div className="tela">
      {naCasa && (
        boxesReais.length === 0 ? (
          <p className="sub">Nenhuma box — crie em Ajustes → Boxes.</p>
        ) : (
          <div className="campo">
            <label htmlFor="box">Box</label>
            <select id="box" value={boxEscolhidaId ?? ''} onChange={(e) => setBoxEscolhidaId(e.target.value || null)}>
              <option value="">Escolha a box…</option>
              {boxesReais.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>
        )
      )}
      {naCasa && boxesReais.length > 0 && boxId == null && <p className="sub">Escolha a box.</p>}
      {boxAtual && <p className="sub" style={{ margin: 0 }}>Lançando na box <strong>{boxAtual.nome}</strong></p>}
      {boxId != null && (
        <>
          <div className="campo">
            <label htmlFor="valor">Valor</label>
            <CampoValor id="valor" valorCentavos={cents} onChange={setCents} autoFocus style={{ fontSize: 28 }} />
          </div>
          <SeletorPills
            rotulo="Tipo" opcoes={OPCOES_TIPO} selecionadaId={tipo}
            onSelecionar={(id) => { setTipo(id as TipoCategoria); setCategoriaId(null); }}
          />
          <SeletorCategoria categorias={categorias} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
          <SeletorBanco bancos={bancos} selecionadaId={bancoId ?? null} onSelecionar={setBancoEscolhido} />
          <div className="linha">
            <div className="campo">
              <label htmlFor="data">Data</label>
              <CampoData id="data" value={data} onChange={setData} />
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label htmlFor="nota">Nota (opcional)</label>
              <input id="nota" value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
          </div>
          {avisoSaldo && <p className="aviso">{avisoSaldo}</p>}
          <label htmlFor="previsto">
            <input
              id="previsto" type="checkbox"
              checked={previsto} onChange={(e) => setPrevisto(e.target.checked)}
            />
            {' '}Marcar como previsto
          </label>
          {viagemAtiva && (
            <label htmlFor="viagem">
              <input
                id="viagem" type="checkbox"
                checked={viagemMarcada} onChange={(e) => setViagemMarcada(e.target.checked)}
              />
              {' '}Viagem: {viagemAtiva.nome}
            </label>
          )}
          {dados && viagemAtiva && viagemMarcada && (viagemAtiva.orcamentoCent ?? 0) > 0 && (() => {
            const gastoAtual = gastoDaViagem(viagemAtiva, dados.lancamentos, dados.comprasCartao, dados.categorias);
            const conta = cents > 0 && tipo === 'gasto' && !previsto && data <= hoje;
            return conta
              ? (
                <LinhaOrcamentoViagem
                  orcamentoCent={viagemAtiva.orcamentoCent!} gastoCent={gastoAtual + cents} comEsteGasto
                />
              )
              : <LinhaOrcamentoViagem orcamentoCent={viagemAtiva.orcamentoCent!} gastoCent={gastoAtual} />;
          })()}
          <button className="botao botao-primario" disabled={!valido} onClick={lancar} style={{ padding: 14 }}>
            Lançar
          </button>
          {/* Botão desabilitado sem explicação deixa a pessoa sem saber o que falta — e quem
              acabou de instalar cai justamente no caso "não há categoria nenhuma". */}
          {!valido && !salvo && oQueFalta && <p className="sub">{oQueFalta}</p>}
          {salvo && <p className="aviso aviso-sucesso">Lançado ✓</p>}
        </>
      )}
    </div>
  );
}
