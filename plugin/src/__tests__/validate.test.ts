import { PluginError } from '../errors/PluginError';
import { validatePluginProps } from '../options/validate';

describe('validatePluginProps', () => {
  it('returns {} when input is undefined', () => {
    expect(validatePluginProps(undefined)).toEqual({});
  });

  it('returns {} when input is null', () => {
    expect(validatePluginProps(null)).toEqual({});
  });

  it('returns empty-valued props when input is an empty object', () => {
    expect(validatePluginProps({})).toEqual({
      locationWhenInUseUsageDescription: undefined,
      locationAlwaysAndWhenInUseUsageDescription: undefined,
      locationAlwaysUsageDescription: undefined,
      temporaryUsageDescriptions: undefined,
    });
  });

  it('throws INVALID_PROPS_TYPE when input is an array', () => {
    try {
      validatePluginProps([]);
      throw new Error('expected validatePluginProps to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PluginError);
      expect((err as PluginError).code).toBe('INVALID_PROPS_TYPE');
    }
  });

  it('throws INVALID_PROPS_TYPE when input is a string', () => {
    try {
      validatePluginProps('hello');
      throw new Error('expected validatePluginProps to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PluginError);
      expect((err as PluginError).code).toBe('INVALID_PROPS_TYPE');
    }
  });

  it('throws INVALID_PROPS_TYPE when input is a number', () => {
    try {
      validatePluginProps(42);
      throw new Error('expected validatePluginProps to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PluginError);
      expect((err as PluginError).code).toBe('INVALID_PROPS_TYPE');
    }
  });

  it('throws INVALID_USAGE_DESCRIPTION when locationWhenInUseUsageDescription is a non-string', () => {
    try {
      validatePluginProps({ locationWhenInUseUsageDescription: 123 });
      throw new Error('expected validatePluginProps to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PluginError);
      expect((err as PluginError).code).toBe('INVALID_USAGE_DESCRIPTION');
    }
  });

  it('throws INVALID_USAGE_DESCRIPTION when locationWhenInUseUsageDescription is an empty string', () => {
    try {
      validatePluginProps({ locationWhenInUseUsageDescription: '' });
      throw new Error('expected validatePluginProps to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PluginError);
      expect((err as PluginError).code).toBe('INVALID_USAGE_DESCRIPTION');
    }
  });

  it('throws INVALID_USAGE_DESCRIPTION when locationWhenInUseUsageDescription is whitespace-only', () => {
    try {
      validatePluginProps({ locationWhenInUseUsageDescription: '   \t\n  ' });
      throw new Error('expected validatePluginProps to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PluginError);
      expect((err as PluginError).code).toBe('INVALID_USAGE_DESCRIPTION');
    }
  });

  describe.each([
    'locationAlwaysAndWhenInUseUsageDescription',
    'locationAlwaysUsageDescription',
  ])('%s', (prop) => {
    it.each([
      ['a non-string', 123],
      ['an empty string', ''],
      ['whitespace-only', '   \t\n  '],
    ])('throws INVALID_USAGE_DESCRIPTION when it is %s', (_label, value) => {
      try {
        validatePluginProps({ [prop]: value });
        throw new Error('expected validatePluginProps to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(PluginError);
        expect((err as PluginError).code).toBe('INVALID_USAGE_DESCRIPTION');
      }
    });
  });

  it.each([[''], ['   ']])(
    'throws INVALID_TEMPORARY_USAGE_DESCRIPTION_VALUE when a temporaryUsageDescriptions value is %p',
    (value) => {
      try {
        validatePluginProps({ temporaryUsageDescriptions: { Foo: value } });
        throw new Error('expected validatePluginProps to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(PluginError);
        expect((err as PluginError).code).toBe(
          'INVALID_TEMPORARY_USAGE_DESCRIPTION_VALUE'
        );
      }
    }
  );

  it('throws INVALID_TEMPORARY_USAGE_DESCRIPTIONS when temporaryUsageDescriptions is an array', () => {
    try {
      validatePluginProps({ temporaryUsageDescriptions: ['x'] });
      throw new Error('expected validatePluginProps to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PluginError);
      expect((err as PluginError).code).toBe(
        'INVALID_TEMPORARY_USAGE_DESCRIPTIONS'
      );
    }
  });

  it('throws INVALID_TEMPORARY_USAGE_DESCRIPTION_VALUE when a temporaryUsageDescriptions value is a non-string', () => {
    try {
      validatePluginProps({ temporaryUsageDescriptions: { Foo: 42 } });
      throw new Error('expected validatePluginProps to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PluginError);
      expect((err as PluginError).code).toBe(
        'INVALID_TEMPORARY_USAGE_DESCRIPTION_VALUE'
      );
    }
  });

  it('returns a fully-populated props object unchanged when all fields are valid', () => {
    const input = {
      locationWhenInUseUsageDescription:
        '$(PRODUCT_NAME) uses your location to log trips.',
      locationAlwaysAndWhenInUseUsageDescription:
        '$(PRODUCT_NAME) tracks your location in the background to log trips.',
      locationAlwaysUsageDescription:
        '$(PRODUCT_NAME) needs always-on location to log trips.',
      temporaryUsageDescriptions: {
        AccurateFix: 'We need accurate location for in-app navigation.',
      },
    };
    expect(validatePluginProps(input)).toEqual(input);
  });

  describe('unknown options', () => {
    const catchError = (raw: unknown): PluginError => {
      try {
        validatePluginProps(raw);
      } catch (err) {
        return err as PluginError;
      }
      throw new Error('expected validatePluginProps to throw');
    };

    it('throws UNKNOWN_PROP for a misspelled option and lists the supported ones', () => {
      const err = catchError({ locationWhenInUseUsageDescripton: 'x' });
      expect(err).toBeInstanceOf(PluginError);
      expect(err.code).toBe('UNKNOWN_PROP');
      expect(err.message).toContain('`locationWhenInUseUsageDescripton`');
      expect(err.message).toContain('Unknown plugin option:');
      expect(err.message).toContain(
        'Supported options: `locationWhenInUseUsageDescription`, ' +
          '`locationAlwaysAndWhenInUseUsageDescription`, ' +
          '`locationAlwaysUsageDescription`, `temporaryUsageDescriptions`.'
      );
      expect(err.detail).toEqual({
        unknownKeys: ['locationWhenInUseUsageDescripton'],
      });
    });

    it('lists every unknown option when there are several', () => {
      const err = catchError({
        foo: 1,
        locationWhenInUseUsageDescription: 'ok',
        bar: 2,
      });
      expect(err.code).toBe('UNKNOWN_PROP');
      expect(err.message).toContain('Unknown plugin options: `foo`, `bar`.');
      expect(err.detail).toEqual({ unknownKeys: ['foo', 'bar'] });
    });

    it('rejects the expo-location style option names', () => {
      const err = catchError({
        locationWhenInUsePermission: 'x',
        isIosBackgroundLocationEnabled: true,
      });
      expect(err.code).toBe('UNKNOWN_PROP');
      expect(err.message).toContain('`locationWhenInUsePermission`');
      expect(err.message).toContain('`isIosBackgroundLocationEnabled`');
    });

    it('rejects an unknown option even when its value is undefined', () => {
      expect(catchError({ extra: undefined }).code).toBe('UNKNOWN_PROP');
    });

    it('accepts every supported option on its own', () => {
      expect(() =>
        validatePluginProps({ temporaryUsageDescriptions: { A: 'a' } })
      ).not.toThrow();
      expect(() =>
        validatePluginProps({ locationAlwaysUsageDescription: 'a' })
      ).not.toThrow();
      expect(() =>
        validatePluginProps({ locationAlwaysAndWhenInUseUsageDescription: 'a' })
      ).not.toThrow();
    });
  });

  describe('type names in messages', () => {
    const messageOf = (raw: unknown): string => {
      try {
        validatePluginProps(raw);
      } catch (err) {
        return (err as PluginError).message;
      }
      throw new Error('expected validatePluginProps to throw');
    };

    it('reports a null usage description as null, not object', () => {
      expect(messageOf({ locationWhenInUseUsageDescription: null })).toContain(
        'Received null.'
      );
    });

    it('reports a null temporaryUsageDescriptions value as null, not object', () => {
      expect(
        messageOf({ temporaryUsageDescriptions: { Foo: null } })
      ).toContain('Received null.');
    });

    it('keeps the real type name for the other non-strings', () => {
      expect(messageOf({ locationAlwaysUsageDescription: 123 })).toContain(
        'Received number.'
      );
      expect(
        messageOf({ temporaryUsageDescriptions: { Foo: true } })
      ).toContain('Received boolean.');
    });
  });
});
