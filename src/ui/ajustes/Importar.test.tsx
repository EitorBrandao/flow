import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import { db } from '../../db/database';
import type { Dados } from '../../domain/types';
import { boxSheetFixture, simulacoesFixture } from '../../importer/fixtures';
import { useApp } from '../../state/store';
import Importar, { precisaConfirmarReimport } from './Importar';

// jsdom (nesta versão) não implementa File.prototype.arrayBuffer — só usado nesta suíte de
// teste para permitir o fluxo real de upload via userEvent.upload; produção não é afetada.
if (typeof File.prototype.arrayBuffer !== 'function') {
  File.prototype.arrayBuffer = function (this: File) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as ArrayBuffer);
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(this);
    });
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

/** Monta um workbook real (bytes), no mesmo estilo de src/importer/xlsx.test.ts. */
function montarWorkbookBytes(): ArrayBuffer {
  const wb: XLSX.WorkBook = {
    SheetNames: ['box (eitor)', 'box (Ju)', 'box (casa)', 'Simulacoes_Eitor'],
    Sheets: {
      'box (eitor)': boxSheetFixture(),
      'box (Ju)': boxSheetFixture(),
      'box (casa)': boxSheetFixture(),
      Simulacoes_Eitor: simulacoesFixture(),
    },
  };
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('precisaConfirmarReimport', () => {
  it('falso quando não há dados nem null', () => {
    expect(precisaConfirmarReimport(null)).toBe(false);
  });

  it('falso quando não há lançamento nem recorrência de origem import', () => {
    const dados = { lancamentos: [{ origem: 'manual' }], recorrencias: [] } as unknown as Dados;
    expect(precisaConfirmarReimport(dados)).toBe(false);
  });

  it('verdadeiro quando existe lançamento de origem import', () => {
    const dados = { lancamentos: [{ origem: 'import' }], recorrencias: [] } as unknown as Dados;
    expect(precisaConfirmarReimport(dados)).toBe(true);
  });

  it('verdadeiro quando existe recorrência de origem import', () => {
    const dados = { lancamentos: [], recorrencias: [{ origem: 'import' }] } as unknown as Dados;
    expect(precisaConfirmarReimport(dados)).toBe(true);
  });
});

describe('Importar (fluxo completo)', () => {
  it('primeira importação não pede confirmação; reimportação exige confirmação explícita antes de substituir', async () => {
    await useApp.getState().iniciar();
    useApp.setState({ hoje: '2026-01-02' });

    render(<Importar />);
    const input = screen.getByLabelText('Planilha');

    // 1ª importação: nada de origem 'import' existe ainda -> sem etapa de confirmação
    await userEvent.upload(input, new File([montarWorkbookBytes()], 'planilha.xlsx'));
    const aceitar1 = await screen.findByRole('button', { name: 'Aceitar e importar' });
    await waitFor(() => expect(aceitar1).not.toBeDisabled());
    await userEvent.click(aceitar1);
    await screen.findByText('Import concluído ✓ — confira o saldo na tela Hoje.');

    const importados1 = await db.lancamentos.where('origem').equals('import').toArray();
    expect(importados1.length).toBeGreaterThan(0);

    // 2ª importação (reimport): já existem lançamentos de origem 'import' -> exige confirmação
    await userEvent.upload(screen.getByLabelText('Planilha'), new File([montarWorkbookBytes()], 'planilha2.xlsx'));
    const aceitar2 = await screen.findByRole('button', { name: 'Aceitar e importar' });
    await waitFor(() => expect(aceitar2).not.toBeDisabled());
    await userEvent.click(aceitar2);

    // não deve ter aplicado ainda — a mensagem de confirmação de substituição deve aparecer
    const mensagemConfirmacao = await screen.findByText('Confirmar substituição dos dados importados?');
    expect(mensagemConfirmacao).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceitar e importar' })).not.toBeInTheDocument();

    // Cancelar volta ao estado anterior, sem aplicar o import
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText('Confirmar substituição dos dados importados?')).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'Aceitar e importar' });

    // Clicar de novo pede confirmação outra vez; desta vez confirmamos
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar e importar' }));
    await screen.findByText('Confirmar substituição dos dados importados?');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await screen.findByText('Import concluído ✓ — confira o saldo na tela Hoje.');
    const importados2 = await db.lancamentos.where('origem').equals('import').toArray();
    expect(importados2.length).toBeGreaterThan(0);
  });
});
