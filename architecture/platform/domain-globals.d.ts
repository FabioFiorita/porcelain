interface AbortSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
}

declare class URL {
  constructor(url: string, base?: string);
  static parse(url: string, base?: string): URL | null;
  readonly hash: string;
  readonly host: string;
  readonly hostname: string;
  readonly href: string;
  readonly origin: string;
  readonly pathname: string;
  readonly port: string;
  readonly protocol: string;
  readonly search: string;
  readonly searchParams: URLSearchParams;
  toString(): string;
}

declare class URLSearchParams {
  constructor(init?: string | Record<string, string>);
  get(name: string): string | null;
  set(name: string, value: string): void;
  has(name: string): boolean;
  toString(): string;
}

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

declare function structuredClone<T>(value: T): T;
declare function btoa(data: string): string;
declare function atob(data: string): string;

declare module 'node:crypto' {
  interface Hash {
    update(data: string | Uint8Array): Hash;
    digest(): Uint8Array;
    digest(encoding: 'hex' | 'base64' | 'base64url'): string;
  }
  export function createHash(algorithm: 'sha256'): Hash;
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}
