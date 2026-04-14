/**
 * Nexus OS — Export Artifact (Client-Side)
 *
 * Calls GET /api/export/:sessionId?format=<format> and triggers
 * a browser file download. Mimics an OS "Save File" action.
 */

import type { ExportFormat } from '@nexus-os/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export async function exportArtifact(sessionId: string, format: ExportFormat): Promise<void> {
  if (!sessionId) {
    throw new Error('Mission context (sessionId) is missing. Start a mission first.');
  }

  const url = `/nexus-remote/export/${sessionId}?format=${format}`;
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(err.error ?? `Export failed (${response.status})`);
  }

  const blob     = await response.blob();
  const filename = response.headers
    .get('Content-Disposition')
    ?.match(/filename="(.+)"/)?.[1] ?? `nexus-export.${format}`;

  const link    = document.createElement('a');
  link.href     = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
