import 'fake-indexeddb/auto';
import { limparDb } from '../test-setup';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../db/database';
import * as repo from '../db/repo';
import { formatarBRL } from '../domain/money';
import { agoraISO, novoId } from '../domain/types';
import { useApp } from '../state/store';
import TelaHoje from './TelaHoje';

beforeEach(async () => {
  await limparDb();
  useApp.setState({ aba: 'hoje', ajustesSecao: null });
});

it('mostra saldo e confirma um pendente', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 550000, status: 'previsto' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent?.replace(/ /g, ' ') === 'R$ 1.000,00')).toBeInTheDocument(); // saldo efetivo
  expect(screen.getByText(/salario/)).toBeInTheDocument();     // pendente na fila

  await userEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
  await screen.findByText('Nada a confirmar — tudo em dia.'); // aguarda o recarregar() do clique terminar
  const lanc = (await db.lancamentos.toArray())[0];
  expect(lanc.status).toBe('efetivo');
});

it('declara saldo real maior que o saldo do app e mostra que falta inserir', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await userEvent.type(screen.getByLabelText('Saldo real no banco'), '1050,00');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/falta inserir/)).toBeInTheDocument();
  expect(screen.getByText(/R\$\s*50,00/)).toBeInTheDocument();
  const salva = await db.boxes.get(box.id);
  expect(salva?.saldoDeclaradoCent).toBe(105000);
});

it('declara saldo real negativo (cheque especial) e persiste com o sinal', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await userEvent.type(screen.getByLabelText('Saldo real no banco'), '5000');
  const toggleBtn = screen.getByRole('button', { name: 'Alternar sinal (positivo/negativo)' });
  await userEvent.click(toggleBtn);
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/sobra no app/)).toBeInTheDocument();
  const salva = await db.boxes.get(box.id);
  expect(salva?.saldoDeclaradoCent).toBe(-5000);
});

it('declara saldo real igual ao saldo do app e mostra que bate certinho', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  await userEvent.type(screen.getByLabelText('Saldo real no banco'), '1000,00');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(await screen.findByText(/bate certinho/i)).toBeInTheDocument();
});

it('troca de box reseta o campo de saldo real para o valor daquela box', async () => {
  const agora = agoraISO();
  const boxA = { id: novoId(), nome: 'a', saldoInicial: 100000, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  const boxB = { id: novoId(), nome: 'b', saldoInicial: 0, dataSaldoInicial: '2026-07-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(boxA);
  await repo.salvarBox(boxB);
  await repo.salvarCategoria({ boxId: boxA.id, nome: 'cat1', tipo: 'ganho', ordem: 0 });
  await repo.salvarCategoria({ boxId: boxB.id, nome: 'cat2', tipo: 'ganho', ordem: 0 });
  await repo.salvarBox({ ...boxA, saldoDeclaradoCent: 105000, dataSaldoDeclarado: '2026-07-02' });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: boxA.id, hoje: '2026-07-02' });

  const { rerender } = render(<TelaHoje />);
  const saldoInput = screen.getByLabelText('Saldo real no banco') as HTMLInputElement;
  expect(saldoInput.value).toMatch(/1\.050,00/);

  act(() => useApp.setState({ boxSel: boxB.id }));
  rerender(<TelaHoje />);
  expect((screen.getByLabelText('Saldo real no banco') as HTMLInputElement).value).toMatch(/0,00/);
});

it('com banco vazio, a Hoje mostra o cartão de primeiro uso e não mostra o saldo grande', async () => {
  await useApp.getState().iniciar();

  render(<TelaHoje />);
  expect(screen.getByText('Primeira vez por aqui?')).toBeInTheDocument();
  expect(screen.queryByText(/Saldo hoje/)).not.toBeInTheDocument();
});

it('com box com saldo próprio e ao menos uma categoria, mostra o saldo e não o cartão de primeiro uso', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();
  useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

  render(<TelaHoje />);
  expect(screen.getByText(/Saldo hoje/)).toBeInTheDocument();
  expect(screen.queryByText('Primeira vez por aqui?')).not.toBeInTheDocument();
});

