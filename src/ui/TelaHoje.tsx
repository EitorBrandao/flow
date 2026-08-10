import { useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as repo from '../db/repo';
import { bancosDaBox, totalDeclaradoCent } from '../domain/bancos';
import { addDias } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { Banco, Box, ISODate, Lancamento } from '../domain/types';
import { pendentes, projetarBoxes } from '../domain/projection';
import { boxIdsSelecionadas, cenariosLigados, estadoPrimeiroUso, useApp } from '../state/store';
import BalanceChart from './BalanceChart';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import PrimeiroUso from './PrimeiroUso';
import { PagamentoFaturaSheetModal } from './PagamentoFaturaSheet';

const SETE_DIAS_MS = 7 * 86_400_000;

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

function ConferenciaSaldo({ saldoApp, declaradoCent, dataDeclarado, hoje, onSalvar }: {
  saldoApp: number;
  declaradoCent: number | null;
  dataDeclarado: ISODate | null;
  hoje: ISODate;
  onSalvar: (cents: number, data: ISODate) => Promise<void>;
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
    <div style={{ marginTop: 8 }}>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <div className="campo">
          <label htmlFor={`${uid}-saldo`}>Saldo real no banco</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button type="button" className="botao botao-sinal" aria-label="Alternar sinal (positivo/negativo)" onClick={() => setNegativo(n => !n)}>
              {negativo ? '−' : '+'}
            </button>
            <CampoValor id={`${uid}-saldo`} valorCentavos={magnitude} onChange={setMagnitude} style={{ width: 110 }} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
        </div>
        <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={salvar}>Salvar</button>
      </div>
      {diff != null && (
        <p className="sub" style={{ margin: '4px 0 0' }}>
          {Math.abs(diff) <= 1
            ? 'Bate certinho.'
            : diff > 0
              ? `Diferença: ${formatarBRL(diff)} — falta inserir no app`
              : `Diferença: ${formatarBRL(-diff)} — sobra no app (confira duplicado ou algo não confirmado no banco)`}
          {dataDeclarado ? ` · conferido em ${dataDeclarado}` : ''}
        </p>
      )}
    </div>
  );
}

/** Mesmas frases de diferença que `ConferenciaSaldo` usa — a conferência por banco muda só
 *  o campo de entrada (um por banco em vez de um único), não o texto de resultado. */
function textoDiferenca(diff: number): string {
  if (Math.abs(diff) <= 1) return 'Bate certinho.';
  return diff > 0
    ? `Diferença: ${formatarBRL(diff)} — falta inserir no app`
    : `Diferença: ${formatarBRL(-diff)} — sobra no app (confira duplicado ou algo não confirmado no banco)`;
}

/** Um grupo de bancos: sem box quando a seleção é uma única box (lista plana), com box
 *  quando é 'casa' (agrupado, mesmo padrão do `LancamentosSheet`: `.rotulo-grupo` + `.recuo-1`). */
interface GrupoBancos { box: Box | null; itens: Banco[] }

function ConferenciaBancos({ bancos, boxes, agruparPorBox, saldoApp, hoje, onSalvarBancos }: {
  bancos: Banco[];
  boxes: Box[];
  agruparPorBox: boolean;
  saldoApp: number;
  hoje: ISODate;
  onSalvarBancos: (mudancas: { id: string; cents: number }[], data: ISODate) => Promise<void>;
}) {
  const [magnitudes, setMagnitudes] = useState<Record<string, number>>(
    () => Object.fromEntries(bancos.map((b) => [b.id, Math.abs(b.saldoDeclaradoCent ?? 0)])),
  );
  const [negativos, setNegativos] = useState<Record<string, boolean>>(
    () => Object.fromEntries(bancos.map((b) => [b.id, (b.saldoDeclaradoCent ?? 0) < 0])),
  );
  const editados = useRef<Set<string>>(new Set());

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
            <div className={`linha-banco${agruparPorBox ? ' recuo-1' : ''}`} key={b.id}>
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
      <div className="total">
        <span>Total informado</span>
        <span>{totalCent != null ? formatarBRL(totalCent) : '—'}</span>
      </div>
      {diff == null ? (
        <p className="sub" style={{ margin: '4px 0 0' }}>Informe o saldo de ao menos um banco para conferir.</p>
      ) : (
        <p className="sub" style={{ margin: '4px 0 0' }}>{textoDiferenca(diff)}</p>
      )}
      <button className="botao" style={{ alignSelf: 'flex-start' }} onClick={salvar}>Salvar conferência dos bancos</button>
    </div>
  );
}

