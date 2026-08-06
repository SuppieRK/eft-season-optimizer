import type { Localizer } from './localization';

export const FEEDBACK_MAX_MESSAGE_LENGTH = 2000;
export const FEEDBACK_MAX_URL_LENGTH = 7000;

export interface FeedbackContext {
  readonly gameDataVersion: string;
  readonly mode: string;
  readonly effectiveDailyLimit: number;
}

export interface FeedbackConfig {
  readonly owner?: string;
  readonly repository?: string;
  readonly maxMessageLength?: number;
  readonly maxUrlLength?: number;
}

export interface FeedbackReport {
  readonly title: string;
  readonly body: string;
}

export function composeFeedback(localizer: Localizer, message: string, includeContext: boolean, context?: FeedbackContext): FeedbackReport {
  const title = localizer.text('feedback.title');
  const bodyParts = [localizer.text('feedback.body', { message: message.trim() })];
  if (includeContext && context) {
    bodyParts.push(localizer.text('feedback.context', {
      version: context.gameDataVersion,
      mode: context.mode,
      limit: context.effectiveDailyLimit,
    }));
  }
  return { title, body: bodyParts.join('\n\n') };
}

export function buildIssueUrl(report: FeedbackReport, config: FeedbackConfig): string | undefined {
  if (!config.owner || !config.repository || !validPart(config.owner) || !validPart(config.repository)) return undefined;
  const url = `https://github.com/${config.owner}/${config.repository}/issues/new?${new URLSearchParams({ title: report.title, body: report.body }).toString()}`;
  if (url.length > (config.maxUrlLength ?? FEEDBACK_MAX_URL_LENGTH)) throw new RangeError('Feedback issue URL exceeds the safe length limit');
  return url;
}

export function validateFeedbackMessage(message: string, maxLength = FEEDBACK_MAX_MESSAGE_LENGTH): boolean {
  return message.trim().length > 0 && message.length <= maxLength;
}

export function openIssueComposer(url: string, openWindow: (url: string, target: string, features: string) => Window | null = window.open.bind(window)): boolean {
  return openWindow(url, '_blank', 'noopener,noreferrer') !== null;
}

function validPart(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value);
}
