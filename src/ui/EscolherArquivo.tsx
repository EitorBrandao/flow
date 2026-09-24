import { useRef } from 'react';

interface Props {
  id: string;
  accept: string;
  onEscolher: (arquivo: File) => void;
  /** azul só quando escolher o arquivo é a ação principal da tela */
  primario?: boolean;
  /** nome para leitores de tela quando não há um `<label htmlFor={id}>` */
  rotulo?: string;
}

/** Botão "Escolher arquivo" do app, no lugar do controle nativo do navegador — que escreve
 *  o próprio texto, às vezes em inglês. O input real fica por cima do botão, invisível
 *  (`.selecionar-arquivo`), e é ele que recebe o toque. */
export default function EscolherArquivo({ id, accept, onEscolher, primario, rotulo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="selecionar-arquivo">
      <button
        type="button" className={primario ? 'botao botao-primario' : 'botao'} aria-hidden="true" tabIndex={-1}
        style={{ width: '100%' }} onClick={() => inputRef.current?.click()}
      >Escolher arquivo</button>
      <input
        ref={inputRef} id={id} type="file" accept={accept} aria-label={rotulo}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) onEscolher(arquivo);
          e.target.value = '';
        }}
      />
    </div>
  );
}
