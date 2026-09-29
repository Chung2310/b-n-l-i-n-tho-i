import { describe, expect, it } from 'vitest';
import { validateProductCommissionRule } from './product-commission.service';

describe('standalone product commission bounds', () => {
  it.each([0.001, 1, 149999, 300001, 1000000000])('accepts any positive amount or percentage: %s', value => {
    expect(validateProductCommissionRule({ kind: 'phone', amount: value })).toEqual({ kind: 'phone', amount: value });
    expect(validateProductCommissionRule({ kind: 'accessory', rateBps: value })).toEqual({ kind: 'accessory', rateBps: value });
  });
  it.each([0, -1, NaN, Infinity, -Infinity, undefined, null, '100'])('rejects invalid values: %s', value => {
    expect(() => validateProductCommissionRule({ kind: 'phone', amount: value })).toThrow();
    expect(() => validateProductCommissionRule({ kind: 'accessory', rateBps: value })).toThrow();
  });
});
