/**
 * Data Sources Module
 *
 * Central export point for all data source functionality.
 * Import adapters here to auto-register them.
 */

// Core types
export * from './types';

// Registry
export { adapterRegistry, registerAdapter, createDataSourceAdapter } from './registry';

// Import adapters to trigger registration
import './adapters/postgres';
import './adapters/bigquery';
import './adapters/google-sheets';
