import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  rotulo?: string;
  children: ReactNode;
}

export default function Sheet({ aberto, onFechar, rotulo, children }: Props) {
  if (!aberto) return null;
  return (
    <motion.div
      className="sheet-backdrop" data-testid="sheet-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
      onClick={onFechar}
    >
      <motion.div
        className="sheet" role="dialog" aria-modal="true" aria-label={rotulo}
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 80 || info.velocity.y > 500) onFechar();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-alca" aria-hidden="true" />
        {children}
      </motion.div>
    </motion.div>
  );
}
