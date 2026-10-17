import { useEffect, useState } from 'react';
import { leituraConfiavel, parsearComprovantes, type ComprovanteExtraido } from '../importar/comprovante';
import { aquecerOcr, lerTextosDaImagem, liberarOcr } from '../importar/ocr';
import { useApp } from '../state/store';
import EscolherArquivo from './EscolherArquivo';

/**
 * Leitura de comprovante de maquininha: o usuário tira a foto ou escolhe uma imagem → OCR no
 * aparelho → `parsearComprovante` → `onConcluir`. A imagem nunca sai do aparelho nem é guardada.
 * Se o OCR não achar valor nem data, mostra o erro e não avança: uma compra vazia só atrapalharia.
 */
export default function EscanearComprovanteSheet({ onConcluir, onFechar }: {
  onConcluir: (resultado: ComprovanteExtraido) => void;
  onFechar: () => void;
}) {
  const { hoje } = useApp();
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  // O motor sobe enquanto o usuário tira a foto, e desliga quando a tela fecha.
  useEffect(() => { aquecerOcr(); return liberarOcr; }, []);

  async function aoEscolher(arquivo: File) {
    setErro(null);
    setLendo(true);
    setProgresso(0);
    try {
      const textos = await lerTextosDaImagem(arquivo, setProgresso, (t) => leituraConfiavel(t, hoje));
      const resultado = parsearComprovantes(textos, hoje);
      if (resultado.valorTotal === undefined && resultado.data === undefined) {
        setErro('Não consegui ler esse comprovante. Tente outra foto, mais reta e com boa luz, ou lance a compra à mão.');
        return;
      }
      onConcluir(resultado);
    } catch {
      setErro('Não foi possível ler a imagem. Confira a conexão na primeira leitura e tente de novo.');
    } finally {
      setLendo(false);
    }
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Ler comprovante</h2>
      <p className="sub">
        Tire uma foto do comprovante da maquininha ou escolha uma imagem. A leitura acontece no seu
        aparelho; a foto não é guardada.
      </p>
      <div className="campo">
        <EscolherArquivo id="comprovante-imagem" accept="image/*" primario rotulo="Imagem do comprovante"
          onEscolher={(f) => void aoEscolher(f)} />
      </div>
      {lendo && <p className="aviso" role="status">Lendo o comprovante… {Math.round(progresso * 100)}%</p>}
      {erro && <p className="aviso aviso-urgente">{erro}</p>}
      <button className="botao" style={{ width: '100%', marginTop: 8 }} onClick={onFechar}>Cancelar</button>
    </>
  );
}
