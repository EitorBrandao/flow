import { Fragment, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as repo from '../db/repo';
import { bancosDaBox, saldoCalculadoBanco, totalDeclaradoCent } from '../domain/bancos';
import { addDias, formatarDataBR } from '../domain/dates';
import { estadoBackup, SUFIXO_MUDANCAS_BACKUP } from '../domain/estadoBackup';
import { classeEfeito, classeSaldo, efeitoNoSaldo, formatarBRL, formatarSaldo } from '../domain/money';
import { notaExibivel } from '../domain/notas';
import type { Banco, Box, Dados, ISODate, Lancamento } from '../domain/types';
import { ANTECEDENCIA_PENDENTE_DIAS, pendentes, projetarBoxes } from '../domain/projection';
import { boxIdsSelecionadas, cenariosLigados, estadoPrimeiroUso, useApp } from '../state/store';
import BalanceChart from './BalanceChart';
import { useModo } from './useModo';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import PrimeiroUso from './PrimeiroUso';
import { PagamentoFaturaSheetModal } from './PagamentoFaturaSheet';

// NOTA DE PATCH (nível 1 — docs/estilo/nivel-1-editar-tela.md): a tela ganhou 3 abas
// internas (Visão/Conferir/Pendentes) via `.pills`, classe já catalogada — nenhuma classe
// nova, nenhum toque em styles.css. Objetivo: reduzir o que fica visível de uma vez sem
// esconder nada de vez (tudo continua a um toque).
type AbaHoje = 'visao' | 'conferir' | 'pendentes';

/** Um pendente que é fatura de cartão — tem cartão dono e mês de fatura, e por isso pode ser
 *  pago parcialmente/parcelado em vez de só confirmado. */
function ehFatura(l: Lancamento): boolean {
  return l.origem === 'cartao' && l.cartaoId != null && l.faturaMes != null;
}

function ConferenciaSaldo({ saldoApp, declaradoCent, dataDeclarado, hoje, onSalvar, simples = false }: {
  saldoApp: number;
  declaradoCent: number | null;
  dataDeclarado: ISODate | null;
  hoje: ISODate;
  onSalvar: (cents: number, data: ISODate) => Promise<void>;
  /** Modo Simples: sem o botão de sinal (cheque especial). */
  simples?: boolean;
}) {
  const [magnitude, setMagnitude] = useState(Math.abs(declaradoCent ?? 0));
  const [negativo, setNegativo] = useState((declaradoCent ?? 0) < 0);
  const [data, setData] = useState(dataDeclarado ?? hoje);
  const uid = useId();

  async function salvar() {
    const valor = negativo ? -magnitude : magnitude;
    await onSalvar(valor, data);
  }

  const diff = declaradoCent != null ? declaradoCent - saldoApp : null;

  return (
    <div className="conferencia-saldo">
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <div className="campo">
          <label htmlFor={`${uid}-saldo`}>Saldo real no banco</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {!simples && (
              <button type="button" className="botao botao-sinal" aria-label="Alternar sinal (positivo/negativo)" onClick={() => setNegativo(n => !n)}>
                {negativo ? '−' : '+'}
              </button>
            )}
            <CampoValor id={`${uid}-saldo`} valorCentavos={magnitude} onChange={setMagnitude} style={{ width: 110 }} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
        </div>
        <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={salvar}>Salvar</button>
      </div>
      <TotalFlow saldoApp={saldoApp} />
      {diff != null && (
        <p className="sub" style={{ margin: '4px 0 0' }}>
          <Diferenca diff={diff} />
          {dataDeclarado ? ` · conferido em ${formatarDataBR(dataDeclarado)}` : ''}
        </p>
      )}
    </div>
  );
}

/** O outro lado da conta da conferência: o saldo que o Flow calcula para hoje. Sempre
 *  visível, mesmo antes de a pessoa informar um valor — só a diferença depende disso. */
function TotalFlow({ saldoApp }: { saldoApp: number }) {
  return (
    <div className="total">
      <span>Total calculado no Flow</span>
      <span className={classeSaldo(saldoApp)}>{formatarSaldo(saldoApp)}</span>
    </div>
  );
}

/** Resultado da conferência, compartilhado pelas duas variantes (saldo único e por banco).
 *  `diff` é banco − app; o valor exibido é do ponto de vista do app (app − banco), sem sinal:
 *  vermelho quando falta lançar, verde quando sobra. */
function Diferenca({ diff }: { diff: number }) {
  if (diff === 0) return <>Bate certinho.</>;
  const doApp = -diff;
  return doApp < 0 ? (
    <>Diferença: <strong className="valor-gasto">{formatarBRL(doApp)}</strong> — falta inserir no app</>
  ) : (
    <>Diferença: <strong className="valor-ganho">{formatarBRL(doApp)}</strong> — sobra no app (confira duplicado ou algo não confirmado no banco)</>
  );
}

/** Um grupo de bancos: sem box quando a seleção é uma única box (lista plana), com box
 *  quando é 'casa' (agrupado, mesmo padrão do `LancamentosSheet`: `.rotulo-grupo` + `.recuo-1`). */
interface GrupoBancos { box: Box | null; itens: Banco[] }

/** Resumo da transferência: nome e saldo calculado (antes e depois) dos dois bancos. `null` é banco
 *  sem saldo informado. */
interface ResumoTransferencia {
  origem: { nome: string; antes: number | null; depois: number | null };
  destino: { nome: string; antes: number | null; depois: number | null };
}

/** Saldo calculado de um banco, ou `não informado` quando o banco não tem saldo declarado. */
function SaldoDoBanco({ valor }: { valor: number | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, marginTop: 2 }}>
      <span className="sub">saldo</span>
      {valor == null
        ? <span className="sub">não informado</span>
        : <strong className={'total-dia ' + classeSaldo(valor)}>{formatarSaldo(valor)}</strong>}
    </div>
  );
}

