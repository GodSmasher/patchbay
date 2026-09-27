export interface SearchHit {
  title: string
  url: string
  content: string
  score: number
}

export interface ExtractedPage {
  url: string
  content: string
}

export interface SearchClient {
  search(query: string, options?: { maxResults?: number }): Promise<SearchHit[]>
  extract(urls: string[]): Promise<ExtractedPage[]>
}

/** Tavily: web search for API docs plus clean-text extraction of the chosen pages. */
export function createTavilyClient(opts: { apiKey: string; fetch?: typeof fetch }): SearchClient {
  const doFetch = opts.fetch ?? fetch

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await doFetch(`https://api.tavily.com${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Tavily ${path}: HTTP ${res.status} ${await res.text().catch(() => '')}`)
    return (await res.json()) as T
  }

  return {
    async search(query, options = {}) {
      const data = await post<{ results?: SearchHit[] }>('/search', {
        query,
        search_depth: 'advanced',
        max_results: options.maxResults ?? 5,
        include_answer: false,
      })
      return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, content: r.content, score: r.score }))
    },
    async extract(urls) {
      if (urls.length === 0) return []
      const data = await post<{ results?: { url: string; raw_content?: string }[] }>('/extract', {
        urls,
        extract_depth: 'advanced',
      })
      return (data.results ?? []).map((r) => ({ url: r.url, content: r.raw_content ?? '' }))
    },
  }
}
