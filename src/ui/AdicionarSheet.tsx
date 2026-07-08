import { useEffect, useState } from 'react';
import type { Cartao } from '../domain/types';
import { boxIdsSelecionadas, useApp } from '../state/store';
import FormCompra from './FormCompra';
import Sheet from './Sheet';

type Passo = 'menu' | 'sem-cartao' | 'escolher-cartao' | 'form';

const ROTULOS: Record<Passo, string> = {
  menu: 'Adicionar',
  'sem-cartao': 'Nenhum cartão cadastrado',
  'escolher-cartao': 'Compra em qual cartão?',
  form: 'Nova compra',
};

export default function AdicionarSheet({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { dados, boxSel, setAba } = useApp();
  const [passo, setPasso] = useState<Passo>('menu');
  const [cartaoEscolhido, setCartaoEscolhido] = useState<Cartao | null>(null);

  useEffect(() => {
    if (!aberto) { setPasso('menu'); setCartaoEscolhido(null); }
  }, [aberto]);

  if (!dados) return null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const cartoesAtivos = dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId));

  function irParaLancamento() {
    onFechar();
    setAba('lancar');
  }

  function irParaCompra() {
    if (cartoesAtivos.length === 0) { setPasso('sem-cartao'); return; }
    if (cartoesAtivos.length === 1) { setCartaoEscolhido(cartoesAtivos[0]); setPasso('form'); return; }
    setPasso('escolher-cartao');
  }

  function irParaAjustes() {
    onFechar();
    setAba('ajustes');
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} rotulo={ROTULOS[passo]}>
      {passo === 'menu' && (
        <>
          <h2 style={{ marginTop: 0 }}>Adicionar</h2>
          <div className="lista">
            <button className="item" onClick={irParaLancamento}>
              <div className="cresce">
                <div>Lançamento</div>
                <div className="sub">Gasto ou ganho avulso</div>
              </div>
            </button>
            <button className="item" onClick={irParaCompra}>
              <div className="cresce">
                <div>Compra no cartão</div>
                <div className="sub">Com parcelas, entra direto na fatura</div>
              </div>
            </button>
          </div>
        </>
      )}
      {passo === 'sem-cartao' && (
        <>
          <h2 style={{ marginTop: 0 }}>Nenhum cartão cadastrado</h2>
          <p className="sub">Cadastre um cartão em Ajustes antes de lançar uma compra parcelada.</p>
          <button className="botao botao-primario" onClick={irParaAjustes}>Cadastrar cartão</button>
        </>
      )}
      {passo === 'escolher-cartao' && (
        <>
          <h2 style={{ marginTop: 0 }}>Compra em qual cartão?</h2>
          <div className="lista">
            {cartoesAtivos.map((c) => (
              <button className="item" key={c.id} onClick={() => { setCartaoEscolhido(c); setPasso('form'); }}>
                <div className="cresce">{c.nome}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {passo === 'form' && cartaoEscolhido && (
        <FormCompra cartao={cartaoEscolhido} onFechar={onFechar} />
      )}
    </Sheet>
  );
}
