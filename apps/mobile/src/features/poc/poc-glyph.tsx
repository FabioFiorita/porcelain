import { Text, useColorScheme } from 'react-native'

type PocGlyphProps = {
  size?: number
  symbol: string
  tone?: 'foreground' | 'muted' | 'primary'
}

const GLYPH_COLORS = {
  dark: {
    foreground: '#F5F7FA',
    muted: '#A7B0BB',
    primary: '#0A84FF',
  },
  light: {
    foreground: '#171A1C',
    muted: '#687076',
    primary: '#0A84FF',
  },
} as const

export function PocGlyph({ size = 16, symbol, tone = 'foreground' }: PocGlyphProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  return (
    <Text
      accessibilityElementsHidden
      accessible={false}
      style={{
        color: GLYPH_COLORS[colorScheme][tone],
        fontSize: size,
        fontWeight: '600',
        lineHeight: size + 3,
      }}
    >
      {symbol}
    </Text>
  )
}
