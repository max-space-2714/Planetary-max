// This lookup receives only the explicit query, never assistant history or feed data.
export async function webLookup(prompt: string, apiKey: string) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', prompt);
  url.searchParams.set('count', '5');
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Web search failed');
  const data = await response.json() as { web?: { results?: unknown[] } };
  if (!Array.isArray(data.web?.results)) throw new Error('Invalid web search response');
  const results = data.web.results.slice(0, 5).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (typeof item.title !== 'string' || typeof item.url !== 'string') return [];
    try {
      const link = new URL(item.url);
      if (link.protocol !== 'https:' || link.username || link.password) return [];
      return [{ title: item.title.slice(0, 300), url: link.href, description: typeof item.description === 'string' ? item.description.replace(/<[^>]*>/g, '').slice(0, 1000) : '' }];
    } catch { return []; }
  });
  return {
    summary: results.map(item => `${item.title}\n${item.description}`).join('\n\n') || 'No web results found.',
    sources: results.map(item => item.url),
    max_compute: '0.000000',
  };
}
