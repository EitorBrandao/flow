import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EscanearNotaSheet from './EscanearNotaSheet';

const XML_VALIDO = `<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide><dhEmi>2026-08-29T14:23:00-03:00</dhEmi></ide>
      <emit><xNome>Mercado Exemplo LTDA</xNome></emit>
      <total><ICMSTot><vNF>62.40</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;

async function irParaEtapaXml(chave = '3'.repeat(44)) {
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), chave);
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

it('sem câmera no ambiente, mostra só o campo de chave manual', async () => {
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={() => {}} />);
  expect(await screen.findByLabelText('Chave de acesso')).toBeInTheDocument();
  expect(screen.queryByLabelText('Câmera')).not.toBeInTheDocument();
});

it('chave com menos de 44 dígitos mostra erro e não avança de etapa', async () => {
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), '123');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('A chave de acesso tem 44 dígitos.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Chave extraída')).not.toBeInTheDocument();
});

it('chave válida avança e mostra a chave extraída, somente leitura', async () => {
  await irParaEtapaXml('3'.repeat(44));
  expect(await screen.findByLabelText('Chave extraída')).toHaveValue('3'.repeat(44));
});

it('cola o XML e conclui com os campos extraídos', async () => {
  const onConcluir = vi.fn();
  render(<EscanearNotaSheet onConcluir={onConcluir} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  const textarea = await screen.findByLabelText('Ou cole o texto do XML');
  fireEvent.change(textarea, { target: { value: XML_VALIDO } });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  await waitFor(() => {
    expect(onConcluir).toHaveBeenCalledWith({
      valorTotal: 6240, data: '2026-08-29', descricao: 'Mercado Exemplo LTDA',
    });
  });
});

it('XML sem nenhum campo reconhecível mostra erro e exige confirmar antes de concluir', async () => {
  const onConcluir = vi.fn();
  render(<EscanearNotaSheet onConcluir={onConcluir} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  const textarea = await screen.findByLabelText('Ou cole o texto do XML');
  fireEvent.change(textarea, { target: { value: 'não é xml' } });
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  expect(await screen.findByText('Não foi possível ler esse XML. Confira o formulário abaixo.'))
    .toBeInTheDocument();
  expect(onConcluir).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Continuar mesmo assim' }));
  await waitFor(() => expect(onConcluir).toHaveBeenCalledWith({}));
});

it('XML em branco não deixa continuar', async () => {
  await irParaEtapaXml();
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('Cole o XML ou envie o arquivo.')).toBeInTheDocument();
});

it('cancelar chama onFechar em qualquer etapa', async () => {
  const onFechar = vi.fn();
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={onFechar} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onFechar).toHaveBeenCalledOnce();
});

it('envia um arquivo XML válido e conclui com os campos extraídos', async () => {
  const onConcluir = vi.fn();
  render(<EscanearNotaSheet onConcluir={onConcluir} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  const arquivo = new File([XML_VALIDO], 'nota.xml', { type: 'text/xml' });
  const input = await screen.findByLabelText('Arquivo XML');
  await userEvent.upload(input, arquivo);

  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  await waitFor(() => {
    expect(onConcluir).toHaveBeenCalledWith({
      valorTotal: 6240, data: '2026-08-29', descricao: 'Mercado Exemplo LTDA',
    });
  });
});

it('arquivo ilegível mostra mensagem de erro', async () => {
  const espiao = vi.spyOn(File.prototype, 'text').mockRejectedValueOnce(new Error('boom'));
  render(<EscanearNotaSheet onConcluir={vi.fn()} onFechar={() => {}} />);
  await userEvent.type(screen.getByLabelText('Chave de acesso'), '3'.repeat(44));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

  const arquivo = new File(['lixo'], 'nota.xml', { type: 'text/xml' });
  const input = await screen.findByLabelText('Arquivo XML');
  await userEvent.upload(input, arquivo);

  expect(await screen.findByText('Não foi possível ler esse arquivo.')).toBeInTheDocument();
  espiao.mockRestore();
});
