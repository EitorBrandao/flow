import type { NaturezaBruto } from './tipos';

/** Forma canônica de uma descrição, para comparar duas descrições que são a mesma coisa. */
export function normalizarDescricao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MOLDE_PIX = /^Transfer[êe]ncia (?:enviada|recebida) pelo Pix(?: via Open Banking)? - /i;
const MOLDE_BOLETO = /^Pagamento de boleto efetuado - /i;

/**
 * Nome da contraparte de um lançamento do Nubank. O Nubank monta a descrição por template, e
 * o que identifica o lançamento é só a contraparte — documento, banco, agência e conta são
 * ruído estável, iguais em todo lançamento daquela pessoa.
 *
 * Depois do molde, o nome é sempre o PRIMEIRO campo. Cortar no primeiro " - " é o que torna
 * esta função imune ao nome de banco com hífen ("BANCO ALFA - IP (0001)"): quem parte a
 * descrição inteira por " - " e conta campos a partir do fim erra exatamente nesse caso.
 *
 * Limite conhecido: uma contraparte cujo próprio nome contenha " - " sai truncada. Isso não
 * atrapalha o casamento, que só precisa ser consistente, não fiel.
 */
export function contraparteNubank(descricao: string): string {
  const boleto = MOLDE_BOLETO.exec(descricao);
  if (boleto) return descricao.slice(boleto[0].length).trim();

  const pix = MOLDE_PIX.exec(descricao);
  if (!pix) return descricao;

  const resto = descricao.slice(pix[0].length);
  const corte = resto.search(/\s+-\s+/);
  return (corte === -1 ? resto : resto.slice(0, corte)).trim();
}

/** Movimento interno da caixinha do Nubank. Ver a seção "Movimento interno" da spec. */
export function naturezaNubank(descricao: string): NaturezaBruto | undefined {
  const n = normalizarDescricao(descricao);
  if (n === 'aplicacao rdb') return 'aplicacaoInterna';
  if (n === 'resgate rdb') return 'resgateInterno';
  return undefined;
}
