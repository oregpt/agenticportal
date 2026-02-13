/**
 * Memory Module — Barrel File
 *
 * Re-exports everything from the memory subsystem for convenient imports.
 */

// Document CRUD + semantic search
export {
  getDocument,
  upsertDocument,
  listDocuments,
  deleteDocument,
  searchMemory,
  createDefaultDocuments,
} from './documentService';
export type { AgentDocument, MemorySearchResult } from './documentService';

// Default templates (soul, memory, context)
export {
  getDefaultSoul,
  getDefaultMemory,
  getDefaultContext,
  DEFAULT_DOCUMENTS,
} from './defaults';

// Memory tools for LLM
export {
  MEMORY_TOOLS,
  MEMORY_TOOL_PREFIX,
  isMemoryTool,
  executeMemoryTool,
} from './memoryTools';

// Embedding engine
export {
  embedDocument,
  removeDocumentEmbeddings,
  chunkDocument,
} from './memoryEmbedder';
export type { DocumentChunk } from './memoryEmbedder';
