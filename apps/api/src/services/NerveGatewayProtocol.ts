/**
 * Nexus Nerve Gateway Protocol
 *
 * Adapted from OpenClaw gateway framing and connect handshake (MIT License):
 * - docs/gateway/protocol.md
 * - ui/src/ui/gateway.ts
 *
 * Nexus keeps the protocol surface intentionally smaller and routes it into
 * our AP-safe Brain/Nerve boundary instead of OpenClaw's personal assistant UI.
 */

import { randomUUID } from 'crypto';
import {
  ADMIN_SCOPE,
  NEXUS_DEFAULT_OPERATOR_SCOPES,
  NEXUS_GATEWAY_EVENTS,
  NEXUS_GATEWAY_METHODS,
  type OperatorScope,
} from './NerveMethodPolicy.js';

export const NERVE_PROTOCOL_VERSION = 1;

export type NerveGatewayRole = 'operator' | 'node';

export interface GatewayEventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
}

export interface GatewayRequestFrame<T = unknown> {
  type: 'req';
  id: string;
  method: string;
  params?: T;
}

export interface GatewayResponseFrame<T = unknown> {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  };
}

export interface GatewayConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  role: NerveGatewayRole;
  scopes: string[];
  caps: string[];
  commands: string[];
  permissions?: Record<string, boolean>;
  auth?: {
    token?: string;
  };
  locale?: string;
  userAgent?: string;
  device?: {
    id?: string;
    nonce?: string;
  };
}

export interface ConnectedNerveClient {
  id: string;
  role: NerveGatewayRole;
  scopes: string[];
  caps: string[];
  commands: string[];
  permissions: Record<string, boolean>;
  connectedAt: string;
  client: GatewayConnectParams['client'];
  locale?: string;
  userAgent?: string;
}

export function buildConnectChallenge(nonce = randomUUID()): GatewayEventFrame {
  return {
    type: 'event',
    event: 'connect.challenge',
    payload: {
      nonce,
      ts: Date.now(),
      protocol: NERVE_PROTOCOL_VERSION,
    },
  };
}

export function buildHelloOk(params: {
  requestId: string;
  connId: string;
  scopes?: string[];
}): GatewayResponseFrame {
  return {
    type: 'res',
    id: params.requestId,
    ok: true,
    payload: {
      type: 'hello-ok',
      protocol: NERVE_PROTOCOL_VERSION,
      server: {
        version: 'nexus-nerve-bridge',
        connId: params.connId,
      },
      features: {
        methods: NEXUS_GATEWAY_METHODS,
        events: [...NEXUS_GATEWAY_EVENTS],
      },
      snapshot: {
        bridge: 'nexus-os',
        mode: 'zero-trust-execution-plane',
      },
      auth: {
        role: 'operator',
        scopes: params.scopes ?? NEXUS_DEFAULT_OPERATOR_SCOPES,
      },
      policy: {
        maxPayload: 1_048_576,
        tickIntervalMs: 15_000,
      },
    },
  };
}

export function buildErrorResponse(
  requestId: string,
  code: string,
  message: string,
  details?: unknown
): GatewayResponseFrame {
  return {
    type: 'res',
    id: requestId,
    ok: false,
    error: {
      code,
      message,
      details,
      retryable: false,
    },
  };
}

export function isGatewayRequestFrame(frame: unknown): frame is GatewayRequestFrame {
  return Boolean(
    frame &&
      typeof frame === 'object' &&
      (frame as any).type === 'req' &&
      typeof (frame as any).id === 'string' &&
      typeof (frame as any).method === 'string'
  );
}

export function isGatewayEventFrame(frame: unknown): frame is GatewayEventFrame {
  return Boolean(
    frame &&
      typeof frame === 'object' &&
      (frame as any).type === 'event' &&
      typeof (frame as any).event === 'string'
  );
}

export function parseGatewayFrame(raw: string): GatewayEventFrame | GatewayRequestFrame | GatewayResponseFrame | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function validateConnectParams(
  params: GatewayConnectParams,
  expectedNonce: string,
  expectedToken?: string
): { ok: true; client: ConnectedNerveClient } | { ok: false; code: string; message: string } {
  const versionOk =
    params.minProtocol <= NERVE_PROTOCOL_VERSION &&
    params.maxProtocol >= NERVE_PROTOCOL_VERSION;

  if (!versionOk) {
    return {
      ok: false,
      code: 'PROTOCOL_MISMATCH',
      message: `Protocol ${NERVE_PROTOCOL_VERSION} not supported by client.`,
    };
  }

  if (params.role !== 'node') {
    return {
      ok: false,
      code: 'ROLE_REJECTED',
      message: 'Only node-role clients can attach to the Nexus Nerve bridge.',
    };
  }

  if ((params.device?.nonce ?? '') !== expectedNonce) {
    return {
      ok: false,
      code: 'NONCE_MISMATCH',
      message: 'Connect nonce mismatch.',
    };
  }

  if (expectedToken && params.auth?.token !== expectedToken) {
    return {
      ok: false,
      code: 'AUTH_TOKEN_MISMATCH',
      message: 'Nerve bridge token mismatch.',
    };
  }

  return {
    ok: true,
    client: {
      id: params.device?.id || params.client.id,
      role: params.role,
      scopes: params.scopes,
      caps: params.caps,
      commands: params.commands,
      permissions: params.permissions || {},
      connectedAt: new Date().toISOString(),
      client: params.client,
      locale: params.locale,
      userAgent: params.userAgent,
    },
  };
}

export function buildDefaultOperatorAuth(): { role: NerveGatewayRole; scopes: OperatorScope[] } {
  return {
    role: 'operator',
    scopes: NEXUS_DEFAULT_OPERATOR_SCOPES,
  };
}

export function hasAdminScope(scopes: readonly string[]): boolean {
  return scopes.includes(ADMIN_SCOPE);
}
