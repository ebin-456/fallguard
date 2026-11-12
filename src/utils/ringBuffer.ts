// High performance ring buffer for 60fps canvas waveform charts

export class FloatRingBuffer {
  private buffer: Float32Array;
  private head: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  constructor(capacity: number = 300) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  public push(value: number): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  public size(): number {
    return this.count;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer.fill(0);
  }

  /**
   * Copies points in chronological order (oldest to newest) into a destination Float32Array.
   * Avoids GC allocations if the consumer passes an existing buffer.
   */
  public copyTo(out: Float32Array): number {
    const len = Math.min(this.count, out.length);
    if (len === 0) return 0;

    if (this.count < this.capacity) {
      // Buffer hasn't wrapped yet: items are 0 .. count-1
      out.set(this.buffer.subarray(0, len));
    } else {
      // Buffer has wrapped: oldest item is at head
      const firstChunkLen = this.capacity - this.head;
      if (len <= firstChunkLen) {
        out.set(this.buffer.subarray(this.head, this.head + len));
      } else {
        out.set(this.buffer.subarray(this.head, this.capacity), 0);
        out.set(this.buffer.subarray(0, len - firstChunkLen), firstChunkLen);
      }
    }
    return len;
  }

  public getLatest(): number {
    if (this.count === 0) return 0;
    const latestIdx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIdx];
  }
}
