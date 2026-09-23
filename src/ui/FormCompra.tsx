import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import * as repo from '../db/repo';
import { addMesesData, formatarDataBR } from '../domain/dates';
import { categoriasCartaoReservadasIds } from '../domain/categorias';
import { formatarBRL, formatarPercentual as formatarPercentualDominio } from '../domain/money';
import { distribuirItens, notaDaCompra, parsearNotaFiscal, type NotaFiscalExtraida } from '../domain/notaFiscal';
import type { Cartao, CompraCartao, ID, ISODate } from '../domain/types';
import { viagemAtivaEm } from '../domain/viagem';
import { useApp } from '../state/store';
import CampoData from './CampoData';
import CampoValor from './CampoValor';
import SeletorCategoria from './SeletorCategoria';

/** Semente de uma compra NOVA (atalho da sheet Adicionar ou nota fiscal escaneada). Cada
 *  campo é opcional porque as duas origens preenchem subconjuntos diferentes: o atalho de
 *  "Frequentes" sempre traz `categoriaCartaoId`, a nota fiscal nunca traz (não há categoria
 *  no XML). `compra` (edição) tem precedência sobre `inicial` em todos os campos. */
export interface InicialCompra {
  valorTotal?: number;
  categoriaCartaoId?: ID;
  data?: ISODate;
  descricao?: string;
  nota?: NotaFiscalExtraida;
}

/** "Não mexi", "anexei uma" e "removi" são três coisas diferentes na hora de salvar: sem o
 *  terceiro estado, remover a nota seria indistinguível de não ter feito nada. */
type EstadoNota =
  | { tipo: 'inalterada' }
  | { tipo: 'nova'; nota: NotaFiscalExtraida }
  | { tipo: 'removida' };

/** Abaixo de meio décimo, o arredondamento de `toFixed(1)` gera "0,0%" (ou "−0,0%",
 *  no caso de sinal negativo com valor absoluto ínfimo) — um percentual que não informa
 *  nada e ainda confunde com o sinal errado. Omitir é mais honesto que mostrar isso. */
function formatarPercentual(p: number): string | null {
  if (Math.abs(p) < 0.05) return null;
  return formatarPercentualDominio(p);
}

