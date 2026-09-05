import { useState, useEffect } from 'react';

export const TV_DESIGN_WIDTH = 1920;
export const TV_DESIGN_HEIGHT = 1080;

export interface TvScaleResult {
  scale: number;
  width: number;
  height: number;
}

/**
 * Calculates scale, width, and height for the TV viewport:
 * - If the display is wider than 16:9 (currentAspectRatio >= 16/9),
 *   keep the 1080 height, scale by height (windowHeight / 1080), and expand width to fill the screen.
 * - If the display is taller / more high than 16:9 (currentAspectRatio < 16/9),
 *   keep the 1920 width, scale by width (windowWidth / 1920), and expand height to fill the screen.
 * This guarantees zero black stripes on old 4:3 / 16:10 TVs as well as 21:9 ultrawide displays.
 */
export function calculateTvScale(
  windowWidth: number,
  windowHeight: number,
  designWidth = TV_DESIGN_WIDTH,
  designHeight = TV_DESIGN_HEIGHT,
): TvScaleResult {
  if (!windowWidth || !windowHeight || windowWidth <= 0 || windowHeight <= 0) {
    return {
      scale: 1,
      width: designWidth,
      height: designHeight,
    };
  }

  const currentAspectRatio = windowWidth / windowHeight;
  const targetAspectRatio = designWidth / designHeight;

  if (currentAspectRatio >= targetAspectRatio) {
    const scale = windowHeight / designHeight;
    return {
      scale,
      width: windowWidth / scale,
      height: designHeight,
    };
  }

  const scale = windowWidth / designWidth;
  return {
    scale,
    width: designWidth,
    height: windowHeight / scale,
  };
}

export function useTvScale(
  designWidth = TV_DESIGN_WIDTH,
  designHeight = TV_DESIGN_HEIGHT,
): TvScaleResult {
  const [scaleState, setScaleState] = useState<TvScaleResult>(() => {
    if (typeof window === 'undefined') {
      return { scale: 1, width: designWidth, height: designHeight };
    }
    const width = window.innerWidth || document.documentElement?.clientWidth || designWidth;
    const height = window.innerHeight || document.documentElement?.clientHeight || designHeight;
    return calculateTvScale(width, height, designWidth, designHeight);
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth || document.documentElement?.clientWidth || designWidth;
      const height = window.innerHeight || document.documentElement?.clientHeight || designHeight;
      setScaleState(calculateTvScale(width, height, designWidth, designHeight));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [designWidth, designHeight]);

  return scaleState;
}
