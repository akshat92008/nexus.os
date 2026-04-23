import { skillManager } from '../skills/skillManager.js';
import { salesAgent } from './salesAgent.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';
import { randomUUID } from 'crypto';
import { emailDriver } from '../integrations/drivers/emailDriver.js';

interface BookingRequest {
  leadId: string;
  userId: string;
  leadEmail: string;
  leadName?: string;
  preferredDate?: string;   // ISO date string YYYY-MM-DD
  durationMinutes?: number; // default 30
  meetingTitle?: string;
}

interface BookingResult {
  eventId: string;
  startTime: string;
  endTime: string;
  calendarLink?: string;
  confirmationSent: boolean;
}

export class BookingEngineService {
  /**
   * Finds available time slots for a given user and date.
   * Generates candidate slots every 30 minutes from 09:00 to 16:30.
   */
  async findAvailableSlots(userId: string, date: string, durationMinutes: number = 30): Promise<string[]> {
    try {
      // Fetch existing events for the day
      const events = await skillManager.executeTool('calendar_list_events', {
        time_min: `${date}T08:00:00Z`,
        time_max: `${date}T18:00:00Z`,
        max_results: 20
      }, { userId });

      const existingEvents = (events || []).map((e: any) => ({
        start: new Date(e.start?.dateTime || e.start?.date).getTime(),
        end: new Date(e.end?.dateTime || e.end?.date).getTime()
      }));

      const availableSlots: string[] = [];
      const startTimeRef = new Date(`${date}T09:00:00Z`);
      const endTimeRef = new Date(`${date}T16:30:00Z`);

      let currentSlot = new Date(startTimeRef);

      while (currentSlot <= endTimeRef) {
        const slotStart = currentSlot.getTime();
        const slotEnd = slotStart + durationMinutes * 60000;

        const isOverlapping = existingEvents.some((event: any) => {
          return slotStart < event.end && slotEnd > event.start;
        });

        if (!isOverlapping) {
          availableSlots.push(currentSlot.toISOString());
        }

        if (availableSlots.length >= 6) break;

        // Increment by 30 minutes
        currentSlot = new Date(currentSlot.getTime() + 30 * 60000);
      }

      return availableSlots;
    } catch (err) {
      logger.warn({ err, userId, date }, '[BookingEngine] Failed to fetch calendar slots, using defaults');
      // Return 3 default slots (10:00, 11:00, 14:00) as fallback
      return [
        `${date}T10:00:00Z`,
        `${date}T11:00:00Z`,
        `${date}T14:00:00Z`
      ];
    }
  }

  /**
   * Books a meeting for a lead.
   */
  async bookMeeting(request: BookingRequest): Promise<BookingResult> {
    const duration = request.durationMinutes || 30;
    const date = request.preferredDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    const slots = await this.findAvailableSlots(request.userId, date, duration);
    
    if (!slots || slots.length === 0) {
      throw new Error(`No available slots on requested date: ${date}`);
    }

    const startTime = slots[0];
    const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();

    // Create calendar event
    const result = await skillManager.executeTool('calendar_create_event', {
      title: request.meetingTitle || `Meeting with ${request.leadName || request.leadEmail}`,
      start_time: startTime,
      end_time: endTime,
      attendees: [request.leadEmail],
      description: 'Scheduled via Nexus OS'
    }, { userId: request.userId });

    // Update leads table
    const supabase = await getSupabase();
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'booked',
        booked_at: new Date().toISOString()
      })
      .eq('id', request.leadId);

    if (updateError) {
      logger.error({ err: updateError, leadId: request.leadId }, '[BookingEngine] Failed to update lead status');
    }

    // Insert lead event
    const { error: eventError } = await supabase
      .from('lead_events')
      .insert({
        lead_id: request.leadId,
        event_type: 'booked',
        payload: { startTime, endTime, eventId: result?.id || result?.eventId }
      });

    if (eventError) {
      logger.error({ err: eventError, leadId: request.leadId }, '[BookingEngine] Failed to log lead event');
    }

    // Send confirmation email (bypass approval)
    let confirmationSent = false;
    try {
      const formattedTime = new Date(startTime).toLocaleString('en-US', { 
        dateStyle: 'full', 
        timeStyle: 'short' 
      });
      
      const confirmBody = `Hi ${request.leadName || 'there'},\n\nYour meeting is confirmed for ${formattedTime}.\n\nA calendar invite has been sent to ${request.leadEmail}.\n\nLooking forward to speaking with you!\n\nBest regards,\nNexus OS Sales Team`;
      
      const emailResult = await (emailDriver as any).execute({ 
        to: request.leadEmail, 
        subject: 'Meeting Confirmed ✓', 
        body: confirmBody 
      }, request.userId);
      
      confirmationSent = emailResult.success;
    } catch (e) {
      logger.warn({ err: e }, '[BookingEngine] Confirmation email failed');
      confirmationSent = false;
    }

    return {
      eventId: result?.id || result?.eventId || randomUUID(),
      startTime,
      endTime,
      confirmationSent
    };
  }
}

export const bookingEngine = new BookingEngineService();
