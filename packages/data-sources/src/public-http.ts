export interface RetrievedPage { html: string; sourceUrl: string; lastSyncedAt: string }
export type PageReader = (url: string) => Promise<RetrievedPage>;
interface Policy { origin: string; paths: RegExp; label: string; invalidMessage: string; spacingMs?: number; allowSearch?: (params: URLSearchParams) => boolean }
export function createPublicHtmlClient(policy: Policy, fetcher: typeof fetch = fetch): PageReader {
  const cache = new Map<string, { page: RetrievedPage; expires: number }>();
  let queue: Promise<unknown> = Promise.resolve();
  let lastRequest = 0;
  return url => {
    const task = queue.then(async () => {
      const target = new URL(url);
      if (target.origin !== policy.origin || target.username || target.password || (target.search && !policy.allowSearch?.(target.searchParams)) || target.hash || !policy.paths.test(target.pathname)) throw new Error(policy.invalidMessage);
      const cached = cache.get(url);
      if (cached && cached.expires > Date.now()) return cached.page;
      await new Promise(resolve => setTimeout(resolve, Math.max(0, (policy.spacingMs ?? 1100) - (Date.now() - lastRequest))));
      lastRequest = Date.now();
      const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(25_000), headers: { Accept: 'text/html' } });
      if (!response.ok) throw new Error(`${policy.label} HTTP ${response.status}; stopped without retry (Retry-After: ${response.headers.get('retry-after') ?? 'absent'})`);
      if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Expected HTML');
      const html = await response.text();
      if (Buffer.byteLength(html) > 8_000_000) throw new Error('Public page exceeds experimental size limit');
      const page = { html, sourceUrl: url, lastSyncedAt: new Date().toISOString() };
      cache.set(url, { page, expires: Date.now() + 3_600_000 });
      return page;
    });
    queue = task.catch(() => undefined);
    return task;
  };
}
