import {
  getAdaptiveHeaderBackgroundColor,
  getAdaptiveHeaderStyle,
  getReadableHeaderTextColor,
} from './headerColors';

describe('headerColors', () => {
  it('keeps the original color in light theme', () => {
    expect(
      getAdaptiveHeaderBackgroundColor({
        backgroundColor: '#ffcc00',
        isDarkTheme: false,
        themeBackgroundColor: '#141414',
      }),
    ).toBe('rgb(255, 204, 0)');
  });

  it('tones down the selected color in dark theme', () => {
    expect(
      getAdaptiveHeaderBackgroundColor({
        backgroundColor: '#ffcc00',
        isDarkTheme: true,
        themeBackgroundColor: '#141414',
      }),
    ).toBe('rgb(109, 90, 12)');
  });

  it('picks a readable text color for bright backgrounds', () => {
    expect(getReadableHeaderTextColor('rgb(255, 204, 0)')).toBe('#000000');
  });

  it('returns both background and text colors for header styling', () => {
    expect(
      getAdaptiveHeaderStyle({
        backgroundColor: '#ffcc00',
        isDarkTheme: true,
        themeBackgroundColor: '#141414',
      }),
    ).toEqual({
      backgroundColor: 'rgb(109, 90, 12)',
      color: '#ffffff',
    });
  });
});
