import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCatalogs, type CatalogKey } from '../src/catalogs';
import { buildIssueUrl, composeFeedback, openIssueComposer, validateFeedbackMessage } from '../src/feedback';
import { createLocalizer } from '../src/localization';

const paths: Record<CatalogKey, string> = {
  documents: 'public/data/documents.json',
  locations: 'public/data/locations.json',
  battlePass: 'public/data/battle-pass.json',
  optimizerRules: 'public/data/optimizer-rules.json',
  localization: 'public/data/localization.json',
};

function localizer() {
  return createLocalizer(parseCatalogs(Object.fromEntries(
    Object.entries(paths).map(([key, filePath]) => [key, JSON.parse(readFileSync(resolve(filePath), 'utf8'))]),
  ) as Record<CatalogKey, unknown>).localization);
}

describe('feedback composer', () => {
  it('previews exact title/body content and keeps context opt-in', () => {
    const report = composeFeedback(localizer(), 'The safest route looks wrong.', false);
    expect(report.title).toBe('KORD BREACH Optimizer feedback');
    expect(report.body).not.toContain('Game data:');
    expect(composeFeedback(localizer(), 'Looks good.', true, {
      gameDataVersion: '1.1.0.0.46657.8.6.2026',
      mode: 'pve',
      effectiveDailyLimit: 10,
    }).body).toContain('Game data: 1.1.0.0.46657.8.6.2026');
  });

  it('encodes configured GitHub URLs, rejects unsafe targets, and never submits automatically', () => {
    const report = composeFeedback(localizer(), 'A & B', false);
    const url = buildIssueUrl(report, { owner: 'owner', repository: 'repo' });
    expect(url).toContain('https://github.com/owner/repo/issues/new?');
    expect(url).toContain('A+%26+B');
    expect(buildIssueUrl(report, {})).toBeUndefined();
    expect(buildIssueUrl(report, { owner: 'owner/name', repository: 'repo' })).toBeUndefined();
    expect(() => buildIssueUrl(report, { owner: 'owner', repository: 'repo', maxUrlLength: 10 })).toThrow(/length/);
    let opened = false;
    expect(openIssueComposer(url!, (_url, target, features) => {
      opened = target === '_blank' && features === 'noopener,noreferrer';
      return null;
    })).toBe(false);
    expect(opened).toBe(true);
  });

  it('validates non-empty bounded messages', () => {
    expect(validateFeedbackMessage('hello')).toBe(true);
    expect(validateFeedbackMessage('  ')).toBe(false);
    expect(validateFeedbackMessage('12345', 4)).toBe(false);
  });
});
