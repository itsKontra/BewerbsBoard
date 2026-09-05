import { useState, useEffect } from 'react';

export const TV_DESIGN_WIDTH = 1920;
export const TV_DESIGN_HEIGHT = 1080;

export function calculateTvScale(
  windowWidth: number,
  windowHeight: number,
  designWidth = TV_DESIGN_WIDTH,
  designHeight = TV_DESIGN_HEIGHT,
): number {
  if (!windowWidth || !windowHeight || windowWidth <= 0 || windowHeight <= 0) {
    return 1;
  }
  return Math.min(windowWidth / designWidth, windowHeight / designHeight);
}

export function useTvScale(
  designWidth = TV_DESIGN_WIDTH,
  designHeight = TV_DESIGN_HEIGHT,
): number {
  const [scale, setScale] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    const width = window.innerWidth || document.documentElement?.clientWidth || designWidth;
    const height = window.innerHeight || document.documentElement?.clientHeight || designHeight;
    return calculateTvScale(width, height, designWidth, designHeight);
  });

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth || document.documentElement?.clientWidth || designWidth;
      const height = window.innerHeight || document.documentElement?.clientHeight || designHeight;
      setScale(calculateTvScale(width, height, designWidth, designHeight));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);

    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, [designWidth, designHeight]);

  return scale;
}
