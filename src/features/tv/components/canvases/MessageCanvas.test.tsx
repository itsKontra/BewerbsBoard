// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MessageCanvas } from './MessageCanvas';

describe('MessageCanvas', () => {
  it('renders headline and message text', () => {
    render(
      <MessageCanvas
        announcementHeadline="IMPORTANT NOTICE"
        announcementMessage="Award ceremony begins at 18:00"
        theme="broadcast"
      />
    );

    expect(screen.getByText('IMPORTANT NOTICE')).toBeInTheDocument();
    expect(screen.getByText('Award ceremony begins at 18:00')).toBeInTheDocument();
  });

  it('renders fallback when no headline or message is provided', () => {
    render(
      <MessageCanvas
        announcementHeadline=""
        announcementMessage=""
        theme="broadcast"
      />
    );

    expect(screen.getByText('Keine Durchsage konfiguriert')).toBeInTheDocument();
  });
});
