import { animate, motion, useDragControls, useMotionValue } from 'framer-motion';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useTravarRolagem } from './useTravarRolagem';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  rotulo?: string;
  cabecalho?: ReactNode;
  children: ReactNode;
}

// Quanto puxar para baixo (px) ou com que velocidade (px/s) o sheet fecha ao soltar.
const DISTANCIA_FECHAR = 80;
const VELOCIDADE_FECHAR = 500;

export default function Sheet({ aberto, onFechar, rotulo, cabecalho, children }: Props) {
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const onFecharRef = useRef(onFechar);
  onFecharRef.current = onFechar;
  useTravarRolagem(aberto);

  // Puxar o conteúdo para baixo quando ele já está no topo arrasta o sheet, como nos
  // sheets nativos. Fora disso o toque rola o conteúdo. Precisa de touchmove não-passivo
  // para impedir a rolagem do navegador — por isso o listener é nativo, não do React.
  useEffect(() => {
    const el = conteudoRef.current;
    if (!aberto || !el) return;
    let inicio: { x: number; y: number } | null = null;
    let modo: 'sheet' | 'rolar' | null = null;
    let ultimo = { y: 0, t: 0 };
    let velocidade = 0;

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) { inicio = null; return; }
      inicio = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      modo = null;
      velocidade = 0;
      ultimo = { y: inicio.y, t: e.timeStamp };
    }
    function onMove(e: TouchEvent) {
      if (!inicio || modo === 'rolar') return;
      const t = e.touches[0];
      const dy = t.clientY - inicio.y;
      if (modo === null) {
        const dx = t.clientX - inicio.x;
        if (dy === 0 && dx === 0) return;
        modo = el!.scrollTop <= 0 && dy > 0 && dy >= Math.abs(dx) ? 'sheet' : 'rolar';
        if (modo === 'rolar') return;
      }
      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - ultimo.t;
      if (dt > 0) velocidade = ((t.clientY - ultimo.y) / dt) * 1000;
      ultimo = { y: t.clientY, t: e.timeStamp };
      y.set(Math.max(0, dy));
    }
    function onEnd() {
      if (modo === 'sheet') {
        if (y.get() > DISTANCIA_FECHAR || velocidade > VELOCIDADE_FECHAR) onFecharRef.current();
        else animate(y, 0, { type: 'spring', damping: 32, stiffness: 340 });
      }
      inicio = null;
      modo = null;
    }
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [aberto, y]);

  if (!aberto) return null;
  const iniciarArrasto = (e: ReactPointerEvent) => dragControls.start(e);
  return (
    <motion.div
      className="sheet-backdrop" data-testid="sheet-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
      onClick={onFechar}
    >
      <motion.div
        className="sheet" role="dialog" aria-modal="true" aria-label={rotulo}
        style={{ y }}
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        drag="y" dragListener={false} dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > DISTANCIA_FECHAR || info.velocity.y > VELOCIDADE_FECHAR) onFechar();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-alca" aria-hidden="true" onPointerDown={iniciarArrasto} />
        {cabecalho && <div className="sheet-cabecalho" onPointerDown={iniciarArrasto}>{cabecalho}</div>}
        <div className="sheet-conteudo" ref={conteudoRef}>{children}</div>
      </motion.div>
    </motion.div>
  );
}
