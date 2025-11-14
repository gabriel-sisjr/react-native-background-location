import { extractDefinedProperties } from '../../utils/objectUtils';

describe('objectUtils', () => {
  describe('extractDefinedProperties', () => {
    it('should extract all defined properties', () => {
      const source = {
        a: 1,
        b: 'test',
        c: undefined,
        d: null,
        e: false,
      };

      const result = extractDefinedProperties(source);

      expect(result).toEqual({
        a: 1,
        b: 'test',
        d: null,
        e: false,
      });
      expect(result.c).toBeUndefined();
    });

    it('should handle empty object', () => {
      const source = {};
      const result = extractDefinedProperties(source);
      expect(result).toEqual({});
    });

    it('should handle object with only undefined properties', () => {
      const source = {
        a: undefined,
        b: undefined,
      };
      const result = extractDefinedProperties(source);
      expect(result).toEqual({});
    });

    it('should handle object with inherited properties (line 17)', () => {
      // Create object with inherited properties to test hasOwnProperty check
      const parent = { inherited: 'value' };
      const source = Object.create(parent);
      source.own = 'ownValue';
      source.undefinedProp = undefined;

      const result = extractDefinedProperties(source);

      // Should only include own properties, not inherited ones
      expect(result).toEqual({
        own: 'ownValue',
      });
      expect(result.inherited).toBeUndefined();
      expect(result.undefinedProp).toBeUndefined();
    });

    it('should handle object with all defined properties', () => {
      const source = {
        a: 1,
        b: 'test',
        c: true,
        d: null,
        e: 0,
        f: '',
      };

      const result = extractDefinedProperties(source);

      expect(result).toEqual(source);
    });

    it('should handle object with nested structures', () => {
      const source = {
        a: { nested: 'value' },
        b: undefined,
        c: [1, 2, 3],
      };

      const result = extractDefinedProperties(source);

      expect(result).toEqual({
        a: { nested: 'value' },
        c: [1, 2, 3],
      });
    });
  });
});
