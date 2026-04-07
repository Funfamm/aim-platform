// Declarations for modules without TypeScript typings
declare module 'uuid' {
  export function v4(): string;
  export { v4 as default };
}

declare module 'lru-cache' {
  interface Options {
    max?: number;
    ttl?: number;
  }
  export default class LRU<K, V> {
    constructor(options?: Options<K, V>);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
  }
}

