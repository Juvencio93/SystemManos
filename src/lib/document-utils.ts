/**
 * Documento (CPF/CNPJ) e telefone — validação e máscara, em linguagem
 * leiga nas mensagens. Funções puras, sem nada de servidor: o formulário
 * de cadastro usa a máscara e o servidor usa a validação.
 */
import { formatCnpj, isValidCnpj, onlyDigits } from "./cnpj-utils";

export { onlyDigits };

/** 000.000.000-00 */
export function formatCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** CPF (11 dígitos) ou CNPJ (14 dígitos), com a máscara de cada um. */
export function formatDocument(value: string) {
  const d = onlyDigits(value);
  if (d.length > 11) return formatCnpj(value);
  return formatCpf(value);
}

/** (00) 00000-0000 ou (00) 0000-0000 */
export function formatPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) {
      sum += Number(cpf[i]) * (len + 1 - i);
    }
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** CPF com 11 dígitos ou CNPJ com 14 dígitos, com os dígitos conferidos. */
export function isValidDocument(value: string) {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidCpf(value);
  if (d.length === 14) return isValidCnpj(value);
  return false;
}
