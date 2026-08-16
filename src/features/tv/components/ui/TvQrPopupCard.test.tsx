// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TvQrPopupCard } from './TvQrPopupCard';
import { conciseDestination } from '../../../../../shared/utils/tv-destination';

describe('TvQrPopupCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders correctly with public URL and large QR code when enabled', () => {
    render(
      <TvQrPopupCard
        publicUrl="https://live.feuerwehr.at/ranking"
        enabled={true}
        intervalSeconds={30}
        durationSeconds={10}
      />
    );

    const popup = screen.getByTestId('tv-qr-popup');
    expect(popup).toBeInTheDocument();
    expect(popup).toHaveAttribute('data-visible', 'true');
    expect(popup).toHaveClass('fixed', 'top-0', 'right-0');

    expect(screen.getByText('Live-Ergebnisse')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'live.feuerwehr.at/ranking' })).toHaveAttribute(
      'href',
      'https://live.feuerwehr.at/ranking'
    );
    const qrContainer = screen.getByTestId('tv-qr-code');
    expect(qrContainer).toBeInTheDocument();
    expect(qrContainer).toHaveClass('overflow-clip');
  });

  it('renders nothing when enabled is false', () => {
    const { container } = render(
      <TvQrPopupCard
        publicUrl="https://live.feuerwehr.at"
        enabled={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('tv-qr-popup')).not.toBeInTheDocument();
  });

  it('periodically transitions between visible and hidden states based on duration and interval', () => {
    vi.useFakeTimers();

    render(
      <TvQrPopupCard
        publicUrl="https://live.feuerwehr.at"
        enabled={true}
        intervalSeconds={20}
        durationSeconds={5}
        initialVisible={true}
      />
    );

    const popup = screen.getByTestId('tv-qr-popup');
    expect(popup).toHaveAttribute('data-visible', 'true');

    // Advance duration (5s) -> becomes hidden
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(popup).toHaveAttribute('data-visible', 'false');

    // Advance interval (20s) -> becomes visible again
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(popup).toHaveAttribute('data-visible', 'true');

    // Advance duration (5s) -> becomes hidden again
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(popup).toHaveAttribute('data-visible', 'false');
  });

  it('conciseDestination formats long and short URLs properly', () => {
    expect(conciseDestination('https://short.at')).toBe('short.at');
    expect(conciseDestination('https://very-long-domain-name-feuerwehr-austria.example.com/very/long/path/to/results')).toContain('…');
  });

  it('applies theme-specific styling for broadcast, ceremony, and outdoor themes', () => {
    const { rerender } = render(
      <TvQrPopupCard publicUrl="https://live.feuerwehr.at" theme="outdoor" />
    );

    const outdoorCard = screen.getByTestId('tv-qr-popup').firstElementChild;
    expect(outdoorCard).toHaveClass('bg-white/95', 'text-slate-900');

    rerender(<TvQrPopupCard publicUrl="https://live.feuerwehr.at" theme="ceremony" />);
    const ceremonyCard = screen.getByTestId('tv-qr-popup').firstElementChild;
    expect(ceremonyCard).toHaveClass('bg-stone-950/95', 'text-amber-50');

    rerender(<TvQrPopupCard publicUrl="https://live.feuerwehr.at" theme="broadcast" />);
    const broadcastCard = screen.getByTestId('tv-qr-popup').firstElementChild;
    expect(broadcastCard).toHaveClass('bg-slate-950/95', 'text-white');
  });

  it('stays visible with minimal border when alwaysVisible is true', () => {
    vi.useFakeTimers();

    render(
      <TvQrPopupCard
        publicUrl="https://live.feuerwehr.at"
        theme="outdoor"
        enabled={true}
        alwaysVisible={true}
        intervalSeconds={10}
        durationSeconds={5}
      />
    );

    const popup = screen.getByTestId('tv-qr-popup');
    expect(popup).toHaveAttribute('data-visible', 'true');
    expect(popup).toHaveAttribute('data-always-visible', 'true');

    // Minimal card border should be applied
    const card = popup.firstElementChild;
    expect(card).toHaveClass('border-slate-200/80', 'bg-white/90');

    // Advancing timers should not hide it
    act(() => {
      vi.advanceTimersByTime(50000);
    });
    expect(popup).toHaveAttribute('data-visible', 'true');
  });
});
