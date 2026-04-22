export default async function volume(params: { room: string; level: number }): Promise<any> {
  const level = Math.max(0, Math.min(100, params.level));
  return {
    success: true,
    room: params.room,
    volume: level,
    note: 'Sonos control requires sonos library. Install: pnpm add sonos'
  };
}
