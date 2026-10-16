import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EscanearComprovanteSheet from './EscanearComprovanteSheet';
import { lerTextosDaImagem } from '../importar/ocr';

vi.mock('../importar/ocr', () => ({ lerTextosDaImagem: vi.fn(), aquecerOcr: vi.fn(), liberarOcr: vi.fn() }));

const TEXTO = 'LOJA TESTE LTDA CNPJ:00.000.000/0001-00\nTOTAL: R$ 90,00\nPARCELAS: 03 X R$ 30,00\n05/03/27';

function imagem() {
  return new File(['x'], 'comprovante.jpg', { type: 'image/jpeg' });
}

beforeEach(() => { vi.mocked(lerTextosDaImagem).mockReset(); });

it('imagem lida: entrega valor, parcelas, data e descrição por onConcluir', async () => {
  vi.mocked(lerTextosDaImagem).mockResolvedValue([TEXTO]);
  const onConcluir = vi.fn();
  render(<EscanearComprovanteSheet onConcluir={onConcluir} onFechar={() => {}} />);

  await userEvent.upload(screen.getByLabelText('Imagem do comprovante'), imagem());

  await waitFor(() => expect(onConcluir).toHaveBeenCalledWith(
    expect.objectContaining({ valorTotal: 9000, parcelas: 3, data: '2027-03-05', descricao: 'Loja Teste Ltda' }),
  ));
});

it('texto sem valor nem data mostra erro e não avança', async () => {
  vi.mocked(lerTextosDaImagem).mockResolvedValue(['lorem ipsum']);
  const onConcluir = vi.fn();
  render(<EscanearComprovanteSheet onConcluir={onConcluir} onFechar={() => {}} />);

  await userEvent.upload(screen.getByLabelText('Imagem do comprovante'), imagem());

  expect(await screen.findByText(/Não consegui ler esse comprovante/)).toBeInTheDocument();
  expect(onConcluir).not.toHaveBeenCalled();
});

it('falha do OCR mostra erro e deixa tentar de novo', async () => {
  vi.mocked(lerTextosDaImagem).mockRejectedValue(new Error('rede'));
  const onConcluir = vi.fn();
  render(<EscanearComprovanteSheet onConcluir={onConcluir} onFechar={() => {}} />);

  await userEvent.upload(screen.getByLabelText('Imagem do comprovante'), imagem());

  expect(await screen.findByText(/Não foi possível ler a imagem/)).toBeInTheDocument();
  expect(screen.getByLabelText('Imagem do comprovante')).toBeInTheDocument();
  expect(onConcluir).not.toHaveBeenCalled();
});

it('cancelar chama onFechar', async () => {
  const onFechar = vi.fn();
  render(<EscanearComprovanteSheet onConcluir={vi.fn()} onFechar={onFechar} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(onFechar).toHaveBeenCalledOnce();
});
