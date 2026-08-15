import type { ReadCanvasOutput } from '@porcelain/contracts/projects'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasView } from './canvas-view'
import { useCanvas, useMintCanvasAccessToken } from './project-data'

vi.mock('./project-data', () => ({
  useCanvas: vi.fn(),
  useMintCanvasAccessToken: vi.fn(),
}))

const HTML_RECORD: ReadCanvasOutput['record'] = {
  id: 'canvas-1',
  worktreeId: 'wt-1',
  title: 'Intent',
  kind: 'html',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T09:00:00.000Z',
  tracked: false,
}

const MARKDOWN_RECORD: ReadCanvasOutput['record'] = { ...HTML_RECORD, kind: 'markdown' }

describe('CanvasView', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    openSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('shows a loading state before the Canvas resolves', () => {
    vi.mocked(useCanvas).mockReturnValue({ canvas: undefined, isLoading: true })
    vi.mocked(useMintCanvasAccessToken).mockReturnValue({ mint: vi.fn() })
    render(<CanvasView projectId="proj-1" canvasId="canvas-1" />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders Markdown content through the Markdown view, no iframe', () => {
    vi.mocked(useCanvas).mockReturnValue({
      canvas: { record: MARKDOWN_RECORD, content: '# Hello Canvas' },
      isLoading: false,
    })
    vi.mocked(useMintCanvasAccessToken).mockReturnValue({ mint: vi.fn() })
    render(<CanvasView projectId="proj-1" canvasId="canvas-1" />)
    expect(screen.getByRole('heading', { name: 'Hello Canvas' })).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('mints a token and renders the HTML iframe sandboxed with scripts but no same-origin', async () => {
    const mint = vi.fn().mockResolvedValue('tok-123')
    vi.mocked(useCanvas).mockReturnValue({
      canvas: { record: HTML_RECORD, content: '<p>hi</p>' },
      isLoading: false,
    })
    vi.mocked(useMintCanvasAccessToken).mockReturnValue({ mint })
    render(<CanvasView projectId="proj-1" canvasId="canvas-1" />)

    await waitFor(() =>
      expect(mint).toHaveBeenCalledWith({ projectId: 'proj-1', canvasId: 'canvas-1' }),
    )

    const iframe = await screen.findByTitle('Intent')
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    // The dangerous state to catch is a silent future addition of allow-same-origin,
    // which would hand Canvas JS the app's real origin (localStorage, daemon token).
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin')
    expect(iframe.getAttribute('src')).toContain('/canvas/tok-123')
  })

  it('relays a bridged external-link postMessage from its own iframe through window.open', async () => {
    const mint = vi.fn().mockResolvedValue('tok-123')
    vi.mocked(useCanvas).mockReturnValue({
      canvas: { record: HTML_RECORD, content: '<p>hi</p>' },
      isLoading: false,
    })
    vi.mocked(useMintCanvasAccessToken).mockReturnValue({ mint })
    render(<CanvasView projectId="proj-1" canvasId="canvas-1" />)

    const iframe = (await screen.findByTitle('Intent')) as HTMLIFrameElement

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: 'porcelain-canvas', href: 'https://example.com' },
          source: iframe.contentWindow,
        }),
      )
    })

    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })

  it('ignores a same-shaped message from a different window', async () => {
    const mint = vi.fn().mockResolvedValue('tok-123')
    vi.mocked(useCanvas).mockReturnValue({
      canvas: { record: HTML_RECORD, content: '<p>hi</p>' },
      isLoading: false,
    })
    vi.mocked(useMintCanvasAccessToken).mockReturnValue({ mint })
    render(<CanvasView projectId="proj-1" canvasId="canvas-1" />)
    await screen.findByTitle('Intent')

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { source: 'porcelain-canvas', href: 'https://evil.example' },
          source: null,
        }),
      )
    })

    expect(openSpy).not.toHaveBeenCalled()
  })
})
