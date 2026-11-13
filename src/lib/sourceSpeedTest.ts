import { SearchResult } from '@/lib/types';

export async function probeM3u8Latency(
  url: string,
  timeoutMs = 3000
): Promise<number> {
  if (!url) return Infinity;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-1023',
      },
      signal: controller.signal,
    });

    if (!response.ok && response.status !== 206) {
      return Infinity;
    }

    return performance.now() - start;
  } catch {
    return Infinity;
  } finally {
    clearTimeout(timer);
  }
}

export async function rankSourcesByLatency(
  sources: SearchResult[],
  timeoutMs = 3000
): Promise<(SearchResult & { latency: number })[]> {
  const results = await Promise.all(
    sources.map(async (source) => {
      const url =
        (source as any).url ||
        (source.episodes && source.episodes.length > 0 ? source.episodes[0] : '');
      const latency = url ? await probeM3u8Latency(url, timeoutMs) : Infinity;
      return {
        ...source,
        latency,
      };
    })
  );

  return results.sort((a, b) => a.latency - b.latency);
}
