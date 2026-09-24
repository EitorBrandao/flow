import type { FaturaForaDoFluxo } from '../domain/fatura';
import { formatarBRL } from '../domain/money';

/** Aviso de fatura que não bate com o Fluxo (ver `faturaForaDoFluxo`). Um componente só para a
 *  aba Cartão e a folha da fatura aberta pelo Fluxo dizerem exatamente a mesma frase. */
export default function AvisoFaturaForaDoFluxo({ situacao, onCorrigir }: {
  situacao: FaturaForaDoFluxo;
  /** Abre a correção do pagamento já com o valor que fecha a conta. */
  onCorrigir: (valorSugeridoCent: number) => void;
}) {
  if (situacao.tipo === 'vencida-sem-lancamento') {
    return (
      <p className="aviso" style={{ margin: '12px 0 0' }}>
        Essa fatura ficou de fora do Fluxo: as compras entraram depois do vencimento. Se já pagou,
        tá tudo certo.
      </p>
    );
  }
  return (
    <p className="aviso" style={{ margin: '12px 0 0' }}>
      Tem {formatarBRL(situacao.diferencaCent)} nessa fatura que não chegaram no Fluxo: o pagamento
      registrado foi menor.{' '}
      <button className="botao-ver-mais" onClick={() => onCorrigir(situacao.valorSugeridoCent)}>
        Corrigir o valor pago
      </button>
    </p>
  );
}
