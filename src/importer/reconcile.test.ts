import { boxSheetFixture } from './fixtures';
import { lerBoxSheet, montarResultado } from './xlsx';
import { conferir } from './reconcile';

it('planilha consistente não gera divergências', () => {
  const imp = lerBoxSheet(boxSheetFixture(), 'eitor');
  const res = montarResultado([imp], [], '2026-01-02');
  expect(conferir(imp, res)).toEqual([]);
});

it('detecta divergência acima de 1 centavo e reporta o dia', () => {
  const ws = boxSheetFixture();
  ws['D7'] = { t: 'n', v: 2300.0 }; // saldo errado em 2026-01-03 (correto: 2299,50)
  const imp = lerBoxSheet(ws, 'eitor');
  const res = montarResultado([imp], [], '2026-01-02');
  const divs = conferir(imp, res);
  expect(divs).toEqual([{ data: '2026-01-03', saldoAppCent: 229950, saldoPlanilhaCent: 230000 }]);
});

it('tolera 1 centavo de poeira de float', () => {
  const ws = boxSheetFixture();
  ws['D7'] = { t: 'n', v: 2299.51 };
  const imp = lerBoxSheet(ws, 'eitor');
  const res = montarResultado([imp], [], '2026-01-02');
  expect(conferir(imp, res)).toEqual([]);
});
