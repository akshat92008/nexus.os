import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function nowPlaying(): Promise<any> {
  const { stdout } = await execFileAsync('osascript', ['-e', `
    tell application "Spotify"
      if player state is playing then
        return (name of current track) & "|" & (artist of current track) & "|" & (album of current track) & "|" & (duration of current track / 1000)
      else
        return "Not playing|" & (name of current track) & "|" & (artist of current track) & "|0"
      end if
    end tell
  `]);

  const parts = stdout.trim().split('|');
  return {
    success: true,
    state: parts[0] !== 'Not playing' ? 'playing' : 'paused',
    track: parts[1]?.trim() || '',
    artist: parts[2]?.trim() || '',
    album: parts[3]?.trim() || '',
    duration_sec: parts[4] ? parseFloat(parts[4]) : 0
  };
}
