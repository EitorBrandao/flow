import changelogRaw from '../../../CHANGELOG.md?raw';
import { parseChangelog } from './changelog';

function dataBonita(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function Versao() {
  const versoes = parseChangelog(changelogRaw);
  const atual = versoes[0];

  return (
    <div className="tela">
      <h2>Versão</h2>
      {atual && (
        <p className="sub">Você está na versão {atual.versao}, de {dataBonita(atual.data)}.</p>
      )}
      {versoes.map((v) => (
        <div className="card" key={v.versao}>
          <div className="secao">
            <strong>{v.versao}</strong>
            <span className="sub">{dataBonita(v.data)}</span>
          </div>
          {v.secoes.map((s) => (
            <div key={s.titulo}>
              <p className="rotulo-grupo">{s.titulo}</p>
              <ul>
                {s.itens.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
