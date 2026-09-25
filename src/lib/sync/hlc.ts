// Hybrid logical clock: wall-clock milliseconds plus a counter, so stamps
// stay ordered even when two edits land in the same millisecond or a remote
// clock runs slightly ahead. Encoded fixed-width so plain string comparison
// orders them; the client id suffix makes every stamp unique.

const MS_WIDTH = 9;
const COUNTER_WIDTH = 4;

export class HybridClock {
  private ms = 0;
  private counter = 0;
  private readonly clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  now(): string {
    const wall = Date.now();
    if (wall > this.ms) {
      this.ms = wall;
      this.counter = 0;
    } else {
      this.counter++;
    }
    return encode(this.ms, this.counter, this.clientId);
  }

  observe(stamp: string) {
    const parsed = decode(stamp);
    if (!parsed) return;
    if (parsed.ms > this.ms || (parsed.ms === this.ms && parsed.counter > this.counter)) {
      this.ms = parsed.ms;
      this.counter = parsed.counter;
    }
  }
}

function encode(ms: number, counter: number, clientId: string): string {
  return `${ms.toString(36).padStart(MS_WIDTH, '0')}.${counter.toString(36).padStart(COUNTER_WIDTH, '0')}.${clientId}`;
}

function decode(stamp: string): { ms: number; counter: number } | null {
  const [msPart, counterPart] = stamp.split('.');
  const ms = parseInt(msPart, 36);
  const counter = parseInt(counterPart, 36);
  if (Number.isNaN(ms) || Number.isNaN(counter)) return null;
  return { ms, counter };
}

export function stampToDate(stamp: string): Date {
  return new Date(decode(stamp)?.ms ?? 0);
}
