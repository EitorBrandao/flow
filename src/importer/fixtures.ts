import type * as XLSX from 'xlsx';

/** Mini "box (eitor)": 5 dias a partir de 2026-01-01 (serial 46023).
 *  Categorias: salario (ganho, L9); cartão (gasto, L16); aluguel (gasto, L17).
 *  Movimentos: +1500 em 01-02; -200,50 em 01-03; estorno -50 (gasto negativo) em 01-04.
 *  Linha 7 (saldo, como o Excel cacheia): 1000 | 2500 | 2299,5 | 2349,5 | 2349,5 */
export function boxSheetFixture(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = { '!ref': 'A1:F30' } as XLSX.WorkSheet;
  const cols = ['B', 'C', 'D', 'E', 'F'];
  cols.forEach((c, i) => { ws[`${c}2`] = { t: 'n', v: 46023 + i }; });
  ws['A7'] = { t: 's', v: 'Saldo' };
  ws['A8'] = { t: 's', v: 'Ganhos' };
  ws['A9'] = { t: 's', v: 'salario' };
  ws['A15'] = { t: 's', v: 'Gastos' };
  ws['A16'] = { t: 's', v: 'cartão' };
  ws['A17'] = { t: 's', v: 'aluguel' };
  ws['B8'] = { t: 'n', f: 'SUM(B9:B14)', v: 0 };
  ws['B15'] = { t: 'n', f: 'SUM(B16:B30)', v: 0 };
  ws['C9'] = { t: 'n', v: 1500 };
  ws['D16'] = { t: 'n', v: 200.5 };
  ws['E17'] = { t: 'n', v: -50 };
  const saldos = [1000, 2500, 2299.5, 2349.5, 2349.5];
  cols.forEach((c, i) => { ws[`${c}7`] = { t: 'n', v: saldos[i] }; });
  return ws;
}

/** Mini "Simulacoes_Eitor" com um bloco de empréstimo. */
export function simulacoesFixture(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = { '!ref': 'A1:M16' } as XLSX.WorkSheet;
  ws['A2'] = { t: 's', v: 'Emprestimo Teste' };
  ws['A4'] = { t: 's', v: 'valor total' };
  ws['A5'] = { t: 's', v: 'data inicio' };
  ws['B5'] = { t: 'n', v: 45841 }; // 2025-07-03
  ws['A6'] = { t: 's', v: 'dia de pagamento' };
  ws['B6'] = { t: 'n', v: 3 };
  ws['A7'] = { t: 's', v: 'parcelas' };
  ws['B7'] = { t: 'n', v: 8 };
  ws['A8'] = { t: 's', v: 'valor mensal' };
  ws['B8'] = { t: 'n', v: 126.84 };
  return ws;
}
