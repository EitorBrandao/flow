// scripts/varredura/comparar.mjs
// Separa achado novo de achado conhecido. Função pura, para poder ser testada sem navegador.

/**
 * Chave estável de um achado: `tipo | alvo`. Dígitos viram "#": datas e contagens mudam de um dia para o outro.
 * O passo fica de fora de propósito: o mesmo elemento visto em duas telas (ex.: a barra de navegação)
 * é um achado só. Um passo novo que visita uma tela já conhecida não acusa de novo os mesmos elementos.
 */
export function chaveDoAchado({ tipo, alvo }) {
  return `${tipo} | ${String(alvo).replace(/\d+/g, '#')}`;
}

/** `novos`: achados fora da lista de conhecidos. `resolvidos`: conhecidos que não apareceram. */
export function comparar(achados, conhecidos) {
  const aceitos = new Set(conhecidos);
  const vistos = new Set();
  const novos = [];
  for (const achado of achados) {
    const chave = chaveDoAchado(achado);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    if (!aceitos.has(chave)) novos.push(achado);
  }
  return { novos, resolvidos: conhecidos.filter((c) => !vistos.has(c)) };
}
