import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import jsQR from 'jsqr';
import { extrairChaveDoQrCode, parsearNotaFiscal, type NotaFiscalExtraida } from '../domain/notaFiscal';

type Etapa = 'chave' | 'xml';

/**
 * Fluxo de captura de compra por nota fiscal: câmera decodifica o QR-code (ou o usuário
 * digita a chave à mão, sempre disponível como saída) → mostra a chave extraída → usuário
 * busca o XML fora do app e volta com ele (upload ou colar texto) → parse → `onConcluir`.
 * O Flow nunca busca a página da Sefaz sozinho (CORS bloqueia; ver a spec).
 */
export default function EscanearNotaSheet({ onConcluir, onFechar }: {
  onConcluir: (resultado: NotaFiscalExtraida) => void;
  onFechar: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>('chave');
  const [chave, setChave] = useState('');
  const [chaveDigitada, setChaveDigitada] = useState('');
  const [xmlTexto, setXmlTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Calculado uma vez: em jsdom (testes) navigator.mediaDevices não existe, e o componente
  // cai sozinho no caminho de digitar a chave — é esse caminho que os testes cobrem.
  const [cameraDisponivel] = useState(
    () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  );

  function confirmarChave(valor: string) {
    setChave(valor);
    setErro(null);
    setEtapa('xml');
  }

  useEffect(() => {
    if (!cameraDisponivel || etapa !== 'chave') return undefined;
    let cancelado = false;
    let quadro = 0;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => {});

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        function tick() {
          if (cancelado || !ctx || !video) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const codigo = jsQR(frame.data, frame.width, frame.height);
            const extraida = codigo ? extrairChaveDoQrCode(codigo.data) : undefined;
            if (extraida) { confirmarChave(extraida); return; }
          }
          quadro = requestAnimationFrame(tick);
        }
        quadro = requestAnimationFrame(tick);
      })
      // Permissão negada ou sem câmera: o campo de chave manual, já visível, continua a saída.
      .catch(() => {});

    return () => {
      cancelado = true;
      cancelAnimationFrame(quadro);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraDisponivel, etapa]);

  function enviarChaveManual() {
    const limpa = chaveDigitada.replace(/\D/g, '');
    if (limpa.length !== 44) { setErro('A chave de acesso tem 44 dígitos.'); return; }
    confirmarChave(limpa);
  }

  async function onArquivoXml(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setXmlTexto(await arquivo.text());
  }

  function concluir() {
    if (!xmlTexto.trim()) { setErro('Cole o XML ou envie o arquivo.'); return; }
    const resultado = parsearNotaFiscal(xmlTexto);
    if (resultado.valorTotal == null && resultado.data == null && resultado.descricao == null) {
      setErro('Não foi possível ler esse XML. Confira o formulário abaixo.');
    }
    onConcluir(resultado);
  }

  if (etapa === 'chave') {
    return (
      <>
        <h2 style={{ marginTop: 0 }}>Escanear nota fiscal</h2>
        {cameraDisponivel && (
          <video ref={videoRef} className="escanear-nota-video" muted playsInline aria-label="Câmera" />
        )}
        <p className="sub">Aponte para o QR-code da nota, ou digite a chave de acesso:</p>
        <div className="linha">
          <input
            aria-label="Chave de acesso" className="cresce" placeholder="44 dígitos"
            value={chaveDigitada} onChange={(e) => setChaveDigitada(e.target.value)}
          />
          <button className="botao botao-primario" onClick={enviarChaveManual}>Continuar</button>
        </div>
        {erro && <p className="aviso">{erro}</p>}
        <button className="botao" onClick={onFechar}>Cancelar</button>
      </>
    );
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Buscar XML da nota</h2>
      <div className="campo">
        <label htmlFor="escanear-nota-chave">Chave extraída</label>
        <div className="linha">
          <input id="escanear-nota-chave" aria-label="Chave extraída" className="cresce" value={chave} readOnly />
          <button className="botao" onClick={() => navigator.clipboard?.writeText(chave)}>Copiar</button>
        </div>
      </div>
      <p className="sub">
        Cole essa chave num site de consulta de NFC-e e baixe o XML. Depois, volte aqui e
        envie o arquivo ou cole o texto abaixo.
      </p>
      <div className="campo">
        <label htmlFor="escanear-nota-arquivo">Arquivo XML</label>
        <input id="escanear-nota-arquivo" type="file" accept=".xml,text/xml" onChange={onArquivoXml} />
      </div>
      <div className="campo">
        <label htmlFor="escanear-nota-texto">Ou cole o texto do XML</label>
        <textarea
          id="escanear-nota-texto" rows={5} value={xmlTexto}
          onChange={(e) => setXmlTexto(e.target.value)}
        />
      </div>
      {erro && <p className="aviso">{erro}</p>}
      <div className="linha">
        <button className="botao botao-primario" onClick={concluir}>Continuar</button>
        <button className="botao" onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
