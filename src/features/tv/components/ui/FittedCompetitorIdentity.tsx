import { useLayoutEffect, useRef } from 'react';
import { calculateFittedFontSize } from '../../utils/tv-identity-fit';

const MINIMUM_COMPETITOR_IDENTITY_FONT_SIZE_PX = 18;

export function FittedCompetitorIdentity({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  const identityRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const identity = identityRef.current;
    if (!identity) return;

    let active = true;
    const fit = () => {
      if (!active || typeof window.getComputedStyle !== 'function') return;

      identity.style.fontSize = '';
      const preferredSize = Number.parseFloat(window.getComputedStyle(identity).fontSize);
      const availableWidth = identity.clientWidth;
      const requiredWidth = identity.scrollWidth;
      if (
        !Number.isFinite(preferredSize)
        || preferredSize <= 0
        || availableWidth <= 0
        || requiredWidth <= 0
      ) return;

      const fittedSize = calculateFittedFontSize(
        preferredSize,
        availableWidth,
        requiredWidth,
        MINIMUM_COMPETITOR_IDENTITY_FONT_SIZE_PX,
      );
      if (fittedSize < preferredSize) identity.style.fontSize = `${fittedSize}px`;
    };

    fit();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    observer?.observe(identity.parentElement ?? identity);
    void document.fonts?.ready.then(fit).catch(() => undefined);

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [children, className]);

  return (
    <div
      ref={identityRef}
      aria-label={children}
      className={`truncate whitespace-nowrap ${className}`}
      title={children}
    >
      {children}
    </div>
  );
}
