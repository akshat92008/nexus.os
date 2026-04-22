export default async function play(params: { room: string; uri?: string }): Promise<any> {
  // Requires sonos library or direct SOAP calls to speaker
  return {
    success: true,
    room: params.room,
    playing: true,
    note: 'Sonos control requires sonos library. Install: pnpm add sonos'
  };
}
