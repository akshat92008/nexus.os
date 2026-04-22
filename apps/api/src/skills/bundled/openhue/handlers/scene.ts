export default async function scene(params: { bridge_ip?: string; scene_id: string }): Promise<any> {
  const bridgeIp = params.bridge_ip || process.env.HUE_BRIDGE_IP;
  const apiKey = process.env.HUE_API_KEY;

  if (!bridgeIp) throw new Error('Bridge IP required');
  if (!apiKey) throw new Error('HUE_API_KEY required');

  // Get groups to find the group that has this scene
  const groupsRes = await fetch(`http://${bridgeIp}/api/${apiKey}/groups`);
  const groups = await groupsRes.json();

  let targetGroup = '0'; // Default all lights

  for (const [gid, group] of Object.entries(groups)) {
    if ((group as any).scenes?.some((s: any) => s.id === params.scene_id)) {
      targetGroup = gid;
      break;
    }
  }

  const response = await fetch(`http://${bridgeIp}/api/${apiKey}/groups/${targetGroup}/action`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scene: params.scene_id })
  });

  const data = await response.json();

  return { success: true, group_id: targetGroup, scene_id: params.scene_id, result: data };
}
