import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

describe('TooltipContent', () => {
  it('follows the theme instead of inverting to a light pill', () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger render={<button type="button">Tip</button>} />
          <TooltipContent>Toggle surfaces sidebar</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
    const content = screen.getByText('Toggle surfaces sidebar')
    expect(content.className).toContain('bg-popover')
    expect(content.className).toContain('text-popover-foreground')
    expect(content.className).not.toContain('bg-foreground')
    expect(content.className).not.toContain('text-background')
  })
})
