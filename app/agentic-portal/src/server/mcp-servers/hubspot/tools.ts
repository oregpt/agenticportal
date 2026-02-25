import { z } from 'zod';
import { HubSpotClient } from './api-client';

/**
 * HubSpot MCP Tool Definitions
 *
 * 52 tools covering: Contacts, Companies, Deals, Tickets,
 * Notes, Tasks, Calls, Meetings, Products, Line Items, Quotes,
 * Properties, Pipelines, Owners, Associations
 */

interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  handler: (client: HubSpotClient, args: any) => Promise<any>;
}

// Reusable pagination params
const paginationParams = {
  limit: z.number().optional().describe('max results (1-100)'),
  after: z.string().optional().describe('cursor for next page'),
};

// Reusable properties param
const propertiesParam = z.string().optional().describe('comma-separated property names to return');

// Reusable search filter
const searchFilterSchema = z.object({
  propertyName: z.string().describe('property to filter on'),
  operator: z.string().describe('EQ, NEQ, LT, LTE, GT, GTE, CONTAINS, etc.'),
  value: z.string().describe('filter value'),
});

// Reusable association for object creation
const associationSchema = z.object({
  to: z.object({ id: z.string().describe('target object ID') }),
  types: z.array(z.object({
    associationCategory: z.string().describe('HUBSPOT_DEFINED or USER_DEFINED'),
    associationTypeId: z.number().describe('association type ID'),
  })),
}).describe('association to link on creation');

