import { readFileSync } from 'node:fs';
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

describe('GitHub Pages deployment gate', () => {
  it('validates release content before uploading the Pages artifact', () => {
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
    const releaseGate = workflow.indexOf('run: npm run validate:release');
    const pagesUpload = workflow.indexOf('actions/upload-pages-artifact');

    expect(releaseGate).toBeGreaterThan(workflow.indexOf('run: npm run check'));
    expect(releaseGate).toBeLessThan(pagesUpload);
    expect(workflow.slice(workflow.lastIndexOf('- name:', releaseGate), releaseGate)).toContain("if: github.event_name != 'pull_request'");
  });
});
