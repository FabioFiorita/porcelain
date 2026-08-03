import { describe, expect, it } from 'vitest'

import { scrubRemoteAssets } from './scrub-remote-assets'

describe('scrubRemoteAssets', () => {
  it('keeps inlined data assets and blocks remote and relative assets', () => {
    const result = scrubRemoteAssets(
      '<img src="data:image/png;base64,AA"><img src="https://example.com/a.png"><style>body{background:url(./bg.png)}</style>',
    )
    expect(result.blocked).toBe(2)
    expect(result.html).toContain('data:image/png;base64,AA')
    expect(result.html).not.toContain('https://example.com/a.png')
    expect(result.html).not.toContain('url(./bg.png)')
  })

  it('blocks a srcset as one asset and leaves script text untouched', () => {
    const result = scrubRemoteAssets(
      '<img srcset="https://example.com/a.png 1x, https://example.com/b.png 2x"><script>document.body.innerHTML="PWNED"</script>',
    )
    expect(result.blocked).toBe(1)
    expect(result.html).toContain('document.body.innerHTML="PWNED"')
    expect(result.html).not.toContain('https://example.com/a.png')
  })
})
