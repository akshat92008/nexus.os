/**
 * Nexus Nerve method policy
 *
 * Adapted from OpenClaw's gateway method scope model (MIT License):
 * - src/gateway/method-scopes.ts
 * - src/gateway/server-methods-list.ts
 *
 * We preserve the control-plane idea while narrowing it to Nexus's
 * finance-safe Brain <-> Nerve execution path.
 */

export const ADMIN_SCOPE = 'operator.admin';
export const APPROVALS_SCOPE = 'operator.approvals';
export const READ_SCOPE = 'operator.read';
export const WRITE_SCOPE = 'operator.write';

export type OperatorScope =
  | typeof ADMIN_SCOPE
  | typeof APPROVALS_SCOPE
  | typeof READ_SCOPE
  | typeof WRITE_SCOPE;

export const NEXUS_DEFAULT_OPERATOR_SCOPES: OperatorScope[] = [
  ADMIN_SCOPE,
  APPROVALS_SCOPE,
  READ_SCOPE,
  WRITE_SCOPE,
];

const NODE_ROLE_METHODS = new Set([
  'node.invoke.result',
  'node.event',
]);

const METHOD_SCOPE_GROUPS: Record<OperatorScope, string[]> = {
  [APPROVALS_SCOPE]: [
    'exec.approval.request',
    'exec.approval.resolve',
    'exec.approval.status',
  ],
  [READ_SCOPE]: [
    'health',
    'bridge.status',
    'node.list',
    'node.describe',
    'mission.status',
  ],
  [WRITE_SCOPE]: [
    'node.invoke',
    'mission.dispatch',
  ],
  [ADMIN_SCOPE]: [
    'connect',
    'node.pair.approve',
    'node.pair.reject',
    'bridge.restart',
  ],
};

const METHOD_SCOPE_BY_NAME = new Map<string, OperatorScope>(
  Object.entries(METHOD_SCOPE_GROUPS).flatMap(([scope, methods]) =>
    methods.map((method) => [method, scope as OperatorScope])
  )
);

export const NEXUS_GATEWAY_METHODS = Array.from(
  new Set([
    ...Object.values(METHOD_SCOPE_GROUPS).flat(),
    ...Array.from(NODE_ROLE_METHODS),
  ])
);

export const NEXUS_GATEWAY_EVENTS = [
  'connect.challenge',
  'node.invoke.request',
  'node.invoke.result',
  'node.event',
  'health',
] as const;

export function isNodeRoleMethod(method: string): boolean {
  return NODE_ROLE_METHODS.has(method);
}

export function resolveRequiredOperatorScopeForMethod(method: string): OperatorScope | undefined {
  return METHOD_SCOPE_BY_NAME.get(method);
}

export function authorizeOperatorScopesForMethod(
  method: string,
  scopes: readonly string[]
): { allowed: true } | { allowed: false; missingScope: OperatorScope } {
  if (scopes.includes(ADMIN_SCOPE)) {
    return { allowed: true };
  }

  const requiredScope = resolveRequiredOperatorScopeForMethod(method) ?? ADMIN_SCOPE;

  if (requiredScope === READ_SCOPE) {
    if (scopes.includes(READ_SCOPE) || scopes.includes(WRITE_SCOPE)) {
      return { allowed: true };
    }

    return { allowed: false, missingScope: READ_SCOPE };
  }

  if (scopes.includes(requiredScope)) {
    return { allowed: true };
  }

  return { allowed: false, missingScope: requiredScope };
}
