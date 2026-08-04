import { Text } from 'react-native'

import { cn } from '@/lib/utils'

type PocGlyphProps = {
  size?: number
  symbol: string
  tone?: 'foreground' | 'muted' | 'primary'
}

export function PocGlyph({ size = 16, symbol, tone = 'foreground' }: PocGlyphProps) {
  return (
    <Text
      accessibilityElementsHidden
      accessible={false}
      className={cn(
        'font-semibold',
        tone === 'foreground' && 'text-foreground',
        tone === 'muted' && 'text-muted-foreground',
        tone === 'primary' && 'text-primary',
      )}
      style={{
        fontSize: size,
        lineHeight: size + 3,
      }}
    >
      {symbol}
    </Text>
  )
}
