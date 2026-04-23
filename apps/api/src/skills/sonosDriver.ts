export class SonosDriver {
  private baseUrl?: string;
  constructor(baseUrl?: string) { this.baseUrl = baseUrl || process.env.SONOS_API_URL; }

  async discover(): Promise<{ name: string; uuid: string; room: string }[]> {
    if (!this.baseUrl) throw new Error('SONOS_API_URL not configured');
    const res = await fetch(`${this.baseUrl}/zones`);
    if (!res.ok) throw new Error(`Sonos discovery failed: ${res.status}`);
    return (await res.json()) || [];
  }

  async play(uuid: string, uri?: string): Promise<void> {
    if (!this.baseUrl) throw new Error('SONOS_API_URL not configured');
    await fetch(`${this.baseUrl}/zones/${uuid}/play`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: uri ? JSON.stringify({ uri }) : undefined });
  }

  async pause(uuid: string): Promise<void> {
    if (!this.baseUrl) throw new Error('SONOS_API_URL not configured');
    await fetch(`${this.baseUrl}/zones/${uuid}/pause`, { method: 'POST' });
  }

  async volume(uuid: string, level: number): Promise<void> {
    if (!this.baseUrl) throw new Error('SONOS_API_URL not configured');
    await fetch(`${this.baseUrl}/zones/${uuid}/volume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ volume: Math.max(0, Math.min(100, level)) }) });
  }
}
