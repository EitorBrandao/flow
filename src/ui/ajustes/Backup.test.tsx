import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { useApp } from '../../state/store';
import Backup from './Backup';

// jsdom não implementa URL.createObjectURL/revokeObjectURL — só usado nesta suíte de
// teste para permitir o fluxo real de download; produção não é afetada.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
  URL.revokeObjectURL = () => {};
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Backup (exportar)', () => {
  it('mostra uma mensagem de erro em vez de falhar silenciosamente quando exportar falha', async () => {
    await useApp.getState().iniciar();
    vi.spyOn(repo, 'carregarTudo').mockRejectedValueOnce(new Error('boom'));

    render(<Backup />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar backup (.json)' }));

    await screen.findByText(/Falha ao exportar/);
  });

  it('exporta com sucesso quando não há navigator.share (fluxo de download)', async () => {
    await useApp.getState().iniciar();

    render(<Backup />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar backup (.json)' }));

    await screen.findByText('Backup exportado.');
  });
});
