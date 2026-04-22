import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface CreateEventParams {
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  attendees?: string[];
  calendar_id?: string;
}

export default async function createEvent(params: CreateEventParams, _context: { config: Record<string, any> }): Promise<any> {
  const { title, start_time, end_time, description, attendees, calendar_id = 'primary' } = params;

  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      `tell application "Calendar"
         tell calendar "${calendar_id === 'primary' ? 'Home' : calendar_id}"
           set newEvent to make new event with properties { summary:"${title}", start date:date "${start_time}", end date:date "${end_time}"${description ? `, description:"${description}"` : ''} }
           ${attendees ? attendees.map(a => `make new attendee at end of attendees of newEvent with properties { email address:"${a}" }`).join('\n') : ''}
           return id of newEvent
         end tell
       end tell`
    ]);

    return {
      success: true,
      eventId: stdout.trim(),
      title,
      start_time,
      end_time
    };
  } catch (err: any) {
    throw new Error(`Failed to create calendar event: ${err.message}. Ensure calendar access is granted.`);
  }
}
