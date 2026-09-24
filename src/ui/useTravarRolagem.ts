import { useEffect } from 'react';

// Janelas sobrepostas (sheet, gráfico expandido, índice da wiki) tomam o toque para si:
// enquanto houver uma aberta, a página de trás não rola nem dispara o "puxar para recarregar".
// O contador cobre janela aberta por cima de outra: só a última a fechar destrava.
let abertas = 0;
let anterior: { overflow: string; overscroll: string } | null = null;

export function useTravarRolagem(ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    const html = document.documentElement;
    if (abertas === 0) {
      anterior = { overflow: html.style.overflow, overscroll: html.style.overscrollBehavior };
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
    }
    abertas++;
    return () => {
      abertas--;
      if (abertas === 0 && anterior) {
        html.style.overflow = anterior.overflow;
        html.style.overscrollBehavior = anterior.overscroll;
        anterior = null;
      }
    };
  }, [ativo]);
}
