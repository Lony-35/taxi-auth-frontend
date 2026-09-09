import type { SessionReference } from '../model/identity'

export interface SessionStorage {
  read(): SessionReference | null
  write(reference: SessionReference): void
  clear(): void
}

export class MemorySessionStorage implements SessionStorage {
  private reference: SessionReference | null = null

  read(): SessionReference | null {
    return this.reference
  }

  write(reference: SessionReference): void {
    this.reference = reference
  }

  clear(): void {
    this.reference = null
  }
}
