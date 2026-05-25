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
});
