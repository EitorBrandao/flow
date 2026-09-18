import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import * as repo from '../../db/repo';
import { limparDb } from '../../test-setup';
import { useApp } from '../../state/store';
import Importar from './Importar';

const CABECALHO = 'Data,Valor,Identificador,Descrição';

beforeEach(async () => {
  await limparDb();
});

describe('Importar', () => {
  it('estado vazio: mostra só o passo 1, sem destino nem conferência', async () => {
    await useApp.getState().iniciar();
    render(<Importar />);

    expect(screen.getByText(/Escolha o CSV do extrato do Nubank/)).toBeInTheDocument();
    expect(screen.queryByText('2. Destino')).not.toBeInTheDocument();
    expect(screen.queryByText('3. Conferir')).not.toBeInTheDocument();
  });

  it('fluxo completo com o CSV do Nubank: lista os dois lançamentos e grava com a categoria certa', async () => {
    await useApp.getState().iniciar();
    render(<Importar />);

    const csv = [
      CABECALHO,
      '20/08/2026,150.00,1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d,PAGAMENTO RECEBIDO',
      '21/08/2026,-45.00,2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e,LOJA GAMA',
    ].join('\n');
    const arquivo = new File([csv], 'extrato-nubank.csv', { type: 'text/csv' });

    await userEvent.upload(screen.getByLabelText('Escolher arquivo'), arquivo);

    await screen.findByText(/Reconhecido: Nubank/);
    expect(await screen.findByText('LOJA GAMA')).toBeInTheDocument();
    expect(screen.getByText('PAGAMENTO RECEBIDO')).toBeInTheDocument();

    const botaoConfirmar = await screen.findByRole('button', { name: /Confirmar — 2 mudanças/ });
    await userEvent.click(botaoConfirmar);

    await screen.findByText(/2 adicionados/);

    const dados = await repo.carregarTudo();
    expect(dados.lancamentos).toHaveLength(2);

    const entrada = dados.lancamentos.find((l) => l.nota === 'PAGAMENTO RECEBIDO');
    const saida = dados.lancamentos.find((l) => l.nota === 'LOJA GAMA');
    expect(entrada).toBeDefined();
    expect(saida).toBeDefined();

    // O ponto que este teste protege: quem decide entrada/saída no Flow é o TIPO da
    // categoria, não o sinal do bruto — uma entrada gravada em categoria de gasto tiraria o
    // valor da projeção em vez de somar (ver "A categoria padrão depende do sinal" na spec).
    const categoriaEntrada = dados.categorias.find((c) => c.id === entrada!.categoriaId);
    const categoriaSaida = dados.categorias.find((c) => c.id === saida!.categoriaId);
    expect(categoriaEntrada?.tipo).toBe('ganho');
    expect(categoriaSaida?.tipo).toBe('gasto');
  });
});
