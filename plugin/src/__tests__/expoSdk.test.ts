import { getExpoSdkMajor } from '../utils/expoSdk';

describe('getExpoSdkMajor', () => {
  it.each([
    ['54.0.0', 54],
    ['58.0.0', 58],
  ])('reads %p', (input, expected) => {
    expect(getExpoSdkMajor(input)).toBe(expected);
  });

  it.each([undefined, null, 54, 'UNVERSIONED', '', 'abc'])(
    'returns undefined for %p',
    (input) => {
      expect(getExpoSdkMajor(input)).toBeUndefined();
    }
  );
});
