import { Pencil } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import * as repo from '../../db/repo';
import { bancoPadrao, bancosDaBox, saldoCalculadoBanco } from '../../domain/bancos';
import { proximaOrdem } from '../../domain/categorias';
import { formatarDataBR } from '../../domain/dates';
import { classeSaldo, formatarSaldo } from '../../domain/money';
import type { ISODate } from '../../domain/types';
import { boxIdConcreta, useApp } from '../../state/store';
import CampoData from '../CampoData';
import CampoValor from '../CampoValor';
import AvisoEscolhaBox from './AvisoEscolhaBox';

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

  // Os bancos são de cada box: com a casa no topo, a tela pede uma box em vez de consolidar.
  const boxId = boxIdConcreta(boxSel);
  if (boxId == null) {
    return (
      <div className="tela">
        <h2>Bancos</h2>
        <AvisoEscolhaBox assunto="Os bancos" />
      </div>
    );
  }
  const bancos = bancosDaBox(dados.bancos, [boxId]);
  const nomeBoxCriacao = dados.boxes.find((b) => b.id === boxId)!.nome;

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
    const ordem = proximaOrdem(bancos.filter((b) => b.boxId === boxId));
    await repo.salvarBanco({ boxId: boxId!, nome: nomeNovo.trim(), ordem });
    await repo.sincronizarCartoes(dados!.config.horizonteProjecao);
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
    if (!window.confirm('Excluir este banco? Os cartões, os lançamentos e as recorrências dele ficam sem banco. Nada é apagado.')) return;
    await repo.excluirBanco(id);
    await repo.sincronizarCartoes(dados!.config.horizonteProjecao);
    await recarregar();
  }

  async function tornarPadrao(id: string) {
    await repo.definirBancoPadrao(id);
    await repo.sincronizarCartoes(dados!.config.horizonteProjecao);
    await recarregar();
  }

  return (
    <div className="tela">
      <h2>Bancos</h2>
      {!editandoId && (
        <>
          <h2>Novo banco</h2>
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
          {avisoCriacao && <p className="aviso">{avisoCriacao}</p>}
          <p className="sub">Será criado na box {nomeBoxCriacao}.</p>
        </>
      )}

      <p className="rotulo-grupo">Nesta box</p>
      <div className="lista">
        {bancos.map((b) => {
          const emEdicao = editandoId === b.id;
          const bancosDaMesmaBox = bancos.filter((x) => x.boxId === b.boxId);
          const temPadrao = bancosDaMesmaBox.length >= 2;
          const ehPadrao = temPadrao && bancoPadrao(dados.bancos, b.boxId)?.id === b.id;
          const saldo = saldoCalculadoBanco(b, dados);
          return (
            <div className="item item-coluna" key={b.id}>
              {emEdicao ? (
                <>
                  <div className="form-linha">
                    <div className="campo">
                      <label htmlFor={`${b.id}-nome`}>Nome</label>
                      <input
                        id={`${b.id}-nome`} autoFocus value={nomeEdicao}
                        onChange={(e) => setNomeEdicao(e.target.value)}
                      />
                    </div>
                  </div>
                  <label htmlFor={`${b.id}-tem-saldo`}>
                    <input
                      id={`${b.id}-tem-saldo`} type="checkbox" checked={temSaldo}
                      onChange={(e) => setTemSaldo(e.target.checked)}
                    />
                    {' '}Saldo informado
                  </label>
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
                    </div>
                  )}
                  {/* Saldo e data em linhas próprias, como em Boxes: dividindo a linha, o
                      valor cortava a 360 px. */}
                  {temSaldo && (
                    <div className="form-linha">
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
                  {avisoEdicao && <p className="aviso">{avisoEdicao}</p>}
                </>
              ) : (
                <>
                  <div className="linha-topo">
                    <div className="cresce">
                      {b.nome}
                      {ehPadrao && <span className="badge" style={{ marginLeft: 6 }}>padrão</span>}
                      <div className="sub">
                        {saldo != null ? (
                          <>
                            <span className={classeSaldo(saldo)}>{formatarSaldo(saldo)}</span>
                            {` calculado a partir do saldo informado em ${formatarDataBR(b.dataSaldoDeclarado!)}`}
                          </>
                        ) : 'saldo ainda não informado'}
                        {' · '}{textoContagemCartoes(cartoesDoBanco(b.id))}
                      </div>
                    </div>
                    <button className="botao" aria-label="Editar" onClick={() => editar(b.id)}><Pencil size={16} /></button>
                  </div>
                  <div className="acoes">
                    {temPadrao && !ehPadrao && (
                      <button className="botao" onClick={() => tornarPadrao(b.id)}>Tornar padrão</button>
                    )}
                    <button className="botao botao-perigo" onClick={() => excluir(b.id)}>Excluir</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {bancos.length === 0 && (
          <p className="sub">
            Nenhum banco cadastrado nesta box. Cadastre um banco para cada conta que você quiser
            conferir separadamente (por exemplo, corrente e poupança). Sem bancos, a conferência
            da tela Hoje usa um único campo de saldo.
          </p>
        )}
      </div>
      {bancos.length > 0 && (
        <p className="sub">
          O saldo mostrado é o último saldo informado mais os lançamentos do banco depois dessa data.
          Informar um novo valor, na tela Hoje, recomeça a conta. Lançamento sem banco não entra na conta
          de nenhum banco.
        </p>
      )}
    </div>
  );
}
