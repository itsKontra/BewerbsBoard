import React, { useMemo } from 'react';
import { encode } from 'uqr';

export interface QrSvgProps extends React.SVGAttributes<SVGSVGElement> {
  value: string;
  size?: number | string;
  level?: 'L' | 'M' | 'Q' | 'H';
  bgColor?: string;
  fgColor?: string;
  marginSize?: number;
  includeMargin?: boolean;
  border?: number;
  title?: string;
}

export function QrSvg({
  value,
  size = 150,
  level = 'M',
  bgColor = '#FFFFFF',
  fgColor = '#000000',
  marginSize,
  includeMargin = true,
  border,
  title,
  'aria-label': ariaLabel,
  className,
  ...svgProps
}: QrSvgProps) {
  const margin = marginSize ?? (border !== undefined ? border : includeMargin ? 4 : 0);

  const { pathData, viewBoxSize } = useMemo(() => {
    if (!value) {
      return { pathData: '', viewBoxSize: 0 };
    }
    const result = encode(value, {
      ecc: level,
      border: margin,
    });
    const paths: string[] = [];
    for (let row = 0; row < result.size; row++) {
      for (let col = 0; col < result.size; col++) {
        if (result.data[row][col]) {
          paths.push(`M${col} ${row}h1v1H${col}z`);
        }
      }
    }
    return {
      pathData: paths.join(''),
      viewBoxSize: result.size,
    };
  }, [value, level, margin]);

  if (!value) {
    return null;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={ariaLabel || title}
      {...svgProps}
    >
      {title && <title>{title}</title>}
      {bgColor && bgColor !== 'transparent' && (
        <path fill={bgColor} d={`M0 0h${viewBoxSize}v${viewBoxSize}H0z`} />
      )}
      <path fill={fgColor} d={pathData} />
    </svg>
  );
}
