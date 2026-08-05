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
            <button type="button" className="botao" aria-label="Alternar sinal (positivo/negativo)" onClick={() => setNegativo(n => !n)} style={{ padding: '8px 12px' }}>
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
  const [valores, setValores] = useState<Record<string, number>>(
    () => Object.fromEntries(bancos.map((b) => [b.id, b.saldoDeclaradoCent ?? 0])),
  );
  // Não basta saber que o `onChange` disparou: `CampoValor` zera o buffer já no primeiro foco
  // chamando onChange(0), mesmo sem o usuário digitar nada (ver CampoValor.test.tsx, "primeiro
  // foco zera o buffer") — um toque acidental (ou o "próximo" do teclado) já bastava pra incluir
  // o banco no Salvar com valor zero, apagando um saldo real gravado. Por isso o PRIMEIRO
  // onChange de cada campo é sempre descartado como esse zera-buffer do foco; só o segundo em
  // diante (um dígito, um backspace ou um paste) marca o banco como realmente editado.
  const primeiroFoco = useRef<Set<string>>(new Set());
  const editados = useRef<Set<string>>(new Set());

  function mudarValor(id: string, v: number) {
    setValores((atual) => ({ ...atual, [id]: v }));
    if (primeiroFoco.current.has(id)) editados.current.add(id);
    else primeiroFoco.current.add(id);
  }

  async function salvar() {
    // Grava só quem foi editado de fato e cujo valor final difere do que já está persistido —
    // "focou e desistiu" deixa o banco fora daqui (não entrou em `editados`), então um banco
    // nunca informado (`saldoDeclaradoCent: null`) que só foi tocado continua `null`, não vira
    // "informado zero" (são estados diferentes: ver `totalDeclaradoCent`). Já um banco realmente
    // zerado por edição (dígitos apagados até zero) entra normalmente, mesmo que o resultado
    // numérico seja o mesmo zero — é uma decisão consciente do usuário, não um efeito colateral.
    const mudancas = bancos
      .filter((b) => editados.current.has(b.id))
      .map((b) => ({ id: b.id, cents: valores[b.id] ?? 0 }))
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
              <CampoValor
                id={`banco-${b.id}`} valorCentavos={valores[b.id] ?? 0}
                onChange={(v) => mudarValor(b.id, v)}
                ariaLabel={b.nome} style={{ width: 110 }}
              />
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
  // Box sem banco nenhum cadastrado mantém a conferência de sempre (campo único) — zero
  // regressão pra quem nunca cadastrou um banco. Só com bancos a lista por banco assume.
  const bancos = bancosDaBox(dados.bancos, ids);
  const chaveBancos = bancos.map((b) => b.id).join(',');

  async function salvarSaldoReal(cents: number, data: string) {
    if (boxSel === 'casa') await repo.salvarConfig({ saldoDeclaradoCent: cents, dataSaldoDeclarado: data });
    else if (boxAtual) await repo.salvarBox({ ...boxAtual, saldoDeclaradoCent: cents, dataSaldoDeclarado: data });
    await recarregar();
  }

  async function salvarSaldosBancos(mudancas: { id: string; cents: number }[], data: string) {
    // Grava todos os bancos alterados antes de recarregar — `recarregar()` relê o snapshot
    // inteiro (ver store.ts), então uma chamada por banco alterado seria N releituras pra uma
    // única ação de "Salvar conferência dos bancos".
    await Promise.all(
      mudancas.map(({ id, cents }) => repo.atualizarBanco(id, { saldoDeclaradoCent: cents, dataSaldoDeclarado: data })),
    );
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

  // Enquanto o pendente é `previsto`, o valor dele *é* o total da fatura — quem o escreve é a
  // sincronização do cartão, não a mão do usuário.
  const totalDaFaturaPendente = pagando?.valor ?? 0;

  const { precisa: primeiroUso } = estadoPrimeiroUso(dados);

  return (
    <div className="tela">
      {backupVelho && (
        <button className="aviso" style={{ border: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => abrirAjustes('backup')}>
          Há mudanças sem backup há mais de 7 dias — toque para exportar.
        </button>
      )}
      {primeiroUso ? (
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
          {bancos.length === 0 ? (
            <ConferenciaSaldo key={boxSel} saldoApp={deHoje?.saldoEfetivo ?? 0} declaradoCent={declaradoCent}
              dataDeclarado={dataDeclarado} hoje={hoje} onSalvar={salvarSaldoReal} />
          ) : (
            <ConferenciaBancos key={`${boxSel}-${chaveBancos}`} bancos={bancos} boxes={dados.boxes}
              agruparPorBox={boxSel === 'casa'} saldoApp={deHoje?.saldoEfetivo ?? 0} hoje={hoje}
              onSalvarBancos={salvarSaldosBancos} />
          )}
          <BalanceChart serie={janela} hoje={hoje} altura={120} mostrarCenarios={ligados.size > 0} />
        </div>
      )}
      <h2>Pendentes ({fila.length})</h2>
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
                {/* Fatura não se descarta — ela sempre aconteceu; o que varia é quanto foi
                    pago dela. Nos demais pendentes o par Confirmar/Descartar continua igual. */}
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
    </div>
  );
}
