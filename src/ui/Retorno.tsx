import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../state/store';

const DURACAO_MS = 3000;
const DURACAO_COM_DESFAZER_MS = 6000;

// Aviso de retorno: diz o que acabou de acontecer e, quando a ação tem volta, oferece
// "Desfazer". Mora na mesma faixa do aviso de atualização, acima da barra de navegação, e
// fica acima dos sheets. Regras em docs/estilo/interacao.md.
export default function Retorno() {
  const retorno = useApp((s) => s.retorno);
  const limparRetorno = useApp((s) => s.limparRetorno);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!retorno) return;
    const id = setTimeout(limparRetorno, retorno.desfazer ? DURACAO_COM_DESFAZER_MS : DURACAO_MS);
    return () => clearTimeout(id);
  }, [retorno, limparRetorno]);

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
    <div className="retorno-pista" role="status" aria-live="polite">
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
