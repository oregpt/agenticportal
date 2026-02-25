/**
 * HubSpot API Client
 *
 * Base URL: https://api.hubapi.com
 * Auth: Bearer token (Authorization: Bearer pat-xxx)
 * Request bodies: application/json
 * Responses: JSON
 * Pagination: cursor-based (after param, returns paging.next.after)
 * Rate limit: 100 requests per 10 seconds
 */

const BASE_URL = 'https://api.hubapi.com';

export class HubSpotClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: Record<string, any>;
      params?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params } = options;
    const url = new URL(`${BASE_URL}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
    };

    let requestBody: string | undefined;
    if (body) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      ...(requestBody ? { body: requestBody } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HubSpot API Error ${response.status}: ${text}`);
    }

    return response.json();
  }

  // ─── Generic CRM Object Methods ───
  // HubSpot CRM v3 uses a uniform pattern: /crm/v3/objects/{objectType}

  async listObjects(objectType: string, params?: {
    limit?: number; after?: string; properties?: string;
    associations?: string;
  }) {
    const queryParams: Record<string, any> = {};
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.after) queryParams.after = params.after;
    if (params?.properties) queryParams.properties = params.properties;
    if (params?.associations) queryParams.associations = params.associations;
    return this.request<any>(`/crm/v3/objects/${encodeURIComponent(objectType)}`, { params: queryParams });
  }

  async getObject(objectType: string, objectId: string, properties?: string, associations?: string) {
    const params: Record<string, any> = {};
    if (properties) params.properties = properties;
    if (associations) params.associations = associations;
    return this.request<any>(`/crm/v3/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`, { params });
  }

  async createObject(objectType: string, properties: Record<string, any>, associations?: any[]) {
    const body: Record<string, any> = { properties };
    if (associations) body.associations = associations;
    return this.request<any>(`/crm/v3/objects/${encodeURIComponent(objectType)}`, { method: 'POST', body });
  }

  async updateObject(objectType: string, objectId: string, properties: Record<string, any>) {
    return this.request<any>(
      `/crm/v3/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
      { method: 'PATCH', body: { properties } }
    );
  }

  async deleteObject(objectType: string, objectId: string) {
    return this.request<any>(
      `/crm/v3/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
      { method: 'DELETE' }
    );
  }

  async searchObjects(objectType: string, filters: any[], properties?: string[], sorts?: any[], limit?: number, after?: number) {
    const body: Record<string, any> = {
      filterGroups: [{ filters }],
    };
    if (properties) body.properties = properties;
    if (sorts) body.sorts = sorts;
    if (limit) body.limit = limit;
    if (after !== undefined) body.after = after;
    return this.request<any>(`/crm/v3/objects/${encodeURIComponent(objectType)}/search`, { method: 'POST', body });
  }

  // ─── Contacts ───

  async listContacts(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('contacts', params);
  }

  async getContact(contactId: string, properties?: string) {
    return this.getObject('contacts', contactId, properties);
  }

  async createContact(properties: Record<string, any>) {
    return this.createObject('contacts', properties);
  }

  async updateContact(contactId: string, properties: Record<string, any>) {
    return this.updateObject('contacts', contactId, properties);
  }

  async deleteContact(contactId: string) {
    return this.deleteObject('contacts', contactId);
  }

  async searchContacts(filters: any[], properties?: string[], limit?: number, after?: number) {
    return this.searchObjects('contacts', filters, properties, undefined, limit, after);
  }

  // ─── Companies ───

  async listCompanies(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('companies', params);
  }

  async getCompany(companyId: string, properties?: string) {
    return this.getObject('companies', companyId, properties);
  }

  async createCompany(properties: Record<string, any>) {
    return this.createObject('companies', properties);
  }

  async updateCompany(companyId: string, properties: Record<string, any>) {
    return this.updateObject('companies', companyId, properties);
  }

  async deleteCompany(companyId: string) {
    return this.deleteObject('companies', companyId);
  }

  async searchCompanies(filters: any[], properties?: string[], limit?: number, after?: number) {
    return this.searchObjects('companies', filters, properties, undefined, limit, after);
  }

  // ─── Deals ───

  async listDeals(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('deals', params);
  }

  async getDeal(dealId: string, properties?: string) {
    return this.getObject('deals', dealId, properties);
  }

  async createDeal(properties: Record<string, any>, associations?: any[]) {
    return this.createObject('deals', properties, associations);
  }

  async updateDeal(dealId: string, properties: Record<string, any>) {
    return this.updateObject('deals', dealId, properties);
  }

  async deleteDeal(dealId: string) {
    return this.deleteObject('deals', dealId);
  }

  async searchDeals(filters: any[], properties?: string[], limit?: number, after?: number) {
    return this.searchObjects('deals', filters, properties, undefined, limit, after);
  }

  // ─── Tickets ───

  async listTickets(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('tickets', params);
  }

  async getTicket(ticketId: string, properties?: string) {
    return this.getObject('tickets', ticketId, properties);
  }

  async createTicket(properties: Record<string, any>) {
    return this.createObject('tickets', properties);
  }

  async updateTicket(ticketId: string, properties: Record<string, any>) {
    return this.updateObject('tickets', ticketId, properties);
  }

  async deleteTicket(ticketId: string) {
    return this.deleteObject('tickets', ticketId);
  }

  async searchTickets(filters: any[], properties?: string[], limit?: number, after?: number) {
    return this.searchObjects('tickets', filters, properties, undefined, limit, after);
  }

  // ─── Engagements: Notes ───

  async listNotes(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('notes', params);
  }

  async getNote(noteId: string, properties?: string) {
    return this.getObject('notes', noteId, properties);
  }

  async createNote(properties: Record<string, any>, associations?: any[]) {
    return this.createObject('notes', properties, associations);
  }

  // ─── Engagements: Tasks ───

  async listTasks(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('tasks', params);
  }

  async getTask(taskId: string, properties?: string) {
    return this.getObject('tasks', taskId, properties);
  }

  async createTask(properties: Record<string, any>, associations?: any[]) {
    return this.createObject('tasks', properties, associations);
  }

  // ─── Engagements: Calls ───

  async listCalls(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('calls', params);
  }

  async getCall(callId: string, properties?: string) {
    return this.getObject('calls', callId, properties);
  }

  async createCall(properties: Record<string, any>, associations?: any[]) {
    return this.createObject('calls', properties, associations);
  }

  // ─── Engagements: Meetings ───

  async listMeetings(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('meetings', params);
  }

  async getMeeting(meetingId: string, properties?: string) {
    return this.getObject('meetings', meetingId, properties);
  }

  async createMeeting(properties: Record<string, any>, associations?: any[]) {
    return this.createObject('meetings', properties, associations);
  }

  // ─── Commerce: Products ───

  async listProducts(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('products', params);
  }

  async getProduct(productId: string, properties?: string) {
    return this.getObject('products', productId, properties);
  }

  async createProduct(properties: Record<string, any>) {
    return this.createObject('products', properties);
  }

  async updateProduct(productId: string, properties: Record<string, any>) {
    return this.updateObject('products', productId, properties);
  }

  // ─── Commerce: Line Items ───

  async listLineItems(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('line_items', params);
  }

  async getLineItem(lineItemId: string, properties?: string) {
    return this.getObject('line_items', lineItemId, properties);
  }

  async createLineItem(properties: Record<string, any>, associations?: any[]) {
    return this.createObject('line_items', properties, associations);
  }

  async updateLineItem(lineItemId: string, properties: Record<string, any>) {
    return this.updateObject('line_items', lineItemId, properties);
  }

  // ─── Commerce: Quotes ───

  async listQuotes(params?: { limit?: number; after?: string; properties?: string }) {
    return this.listObjects('quotes', params);
  }

  async getQuote(quoteId: string, properties?: string, associations?: string) {
    return this.getObject('quotes', quoteId, properties, associations);
  }

  async searchQuotes(filters: any[], properties?: string[], limit?: number, after?: number) {
    return this.searchObjects('quotes', filters, properties, undefined, limit, after);
  }

  // ─── Properties ───

  async listProperties(objectType: string) {
    return this.request<any>(`/crm/v3/properties/${encodeURIComponent(objectType)}`);
  }

  async getProperty(objectType: string, propertyName: string) {
    return this.request<any>(
      `/crm/v3/properties/${encodeURIComponent(objectType)}/${encodeURIComponent(propertyName)}`
    );
  }

  // ─── Pipelines ───

  async listPipelines(objectType: string) {
    return this.request<any>(`/crm/v3/pipelines/${encodeURIComponent(objectType)}`);
  }

  async getPipeline(objectType: string, pipelineId: string) {
    return this.request<any>(
      `/crm/v3/pipelines/${encodeURIComponent(objectType)}/${encodeURIComponent(pipelineId)}`
    );
  }

  // ─── Owners ───

  async listOwners(params?: { limit?: number; after?: string; email?: string }) {
    return this.request<any>('/crm/v3/owners', { params });
  }

  async getOwner(ownerId: string) {
    return this.request<any>(`/crm/v3/owners/${encodeURIComponent(ownerId)}`);
  }

  // ─── Associations ───

  async createAssociation(
    fromObjectType: string, fromObjectId: string,
    toObjectType: string, toObjectId: string,
    associationTypeId: number
  ) {
    return this.request<any>(
      `/crm/v3/objects/${encodeURIComponent(fromObjectType)}/${encodeURIComponent(fromObjectId)}/associations/${encodeURIComponent(toObjectType)}/${encodeURIComponent(toObjectId)}/${associationTypeId}`,
      { method: 'PUT' }
    );
  }

  async deleteAssociation(
    fromObjectType: string, fromObjectId: string,
    toObjectType: string, toObjectId: string,
    associationTypeId: number
  ) {
    return this.request<any>(
      `/crm/v3/objects/${encodeURIComponent(fromObjectType)}/${encodeURIComponent(fromObjectId)}/associations/${encodeURIComponent(toObjectType)}/${encodeURIComponent(toObjectId)}/${associationTypeId}`,
      { method: 'DELETE' }
    );
  }

  async listAssociations(objectType: string, objectId: string, toObjectType: string) {
    return this.request<any>(
      `/crm/v3/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/associations/${encodeURIComponent(toObjectType)}`
    );
  }
}
