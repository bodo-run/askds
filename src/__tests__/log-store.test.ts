import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logStore } from '../log-store.js';

describe('LogStore', () => {
  beforeEach(() => {
    logStore.clear();
  });

  it('should notify subscribers when logs are updated', async () => {
    const listener = vi.fn();
    const unsubscribe = logStore.subscribe(listener);
    logStore.appendOutput('test');
    await new Promise((r) => setTimeout(r, 20));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('should debounce multiple notifications', async () => {
    const listener = vi.fn();
    logStore.subscribe(listener);
    logStore.appendOutput('test1');
    logStore.appendOutput('test2');
    logStore.appendReasoning('reason1');
    await new Promise((r) => setTimeout(r, 5));
    expect(listener).toHaveBeenCalledTimes(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should maintain separate buffers for output and reasoning', () => {
    logStore.appendOutput('output');
    logStore.appendReasoning('reasoning');
    expect(logStore.getOutput()).toBe('output');
    expect(logStore.getReasoning()).toBe('reasoning');
    expect(logStore.getOutputBuffer()).toBe('output');
    expect(logStore.getReasoningBuffer()).toBe('reasoning');
  });

  it('should clear logs properly', () => {
    logStore.appendOutput('test');
    logStore.appendReasoning('test');
    logStore.clear();
    expect(logStore.getOutput()).toBe('');
    expect(logStore.getReasoning()).toBe('');
  });

  it('should handle multiple subscribers', async () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    logStore.subscribe(listener1);
    logStore.subscribe(listener2);
    logStore.appendOutput('test');
    await new Promise((r) => setTimeout(r, 20));
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe properly', async () => {
    const listener = vi.fn();
    const unsubscribe = logStore.subscribe(listener);
    unsubscribe();
    logStore.appendOutput('test');
    await new Promise((r) => setTimeout(r, 20));
    expect(listener).not.toHaveBeenCalled();
  });
});
