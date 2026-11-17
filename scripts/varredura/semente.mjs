// scripts/varredura/semente.mjs
// Dados sintéticos da varredura. Roda dentro da página (page.evaluate) e grava pelo próprio
// repo do app. Valores em centavos inteiros; nomes inventados; datas relativas a hoje.

export async function semear() {
  const repo = await import(/* @vite-ignore */ `${document.baseURI.replace(/\/$/, '')}/src/db/repo.ts`);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const agora = new Date().toISOString();
  const avancado = { hoje: 'avancado', fluxo: 'avancado', cartao: 'avancado', analises: 'avancado', lancar: 'avancado' };

  await repo.salvarConfig({ modos: avancado });
  await repo.salvarBox({
    id: 'box-carteira', nome: 'carteira', saldoInicial: 420_000, dataSaldoInicial: dia(-40),
    criadoEm: agora, alteradoEm: agora, modos: avancado,
  });
  const banco = await repo.salvarBanco({ boxId: 'box-carteira', nome: 'banco azul', ordem: 0 });

  const categorias = {};
  await repo.salvarBanco({ boxId: 'box-carteira', nome: 'banco verde', ordem: 1 });
  // Uso real: viagem ativa cobrindo hoje, que acrescenta campos ao formulário de lançamento.
  await repo.salvarViagem({ nome: 'viagem de teste', dataInicio: dia(-3), dataFim: dia(4), orcamentoCent: 300_000 });

  const lista = [['salário', 'ganho'], ['mercado', 'gasto'], ['moradia', 'gasto'], ['jardinagem', 'gasto'], ['lazer', 'gasto'],
    ['papelaria', 'gasto'], ['oficina', 'gasto'], ['aquário', 'gasto']];
  for (const [ordem, [nome, tipo]] of lista.entries()) {
    categorias[nome] = await repo.salvarCategoria({ boxId: 'box-carteira', nome, tipo, ordem });
  }

  // Previstos manuais: recorrência não materializa o passado, então não gera pendente vencido.
  const previstos = [['salário', -2, 650_000, 'Pagamento do mês'], ['moradia', -1, 185_000, 'Aluguel'], ['jardinagem', 0, 11_990, ''], ['lazer', 2, 26_000, 'Ingresso de show']];
  for (const [categoria, quando, valor, nota] of previstos) {
    await repo.salvarLancamento({
      boxId: 'box-carteira', categoriaId: categorias[categoria].id, data: dia(quando),
      valor, nota, status: 'previsto', bancoId: banco.id,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    await repo.salvarLancamento({
      boxId: 'box-carteira', categoriaId: categorias.mercado.id, data: dia(-i * 2),
      valor: 4_500 + i * 1_111, nota: `Feira ${i + 1}`, status: 'efetivo', bancoId: banco.id,
    });
  }
}
