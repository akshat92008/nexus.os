export default async function setState(params: {
  bridge_ip?: string;
  light_id: string;
  on?: boolean;
  brightness?: number;
  hue?: number;
  saturation?: number;
  ct?: number;
  transitiontime?: number;
}): Promise<any> {
  const bridgeIp = params.bridge_ip || process.env.HUE_BRIDGE_IP;
  const apiKey = process.env.HUE_API_KEY;

  if (!bridgeIp) throw new Error('Bridge IP required');
  if (!apiKey) throw new Error('HUE_API_KEY required. Press link button on bridge, then create user via API.');

  const body: Record<string, any> = {};
  if (params.on !== undefined) body.on = params.on;
  if (params.brightness !== undefined) body.bri = Math.max(0, Math.min(254, params.brightness));
  if (params.hue !== undefined) body.hue = Math.max(0, Math.min(65535, params.hue));
  if (params.saturation !== undefined) body.sat = Math.max(0, Math.min(254, params.saturation));
  if (params.ct !== undefined) body.ct = Math.max(153, Math.min(500, params.ct));
  if (params.transitiontime !== undefined) body.transitiontime = params.transitiontime;

  const ids = params.light_id === 'all'
    ? await getAllLightIds(bridgeIp, apiKey)
    : [params.light_id];

  const results: any[] = [];

  for (const id of ids) {
    const response = await fetch(`http://${bridgeIp}/api/${apiKey}/lights/${id}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    results.push({ light_id: id, result: data });
  }

  return { success: true, changed: ids.length, results };
}

async function getAllLightIds(bridgeIp: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`http://${bridgeIp}/api/${apiKey}/lights`);
  const data = await response.json();
  return Object.keys(data);
}
