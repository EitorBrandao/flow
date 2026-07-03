import { useEffect } from 'react';
import { useApp } from './state/store';
import Shell from './ui/Shell';

export default function App() {
  const carregado = useApp((s) => s.carregado);
  const iniciar = useApp((s) => s.iniciar);
  useEffect(() => {
    void iniciar();
  }, [iniciar]);
  if (!carregado) return <p style={{ padding: 24 }}>Carregando…</p>;
  return <Shell />;
}
