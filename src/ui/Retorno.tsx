import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../state/store';

const DURACAO_MS = 3000;
const DURACAO_COM_DESFAZER_MS = 6000;
// Folga entre o aviso e a borda de cima do sheet, e espaço mínimo que o aviso mantém
// abaixo do topo da janela (altura da pílula mais respiro).
const FOLGA_SHEET = 8;
const MARGEM_TOPO = 60;

/** `bottom` (px) que põe a pista logo acima do sheet mais à frente; null sem sheet aberto. */
function bottomAcimaDoSheet(): number | null {
  const sheets = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  const topo = sheets[sheets.length - 1];
  if (!topo) return null;
  const bottom = window.innerHeight - topo.getBoundingClientRect().top + FOLGA_SHEET;
  // Sheet quase da altura da tela: o aviso não pode sair pelo topo da janela.
  return Math.min(Math.round(bottom), window.innerHeight - MARGEM_TOPO);
}

// Aviso de retorno: diz o que acabou de acontecer e, quando a ação tem volta, oferece
// "Desfazer". Mora na mesma faixa do aviso de atualização, acima da barra de navegação, e
// fica acima dos sheets; com um sheet aberto, sobe para logo acima da borda dele. Regras em docs/estilo/interacao.md.
export default function Retorno() {
  const retorno = useApp((s) => s.retorno);
  const limparRetorno = useApp((s) => s.limparRetorno);
  const [ocupado, setOcupado] = useState(false);
  const [bottom, setBottom] = useState<number | null>(null);

  useEffect(() => {
    if (!retorno) return;
    const id = setTimeout(limparRetorno, retorno.desfazer ? DURACAO_COM_DESFAZER_MS : DURACAO_MS);
    return () => clearTimeout(id);
  }, [retorno, limparRetorno]);

  // Com um sheet aberto, a pista sobe para logo acima dele. O sheet anima e muda de
  // tamanho sem avisar, então a posição é conferida a cada quadro, só enquanto há aviso.
  const visivel = retorno !== null;
  useEffect(() => {
    if (!visivel) { setBottom(null); return; }
    let quadro = 0;
    const conferir = () => {
      setBottom(bottomAcimaDoSheet());
      quadro = requestAnimationFrame(conferir);
    };
    conferir();
    return () => cancelAnimationFrame(quadro);
  }, [visivel]);

  async function desfazer() {
    if (!retorno?.desfazer || ocupado) return;
    setOcupado(true);
    try {
      await retorno.desfazer();
      await useApp.getState().recarregar();
      // Só fecha o aviso que foi desfeito: outro pode ter chegado enquanto isso.
      if (useApp.getState().retorno?.id === retorno.id) limparRetorno();
    } catch (e) {
      console.error('Falha ao desfazer:', e);
      useApp.getState().avisar('Não foi possível desfazer');
    } finally {
      setOcupado(false);
    }
  }

  return createPortal(
    <div
      className="retorno-pista" role="status" aria-live="polite"
      style={bottom === null ? undefined : { bottom }}
    >
      <AnimatePresence>
        {retorno && (
          <motion.div
            key={retorno.id} className="retorno"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            <span>{retorno.texto}</span>
            {retorno.desfazer && (
              <button type="button" className="retorno-acao" onClick={desfazer} disabled={ocupado}>Desfazer</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
