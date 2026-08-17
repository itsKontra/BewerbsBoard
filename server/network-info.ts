import os from 'node:os';
import { readFileSync } from 'node:fs';
import { isIPv4 } from 'node:net';

export interface NetworkInterfaceDetail {
  interfaceName: string;
  ip: string;
}

export interface ServerNetworkInfo {
  serverIp: string;
  serverPort: number;
  adminUrl: string;
  availableIps: NetworkInterfaceDetail[];
}

export interface GetServerNetworkInfoOptions {
  networkInterfacesFn?: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>;
  env?: Record<string, string | undefined>;
  requestHost?: string | null;
  networkInfoFilePath?: string;
  readNetworkInfoFile?: (path: string) => string;
}

export function getServerNetworkInfo(options: GetServerNetworkInfoOptions = {}): ServerNetworkInfo {
  const getInterfaces = options.networkInterfacesFn ?? os.networkInterfaces;
  const env = options.env ?? process.env;
  const rawPort = env.APP_PORT || env.PORT || '3080';
  const serverPort = Number.parseInt(rawPort, 10) || 3080;

  const interfaces = getInterfaces();
  const availableIps: NetworkInterfaceDetail[] = [];
  const hostAvailableIps: NetworkInterfaceDetail[] = [];

  if (interfaces) {
    for (const [name, infos] of Object.entries(interfaces)) {
      if (!infos) continue;
      for (const info of infos) {
        // Support both family === 'IPv4' and family === 4 (older node versions)
        const isIpv4 = info.family === 'IPv4' || (info.family as unknown) === 4;
        if (isIpv4 && !info.internal && info.address) {
          availableIps.push({
            interfaceName: name,
            ip: info.address,
          });
        }
      }
    }
  }

  const networkInfoFilePath = options.networkInfoFilePath ?? env.NETWORK_INFO_FILE;
  if (networkInfoFilePath) {
    const readNetworkInfoFile = options.readNetworkInfoFile ?? ((path: string) => readFileSync(path, 'utf8'));
    try {
      for (const detail of parseNetworkInfoFile(readNetworkInfoFile(networkInfoFilePath))) {
        hostAvailableIps.push(detail);
        if (!availableIps.some((available) => available.interfaceName === detail.interfaceName && available.ip === detail.ip)) {
          availableIps.push(detail);
        }
      }
    } catch {
      // The host collector is optional. Continue with container interfaces when
      // it has not created the bind-mounted file yet.
    }
  }

  // Check for host override in env
  const envHostOverride = env.SERVER_HOST_OVERRIDE || env.APP_HOST_OVERRIDE;
  if (envHostOverride && envHostOverride.trim()) {
    const trimmed = envHostOverride.trim();
    const cleanHost = trimmed.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const hasPort = cleanHost.includes(':');
    const displayHost = hasPort ? cleanHost : `${cleanHost}:${serverPort}`;
    return {
      serverIp: cleanHost.split(':')[0],
      serverPort: hasPort ? Number.parseInt(cleanHost.split(':')[1], 10) : serverPort,
      adminUrl: `http://${displayHost}/admin`,
      availableIps: availableIps.length > 0 ? availableIps : [{ interfaceName: 'configured', ip: cleanHost.split(':')[0] }],
    };
  }

  // If request host exists and is not localhost/127.0.0.1, use it if no interfaces found or as preferred host
  if (options.requestHost && !options.requestHost.includes('localhost') && !options.requestHost.includes('127.0.0.1')) {
    const hostWithoutProtocol = options.requestHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const [reqIp, reqPortStr] = hostWithoutProtocol.split(':');
    const reqPort = reqPortStr ? Number.parseInt(reqPortStr, 10) : serverPort;

    const primaryIp = reqIp || (availableIps[0]?.ip ?? '127.0.0.1');
    const displayPort = reqPortStr ? reqPort : serverPort;
    const portSuffix = displayPort === 80 ? '' : `:${displayPort}`;

    return {
      serverIp: primaryIp,
      serverPort: displayPort,
      adminUrl: `http://${primaryIp}${portSuffix}/admin`,
      availableIps: availableIps.length > 0 ? availableIps : [{ interfaceName: 'remote', ip: primaryIp }],
    };
  }

  // Primary IP selection: prefer physical LAN/WiFi IPs over docker/virtual bridges
  let primaryIp = '127.0.0.1';
  const ipv4Ips = availableIps.filter((detail) => isIPv4(detail.ip));
  if (ipv4Ips.length > 0) {
    const hostIpv4Ips = hostAvailableIps.filter((detail) => isIPv4(detail.ip));
    const primaryCandidates = hostIpv4Ips.length > 0 ? hostIpv4Ips : ipv4Ips;
    // Within the preferred source, prioritize physical interfaces over virtual ones.
    const prioritized = [...primaryCandidates].sort((a, b) => {
      const isVirtualA = /^(docker|br-|veth|cni|tun|tap)/i.test(a.interfaceName);
      const isVirtualB = /^(docker|br-|veth|cni|tun|tap)/i.test(b.interfaceName);
      if (isVirtualA && !isVirtualB) return 1;
      if (!isVirtualA && isVirtualB) return -1;
      return 0;
    });
    primaryIp = prioritized[0].ip;
  }

  const portSuffix = serverPort === 80 ? '' : `:${serverPort}`;
  const adminUrl = `http://${primaryIp}${portSuffix}/admin`;

  return {
    serverIp: primaryIp,
    serverPort,
    adminUrl,
    availableIps: availableIps.length > 0 ? availableIps : [{ interfaceName: 'loopback', ip: '127.0.0.1' }],
  };
}

function parseNetworkInfoFile(content: string): NetworkInterfaceDetail[] {
  return content.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const [interfaceName, ip] = trimmed.split(/\s+/, 2);
    if (!interfaceName || !ip) return [];
    return [{ interfaceName, ip }];
  });
}
