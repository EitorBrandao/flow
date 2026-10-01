import type { Adapter } from '../tipos';
import { nubankConta } from './nubankConta';
import { nubankFatura } from './nubankFatura';
import { santanderFatura } from './santanderFatura';

/** Registro dos adapters conhecidos. A entrega 3 acrescenta o OFX genérico — ver
 *  `docs/superpowers/specs/2026-09-17-conferencia-por-extrato-design.md`. A fatura do Nubank
 *  veio antes, em `2026-09-30-fatura-nubank-csv-design.md`. */
export const ADAPTERS: Adapter[] = [nubankConta, nubankFatura, santanderFatura];

/** Primeiro adapter que reconhece o CONTEÚDO do arquivo — nunca o nome, que varia livremente
 *  entre bancos e canais. */
export function detectarAdapter(nome: string, inicio: string): Adapter | undefined {
  return ADAPTERS.find((a) => a.detectar(nome, inicio));
}
