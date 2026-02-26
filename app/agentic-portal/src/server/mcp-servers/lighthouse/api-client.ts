const DEFAULT_BASE_URL = 'https://lighthouse.cantonloop.com/api';

export class LighthouseClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    params?: Record<string, string | number | undefined>,
    options?: { method?: string }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: options?.method || 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Lighthouse API Error ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
      return (await response.text()) as unknown as T;
    }

    return response.json();
  }

  async getStats(): Promise<any> {
    return this.request('/stats');
  }

  async listValidators(): Promise<any> {
    return this.request('/validators');
  }

  async getValidator(id: string): Promise<any> {
    return this.request(`/validators/${encodeURIComponent(id)}`);
  }

  async listTransfers(
    time_start?: string,
    time_end?: string,
    limit?: number,
    cursor?: number,
    direction?: string
  ): Promise<any> {
    return this.request('/transfers', { time_start, time_end, limit, cursor, direction });
  }

  async listTransactions(limit?: number, cursor?: string, direction?: string): Promise<any> {
    return this.request('/transactions', { limit, cursor, direction });
  }

  async getTransaction(updateId: string): Promise<any> {
    return this.request(`/transactions/${encodeURIComponent(updateId)}`);
  }

  async listGovernance(): Promise<any> {
    return this.request('/governance');
  }

  async getPartyBalance(id: string): Promise<any> {
    return this.request(`/parties/${encodeURIComponent(id)}/balance`);
  }

  async getGovernanceStats(): Promise<any> {
    return this.request('/governance/stats');
  }

  async getPrice(): Promise<any> {
    return this.request('/prices');
  }

  async search(q: string): Promise<any> {
    return this.request('/search', { q });
  }
}
