import { useId, useMemo, useRef, useState } from 'react';
import { ADAPTERS, detectarAdapter } from '../../importar/adapters';
import { aplicar, type ContextoAplicar, type ResumoAplicacao } from '../../importar/aplicar';
import {
  CATEGORIA_A_CLASSIFICAR, acaoEfetiva, chaveDoItem, conferir, dataCorrigidaValida, dataEfetiva, totalCorrigidoValido, totalEfetivo,
  type OpcoesConferencia,
} from '../../importar/conferencia';
import type {
  Adapter, EstadoItem, ItemConferencia, LancamentoBruto,
} from '../../importar/tipos';
import type { ID } from '../../domain/types';
import { boxIdConcreta, IMPORTACAO_VAZIA, useApp, type DestinoBloco } from '../../state/store';
import EscolherArquivo from '../EscolherArquivo';
import ListaConferencia, { type ItemComContexto } from './ListaConferencia';

const NAO_IMPORTAR = 'nao-importar' as const;

export default function Importar() {
  const { dados, boxSel, recarregar, importacao, setImportacao, limparImportacao } = useApp();
  const {
    nomeArquivo, buf, adapterAtual, leitura, boxIdEscolhida, destinoBlocos, trocas,
    totaisCorrigidos, datasCorrigidas, filtro,
  } = importacao;
  const uid = useId();
  // Trava síncrona contra o duplo toque: `aplicando` (estado) só vale depois do re-render, e
  // dois cliques seguidos acontecem antes disso. Sem esta ref, os dois disparam `aplicar`.
  const aplicandoRef = useRef(false);

  // O arquivo lido e as decisões vivem no store (`importacao`), para sobreviver à troca de aba.
  // Aqui ficam só os estados passageiros da tela.
  const [escolhendoFormato, setEscolhendoFormato] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');

  // `filtro` é o filtro de exibição do resumo do passo 3 (pílula tocada) — nunca muda o que
  // `confirmar` grava, só o que aparece na lista. Trocar destino ou arquivo limpa o filtro.
  const setFiltro = (v: EstadoItem | null) => setImportacao(() => ({ filtro: v }));
  const setDestinoBloco = (i: number, destino: DestinoBloco) => setImportacao((im) => ({
    destinoBlocos: { ...im.destinoBlocos, [i]: destino }, filtro: null,
  }));

  const [resumoAplicado, setResumoAplicado] = useState<ResumoAplicacao | null>(null);
  const [erroAplicar, setErroAplicar] = useState('');
  const [aplicando, setAplicando] = useState(false);

  // Estado do botão "Copiar texto extraído" e da lista de linhas não reconhecidas: os dois só
  // existem para diagnóstico, quando o arquivo tem alguma linha ignorada.
  const [copiarEstado, setCopiarEstado] = useState<'ocioso' | 'copiado' | 'erro'>('ocioso');
  const [mostrarLinhasIgnoradas, setMostrarLinhasIgnoradas] = useState(false);

  // Na visão consolidada ('casa'), qualquer cartão ativo entra — é ali que o usuário olha
  // tudo e precisa poder escolher qualquer um. Numa box específica, só os cartões dela: do
  // contrário, o passo 2 oferecia cartão de outra box como destino (defeito relatado).
  const cartoesAtivos = useMemo(() => {
    const ativos = (dados?.cartoes ?? []).filter((c) => c.ativo);
    if (!dados || boxSel === 'casa') return ativos;
    return ativos.filter((c) => c.boxId === boxSel);
  }, [dados, boxSel]);

  const itensComContexto: ItemComContexto[] = useMemo(() => {
    if (!leitura || !dados) return [];
    if (leitura.blocos) {
      // Um cartão pode receber mais de um bloco (titular e adicionais na mesma fatura). A
      // conferência roda UMA vez por cartão, com os brutos de todos os blocos dele: rodar por
      // bloco fazia a compra casada num bloco virar "sobra" no outro, e repetia a mesma
      // sobra (mesma chave) em cada bloco.
      const brutosPorCartao = new Map<ID, LancamentoBruto[]>();
      leitura.blocos.forEach((bloco, i) => {
        const destino = destinoBlocos[i];
        if (!destino || destino === NAO_IMPORTAR) return;
        brutosPorCartao.set(destino, [...(brutosPorCartao.get(destino) ?? []), ...bloco.brutos]);
      });
      return [...brutosPorCartao].flatMap(([cartaoId, brutos]) => {
        const cartao = dados.cartoes.find((c) => c.id === cartaoId);
        if (!cartao) return [];
        const opcoes: OpcoesConferencia = {
          boxId: cartao.boxId,
          cartaoId: cartao.id,
          categoriasPadrao: { ganho: CATEGORIA_A_CLASSIFICAR.ganho, gasto: CATEGORIA_A_CLASSIFICAR.gasto },
          categoriaCartaoPadraoId: CATEGORIA_A_CLASSIFICAR.cartao,
        };
        return conferir(brutos, dados, opcoes)
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

  // O botão Confirmar sempre olha TODOS os itens, filtrados ou não — o filtro é só de
  // exibição (regra da spec: filtrar não pode dar a impressão de que grava menos).
  const mudancas = itensComContexto
    .filter((ic) => acaoEfetiva(ic.item, trocas[ic.chave]).tipo !== 'ignorar').length;
  const semMudanca = itensComContexto.length - mudancas;
  const podeConfirmar = destinoCompleto && mudancas > 0 && !aplicando;

  const itensVisiveis = filtro
    ? itensComContexto.filter((ic) => ic.item.estado === filtro)
    : itensComContexto;

  if (!dados) return null;

  function limparTudo() {
    limparImportacao(); setEscolhendoFormato(false);
    setLendo(false); setErro('');
    setResumoAplicado(null); setErroAplicar('');
    setCopiarEstado('ocioso'); setMostrarLinhasIgnoradas(false);
  }

  /** Copia o texto que o pdf.js extraiu, só para diagnóstico — não é lido de volta pelo app.
   *  O rótulo do botão muda por alguns segundos para confirmar a cópia. */
  async function copiarTextoExtraido(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiarEstado('copiado');
      setTimeout(() => setCopiarEstado('ocioso'), 3000);
    } catch {
      setCopiarEstado('erro');
    }
  }

  async function lerComAdapter(adapter: Adapter, conteudo: ArrayBuffer) {
    setImportacao(() => ({ adapterAtual: adapter, trocas: {}, totaisCorrigidos: {}, datasCorrigidas: {}, filtro: null }));
    setEscolhendoFormato(false);
    setLendo(true);
    setErro('');
    setCopiarEstado('ocioso'); setMostrarLinhasIgnoradas(false);
    try {
      const r = await adapter.ler(conteudo);
      const destinos: Record<number, DestinoBloco> = {};
      // Mesma lista do passo 2 (`cartoesAtivos`, já filtrada pela box selecionada): a
      // pré-seleção só acontece quando ela sobra com exatamente um cartão elegível.
      (r.blocos ?? []).forEach((_, i) => {
        destinos[i] = cartoesAtivos.length === 1 ? cartoesAtivos[0].id : undefined;
      });
      setImportacao(() => ({
        leitura: r, boxIdEscolhida: boxIdConcreta(boxSel), destinoBlocos: destinos,
      }));
    } catch (e) {
      setImportacao(() => ({ leitura: null }));
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
    setImportacao(() => ({ ...IMPORTACAO_VAZIA, nomeArquivo: file.name, buf: conteudo }));
    setResumoAplicado(null);
    setErroAplicar('');
    const adapter = detectarAdapter(file.name, inicio);
    if (adapter) {
      await lerComAdapter(adapter, conteudo);
    } else {
      setEscolhendoFormato(true);
    }
  }

  function escolherFormatoManualmente(adapter: Adapter) {
    if (!buf) return;
    void lerComAdapter(adapter, buf);
  }

  /** Marca para ignorar os itens visíveis — inclusive os que já tinham outra decisão. Sem
   *  filtro, "visíveis" é a lista inteira; com filtro, só o estado escolhido no resumo. É um
   *  jeito rápido de "esvaziar" a conferência antes de escolher, item a item, o que entra. */
  function marcarTodosComoIgnorar() {
    setImportacao((im) => {
      const novo = { ...im.trocas };
      for (const ic of itensVisiveis) novo[ic.chave] = { estado: ic.item.estado, acao: { tipo: 'ignorar' } };
      return { trocas: novo };
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
      // Junta a ação final de cada item (default ou trocada) e, se houve correção do total ou da
      // data estimada de uma parcelada reconstruída, aplica antes de gravar — só quando válida.
      const finais: ItemConferencia[] = itensComContexto.map((ic) => {
        const acao = acaoEfetiva(ic.item, trocas[ic.chave]);
        const totalCorrigido = totalCorrigidoValido(ic.item, totalEfetivo(ic.item, totaisCorrigidos[ic.chave]));
        const dataCorrigida = dataCorrigidaValida(ic.item, dataEfetiva(ic.item, datasCorrigidas[ic.chave]));
        let compraReconstruida = ic.item.compraReconstruida;
        if (compraReconstruida && totalCorrigido != null) {
          compraReconstruida = { ...compraReconstruida, valorTotalCent: totalCorrigido };
        }
        if (compraReconstruida && dataCorrigida != null) {
          compraReconstruida = { ...compraReconstruida, data: dataCorrigida };
        }
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
            <EscolherArquivo
              id={`${uid}-arquivo`} accept=".csv,.pdf" primario rotulo="Escolher arquivo"
              onEscolher={(f) => void onArquivoEscolhido(f)}
            />
            <p className="sub">
              Escolha o CSV do extrato do Nubank, o CSV da fatura do cartão Nubank ou o PDF da fatura do Santander — outros
              bancos ainda não são lidos. Nada é gravado até você conferir e confirmar.
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
                      : 'Formato não reconhecido. Esperado: o CSV do extrato da conta Nubank, o CSV da fatura do cartão Nubank ou o PDF da fatura do Santander.'}
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
                    role="radio" aria-checked={adapterAtual?.id === a.id}
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
          {leitura!.linhasIgnoradas > 0 && (
            <p className="sub">{leitura!.linhasIgnoradas} linhas não foram reconhecidas.</p>
          )}
          {leitura!.linhasNaoReconhecidas && leitura!.linhasNaoReconhecidas.length > 0 && (
            <>
              <button
                type="button" className="botao"
                onClick={() => setMostrarLinhasIgnoradas((v) => !v)}
              >
                {mostrarLinhasIgnoradas ? 'Ocultar linhas não reconhecidas' : 'Ver linhas não reconhecidas'}
              </button>
              {mostrarLinhasIgnoradas && (
                <div className="lista">
                  {leitura!.linhasNaoReconhecidas.map((linha, i) => (
                    <div className="item" key={i}><p className="sub">{linha}</p></div>
                  ))}
                </div>
              )}
            </>
          )}
          {leitura!.textoExtraido && (leitura!.linhasIgnoradas > 0 || zeroBrutos) && (
            <>
              <button
                type="button" className="botao"
                onClick={() => void copiarTextoExtraido(leitura!.textoExtraido!)}
              >
                {copiarEstado === 'copiado' ? 'Copiado' : 'Copiar texto extraído'}
              </button>
              <p className="sub">O texto contém os dados da sua fatura. Use só para diagnóstico.</p>
              {copiarEstado === 'erro' && <p className="sub">Não foi possível copiar.</p>}
            </>
          )}
        </section>
      )}

      {temConferencia && !leitura!.blocos && (
        <section className="card">
          <div className="secao"><h3>2. Destino</h3></div>
          <div className="pills" role="radiogroup" aria-label="Box de destino">
            {dados.boxes.filter((b) => b.saldoInicial !== null).map((b) => (
              <button
                key={b.id}
                role="radio" aria-checked={boxIdEscolhida === b.id}
                className={boxIdEscolhida === b.id ? 'ativo' : ''}
                onClick={() => setImportacao(() => ({ boxIdEscolhida: b.id, filtro: null }))}
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
                    role="radio" aria-checked={destinoBlocos[i] === c.id}
                    className={destinoBlocos[i] === c.id ? 'ativo' : ''}
                    onClick={() => setDestinoBloco(i, c.id)}
                  >{c.nome}</button>
                ))}
                <button
                  role="radio" aria-checked={destinoBlocos[i] === NAO_IMPORTAR}
                  className={destinoBlocos[i] === NAO_IMPORTAR ? 'ativo' : ''}
                  onClick={() => setDestinoBloco(i, NAO_IMPORTAR)}
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
                {filtro ? 'Marcar os visíveis como ignorar' : 'Marcar todos como ignorar'}
              </button>
            )}
          </div>
          <ListaConferencia
            leitura={leitura!}
            itens={itensComContexto}
            dados={dados}
            trocas={trocas}
            onTrocar={(chave, estado, acao) => setImportacao((im) => ({
              trocas: { ...im.trocas, [chave]: { estado, acao } },
            }))}
            totaisCorrigidos={totaisCorrigidos}
            onCorrigirTotal={(chave, estado, v) => setImportacao((im) => ({
              totaisCorrigidos: { ...im.totaisCorrigidos, [chave]: { estado, valorCent: v } },
            }))}
            datasCorrigidas={datasCorrigidas}
            onCorrigirData={(chave, estado, data) => setImportacao((im) => {
              const novo = { ...im.datasCorrigidas };
              if (data) novo[chave] = { estado, data };
              else delete novo[chave];
              return { datasCorrigidas: novo };
            })}
            mostrarLinhasIgnoradas={mostrarLinhasIgnoradas}
            onToggleLinhasIgnoradas={() => setMostrarLinhasIgnoradas((v) => !v)}
            copiarEstado={copiarEstado}
            onCopiarTextoExtraido={(texto) => void copiarTextoExtraido(texto)}
            filtro={filtro}
            onFiltroChange={setFiltro}
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
