/* eslint-disable import/no-extraneous-dependencies */
import tinycolor from 'tinycolor2';

const DARK_THEME_HEADER_COLOR_MIX = 38;

export function getReadableHeaderTextColor(backgroundColor: string) {
  return tinycolor
    .mostReadable(backgroundColor, ['#000000', '#FFFFFF'], {
      includeFallbackColors: true,
      level: 'AA',
      size: 'small',
    })
    .toHexString();
}

export function getAdaptiveHeaderBackgroundColor({
  backgroundColor,
  isDarkTheme,
  themeBackgroundColor,
}: {
  backgroundColor: string;
  isDarkTheme: boolean;
  themeBackgroundColor: string;
}) {
  if (!isDarkTheme) {
    return tinycolor(backgroundColor).toRgbString();
  }

  return tinycolor
    .mix(themeBackgroundColor, backgroundColor, DARK_THEME_HEADER_COLOR_MIX)
    .toRgbString();
}

export function getAdaptiveHeaderStyle({
  backgroundColor,
  isDarkTheme,
  themeBackgroundColor,
}: {
  backgroundColor: string;
  isDarkTheme: boolean;
  themeBackgroundColor: string;
}) {
  const adaptiveBackgroundColor = getAdaptiveHeaderBackgroundColor({
    backgroundColor,
    isDarkTheme,
    themeBackgroundColor,
  });

  return {
    backgroundColor: adaptiveBackgroundColor,
    color: getReadableHeaderTextColor(adaptiveBackgroundColor),
  };
}
