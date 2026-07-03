import { useState } from 'react';
import * as repo from '../../db/repo';
import type { Dados } from '../../domain/types';
import { formatarBRL } from '../../domain/money';
import { conferir, type Divergencia } from '../../importer/reconcile';
import { lerPlanilha, type ResultadoImport } from '../../importer/xlsx';
import { useApp } from '../../state/store';

/** Verdadeiro quando já existem lançamentos ou recorrências de origem 'import' —
 *  ou seja, uma reimportação substituiria dados de import anteriores. */
export function precisaConfirmarReimport(dados: Dados | null): boolean {
  if (!dados) return false;
  return dados.lancamentos.some((l) => l.origem === 'import')
    || dados.recorrencias.some((r) => r.origem === 'import');
}

export default function Importar() {
  const { dados, hoje, recarregar } = useApp();
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [erro, setErro] = useState('');
  const [concluido, setConcluido] = useState(false);
  const [confirmarSubstituicao, setConfirmarSubstituicao] = useState(false);

  async function selecionar(file: File) {
    setConcluido(false);
    setConfirmarSubstituicao(false);
    try {
      setResultado(lerPlanilha(new Uint8Array(await file.arrayBuffer()), hoje));
      setErro('');
    } catch (e) {
      setResultado(null);
      setErro(e instanceof Error ? e.message : 'Falha ao ler a planilha.');
    }
  }

  const conferencias: { nome: string; divs: Divergencia[] }[] = resultado
    ? resultado.boxesImportadas
        .filter((b) => b.nome !== 'casa')
        .map((imp) => ({ nome: imp.nome, divs: conferir(imp, resultado) }))
    : [];
  const podeAceitar = resultado != null && conferencias.every((c) => c.divs.length === 0);

  async function aceitar() {
    if (!resultado || !dados) return;
    if (precisaConfirmarReimport(dados) && !confirmarSubstituicao) {
      setConfirmarSubstituicao(true);
      return;
    }
    await repo.aplicarImport(resultado);
    await repo.materializarTodas(dados.config.horizonteProjecao);
    await recarregar();
    setResultado(null);
    setConcluido(true);
    setConfirmarSubstituicao(false);
  }

  return (
    <div className="tela">
      <h2>Importar planilha</h2>
      <p className="sub">Selecione o arquivo "flow of the box" (.xlsx). Reimportar substitui os dados importados anteriormente; lançamentos manuais são preservados.</p>
      <input
        type="file" accept=".xlsx" aria-label="Planilha"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void selecionar(f); e.target.value = ''; }}
      />
      {erro && <p className="aviso">{erro}</p>}
      {concluido && <p className="aviso">Import concluído ✓ — confira o saldo na tela Hoje.</p>}

      {resultado && (
        <>
          <div className="card rolavel">
            <h2>Prévia</h2>
            <table className="tabela">
              <thead>
                <tr><th>Box</th><th>Período</th><th>Categorias</th><th>Lançamentos</th><th>Saldo inicial</th></tr>
              </thead>
              <tbody>
                {resultado.boxesImportadas.map((b) => (
                  <tr key={b.nome}>
                    <td>{b.nome}</td>
                    <td>{b.datas[0]} → {b.datas.at(-1)}</td>
                    <td>{b.categorias.length}</td>
                    <td>{resultado.lancamentos.filter((l) => l.boxId === resultado.boxes.find((x) => x.nome === b.nome)?.id).length}</td>
                    <td>{b.saldoInicialCent != null && b.nome !== 'casa' ? formatarBRL(b.saldoInicialCent) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub">{resultado.recorrencias.length} recorrência(s) de empréstimo detectada(s).</p>
          </div>

          <div className="card">
            <h2>Conferência ao centavo</h2>
            {conferencias.map((c) => (
              <div key={c.nome}>
                {c.divs.length === 0
                  ? <p className="valor-ganho">✓ {c.nome}: saldo bate ao centavo em todos os dias.</p>
                  : (
                    <div className="rolavel">
                      <p className="valor-gasto">✗ {c.nome}: {c.divs.length} divergência(s) — import bloqueado.</p>
                      <table className="tabela">
                        <thead><tr><th>Dia</th><th>App</th><th>Planilha</th></tr></thead>
                        <tbody>
                          {c.divs.slice(0, 10).map((d) => (
                            <tr key={d.data}>
                              <td>{d.data}</td>
                              <td>{formatarBRL(d.saldoAppCent)}</td>
                              <td>{formatarBRL(d.saldoPlanilhaCent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            ))}
            <p className="sub">A box casa não é conferida: na planilha ela é consolidação com datas defasadas; no app ela é calculada ao vivo.</p>
          </div>

          {confirmarSubstituicao ? (
            <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <p className="aviso" style={{ margin: 0 }}>Confirmar substituição dos dados importados?</p>
              <button className="botao botao-primario" onClick={aceitar}>Confirmar</button>
              <button className="botao" onClick={() => setConfirmarSubstituicao(false)}>Cancelar</button>
            </div>
          ) : (
            <button className="botao botao-primario" disabled={!podeAceitar} onClick={aceitar} style={{ padding: 14 }}>
              Aceitar e importar
            </button>
          )}
        </>
      )}
    </div>
  );
}
