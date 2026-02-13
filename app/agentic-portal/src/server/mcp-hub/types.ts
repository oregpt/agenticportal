/**
 * MCP Hub Type Definitions
 *
 * Core interfaces for the MCP (Model Context Protocol) Hub system
 */

import { z } from 'zod';

// ============================================================================
// MCP Tool Context — passed through the execution chain for per-agent isolation
// ============================================================================

export interface MCPToolContext {
  agentId?: string;
}

// ============================================================================
// MCP Server Interface
// ============================================================================

export interface MCPServerInstance {
  name: string;
  version: string;
  description: string;
  tools: MCPTool[];
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  executeTool(name: string, args: any, context?: MCPToolContext): Promise<MCPResponse>;
  listTools(): Promise<MCPTool[]>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    server?: string;
    tool?: string;
    executionTime?: number;
    // Allow additional custom metadata
    [key: string]: any;
  };
}

// ============================================================================
// Hub Configuration
// ============================================================================

export interface HubConfig {
  name: string;
  version: string;
  maxConcurrentActions?: number;
  defaultTimeout?: number;
}

// ============================================================================
// Action Types
// ============================================================================

export interface ActionRequest {
  server: string;
  tool: string;
  arguments: any;
}

export interface ActionResult {
  server: string;
  tool: string;
  arguments: any;
  response: MCPResponse;
  success: boolean;
}

// ============================================================================
// Hub Events
// ============================================================================

export interface HubEvent {
  type: 'server.registered' | 'server.error' | 'tool.called' | 'tool.completed';
  timestamp: Date;
  server: string;
  tool?: string;
  data?: any;
  error?: string;
}