/** Quantidade vem em décimos de milésimo. Só vale mostrar quando não for a unidade solta. */
function formatarQuantidade(quantidade?: number, unidade?: string): string | null {
  if (quantidade == null) return null;
  if (quantidade === 10000 && (unidade === 'UN' || !unidade)) return null;
  const n = (quantidade / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  return unidade ? `${n} ${unidade}` : n;
}

export default function FormCompra({ cartao, compra, inicial, onFechar }: {
  cartao: Cartao;
  compra?: CompraCartao;
  inicial?: InicialCompra;
  onFechar: () => void;
}) {
  const { dados, hoje, recarregar } = useApp();
  const [valor, setValor] = useState(compra?.valorTotal ?? inicial?.valorTotal ?? 0);
  const [data, setData] = useState(compra?.data ?? inicial?.data ?? hoje);
  const [categoriaId, setCategoriaId] = useState<string | null>(
    compra?.categoriaCartaoId ?? inicial?.categoriaCartaoId ?? null,
  );
  const [parcelas, setParcelas] = useState(compra ? String(compra.parcelas) : '1');
  const [parcelasPagas, setParcelasPagas] = useState('');
  const [descricao, setDescricao] = useState(compra?.descricao ?? inicial?.descricao ?? '');
  const [viagemMarcada, setViagemMarcada] = useState(compra ? compra.viagemId != null : true);
  const [estadoNota, setEstadoNota] = useState<EstadoNota>(
    inicial?.nota ? { tipo: 'nova', nota: inicial.nota } : { tipo: 'inalterada' },
  );
  const [anexando, setAnexando] = useState(false);
  const [xmlTexto, setXmlTexto] = useState('');
  const [erroNota, setErroNota] = useState<string | null>(null);
  const [verItens, setVerItens] = useState(false);
  const montouRef = useRef(true);
  const uid = useId();
  if (!dados) return null;
  const ocultas = categoriasCartaoReservadasIds(dados.cartoes);
  const cats = dados.categoriasCartao.filter((c) => c.cartaoId === cartao.id && !c.arquivada && !ocultas.has(c.id));
  const viagemAtiva = viagemAtivaEm(dados.viagens, data);
  const horizonte = dados.config.horizonteProjecao;
  const parcelasNum = Math.min(48, Math.max(1, Math.round(Number(parcelas) || 1)));

  const notaSalva = compra ? notaDaCompra(dados.notasFiscais, compra.id) : undefined;
  const notaExibida: NotaFiscalExtraida | null =
    estadoNota.tipo === 'nova' ? estadoNota.nota
      : estadoNota.tipo === 'removida' ? null
        : notaSalva
          ? {
            valorTotal: notaSalva.totalNotaCent, data: notaSalva.emissao,
            descricao: notaSalva.emitente, itens: notaSalva.itens,
          }
          : null;
  // percentuais seguem o valor ATUAL do formulário, não o valor salvo — acompanham edição ao vivo
  const linhas = notaExibida ? distribuirItens(notaExibida.itens, valor) : [];

  useEffect(() => {
    if (montouRef.current) { montouRef.current = false; return; }
    setViagemMarcada(true);
  }, [viagemAtiva?.id ?? null]);

  function onParcelasChange(v: string) {
    setParcelas(v);
    const n = Math.min(48, Math.max(1, Math.round(Number(v) || 1)));
    const p = Math.round(Number(parcelasPagas) || 0);
    if (p > 0 && p >= n) setParcelasPagas('');
  }

  function onParcelasPagasChange(v: string) {
    setParcelasPagas(v);
    const n = Math.round(Number(v));
    if (v.trim() === '' || !Number.isFinite(n) || n <= 0) return;
    const pClamped = Math.min(n, parcelasNum - 1);
    setData(addMesesData(hoje, -pClamped));
  }

  async function onArquivoXml(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErroNota(null);
    try {
      setXmlTexto(await arquivo.text());
    } catch {
      setErroNota('Não foi possível ler esse arquivo.');
    }
  }

  function anexarNota() {
    const extraida = parsearNotaFiscal(xmlTexto);
    if (extraida.itens.length === 0) {
      setErroNota('Não foi possível ler os itens desse XML.');
      return;
    }
    setEstadoNota({ tipo: 'nova', nota: extraida });
    setAnexando(false);
    setXmlTexto('');
    setErroNota(null);
    setVerItens(true);
  }

  function removerNota() {
    setEstadoNota({ tipo: 'removida' });
    setVerItens(false);
  }

  async function salvar() {
    if (valor <= 0 || !categoriaId) return;
    const campos = {
      data, valorTotal: valor, parcelas: parcelasNum, categoriaCartaoId: categoriaId,
      ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
      // viagemId sempre presente (mesmo undefined) para permitir desmarcar ao editar
      viagemId: (viagemAtiva && viagemMarcada) ? viagemAtiva.id : undefined,
    };
    let compraId: ID;
    if (compra) {
      await repo.atualizarCompraCartao(compra.id, campos, horizonte);
      compraId = compra.id;
    } else {
      compraId = (await repo.salvarCompraCartao({ cartaoId: cartao.id, ...campos }, horizonte)).id;
    }
    if (estadoNota.tipo === 'nova') {
      await repo.salvarNotaFiscal({
        compraCartaoId: compraId,
        emitente: estadoNota.nota.descricao,
        emissao: estadoNota.nota.data,
        totalNotaCent: estadoNota.nota.valorTotal,
        itens: estadoNota.nota.itens,
      });
    } else if (estadoNota.tipo === 'removida') {
      await repo.excluirNotaFiscalDaCompra(compraId);
    }
    await recarregar();
    onFechar();
  }

  async function excluir() {
    if (!compra) return;
    if (!window.confirm('Excluir a compra e todas as suas parcelas?')) return;
    await repo.excluirCompraCartao(compra.id, horizonte);
    await recarregar();
    onFechar();
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>{compra ? 'Editar compra' : 'Nova compra'}</h2>
      <p className="sub">{cartao.nome}</p>
      <div className="linha">
        <div className="campo">
          <label htmlFor={`${uid}-valor`}>Valor</label>
          <CampoValor id={`${uid}-valor`} valorCentavos={valor} onChange={setValor} style={{ width: 100 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-data`}>Data</label>
          <CampoData id={`${uid}-data`} value={data} onChange={setData} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelas`}>Parcelas</label>
          <input id={`${uid}-parcelas`} type="number" min={1} max={48} value={parcelas}
            onChange={(e) => onParcelasChange(e.target.value)} style={{ width: 64 }} />
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-parcelaspagas`}>Parcelas já pagas</label>
          <input id={`${uid}-parcelaspagas`} type="number" min={0} max={Math.max(0, parcelasNum - 1)}
            disabled={parcelasNum <= 1}
            value={parcelasNum <= 1 ? '' : parcelasPagas}
            onChange={(e) => onParcelasPagasChange(e.target.value)} style={{ width: 64 }} />
        </div>
      </div>
      <div className="campo">
        <label>Categoria</label>
        <SeletorCategoria categorias={cats} selecionadaId={categoriaId} onSelecionar={setCategoriaId} />
      </div>
      {anexando ? (
        <div className="nota-bloco">
          <p className="sub">
            Baixe o XML da nota num site de consulta de NFC-e e envie o arquivo, ou cole o
            texto aqui.
          </p>
          <div className="campo">
            <label htmlFor={`${uid}-nota-arquivo`}>Arquivo XML</label>
            <input id={`${uid}-nota-arquivo`} type="file" accept=".xml,text/xml" onChange={onArquivoXml} />
          </div>
          <div className="campo">
            <label htmlFor={`${uid}-nota-texto`}>Ou cole o texto do XML</label>
            <textarea
              id={`${uid}-nota-texto`} rows={4} value={xmlTexto}
              onChange={(e) => { setXmlTexto(e.target.value); setErroNota(null); }}
            />
          </div>
          {erroNota && <p className="aviso">{erroNota}</p>}
          <div className="linha">
            <button className="botao botao-primario" onClick={anexarNota}>Anexar</button>
            <button className="botao" onClick={() => { setAnexando(false); setXmlTexto(''); setErroNota(null); }}>Cancelar</button>
          </div>
        </div>
      ) : notaExibida ? (
        <div className="nota-bloco">
          <div className="linha-topo">
            <span className="cresce">
              <strong>{notaExibida.descricao ?? 'Nota fiscal'}</strong>
              {notaExibida.data && <span className="sub"> · {formatarDataBR(notaExibida.data)}</span>}
            </span>
            {notaExibida.valorTotal != null && (
              <span className="badge">{formatarBRL(notaExibida.valorTotal)}</span>
            )}
          </div>
          <div className="linha">
            <span className="sub cresce">
              {notaExibida.itens.length} {notaExibida.itens.length === 1 ? 'item' : 'itens'}
            </span>
            <button className="botao-ver-mais" onClick={() => setVerItens((v) => !v)}>
              {verItens ? 'Ocultar itens' : 'Ver itens'}
            </button>
            <button className="botao botao-perigo" onClick={removerNota}>Remover</button>
          </div>
          {verItens && (
            <ul className="nota-itens">
              {linhas.map((l, i) => {
                const quantidade = formatarQuantidade(l.quantidade, l.unidade);
                const percentual = formatarPercentual(l.percentual);
                return (
                  <li key={`${l.descricao}-${i}`} className={`nota-item${l.diferenca ? ' nota-item-diferenca' : ''}`}>
                    <div>
                      <span>{l.descricao}</span>
                      {quantidade && <span className="sub">{quantidade}</span>}
                    </div>
                    <div>
                      <span>{formatarBRL(l.valorCent)}</span>
                      {percentual && <span className="sub">{percentual}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <button className="botao" onClick={() => { setAnexando(true); setXmlTexto(''); setErroNota(null); }}>
          Anexar nota fiscal
        </button>
      )}
      <div className="linha">
        <div className="campo cresce">
          <label htmlFor={`${uid}-desc`}>Descrição (opcional)</label>
          <input id={`${uid}-desc`} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        {viagemAtiva && (
          <div className="campo">
            <label htmlFor={`${uid}-viagem`}>
              <input
                id={`${uid}-viagem`} type="checkbox"
                checked={viagemMarcada} onChange={(e) => setViagemMarcada(e.target.checked)}
              />
              {' '}Viagem: {viagemAtiva.nome}
            </label>
          </div>
        )}
        <button className="botao botao-primario" style={{ alignSelf: 'flex-end' }} onClick={salvar}>Salvar</button>
        <button className="botao" style={{ alignSelf: 'flex-end' }} onClick={onFechar}>Cancelar</button>
        {compra && <button className="botao botao-perigo" style={{ alignSelf: 'flex-end' }} onClick={excluir}>Excluir</button>}
      </div>
    </>
  );
}
