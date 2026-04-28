import { describe, expect, it } from 'vitest';
import {
  buildConnectChallenge,
  buildHelloOk,
  validateConnectParams,
} from '../services/NerveGatewayProtocol.js';
import {
  ADMIN_SCOPE,
  READ_SCOPE,
  WRITE_SCOPE,
  authorizeOperatorScopesForMethod,
} from '../services/NerveMethodPolicy.js';

describe('Nerve gateway protocol', () => {
  it('builds an OpenClaw-style connect challenge and hello response', () => {
    const challenge = buildConnectChallenge('nonce_123');
    expect(challenge.type).toBe('event');
    expect(challenge.event).toBe('connect.challenge');
    expect((challenge.payload as any).nonce).toBe('nonce_123');

    const hello = buildHelloOk({ requestId: 'req_1', connId: 'conn_1' });
    expect(hello.type).toBe('res');
    expect(hello.ok).toBe(true);
    expect((hello.payload as any).type).toBe('hello-ok');
    expect((hello.payload as any).features.methods).toContain('node.invoke');
  });

  it('validates node connect params with matching nonce and token', () => {
    const result = validateConnectParams(
      {
        minProtocol: 1,
        maxProtocol: 1,
        client: {
          id: 'nexus-mac-nerve',
          version: '1.0.0',
          platform: 'macos',
          mode: 'node',
        },
        role: 'node',
        scopes: [],
        caps: ['system.run', 'ax.read'],
        commands: ['read_file', 'write_file'],
        auth: { token: 'secret' },
        device: { id: 'device_1', nonce: 'nonce_123' },
      },
      'nonce_123',
      'secret'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.client.client.id).toBe('nexus-mac-nerve');
      expect(result.client.commands).toContain('read_file');
    }
  });
});

describe('Nerve method policy', () => {
  it('allows read methods with read or write scope and write methods only with write/admin', () => {
    expect(authorizeOperatorScopesForMethod('health', [READ_SCOPE])).toEqual({ allowed: true });
    expect(authorizeOperatorScopesForMethod('health', [WRITE_SCOPE])).toEqual({ allowed: true });
    expect(authorizeOperatorScopesForMethod('node.invoke', [WRITE_SCOPE])).toEqual({ allowed: true });
    expect(authorizeOperatorScopesForMethod('node.invoke', [ADMIN_SCOPE])).toEqual({ allowed: true });
    expect(authorizeOperatorScopesForMethod('node.invoke', [READ_SCOPE])).toEqual({
      allowed: false,
      missingScope: WRITE_SCOPE,
    });
  });
});
