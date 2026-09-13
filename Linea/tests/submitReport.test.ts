import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getVersion: () => '0.2.0', isPackaged: false }
}))

const { feedbackEndpoint, DEFAULT_FEEDBACK_URL } = await import('../src/main/submitReport')

describe('feedbackEndpoint', () => {
  afterEach(() => {
    delete process.env.LINEA_FEEDBACK_URL
  })

  it('stays quiet in unpackaged builds so e2e and local runs do not hit production', () => {
    expect(feedbackEndpoint(false, {})).toBeNull()
    expect(feedbackEndpoint(true, {})).toBe(DEFAULT_FEEDBACK_URL)
  })

  it('honors LINEA_FEEDBACK_URL even when unpackaged', () => {
    expect(
      feedbackEndpoint(false, { LINEA_FEEDBACK_URL: ' http://127.0.0.1:3000/api/feedback ' })
    ).toBe('http://127.0.0.1:3000/api/feedback')
  })
})
