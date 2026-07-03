import { useState } from 'react';
import Backup from './ajustes/Backup';
import Boxes from './ajustes/Boxes';
import Categorias from './ajustes/Categorias';
import Importar from './ajustes/Importar';
import Recorrencias from './ajustes/Recorrencias';

type Secao = 'menu' | 'categorias' | 'recorrencias' | 'boxes' | 'backup' | 'importar';

const ITENS: { id: Secao; rotulo: string }[] = [
  { id: 'categorias', rotulo: 'Categorias' },
  { id: 'recorrencias', rotulo: 'Recorrências' },
  { id: 'boxes', rotulo: 'Boxes' },
  { id: 'backup', rotulo: 'Backup e restauração' },
  { id: 'importar', rotulo: 'Importar planilha' },
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
      {secao === 'backup' && <Backup />}
      {secao === 'importar' && <Importar />}
    </div>
  );
}
