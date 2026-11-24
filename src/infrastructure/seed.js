import { parseSeed } from '../domain/math/random.js';

export function resolveSeed(search = globalThis.location?.search ?? '') {
  const requested = parseSeed(new URLSearchParams(search).get('seed'));
  return requested ?? globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}