it('clicar no aviso de backup atrasado abre a subtela de backup', async () => {
  const agora = agoraISO();
  const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
  await repo.salvarBox(box);
  await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
  await useApp.getState().iniciar();

  // Marca que há mudanças desde o último backup, e o último backup foi há mais de 7 dias
  await repo.salvarConfig({
    mudancasDesdeBackup: true,
    ultimoBackupEm: '2026-07-01T00:00:00Z', // 25 dias atrás (hoje é 26/07)
  });
  await useApp.getState().recarregar();

  useApp.setState({ boxSel: box.id, aba: 'hoje', ajustesSecao: null });
  render(<TelaHoje />);

  expect(screen.getByText(/Há mudanças sem backup/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Há mudanças sem backup/ }));

  const estado = useApp.getState();
  expect(estado.aba).toBe('ajustes');
  expect(estado.ajustesSecao).toBe('backup');
});

describe('conferência por banco', () => {
  /** Box com saldo próprio e um lançamento efetivo já contido no saldo (não muda o saldo
   *  efetivo dali pra frente, então o teste não depende de qual "hoje" real o `recarregar()`
   *  do store resolver). */
  async function comBoxESaldo() {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'salario', tipo: 'ganho', ordem: 0 });
    await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-01-15', valor: 1000, status: 'efetivo' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });
    return box;
  }

  it('box sem banco mantém a conferência de sempre (campo único, sem total por banco)', async () => {
    await comBoxESaldo();
    render(<TelaHoje />);
    expect(screen.getByLabelText('Saldo real no banco')).toBeInTheDocument();
    expect(screen.queryByText('Total informado')).not.toBeInTheDocument();
  });

  it('com bancos, mostra uma linha por banco e o campo único some', async () => {
    const box = await comBoxESaldo();
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    expect(screen.getByLabelText('Banco Um')).toBeInTheDocument();
    expect(screen.getByLabelText('Banco Dois')).toBeInTheDocument();
    expect(screen.queryByLabelText('Saldo real no banco')).not.toBeInTheDocument();
    expect(screen.getByText('Total informado')).toBeInTheDocument();
  });

  it('com bancos mas nenhum informado, não afirma diferença nenhuma', async () => {
    const box = await comBoxESaldo();
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    // mostrar "diferença = saldo inteiro" seria a tela acusar um descasamento inexistente
    expect(screen.queryByText(/Diferença/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bate certinho/)).not.toBeInTheDocument();
    expect(screen.getByText(/Informe o saldo de ao menos um banco/)).toBeInTheDocument();
  });

  it('informar o saldo do segundo banco grava nele (não no primeiro) e passa a mostrar a diferença', async () => {
    const box = await comBoxESaldo();
    const bancoUm = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    const bancoDois = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    await userEvent.click(screen.getByLabelText('Banco Dois'));
    await userEvent.keyboard('50000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    await vi.waitFor(async () => {
      expect((await db.bancos.get(bancoDois.id))?.saldoDeclaradoCent).toBe(50000);
    });
    // discrimina uma implementação que gravasse sempre no primeiro banco da lista
    expect((await db.bancos.get(bancoUm.id))?.saldoDeclaradoCent).toBeNull();
    expect(await screen.findByText(/Diferença/)).toBeInTheDocument();
  });

  it('tocar num banco sem digitar não sobrescreve o saldo dele ao salvar outro banco', async () => {
    // Reprodução do bug: CampoValor zera o buffer no primeiro foco (onChange(0)) mesmo sem o
    // usuário digitar nada (ver CampoValor.test.tsx). Um "tocados = qualquer onChange" gravaria
    // esse banco com zero só por ter sido focado.
    const box = await comBoxESaldo();
    const bancoA = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    const bancoB = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    await repo.atualizarBanco(bancoA.id, { saldoDeclaradoCent: 77700, dataSaldoDeclarado: '2026-07-01' });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    // Só toca no campo do Banco Um — foca e não digita nada.
    await userEvent.click(screen.getByLabelText('Banco Um'));
    // Edita de fato o Banco Dois.
    await userEvent.click(screen.getByLabelText('Banco Dois'));
    await userEvent.keyboard('30000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    await vi.waitFor(async () => {
      expect((await db.bancos.get(bancoB.id))?.saldoDeclaradoCent).toBe(30000);
    });
    // O ponto do teste: o banco só tocado continua com o saldo antigo, não vira zero.
    expect((await db.bancos.get(bancoA.id))?.saldoDeclaradoCent).toBe(77700);
  });

  it('apagar os dígitos até zero grava zero de propósito', async () => {
    const box = await comBoxESaldo();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.atualizarBanco(banco.id, { saldoDeclaradoCent: 50000, dataSaldoDeclarado: '2026-07-01' });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    await userEvent.click(screen.getByLabelText('Banco Um')); // foco zera o buffer
    await userEvent.keyboard('500'); // digita algo de verdade...
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}'); // ...e apaga tudo de volta a zero

    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    await vi.waitFor(async () => {
      expect((await db.bancos.get(banco.id))?.saldoDeclaradoCent).toBe(0);
    });
  });

  it('banco nunca informado, só tocado sem digitar, continua null (não vira "informado zero")', async () => {
    const box = await comBoxESaldo();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    await userEvent.click(screen.getByLabelText('Banco Um'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    expect((await db.bancos.get(banco.id))?.saldoDeclaradoCent).toBeNull();
  });

  it('banco com saldo persistido negativo abre com o sinal "−" ativo e a magnitude certa', async () => {
    const box = await comBoxESaldo();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.atualizarBanco(banco.id, { saldoDeclaradoCent: -32100, dataSaldoDeclarado: '2026-07-01' });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    expect(screen.getByRole('button', { name: 'Alternar sinal (positivo/negativo)' })).toHaveTextContent('−');
    expect(screen.getByLabelText('Banco Um')).toHaveValue(formatarBRL(32100));
  });

  it('alternar o sinal (sem digitar nada) e salvar grava o valor negativo', async () => {
    // Este teste não digita nada — a única edição é o clique no botão de sinal. Se alternar o
    // sinal não marcasse o banco como editado, `mudancas` ficaria vazio e nada seria gravado
    // (o teste falharia com o valor antigo, positivo). Se o salvamento ignorasse o sinal e
    // gravasse sempre a magnitude, o teste falharia com o valor positivo em vez do negativo.
    const box = await comBoxESaldo();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.atualizarBanco(banco.id, { saldoDeclaradoCent: 5000, dataSaldoDeclarado: '2026-07-01' });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    await userEvent.click(screen.getByRole('button', { name: 'Alternar sinal (positivo/negativo)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    await vi.waitFor(async () => {
      expect((await db.bancos.get(banco.id))?.saldoDeclaradoCent).toBe(-5000);
    });
  });

  it('alternar o sinal de volta para positivo e salvar grava positivo', async () => {
    const box = await comBoxESaldo();
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.atualizarBanco(banco.id, { saldoDeclaradoCent: -5000, dataSaldoDeclarado: '2026-07-01' });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    await userEvent.click(screen.getByRole('button', { name: 'Alternar sinal (positivo/negativo)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    await vi.waitFor(async () => {
      expect((await db.bancos.get(banco.id))?.saldoDeclaradoCent).toBe(5000);
    });
  });

  it('falha ao salvar mostra aviso e ainda assim recarrega', async () => {
    const box = await comBoxESaldo();
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    const erroSpy = vi.spyOn(repo, 'atualizarBanco').mockRejectedValue(new Error('falhou de propósito'));
    render(<TelaHoje />);
    await userEvent.click(screen.getByLabelText('Banco Um'));
    await userEvent.keyboard('5000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    expect(await screen.findByText(/nem tudo foi salvo/i)).toBeInTheDocument();
    erroSpy.mockRestore();
  });

  it('remonte é atômico: focar um banco antes do remonte não conta como segundo foco na instância nova', async () => {
    // Documenta o invariante: `primeiroFoco`/`editados` vivem em refs de `ConferenciaBancos`
    // (o pai), enquanto `CampoValor` guarda "já focado" por instância montada (o filho). Se o
    // remonte (mudança de `key` ao criar um banco novo) não desmontasse pai e filhos juntos, um
    // foco antes do remonte poderia "vazar" pra instância nova — tratando o primeiro foco de
    // verdade como se fosse o segundo, e zerando o saldo ao salvar.
    const box = await comBoxESaldo();
    const bancoA = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.atualizarBanco(bancoA.id, { saldoDeclaradoCent: 77700, dataSaldoDeclarado: '2026-07-01' });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    render(<TelaHoje />);
    // Foca o campo do banco A na instância ANTIGA, sem digitar nada.
    await userEvent.click(screen.getByLabelText('Banco Um'));

    // Cria um banco novo: muda `chaveBancos` e força o remonte de `ConferenciaBancos`.
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Dois', ordem: 1 });
    await act(async () => { await useApp.getState().recarregar(); });

    // Na instância NOVA, foca o mesmo campo de novo (primeiro foco de verdade desta instância)
    // e salva sem digitar nada.
    await userEvent.click(screen.getByLabelText('Banco Um'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar conferência dos bancos' }));

    expect((await db.bancos.get(bancoA.id))?.saldoDeclaradoCent).toBe(77700);
  });

  it('na visão casa os bancos aparecem agrupados por box', async () => {
    const box = await comBoxESaldo();
    const agora = agoraISO();
    const outra = { id: novoId(), nome: 'ju', saldoInicial: 0, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(outra);
    await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await repo.salvarBanco({ boxId: outra.id, nome: 'Banco Dois', ordem: 0 });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: 'casa' });

    render(<TelaHoje />);
    expect(screen.getByLabelText('Banco Um')).toBeInTheDocument();
    expect(screen.getByLabelText('Banco Dois')).toBeInTheDocument();
    expect(screen.getByText('ju')).toBeInTheDocument();
    expect(screen.getByText('eitor')).toBeInTheDocument();
  });

  it('excluir todos os bancos devolve a conferência antiga, com o valor preservado', async () => {
    const box = await comBoxESaldo();
    await repo.salvarBox({ ...box, saldoDeclaradoCent: 12300, dataSaldoDeclarado: '2026-07-01' });
    const banco = await repo.salvarBanco({ boxId: box.id, nome: 'Banco Um', ordem: 0 });
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });
    render(<TelaHoje />);
    expect(screen.queryByLabelText('Saldo real no banco')).not.toBeInTheDocument();

    await repo.excluirBanco(banco.id);
    await useApp.getState().recarregar();
    useApp.setState({ boxSel: box.id });

    // é isto que torna a entrega reversível: o valor antigo nunca foi apagado
    expect(await screen.findByLabelText('Saldo real no banco')).toHaveValue(formatarBRL(12300));
  });
});

describe('fatura pendente na fila', () => {
  /** Cartão com a fatura de 08/2026 (R$ 900,00) já vencida, esperando na fila. */
  async function comFaturaVencida() {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cartao = await repo.salvarCartao({
      boxId: box.id, nome: 'Cartão', diaFechamento: 28, diaVencimento: 5,
    }, '2027-12-31');
    const catCartao = await repo.salvarCategoriaCartao({ cartaoId: cartao.id, nome: 'mercado', ordem: 0 });
    await repo.salvarCompraCartao({
      cartaoId: cartao.id, categoriaCartaoId: catCartao.id, data: '2026-07-05',
      valorTotal: 90000, parcelas: 1,
    }, '2027-12-31');
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-08-05' }); // dia do vencimento
    return { box, cartao };
  }

  it('oferece "Paguei outro valor" no lugar de "Descartar"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      await comFaturaVencida();

      render(<TelaHoje />);
      expect(screen.getByRole('button', { name: /Paguei outro valor/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('pendente que não é fatura continua com "Descartar"', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    render(<TelaHoje />);
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Paguei outro valor/ })).not.toBeInTheDocument();
  });

  it('descartar pede confirmação: cancelar mantém o pendente na fila', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<TelaHoje />);

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(confirmSpy).toHaveBeenCalledWith('Descartar este previsto?');
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument();
    expect(await db.lancamentos.get(previsto.id)).toBeDefined();
    confirmSpy.mockRestore();
  });

  it('descartar pede confirmação: confirmar remove o pendente da fila', async () => {
    const agora = agoraISO();
    const box = { id: novoId(), nome: 'eitor', saldoInicial: 100000, dataSaldoInicial: '2026-01-01', criadoEm: agora, alteradoEm: agora };
    await repo.salvarBox(box);
    const cat = await repo.salvarCategoria({ boxId: box.id, nome: 'aluguel', tipo: 'gasto', ordem: 0 });
    const previsto = await repo.salvarLancamento({ boxId: box.id, categoriaId: cat.id, data: '2026-07-01', valor: 50000, status: 'previsto' });
    await useApp.getState().iniciar();
    useApp.setState({ boxSel: box.id, hoje: '2026-07-02' });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TelaHoje />);

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(confirmSpy).toHaveBeenCalledWith('Descartar este previsto?');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
    });
    expect(await db.lancamentos.get(previsto.id)).toBeUndefined();
    confirmSpy.mockRestore();
  });

  it('o botão abre a folha de pagamento já com o total da fatura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-07-01T12:00:00'));
      await comFaturaVencida();

      render(<TelaHoje />);
      await userEvent.click(screen.getByRole('button', { name: /Paguei outro valor/ }));

      expect(await screen.findByRole('dialog', { name: 'Pagamento da fatura' })).toBeInTheDocument();
      expect(screen.getByLabelText('Quanto você pagou')).toHaveValue(formatarBRL(90000));
    } finally { vi.useRealTimers(); }
  });
});
