import { formatarDataBR } from '../domain/dates';
import { classeEfeito, formatarBRL } from '../domain/money';
import type { Cartao, Categoria, CompraCartao, ID, Lancamento, Viagem } from '../domain/types';
import { itensDaViagem } from '../domain/viagem';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  viagem: Viagem | null;
  boxIds: readonly ID[];
  lancamentos: Lancamento[];
  comprasCartao: CompraCartao[];
  cartoes: Cartao[];
  incluirPrevistos: boolean;
  categorias: Categoria[];
  onFechar: () => void;
}

export default function ViagemSheet({
  aberto, viagem, boxIds, lancamentos, comprasCartao, cartoes, incluirPrevistos, categorias, onFechar,
}: Props) {
  const resumo = viagem
    ? itensDaViagem(viagem, lancamentos, comprasCartao, boxIds, cartoes, incluirPrevistos, categorias)
    : { grupos: [], total: 0 };

  return (
    <Sheet aberto={aberto} onFechar={onFechar} rotulo={viagem?.nome ?? ''}>
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{viagem?.nome ?? ''}</h2>
        <strong className={classeEfeito(-resumo.total)}>{formatarBRL(resumo.total)}</strong>
      </div>
      {viagem && <p className="sub">{formatarDataBR(viagem.dataInicio)} – {formatarDataBR(viagem.dataFim)}</p>}
      <div className="lista" style={{ marginTop: 12 }}>
        {resumo.grupos.map((g) => (
          <div key={g.chave}>
            <div className="linha recuo-1" style={{ justifyContent: 'space-between' }}>
              <p className="rotulo-grupo">
                {g.rotulo}
                {g.itens.length === 1 && g.itens[0].valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
              </p>
              <span className={classeEfeito(-g.subtotal)}>{formatarBRL(g.subtotal)}</span>
            </div>
            {g.itens.length > 1 && (
              <div className="lista" style={{ marginTop: 6 }}>
                {g.itens.map((it, i) => (
                  <div className="item recuo-2" key={`${it.data}:${i}`} style={{ cursor: 'default' }}>
                    <div className="cresce">
                      {formatarDataBR(it.data)}
                      {it.valor < 0 && <span className="badge" style={{ marginLeft: 6 }}>estorno</span>}
                    </div>
                    <span className={classeEfeito(-it.valor)}>{formatarBRL(it.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {resumo.grupos.length === 0 && <p className="sub">Sem gastos marcados nessa viagem.</p>}
      </div>
    </Sheet>
  );
}
