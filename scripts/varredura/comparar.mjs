// scripts/varredura/comparar.mjs
// Separa achado novo de achado conhecido. Função pura, para poder ser testada sem navegador.

/** Chave estável de um achado. Dígitos viram "#": datas e contagens mudam de um dia para o outro. */
export function chaveDoAchado({ passo, tipo, alvo }) {
  return `${passo} | ${tipo} | ${String(alvo).replace(/\d+/g, '#')}`;
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