export const tools: ToolDef[] = [
  // ─── Contacts (6) ───
  {
    name: 'contacts_list',
    description: 'List contacts with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listContacts(args),
  },
  {
    name: 'contact_get',
    description: 'Get a contact by ID',
    inputSchema: z.object({
      contactId: z.string().describe('contact ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getContact(args.contactId, args.properties),
  },
  {
    name: 'contact_create',
    description: 'Create a new contact',
    inputSchema: z.object({
      email: z.string().optional().describe('email address'),
      firstname: z.string().optional().describe('first name'),
      lastname: z.string().optional().describe('last name'),
      phone: z.string().optional().describe('phone number'),
      company: z.string().optional().describe('company name'),
      website: z.string().optional().describe('website URL'),
      lifecyclestage: z.string().optional().describe('lead, subscriber, etc.'),
    }),
    handler: async (client, args) => {
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createContact(properties);
    },
  },
  {
    name: 'contact_update',
    description: 'Update a contact by ID',
    inputSchema: z.object({
      contactId: z.string().describe('contact ID'),
      properties: z.record(z.string(), z.string()).describe('properties to update'),
    }),
    handler: async (client, args) => client.updateContact(args.contactId, args.properties),
  },
  {
    name: 'contact_delete',
    description: 'Delete a contact by ID',
    inputSchema: z.object({
      contactId: z.string().describe('contact ID'),
    }),
    handler: async (client, args) => client.deleteContact(args.contactId),
  },
  {
    name: 'contacts_search',
    description: 'Search contacts by filters',
    inputSchema: z.object({
      filters: z.array(searchFilterSchema).describe('search filters'),
      properties: z.array(z.string()).optional().describe('properties to return'),
      limit: z.number().optional().describe('max results (1-100)'),
    }),
    handler: async (client, args) => client.searchContacts(args.filters, args.properties, args.limit),
  },

  // ─── Companies (6) ───
  {
    name: 'companies_list',
    description: 'List companies with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listCompanies(args),
  },
  {
    name: 'company_get',
    description: 'Get a company by ID',
    inputSchema: z.object({
      companyId: z.string().describe('company ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getCompany(args.companyId, args.properties),
  },
  {
    name: 'company_create',
    description: 'Create a new company',
    inputSchema: z.object({
      name: z.string().describe('company name'),
      domain: z.string().optional().describe('company domain'),
      industry: z.string().optional().describe('industry'),
      phone: z.string().optional().describe('phone number'),
      city: z.string().optional().describe('city'),
      state: z.string().optional().describe('state/region'),
      country: z.string().optional().describe('country'),
    }),
    handler: async (client, args) => {
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createCompany(properties);
    },
  },
  {
    name: 'company_update',
    description: 'Update a company by ID',
    inputSchema: z.object({
      companyId: z.string().describe('company ID'),
      properties: z.record(z.string(), z.string()).describe('properties to update'),
    }),
    handler: async (client, args) => client.updateCompany(args.companyId, args.properties),
  },
  {
    name: 'company_delete',
    description: 'Delete a company by ID',
    inputSchema: z.object({
      companyId: z.string().describe('company ID'),
    }),
    handler: async (client, args) => client.deleteCompany(args.companyId),
  },
  {
    name: 'companies_search',
    description: 'Search companies by filters',
    inputSchema: z.object({
      filters: z.array(searchFilterSchema).describe('search filters'),
      properties: z.array(z.string()).optional().describe('properties to return'),
      limit: z.number().optional().describe('max results (1-100)'),
    }),
    handler: async (client, args) => client.searchCompanies(args.filters, args.properties, args.limit),
  },

  // ─── Deals (6) ───
  {
    name: 'deals_list',
    description: 'List deals with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listDeals(args),
  },
  {
    name: 'deal_get',
    description: 'Get a deal by ID',
    inputSchema: z.object({
      dealId: z.string().describe('deal ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getDeal(args.dealId, args.properties),
  },
  {
    name: 'deal_create',
    description: 'Create a new deal',
    inputSchema: z.object({
      dealname: z.string().describe('deal name'),
      pipeline: z.string().optional().describe('pipeline ID'),
      dealstage: z.string().optional().describe('deal stage ID'),
      amount: z.string().optional().describe('deal amount'),
      closedate: z.string().optional().describe('close date (ISO 8601)'),
      hubspot_owner_id: z.string().optional().describe('owner ID'),
      associations: z.array(associationSchema).optional().describe('linked records'),
    }),
    handler: async (client, args) => {
      const { associations, ...rest } = args;
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createDeal(properties, associations);
    },
  },
  {
    name: 'deal_update',
    description: 'Update a deal by ID',
    inputSchema: z.object({
      dealId: z.string().describe('deal ID'),
      properties: z.record(z.string(), z.string()).describe('properties to update'),
    }),
    handler: async (client, args) => client.updateDeal(args.dealId, args.properties),
  },
  {
    name: 'deal_delete',
    description: 'Delete a deal by ID',
    inputSchema: z.object({
      dealId: z.string().describe('deal ID'),
    }),
    handler: async (client, args) => client.deleteDeal(args.dealId),
  },
  {
    name: 'deals_search',
    description: 'Search deals by filters',
    inputSchema: z.object({
      filters: z.array(searchFilterSchema).describe('search filters'),
      properties: z.array(z.string()).optional().describe('properties to return'),
      limit: z.number().optional().describe('max results (1-100)'),
    }),
    handler: async (client, args) => client.searchDeals(args.filters, args.properties, args.limit),
  },

  // ─── Tickets (6) ───
  {
    name: 'tickets_list',
    description: 'List tickets with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listTickets(args),
  },
  {
    name: 'ticket_get',
    description: 'Get a ticket by ID',
    inputSchema: z.object({
      ticketId: z.string().describe('ticket ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getTicket(args.ticketId, args.properties),
  },
  {
    name: 'ticket_create',
    description: 'Create a new support ticket',
    inputSchema: z.object({
      subject: z.string().describe('ticket subject'),
      hs_pipeline: z.string().optional().describe('pipeline ID'),
      hs_pipeline_stage: z.string().optional().describe('pipeline stage ID'),
      hs_ticket_priority: z.string().optional().describe('HIGH, MEDIUM, LOW'),
      content: z.string().optional().describe('ticket description'),
      hubspot_owner_id: z.string().optional().describe('owner ID'),
    }),
    handler: async (client, args) => {
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createTicket(properties);
    },
  },
  {
    name: 'ticket_update',
    description: 'Update a ticket by ID',
    inputSchema: z.object({
      ticketId: z.string().describe('ticket ID'),
      properties: z.record(z.string(), z.string()).describe('properties to update'),
    }),
    handler: async (client, args) => client.updateTicket(args.ticketId, args.properties),
  },
  {
    name: 'ticket_delete',
    description: 'Delete a ticket by ID',
    inputSchema: z.object({
      ticketId: z.string().describe('ticket ID'),
    }),
    handler: async (client, args) => client.deleteTicket(args.ticketId),
  },
  {
    name: 'tickets_search',
    description: 'Search tickets by filters',
    inputSchema: z.object({
      filters: z.array(searchFilterSchema).describe('search filters'),
      properties: z.array(z.string()).optional().describe('properties to return'),
      limit: z.number().optional().describe('max results (1-100)'),
    }),
    handler: async (client, args) => client.searchTickets(args.filters, args.properties, args.limit),
  },

  // ─── Notes (3) ───
  {
    name: 'notes_list',
    description: 'List notes with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listNotes(args),
  },
  {
    name: 'note_get',
    description: 'Get a note by ID',
    inputSchema: z.object({
      noteId: z.string().describe('note ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getNote(args.noteId, args.properties),
  },
  {
    name: 'note_create',
    description: 'Create a note on a CRM record',
    inputSchema: z.object({
      hs_note_body: z.string().describe('note body (HTML supported)'),
      hs_timestamp: z.string().optional().describe('timestamp (ISO 8601)'),
      associations: z.array(associationSchema).optional().describe('linked records'),
    }),
    handler: async (client, args) => {
      const { associations, ...rest } = args;
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createNote(properties, associations);
    },
  },

  // ─── Tasks (3) ───
  {
    name: 'tasks_list',
    description: 'List tasks with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listTasks(args),
  },
  {
    name: 'task_get',
    description: 'Get a task by ID',
    inputSchema: z.object({
      taskId: z.string().describe('task ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getTask(args.taskId, args.properties),
  },
  {
    name: 'task_create',
    description: 'Create a CRM task',
    inputSchema: z.object({
      hs_task_subject: z.string().describe('task subject'),
      hs_task_body: z.string().optional().describe('task description'),
      hs_task_status: z.string().optional().describe('NOT_STARTED, IN_PROGRESS, COMPLETED'),
      hs_task_priority: z.string().optional().describe('HIGH, MEDIUM, LOW'),
      hs_timestamp: z.string().optional().describe('due date (ISO 8601)'),
      hubspot_owner_id: z.string().optional().describe('assigned owner ID'),
      associations: z.array(associationSchema).optional().describe('linked records'),
    }),
    handler: async (client, args) => {
      const { associations, ...rest } = args;
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createTask(properties, associations);
    },
  },

  // ─── Calls (3) ───
  {
    name: 'calls_list',
    description: 'List call records with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listCalls(args),
  },
  {
    name: 'call_get',
    description: 'Get a call record by ID',
    inputSchema: z.object({
      callId: z.string().describe('call ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getCall(args.callId, args.properties),
  },
  {
    name: 'call_create',
    description: 'Log a call in CRM',
    inputSchema: z.object({
      hs_call_title: z.string().optional().describe('call title'),
      hs_call_body: z.string().optional().describe('call notes'),
      hs_call_direction: z.string().optional().describe('INBOUND or OUTBOUND'),
      hs_call_status: z.string().optional().describe('COMPLETED, BUSY, NO_ANSWER, etc.'),
      hs_call_duration: z.string().optional().describe('duration in milliseconds'),
      hs_timestamp: z.string().optional().describe('call time (ISO 8601)'),
      associations: z.array(associationSchema).optional().describe('linked records'),
    }),
    handler: async (client, args) => {
      const { associations, ...rest } = args;
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createCall(properties, associations);
    },
  },

  // ─── Meetings (3) ───
  {
    name: 'meetings_list',
    description: 'List meeting records with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listMeetings(args),
  },
  {
    name: 'meeting_get',
    description: 'Get a meeting by ID',
    inputSchema: z.object({
      meetingId: z.string().describe('meeting ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getMeeting(args.meetingId, args.properties),
  },
  {
    name: 'meeting_create',
    description: 'Log a meeting in CRM',
    inputSchema: z.object({
      hs_meeting_title: z.string().optional().describe('meeting title'),
      hs_meeting_body: z.string().optional().describe('meeting notes'),
      hs_meeting_start_time: z.string().optional().describe('start time (ISO 8601)'),
      hs_meeting_end_time: z.string().optional().describe('end time (ISO 8601)'),
      hs_meeting_outcome: z.string().optional().describe('SCHEDULED, COMPLETED, etc.'),
      hubspot_owner_id: z.string().optional().describe('owner ID'),
      associations: z.array(associationSchema).optional().describe('linked records'),
    }),
    handler: async (client, args) => {
      const { associations, ...rest } = args;
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createMeeting(properties, associations);
    },
  },

  // ─── Products (4) ───
  {
    name: 'products_list',
    description: 'List products in catalog',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listProducts(args),
  },
  {
    name: 'product_get',
    description: 'Get a product by ID',
    inputSchema: z.object({
      productId: z.string().describe('product ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getProduct(args.productId, args.properties),
  },
  {
    name: 'product_create',
    description: 'Create a product in catalog',
    inputSchema: z.object({
      name: z.string().describe('product name'),
      price: z.string().optional().describe('unit price'),
      description: z.string().optional().describe('product description'),
      hs_sku: z.string().optional().describe('SKU'),
      hs_cost_of_goods_sold: z.string().optional().describe('COGS amount'),
      hs_recurring_billing_period: z.string().optional().describe('P1M, P1Y, etc.'),
    }),
    handler: async (client, args) => {
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createProduct(properties);
    },
  },
  {
    name: 'product_update',
    description: 'Update a product by ID',
    inputSchema: z.object({
      productId: z.string().describe('product ID'),
      properties: z.record(z.string(), z.string()).describe('properties to update'),
    }),
    handler: async (client, args) => client.updateProduct(args.productId, args.properties),
  },

  // ─── Line Items (4) ───
  {
    name: 'line_items_list',
    description: 'List line items with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listLineItems(args),
  },
  {
    name: 'line_item_get',
    description: 'Get a line item by ID',
    inputSchema: z.object({
      lineItemId: z.string().describe('line item ID'),
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.getLineItem(args.lineItemId, args.properties),
  },
  {
    name: 'line_item_create',
    description: 'Create a line item',
    inputSchema: z.object({
      name: z.string().describe('line item name'),
      price: z.string().optional().describe('unit price'),
      quantity: z.string().optional().describe('quantity'),
      hs_product_id: z.string().optional().describe('source product ID'),
      associations: z.array(associationSchema).optional().describe('linked deal/quote'),
    }),
    handler: async (client, args) => {
      const { associations, ...rest } = args;
      const properties: Record<string, any> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) properties[k] = v;
      }
      return client.createLineItem(properties, associations);
    },
  },
  {
    name: 'line_item_update',
    description: 'Update a line item by ID',
    inputSchema: z.object({
      lineItemId: z.string().describe('line item ID'),
      properties: z.record(z.string(), z.string()).describe('properties to update'),
    }),
    handler: async (client, args) => client.updateLineItem(args.lineItemId, args.properties),
  },

  // ─── Quotes (3) ───
  {
    name: 'quotes_list',
    description: 'List quotes with pagination',
    inputSchema: z.object({
      ...paginationParams,
      properties: propertiesParam,
    }),
    handler: async (client, args) => client.listQuotes(args),
  },
  {
    name: 'quote_get',
    description: 'Get a quote by ID',
    inputSchema: z.object({
      quoteId: z.string().describe('quote ID'),
      properties: propertiesParam,
      associations: z.string().optional().describe('associated objects to include'),
    }),
    handler: async (client, args) => client.getQuote(args.quoteId, args.properties, args.associations),
  },
  {
    name: 'quotes_search',
    description: 'Search quotes by filters',
    inputSchema: z.object({
      filters: z.array(searchFilterSchema).describe('search filters'),
      properties: z.array(z.string()).optional().describe('properties to return'),
      limit: z.number().optional().describe('max results (1-100)'),
    }),
    handler: async (client, args) => client.searchQuotes(args.filters, args.properties, args.limit),
  },

  // ─── Properties (2) ───
  {
    name: 'properties_list',
    description: 'List all properties for an object type',
    inputSchema: z.object({
      objectType: z.string().describe('contacts, companies, deals, tickets, etc.'),
    }),
    handler: async (client, args) => client.listProperties(args.objectType),
  },
  {
    name: 'property_get',
    description: 'Get a property definition',
    inputSchema: z.object({
      objectType: z.string().describe('contacts, companies, deals, tickets, etc.'),
      propertyName: z.string().describe('property internal name'),
    }),
    handler: async (client, args) => client.getProperty(args.objectType, args.propertyName),
  },

  // ─── Pipelines (2) ───
  {
    name: 'pipelines_list',
    description: 'List pipelines for an object type',
    inputSchema: z.object({
      objectType: z.string().describe('deals or tickets'),
    }),
    handler: async (client, args) => client.listPipelines(args.objectType),
  },
  {
    name: 'pipeline_get',
    description: 'Get a pipeline with its stages',
    inputSchema: z.object({
      objectType: z.string().describe('deals or tickets'),
      pipelineId: z.string().describe('pipeline ID'),
    }),
    handler: async (client, args) => client.getPipeline(args.objectType, args.pipelineId),
  },

  // ─── Owners (2) ───
  {
    name: 'owners_list',
    description: 'List CRM owners (users)',
    inputSchema: z.object({
      limit: z.number().optional().describe('max results'),
      after: z.string().optional().describe('cursor for next page'),
      email: z.string().optional().describe('filter by email'),
    }),
    handler: async (client, args) => client.listOwners(args),
  },
  {
    name: 'owner_get',
    description: 'Get an owner by ID',
    inputSchema: z.object({
      ownerId: z.string().describe('owner ID'),
    }),
    handler: async (client, args) => client.getOwner(args.ownerId),
  },

  // ─── Associations (3) ───
  {
    name: 'associations_list',
    description: 'List associations for an object',
    inputSchema: z.object({
      objectType: z.string().describe('source object type (contacts, deals, etc.)'),
      objectId: z.string().describe('source object ID'),
      toObjectType: z.string().describe('target object type'),
    }),
    handler: async (client, args) =>
      client.listAssociations(args.objectType, args.objectId, args.toObjectType),
  },
  {
    name: 'association_create',
    description: 'Associate two CRM objects',
    inputSchema: z.object({
      fromObjectType: z.string().describe('source type (contacts, deals, etc.)'),
      fromObjectId: z.string().describe('source object ID'),
      toObjectType: z.string().describe('target type'),
      toObjectId: z.string().describe('target object ID'),
      associationTypeId: z.number().describe('association type ID'),
    }),
    handler: async (client, args) =>
      client.createAssociation(args.fromObjectType, args.fromObjectId, args.toObjectType, args.toObjectId, args.associationTypeId),
  },
  {
    name: 'association_delete',
    description: 'Remove association between objects',
    inputSchema: z.object({
      fromObjectType: z.string().describe('source type (contacts, deals, etc.)'),
      fromObjectId: z.string().describe('source object ID'),
      toObjectType: z.string().describe('target type'),
      toObjectId: z.string().describe('target object ID'),
      associationTypeId: z.number().describe('association type ID'),
    }),
    handler: async (client, args) =>
      client.deleteAssociation(args.fromObjectType, args.fromObjectId, args.toObjectType, args.toObjectId, args.associationTypeId),
  },
];
