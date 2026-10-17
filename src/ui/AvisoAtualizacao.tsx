import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../state/store';
import { versaoAtual } from './ajustes/versaoAtual';

const CHAVE_VERSAO_VISTA = 'flow:versao-vista';
const DURACAO_MS = 2000;

function lerVersaoVista(): string | null {
  try {
    return localStorage.getItem(CHAVE_VERSAO_VISTA);
  } catch {
    return null;
  }
}

function gravarVersaoVista(versao: string): void {
  try {
    localStorage.setItem(CHAVE_VERSAO_VISTA, versao);
  } catch {
    // Sem armazenamento, o aviso só deixa de aparecer nas próximas aberturas.
  }
}

// Aviso de 2 s, acima do "+", na primeira abertura depois de uma atualização.
// A primeira instalação não tem versão anterior e não avisa.
export default function AvisoAtualizacao() {
  const abrirAjustes = useApp((s) => s.abrirAjustes);
  const [visivel, setVisivel] = useState(() => {
    const vista = lerVersaoVista();
    return versaoAtual !== '' && vista != null && vista !== versaoAtual;
  });

  useEffect(() => {
    if (versaoAtual !== '') gravarVersaoVista(versaoAtual);
    if (!visivel) return;
    const id = setTimeout(() => setVisivel(false), DURACAO_MS);
    return () => clearTimeout(id);
  }, [visivel]);

  return (
    <div className="aviso-atualizacao-pista">
      <AnimatePresence>
        {visivel && (
          <motion.button
            className="aviso-atualizacao"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={() => { setVisivel(false); abrirAjustes('versao'); }}
          >
            Nova versão atualizada · <u>Ver atualizações</u>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
