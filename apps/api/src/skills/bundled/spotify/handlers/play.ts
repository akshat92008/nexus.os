import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function play(params: { track?: string; artist?: string; uri?: string }): Promise<any> {
  if (params.uri) {
    await execFileAsync('osascript', ['-e', `tell application "Spotify" to play track "${params.uri}"`]);
    return { success: true, playing: params.uri };
  }

  if (params.track) {
    const search = params.artist ? `${params.track} ${params.artist}` : params.track;
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      `tell application "Spotify"
        set searchResults to search "${search.replace(/"/g, '\\"')}"
        if count of searchResults > 0 then
          play track (spotify url of first item of searchResults)
          return name of first item of searchResults & " by " & artist of first item of searchResults
        end if
      end tell`
    ]);
    return { success: true, playing: stdout.trim() };
  }

  await execFileAsync('osascript', ['-e', 'tell application "Spotify" to play']);
  return { success: true, playing: 'Resumed' };
}
