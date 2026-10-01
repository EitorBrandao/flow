import 'fake-indexeddb/auto';
import { limparDb } from '../../test-setup';
import { render, screen } from '@testing-library/react';
import * as repo from '../../db/repo';
import { agoraISO, novoId } from '../../domain/types';
import { useApp } from '../../state/store';
import Assinaturas from './Assinaturas';
import AvisoEscolhaBox from './AvisoEscolhaBox';
import Cartoes from './Cartoes';
import Categorias from './Categorias';
import CategoriasCartao from './CategoriasCartao';
import Recorrencias from './Recorrencias';

beforeEach(async () => {
  await limparDb();
});

it('mostra o aviso num parágrafo .sub', () => {
  render(<AvisoEscolhaBox assunto="As categorias" />);
  const p = screen.getByText('As categorias são de cada box. Escolha uma box no topo para ver ou editar.');
  expect(p.tagName).toBe('P');
  expect(p).toHaveClass('sub');
});

async function montarCasa() {
  const agora = agoraISO();
  for (const nome of ['ana', 'bruno']) {
    await repo.salvarBox({ id: novoId(), nome, saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora });
  }
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: 'casa', hoje: '2026-07-01' });
}

const telas = [
  { nome: 'Recorrências', Tela: Recorrencias, h2: 'Recorrências', assunto: 'As recorrências', ausente: 'Nova recorrência' },
  { nome: 'Categorias', Tela: Categorias, h2: 'Categorias', assunto: 'As categorias', ausente: 'Nova categoria' },
  { nome: 'Categorias do cartão', Tela: CategoriasCartao, h2: 'Categorias do cartão', assunto: 'As categorias do cartão', ausente: 'Nova categoria' },
  { nome: 'Cartões', Tela: Cartoes, h2: 'Cartões', assunto: 'Os cartões', ausente: 'Novo cartão' },
  { nome: 'Assinaturas', Tela: Assinaturas, h2: 'Assinaturas do cartão', assunto: 'As assinaturas', ausente: 'Nova assinatura' },
];

for (const { nome, Tela, h2, assunto, ausente } of telas) {
  it(`${nome}: na casa mostra só o aviso para escolher uma box`, async () => {
    await montarCasa();
    render(<Tela />);
    expect(screen.getByRole('heading', { level: 2, name: h2 })).toBeInTheDocument();
    expect(screen.getByText(`${assunto} são de cada box. Escolha uma box no topo para ver ou editar.`)).toBeInTheDocument();
    expect(screen.queryByText(ausente)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Criar|Adicionar)/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/não foi encontrada/)).not.toBeInTheDocument();
  });
}
