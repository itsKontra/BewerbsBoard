import { describe, expect, it } from 'vitest';
import type { NetworkInterfaceInfo } from 'node:os';
import { getServerNetworkInfo } from './network-info.js';

describe('getServerNetworkInfo', () => {
  it('discovers non-internal IPv4 addresses and formats default port', () => {
    const mockInterfaces: Record<string, NetworkInterfaceInfo[]> = {
      eth0: [
        {
          address: '192.168.1.100',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '192.168.1.100/24',
        },
      ],
      lo: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8',
        },
      ],
    };

    const info = getServerNetworkInfo({
      networkInterfacesFn: () => mockInterfaces,
      env: { APP_PORT: '3080' },
    });

    expect(info.serverIp).toBe('192.168.1.100');
    expect(info.serverPort).toBe(3080);
    expect(info.adminUrl).toBe('http://192.168.1.100:3080/admin');
    expect(info.availableIps).toEqual([
      { interfaceName: 'eth0', ip: '192.168.1.100' },
    ]);
  });

  it('prioritizes physical interfaces over docker bridge interfaces', () => {
    const mockInterfaces: Record<string, NetworkInterfaceInfo[]> = {
      docker0: [
        {
          address: '172.17.0.1',
          netmask: '255.255.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '172.17.0.1/16',
        },
      ],
      wlan0: [
        {
          address: '192.168.0.55',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '192.168.0.55/24',
        },
      ],
    };

    const info = getServerNetworkInfo({
      networkInterfacesFn: () => mockInterfaces,
      env: { APP_PORT: '8080' },
    });

    expect(info.serverIp).toBe('192.168.0.55');
    expect(info.adminUrl).toBe('http://192.168.0.55:8080/admin');
  });

  it('handles port 80 cleanly without port suffix in url', () => {
    const mockInterfaces: Record<string, NetworkInterfaceInfo[]> = {
      eth0: [
        {
          address: '10.0.0.12',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: false,
          cidr: '10.0.0.12/24',
        },
      ],
    };

    const info = getServerNetworkInfo({
      networkInterfacesFn: () => mockInterfaces,
      env: { APP_PORT: '80' },
    });

    expect(info.serverIp).toBe('10.0.0.12');
    expect(info.serverPort).toBe(80);
    expect(info.adminUrl).toBe('http://10.0.0.12/admin');
  });

  it('respects SERVER_HOST_OVERRIDE when set', () => {
    const info = getServerNetworkInfo({
      networkInterfacesFn: () => ({}),
      env: { SERVER_HOST_OVERRIDE: 'scoreboard.local:8080' },
    });

    expect(info.serverIp).toBe('scoreboard.local');
    expect(info.serverPort).toBe(8080);
    expect(info.adminUrl).toBe('http://scoreboard.local:8080/admin');
  });

  it('falls back to 127.0.0.1 if no non-internal interfaces exist', () => {
    const info = getServerNetworkInfo({
      networkInterfacesFn: () => ({}),
      env: {},
    });

    expect(info.serverIp).toBe('127.0.0.1');
    expect(info.serverPort).toBe(3080);
    expect(info.adminUrl).toBe('http://127.0.0.1:3080/admin');
  });
});
