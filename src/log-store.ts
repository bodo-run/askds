type Listener = () => void;

class LogStore {
  private outputLog: string = "";
  private reasoningLog: string = "";
  private listeners: Listener[] = [];
  private debounceTimeout: NodeJS.Timeout | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private scheduleNotify() {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this.notify();
      this.debounceTimeout = null;
    }, 16); // Batch updates every 16ms
  }

  appendOutput(text: string) {
    this.outputLog += text;
    this.scheduleNotify();
  }

  appendReasoning(text: string) {
    this.reasoningLog += text;
    this.scheduleNotify();
  }

  getOutput(): string {
    return this.outputLog;
  }

  getReasoning(): string {
    return this.reasoningLog;
  }

  getOutputBuffer(): string {
    return this.outputLog;
  }

  getReasoningBuffer(): string {
    return this.reasoningLog;
  }

  clearOutput() {
    this.outputLog = "";
    this.notify();
  }

  clearReasoning() {
    this.reasoningLog = "";
    this.notify();
  }

  clear() {
    this.outputLog = "";
    this.reasoningLog = "";
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    this.notify();
  }
}

export const logStore = new LogStore();
