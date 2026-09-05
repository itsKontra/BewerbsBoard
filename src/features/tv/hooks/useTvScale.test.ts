// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { calculateTvScale, useTvScale } from './useTvScale';

describe('calculateTvScale', () => {
  it('returns scale 1 and 1920x1080 for exact 1920x1080 resolution', () => {
    const result = calculateTvScale(1920, 1080);
    expect(result.scale).toBe(1);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it('scales down proportionally for 720p 16:9 (1280x720)', () => {
    const result = calculateTvScale(1280, 720);
    expect(result.scale).toBeCloseTo(720 / 1080, 4);
    expect(result.width).toBeCloseTo(1920, 2);
    expect(result.height).toBe(1080);
    expect(result.width * result.scale).toBeCloseTo(1280, 2);
    expect(result.height * result.scale).toBeCloseTo(720, 2);
  });

  it('scales up proportionally for 4K UHD 16:9 (3840x2160)', () => {
    const result = calculateTvScale(3840, 2160);
    expect(result.scale).toBe(2);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.width * result.scale).toBe(3840);
    expect(result.height * result.scale).toBe(2160);
  });

  it('maintains 1080 height and expands width on wider displays (2560x1080 21:9 ultrawide)', () => {
    const result = calculateTvScale(2560, 1080);
    expect(result.height).toBe(1080);
    expect(result.scale).toBe(1);
    expect(result.width).toBe(2560);
    expect(result.width * result.scale).toBe(2560);
    expect(result.height * result.scale).toBe(1080);
  });

  it('maintains 1080 height and scales with expanded width on high-res ultrawide (3440x1440)', () => {
    const result = calculateTvScale(3440, 1440);
    expect(result.height).toBe(1080);
    expect(result.scale).toBeCloseTo(1440 / 1080, 4);
    expect(result.width).toBeCloseTo(3440 / (1440 / 1080), 2);
    expect(result.width * result.scale).toBeCloseTo(3440, 2);
    expect(result.height * result.scale).toBeCloseTo(1440, 2);
  });

  it('maintains 1920 width and expands height on taller displays (1920x1200 16:10)', () => {
    const result = calculateTvScale(1920, 1200);
    expect(result.width).toBe(1920);
    expect(result.scale).toBe(1);
    expect(result.height).toBe(1200);
    expect(result.width * result.scale).toBe(1920);
    expect(result.height * result.scale).toBe(1200);
  });

  it('maintains 1920 width and expands height on old 4:3 TVs (1024x768) without black stripes', () => {
    const result = calculateTvScale(1024, 768);
    expect(result.width).toBe(1920);
    expect(result.scale).toBeCloseTo(1024 / 1920, 4);
    expect(result.height).toBeCloseTo(768 / (1024 / 1920), 2);
    expect(result.width * result.scale).toBeCloseTo(1024, 2);
    expect(result.height * result.scale).toBeCloseTo(768, 2);
  });

  it('maintains 1920 width and expands height on mobile portrait dimensions (360x740)', () => {
    const result = calculateTvScale(360, 740);
    expect(result.width).toBe(1920);
    expect(result.scale).toBeCloseTo(360 / 1920, 4);
    expect(result.width * result.scale).toBeCloseTo(360, 2);
    expect(result.height * result.scale).toBeCloseTo(740, 2);
  });

  it('falls back to 1 and 1920x1080 for invalid or zero dimensions', () => {
    expect(calculateTvScale(0, 0)).toEqual({ scale: 1, width: 1920, height: 1080 });
    expect(calculateTvScale(-100, 500)).toEqual({ scale: 1, width: 1920, height: 1080 });
    expect(calculateTvScale(1920, 0)).toEqual({ scale: 1, width: 1920, height: 1080 });
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

  it('returns scale 1 and 1920x1080 on 1920x1080 window', () => {
    const { result } = renderHook(() => useTvScale());
    expect(result.current.scale).toBe(1);
    expect(result.current.width).toBe(1920);
    expect(result.current.height).toBe(1080);
  });

  it('updates scale and dimensions when window is resized to 4:3', () => {
    const { result } = renderHook(() => useTvScale());
    expect(result.current.scale).toBe(1);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 720 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.scale).toBeCloseTo(1024 / 1920, 4);
    expect(result.current.width).toBe(1920);
    expect(result.current.height).toBeCloseTo(720 / (1024 / 1920), 2);
  });

  it('updates scale and dimensions when window is resized to 21:9 ultrawide', () => {
    const { result } = renderHook(() => useTvScale());

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 2560 });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1080 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.scale).toBe(1);
    expect(result.current.width).toBe(2560);
    expect(result.current.height).toBe(1080);
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
