import { useMemo } from 'react';
import type { Dados, ID, ISODate } from '../../domain/types';
import { acaoEfetiva, dataCorrigidaValida, dataEfetiva, totalEfetivo } from '../../importar/conferencia';
import type {
  AcaoItem, DecisaoData, DecisaoTotal, DecisaoTroca, EstadoItem, ItemConferencia, LeituraAdapter,
} from '../../importar/tipos';
import { formatarBRL } from '../../domain/money';
import LinhaConferencia, { dataDoItem, valorDoItem } from './LinhaConferencia';

/** Um item classificado junto com o destino (box e, se for cartão, o cartão) do grupo a que
 *  ele pertence — é o que `Importar.tsx` usa depois para agrupar a gravação por `aplicar`.
 *  `chave` é a identidade estável do item (`chaveDoItem`, em `conferencia.ts`), usada para
 *  chavear `trocas`/`totaisCorrigidos` em vez do índice na lista. */
export interface ItemComContexto {
  item: ItemConferencia;
  boxId: ID;
  cartaoId?: ID;
  chave: string;
}

// Ordem das pílulas, lida em pares (duas por linha): confere e interno; sobra e novos; previsto e
// divergente. Os dois últimos quase só aparecem no extrato da conta e no pagamento da fatura,
// então a pílula deles só entra quando há itens naquele estado.
const ORDEM_ESTADOS: EstadoItem[] = ['confere', 'interno', 'sobra', 'novo', 'previsto', 'divergente'];
const ESTADOS_SEMPRE_VISIVEIS: EstadoItem[] = ['confere', 'interno', 'sobra', 'novo'];

const ROTULOS_CONTAGEM: Record<EstadoItem, [singular: string, plural: string]> = {
  confere: ['confere', 'conferem'],
  previsto: ['previsto', 'previstos'],
  divergente: ['divergente', 'divergentes'],
  novo: ['novo', 'novos'],
  sobra: ['sobra', 'sobras'],
  interno: ['interno', 'internos'],
};

interface Props {
  leitura: LeituraAdapter;
  itens: ItemComContexto[];
  dados: Dados;
  trocas: Record<string, DecisaoTroca>;
  onTrocar: (chave: string, estado: EstadoItem, acao: AcaoItem) => void;
  totaisCorrigidos: Record<string, DecisaoTotal>;
  onCorrigirTotal: (chave: string, estado: EstadoItem, valorCent: number) => void;
  datasCorrigidas: Record<string, DecisaoData>;
  onCorrigirData: (chave: string, estado: EstadoItem, data: ISODate | undefined) => void;
  mostrarLinhasIgnoradas: boolean;
  onToggleLinhasIgnoradas: () => void;
  copiarEstado: 'ocioso' | 'copiado' | 'erro';
  onCopiarTextoExtraido: (texto: string) => void;
  /** Estado escolhido no resumo para filtrar a lista abaixo — só de exibição, nunca muda o
   *  que `Importar.tsx` confirma. `null` mostra tudo. */
  filtro: EstadoItem | null;
  onFiltroChange: (estado: EstadoItem | null) => void;
}