export default function TelaHoje() {
  const { dados, boxSel, hoje, recarregar, abrirAjustes } = useApp();
  const [pagando, setPagando] = useState<Lancamento | null>(null);
  const [avisoSalvarBancos, setAvisoSalvarBancos] = useState<string | null>(null);
  const [abaHoje, setAbaHoje] = useState<AbaHoje>('visao');
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

  const backupVelho = dados.config.mudancasDesdeBackup
    && (!dados.config.ultimoBackupEm
      || Date.parse(dados.config.ultimoBackupEm) < Date.now() - SETE_DIAS_MS);

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
      {backupVelho && (
        <button className="aviso" style={{ border: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => abrirAjustes('backup')}>
          Há mudanças sem backup há mais de 7 dias — toque para exportar.
        </button>
      )}
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
          <div className="card">
            <p className="rotulo" style={{ margin: 0 }}>
              Saldo hoje · {boxSel === 'casa' ? 'casa' : dados.boxes.find((b) => b.id === boxSel)?.nome}
            </p>
            {(() => {
              const saldoHoje = deHoje?.saldoEfetivo ?? 0;
              const [reais, centavos] = formatarBRL(saldoHoje).split(',');
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
                  {delta > 0 ? '▲' : '▼'} {formatarBRL(Math.abs(delta))} nos próximos 28 dias
                </span>
              );
            })()}
            {deHoje && deHoje.saldoProjetado !== deHoje.saldoEfetivo && (
              <p className="sub" style={{ margin: 0 }}>
                projetado: <strong className={deHoje.saldoProjetado >= 0 ? 'valor-ganho' : 'valor-gasto'}>
                  {formatarBRL(deHoje.saldoProjetado)}
                </strong>
              </p>
            )}
            <BalanceChart serie={janela} hoje={hoje} altura={120} mostrarCenarios={ligados.size > 0} />
          </div>
        )
      )}

      {abaHoje === 'conferir' && (
        <div className="card">
          {avisoSalvarBancos && <p className="aviso">{avisoSalvarBancos}</p>}
          {bancos.length === 0 ? (
            <ConferenciaSaldo key={boxSel} saldoApp={deHoje?.saldoEfetivo ?? 0} declaradoCent={declaradoCent}
              dataDeclarado={dataDeclarado} hoje={hoje} onSalvar={salvarSaldoReal} />
          ) : (
            <ConferenciaBancos key={`${boxSel}-${chaveBancos}`} bancos={bancos} boxes={dados.boxes}
              agruparPorBox={boxSel === 'casa'} saldoApp={deHoje?.saldoEfetivo ?? 0} hoje={hoje}
              onSalvarBancos={salvarSaldosBancos} />
          )}
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
                    <div>{nomeCat(l.categoriaId)}</div>
                    <div className="sub">{l.data.split('-').reverse().join('/')}{l.nota ? ` · ${l.nota}` : ''}</div>
                  </div>
                  <span className={tipoCat(l.categoriaId) === 'ganho' ? 'valor-ganho' : 'valor-gasto'}>
                    {formatarBRL(l.valor)}
                  </span>
                </div>
                <div className="acoes">
                  <button className="botao botao-primario" aria-label={`Confirmar ${nomeCat(l.categoriaId)}`} onClick={() => confirmar(l.id)}>✓ Confirmar</button>
                  {ehFatura(l) ? (
                    <button className="botao" aria-label={`Paguei outro valor de ${nomeCat(l.categoriaId)}`} onClick={() => setPagando(l)}>Paguei outro valor</button>
                  ) : (
                    <button className="botao" aria-label="Descartar" onClick={() => descartar(l.id)}>Descartar</button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <PagamentoFaturaSheetModal
            lancamento={pagando} totalFaturaCent={totalDaFaturaPendente}
            onFechar={() => setPagando(null)}
          />
          {fila.length === 0 && <p className="sub">Nada a confirmar — tudo em dia.</p>}
        </div>
      )}
    </div>
  );
}
