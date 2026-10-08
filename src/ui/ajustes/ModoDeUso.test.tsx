import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/database';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import ModoDeUso from './ModoDeUso';

const ROTULOS = ['Hoje', 'Fluxo', 'Cartão', 'Análises', 'Lançar (+)'];

async function semearBox() {
  const agora = agoraISO();
  await repo.salvarBox({
    id: novoId(), nome: 'eitor', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora,
  });
}

function bloco(rotulo: string): HTMLElement {
  return screen.getByText(rotulo, { selector: 'strong' }).closest('.item') as HTMLElement;
}

describe('ModoDeUso', () => {
  beforeEach(async () => { await limparDb(); });

  it('mostra as cinco telas, cada uma Avançado quando a config não tem modos', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    for (const r of ROTULOS) {
      expect(within(bloco(r)).getByText('Avançado', { selector: '.badge' })).toBeInTheDocument();
    }
    expect(screen.getByText(/nada se perde ao trocar/)).toBeInTheDocument();
  });

  it('cada item de tela usa o fundo surface2, para a trilha das pills (surface) aparecer', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    for (const r of ROTULOS) {
      expect(bloco(r).classList.contains('item-elevado')).toBe(true);
    }
  });

  it('clicar em Simples no Hoje grava só o modo do Hoje e mostra o selo', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    await userEvent.click(within(bloco('Hoje')).getByRole('button', { name: 'Simples' }));
    expect(await within(bloco('Hoje')).findByText('Simples', { selector: '.badge' })).toBeInTheDocument();
    const boxId = useApp.getState().boxSel;
    expect((await db.boxes.get(boxId))?.modos).toEqual({
      hoje: 'simples', fluxo: 'avancado', cartao: 'avancado', analises: 'avancado', lancar: 'avancado',
    });
    expect((await db.config.get('config'))?.modos?.hoje).not.toBe('simples');
    expect(within(bloco('Hoje')).getByText('Saldo, projeção e conferência com um número só.')).toBeInTheDocument();
  });

  it('voltar para Avançado troca selo e resumo', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    await userEvent.click(within(bloco('Lançar (+)')).getByRole('button', { name: 'Simples' }));
    await within(bloco('Lançar (+)')).findByText('Simples', { selector: '.badge' });
    await userEvent.click(within(bloco('Lançar (+)')).getByRole('button', { name: 'Avançado' }));
    expect(await within(bloco('Lançar (+)')).findByText('Avançado', { selector: '.badge' })).toBeInTheDocument();
    expect(within(bloco('Lançar (+)')).getByText('Todos os campos. Igual em qualquer tela.')).toBeInTheDocument();
  });

  it('em instalação nova as cinco telas começam Simples', async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await useApp.getState().iniciar();
    render(<ModoDeUso />);
    for (const r of ROTULOS) {
      expect(within(bloco(r)).getByText('Simples', { selector: '.badge' })).toBeInTheDocument();
    }
  });

  it('a frase de abertura nomeia a box do topo e traz o aviso de trocar a box', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    const boxId = useApp.getState().dados!.boxes.find((b) => b.nome === 'eitor')!.id;
    await act(async () => { useApp.getState().setBoxSel(boxId); });
    const { container } = render(<ModoDeUso />);
    const frase = container.querySelector('.card > .sub')!.textContent;
    expect(frase).toBe('Escolha o quanto de detalhe cada tela mostra na box eitor. Para mudar outra box, troque a box no topo. Seus dados são os mesmos nos dois modos e nada se perde ao trocar.');
  });

  it('cada box tem os seus modos: trocar a box no topo troca os selos', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    const agora = agoraISO();
    await repo.salvarBox({ id: 'b2', nome: 'segunda', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora });
    await useApp.getState().recarregar();
    const b1 = useApp.getState().dados!.boxes.find((b) => b.nome === 'eitor')!.id;
    await act(async () => { useApp.getState().setBoxSel(b1); });
    render(<ModoDeUso />);
    await userEvent.click(within(bloco('Hoje')).getByRole('button', { name: 'Simples' }));
    await within(bloco('Hoje')).findByText('Simples', { selector: '.badge' });
    await act(async () => { useApp.getState().setBoxSel('b2'); });
    expect(within(bloco('Hoje')).getByText('Avançado', { selector: '.badge' })).toBeInTheDocument();
    await act(async () => { useApp.getState().setBoxSel(b1); });
    expect(within(bloco('Hoje')).getByText('Simples', { selector: '.badge' })).toBeInTheDocument();
  });

  it('na visão casa a frase diz "na visão casa" e grava na box casa', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    await act(async () => { useApp.getState().setBoxSel('casa'); });
    const { container } = render(<ModoDeUso />);
    expect(container.querySelector('.card > .sub')!.textContent).toContain('mostra na visão casa (todas as boxes juntas). Para mudar outra box');
    await userEvent.click(within(bloco('Fluxo')).getByRole('button', { name: 'Simples' }));
    await within(bloco('Fluxo')).findByText('Simples', { selector: '.badge' });
    const casa = useApp.getState().dados!.boxes.find((b) => b.nome === 'casa')!;
    expect((await db.boxes.get(casa.id))?.modos?.fluxo).toBe('simples');
  });

  it('visão casa sem a box casa: frase "no padrão do app" e grava o modo global', async () => {
    await semearBox();
    await useApp.getState().iniciar();
    const casa = useApp.getState().dados!.boxes.find((b) => b.nome === 'casa')!;
    await repo.salvarBox({ ...casa, nome: 'renomeada' });
    await useApp.getState().recarregar();
    await act(async () => { useApp.getState().setBoxSel('casa'); });
    const { container } = render(<ModoDeUso />);
    expect(container.querySelector('.card > .sub')!.textContent).toContain('mostra no padrão do app. Para mudar outra box');
    await userEvent.click(within(bloco('Cartão')).getByRole('button', { name: 'Simples' }));
    await within(bloco('Cartão')).findByText('Simples', { selector: '.badge' });
    expect((await db.config.get('config'))?.modos?.cartao).toBe('simples');
  });
});
