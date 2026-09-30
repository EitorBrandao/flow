import { formatarDataBR } from '../domain/dates';
import { formatarBRL } from '../domain/money';
import type { Lancamento } from '../domain/types';
import * as repo from '../db/repo';
import { useApp } from '../state/store';
import Sheet from './Sheet';

/** Sheet somente leitura com o detalhe de uma transferência entre bancos (nota já traz
 *  "banco origem → banco destino", gravada por `repo.transferirEntreBancos`). Excluir apaga
 *  as duas pernas juntas. Só em transferência feita antes do banco no lançamento o saldo
 *  informado dos bancos já tinha sido ajustado e não volta sozinho — daí o aviso. */
export default function TransferenciaSheet({ lanc, onFechar }: { lanc: Lancamento; onFechar: () => void }) {
  const { recarregar } = useApp();

  async function excluir() {
    if (!lanc.transferenciaId) return;
    if (!window.confirm('Excluir esta transferência? Os dois lançamentos serão apagados.')) return;
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
        Excluir apaga os dois lançamentos. Numa transferência feita antes desta versão, o saldo
        informado dos bancos já tinha sido ajustado e não volta sozinho — corrija em Ajustes → Bancos
        se precisar.
      </p>
      <button className="botao botao-perigo" style={{ marginTop: 14, width: '100%' }} onClick={excluir}>
        Excluir transferência
      </button>
    </Sheet>
  );
}