export default function ListaConferencia({
  leitura, itens, dados, trocas, onTrocar, totaisCorrigidos, onCorrigirTotal,
  datasCorrigidas, onCorrigirData,
  mostrarLinhasIgnoradas, onToggleLinhasIgnoradas, copiarEstado, onCopiarTextoExtraido,
  filtro, onFiltroChange,
}: Props) {
  const contagens = useMemo(() => {
    const c: Record<EstadoItem, number> = {
      confere: 0, previsto: 0, divergente: 0, novo: 0, sobra: 0, interno: 0,
    };
    for (const { item } of itens) c[item.estado]++;
    return c;
  }, [itens]);

  // Soma dos valores dos itens de cada estado, sem sinal (mesmo valor que a linha exibe).
  const valores = useMemo(() => {
    const v: Record<EstadoItem, number> = {
      confere: 0, previsto: 0, divergente: 0, novo: 0, sobra: 0, interno: 0,
    };
    for (const { item } of itens) v[item.estado] += valorDoItem(item, dados, undefined);
    return v;
  }, [itens, dados]);

  // O filtro só decide o que aparece aqui embaixo — as contagens acima (e tudo que
  // `Importar.tsx` confirma) continuam olhando `itens` inteiro, sem filtro.
  const itensVisiveis = useMemo(() => (
    filtro ? itens.filter((ic) => ic.item.estado === filtro) : itens
  ), [itens, filtro]);

  // `chave` já é a identidade estável do item (ver `ItemComContexto`), então basta ordenar uma
  // cópia por data — sem precisar remontar nenhum índice depois.
  const ordenados = useMemo(() => (
    [...itensVisiveis].sort((a, b) => {
      const dataA = dataCorrigidaValida(a.item, dataEfetiva(a.item, datasCorrigidas[a.chave])) ?? dataDoItem(a.item, dados);
      const dataB = dataCorrigidaValida(b.item, dataEfetiva(b.item, datasCorrigidas[b.chave])) ?? dataDoItem(b.item, dados);
      return dataA.localeCompare(dataB);
    })
  ), [itensVisiveis, dados, datasCorrigidas]);

  // Parcelas do Nubank com data ainda estimada que vão ser gravadas: o aviso pede ao usuário
  // para corrigir antes de confirmar. Conta a lista inteira, não só os visíveis no filtro.
  const estimadasPendentes = useMemo(() => itens.filter((ic) => ic.item.estado === 'novo'
    && ic.item.bruto?.dataEstimada != null
    && acaoEfetiva(ic.item, trocas[ic.chave]).tipo !== 'ignorar'
    && dataCorrigidaValida(ic.item, dataEfetiva(ic.item, datasCorrigidas[ic.chave])) == null,
  ).length, [itens, trocas, datasCorrigidas]);

  return (
    <>
      {(leitura.avisos.length > 0 || leitura.linhasIgnoradas > 0) && (
        <div className="aviso">
          {leitura.avisos.map((a) => <div key={a}>{a}</div>)}
          {leitura.linhasIgnoradas > 0 && <div>{leitura.linhasIgnoradas} linhas ignoradas.</div>}
        </div>
      )}

      {leitura.linhasIgnoradas > 0
        && leitura.linhasNaoReconhecidas && leitura.linhasNaoReconhecidas.length > 0 && (
        <>
          <button type="button" className="botao" onClick={onToggleLinhasIgnoradas}>
            {mostrarLinhasIgnoradas ? 'Ocultar linhas não reconhecidas' : 'Ver linhas não reconhecidas'}
          </button>
          {mostrarLinhasIgnoradas && (
            <div className="lista">
              {leitura.linhasNaoReconhecidas.map((linha, i) => (
                <div className="item" key={i}><p className="sub">{linha}</p></div>
              ))}
            </div>
          )}
        </>
      )}

      {leitura.textoExtraido && (leitura.linhasIgnoradas > 0 || itens.length === 0) && (
        <>
          <button
            type="button" className="botao"
            onClick={() => onCopiarTextoExtraido(leitura.textoExtraido!)}
          >
            {copiarEstado === 'copiado' ? 'Copiado' : 'Copiar texto extraído'}
          </button>
          <p className="sub">O texto contém os dados da sua fatura. Use só para diagnóstico.</p>
          {copiarEstado === 'erro' && <p className="sub">Não foi possível copiar.</p>}
        </>
      )}

      <div className="importar-resumo">
        {ORDEM_ESTADOS.filter((e) => ESTADOS_SEMPRE_VISIVEIS.includes(e) || contagens[e] > 0 || filtro === e).map((estado) => {
          const n = contagens[estado];
          const [singular, plural] = ROTULOS_CONTAGEM[estado];
          const ativo = filtro === estado;
          return (
            <button
              key={estado}
              type="button"
              className={`importar-contagem${ativo ? ' ativo' : ''}`}
              aria-pressed={ativo}
              disabled={n === 0}
              onClick={() => onFiltroChange(ativo ? null : estado)}
            >
              <span className="importar-contagem-linha">
                <i className={`importar-ponto ${estado}`} aria-hidden="true" />
                <b>{n}</b> {n === 1 ? singular : plural}
              </span>
              <span className="importar-valor">{formatarBRL(valores[estado])}</span>
            </button>
          );
        })}
      </div>
      {filtro && (
        <p className="sub">
          Mostrando só os itens com estado &quot;{ROTULOS_CONTAGEM[filtro][0]}&quot;. Toque de
          novo na pílula para ver todos.
        </p>
      )}

      {estimadasPendentes > 0 && (
        <p className="sub">
          A fatura do Nubank não traz o dia da compra das parcelas antigas.{' '}
          {estimadasPendentes === 1 ? '1 data está estimada' : `${estimadasPendentes} datas estão estimadas`}:
          corrija em &quot;Corrigir compra&quot; antes de confirmar, se souber o dia.
        </p>
      )}

      <div className="lista">
        {ordenados.map((ic) => (
          <LinhaConferencia
            key={ic.chave}
            item={ic.item}
            dados={dados}
            acaoAtual={acaoEfetiva(ic.item, trocas[ic.chave])}
            onTrocarAcao={(acao) => onTrocar(ic.chave, ic.item.estado, acao)}
            totalCorrigidoCent={totalEfetivo(ic.item, totaisCorrigidos[ic.chave])}
            onCorrigirTotal={(v) => onCorrigirTotal(ic.chave, ic.item.estado, v)}
            dataCorrigida={dataEfetiva(ic.item, datasCorrigidas[ic.chave])}
            onCorrigirData={(data) => onCorrigirData(ic.chave, ic.item.estado, data)}
          />
        ))}
      </div>
    </>
  );
}
