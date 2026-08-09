import { describe, expect, it } from 'vitest';

import { CLOUDFLARE_WEB_ANALYTICS_SOURCE, cloudflareWebAnalyticsTag } from '../vite.config';

describe('Cloudflare Web Analytics build configuration', () => {
  it('creates the official production beacon from a configured token', () => {
    expect(cloudflareWebAnalyticsTag(' test-token ')).toEqual({
      tag: 'script',
      attrs: {
        type: 'module',
        src: CLOUDFLARE_WEB_ANALYTICS_SOURCE,
        'data-cf-beacon': '{"token":"test-token"}',
      },
      injectTo: 'body',
    });
  });

  it('omits the beacon when the token is missing or blank', () => {
    expect(cloudflareWebAnalyticsTag(undefined)).toBeUndefined();
    expect(cloudflareWebAnalyticsTag('   ')).toBeUndefined();
  });
});
