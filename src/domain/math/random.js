const UINT32_MAX = 0xffffffff;
const MULBERRY_INCREMENT = 0x6d2b79f5;

export function parseSeed(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{1,10}$/.test(text)) {
    return null;
  }
  const seed = Number(text);
  return seed <= UINT32_MAX ? seed : null;
}

export function nextRandom(state) {
  const nextState = (state + MULBERRY_INCREMENT) >>> 0;
  let mixed = nextState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return { value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296, state: nextState };
}

export function createRandomStream(initialState) {
  let state = initialState >>> 0;
  return {
    next() {
      const result = nextRandom(state);
      state = result.state;
      return result.value;
    },
    get state() {
      return state;
    },
  };
}
