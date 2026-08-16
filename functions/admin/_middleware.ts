import { proxyAuditActor } from '../../server/proxy-identity';

export interface Env {
  DB?: unknown;
  KV?: unknown;
}

export interface EventContextData {
  adminUser?: string;
  [key: string]: unknown;
}

export interface EventContext {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: (input?: RequestInfo, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<string, string | string[]>;
  data: EventContextData;
}

export const onRequest = async (context: EventContext): Promise<Response> => {
  const email = proxyAuditActor(context.request);

  if (email) {
    context.data.adminUser = email;
  }

  return await context.next();
};
