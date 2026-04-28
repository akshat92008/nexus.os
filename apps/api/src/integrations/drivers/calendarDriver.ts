/**
 * Nexus OS — Google Calendar Integration Driver
 *
 * Full CRUD for events, free/busy queries, and invite responses.
 */

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  organizer?: { email: string; displayName?: string };
  status: string;
  created: string;
  updated: string;
  hangoutLink?: string;
  conferenceData?: any;
}

export interface CreateEventParams {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: string[];
  recurrence?: string[];
  conference?: boolean;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export class CalendarDriver {
  private accessToken: string;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(path: string, options?: RequestInit): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Calendar API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async listEvents(startDate: Date, endDate: Date, calendarId = 'primary'): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
    });
    const data = await this.request(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    return (data.items || []) as CalendarEvent[];
  }

  async createEvent(params: CreateEventParams, calendarId = 'primary'): Promise<CalendarEvent> {
    const body: any = {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: params.start,
      end: params.end,
      attendees: params.attendees?.map(email => ({ email })),
    };
    if (params.recurrence) body.recurrence = params.recurrence;
    if (params.conference) {
      body.conferenceData = {
        createRequest: {
          requestId: `${Date.now()}-${Math.random()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }
    const data = await this.request(`/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return data as CalendarEvent;
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>, calendarId = 'primary'): Promise<void> {
    await this.request(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteEvent(eventId: string, calendarId = 'primary'): Promise<void> {
    await this.request(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  async findFreeSlots(
    attendees: string[],
    durationMinutes: number,
    range: { start: Date; end: Date }
  ): Promise<TimeSlot[]> {
    const body = {
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
      items: attendees.map(email => ({ id: email })),
    };
    const data = await this.request('/freeBusy', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Build free slots by inverting busy periods
    const allBusy: Array<{ start: Date; end: Date }> = [];
    for (const cal of Object.values(data.calendars || {})) {
      for (const busy of (cal as any).busy || []) {
        allBusy.push({ start: new Date(busy.start), end: new Date(busy.end) });
      }
    }
    allBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

    const slots: TimeSlot[] = [];
    let current = range.start;
    for (const busy of allBusy) {
      const gapMinutes = (busy.start.getTime() - current.getTime()) / 60000;
      if (gapMinutes >= durationMinutes) {
        slots.push({
          start: current.toISOString(),
          end: new Date(current.getTime() + durationMinutes * 60000).toISOString(),
        });
      }
      if (busy.end > current) current = busy.end;
    }
    const finalGap = (range.end.getTime() - current.getTime()) / 60000;
    if (finalGap >= durationMinutes) {
      slots.push({
        start: current.toISOString(),
        end: new Date(current.getTime() + durationMinutes * 60000).toISOString(),
      });
    }
    return slots;
  }

  async respondToInvite(eventId: string, response: 'accept' | 'decline' | 'tentative', calendarId = 'primary'): Promise<void> {
    const statusMap = { accept: 'accepted', decline: 'declined', tentative: 'tentative' };
    await this.request(`/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ attendees: [{ self: true, responseStatus: statusMap[response] }] }),
    });
  }
}

// Singleton for easy access by other services like BookingEngine
class CalendarDriverSingleton {
  /**
   * Checks if a user has a connected Google Calendar by looking up their
   * stored OAuth tokens in the user_integrations table.
   */
  async getStatus(userId: string): Promise<{ connected: boolean; accessToken?: string }> {
    // If Google OAuth is not configured at all, return false immediately
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return { connected: false };
    }

    try {
      const { getSupabase } = await import('../../storage/supabaseClient.js');
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('user_integrations')
        .select('access_token, refresh_token, metadata')
        .eq('user_id', userId)
        .eq('integration_type', 'google_calendar')
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data || !data.access_token) {
        return { connected: false };
      }

      return { connected: true, accessToken: data.access_token };
    } catch (err) {
      return { connected: false };
    }
  }

  /**
   * Lists events from the user's primary Google Calendar.
   */
  async listEvents(userId: string, start: string, end: string): Promise<any[]> {
    const status = await this.getStatus(userId);
    if (!status.connected || !status.accessToken) return [];

    try {
      const driver = new CalendarDriver(status.accessToken);
      return await driver.listEvents(new Date(start), new Date(end));
    } catch (err: any) {
      console.warn('[CalendarDriver] listEvents failed:', err.message);
      return [];
    }
  }

  /**
   * Creates a Google Calendar event for the user.
   * Falls back to a mock response if the user is not connected.
   */
  async createEvent(userId: string, params: {
    title: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
    description?: string;
  }): Promise<{ id: string; htmlLink?: string }> {
    const status = await this.getStatus(userId);

    if (!status.connected || !status.accessToken) {
      // Graceful fallback — return a structured mock so the caller doesn't crash
      const { randomUUID } = await import('crypto');
      return {
        id: `nexus-local-${randomUUID()}`,
        htmlLink: undefined,
      };
    }

    try {
      const driver = new CalendarDriver(status.accessToken);
      const event = await driver.createEvent({
        summary: params.title,
        description: params.description,
        start: { dateTime: params.startTime, timeZone: 'UTC' },
        end: { dateTime: params.endTime, timeZone: 'UTC' },
        attendees: (params.attendees || []).map(email => ({ email })),
        conference: false,
      });

      return {
        id: event.id,
        htmlLink: (event as any).htmlLink,
      };
    } catch (err: any) {
      console.warn('[CalendarDriver] createEvent failed:', err.message);
      const { randomUUID } = await import('crypto');
      return { id: `nexus-local-${randomUUID()}`, htmlLink: undefined };
    }
  }

  /**
   * Stores a Google OAuth token for a user after completing OAuth flow.
   */
  async storeToken(userId: string, accessToken: string, refreshToken: string): Promise<void> {
    try {
      const { getSupabase } = await import('../../storage/supabaseClient.js');
      const supabase = await getSupabase();
      await supabase.from('user_integrations').upsert({
        user_id: userId,
        integration_type: 'google_calendar',
        access_token: accessToken,
        refresh_token: refreshToken,
        is_active: true,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,integration_type' });
    } catch (err: any) {
      console.error('[CalendarDriver] storeToken failed:', err.message);
      throw err;
    }
  }
}

export const calendarDriver = new CalendarDriverSingleton();
