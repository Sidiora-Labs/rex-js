export interface FeedbackEntry {
  readonly actor: string;
  readonly message: string;
}

const received: FeedbackEntry[] = [];

export function recordFeedback(actor: string, message: string): string {
  received.push({ actor, message });
  return `Feedback ${received.length} received`;
}
