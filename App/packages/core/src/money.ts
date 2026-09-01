// Dinheiro em centavos (inteiro). Nunca usar float para valores monetários.
// Ver design.md §Data Models (Convenções globais) e §Correctness Properties.

export type Cents = number // inteiro; 9990 = R$ 99,90

/** Converte um valor decimal (ex.: 99.9) em centavos inteiros. */
export function toCents(value: number): Cents {
  return Math.round(value * 100)
}

/** Converte centavos em valor decimal (ex.: 9990 -> 99.9). */
export function fromCents(cents: Cents): number {
  return cents / 100
}

/**
 * Divide um total em N parcelas inteiras em centavos, de forma que a soma
 * das parcelas seja exatamente igual ao total. A diferença de arredondamento
 * é alocada à última parcela (Correctness Property 3).
 */
export function splitInstallments(totalCents: Cents, count: number): Cents[] {
  if (count < 1) throw new Error('count deve ser >= 1')
  const base = Math.floor(totalCents / count)
  const parts: Cents[] = new Array(count).fill(base)
  const remainder = totalCents - base * count
  parts[count - 1] += remainder
  return parts
}

/** Soma segura de centavos. */
export function sumCents(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0)
}
