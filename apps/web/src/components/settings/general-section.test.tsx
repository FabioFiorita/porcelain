import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GeneralSection } from './general-section'

describe('GeneralSection', () => {
  it('hosts appearance and viewer prefs, not companion skills', () => {
    render(<GeneralSection />)
    expect(screen.getByText('Appearance')).toBeTruthy()
    expect(screen.queryByText('Companion')).toBeNull()
    expect(screen.queryByText(/npx skills/)).toBeNull()
  })
})
