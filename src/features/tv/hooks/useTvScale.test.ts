// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { calculateTvScale, useTvScale } from './useTvScale';

describe('calculateTvScale', () => {
  it('returns 1 for exact 1920x1080 resolution', () => {
    expect(calculateTvScale(1920, 1080)).toBe(1);
  });

  it('scales down for 720p (1280x720)', () => {
    expect(calculateTvScale(1280, 720)).toBeCloseTo(0.6667, 4);
  });

  it('scales up for 4K UHD (3840x2160)', () => {
    expect(calculateTvScale(3840, 2160)).toBe(2);
  });

  it('fits within height on taller 16:10 display (1920x1200)', () => {
    expect(calculateTvScale(1920, 1200)).toBe(1);
  });

  it('fits within width on wider display (2560x1080)', () => {
    expect(calculateTvScale(2560, 1080)).toBe(1);
  });

  it('handles mobile portrait dimensions (360x740)', () => {
    expect(calculateTvScale(360, 740)).toBeCloseTo(360 / 1920, 4);
  });

  it('falls back to 1 for invalid or zero dimensions', () => {
    expect(calculateTvScale(0, 0)).toBe(1);
    expect(calculateTvScale(-100, 500)).toBe(1);
    expect(calculateTvScale(1920, 0)).toBe(1);
  });
});

describe('useTvScale', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1080 });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: originalInnerHeight });
  });

  it('returns scale 1 on 1920x1080 window', () => {
    const { result } = renderHook(() => useTvScale());
    expect(result.current).toBe(1);
  });

  it('updates scale when window is resized', () => {
    const { result } = renderHook(() => useTvScale());
    expect(result.current).toBe(1);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 720 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBeCloseTo(0.6667, 4);
  });

  it('cleans up resize listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useTvScale());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
