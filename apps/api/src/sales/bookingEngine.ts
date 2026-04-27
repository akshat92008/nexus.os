import { salesAgent } from './salesAgent.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';
import { randomUUID } from 'crypto';
import { emailDriver } from '../integrations/drivers/emailDriver.js';
import { calendarDriver } from '../integrations/drivers/calendarDriver.js';

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
  async findAvailableSlots(userId: string, date: string, durationMinutes = 30): Promise<string[]> {
    try {
      // Try to fetch real calendar events if Google Calendar is connected
      const status = await calendarDriver.getStatus(userId);
      
      if (status.connected) {
        const dayStart = `${date}T00:00:00Z`;
        const dayEnd = `${date}T23:59:59Z`;
        const existingEvents = await calendarDriver.listEvents(userId, dayStart, dayEnd);

        const slots: string[] = [];
        let current = new Date(`${date}T09:00:00Z`);
        const end = new Date(`${date}T17:00:00Z`);

        while (current < end && slots.length < 8) {
          const slotEnd = new Date(current.getTime() + durationMinutes * 60000);
          const hasConflict = existingEvents.some((e: any) => {
            const eStart = new Date(e.start).getTime();
            const eEnd = new Date(e.end).getTime();
            return current.getTime() < eEnd && slotEnd.getTime() > eStart;
          });

          if (!hasConflict) slots.push(current.toISOString());
          current = new Date(current.getTime() + 30 * 60000);
        }

        return slots;
      }
    } catch (err) {
      logger.warn({ err }, '[BookingEngine] Calendar unavailable, using defaults');
    }

    // Graceful fallback: return sensible default slots
    return [
      `${date}T09:00:00Z`,
      `${date}T10:00:00Z`,
      `${date}T11:00:00Z`,
      `${date}T14:00:00Z`,
      `${date}T15:00:00Z`,
    ];
  }

  async bookMeeting(request: BookingRequest): Promise<BookingResult> {
    const duration = request.durationMinutes || 30;
    const date = request.preferredDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const slots = await this.findAvailableSlots(request.userId, date, duration);

    if (!slots.length) throw new Error('No available slots for requested date');

    const startTime = slots[0];
    const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString();
    const title = request.meetingTitle || `Meeting with ${request.leadName || request.leadEmail}`;

    let eventId = `local-${randomUUID()}`;
    let calendarLink: string | undefined;

    // Try to create a real Google Calendar event
    try {
      const calStatus = await calendarDriver.getStatus(request.userId);
      if (calStatus.connected) {
        const event = await calendarDriver.createEvent(request.userId, {
          title,
          startTime,
          endTime,
          attendees: [request.leadEmail],
          description: `Sales meeting booked via Nexus OS AI Employee`,
        });
        eventId = event.id;
        calendarLink = event.htmlLink;
      }
    } catch (err) {
      logger.warn({ err }, '[BookingEngine] Calendar event creation failed, continuing without');
    }

    // Update lead status to 'booked'
    const supabase = await getSupabase();
    await supabase.from('leads').update({
      status: 'booked',
      booked_at: new Date().toISOString(),
    }).eq('id', request.leadId);

    // Log event
    await supabase.from('lead_events').insert({
      lead_id: request.leadId,
      event_type: 'meeting_booked',
      payload: { eventId, startTime, endTime, calendarLink },
    });

    // Send confirmation email
    let confirmationSent = false;
    try {
      await (emailDriver as any).execute({
        to: request.leadEmail,
        subject: `Meeting Confirmed: ${title}`,
        body: `Hi ${request.leadName || 'there'},\n\nYour meeting has been confirmed for ${new Date(startTime).toLocaleString()}.\n\n${calendarLink ? `Calendar link: ${calendarLink}` : ''}\n\nLooking forward to speaking with you!`,
      }, request.userId);
      confirmationSent = true;
    } catch (err) {
      logger.warn({ err }, '[BookingEngine] Confirmation email failed');
    }

    return { eventId, startTime, endTime, calendarLink, confirmationSent };
  }
}

export const bookingEngine = new BookingEngineService();
