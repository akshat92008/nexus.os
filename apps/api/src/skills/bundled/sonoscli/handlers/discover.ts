export default async function discover(): Promise<any> {
  // Sonos discovery uses SSDP multicast
  // In production: use node-ssdp or sonos-discovery library
  // This requires network access to discover local speakers

  return {
    success: true,
    note: 'Sonos discovery requires node-sonos or similar library on the local network.',
    speakers: [],
    install_hint: 'pnpm add sonos or use npx @svrooij/sonos-cli'
  };
}
