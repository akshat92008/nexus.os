export default async function lights(params: { bridge_ip?: string }): Promise<any> {
  const bridgeIp = params.bridge_ip || process.env.HUE_BRIDGE_IP;
  const apiKey = process.env.HUE_API_KEY;

  if (!bridgeIp) throw new Error('Bridge IP required. Set HUE_BRIDGE_IP or pass bridge_ip.');

  const url = apiKey
    ? `http://${bridgeIp}/api/${apiKey}/lights`
    : `http://${bridgeIp}/api/newdeveloper/lights`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hue API error: ${response.status}`);

  const data = await response.json();

  if (data[0]?.error) {
    throw new Error(`Hue error: ${data[0].error.description}`);
  }

  const lightList = Object.entries(data).map(([id, light]: [string, any]) => ({
    id,
    name: light.name,
    type: light.type,
    model: light.modelid,
    on: light.state?.on,
    brightness: light.state?.bri,
    reachable: light.state?.reachable
  }));

  return { success: true, bridge_ip: bridgeIp, count: lightList.length, lights: lightList };
}
