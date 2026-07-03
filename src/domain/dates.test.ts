import {
  addDias, addMeses, dataComDia, diasEntre, hojeISO, mesDe,
  serialExcelParaISO, ultimoDiaDoMes,
} from './dates';

it('hojeISO respeita fuso local', () => {
  expect(hojeISO(new Date(2026, 6, 2, 23, 30))).toBe('2026-07-02');
});

it('addDias cruza mês e ano', () => {
  expect(addDias('2026-01-31', 1)).toBe('2026-02-01');
  expect(addDias('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDias('2026-03-10', -10)).toBe('2026-02-28');
});

it('ultimoDiaDoMes', () => {
  expect(ultimoDiaDoMes(2026, 2)).toBe(28);
  expect(ultimoDiaDoMes(2028, 2)).toBe(29);
  expect(ultimoDiaDoMes(2026, 12)).toBe(31);
});

it('dataComDia clampa e extrapola mês', () => {
  expect(dataComDia(2026, 2, 31)).toBe('2026-02-28');
  expect(dataComDia(2026, 13, 5)).toBe('2027-01-05');
  expect(dataComDia(2026, 7, 3)).toBe('2026-07-03');
});

it('diasEntre é inclusivo', () => {
  expect(diasEntre('2026-01-01', '2026-01-03')).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
});

it('mesDe e addMeses', () => {
  expect(mesDe('2026-07-02')).toBe('2026-07');
  expect(addMeses('2026-12', 1)).toBe('2027-01');
  expect(addMeses('2026-01', -1)).toBe('2025-12');
});

it('serialExcelParaISO usa base 1899-12-30', () => {
  expect(serialExcelParaISO(46023)).toBe('2026-01-01'); // 1º dia do box (eitor) 2026
  expect(serialExcelParaISO(45658)).toBe('2025-01-01');
  expect(serialExcelParaISO(45841)).toBe('2025-07-03'); // 1ª parcela Emprestimo Eitor
});
