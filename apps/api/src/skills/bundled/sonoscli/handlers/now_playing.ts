export default async function nowPlaying(params: { room: string }): Promise<any> {
  return {
    success: true,
    room: params.room,
    track: null,
    note: 'Sonos control requires sonos library. Install: pnpm add sonos'
  };
}
