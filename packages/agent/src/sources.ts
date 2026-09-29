import type { SearchHit } from './tavily'

const THIRD_PARTY = [
  'medium.com',
  'dev.to',
  'stackoverflow.com',
  'reddit.com',
  'youtube.com',
  'github.com',
  'endgrate.com',
  'cotera.co',
  'zapier.com',
  'make.com',
  'n8n.io',
  'pipedream.com',
  'rollout.com',
  'apidog.com',
  'postman.com',
]

const DOC_PATH = /\/(docs?|developers?|reference|api)(\/|$|-)/i

/**
 * Tavily ranks by relevance, not authority, so an integration blog can outrank the vendor's
 * own reference. Official pages are the ones whose host names the app and whose path looks
 * like documentation; aggregators and forums are pushed down.
 */
export function rankOfficial(hits: SearchHit[], app: string): SearchHit[] {
  const slug = app.toLowerCase().replace(/[^a-z0-9]/g, '')
  const score = (hit: SearchHit) => {
    let host = ''
    let path = ''
    try {
      const url = new URL(hit.url)
      host = url.hostname.toLowerCase()
      path = url.pathname
    } catch {
      return hit.score - 1
    }
    const official = slug.length > 2 && host.replace(/[^a-z0-9.]/g, '').replace(/\./g, '').includes(slug)
    const thirdParty = THIRD_PARTY.some((domain) => host === domain || host.endsWith(`.${domain}`))
    return hit.score + (official ? 1 : 0) + (official && DOC_PATH.test(path) ? 0.5 : 0) - (thirdParty ? 1 : 0)
  }
  return [...hits].sort((a, b) => score(b) - score(a))
}

export function isOfficial(url: string, app: string): boolean {
  const slug = app.toLowerCase().replace(/[^a-z0-9]/g, '')
  try {
    return new URL(url).hostname.toLowerCase().replace(/[^a-z0-9]/g, '').includes(slug)
  } catch {
    return false
  }
}
