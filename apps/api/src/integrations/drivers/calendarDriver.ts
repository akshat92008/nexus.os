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
