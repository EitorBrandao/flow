import { formatarSaldo } from '../domain/money';

export interface Extremos {
  min: number;
  max: number;
}

interface Props {
  real: Extremos;
  /** Extremos da linha de cenário. Sem ele (nenhum cenário ligado), só há uma série e o texto segue corrido. */
  cenario?: Extremos | null;
  /** Diz o que o mín/máx cobre (ex.: "no período"). Só aparece quando há uma série só. */
  rotulo?: string;
}

function Valor({ v }: { v: number }) {
  return <b className={v >= 0 ? 'pos' : 'neg'}>{formatarSaldo(v)}</b>;
}

/** Rodapé "mín · máx" dos gráficos de saldo. Com cenário ligado, mostra uma linha por série. */
export default function MinMaxSeries({ real, cenario, rotulo }: Props) {
  if (!cenario) {
    return (
      <>
        {rotulo ? `${rotulo}: ` : ''}mín <Valor v={real.min} />
        {' · máx '}
        <Valor v={real.max} />
      </>
    );
  }
  return (
    <span className="minmax-series">
      <span className="minmax-serie real"><i />real</span>
      <span className="minmax-celula"><span>mín</span> <Valor v={real.min} /></span>
      <span className="minmax-celula"><span>máx</span> <Valor v={real.max} /></span>
      <span className="minmax-serie cen"><i />cenário</span>
      <span className="minmax-celula"><span>mín</span> <Valor v={cenario.min} /></span>
      <span className="minmax-celula"><span>máx</span> <Valor v={cenario.max} /></span>
    </span>
  );
}
