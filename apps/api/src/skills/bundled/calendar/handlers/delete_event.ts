import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface DeleteEventParams {
  event_id: string;
  calendar_id?: string;
}

export default async function deleteEvent(params: DeleteEventParams, _context: { config: Record<string, any> }): Promise<any> {
  const { event_id, calendar_id = 'primary' } = params;

  try {
    await execFileAsync('osascript', [
      '-e',
      `tell application "Calendar"
         tell calendar "${calendar_id === 'primary' ? 'Home' : calendar_id}"
           delete (first event whose id is "${event_id}")
         end tell
       end tell`
    ]);

    return {
      success: true,
      deleted: true,
      event_id
    };
  } catch (err: any) {
    throw new Error(`Failed to delete calendar event: ${err.message}`);
  }
}
