import { describe, it, expect } from 'vitest';
import { calculateProfit, profitMargin } from './formatters';

describe('calculateProfit', () => {
  it('calcula la ganancia de un artículo', () => {
    expect(calculateProfit(100_000, 70_000)).toBe(30_000);
  });

  it('multiplica por la cantidad correctamente', () => {
    expect(calculateProfit(50_000, 30_000, 3)).toBe(60_000);
  });

  it('devuelve 0 cuando precio de venta y costo son iguales', () => {
    expect(calculateProfit(80_000, 80_000)).toBe(0);
  });

  it('devuelve negativo cuando el costo supera el precio de venta', () => {
    expect(calculateProfit(50_000, 60_000)).toBe(-10_000);
  });

  it('usa qty=1 por defecto', () => {
    expect(calculateProfit(100_000, 40_000)).toBe(60_000);
  });
});

describe('profitMargin', () => {
  it('calcula el margen de ganancia correctamente', () => {
    expect(profitMargin(100_000, 70_000)).toBe('30.0');
  });

  it('devuelve 0 cuando el precio de venta es 0 (evita división por cero)', () => {
    expect(profitMargin(0, 50_000)).toBe('0');
  });

  it('devuelve 0.0 cuando no hay ganancia', () => {
    expect(profitMargin(100_000, 100_000)).toBe('0.0');
  });

  it('redondea a un decimal', () => {
    // 1/3 ≈ 33.3%
    expect(profitMargin(300_000, 200_000)).toBe('33.3');
  });
});
