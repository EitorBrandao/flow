import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import { gerarBackup } from '../../backup/backup';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
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

/** Responde ao sheet de confirmação da tela, pelo título do diálogo. */
async function responderNoSheet(titulo: string | RegExp, botao: string) {
  const dialogo = await screen.findByRole('dialog', { name: titulo });
  await userEvent.click(within(dialogo).getByRole('button', { name: botao }));
}

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

describe('Backup (restaurar)', () => {
  /** Escolhe o modo e envia o arquivo. A restauração só começa depois da confirmação no sheet. */
  async function enviarArquivo(modo: 'substituir tudo' | 'mesclar') {
    const arquivo = JSON.stringify(gerarBackup(await repo.carregarTudo()));
    render(<Backup />);
    await userEvent.click(screen.getByRole('radio', { name: modo }));
    await userEvent.upload(
      screen.getByLabelText('Arquivo de backup (.json)'),
      new File([arquivo], 'flow-backup.json', { type: 'application/json' }),
    );
  }

  /** Restaura pela própria tela: escolhe o modo, envia o arquivo e confirma no sheet. */
  async function restaurar(modo: 'substituir tudo' | 'mesclar', botao: 'Substituir' | 'Mesclar') {
    await enviarArquivo(modo);
    await responderNoSheet(
      botao === 'Substituir' ? 'Substituir todos os dados pelo backup?' : 'Mesclar o backup com os dados atuais?',
      botao,
    );
    await screen.findByText('Backup restaurado.');
    return (await repo.carregarTudo()).config;
  }

  it('mesclar deixa o marcador de mudanças ligado: o resultado não está inteiro em nenhum arquivo', async () => {
    await useApp.getState().iniciar();
    await repo.salvarConfig({ mudancasDesdeBackup: false });
    await useApp.getState().recarregar();

    expect((await restaurar('mesclar', 'Mesclar')).mudancasDesdeBackup).toBe(true);
  });

  it('substituir desliga o marcador: os dados passam a ser exatamente os do arquivo', async () => {
    await useApp.getState().iniciar();
    await repo.salvarConfig({ mudancasDesdeBackup: true });
    await useApp.getState().recarregar();

    expect((await restaurar('substituir tudo', 'Substituir')).mudancasDesdeBackup).toBe(false);
  });

  it('Cancelar não restaura nada', async () => {
    await useApp.getState().iniciar();
    // O arquivo foi gerado antes de criar a box: se o Cancelar falhasse, "substituir" a apagaria.
    const arquivo = JSON.stringify(gerarBackup(await repo.carregarTudo()));
    const agora = agoraISO();
    await repo.salvarBox({ id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora });
    await useApp.getState().recarregar();
    const antes = await db.boxes.count();

    render(<Backup />);
    await userEvent.upload(
      screen.getByLabelText('Arquivo de backup (.json)'),
      new File([arquivo], 'flow-backup.json', { type: 'application/json' }),
    );
    await responderNoSheet('Substituir todos os dados pelo backup?', 'Cancelar');

    expect(await db.boxes.count()).toBe(antes);
    expect(screen.queryByText('Backup restaurado.')).not.toBeInTheDocument();
  });

  it('"Substituir" é vermelho, "Mesclar" é azul', async () => {
    await useApp.getState().iniciar();
    const arquivo = JSON.stringify(gerarBackup(await repo.carregarTudo()));
    render(<Backup />);

    await userEvent.upload(
      screen.getByLabelText('Arquivo de backup (.json)'),
      new File([arquivo], 'flow-backup.json', { type: 'application/json' }),
    );
    const sheetSubstituir = await screen.findByRole('dialog', { name: 'Substituir todos os dados pelo backup?' });
    expect(within(sheetSubstituir).getByRole('button', { name: 'Substituir' })).toHaveClass('botao-perigo-cheio');
    await userEvent.click(within(sheetSubstituir).getByRole('button', { name: 'Cancelar' }));

    await userEvent.click(screen.getByRole('radio', { name: 'mesclar' }));
    await userEvent.upload(
      screen.getByLabelText('Arquivo de backup (.json)'),
      new File([arquivo], 'flow-backup.json', { type: 'application/json' }),
    );
    const sheetMesclar = await screen.findByRole('dialog', { name: 'Mesclar o backup com os dados atuais?' });
    expect(within(sheetMesclar).getByRole('button', { name: 'Mesclar' })).toHaveClass('botao-primario');
    expect(within(sheetMesclar).getByRole('button', { name: 'Mesclar' })).not.toHaveClass('botao-perigo-cheio');
  });
});
