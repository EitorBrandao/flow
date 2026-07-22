import { formatarBRL } from '../domain/money';
import type { ItemResumoAssinaturas } from '../domain/fatura';
import Sheet from './Sheet';

interface Props {
  aberto: boolean;
  itens: ItemResumoAssinaturas[];
  totalCent: number;
  onFechar: () => void;
}

export default function AssinaturasResumoSheet({ aberto, itens, totalCent, onFechar }: Props) {
  const porCartao = new Map<string, { cartaoNome: string; itens: ItemResumoAssinaturas[] }>();
  for (const item of itens) {
    let grupo = porCartao.get(item.cartaoId);
    if (!grupo) {
      grupo = { cartaoNome: item.cartaoNome, itens: [] };
      porCartao.set(item.cartaoId, grupo);
    }
    grupo.itens.push(item);
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} rotulo="Assinaturas">
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Assinaturas</h2>
        <strong className="valor-gasto">{formatarBRL(totalCent)}</strong>
      </div>
      <div className="lista" style={{ marginTop: 12 }}>
        {[...porCartao.entries()].map(([cartaoId, grupo]) => (
          <div key={cartaoId}>
            <p className="rotulo-grupo">{grupo.cartaoNome}</p>
            <div className="lista recuo-1" style={{ marginTop: 6 }}>
              {grupo.itens.map((it) => (
                <div className="item" key={it.recorrenciaCartaoId}>
                  <span className="cresce">{it.descricao}</span>
                  <span className="valor-gasto">{formatarBRL(it.valorCent)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {itens.length === 0 && <p className="sub">Sem assinaturas no mês.</p>}
      </div>
    </Sheet>
  );
}
