import { resolveRationale } from '../../utils/resolveRationale';

describe('resolveRationale', () => {
  // The English defaults are intentionally inlined here (rather than imported)
  // because DEFAULT_BACKGROUND_LOCATION_RATIONALE is `@internal`. Locking the
  // wording into the tests means any future copy change must also update the
  // tests, which is the desired contract.
  const DEFAULT_TITLE = 'Background Location Permission';
  const DEFAULT_MESSAGE =
    'This app needs access to your location in the background to track your trips.';
  const DEFAULT_BUTTON_POSITIVE = 'OK';
  const DEFAULT_BUTTON_NEGATIVE = 'Cancel';
  const DEFAULT_BUTTON_NEUTRAL = 'Ask Me Later';

  it('MR-1: returns all defaults when override is undefined', () => {
    const result = resolveRationale(undefined);

    expect(result).toEqual({
      title: DEFAULT_TITLE,
      message: DEFAULT_MESSAGE,
      buttonPositive: DEFAULT_BUTTON_POSITIVE,
      buttonNegative: DEFAULT_BUTTON_NEGATIVE,
      buttonNeutral: DEFAULT_BUTTON_NEUTRAL,
    });
  });

  it('MR-2: returns all defaults when override is an empty object', () => {
    const result = resolveRationale({});

    expect(result).toEqual({
      title: DEFAULT_TITLE,
      message: DEFAULT_MESSAGE,
      buttonPositive: DEFAULT_BUTTON_POSITIVE,
      buttonNegative: DEFAULT_BUTTON_NEGATIVE,
      buttonNeutral: DEFAULT_BUTTON_NEUTRAL,
    });
  });

  it('MR-3: returns the override values when every field is populated', () => {
    const result = resolveRationale({
      title: 'Permissão de localização',
      message: 'Precisamos da sua localização em segundo plano.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Cancelar',
      buttonNeutral: 'Mais tarde',
    });

    expect(result).toEqual({
      title: 'Permissão de localização',
      message: 'Precisamos da sua localização em segundo plano.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Cancelar',
      buttonNeutral: 'Mais tarde',
    });
  });

  it('MR-4: applies a partial override on title only and falls back for the rest', () => {
    const result = resolveRationale({ title: 'Permissão' });

    expect(result).toEqual({
      title: 'Permissão',
      message: DEFAULT_MESSAGE,
      buttonPositive: DEFAULT_BUTTON_POSITIVE,
      buttonNegative: DEFAULT_BUTTON_NEGATIVE,
      buttonNeutral: DEFAULT_BUTTON_NEUTRAL,
    });
  });

  it('MR-5: applies a partial override on buttonPositive only and falls back for the rest', () => {
    const result = resolveRationale({ buttonPositive: 'Permitir' });

    expect(result).toEqual({
      title: DEFAULT_TITLE,
      message: DEFAULT_MESSAGE,
      buttonPositive: 'Permitir',
      buttonNegative: DEFAULT_BUTTON_NEGATIVE,
      buttonNeutral: DEFAULT_BUTTON_NEUTRAL,
    });
  });

  it('MR-6: empty-string fields fall back to defaults', () => {
    const result = resolveRationale({ title: '', message: '' });

    expect(result.title).toBe(DEFAULT_TITLE);
    expect(result.message).toBe(DEFAULT_MESSAGE);
    expect(result.buttonPositive).toBe(DEFAULT_BUTTON_POSITIVE);
    expect(result.buttonNegative).toBe(DEFAULT_BUTTON_NEGATIVE);
    expect(result.buttonNeutral).toBe(DEFAULT_BUTTON_NEUTRAL);
  });

  it('MR-7: whitespace-only fields fall back to defaults', () => {
    const result = resolveRationale({
      title: '   ',
      buttonNeutral: '\t\n',
    });

    expect(result.title).toBe(DEFAULT_TITLE);
    expect(result.buttonNeutral).toBe(DEFAULT_BUTTON_NEUTRAL);
    expect(result.message).toBe(DEFAULT_MESSAGE);
    expect(result.buttonPositive).toBe(DEFAULT_BUTTON_POSITIVE);
    expect(result.buttonNegative).toBe(DEFAULT_BUTTON_NEGATIVE);
  });

  it('MR-8: mixes truthy, empty, and whitespace fields correctly', () => {
    const result = resolveRationale({
      title: 'X',
      message: '',
      buttonPositive: '   ',
      buttonNegative: 'No',
    });

    expect(result.title).toBe('X');
    expect(result.message).toBe(DEFAULT_MESSAGE);
    expect(result.buttonPositive).toBe(DEFAULT_BUTTON_POSITIVE);
    expect(result.buttonNegative).toBe('No');
    expect(result.buttonNeutral).toBe(DEFAULT_BUTTON_NEUTRAL);
  });

  it('MR-9: trims surrounding whitespace from truthy values', () => {
    const result = resolveRationale({ title: '  Permissão  ' });

    expect(result.title).toBe('Permissão');
    expect(result.message).toBe(DEFAULT_MESSAGE);
    expect(result.buttonPositive).toBe(DEFAULT_BUTTON_POSITIVE);
    expect(result.buttonNegative).toBe(DEFAULT_BUTTON_NEGATIVE);
    expect(result.buttonNeutral).toBe(DEFAULT_BUTTON_NEUTRAL);
  });
});
