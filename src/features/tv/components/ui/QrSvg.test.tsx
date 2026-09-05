// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QrSvg } from './QrSvg';

describe('QrSvg Component', () => {
  it('renders svg with path for provided value', () => {
    const { container } = render(
      <QrSvg value="https://example.com" size={200} title="Test QR" />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '200');
    expect(svg).toHaveAttribute('role', 'img');
    expect(screen.getByText('Test QR')).toBeInTheDocument();
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveAttribute('fill', '#FFFFFF');
    expect(paths[1]).toHaveAttribute('fill', '#000000');
  });

  it('renders nothing when value is empty', () => {
    const { container } = render(<QrSvg value="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('supports custom background and foreground colors and aria-label', () => {
    const { container } = render(
      <QrSvg
        value="https://test.com"
        bgColor="#123456"
        fgColor="#abcdef"
        aria-label="Custom QR"
        includeMargin={false}
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-label', 'Custom QR');
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveAttribute('fill', '#123456');
    expect(paths[1]).toHaveAttribute('fill', '#abcdef');
  });
});
