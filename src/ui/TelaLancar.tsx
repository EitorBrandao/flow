import { useEffect, useMemo, useRef, useState } from 'react';
import * as repo from '../db/repo';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import LinhaOrcamentoViagem from './LinhaOrcamentoViagem';
import ConfirmarRepetidoSheet from './ConfirmarRepetidoSheet';
import SeletorCategoria from './SeletorCategoria';
import SeletorBanco from './SeletorBanco';
import SeletorPills, { OPCOES_TIPO } from './SeletorPills';
import { categoriasFaturaIds } from '../domain/fatura';
import { categoriasTransferenciaIds } from '../domain/transferencia';
import { bancoPadrao, bancosDaBox } from '../domain/bancos';
import type { Lancamento, TipoCategoria } from '../domain/types';
import { formatarDataBR } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import { avisoDataNoSaldo } from '../domain/projection';
import { gastoDaViagem, viagemAtivaEm } from '../domain/viagem';
import { categoriaPorDescricao } from '../domain/modos';
import { lancamentoRepetido } from '../domain/lancamentoRepetido';
import { useApp } from '../state/store';
import { useModo } from './useModo';

export default function TelaLancar() {
  const modo = useModo('lancar');
  const { dados, boxSel, hoje, recarregar, rascunhoLancar, setRascunhoLancar } = useApp();
  const [cents, setCents] = useState(0);
  const [tipo, setTipo] = useState<TipoCategoria>('gasto');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [data, setData] = useState(hoje);
  const [nota, setNota] = useState('');
  const [previsto, setPrevisto] = useState(false);
  const [viagemMarcada, setViagemMarcada] = useState(true);
  const [salvo, setSalvo] = useState(false);
  // Lançamento igual achado ao tocar em Lançar: guarda o existente e o modo que tentou salvar.
  const [repetido, setRepetido] = useState<{ lanc: Lancamento; simples: boolean } | null>(null);
  // `null` = "o banco padrão da box"; só vira ID quando a pessoa escolhe outro.
  const [bancoEscolhido, setBancoEscolhido] = useState<string | null>(null);
  // A box que pagou, escolhida no campo Box: no Avançado só com "casa" no topo; no Simples
  // quando não há box padrão e há mais de uma box. Fica escolhida depois de lançar,
  // porque a pessoa costuma lançar vários gastos seguidos da mesma box.
  const [boxEscolhidaId, setBoxEscolhidaId] = useState<string | null>(null);
  // Trava o segundo toque até o fim do `await`: o estado só atualiza no próximo render.
  const salvandoRef = useRef(false);
  const salvoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viagemAtiva = viagemAtivaEm(dados?.viagens ?? [], data);

  useEffect(() => {
    setViagemMarcada(true);
  }, [viagemAtiva?.id ?? null]);

  const naCasa = boxSel === 'casa';
  // A box "casa" é a que não tem saldo próprio e guarda o histórico compartilhado: não recebe
  // lançamento novo por aqui. Quem lança na casa escolhe a box de quem pagou.
  const boxesReais = dados ? dados.boxes.filter((b) => b.nome !== 'casa' && b.saldoInicial !== null) : [];
  const ehBoxReal = (id: string | null | undefined) => id != null && boxesReais.some((b) => b.id === id);
  const boxEscolhida = ehBoxReal(boxEscolhidaId) ? boxEscolhidaId : null;
  // No Simples: box padrão → box escolhida → box do topo → única box. Sem resolução, `null`.
  const boxPadraoId = ehBoxReal(dados?.config.boxPadraoId) ? dados!.config.boxPadraoId! : null;
  const boxId: string | null = !dados ? null
    : modo === 'simples'
      ? (boxPadraoId ?? boxEscolhida ?? (ehBoxReal(boxSel) ? boxSel : null)
        ?? (boxesReais.length === 1 ? boxesReais[0].id : null))
      : naCasa ? boxEscolhida : boxSel;
  const mostraSeletorBox = boxesReais.length > 0 && (
    modo === 'simples' ? boxPadraoId == null && boxesReais.length > 1 : naCasa
  );

  // A sheet Adicionar não renderiza esta tela, então manda o atalho pelo store. A dependência
  // é o rascunho, não a montagem: o + pode ser aberto com a tela Lançar já visível.
  useEffect(() => {
    if (!rascunhoLancar || !dados) return;
    const achada = dados.categorias.find((c) => c.id === rascunhoLancar.categoriaId);
    // Com a box já definida, só vale categoria dela; na casa sem box escolhida, a categoria
    // fica guardada e some se a box escolhida depois não for a dela.
    const cat = achada && (boxId == null || achada.boxId === boxId) ? achada : undefined;
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
  }, [rascunhoLancar, dados, hoje, setRascunhoLancar, boxId]);

  useEffect(() => () => {
    if (salvoTimeoutRef.current != null) clearTimeout(salvoTimeoutRef.current);
  }, []);


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

  // O Simples não pede categoria nem data: a categoria vem da descrição, a data é hoje.
  const valido = modo === 'simples'
    ? boxId != null && cents > 0
    : boxId != null && cents > 0 && categoriaId != null && data !== ''
      && categorias.some((c) => c.id === categoriaId);

  // Uma frase por vez, na ordem em que a pessoa preenche — dizer tudo que falta de uma vez
  // vira ruído, e o campo seguinte já vai aparecer sozinho quando o anterior for resolvido.
  // Sem valor, nada: o campo Valor já abre em foco, e a frase aparecia antes de qualquer toque.
  const oQueFalta = categorias.length === 0
    ? 'Nenhuma categoria nesta box — crie em Ajustes, Categorias.'
    : cents === 0 ? ''
      : categoriaId == null ? 'Escolha uma categoria.'
        : data === '' ? 'Escolha uma data.'
          : '';

  // Categoria que o Simples vai usar, sem criar nada: o atalho dos Frequentes (se ainda vale), a da
  // descrição ou a "A classificar" que já existe. Sem nenhuma, devolve null.
  function categoriaDoSimples(descricao: string): string | null {
    if (!dados || boxId == null) return null;
    // A categoria do atalho (chip dos Frequentes) vale mais, se ainda for da box e do tipo.
    const doAtalho = categoriaId != null
      && dados.categorias.some((c) => c.id === categoriaId && c.boxId === boxId && c.tipo === tipo && !c.arquivada);
    const aClassificar = dados.categorias.find((c) =>
      c.boxId === boxId && c.tipo === tipo && !c.arquivada && c.nome === repo.nomeCategoriaAClassificar(tipo));
    return (doAtalho ? categoriaId : null)
      ?? categoriaPorDescricao({ lancamentos: dados.lancamentos, categorias: dados.categorias, boxId, tipo, descricao })
      ?? aClassificar?.id ?? null;
  }

  // Mesma box, data, valor e categoria de outro lançamento: pede confirmação antes de salvar.
  function achaRepetido(dataLancamento: string, categoria: string | null) {
    if (!dados || boxId == null || categoria == null) return null;
    return lancamentoRepetido(dados.lancamentos, {
      boxId, data: dataLancamento, valor: cents, categoriaId: categoria,
    });
  }

  async function lancarSimples(confirmado = false) {
    if (!valido || salvandoRef.current || !dados) return;
    if (!confirmado) {
      const igual = achaRepetido(hoje, categoriaDoSimples(nota.trim()));
      if (igual) { setRepetido({ lanc: igual, simples: true }); return; }
    }
    salvandoRef.current = true;
    try {
      const descricao = nota.trim();
      const catId = categoriaDoSimples(descricao) ?? await repo.categoriaAClassificarDe(boxId!, tipo);
      // Como no Avançado: se há viagem ativa na data do lançamento, ele entra nela.
      const viagemHoje = viagemAtivaEm(dados.viagens, hoje);
      await repo.salvarLancamento({
        boxId: boxId!, categoriaId: catId, data: hoje, valor: cents,
        ...(descricao ? { nota: descricao } : {}),
        status: 'efetivo',
        ...(viagemHoje ? { viagemId: viagemHoje.id } : {}),
        ...(bancoId ? { bancoId } : {}),
      });
      await recarregar();
      // O atalho vale para um lançamento só: o seguinte volta à regra da descrição.
      setCents(0); setNota(''); setCategoriaId(null); setSalvo(true);
      if (salvoTimeoutRef.current != null) clearTimeout(salvoTimeoutRef.current);
      salvoTimeoutRef.current = setTimeout(() => setSalvo(false), 2500);
    } finally {
      salvandoRef.current = false;
    }
  }

  async function lancar(confirmado = false) {
    if (!valido || salvandoRef.current) return;
    if (!confirmado) {
      const igual = achaRepetido(data, categoriaId);
      if (igual) { setRepetido({ lanc: igual, simples: false }); return; }
    }
    // Trava o segundo toque até o fim do `await`: sem ela, o toque duplo salva duas vezes.
    salvandoRef.current = true;
    try {
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
    } finally {
      salvandoRef.current = false;
    }
  }

  return (
    <div className="tela">
      {dados && boxId == null && boxesReais.length === 0 && (
        <p className="sub">Nenhuma box — crie em Ajustes → Boxes.</p>
      )}
      {mostraSeletorBox && (
        <div className="campo">
          <label htmlFor="box">Box</label>
          <select id="box" value={boxId ?? ''} onChange={(e) => setBoxEscolhidaId(e.target.value || null)}>
            <option value="">Escolha a box…</option>
            {boxesReais.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
        </div>
      )}
      {mostraSeletorBox && boxId == null && <p className="sub">Escolha a box.</p>}
      {boxAtual && <p className="sub" style={{ margin: 0 }}>Lançando na box <strong>{boxAtual.nome}</strong></p>}
      {modo === 'simples' ? (
        <>
          <div className="campo">
            <label htmlFor="valor">Valor</label>
            <CampoValor id="valor" valorCentavos={cents} onChange={setCents} autoFocus style={{ fontSize: 28 }} />
          </div>
          <SeletorPills
            rotulo="Tipo" opcoes={OPCOES_TIPO} selecionadaId={tipo}
            onSelecionar={(id) => { setTipo(id as TipoCategoria); setCategoriaId(null); }}
          />
          <div className="campo">
            <label htmlFor="nota">Do que foi? (opcional)</label>
            <input id="nota" value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          <button className="botao botao-primario" disabled={!valido} onClick={() => lancarSimples()} style={{ padding: 14 }}>
            Lançar
          </button>
          {salvo && <p className="aviso aviso-sucesso">Lançado ✓</p>}
        </>
      ) : boxId != null && (
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
          <button className="botao botao-primario" disabled={!valido} onClick={() => lancar()} style={{ padding: 14 }}>
            Lançar
          </button>
          {/* Botão desabilitado sem explicação deixa a pessoa sem saber o que falta — e quem
              acabou de instalar cai justamente no caso "não há categoria nenhuma". */}
          {!valido && !salvo && oQueFalta && <p className="sub">{oQueFalta}</p>}
          {salvo && <p className="aviso aviso-sucesso">Lançado ✓</p>}
        </>
      )}
      <ConfirmarRepetidoSheet
        aberto={repetido != null}
        titulo="Lançamento repetido?"
        frase={repetido && (
          <>
            Já existe {tipo === 'gasto' ? 'um gasto' : 'um ganho'} de <strong>{formatarBRL(repetido.lanc.valor)}</strong>
            {' '}em <strong>{formatarDataBR(repetido.lanc.data)}</strong> na box {boxAtual?.nome ?? ''}
            {repetido.lanc.nota ? <>: “{repetido.lanc.nota}”.</> : '.'}
          </>
        )}
        apoio="Se foi um toque duplo, cancele. Se é outro lançamento igual, lance mesmo assim."
        rotuloConfirmar="Lançar mesmo assim"
        onCancelar={() => setRepetido(null)}
        onConfirmar={() => {
          const simples = repetido?.simples;
          setRepetido(null);
          return simples ? lancarSimples(true) : lancar(true);
        }}
      />
    </div>
  );
}
