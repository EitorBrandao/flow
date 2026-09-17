import { formatarDataBR } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import * as repo from '../db/repo';
import { useApp } from '../state/store';
import Sheet from './Sheet';

/** Sheet somente leitura com o detalhe de uma transferência entre bancos (nota já traz
 *  "banco origem → banco destino", gravada por `repo.transferirEntreBancos`). Excluir apaga
 *  as duas pernas juntas, mas não reverte o saldo declarado dos bancos — aviso explícito
 *  aqui, correção manual em Ajustes → Bancos se precisar. */
export default function TransferenciaSheet({ lanc, onFechar }: { lanc: Lancamento; onFechar: () => void }) {
  const { recarregar } = useApp();

  async function excluir() {
    if (!lanc.transferenciaId) return;
    if (!window.confirm('Excluir esta transferência? Isso não desfaz o ajuste de saldo nos bancos.')) return;
    await repo.excluirTransferencia(lanc.transferenciaId);
    await recarregar();
    onFechar();
  }

  return (
    <Sheet
      aberto onFechar={onFechar} rotulo="Transferência"
      cabecalho={(
        <>
          <h2 style={{ marginTop: 0 }}>{lanc.nota}</h2>
          <p className="sub" style={{ margin: 0 }}>{formatarDataBR(lanc.data)}</p>
        </>
      )}
    >
      <div className="lista" style={{ marginTop: 8 }}>
        <div className="item">
          <div className="cresce">Valor transferido</div>
          <span className="valor-gasto">{formatarBRL(lanc.valor)}</span>
        </div>
      </div>
      <p className="aviso" style={{ marginTop: 14 }}>
        Excluir apaga os dois lançamentos, mas não desfaz o ajuste de saldo nos bancos —
        corrija em Ajustes → Bancos se precisar.
      </p>
      <button className="botao botao-perigo" style={{ marginTop: 14, width: '100%' }} onClick={excluir}>
        Excluir transferência
      </button>
    </Sheet>
  );
}
