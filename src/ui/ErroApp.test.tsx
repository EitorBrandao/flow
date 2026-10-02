import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErroApp, { ehFalhaDeTrecho } from './ErroApp';

function Quebra({ mensagem }: { mensagem: string }): never {
  throw new Error(mensagem);
}

const FALHA_TRECHO = 'Failed to fetch dynamically imported module: http://x/assets/Grafico-abc.js';
let recarregar: ReturnType<typeof vi.fn>;
const locationOriginal = window.location;

beforeEach(() => {
  sessionStorage.clear();
  recarregar = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true, value: { ...locationOriginal, reload: recarregar },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: locationOriginal });
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ehFalhaDeTrecho', () => {
  it.each([
    'Failed to fetch dynamically imported module: http://x/a.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Loading chunk 12 failed.',
  ])('reconhece "%s"', (m) => expect(ehFalhaDeTrecho(new Error(m))).toBe(true));

  it('não reconhece erro comum', () => {
    expect(ehFalhaDeTrecho(new Error("Cannot read properties of undefined (reading 'data')"))).toBe(false);
  });
});

describe('ErroApp', () => {
  it('mostra os filhos quando não há erro', () => {
    render(<ErroApp><p>tudo certo</p></ErroApp>);
    expect(screen.getByText('tudo certo')).toBeInTheDocument();
    expect(recarregar).not.toHaveBeenCalled();
  });

  it('recarrega sozinho na falha de trecho e mostra "Atualizando"', () => {
    render(<ErroApp><Quebra mensagem={FALHA_TRECHO} /></ErroApp>);
    expect(recarregar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Atualizando o Flow…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recarregar' })).toBeNull();
  });

  it('na segunda falha dentro de um minuto não recarrega: mostra a saída manual', async () => {
    sessionStorage.setItem('flow:recarga-automatica', String(Date.now() - 5_000));
    render(<ErroApp><Quebra mensagem={FALHA_TRECHO} /></ErroApp>);
    expect(recarregar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado');
    expect(screen.getByText(/Seus dados estão salvos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('depois de um minuto a recarga automática volta a valer', () => {
    sessionStorage.setItem('flow:recarga-automatica', String(Date.now() - 61_000));
    render(<ErroApp><Quebra mensagem={FALHA_TRECHO} /></ErroApp>);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('erro comum não recarrega sozinho e mostra o detalhe', () => {
    render(<ErroApp><Quebra mensagem="falha qualquer" /></ErroApp>);
    expect(recarregar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Detalhe: falha qualquer')).toBeInTheDocument();
  });

  it('sem sessionStorage disponível, não recarrega sozinho (evita laço) e mostra a saída manual', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    render(<ErroApp><Quebra mensagem={FALHA_TRECHO} /></ErroApp>);
    expect(recarregar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
  });
});
