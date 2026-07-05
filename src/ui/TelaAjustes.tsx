import { useState } from 'react';
import Assinaturas from './ajustes/Assinaturas';
import Backup from './ajustes/Backup';
import Boxes from './ajustes/Boxes';
import Cartoes from './ajustes/Cartoes';
import Categorias from './ajustes/Categorias';
import CategoriasCartao from './ajustes/CategoriasCartao';
import Importar from './ajustes/Importar';
import Recorrencias from './ajustes/Recorrencias';
import Wiki from './ajustes/Wiki';

type Secao = 'menu' | 'categorias' | 'recorrencias' | 'boxes' | 'cartoes'
  | 'categoriasCartao' | 'assinaturas' | 'backup' | 'importar' | 'wiki';

const ITENS: { id: Secao; rotulo: string }[] = [
  { id: 'categorias', rotulo: 'Categorias' },
  { id: 'recorrencias', rotulo: 'Recorrências' },
  { id: 'boxes', rotulo: 'Boxes' },
  { id: 'cartoes', rotulo: 'Cartões' },
  { id: 'categoriasCartao', rotulo: 'Categorias do cartão' },
  { id: 'assinaturas', rotulo: 'Assinaturas do cartão' },
  { id: 'backup', rotulo: 'Backup e restauração' },
  { id: 'importar', rotulo: 'Importar planilha' },
  { id: 'wiki', rotulo: 'Wiki' },
];

export default function TelaAjustes() {
  const [secao, setSecao] = useState<Secao>('menu');
  if (secao === 'menu') {
    return (
      <div className="tela">
        <h2>Ajustes</h2>
        <div className="lista">
          {ITENS.map((i) => (
            <button key={i.id} className="item" style={{ cursor: 'pointer' }} onClick={() => setSecao(i.id)}>
              <span className="cresce" style={{ textAlign: 'left' }}>{i.rotulo}</span>
              <span>›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="tela">
      <button className="botao" style={{ alignSelf: 'flex-start' }} onClick={() => setSecao('menu')}>‹ Ajustes</button>
      {secao === 'categorias' && <Categorias />}
      {secao === 'recorrencias' && <Recorrencias />}
      {secao === 'boxes' && <Boxes />}
      {secao === 'cartoes' && <Cartoes />}
      {secao === 'categoriasCartao' && <CategoriasCartao />}
      {secao === 'assinaturas' && <Assinaturas />}
      {secao === 'backup' && <Backup />}
      {secao === 'importar' && <Importar />}
      {secao === 'wiki' && <Wiki />}
    </div>
  );
}
