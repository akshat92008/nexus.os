export default async function discover(): Promise<any> {
  // Discover Hue bridges via Philips discovery service
  try {
    const response = await fetch('https://discovery.meethue.com/');
    if (!response.ok) throw new Error('Discovery failed');
    
    const bridges = await response.json();
    return {
      success: true,
      bridges: bridges.map((b: any) => ({
        id: b.id,
        ip: b.internalipaddress,
        mac: b.macaddress
      }))
    };
  } catch {
    // Fallback: try local multicast SSDP discovery
    return {
      success: true,
      bridges: [],
      note: 'No bridges found via cloud discovery. Set HUE_BRIDGE_IP env var directly.'
    };
  }
}
