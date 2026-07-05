const URL_WIKI = 'https://claude.ai/code/artifact/71a0382a-2dc5-4867-aa74-20ebfadf04d9';

export default function Wiki() {
  return (
    <div className="tela">
      <h2>Wiki</h2>
      <p className="sub">
        Documentação de referência do Flow: o que cada tela faz, como funcionam boxes,
        recorrências, cenários e a fatura do cartão. Pensada para consulta pontual, não para
        ler de uma vez.
      </p>
      <p className="sub">
        Fica hospedada fora do app (não é dado seu fluxo de caixa — só texto explicativo).
        Pode pedir login na sua conta Claude para abrir.
      </p>
      <a
        className="botao botao-primario"
        href={URL_WIKI}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textAlign: 'center', textDecoration: 'none' }}
      >
        Abrir wiki do Flow ↗
      </a>
    </div>
  );
}
