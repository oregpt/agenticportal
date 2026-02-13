/**
 * Data Source Adapter Registry
 *
 * Central registry for data source adapters. New data source types
 * can be added by registering their factory function.
 *
 * This allows the system to be extended without modifying core code.
 */

import type {
  DataSourceType,
  DataSourceConfig,
  DataSourceAdapter,
  AdapterFactory,
} from './types';

class AdapterRegistry {
  private factories = new Map<DataSourceType, AdapterFactory>();

  /**
   * Register a new adapter factory
   */
  register(type: DataSourceType, factory: AdapterFactory): void {
    if (this.factories.has(type)) {
      console.warn(`Overwriting existing adapter factory for type: ${type}`);
    }
    this.factories.set(type, factory);
  }

  /**
   * Create an adapter instance from config
   */
  async createAdapter(config: DataSourceConfig): Promise<DataSourceAdapter> {
    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new Error(`No adapter registered for data source type: ${config.type}`);
    }
    return factory(config);
  }

  /**
   * Check if an adapter type is registered
   */
  hasAdapter(type: DataSourceType): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered adapter types
   */
  getRegisteredTypes(): DataSourceType[] {
    return Array.from(this.factories.keys());
  }
}

// Singleton instance
export const adapterRegistry = new AdapterRegistry();

/**
 * Helper to register an adapter
 */
export function registerAdapter(type: DataSourceType, factory: AdapterFactory): void {
  adapterRegistry.register(type, factory);
}

/**
 * Helper to create an adapter from config
 */
export async function createDataSourceAdapter(
  config: DataSourceConfig
): Promise<DataSourceAdapter> {
  return adapterRegistry.createAdapter(config);
}
