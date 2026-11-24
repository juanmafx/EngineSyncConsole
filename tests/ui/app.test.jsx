// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/app/App.jsx';
import { DEFAULT_CONTROLS, DEFAULT_THROTTLES } from '../../src/domain/simulation/simulationState.js';
import { useSimulationLoop } from '../../src/features/simulation/useSimulationLoop.js';
import { resolveSeed } from '../../src/infrastructure/seed.js';

vi.mock('howler', () => {
  class Howl {
    play() {}
    stop() {}
    volume() {}
    rate() {}
    playing() {
      return false;
    }
  }
  return { Howl, Howler: { volume() {} } };
});

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the console and every tab', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Multi-Engine Console' })).toBeTruthy();
    for (const name of ['Engines', 'Gear', 'Flight Commands', 'Fuel Emulation', 'Autopilot', 'Telemetry']) {
      const tab = screen.getByRole('tab', { name });
      fireEvent.click(tab);
      expect(tab.getAttribute('aria-selected')).toBe('true');
    }
  });

  it('advances the simulation on its tick', () => {
    const { result } = renderHook(() =>
      useSimulationLoop({ ...DEFAULT_CONTROLS, throttles: DEFAULT_THROTTLES, seed: 42 }),
    );
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.elapsedSeconds).toBe(2);
  });

  it('keeps ticking while throttles change faster than the tick period', () => {
    let throttles = DEFAULT_THROTTLES;
    const { result, rerender } = renderHook(() =>
      useSimulationLoop({ ...DEFAULT_CONTROLS, throttles, seed: 42 }),
    );
    for (let update = 0; update < 40; update += 1) {
      act(() => vi.advanceTimersByTime(100));
      throttles = throttles.map((value) => value + 0.1);
      rerender();
    }
    expect(result.current.elapsedSeconds).toBe(4);
  });
});

describe('resolveSeed', () => {
  it('uses a valid seed from the query string', () => {
    expect(resolveSeed('?seed=2026')).toBe(2026);
  });

  it('ignores an invalid seed and falls back to a random one', () => {
    const seed = resolveSeed('?seed=abc');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });
});
