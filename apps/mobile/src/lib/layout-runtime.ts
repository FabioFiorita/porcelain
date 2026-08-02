import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'

import { deriveLayout, type Layout } from './layout'

export function useLayout(): Layout {
  const { height, width } = useWindowDimensions()
  return useMemo(() => deriveLayout({ height, width }), [height, width])
}
