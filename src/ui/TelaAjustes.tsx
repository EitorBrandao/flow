import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp, type SecaoAjustes } from '../state/store';
import Assinaturas from './ajustes/Assinaturas';
import Backup from './ajustes/Backup';
import Bancos from './ajustes/Bancos';
import Boxes from './ajustes/Boxes';
import Cartoes from './ajustes/Cartoes';
import Categorias from './ajustes/Categorias';
import CategoriasCartao from './ajustes/CategoriasCartao';
import Importar from './ajustes/Importar';
import Recorrencias from './ajustes/Recorrencias';
import Viagens from './ajustes/Viagens';
import Wiki from './ajustes/Wiki';
import Versao from './ajustes/Versao';
import ModoDeUso from './ajustes/ModoDeUso';
import { versaoAtual } from './ajustes/versaoAtual';

type GrupoId = 'contas' | 'planejamento' | 'cartao' | 'dados' | 'sobre';

const GRUPOS: { id: GrupoId; rotulo: string; itens: { id: SecaoAjustes; rotulo: string }[] }[] = [
  { id: 'contas', rotulo: 'Contas', itens: [
    { id: 'boxes', rotulo: 'Boxes' },
    { id: 'bancos', rotulo: 'Bancos' },
  ] },
  { id: 'planejamento', rotulo: 'Planejamento', itens: [
    { id: 'categorias', rotulo: 'Categorias' },
    { id: 'recorrencias', rotulo: 'Recorrências' },
    { id: 'viagens', rotulo: 'Viagens' },
  ] },
  { id: 'cartao', rotulo: 'Cartão', itens: [
    { id: 'cartoes', rotulo: 'Cartões' },
    { id: 'categoriasCartao', rotulo: 'Categorias do cartão' },
    { id: 'assinaturas', rotulo: 'Assinaturas do cartão' },
  ] },
  { id: 'dados', rotulo: 'Dados', itens: [
    { id: 'importar', rotulo: 'Importar e conferir' },
    { id: 'backup', rotulo: 'Backup e restauração' },
  ] },
  { id: 'sobre', rotulo: 'Sobre o app', itens: [
    { id: 'modos', rotulo: 'Modo de uso' },
    { id: 'wiki', rotulo: 'Wiki' },
    { id: 'versao', rotulo: 'Versão' },
  ] },
];

function grupoDaSecao(secao: SecaoAjustes): GrupoId | null {
  return GRUPOS.find((g) => g.itens.some((i) => i.id === secao))?.id ?? null;
}

function Linha({ rotulo, detalhe, valor, onClick }: { rotulo: string; detalhe?: string; valor?: string; onClick: () => void }) {
  return (
    <button className="item" style={{ cursor: 'pointer' }} onClick={onClick}>
      <span className="cresce" style={{ textAlign: 'left' }}>
        {rotulo}
        {detalhe && <span className="sub" style={{ display: 'block' }}>{detalhe}</span>}
      </span>
      {valor && <span className="sub">{valor}</span>}
      <ChevronRight size={18} color="var(--muted)" aria-hidden="true" />
    </button>
  );
}

export default function TelaAjustes() {
  const { ajustesSecao, limparAjustesSecao, importacao } = useApp();

  // Inicializa a seção: se ajustesSecao foi definido, o lê; caso contrário, menu
  const inicial = (ajustesSecao && ajustesSecao !== 'menu') ? ajustesSecao : 'menu';
  const [secao, setSecao] = useState<SecaoAjustes>(inicial);
  const [grupo, setGrupo] = useState<GrupoId | null>(() => grupoDaSecao(inicial));

  // Sincroniza secao com ajustesSecao: lê na montagem, reage a mudanças, limpa na próxima remontagem
  useEffect(() => {
    if (ajustesSecao && ajustesSecao !== 'menu') {
      setSecao(ajustesSecao);
      setGrupo(grupoDaSecao(ajustesSecao));
      limparAjustesSecao();
    }
  }, [ajustesSecao, limparAjustesSecao]);

  const grupoAtual = GRUPOS.find((g) => g.id === grupo);

  if (secao === 'menu' && !grupoAtual) {
    return (
      <div className="tela">
        <div className="lista">
          {GRUPOS.map((g) => (
            <Linha key={g.id} rotulo={g.rotulo} detalhe={g.itens.map((i) => i.rotulo).join(' · ')} onClick={() => setGrupo(g.id)} />
          ))}
        </div>
      </div>
    );
  }
  if (secao === 'menu' && grupoAtual) {
    return (
      <div className="tela">
        <button className="botao" style={{ alignSelf: 'flex-start' }} onClick={() => setGrupo(null)}>‹ Ajustes</button>
        <h2>{grupoAtual.rotulo}</h2>
        <div className="lista">
          {grupoAtual.itens.map((i) => (
            <Linha
              key={i.id} rotulo={i.rotulo} onClick={() => setSecao(i.id)}
              valor={i.id === 'versao' ? versaoAtual : undefined}
              detalhe={i.id === 'modos' ? 'Simples ou avançado, por tela'
                : i.id === 'importar' && importacao.nomeArquivo ? 'Conferência em andamento' : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tela">
      <button className="botao" style={{ alignSelf: 'flex-start' }} onClick={() => setSecao('menu')}>‹ {grupoAtual ? grupoAtual.rotulo : 'Ajustes'}</button>
      {secao === 'categorias' && <Categorias />}
      {secao === 'recorrencias' && <Recorrencias />}
      {secao === 'boxes' && <Boxes />}
      {secao === 'bancos' && <Bancos />}
      {secao === 'cartoes' && <Cartoes />}
      {secao === 'categoriasCartao' && <CategoriasCartao />}
      {secao === 'assinaturas' && <Assinaturas />}
      {secao === 'viagens' && <Viagens />}
      {secao === 'backup' && <Backup />}
      {secao === 'importar' && <Importar />}
      {secao === 'wiki' && <Wiki />}
      {secao === 'versao' && <Versao />}
      {secao === 'modos' && <ModoDeUso />}
    </div>
  );
}
