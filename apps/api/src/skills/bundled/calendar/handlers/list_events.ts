import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface ListEventsParams {
  calendar_id?: string;
  max_results?: number;
  time_min?: string;
  time_max?: string;
}

export default async function listEvents(params: ListEventsParams, _context: { config: Record<string, any> }): Promise<any> {
  const { calendar_id = 'primary', max_results = 10, time_min, time_max } = params;

  const now = time_min || new Date().toISOString();
  const end = time_max || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { stdout } = await execFileAsync('osascript', [
      '-e',
      `tell application "Calendar"
         set eventList to {}
         set calName to "${calendar_id === 'primary' ? 'Home' : calendar_id}"
         tell calendar calName
           set eventRefs to (every event whose start date ≥ date "${now}" and start date ≤ date "${end}")
           set limitedEvents to items 1 thru ${Math.min(max_results, 50)} of eventRefs
           repeat with anEvent in limitedEvents
             set eventInfo to summary of anEvent & "|" & (start date of anEvent as string) & "|" & (end date of anEvent as string) & "|" & (id of anEvent as string)
             set end of eventList to eventInfo
           end repeat
         end tell
         return eventList as string
       end tell`
    ]);

    const events = stdout.trim().split(', ').map(item => {
      const parts = item.split('|');
      return {
        title: parts[0] || 'Untitled',
        start_time: parts[1] || '',
        end_time: parts[2] || '',
        event_id: parts[3] || ''
      };
    }).filter(e => e.event_id);

    return {
      success: true,
      count: events.length,
      events
    };
  } catch (err: any) {
    throw new Error(`Failed to list calendar events: ${err.message}`);
  }
}
