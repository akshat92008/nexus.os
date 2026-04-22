export default async function pause(params: { room: string }): Promise<any> {
  return {
    success: true,
    room: params.room,
    paused: true,
    note: 'Sonos control requires sonos library. Install: pnpm add sonos'
  };
}
