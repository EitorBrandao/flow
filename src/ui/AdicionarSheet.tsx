import { useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import type { Cartao } from '../domain/types';
import { frequentes, type ChipFrequente } from '../domain/aggregations';
import { formatarSemSimbolo } from '../domain/money';
import type { NotaFiscalExtraida } from '../domain/notaFiscal';
import { boxIdEfetivo, boxIdsSelecionadas, useApp } from '../state/store';
import EscanearNotaSheet from './EscanearNotaSheet';
import FormCompra, { type InicialCompra } from './FormCompra';
import Sheet from './Sheet';

type Passo = 'menu' | 'sem-cartao' | 'escolher-cartao' | 'escanear' | 'form';

const ROTULOS: Record<Passo, string> = {
  menu: 'Adicionar',
  'sem-cartao': 'Nenhum cartão cadastrado',
  'escolher-cartao': 'Compra em qual cartão?',
  escanear: 'Compra por nota fiscal',
  form: 'Nova compra',
};

export default function AdicionarSheet({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { dados, boxSel, hoje, setAba, setRascunhoLancar } = useApp();
  const [passo, setPasso] = useState<Passo>('menu');
  const [cartaoEscolhido, setCartaoEscolhido] = useState<Cartao | null>(null);
  const [inicialCompra, setInicialCompra] = useState<InicialCompra | null>(null);

  const cartoesAtivos = useMemo(() => {
    if (!dados) return [];
    const ids = boxIdsSelecionadas(dados, boxSel);
    return dados.cartoes.filter((c) => c.ativo && ids.includes(c.boxId));
  }, [dados, boxSel]);

  const chips = useMemo(() => {
    if (!dados) return [];
    const cartaoIds = cartoesAtivos.map((c) => c.id);
    return frequentes(dados, { hoje, boxId: boxIdEfetivo(dados, boxSel), cartaoIds });
  }, [dados, boxSel, hoje, cartoesAtivos]);

  useEffect(() => {
    if (!aberto) { setPasso('menu'); setCartaoEscolhido(null); setInicialCompra(null); }
  }, [aberto]);

  if (!dados) return null;

  function nomeCartaoDe(chip: ChipFrequente): string | null {
    const destino = chip.destino;
    if (destino.tipo !== 'cartao') return null;
    return dados!.cartoes.find((c) => c.id === destino.cartaoId)?.nome ?? null;
  }

  function tocarChip(chip: ChipFrequente) {
    const destino = chip.destino;
    if (destino.tipo === 'cartao') {
      const cartao = dados!.cartoes.find((c) => c.id === destino.cartaoId);
      // Inalcançável: o chip e este handler leem o mesmo snapshot de `dados`, no mesmo
      // render — o cartão do chip sempre existe aqui. É só proteção de tipos.
      if (!cartao) return;
      setCartaoEscolhido(cartao);
      setInicialCompra({
        valorTotal: chip.valorCent, categoriaCartaoId: destino.categoriaCartaoId,
      });
      setPasso('form');
    } else {
      setRascunhoLancar({ categoriaId: destino.categoriaId, valorCent: chip.valorCent });
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

  function irParaEscanear() {
    setPasso('escanear');
  }

  function aoConcluirEscaneamento(resultado: NotaFiscalExtraida) {
    setInicialCompra({
      ...(resultado.valorTotal != null ? { valorTotal: resultado.valorTotal } : {}),
      ...(resultado.data != null ? { data: resultado.data } : {}),
      ...(resultado.descricao != null ? { descricao: resultado.descricao } : {}),
    });
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ marginTop: 0 }}>Adicionar</h2>
            <button className="chip" aria-label="Compra por nota fiscal" onClick={irParaEscanear}>
              <Camera size={18} />
            </button>
          </div>
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
                <p className="sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="frequentes-ponto" aria-hidden="true" /> vai para o cartão
                </p>
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
      {passo === 'escanear' && (
        <EscanearNotaSheet onConcluir={aoConcluirEscaneamento} onFechar={() => setPasso('menu')} />
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
