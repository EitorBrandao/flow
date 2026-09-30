import { addMeses, mesAbreviado } from '../domain/dates';
import {
  MAX_MESES_PERIODO, ajustarAte, ajustarDe, mesesDoPeriodo, rotuloIntervalo,
  type EstadoPeriodo, type ModoPeriodo,
} from '../domain/periodo';
import SeletorMes from './SeletorMes';
import SeletorPills from './SeletorPills';

const OPCOES: { id: ModoPeriodo; nome: string }[] = [
  { id: 'mes', nome: 'Mês' },
  { id: '12m', nome: '12 meses' },
  { id: 'ano', nome: 'Ano' },
  { id: 'periodo', nome: 'Período' },
];

interface Props {
  estado: EstadoPeriodo;
  /** mês de hoje ('AAAA-MM'): marca o ano corrente como "até agora" */
  mesHoje: string;
  onMudar: (e: EstadoPeriodo) => void;
}

/** Uma linha ‹ rótulo ›, no mesmo desenho do SeletorMes. */
function LinhaNav({ rotulo, prefixo, nome, onAnterior, onSeguinte }: {
  rotulo: React.ReactNode; prefixo?: string; nome: string; onAnterior: () => void; onSeguinte: () => void;
}) {
  return (
    <div className="linha" style={{ justifyContent: 'space-between' }}>
      <button className="botao" aria-label={`${nome} anterior`} onClick={onAnterior}>‹</button>
      <span>
        {prefixo && <><span className="sub">{prefixo}</span>{' '}</>}
        <strong>{rotulo}</strong>
      </span>
      <button className="botao" aria-label={`${nome} seguinte`} onClick={onSeguinte}>›</button>
    </div>
  );
}

/** Seletor de período das Análises: pílulas de modo, as linhas de/até (modo Período) e a linha
 *  ‹ período › dentro de `.barra-fixa`, que gruda sob o topo ao rolar. Deve ser filho direto de
 *  `.tela`, para o sticky valer na tela inteira. */
export default function SeletorPeriodo({ estado: e, mesHoje, onMudar }: Props) {
  const meses = mesesDoPeriodo(e);
  const anoHoje = Number(mesHoje.slice(0, 4));

  let fixa: React.ReactNode;
  if (e.modo === 'mes') {
    fixa = <SeletorMes mes={e.mes} onMudar={(mes) => onMudar({ ...e, mes })} />;
  } else if (e.modo === '12m') {
    fixa = (
      <LinhaNav
        nome="Período" rotulo={rotuloIntervalo(meses)}
        onAnterior={() => onMudar({ ...e, fim12: addMeses(e.fim12, -1) })}
        onSeguinte={() => onMudar({ ...e, fim12: addMeses(e.fim12, 1) })}
      />
    );
  } else if (e.modo === 'ano') {
    fixa = (
      <LinhaNav
        nome="Ano"
        rotulo={<>{e.ano}{e.ano === anoHoje && <> <span className="badge">até agora</span></>}</>}
        onAnterior={() => onMudar({ ...e, ano: e.ano - 1 })}
        onSeguinte={() => onMudar({ ...e, ano: e.ano + 1 })}
      />
    );
  } else {
    fixa = (
      <LinhaNav
        nome="Período" rotulo={rotuloIntervalo(meses)}
        onAnterior={() => onMudar({ ...e, de: addMeses(e.de, -1), ate: addMeses(e.ate, -1) })}
        onSeguinte={() => onMudar({ ...e, de: addMeses(e.de, 1), ate: addMeses(e.ate, 1) })}
      />
    );
  }

  return (
    <>
      <SeletorPills
        opcoes={OPCOES} selecionadaId={e.modo} rotulo="Período"
        onSelecionar={(id) => onMudar({ ...e, modo: id as ModoPeriodo })}
      />
      {e.modo === 'periodo' && (
        <>
          <LinhaNav
            nome="Mês inicial" prefixo="de" rotulo={mesAbreviado(e.de)}
            onAnterior={() => onMudar({ ...e, ...ajustarDe(e.de, e.ate, addMeses(e.de, -1)) })}
            onSeguinte={() => onMudar({ ...e, ...ajustarDe(e.de, e.ate, addMeses(e.de, 1)) })}
          />
          <LinhaNav
            nome="Mês final" prefixo="até" rotulo={mesAbreviado(e.ate)}
            onAnterior={() => onMudar({ ...e, ...ajustarAte(e.de, e.ate, addMeses(e.ate, -1)) })}
            onSeguinte={() => onMudar({ ...e, ...ajustarAte(e.de, e.ate, addMeses(e.ate, 1)) })}
          />
          <div className="linha" style={{ justifyContent: 'center' }}>
            <span className="sub">
              {meses.length} {meses.length === 1 ? 'mês' : 'meses'} · máximo de {MAX_MESES_PERIODO}
            </span>
          </div>
        </>
      )}
      <div className="barra-fixa">{fixa}</div>
    </>
  );
}
