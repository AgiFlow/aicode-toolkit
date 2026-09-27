/**
 * Narrows an MCP content block (tool result or prompt message) to its text payload.
 * Throws when the block is not text content so assertions fail with a clear message.
 */
export function getText<T extends { type: string }>(block: T | undefined): string {
  if (block?.type !== 'text' || !('text' in block) || typeof block.text !== 'string') {
    throw new Error(`Expected text content, received ${block?.type ?? 'undefined'}`);
  }
  return block.text;
}
