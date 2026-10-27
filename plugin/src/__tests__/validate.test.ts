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
      motionActivity: undefined,
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
      motionActivity: {
        usageDescription:
          '$(PRODUCT_NAME) detects when you are stationary to save battery.',
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
          '`locationAlwaysUsageDescription`, `temporaryUsageDescriptions`, ' +
          '`motionActivity`.'
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
      expect(() => validatePluginProps({ motionActivity: {} })).not.toThrow();
    });
  });

  describe('motionActivity', () => {
    const catchError = (raw: unknown): PluginError => {
      try {
        validatePluginProps(raw);
      } catch (err) {
        return err as PluginError;
      }
      throw new Error('expected validatePluginProps to throw');
    };

    it('leaves motionActivity undefined when the prop is omitted', () => {
      expect(
        validatePluginProps({ locationAlwaysUsageDescription: 'a' })
          .motionActivity
      ).toBeUndefined();
    });

    it('accepts {} as the opt-in with the default usage string', () => {
      const props = validatePluginProps({ motionActivity: {} });
      expect(props.motionActivity).toEqual({});
      expect(props.motionActivity).not.toHaveProperty('usageDescription');
    });

    it('accepts { usageDescription } and returns it unchanged', () => {
      const props = validatePluginProps({
        motionActivity: { usageDescription: 'Custom motion copy' },
      });
      expect(props.motionActivity).toEqual({
        usageDescription: 'Custom motion copy',
      });
    });

    it.each([
      ['true', true, 'boolean'],
      ['null', null, 'null'],
      ["'yes'", 'yes', 'string'],
      ['[]', [], 'array'],
      ['a number', 42, 'number'],
    ])(
      'throws INVALID_MOTION_ACTIVITY when motionActivity is %s',
      (_label, value, received) => {
        const err = catchError({ motionActivity: value });
        expect(err).toBeInstanceOf(PluginError);
        expect(err.code).toBe('INVALID_MOTION_ACTIVITY');
        expect(err.message).toContain(
          '`motionActivity` must be a plain object'
        );
        expect(err.message).toContain(`Received ${received}.`);
        expect(err.detail).toEqual({ fieldName: 'motionActivity', value });
      }
    );

    it.each([
      ['an empty string', ''],
      ['whitespace-only', '   \t\n  '],
    ])(
      'throws INVALID_USAGE_DESCRIPTION for a blank motionActivity.usageDescription (%s)',
      (_label, value) => {
        const err = catchError({ motionActivity: { usageDescription: value } });
        expect(err).toBeInstanceOf(PluginError);
        expect(err.code).toBe('INVALID_USAGE_DESCRIPTION');
        expect(err.message).toContain(
          '`motionActivity.usageDescription` must not be empty or whitespace-only.'
        );
      }
    );

    it.each([
      ['a number', 123, 'number'],
      ['null', null, 'null'],
      ['a boolean', true, 'boolean'],
    ])(
      'throws INVALID_USAGE_DESCRIPTION for a non-string motionActivity.usageDescription (%s)',
      (_label, value, received) => {
        const err = catchError({ motionActivity: { usageDescription: value } });
        expect(err).toBeInstanceOf(PluginError);
        expect(err.code).toBe('INVALID_USAGE_DESCRIPTION');
        expect(err.message).toContain(
          `\`motionActivity.usageDescription\` must be a string when provided. Received ${received}.`
        );
      }
    );

    it('throws UNKNOWN_PROP naming motionActivity.<key> for a nested unknown key', () => {
      const err = catchError({
        motionActivity: { usageDescripton: 'x' },
      });
      expect(err).toBeInstanceOf(PluginError);
      expect(err.code).toBe('UNKNOWN_PROP');
      expect(err.message).toContain(
        'Unknown plugin option: `motionActivity.usageDescripton`.'
      );
      expect(err.message).toContain(
        'Supported options: `motionActivity.usageDescription`.'
      );
      expect(err.detail).toEqual({
        unknownKeys: ['motionActivity.usageDescripton'],
      });
    });

    it('lists every nested unknown key when there are several', () => {
      const err = catchError({
        motionActivity: { foo: 1, usageDescription: 'ok', bar: 2 },
      });
      expect(err.code).toBe('UNKNOWN_PROP');
      expect(err.message).toContain(
        'Unknown plugin options: `motionActivity.foo`, `motionActivity.bar`.'
      );
      expect(err.detail).toEqual({
        unknownKeys: ['motionActivity.foo', 'motionActivity.bar'],
      });
    });

    it('rejects a nested unknown key even when its value is undefined', () => {
      expect(catchError({ motionActivity: { extra: undefined } }).code).toBe(
        'UNKNOWN_PROP'
      );
    });

    it('reports an unknown top-level option before validating motionActivity', () => {
      const err = catchError({ foo: 1, motionActivity: true });
      expect(err.code).toBe('UNKNOWN_PROP');
      expect(err.detail).toEqual({ unknownKeys: ['foo'] });
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
