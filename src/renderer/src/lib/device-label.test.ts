import { describe, expect, it } from 'vitest'
import { describeDevice } from './device-label'

describe('describeDevice', () => {
  it('names an iPhone Safari — the roster row a human most needs to recognize', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iPhone')
  })

  it('names an iPad Safari', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iPad')
  })

  it('calls the Electron shell Porcelain even though its UA also claims Chrome and Safari', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) porcelain/0.40.0 Chrome/142.0.0.0 Electron/42.0.0 Safari/537.36',
      ),
    ).toBe('Porcelain on macOS')
  })

  it('names Chrome on Linux — Safari/537.36 in the same UA must not win', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on Linux')
  })

  it('names Firefox on Windows', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      ),
    ).toBe('Firefox on Windows')
  })

  it('falls back to the os alone when the app is unfamiliar', () => {
    expect(describeDevice('curl/8.6.0 (Windows)')).toBe('Windows')
  })

  it('falls back to the app name alone when the os is unfamiliar', () => {
    expect(describeDevice('Mozilla/5.0 (Unknown) Firefox/128.0')).toBe('Firefox')
  })

  it('falls back to Porcelain when nothing is recognized', () => {
    expect(describeDevice('some-scraper/1.0')).toBe('Porcelain')
    expect(describeDevice('')).toBe('Porcelain')
  })
})
