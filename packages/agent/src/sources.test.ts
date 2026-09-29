import { describe, expect, it } from 'vitest'
import { isOfficial, rankOfficial } from './sources'

const hit = (url: string, score: number) => ({ title: url, url, content: '', score })

describe('rankOfficial', () => {
  it('puts the vendor reference above higher-scored blogs and aggregators', () => {
    const ranked = rankOfficial([
      hit('https://endgrate.com/blog/pipedrive-api-deals', 0.95),
      hit('https://medium.com/@x/pipedrive-webhooks', 0.9),
      hit('https://developers.pipedrive.com/docs/api/v1/Deals', 0.7),
      hit('https://www.pipedrive.com/en/blog/sales', 0.6),
    ], 'Pipedrive')
    expect(ranked.map((h) => new URL(h.url).hostname)).toEqual(['developers.pipedrive.com', 'www.pipedrive.com', 'endgrate.com', 'medium.com'])
  })

  it('recognises official hosts by app name', () => {
    expect(isOfficial('https://api.slack.com/methods/chat.postMessage', 'Slack')).toBe(true)
    expect(isOfficial('https://developer.calendly.com/api-docs', 'Calendly')).toBe(true)
    expect(isOfficial('https://cotera.co/docs/typeform', 'Typeform')).toBe(false)
  })
})
