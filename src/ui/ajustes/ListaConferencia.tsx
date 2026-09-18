import { useMemo } from 'react';
import type { Dados, ID } from '../../domain/types';
import type { AcaoItem, EstadoItem, ItemConferencia, LeituraAdapter } from '../../importar/tipos';
import LinhaConferencia, { dataDoItem } from './LinhaConferencia';

/** Um item classificado junto com o destino (box e, se for cartão, o cartão) do grupo a que
 *  ele pertence — é o que `Importar.tsx` usa depois para agrupar a gravação por `aplicar`. */
export interface ItemComContexto {
  item: ItemConferencia;
  boxId: ID;
  cartaoId?: ID;
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
  trocas: Record<number, AcaoItem>;
  onTrocar: (indice: number, acao: AcaoItem) => void;
  totaisCorrigidos: Record<number, number>;
  onCorrigirTotal: (indice: number, valorCent: number) => void;
}

export default function ListaConferencia({
  leitura, itens, dados, trocas, onTrocar, totaisCorrigidos, onCorrigirTotal,
}: Props) {
  // O índice guardado é o do array ORIGINAL (não o da ordenação): é essa posição que chaveia
  // `trocas` e `totaisCorrigidos`, e ela precisa ser estável mesmo depois de ordenar por data.
  const ordenados = useMemo(() => (
    itens
      .map((item, indiceOriginal) => ({ ...item, indiceOriginal }))
      .sort((a, b) => dataDoItem(a.item, dados).localeCompare(dataDoItem(b.item, dados)))
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
        {ordenados.map(({ item, indiceOriginal }) => (
          <LinhaConferencia
            key={indiceOriginal}
            item={item}
            dados={dados}
            acaoAtual={trocas[indiceOriginal] ?? item.acao}
            onTrocarAcao={(acao) => onTrocar(indiceOriginal, acao)}
            totalCorrigidoCent={totaisCorrigidos[indiceOriginal]}
            onCorrigirTotal={(v) => onCorrigirTotal(indiceOriginal, v)}
          />
        ))}
      </div>
    </>
  );
}
