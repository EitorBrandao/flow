import { lancamentosDaCategoria } from '../domain/aggregations';
import { classeEfeito, efeitoNoSaldo, formatarBRL } from '../domain/money';
import type { ID, Lancamento, TipoCategoria } from '../domain/types';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  categoriaId: ID | null;
  nome: string;
  tipo: TipoCategoria;
  mes: string;
  boxIds: readonly ID[];
  lancamentos: Lancamento[];
  incluirPrevistos: boolean;
  onFechar: () => void;
  /** mostra "‹ voltar ao período" (folha aberta a partir da folha de um período) */
  onVoltar?: () => void;
}

function dataFormatada(iso: string): string {
  return iso.split('-').reverse().join('/');
}

export default function LancamentosSheet({
  aberto, categoriaId, nome, tipo, mes, boxIds, lancamentos, incluirPrevistos, onFechar, onVoltar,
}: Props) {
  const grupos = categoriaId
    ? lancamentosDaCategoria(mes, categoriaId, boxIds, lancamentos, incluirPrevistos)
    : [];
  const total = grupos.reduce((soma, g) => soma + g.subtotal, 0);
  const classe = (v: number) => classeEfeito(efeitoNoSaldo(v, tipo));

  return (
    <Sheet aberto={aberto} onFechar={onFechar} rotulo={nome}>
      {onVoltar && <button className="botao-ver-mais" onClick={onVoltar}>‹ voltar ao período</button>}
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{nome}</h2>
        <strong className={classe(total)}>{formatarBRL(total)}</strong>
      </div>
      <div className="lista" style={{ marginTop: 12 }}>
        {grupos.map((g) => (
          <div key={g.notaChave}>
            <div className="linha recuo-1" style={{ justifyContent: 'space-between' }}>
              <p className="rotulo-grupo">
                {g.notaExibicao}
                {g.itens.length === 1 && g.itens[0].valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
              </p>
              <span className={classe(g.subtotal)}>{formatarBRL(g.subtotal)}</span>
            </div>
            {g.itens.length > 1 && (
              <div className="lista" style={{ marginTop: 6 }}>
                {g.itens.map((it, i) => (
                  <div className="item recuo-2" key={`${it.data}:${i}`} style={{ cursor: 'default' }}>
                    <div className="cresce">
                      {dataFormatada(it.data)}
                      {it.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
                    </div>
                    <span className={classe(it.valor)}>{formatarBRL(it.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {grupos.length === 0 && <p className="sub">Sem lançamentos no mês.</p>}
      </div>
    </Sheet>
  );
}