function SaldoResumo({ valor }: { valor: number | null }) {
  return valor == null
    ? <span>—</span>
    : <strong className={'total-dia ' + classeSaldo(valor)}>{formatarSaldo(valor)}</strong>;
}

/** Formulário embutido na aba Conferir: move dinheiro entre dois bancos da mesma box, criando os
 *  dois lançamentos ligados (`repo.transferirEntreBancos`). Só é aberto quando a box tem 2+ bancos.
 *  Origem e destino iguais desabilitam a confirmação, com aviso. */
function FormTransferencia({ bancos, origemInicialId, hoje, dados, onFeito, onCancelar, onSucesso }: {
  bancos: Banco[];
  origemInicialId: string;
  hoje: ISODate;
  dados: Dados;
  onFeito: () => Promise<void>;
  onCancelar: () => void;
  onSucesso: (res: ResumoTransferencia) => void;
}) {
  const { recarregar } = useApp();
  const [origemId, setOrigemId] = useState(origemInicialId);
  const [destinoId, setDestinoId] = useState(
    bancos.find((b) => b.id !== origemInicialId)?.id ?? origemInicialId
  );
  const [valor, setValor] = useState(0);
  const [data, setData] = useState<ISODate>(hoje);
  const uid = useId();

  const origem = bancos.find((b) => b.id === origemId);
  const destino = bancos.find((b) => b.id === destinoId);

  const ehMesmoBanco = origemId === destinoId;
  const podeConfirmar = valor > 0 && !ehMesmoBanco && !!origem && !!destino;

  async function confirmar() {
    if (!podeConfirmar || !origem || !destino) return;
    const origemAntes = saldoCalculadoBanco(origem, dados);
    const destinoAntes = saldoCalculadoBanco(destino, dados);

    await repo.transferirEntreBancos(origemId, destinoId, valor, data);
    await recarregar();

    const atualizados = useApp.getState().dados ?? dados;
    const origemAtual = atualizados.bancos.find((b) => b.id === origem.id) ?? origem;
    const destinoAtual = atualizados.bancos.find((b) => b.id === destino.id) ?? destino;
    onSucesso({
      origem: { nome: origem.nome, antes: origemAntes, depois: saldoCalculadoBanco(origemAtual, atualizados) },
      destino: { nome: destino.nome, antes: destinoAntes, depois: saldoCalculadoBanco(destinoAtual, atualizados) },
    });
    await onFeito();
  }

  return (
    <div className="item item-coluna" style={{ background: 'transparent', padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'end' }}>
        <div className="campo">
          <label htmlFor={`${uid}-de`}>De</label>
          <select id={`${uid}-de`} value={origemId} onChange={(e) => setOrigemId(e.target.value)}>
            {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
          {origem && <SaldoDoBanco valor={saldoCalculadoBanco(origem, dados)} />}
        </div>
        <span className="sub" style={{ paddingBottom: 14 }} aria-hidden="true">→</span>
        <div className="campo">
          <label htmlFor={`${uid}-para`}>Para</label>
          <select id={`${uid}-para`} value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
            {bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </select>
          {destino && <SaldoDoBanco valor={saldoCalculadoBanco(destino, dados)} />}
        </div>
      </div>
      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
        </div>
      </div>
      <div className="acoes">
        <button className="botao botao-primario" disabled={!podeConfirmar} onClick={confirmar}>Confirmar transferência</button>
        <button className="botao" onClick={onCancelar}>Cancelar</button>
      </div>
      {ehMesmoBanco && (
        <p className="aviso">Escolha dois bancos diferentes.</p>
      )}
    </div>
  );
}

function ConferenciaBancos({ bancos, boxes, agruparPorBox, saldoApp, hoje, onSalvarBancos, onTransferir, dados }: {
  bancos: Banco[];
  boxes: Box[];
  agruparPorBox: boolean;
  saldoApp: number;
  hoje: ISODate;
  onSalvarBancos: (mudancas: { id: string; cents: number }[], data: ISODate) => Promise<void>;
  onTransferir: () => Promise<void>;
  dados: Dados;
}) {
  const [magnitudes, setMagnitudes] = useState<Record<string, number>>(
    () => Object.fromEntries(bancos.map((b) => [b.id, Math.abs(b.saldoDeclaradoCent ?? 0)])),
  );
  const [negativos, setNegativos] = useState<Record<string, boolean>>(
    () => Object.fromEntries(bancos.map((b) => [b.id, (b.saldoDeclaradoCent ?? 0) < 0])),
  );
  const editados = useRef<Set<string>>(new Set());
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [sucesso, setSucesso] = useState<ResumoTransferencia | null>(null);

  function mudarValor(id: string, v: number) {
    setMagnitudes((atual) => ({ ...atual, [id]: v }));
    editados.current.add(id);
  }

  function alternarSinal(id: string) {
    setNegativos((atual) => ({ ...atual, [id]: !atual[id] }));
    editados.current.add(id);
  }

  async function salvar() {
    const mudancas = bancos
      .filter((b) => editados.current.has(b.id))
      .map((b) => {
        const magnitude = magnitudes[b.id] ?? 0;
        return { id: b.id, cents: negativos[b.id] ? -magnitude : magnitude };
      })
      .filter(({ id, cents }) => bancos.find((b) => b.id === id)?.saldoDeclaradoCent !== cents);
    if (mudancas.length === 0) return;
    await onSalvarBancos(mudancas, hoje);
  }

  const totalCent = totalDeclaradoCent(bancos);
  const diff = totalCent != null ? totalCent - saldoApp : null;

  const grupos: GrupoBancos[] = agruparPorBox
    ? boxes
      .map((box) => ({ box, itens: bancos.filter((b) => b.boxId === box.id) }))
      .filter((g) => g.itens.length > 0)
    : [{ box: null, itens: bancos }];

  return (
    <div className="conferencia-bancos">
      <p className="rotulo-grupo">Saldo real em cada banco</p>
      {grupos.map((g) => (
        <div key={g.box?.id ?? 'unico'}>
          {agruparPorBox && g.box && <p className="rotulo-grupo">{g.box.nome}</p>}
          {g.itens.map((b) => (
            <div key={b.id} className={`linha-banco${agruparPorBox ? ' recuo-1' : ''}`}>
              <span>{b.nome}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button" className="botao botao-sinal" aria-label="Alternar sinal (positivo/negativo)"
                  onClick={() => alternarSinal(b.id)}
                >
                  {negativos[b.id] ? '−' : '+'}
                </button>
                <CampoValor
                  id={`banco-${b.id}`} valorCentavos={magnitudes[b.id] ?? 0}
                  onChange={(v) => mudarValor(b.id, v)}
                  ariaLabel={b.nome} style={{ width: 110 }}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
      {!agruparPorBox && bancos.length > 1 && !formularioAberto && !sucesso && (
        <button className="botao" style={{ alignSelf: 'flex-start', marginTop: 12 }} onClick={() => setFormularioAberto(true)}>
          Transferir entre bancos
        </button>
      )}
      {formularioAberto && (
        <FormTransferencia
          bancos={bancos}
          origemInicialId={bancos[0]?.id ?? ''}
          hoje={hoje}
          dados={dados}
          onFeito={async () => { setFormularioAberto(false); await onTransferir(); }}
          onCancelar={() => setFormularioAberto(false)}
          onSucesso={setSucesso}
        />
      )}
      {sucesso && (
        <div className="item item-coluna" style={{ background: 'transparent', padding: 0 }}>
          <p className="aviso aviso-sucesso">Transferência feita ✓</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '6px 10px', alignItems: 'baseline' }}>
            <span />
            <span className="sub">antes</span>
            <span />
            <span className="sub">depois</span>
            {[sucesso.origem, sucesso.destino].map((r, i) => (
              <Fragment key={i}>
                <span className="sub">{r.nome}</span>
                <SaldoResumo valor={r.antes} />
                <span className="sub" aria-hidden="true">→</span>
                <SaldoResumo valor={r.depois} />
              </Fragment>
            ))}
          </div>
          <div className="acoes">
            <button className="botao botao-primario" onClick={() => setSucesso(null)}>Fechar</button>
          </div>
        </div>
      )}
      <div className="total">
        <span>Total informado</span>
        <span className={totalCent != null ? classeSaldo(totalCent) : undefined}>{totalCent != null ? formatarSaldo(totalCent) : '—'}</span>
      </div>
      <TotalFlow saldoApp={saldoApp} />
      {diff == null ? (
        <p className="sub" style={{ margin: '4px 0 0' }}>Informe o saldo de ao menos um banco para conferir.</p>
      ) : (
        <p className="sub" style={{ margin: '4px 0 0' }}><Diferenca diff={diff} /></p>
      )}
      <button className="botao" style={{ alignSelf: 'flex-start' }} onClick={salvar}>Salvar conferência dos bancos</button>
    </div>
  );
}

export default function TelaHoje() {
  const { dados, boxSel, hoje, recarregar, abrirAjustes, abrirFluxo } = useApp();
  const simples = useModo('hoje') === 'simples';
  const [pagando, setPagando] = useState<Lancamento | null>(null);
  const [avisoSalvarBancos, setAvisoSalvarBancos] = useState<string | null>(null);
  const [abaHoje, setAbaHoje] = useState<AbaHoje>('visao');
  // Id do pendente com a correção aberta — um por vez, para a fila não virar um formulário
  // com vários campos abertos ao mesmo tempo.
  const [corrigindo, setCorrigindo] = useState<string | null>(null);
  const [valorCorrigido, setValorCorrigido] = useState(0);
  const [dataCorrigida, setDataCorrigida] = useState<ISODate>(hoje);
  const ids = dados ? boxIdsSelecionadas(dados, boxSel) : [];
  const ligados = dados ? cenariosLigados(dados) : new Set<string>();

  const serie = useMemo(
    () => dados ? projetarBoxes(ids, {
      boxes: dados.boxes, categorias: dados.categorias, lancamentos: dados.lancamentos,
      cenariosLigados: ligados, horizonte: dados.config.horizonteProjecao,
    }) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, boxSel],
  );
  if (!dados) return null;

  const deHoje = serie.filter((s) => s.data <= hoje).at(-1);
  const janela = serie.filter((s) => s.data >= addDias(hoje, -7) && s.data <= addDias(hoje, 28));
  const fila = pendentes(dados.lancamentos.filter((l) => ids.includes(l.boxId)), hoje);
  const nomeCat = (id: string) => dados.categorias.find((c) => c.id === id)?.nome ?? '?';
  const tipoCat = (id: string) => dados.categorias.find((c) => c.id === id)?.tipo ?? 'gasto';

  const backup = estadoBackup(dados.config, hoje);
  const classeBackup = backup.nivel === 'neutro' ? 'backup-rodape backup-rodape-neutro'
    : backup.nivel === 'aviso' ? 'backup-rodape aviso'
    : 'backup-rodape aviso aviso-urgente';

  const boxAtual = boxSel !== 'casa' ? dados.boxes.find((b) => b.id === boxSel) : undefined;
  const declaradoCent = (boxSel === 'casa' ? dados.config.saldoDeclaradoCent : boxAtual?.saldoDeclaradoCent) ?? null;
  const dataDeclarado = (boxSel === 'casa' ? dados.config.dataSaldoDeclarado : boxAtual?.dataSaldoDeclarado) ?? null;
  const bancos = bancosDaBox(dados.bancos, ids);
  const chaveBancos = bancos.map((b) => b.id).join(',');

  async function salvarSaldoReal(cents: number, data: string) {
    if (boxSel === 'casa') await repo.salvarConfig({ saldoDeclaradoCent: cents, dataSaldoDeclarado: data });
    else if (boxAtual) await repo.salvarBox({ ...boxAtual, saldoDeclaradoCent: cents, dataSaldoDeclarado: data });
    await recarregar();
  }

  async function salvarSaldosBancos(mudancas: { id: string; cents: number }[], data: string) {
    setAvisoSalvarBancos(null);
    try {
      await Promise.all(
        mudancas.map(({ id, cents }) => repo.atualizarBanco(id, { saldoDeclaradoCent: cents, dataSaldoDeclarado: data })),
      );
    } catch {
      setAvisoSalvarBancos('Nem tudo foi salvo — confira os valores e tente novamente.');
    } finally {
      await recarregar();
    }
  }

  function abrirCorrecao(l: Lancamento) {
    setCorrigindo(l.id);
    setValorCorrigido(Math.abs(l.valor));
    setDataCorrigida(l.data);
  }

  // O campo edita a magnitude; o sinal vem do previsto original, para um estorno negativo não
  // virar positivo em silêncio. Trocar o sinal continua sendo trabalho do LancEditor.
  async function confirmarCorrigido(l: Lancamento) {
    const valor = l.valor < 0 ? -valorCorrigido : valorCorrigido;
    setCorrigindo(null);
    await repo.confirmarPendente(l.id, valor, dataCorrigida);
    await recarregar();
  }

  async function confirmar(id: string) {
    await repo.confirmarPendente(id);
    await recarregar();
  }
  async function descartar(id: string) {
    if (!window.confirm('Descartar este previsto?')) return;
    await repo.excluirLancamento(id);
    await recarregar();
  }

  const totalDaFaturaPendente = pagando?.valor ?? 0;

  const { precisa: primeiroUso } = estadoPrimeiroUso(dados);

  return (
    <div className="tela">
      {/* As abas ficam sempre disponíveis, mesmo no primeiro uso: um cartão de fatura pode
          já estar pendente antes de o usuário terminar de cadastrar categorias, e ele precisa
          continuar alcançável (era assim antes das abas — só a Visão trocava de conteúdo). */}
      <div className="pills" role="tablist" aria-label="Seções de Hoje">
        <button role="tab" aria-selected={abaHoje === 'visao'} className={abaHoje === 'visao' ? 'ativo' : ''} onClick={() => setAbaHoje('visao')}>Visão</button>
        <button role="tab" aria-selected={abaHoje === 'conferir'} className={abaHoje === 'conferir' ? 'ativo' : ''} onClick={() => setAbaHoje('conferir')}>Conferir</button>
        <button role="tab" aria-selected={abaHoje === 'pendentes'} className={abaHoje === 'pendentes' ? 'ativo' : ''} onClick={() => setAbaHoje('pendentes')}>Pendentes · {fila.length}</button>
      </div>

      {abaHoje === 'visao' && (
        primeiroUso ? (
          <PrimeiroUso />
        ) : (
          <>
            <div className="card">
              <p className="rotulo" style={{ margin: 0 }}>
                Saldo hoje · {boxSel === 'casa' ? 'casa' : dados.boxes.find((b) => b.id === boxSel)?.nome}
              </p>
              {(() => {
                const saldoHoje = deHoje?.saldoEfetivo ?? 0;
                const [reais, centavos] = formatarSaldo(saldoHoje).split(',');
                return (
                  <p className={`saldo-grande${saldoHoje < 0 ? ' negativo' : ''}`} style={{ margin: '4px 0' }}>
                    {reais}<b>,{centavos}</b>
                  </p>
                );
              })()}
              {(() => {
                const fim = janela.at(-1);
                const delta = fim && deHoje ? fim.saldoProjetado - deHoje.saldoEfetivo : null;
                if (delta == null || delta === 0) return null;
                return (
                  <span className={`delta ${delta > 0 ? 'pos' : 'neg'}`}>
                    {formatarBRL(delta)} nos próximos 28 dias
                  </span>
                );
              })()}
              {deHoje && deHoje.saldoProjetado !== deHoje.saldoEfetivo && (
                <p className="sub" style={{ margin: 0 }}>
                  projetado: <strong className={classeSaldo(deHoje.saldoProjetado)}>
                    {formatarSaldo(deHoje.saldoProjetado)}
                  </strong>
                </p>
              )}
              <BalanceChart serie={janela} hoje={hoje} altura={120} mostrarCenarios={ligados.size > 0} />
              {/* mesma condição do BalanceChart, que não desenha com menos de 2 dias */}
              {janela.length >= 2 && (
                <button type="button" className="botao-ver-mais" style={{ marginTop: 10 }} onClick={() => abrirFluxo('grafico')}>
                  Ver gráfico completo na aba Fluxo →
                </button>
              )}
            </div>
            {/* Sem nenhum lançamento não há o que salvar: o rodapé só assustaria quem chegou agora. */}
            {/* No Simples o rodapé só aparece quando o backup passou do limite vermelho. */}
            {dados.lancamentos.length > 0 && (!simples || backup.nivel === 'urgente') && (
              <button type="button" className={classeBackup} onClick={() => abrirAjustes('backup')}>
                Último backup: {backup.idade}{dados.config.mudancasDesdeBackup && SUFIXO_MUDANCAS_BACKUP}
              </button>
            )}
          </>
        )
      )}

      {abaHoje === 'conferir' && (
        <div className="card">
          <p className="sub" style={{ margin: '0 0 12px' }}>
            Digite o saldo que o app do banco mostra e toque em Salvar. O Flow compara com o total que ele calculou e diz se bate.
          </p>
          {simples || bancos.length === 0 ? (
            <ConferenciaSaldo key={boxSel} saldoApp={deHoje?.saldoEfetivo ?? 0} declaradoCent={declaradoCent}
              dataDeclarado={dataDeclarado} hoje={hoje} onSalvar={salvarSaldoReal} simples={simples} />
          ) : (
            <ConferenciaBancos key={`${boxSel}-${chaveBancos}`} bancos={bancos} boxes={dados.boxes}
              agruparPorBox={boxSel === 'casa'} saldoApp={deHoje?.saldoEfetivo ?? 0} hoje={hoje}
              onSalvarBancos={salvarSaldosBancos} onTransferir={recarregar} dados={dados} />
          )}
          {/* Embaixo, depois do Salvar — mesma posição de todo aviso de validação. */}
          {avisoSalvarBancos && <p className="aviso">{avisoSalvarBancos}</p>}
        </div>
      )}

      {abaHoje === 'pendentes' && (
        <div className="lista">
          <AnimatePresence initial={false}>
            {fila.map((l) => (
              <motion.div
                className="item item-coluna" key={l.id} layout
                exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                style={{ overflow: 'hidden' }}
                transition={{ duration: 0.18 }}
              >
                <div className="linha-topo">
                  <div className="cresce">
                    <div>
                      {nomeCat(l.categoriaId)}
                      {l.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
                    </div>
                    {(() => {
                      const nota = notaExibivel(l.nota, nomeCat(l.categoriaId));
                      return <div className="sub">{l.data.split('-').reverse().join('/')}{nota ? ` · ${nota}` : ''}</div>;
                    })()}
                  </div>
                  {ehFatura(l) ? (
                    <span className={classeEfeito(efeitoNoSaldo(l.valor, tipoCat(l.categoriaId)))}>
                      {formatarBRL(l.valor)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`${classeEfeito(efeitoNoSaldo(l.valor, tipoCat(l.categoriaId)))} editavel`}
                      aria-label={`Corrigir valor de ${nomeCat(l.categoriaId)}`}
                      onClick={() => abrirCorrecao(l)}
                    >
                      {formatarBRL(l.valor)}
                    </button>
                  )}
                </div>
                {corrigindo === l.id && (
                  <div className="linha">
                    <div className="campo cresce">
                      <label htmlFor={`corrigir-data-${l.id}`}>Data do pagamento</label>
                      <CampoData
                        id={`corrigir-data-${l.id}`} value={dataCorrigida} onChange={setDataCorrigida}
                      />
                    </div>
                    <div className="campo cresce">
                      <label htmlFor={`corrigir-valor-${l.id}`}>Valor pago</label>
                      <CampoValor
                        id={`corrigir-valor-${l.id}`} valorCentavos={valorCorrigido}
                        onChange={setValorCorrigido} autoFocus
                      />
                    </div>
                  </div>
                )}
                <div className="acoes">
                  {corrigindo === l.id ? (
                    <>
                      <button className="botao botao-primario" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmarCorrigido(l)}>✓ Confirmar</button>
                      <button className="botao" onClick={() => setCorrigindo(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="botao botao-primario" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmar(l.id)}>✓ Confirmar</button>
                      {ehFatura(l) ? (
                        <button className="botao" aria-label={`Paguei outro valor de ${nomeCat(l.categoriaId)}`} onClick={() => setPagando(l)}>Paguei outro valor</button>
                      ) : (
                        <button className="botao" aria-label="Descartar" onClick={() => descartar(l.id)}>Descartar</button>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <PagamentoFaturaSheetModal
            lancamento={pagando} totalFaturaCent={totalDaFaturaPendente}
            onFechar={() => setPagando(null)}
          />
          {fila.length === 0 && <p className="sub">Nada a confirmar — tudo em dia. Aqui aparecem os previstos que já venceram ou vencem em até {ANTECEDENCIA_PENDENTE_DIAS} dias, para você confirmar.</p>}
        </div>
      )}
    </div>
  );
}
