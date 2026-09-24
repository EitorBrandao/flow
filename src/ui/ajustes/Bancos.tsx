import { Pencil } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import * as repo from '../../db/repo';
import { bancosDaBox } from '../../domain/bancos';
import { proximaOrdem } from '../../domain/categorias';
import { formatarDataBR } from '../../domain/dates';
import { formatarBRL } from '../../domain/money';
import type { ISODate } from '../../domain/types';
import { boxIdEfetivo, boxIdsSelecionadas, useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';

function textoContagemCartoes(n: number): string {
  if (n === 0) return 'nenhum cartão';
  if (n === 1) return '1 cartão';
  return `${n} cartões`;
}

export default function Bancos() {
  const { dados, boxSel, recarregar, hoje } = useApp();
  const [nomeNovo, setNomeNovo] = useState('');
  const [avisoCriacao, setAvisoCriacao] = useState('');
  const [avisoEdicao, setAvisoEdicao] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [temSaldo, setTemSaldo] = useState(false);
  const [magnitude, setMagnitude] = useState(0);
  const [negativo, setNegativo] = useState(false);
  const [dataEdicao, setDataEdicao] = useState<ISODate>(hoje);
  const uid = useId();

  // Trocar de box com um banco aberto não pode deixar o item sumido da lista (filtrada pela
  // box nova) e o formulário de criação escondido — mesmo cuidado de Cartoes/Recorrencias.
  useEffect(() => {
    setEditandoId(null);
    setAvisoEdicao('');
  }, [boxSel]);

  if (!dados) return null;

  // Listar usa boxIdsSelecionadas: 'casa' consolida todas as boxes (mesmo contrato de
  // todas as outras telas que consultam boxIdsSelecionadas); numa box concreta, é sempre
  // um array de um id só.
  const boxIds = boxIdsSelecionadas(dados, boxSel);
  const bancos = bancosDaBox(dados.bancos, boxIds);

  // Criar usa boxIdEfetivo: com 'casa' selecionada e várias boxes, o alvo da criação não
  // pode ser "a primeira do array" (dependeria da ordem de carregamento) — tem que ser a
  // box concreta chamada "casa". Mesmo contrato de Cartoes.tsx e CategoriasCartao.tsx.
  const boxIdCriacao = boxIdEfetivo(dados, boxSel);
  if (boxIdCriacao == null) {
    return (
      <div className="tela">
        <h2>Bancos</h2>
        <p className="sub">A box "casa" não foi encontrada — crie uma em Ajustes → Boxes.</p>
      </div>
    );
  }
  const nomeBoxCriacao = dados.boxes.find((b) => b.id === boxIdCriacao)!.nome;

  function cartoesDoBanco(bancoId: string): number {
    return dados!.cartoes.filter((c) => c.bancoId === bancoId).length;
  }

  async function criar() {
    // Guard silencioso deixaria quem está cadastrando o primeiro banco sem saber o que
    // faltou — mesmo cuidado já registrado em Boxes.tsx e Viagens.tsx.
    if (!nomeNovo.trim()) {
      setAvisoCriacao('Dê um nome ao banco para criar.');
      return;
    }
    const ordem = proximaOrdem(bancos.filter((b) => b.boxId === boxIdCriacao));
    await repo.salvarBanco({ boxId: boxIdCriacao!, nome: nomeNovo.trim(), ordem });
    await recarregar();
    setNomeNovo('');
    setAvisoCriacao('');
  }

  function editar(id: string) {
    const b = bancos.find((x) => x.id === id)!;
    setEditandoId(id);
    setNomeEdicao(b.nome);
    setTemSaldo(b.saldoDeclaradoCent != null);
    setMagnitude(Math.abs(b.saldoDeclaradoCent ?? 0));
    setNegativo((b.saldoDeclaradoCent ?? 0) < 0);
    setDataEdicao(b.dataSaldoDeclarado ?? hoje);
    setAvisoEdicao('');
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setAvisoEdicao('');
  }

  async function salvarEdicao() {
    if (!editandoId) return;
    const nome = nomeEdicao.trim();
    // Mesmo aviso da criação: sem isso, salvar com o nome apagado voltaria calado.
    if (!nome) {
      setAvisoEdicao('Dê um nome ao banco para salvar.');
      return;
    }
    const saldoDeclaradoCent = temSaldo ? (negativo ? -magnitude : magnitude) : null;
    const dataSaldoDeclarado = temSaldo ? (dataEdicao || null) : null;
    await repo.atualizarBanco(editandoId, { nome, saldoDeclaradoCent, dataSaldoDeclarado });
    setEditandoId(null);
    setAvisoEdicao('');
    await recarregar();
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir este banco? Os cartões vinculados a ele perdem a vinculação, sem apagar nada.')) return;
    await repo.excluirBanco(id);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Bancos</h2>
      {!editandoId && (
        <>
          <h2>Novo banco</h2>
          {avisoCriacao && <p className="aviso">{avisoCriacao}</p>}
          <div className="form-linha">
            <div className="campo">
              <label htmlFor={`${uid}-nome`}>Nome do banco</label>
              <input
                id={`${uid}-nome`} placeholder="ex.: Banco Um" value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
              />
            </div>
            <button className="botao botao-primario" onClick={criar}>Criar</button>
          </div>
          <p className="sub">Será criado na box {nomeBoxCriacao}.</p>
        </>
      )}

      <p className="rotulo-grupo">Bancos desta box</p>
      <div className="lista">
        {bancos.map((b) => {
          const emEdicao = editandoId === b.id;
          return (
            <div className={`item${emEdicao ? ' item-coluna' : ''}`} key={b.id}>
              {emEdicao ? (
                <>
                  {avisoEdicao && <p className="aviso">{avisoEdicao}</p>}
                  <div className="form-linha">
                    <div className="campo">
                      <label htmlFor={`${b.id}-nome`}>Nome</label>
                      <input
                        id={`${b.id}-nome`} value={nomeEdicao}
                        onChange={(e) => setNomeEdicao(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="campo">
                    <label htmlFor={`${b.id}-tem-saldo`}>
                      <input
                        id={`${b.id}-tem-saldo`} type="checkbox" checked={temSaldo}
                        onChange={(e) => setTemSaldo(e.target.checked)}
                      />
                      {' '}Saldo informado
                    </label>
                  </div>
                  {temSaldo && (
                    <div className="form-linha">
                      <div className="campo">
                        <label htmlFor={`${b.id}-saldo`}>Saldo</label>
                        {/* O rótulo fica ACIMA, como em todo campo do app; o botão de sinal
                            divide a linha de baixo com o valor. Antes isto era um `.campo`
                            com `display:flex` inline — que não desfaz o `flex-direction:
                            column` da classe, então o botão subia e encostava na direita. */}
                        <div className="linha">
                          <button
                            type="button" className="botao botao-sinal" aria-label="Alternar sinal (positivo/negativo)"
                            onClick={() => setNegativo((n) => !n)}
                          >
                            {negativo ? '−' : '+'}
                          </button>
                          <CampoValor id={`${b.id}-saldo`} valorCentavos={magnitude} onChange={setMagnitude} style={{ flex: 1, minWidth: 0 }} />
                        </div>
                      </div>
                      <div className="campo">
                        <label htmlFor={`${b.id}-data`}>Data do saldo</label>
                        <CampoData id={`${b.id}-data`} value={dataEdicao} onChange={setDataEdicao} />
                      </div>
                    </div>
                  )}
                  <div className="form-botoes">
                    <button className="botao" onClick={cancelarEdicao}>Cancelar</button>
                    <button className="botao botao-primario" onClick={salvarEdicao}>Salvar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="cresce">
                    {b.nome}
                    <div className="sub">
                      {b.saldoDeclaradoCent != null
                        ? `${formatarBRL(b.saldoDeclaradoCent)} informado em ${formatarDataBR(b.dataSaldoDeclarado!)}`
                        : 'saldo ainda não informado'}
                      {' · '}{textoContagemCartoes(cartoesDoBanco(b.id))}
                    </div>
                  </div>
                  <button className="botao" aria-label="Editar" onClick={() => editar(b.id)}><Pencil size={16} /></button>
                  <button className="botao botao-perigo" onClick={() => excluir(b.id)}>Excluir</button>
                </>
              )}
            </div>
          );
        })}
        {bancos.length === 0 && (
          <p className="sub">
            Nenhum banco cadastrado nesta box. Sem bancos, a conferência da tela Hoje continua
            com um campo único, como sempre foi — cadastre um banco para cada conta que você
            quiser conferir separadamente.
          </p>
        )}
      </div>
    </div>
  );
}
