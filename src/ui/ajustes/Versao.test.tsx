import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import changelogRaw from '../../../CHANGELOG.md?raw';
import { parseChangelog } from './changelog';
import Versao from './Versao';

it('mostra a versão atual (topo do changelog) e o histórico de versões anteriores', () => {
  render(<Versao />);
  // Deriva a versão do changelog em vez de fixar um literal — assim releases
  // não obrigam a editar este teste.
  const atual = parseChangelog(changelogRaw)[0].versao;
  const regex = new RegExp(`Você está na versão ${atual.replace(/\./g, '\\.')}`);
  expect(screen.getByText(regex)).toBeInTheDocument();
  // 0.1.0 é a versão mais antiga (não muda): confirma que o histórico renderiza.
  expect(screen.getByText('0.1.0')).toBeInTheDocument();
});

it('package.json e o topo do CHANGELOG.md apontam a mesma versão', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const topo = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))[0].versao;
  expect(topo).toBe(pkg.version);
});
