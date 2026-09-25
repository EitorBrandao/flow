import { TriangleAlert } from 'lucide-react';
import { formatarBRL } from '../domain/money';
import { situacaoOrcamento } from '../domain/viagem';

/** "R$ X de R$ Y · falta/passou R$ Z" — o único texto do orçamento de viagem, usado na tela de
 *  adicionar (débito e cartão) e em Ajustes → Viagens. Cores das conferências: verde para o que
 *  sobra, vermelho para o que passou. O ícone fica dentro do valor para herdar o vermelho. */
export default function LinhaOrcamentoViagem({ orcamentoCent, gastoCent, comEsteGasto = false }: {
  orcamentoCent: number;
  gastoCent: number;
  /** a linha já soma o valor que está sendo digitado */
  comEsteGasto?: boolean;
}) {
  const { restanteCent } = situacaoOrcamento(orcamentoCent, gastoCent);
  return (
    <p className="sub" style={{ margin: 0 }}>
      {comEsteGasto && 'Com este gasto: '}
      {formatarBRL(gastoCent)} de {formatarBRL(orcamentoCent)} ·{' '}
      {restanteCent >= 0 ? (
        <>falta <strong className="valor-ganho">{formatarBRL(restanteCent)}</strong></>
      ) : (
        <>passou <strong className="valor-gasto">
          <TriangleAlert size={16} aria-hidden="true" style={{ verticalAlign: -3, marginRight: 4 }} />
          {formatarBRL(-restanteCent)}
        </strong></>
      )}
    </p>
  );
}
