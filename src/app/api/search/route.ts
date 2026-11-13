import { NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { searchFromApi, searchFromSite } from '@/lib/downstream';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'edge';

async function searchSiteWithTimeout(site: any, query: string): Promise<{ items: any[]; latencyMs: number }> {
  const start = Date.now();
  const searchFn = typeof searchFromSite === 'function' ? searchFromSite : searchFromApi;
  const timeoutPromise = new Promise<{ items: any[]; latencyMs: number }>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 4500)
  );
  try {
    const items = await Promise.race([searchFn(site, query), timeoutPromise]);
    return { items: items || [], latencyMs: Date.now() - start };
  } catch {
    return { items: [], latencyMs: Infinity };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
  }

  const config = await getConfig();
  const apiSites = config.SourceConfig.filter((site) => !site.disabled);

  try {
    const settledResults = await Promise.allSettled(
      apiSites.map((site) => searchSiteWithTimeout(site, query))
    );

    const successfulResults = settledResults
      .filter((res): res is PromiseFulfilledResult<{ items: any[]; latencyMs: number }> => res.status === 'fulfilled' && res.value.items.length > 0)
      .map((res) => res.value)
      .sort((a, b) => a.latencyMs - b.latencyMs);

    let flattenedResults = successfulResults.flatMap((res) => res.items);

    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }

    const cacheTime = await getCacheTime();

    return NextResponse.json(
      { results: flattenedResults },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }

import { yellowWords } from '@/lib/yellow';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    const cacheTime = await getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
  }

  const config = await getConfig();
  const apiSites = config.SourceConfig.filter((site) => !site.disabled);
  const searchPromises = apiSites.map((site) => searchFromApi(site, query));

  try {
    const results = await Promise.all(searchPromises);
    let flattenedResults = results.flat();
    if (!config.SiteConfig.DisableYellowFilter) {
      flattenedResults = flattenedResults.filter((result) => {
        const typeName = result.type_name || '';
        return !yellowWords.some((word: string) => typeName.includes(word));
      });
    }
    const cacheTime = await getCacheTime();

    return NextResponse.json(
      { results: flattenedResults },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
