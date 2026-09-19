import { useId, useMemo, useRef, useState } from 'react';
import { ADAPTERS, detectarAdapter } from '../../importar/adapters';
import { aplicar, type ContextoAplicar, type ResumoAplicacao } from '../../importar/aplicar';
import {
  CATEGORIA_A_CLASSIFICAR, acaoEfetiva, chaveDoItem, conferir, totalCorrigidoValido, totalEfetivo,
  type OpcoesConferencia,
} from '../../importar/conferencia';
import type {
  Adapter, DecisaoTotal, DecisaoTroca, ItemConferencia, LeituraAdapter,
} from '../../importar/tipos';
import type { ID } from '../../domain/types';
import { boxIdEfetivo, useApp } from '../../state/store';
import ListaConferencia, { type ItemComContexto } from './ListaConferencia';

const NAO_IMPORTAR = 'nao-importar' as const;
type DestinoBloco = ID | typeof NAO_IMPORTAR | undefined;

export default function Importar() {
  const { dados, boxSel, recarregar } = useApp();
  const uid = useId();
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  // Trava síncrona contra o duplo toque: `aplicando` (estado) só vale depois do re-render, e
  // dois cliques seguidos acontecem antes disso. Sem esta ref, os dois disparam `aplicar`.
  const aplicandoRef = useRef(false);

  const [nomeArquivo, setNomeArquivo] = useState('');
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [adapterAtual, setAdapterAtual] = useState<Adapter | undefined>(undefined);
  const [escolhendoFormato, setEscolhendoFormato] = useState(false);
  const [leitura, setLeitura] = useState<LeituraAdapter | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');

  const [boxIdEscolhida, setBoxIdEscolhida] = useState<ID | null>(null);
  const [destinoBlocos, setDestinoBlocos] = useState<Record<number, DestinoBloco>>({});

  const [trocas, setTrocas] = useState<Record<string, DecisaoTroca>>({});
  const [totaisCorrigidos, setTotaisCorrigidos] = useState<Record<string, DecisaoTotal>>({});

  const [resumoAplicado, setResumoAplicado] = useState<ResumoAplicacao | null>(null);
  const [erroAplicar, setErroAplicar] = useState('');
  const [aplicando, setAplicando] = useState(false);

  const cartoesAtivos = useMemo(() => (dados?.cartoes ?? []).filter((c) => c.ativo), [dados]);

  const itensComContexto: ItemComContexto[] = useMemo(() => {
    if (!leitura || !dados) return [];
    if (leitura.blocos) {
      return leitura.blocos.flatMap((bloco, i) => {
        const destino = destinoBlocos[i];
        if (!destino || destino === NAO_IMPORTAR) return [];
        const cartao = dados.cartoes.find((c) => c.id === destino);
        if (!cartao) return [];
        const opcoes: OpcoesConferencia = {
          boxId: cartao.boxId,
          cartaoId: cartao.id,
          categoriasPadrao: { ganho: CATEGORIA_A_CLASSIFICAR.ganho, gasto: CATEGORIA_A_CLASSIFICAR.gasto },
          categoriaCartaoPadraoId: CATEGORIA_A_CLASSIFICAR.cartao,
        };
        return conferir(bloco.brutos, dados, opcoes)
          .map((item) => ({
            item, boxId: cartao.boxId, cartaoId: cartao.id, chave: chaveDoItem(item, leitura),
          }));
      });
    }
    if (!boxIdEscolhida) return [];
    const opcoes: OpcoesConferencia = {
      boxId: boxIdEscolhida,
      categoriasPadrao: { ganho: CATEGORIA_A_CLASSIFICAR.ganho, gasto: CATEGORIA_A_CLASSIFICAR.gasto },
    };
    return conferir(leitura.brutos, dados, opcoes)
      .map((item) => ({ item, boxId: boxIdEscolhida, chave: chaveDoItem(item, leitura) }));
  }, [leitura, dados, destinoBlocos, boxIdEscolhida]);

  const destinoCompleto = leitura
    ? (leitura.blocos
      ? leitura.blocos.every((_, i) => destinoBlocos[i] !== undefined)
      : boxIdEscolhida != null)
    : false;

  const mudancas = itensComContexto
    .filter((ic) => acaoEfetiva(ic.item, trocas[ic.chave]).tipo !== 'ignorar').length;
  const semMudanca = itensComContexto.length - mudancas;
  const podeConfirmar = destinoCompleto && mudancas > 0 && !aplicando;

  if (!dados) return null;

  function limparTudo() {
    setNomeArquivo(''); setBuf(null); setAdapterAtual(undefined); setEscolhendoFormato(false);
    setLeitura(null); setLendo(false); setErro('');
    setBoxIdEscolhida(null); setDestinoBlocos({});
    setTrocas({}); setTotaisCorrigidos({});
    setResumoAplicado(null); setErroAplicar('');
  }

  async function lerComAdapter(adapter: Adapter, conteudo: ArrayBuffer) {
    setAdapterAtual(adapter);
    setEscolhendoFormato(false);
    setLendo(true);
    setErro('');
    setTrocas({});
    setTotaisCorrigidos({});
    try {
      const r = await adapter.ler(conteudo);
      setLeitura(r);
      setBoxIdEscolhida(boxIdEfetivo(dados!, boxSel));
      const destinos: Record<number, DestinoBloco> = {};
      const ativos = (dados?.cartoes ?? []).filter((c) => c.ativo);
      (r.blocos ?? []).forEach((_, i) => {
        destinos[i] = ativos.length === 1 ? ativos[0].id : undefined;
      });
      setDestinoBlocos(destinos);
    } catch (e) {
      setLeitura(null);
      // O detalhe técnico fica na mensagem: foi ele que permitiu diagnosticar o defeito do
      // buffer esvaziado do PDF. Sem o prefixo em português, a exceção crua aparecia na tela.
      const mensagem = e instanceof Error ? e.message : 'motivo desconhecido';
      setErro(`Não foi possível ler o arquivo. Detalhe técnico: ${mensagem}`);
    } finally {
      setLendo(false);
    }
  }

  async function onArquivoEscolhido(file: File) {
    const conteudo = await file.arrayBuffer();
    const inicio = new TextDecoder().decode(conteudo.slice(0, 2048));
    setNomeArquivo(file.name);
    setBuf(conteudo);
    setLeitura(null);
    setBoxIdEscolhida(null);
    setDestinoBlocos({});
    setTrocas({});
    setTotaisCorrigidos({});
    setResumoAplicado(null);
    setErroAplicar('');
    const adapter = detectarAdapter(file.name, inicio);
    if (adapter) {
      await lerComAdapter(adapter, conteudo);
    } else {
      setAdapterAtual(undefined);
      setEscolhendoFormato(true);
    }
  }

  function escolherFormatoManualmente(adapter: Adapter) {
    if (!buf) return;
    void lerComAdapter(adapter, buf);
  }

  /** Marca toda a lista para ignorar — inclusive itens que já tinham outra decisão. É um
   *  jeito rápido de "esvaziar" a conferência antes de escolher, item a item, o que entra. */
  function marcarTodosComoIgnorar() {
    setTrocas((t) => {
      const novo = { ...t };
      for (const ic of itensComContexto) novo[ic.chave] = { estado: ic.item.estado, acao: { tipo: 'ignorar' } };
      return novo;
    });
  }

  async function confirmar() {
    if (!leitura) return;
    // Trava síncrona: sem ela, um segundo clique disparado antes do re-render (que traria
    // `aplicando: true` pro DOM) passaria pela guarda e chamaria `aplicar` de novo.
    if (aplicandoRef.current) return;
    aplicandoRef.current = true;
    setAplicando(true);
    setErroAplicar('');
    try {
      // Junta a ação final de cada item (default ou trocada) e, se houve correção do total
      // de uma parcelada reconstruída, aplica ela antes de gravar — só quando válida.
      const finais: ItemConferencia[] = itensComContexto.map((ic) => {
        const acao = acaoEfetiva(ic.item, trocas[ic.chave]);
        const totalCorrigido = totalCorrigidoValido(ic.item, totalEfetivo(ic.item, totaisCorrigidos[ic.chave]));
        const compraReconstruida = ic.item.compraReconstruida && totalCorrigido != null
          ? { ...ic.item.compraReconstruida, valorTotalCent: totalCorrigido }
          : ic.item.compraReconstruida;
        return { ...ic.item, acao, ...(compraReconstruida ? { compraReconstruida } : {}) };
      });

      // Um grupo por (boxId, cartaoId): é o que `aplicar` recebe de uma vez, para que a
      // sincronização de cartões rode uma vez por grupo, não item a item.
      const grupos = new Map<string, { boxId: ID; cartaoId?: ID; itens: ItemConferencia[] }>();
      itensComContexto.forEach((ic, i) => {
        const chaveGrupo = `${ic.boxId}::${ic.cartaoId ?? ''}`;
        const grupo = grupos.get(chaveGrupo) ?? { boxId: ic.boxId, cartaoId: ic.cartaoId, itens: [] };
        grupo.itens.push(finais[i]);
        grupos.set(chaveGrupo, grupo);
      });

      const total: ResumoAplicacao = {
        confirmados: 0, adicionados: 0, excluidos: 0, ignorados: 0, invalidos: 0,
      };
      for (const grupo of grupos.values()) {
        const ctx: ContextoAplicar = {
          boxId: grupo.boxId, cartaoId: grupo.cartaoId, horizonte: dados!.config.horizonteProjecao,
        };
        const resumo = await aplicar(grupo.itens, ctx);
        total.confirmados += resumo.confirmados;
        total.adicionados += resumo.adicionados;
        total.excluidos += resumo.excluidos;
        total.ignorados += resumo.ignorados;
        total.invalidos += resumo.invalidos;
      }

      limparTudo();
      setResumoAplicado(total);
    } catch {
      // Um grupo pode já ter gravado antes de outro falhar. Não se limpa a leitura nem as
      // trocas: o `recarregar` no `finally` traz os dados atualizados, e a lista se refaz
      // sozinha contra eles — o que já entrou aparece como `confere`, e uma nova tentativa
      // não duplica nada.
      setErroAplicar(
        'A gravação parou no meio. O que já entrou foi salvo, e a lista foi atualizada: '
        + 'confira de novo antes de confirmar.',
      );
    } finally {
      await recarregar();
      setAplicando(false);
      aplicandoRef.current = false;
    }
  }

  const zeroBrutos = leitura != null && leitura.brutos.length === 0;
  const temConferencia = leitura != null && leitura.brutos.length > 0;

  return (
    <div className="tela">
      <h2>Importar e conferir</h2>

      {resumoAplicado && (
        <p className="sub">
          {resumoAplicado.confirmados} confirmados, {resumoAplicado.adicionados} adicionados,{' '}
          {resumoAplicado.excluidos} excluídos.
        </p>
      )}
      {resumoAplicado && resumoAplicado.invalidos > 0 && (
        <p className="aviso">{resumoAplicado.invalidos} itens não puderam ser aplicados.</p>
      )}

      <section className="card">
        <div className="secao"><h3>1. Arquivo</h3></div>
        {!nomeArquivo ? (
          <>
            <div className="selecionar-arquivo">
              <button
                type="button" className="botao botao-primario" aria-hidden="true" tabIndex={-1}
                style={{ width: '100%' }} onClick={() => inputArquivoRef.current?.click()}
              >Escolher arquivo</button>
              <input
                ref={inputArquivoRef} id={`${uid}-arquivo`} type="file" accept=".csv,.pdf"
                aria-label="Escolher arquivo"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onArquivoEscolhido(f);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="sub">
              Escolha o CSV do extrato do Nubank ou o PDF da fatura do Santander. Nada é
              gravado até você conferir e confirmar.
            </p>
          </>
        ) : (
          <>
            <div className="linha-topo">
              <div className="cresce">
                <div>{nomeArquivo}</div>
                <div className="sub">
                  {lendo
                    ? 'Lendo arquivo…'
                    : adapterAtual
                      ? `Reconhecido: ${adapterAtual.rotulo}`
                      : 'Formato não reconhecido. Esperado: o CSV do extrato da conta Nubank '
                        + 'ou o PDF da fatura do Santander.'}
                </div>
              </div>
              {adapterAtual && (
                <button className="botao" onClick={() => setEscolhendoFormato((v) => !v)}>Trocar</button>
              )}
            </div>
            {!lendo && (escolhendoFormato || !adapterAtual) && (
              <div className="pills" role="radiogroup" aria-label="Formato do arquivo">
                {ADAPTERS.map((a) => (
                  <button
                    key={a.id}
                    className={adapterAtual?.id === a.id ? 'ativo' : ''}
                    onClick={() => escolherFormatoManualmente(a)}
                  >{a.rotulo}</button>
                ))}
              </div>
            )}
            {erro && <p className="aviso">{erro}</p>}
            <button type="button" className="botao-ver-mais" onClick={limparTudo}>
              Escolher outro arquivo
            </button>
          </>
        )}
      </section>

      {zeroBrutos && (
        <section className="card">
          {leitura!.avisos.map((a) => <p className="aviso" key={a}>{a}</p>)}
          <p className="sub">Nenhum lançamento reconhecido no arquivo.</p>
        </section>
      )}

      {temConferencia && !leitura!.blocos && (
        <section className="card">
          <div className="secao"><h3>2. Destino</h3></div>
          <div className="pills" role="radiogroup" aria-label="Box de destino">
            {dados.boxes.map((b) => (
              <button
                key={b.id}
                className={boxIdEscolhida === b.id ? 'ativo' : ''}
                onClick={() => setBoxIdEscolhida(b.id)}
              >{b.nome}</button>
            ))}
          </div>
          <p className="sub">Nada é gravado até você confirmar no passo 3.</p>
        </section>
      )}

      {temConferencia && leitura!.blocos && (
        <section className="card">
          <div className="secao"><h3>2. Destino</h3></div>
          {leitura!.blocos.map((bloco, i) => (
            <div className="campo" key={bloco.rotulo}>
              <label>{bloco.rotulo}</label>
              <div className="pills" role="radiogroup" aria-label={`Destino de ${bloco.rotulo}`}>
                {cartoesAtivos.map((c) => (
                  <button
                    key={c.id}
                    className={destinoBlocos[i] === c.id ? 'ativo' : ''}
                    onClick={() => setDestinoBlocos((d) => ({ ...d, [i]: c.id }))}
                  >{c.nome}</button>
                ))}
                <button
                  className={destinoBlocos[i] === NAO_IMPORTAR ? 'ativo' : ''}
                  onClick={() => setDestinoBlocos((d) => ({ ...d, [i]: NAO_IMPORTAR }))}
                >Não importar</button>
              </div>
            </div>
          ))}
          <p className="sub">Nada é gravado até você confirmar no passo 3.</p>
        </section>
      )}

      {temConferencia && (
        <>
          <div className="secao">
            <h3>3. Conferir</h3>
            {itensComContexto.length > 0 && (
              <button type="button" className="acao" onClick={marcarTodosComoIgnorar}>
                Marcar todos como ignorar
              </button>
            )}
          </div>
          <ListaConferencia
            leitura={leitura!}
            itens={itensComContexto}
            dados={dados}
            trocas={trocas}
            onTrocar={(chave, estado, acao) => setTrocas((t) => ({ ...t, [chave]: { estado, acao } }))}
            totaisCorrigidos={totaisCorrigidos}
            onCorrigirTotal={(chave, estado, v) => setTotaisCorrigidos((t) => ({ ...t, [chave]: { estado, valorCent: v } }))}
          />
          <div className="importar-rodape">
            {erroAplicar && <p className="aviso">{erroAplicar}</p>}
            <button className="botao botao-primario" disabled={!podeConfirmar} onClick={() => void confirmar()}>
              {aplicando ? 'Aplicando…' : `Confirmar — ${mudancas} mudanças`}
            </button>
            <p className="sub">{semMudanca} itens não geram mudança.</p>
          </div>
        </>
      )}
    </div>
  );
}
