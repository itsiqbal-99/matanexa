import type {
  ConversationContext,
  ConversationMessage,
} from '@matanexa/contracts';
import { ConversationOrchestrationError } from './conversation.error';

export interface SelectedConversationContext {
  messages: ConversationMessage[];
  omittedMessageCount: number;
}

export function selectConversationContext(
  context: ConversationContext,
  maximumCharacters: number,
): SelectedConversationContext {
  const latest = context.messages.at(-1);
  if (!latest || latest.role !== 'user')
    throw new ConversationOrchestrationError('INVALID_CONTEXT');
  if (latest.content.length > maximumCharacters)
    throw new ConversationOrchestrationError('CONTEXT_TOO_LARGE');

  let used = 0;
  const selected: ConversationMessage[] = [];
  for (let index = context.messages.length - 1; index >= 0; index--) {
    const message = context.messages[index];
    const cost = message.content.length + 32;
    if (selected.length > 0 && used + cost > maximumCharacters) break;
    selected.push(message);
    used += cost;
  }
  selected.reverse();
  return {
    messages: selected,
    omittedMessageCount: context.messages.length - selected.length,
  };
}
