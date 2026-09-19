import { useMemo } from 'react';
import type { Dados, ID } from '../../domain/types';
import { acaoEfetiva, totalEfetivo } from '../../importar/conferencia';
import type {
  AcaoItem, DecisaoTotal, DecisaoTroca, EstadoItem, ItemConferencia, LeituraAdapter,
} from '../../importar/tipos';
import LinhaConferencia, { dataDoItem } from './LinhaConferencia';

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

const ORDEM_ESTADOS: EstadoItem[] = ['confere', 'previsto', 'divergente', 'novo', 'sobra', 'interno'];

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
  mostrarLinhasIgnoradas: boolean;
  onToggleLinhasIgnoradas: () => void;
  copiarEstado: 'ocioso' | 'copiado' | 'erro';
  onCopiarTextoExtraido: (texto: string) => void;
}

export default function ListaConferencia({
  leitura, itens, dados, trocas, onTrocar, totaisCorrigidos, onCorrigirTotal,
  mostrarLinhasIgnoradas, onToggleLinhasIgnoradas, copiarEstado, onCopiarTextoExtraido,
}: Props) {
  // `chave` já é a identidade estável do item (ver `ItemComContexto`), então basta ordenar uma
  // cópia por data — sem precisar remontar nenhum índice depois.
  const ordenados = useMemo(() => (
    [...itens].sort((a, b) => dataDoItem(a.item, dados).localeCompare(dataDoItem(b.item, dados)))
  ), [itens, dados]);

  const contagens = useMemo(() => {
    const c: Record<EstadoItem, number> = {
      confere: 0, previsto: 0, divergente: 0, novo: 0, sobra: 0, interno: 0,
    };
    for (const { item } of itens) c[item.estado]++;
    return c;
  }, [itens]);

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
        {ORDEM_ESTADOS.map((estado) => {
          const n = contagens[estado];
          const [singular, plural] = ROTULOS_CONTAGEM[estado];
          return (
            <span key={estado} className="importar-contagem">
              <i className={`importar-ponto ${estado}`} aria-hidden="true" />
              <b>{n}</b> {n === 1 ? singular : plural}
            </span>
          );
        })}
      </div>

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
          />
        ))}
      </div>
    </>
  );
}
