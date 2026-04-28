# OpenClaw Adaptation Notes

Nexus OS reuses selected ideas and small adapted code structures from the MIT-licensed [`openclaw/openclaw`](https://github.com/openclaw/openclaw) project.

Why only selective reuse:

- OpenClaw is a broad personal-assistant platform.
- Nexus OS is a finance-safe enterprise execution plane.
- We preserve Nexus differentiators: DAG orchestration, saga rollback, local-ERP execution, and approval-cockpit stops.

Current adapted surfaces:

- WebSocket gateway framing and connect handshake concepts from:
  - `docs/gateway/protocol.md`
  - `ui/src/ui/gateway.ts`
- Method-scope classification concepts from:
  - `src/gateway/method-scopes.ts`
  - `src/gateway/server-methods-list.ts`

Where the adapted code lives in Nexus:

- `apps/api/src/services/NerveGatewayProtocol.ts`
- `apps/api/src/services/NerveMethodPolicy.ts`
- `apps/api/src/services/hybridBridge.ts`

What we intentionally did not import:

- Messaging-channel integrations
- Personal-assistant session UX
- Browser-first operator flows
- Device pairing UX outside Nexus's execution plane

License note:

- OpenClaw is MIT-licensed.
- The original copyright and license terms remain with the OpenClaw authors.
- Nexus adaptations should continue to preserve this attribution when copied forward.
