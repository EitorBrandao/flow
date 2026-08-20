import { useEffect, useMemo, useState } from 'react';
import type { Cartao } from '../domain/types';
import { frequentes, type ChipFrequente } from '../domain/aggregations';
import { formatarSemSimbolo } from '../domain/money';
import { boxIdEfetivo, boxIdsSelecionadas, useApp } from '../state/store';
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
  const { dados, boxSel, hoje, setAba, setRascunhoLancar } = useApp();
  const [passo, setPasso] = useState<Passo>('menu');
  const [cartaoEscolhido, setCartaoEscolhido] = useState<Cartao | null>(null);
  const [inicialCompra, setInicialCompra] =
    useState<{ valorTotal: number; categoriaCartaoId: string } | null>(null);

  const chips = useMemo(() => {
    if (!dados) return [];
    const ids = boxIdsSelecionadas(dados, boxSel);
    const cartaoIds = dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId)).map((c) => c.id);
    return frequentes(dados, { hoje, boxId: boxIdEfetivo(dados, boxSel), cartaoIds });
  }, [dados, boxSel, hoje]);

  useEffect(() => {
    if (!aberto) { setPasso('menu'); setCartaoEscolhido(null); setInicialCompra(null); }
  }, [aberto]);

  if (!dados) return null;
  const ids = boxIdsSelecionadas(dados, boxSel);
  const cartoesAtivos = dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId));

  function nomeCartaoDe(chip: ChipFrequente): string | null {
    if (chip.destino.tipo !== 'cartao') return null;
    const dest = chip.destino as Extract<typeof chip.destino, { tipo: 'cartao' }>;
    return dados!.cartoes.find((c) => c.id === dest.cartaoId)?.nome ?? null;
  }

  function tocarChip(chip: ChipFrequente) {
    if (chip.destino.tipo === 'cartao') {
      const dest = chip.destino as Extract<typeof chip.destino, { tipo: 'cartao' }>;
      const cartao = dados!.cartoes.find((c) => c.id === dest.cartaoId);
      if (!cartao) return;
      setCartaoEscolhido(cartao);
      setInicialCompra({
        valorTotal: chip.valorCent, categoriaCartaoId: dest.categoriaCartaoId,
      });
      setPasso('form');
      return;
    }
    if (chip.destino.tipo === 'box') {
      const dest = chip.destino as Extract<typeof chip.destino, { tipo: 'box' }>;
      setRascunhoLancar({ categoriaId: dest.categoriaId, valorCent: chip.valorCent });
      onFechar();
      setAba('lancar');
    }
  }

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
          {chips.length > 0 && (
            <>
              <p className="rotulo-grupo">Frequentes</p>
              <div className="frequentes">
                {chips.map((chip) => {
                  const nomeCartao = nomeCartaoDe(chip);
                  const valor = formatarSemSimbolo(chip.valorCent);
                  return (
                    <button
                      key={chip.chave}
                      className="frequentes-chip"
                      aria-label={`${chip.rotulo}, ${nomeCartao ? `no ${nomeCartao}` : 'nesta box'}, ${valor}`}
                      onClick={() => tocarChip(chip)}
                    >
                      {nomeCartao && <span className="frequentes-ponto" aria-hidden="true" />}
                      {chip.rotulo}
                      <span className="frequentes-detalhe">{valor}</span>
                    </button>
                  );
                })}
              </div>
              {chips.some((c) => c.destino.tipo === 'cartao') && (
                <p className="sub">● vai para o cartão</p>
              )}
            </>
          )}
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
        <FormCompra
          cartao={cartaoEscolhido}
          {...(inicialCompra ? { inicial: inicialCompra } : {})}
          onFechar={onFechar}
        />
      )}
    </Sheet>
  );
}
