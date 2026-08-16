// @vitest-environment happy-dom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AdminAccessSplashCanvas } from './AdminAccessSplashCanvas';

describe('AdminAccessSplashCanvas Component', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders admin access splash with given server info and QR code', () => {
    render(
      <AdminAccessSplashCanvas
        theme="broadcast"
        serverInfo={{
          serverIp: '192.168.1.50',
          serverPort: 3080,
          adminUrl: 'http://192.168.1.50:3080/admin',
          availableIps: [
            { interfaceName: 'eth0', ip: '192.168.1.50' },
            { interfaceName: 'wlan0', ip: '10.42.0.1' },
          ],
        }}
      />
    );

    expect(screen.getByTestId('tv-admin-splash-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('admin-access-url')).toHaveTextContent('Access Admin Dashboard on 192.168.1.50:3080/admin');
    expect(screen.getByTestId('admin-access-qr')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.50')).toBeInTheDocument();
    expect(screen.getByText('10.42.0.1')).toBeInTheDocument();
  });

  it('renders cleanly with fallback when serverInfo is omitted', () => {
    render(<AdminAccessSplashCanvas theme="ceremony" />);

    expect(screen.getByTestId('tv-admin-splash-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('admin-access-url')).toBeInTheDocument();
    expect(screen.getByTestId('admin-access-qr')).toBeInTheDocument();
  });

  it('supports outdoor theme styling', () => {
    render(
      <AdminAccessSplashCanvas
        theme="outdoor"
        serverInfo={{
          serverIp: '192.168.10.20',
          serverPort: 80,
          adminUrl: 'http://192.168.10.20/admin',
          availableIps: [{ interfaceName: 'eth0', ip: '192.168.10.20' }],
        }}
      />
    );

    const canvas = screen.getByTestId('tv-admin-splash-canvas');
    expect(canvas).toHaveClass('bg-white/95');
    expect(screen.getByTestId('admin-access-url')).toHaveTextContent('Access Admin Dashboard on 192.168.10.20/admin');
  });
});
