import { useApp } from '../state/store';

export default function PrimeiroUso() {
  const { dados, abrirAjustes } = useApp();

  if (!dados) return null;

  const semBoxPropria = !dados.boxes.some((b) => b.saldoInicial != null);
  const semCategorias = dados.categorias.length === 0;

  if (!semBoxPropria && !semCategorias) {
    return null;
  }

  const temBoxPropria = !semBoxPropria;

  return (
    <div className="card primeiro-uso">
      <p className="rotulo" style={{ margin: 0 }}>
        PRIMEIRA VEZ POR AQUI?
      </p>
      <p style={{ margin: '12px 0' }}>
        O Flow projeta o seu saldo dia a dia — mas primeiro ele precisa saber de onde partir.
      </p>

      {!temBoxPropria ? (
        <>
          <button
            className="botao botao-primario"
            style={{ width: '100%', marginBottom: 8 }}
            onClick={() => abrirAjustes('boxes')}
          >
            Criar minha box com o saldo do banco
          </button>
          <button
            className="botao"
            style={{ width: '100%', marginBottom: 12 }}
            onClick={() => abrirAjustes('backup')}
          >
            Já uso o Flow em outro aparelho — importar backup
          </button>
          <p className="sub" style={{ margin: 0 }}>
            Depois da box vêm as categorias, e aí o primeiro lançamento cabe em três toques. A box{' '}
            <strong>casa</strong>, dos gastos divididos, já está criada.
          </p>
        </>
      ) : (
        <>
          <button
            className="botao botao-primario"
            style={{ width: '100%', marginBottom: 8 }}
            onClick={() => abrirAjustes('categorias')}
          >
            Escolher minhas categorias
          </button>
          <button
            className="botao"
            style={{ width: '100%', marginBottom: 12 }}
            onClick={() => abrirAjustes('backup')}
          >
            Já uso o Flow em outro aparelho — importar backup
          </button>
          <p className="sub" style={{ margin: 0 }}>
            Defina as categorias que você usa (Alimentação, Transporte, Diversão, etc.). Depois, o primeiro lançamento sai em três toques.
          </p>
        </>
      )}
    </div>
  );
}
