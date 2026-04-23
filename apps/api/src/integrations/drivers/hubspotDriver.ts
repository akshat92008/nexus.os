/**
 * Nexus OS — HubSpot CRM Integration Driver
 *
 * Contacts, deals, notes, activity logging.
 */

export interface Contact {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  lifecycleStage?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, any>;
}

export interface Deal {
  id: string;
  name: string;
  amount?: number;
  stage: string;
  pipeline: string;
  closeDate?: string;
  contactId?: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, any>;
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  author: string;
}

export interface Activity {
  type: 'NOTE' | 'EMAIL' | 'CALL' | 'MEETING' | 'TASK';
  timestamp: string;
  description: string;
  metadata?: Record<string, any>;
}

export class HubSpotDriver {
  private baseUrl = 'https://api.hubapi.com';
  constructor(private accessToken: string) {}

  private async request(path: string, options?: RequestInit): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot API ${res.status}: ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  private contactFromResponse(result: any): Contact {
    const props = result.properties || {};
    return {
      id: result.id,
      email: props.email,
      firstName: props.firstname,
      lastName: props.lastname,
      phone: props.phone,
      company: props.company,
      jobTitle: props.jobtitle,
      lifecycleStage: props.lifecyclestage,
      lastContactedAt: props.notes_last_contacted,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      properties: props,
    };
  }

  async getContacts(filters?: { email?: string; limit?: number; after?: string }): Promise<Contact[]> {
    const limit = filters?.limit ?? 50;
    if (filters?.email) {
      const data = await this.request(`/crm/v3/objects/contacts/search`, {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{
            filters: [{ propertyName: 'email', operator: 'EQ', value: filters.email }],
          }],
          properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle', 'lifecyclestage', 'notes_last_contacted'],
          limit: 1,
        }),
      });
      return (data.results || []).map(this.contactFromResponse);
    }
    const data = await this.request(`/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,phone,company,jobtitle,lifecyclestage,notes_last_contacted&after=${filters?.after || ''}`);
    return (data.results || []).map(this.contactFromResponse);
  }

  async getContact(contactId: string): Promise<Contact> {
    const data = await this.request(`/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,phone,company,jobtitle,lifecyclestage,notes_last_contacted`);
    return this.contactFromResponse(data);
  }

  async createContact(data: Partial<Contact>): Promise<Contact> {
    const body = {
      properties: {
        email: data.email,
        firstname: data.firstName,
        lastname: data.lastName,
        phone: data.phone,
        company: data.company,
        jobtitle: data.jobTitle,
      },
    };
    const result = await this.request('/crm/v3/objects/contacts', { method: 'POST', body: JSON.stringify(body) });
    return this.contactFromResponse(result);
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<void> {
    const body = {
      properties: {
        ...(updates.email && { email: updates.email }),
        ...(updates.firstName && { firstname: updates.firstName }),
        ...(updates.lastName && { lastname: updates.lastName }),
        ...(updates.phone && { phone: updates.phone }),
        ...(updates.company && { company: updates.company }),
        ...(updates.jobTitle && { jobtitle: updates.jobTitle }),
      },
    };
    await this.request(`/crm/v3/objects/contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async getDeals(filters?: { contactId?: string; stage?: string; limit?: number }): Promise<Deal[]> {
    const limit = filters?.limit ?? 50;
    if (filters?.contactId) {
      const data = await this.request(`/crm/v3/objects/deals/search`, {
        method: 'POST',
        body: JSON.stringify({
          filterGroups: [{
            filters: [{ propertyName: 'associations.contact', operator: 'EQ', value: filters.contactId }],
          }],
          properties: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate'],
          limit,
        }),
      });
      return (data.results || []).map((r: any) => ({
        id: r.id,
        name: r.properties.dealname,
        amount: parseFloat(r.properties.amount) || undefined,
        stage: r.properties.dealstage,
        pipeline: r.properties.pipeline,
        closeDate: r.properties.closedate,
        contactId: filters.contactId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        properties: r.properties,
      }));
    }
    const data = await this.request(`/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,pipeline,closedate`);
    return (data.results || []).map((r: any) => ({
      id: r.id,
      name: r.properties.dealname,
      amount: parseFloat(r.properties.amount) || undefined,
      stage: r.properties.dealstage,
      pipeline: r.properties.pipeline,
      closeDate: r.properties.closedate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      properties: r.properties,
    }));
  }

  async createDeal(data: { name: string; amount?: number; stage?: string; pipeline?: string; contactId?: string }): Promise<Deal> {
    const body = {
      properties: {
        dealname: data.name,
        ...(data.amount && { amount: String(data.amount) }),
        ...(data.stage && { dealstage: data.stage }),
        ...(data.pipeline && { pipeline: data.pipeline }),
      },
    };
    const result = await this.request('/crm/v3/objects/deals', { method: 'POST', body: JSON.stringify(body) });
    if (data.contactId) {
      await this.request(`/crm/v4/objects/deals/${result.id}/associations/contacts/${data.contactId}/3`, { method: 'PUT' });
    }
    return {
      id: result.id,
      name: result.properties.dealname,
      amount: parseFloat(result.properties.amount) || undefined,
      stage: result.properties.dealstage,
      pipeline: result.properties.pipeline,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      properties: result.properties,
    };
  }

  async updateDealStage(dealId: string, stage: string): Promise<void> {
    await this.request(`/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: { dealstage: stage } }),
    });
  }

  async logActivity(contactId: string, activity: Activity): Promise<void> {
    const body = {
      engagement: {
        type: activity.type.toUpperCase(),
        timestamp: activity.timestamp,
      },
      associations: {
        contactIds: [parseInt(contactId, 10)],
      },
      metadata: {
        body: activity.description,
      },
    };
    await this.request('/engagements/v1/engagements', { method: 'POST', body: JSON.stringify(body) });
  }

  async getNotes(contactId: string): Promise<Note[]> {
    const data = await this.request(`/engagements/v1/engagements/associated/contact/${contactId}/paged`);
    return (data.results || [])
      .filter((r: any) => r.engagement.type === 'NOTE')
      .map((r: any) => ({
        id: r.engagement.id,
        content: r.metadata?.body || '',
        createdAt: r.engagement.createdAt,
        author: r.engagement.createdBy,
      }));
  }

  async addNote(contactId: string, content: string): Promise<Note> {
    const body = {
      engagement: { type: 'NOTE', timestamp: Date.now() },
      associations: { contactIds: [parseInt(contactId, 10)] },
      metadata: { body: content },
    };
    const result = await this.request('/engagements/v1/engagements', { method: 'POST', body: JSON.stringify(body) });
    return {
      id: result.engagement.id,
      content: result.metadata?.body || content,
      createdAt: result.engagement.createdAt,
      author: result.engagement.createdBy,
    };
  }

  async getLeadsNotContactedSince(days: number): Promise<Contact[]> {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const data = await this.request('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [
            { propertyName: 'notes_last_contacted', operator: 'LT', value: cutoff },
            { propertyName: 'lifecyclestage', operator: 'NEQ', value: 'customer' },
          ],
        }],
        properties: ['email', 'firstname', 'lastname', 'phone', 'company', 'jobtitle', 'lifecyclestage', 'notes_last_contacted'],
        limit: 100,
        sorts: [{ propertyName: 'notes_last_contacted', direction: 'ASCENDING' }],
      }),
    });
    return (data.results || []).map(this.contactFromResponse);
  }
}
