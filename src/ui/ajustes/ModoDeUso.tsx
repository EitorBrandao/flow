import * as repo from '../../db/repo';
import { modoDe } from '../../domain/modos';
import { TELAS_MODO, type ModoUso, type TelaModo } from '../../domain/types';
import { useApp } from '../../state/store';

const NOMES: Record<TelaModo, string> = {
  hoje: 'Hoje', fluxo: 'Fluxo', cartao: 'Cartão', analises: 'Análises', lancar: 'Lançar (+)',
};

const RESUMOS: Record<TelaModo, Record<ModoUso, string>> = {
  hoje: {
    simples: 'Saldo, projeção e conferência com um número só.',
    avancado: 'Conferir por banco, transferência entre bancos, cheque especial.',
  },
  fluxo: {
    simples: 'Lista, gráfico e Simular (“e se eu gastar…”).',
    avancado: 'Filtro por banco, cenários completos, “Tornar real”.',
  },
  cartao: {
    simples: 'Só o valor da fatura e o vencimento.',
    avancado: 'Compras, parcelas, categorias, assinaturas, conferência.',
  },
  analises: {
    simples: 'Só o mês: resumo, categorias e evolução.',
    avancado: 'Períodos longos, Viagens, Comparativo, categorias do cartão.',
  },
  lancar: {
    simples: 'Valor, Gasto/Ganho e descrição opcional. Igual em qualquer tela.',
    avancado: 'Todos os campos. Igual em qualquer tela.',
  },
};

const ROTULO_MODO: Record<ModoUso, string> = { simples: 'Simples', avancado: 'Avançado' };

export default function ModoDeUso() {
  const dados = useApp((s) => s.dados);
  const recarregar = useApp((s) => s.recarregar);

  async function escolher(tela: TelaModo, modo: ModoUso) {
    await repo.salvarModo(tela, modo);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Modo de uso</h2>
      <div className="card lista">
        <div className="sub">
          Escolha o quanto de detalhe cada tela mostra. Seus dados são os mesmos nos dois modos e nada se perde ao trocar.
        </div>
        {TELAS_MODO.map((tela) => {
          const modo = dados ? modoDe(dados.config, tela) : 'avancado';
          return (
            <div className="item item-coluna" key={tela} style={{ background: 'var(--surface2)' }}>
              <div className="linha">
                <strong>{NOMES[tela]}</strong>
                <span className="badge">{ROTULO_MODO[modo]}</span>
              </div>
              <div className="pills">
                {(['simples', 'avancado'] as const).map((m) => (
                  <button key={m} className={modo === m ? 'ativo' : undefined} onClick={() => escolher(tela, m)}>
                    {ROTULO_MODO[m]}
                  </button>
                ))}
              </div>
              <div className="sub">{RESUMOS[tela][modo]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
