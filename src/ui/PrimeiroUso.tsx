import { useApp, estadoPrimeiroUso } from '../state/store';

export default function PrimeiroUso() {
  const { dados, abrirAjustes } = useApp();

  if (!dados) return null;

  const { semBoxPropria, precisa } = estadoPrimeiroUso(dados);

  if (!precisa) {
    return null;
  }

  const temBoxPropria = !semBoxPropria;

  return (
    <div className="card primeiro-uso">
      <p className="rotulo">
        Primeira vez por aqui?
      </p>
      <p>
        O Flow projeta o seu saldo dia a dia — mas primeiro ele precisa saber de onde partir.
      </p>

      {!temBoxPropria ? (
        <>
          <button
            className="botao botao-primario"
            onClick={() => abrirAjustes('boxes')}
          >
            Criar minha box com o saldo do banco
          </button>
          <button
            className="botao"
            onClick={() => abrirAjustes('backup')}
          >
            Já uso o Flow em outro aparelho — importar backup
          </button>
          <p className="sub">
            Depois da box vêm as categorias, e aí o primeiro lançamento cabe em três toques. A box{' '}
            <strong>casa</strong>, dos gastos divididos, já está criada.
          </p>
        </>
      ) : (
        <>
          <button
            className="botao botao-primario"
            onClick={() => abrirAjustes('categorias')}
          >
            Escolher minhas categorias
          </button>
          <button
            className="botao"
            onClick={() => abrirAjustes('backup')}
          >
            Já uso o Flow em outro aparelho — importar backup
          </button>
          <p className="sub">
            Escolha as categorias que você usa — pode começar pelas sugeridas. Depois, o primeiro lançamento sai em três toques.
          </p>
        </>
      )}
    </div>
  );
}
