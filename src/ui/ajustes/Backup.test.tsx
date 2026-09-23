import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  await limparDb();
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

describe('Backup (última cópia)', () => {
  it('mostra a idade relativa e a data completa entre parênteses', async () => {
    await useApp.getState().iniciar();
    const quando = new Date(2026, 6, 23, 19, 46).toISOString();
    await repo.salvarConfig({ ultimoBackupEm: quando, mudancasDesdeBackup: false });
    await useApp.getState().recarregar();
    useApp.setState({ hoje: '2026-07-26' });

    render(<Backup />);

    const dataCompleta = new Date(quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    expect(screen.getByText(`Último backup: há 3 dias (${dataCompleta})`)).toBeInTheDocument();
  });

  it('sem backup feito mostra "nunca", sem parênteses', async () => {
    await useApp.getState().iniciar();
    await repo.salvarConfig({ ultimoBackupEm: null, mudancasDesdeBackup: true });
    await useApp.getState().recarregar();

    render(<Backup />);

    expect(screen.getByText('Último backup: nunca · há mudanças não salvas em backup')).toBeInTheDocument();
  });
});
