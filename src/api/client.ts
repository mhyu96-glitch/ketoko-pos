import type { AuthResponse, ProductSyncResponse, SyncBatchPayload, SyncBatchResponse, Product } from '../types';
import { INITIAL_PRODUCTS, MOCK_USERS } from './mockData';

class ApiClient {
  public baseUrl = '/api/v1';
  private token: string | null = null;
  private serverProducts: Product[] = [...INITIAL_PRODUCTS];
  private serverTransactions: any[] = [];
  public isSimulatedOffline = false;

  constructor() {
    const savedToken = localStorage.getItem('ketoko_jwt_token');
    if (savedToken) {
      this.token = savedToken;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('ketoko_jwt_token', token);
    } else {
      localStorage.removeItem('ketoko_jwt_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async checkNetwork(): Promise<void> {
    if (this.isSimulatedOffline || !navigator.onLine) {
      throw new Error('Network unreachable (Offline mode active)');
    }
    // Simulate minor network latency (50-120ms)
    await new Promise((res) => setTimeout(res, 80));
  }

  // 2.1 Autentikasi Staf Kasir: POST /api/v1/auth/login
  async login(username: string, password: string): Promise<AuthResponse> {
    await this.checkNetwork();

    const mockAccount = MOCK_USERS[username];
    if (mockAccount && mockAccount.password === password) {
      const dummyJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIke21vY2tBY2NvdW50LnVzZXIuaWR9IiwibmFtZSI6IiR7bW9ja0FjY291bnQudXNlci5uYW1lfSIsInJvbGUiOiIke21vY2tBY2NvdW50LnVzZXIucm9sZX0iLCJicmFuY2hfaWQiOiIke21vY2tBY2NvdW50LnVzZXIuYnJhbmNoX2lkfSJ9.simulated_signature_${Date.now()}`;
      this.setToken(dummyJwt);
      return {
        status: 'success',
        data: {
          token: dummyJwt,
          user: mockAccount.user
        }
      };
    }

    return {
      status: 'error',
      message: 'Username atau password salah'
    };
  }

  // 2.2 Sync Katalog Produk: GET /api/v1/products/sync
  async getProductsSync(updatedAfter?: string): Promise<ProductSyncResponse> {
    await this.checkNetwork();

    let filtered = this.serverProducts;
    if (updatedAfter) {
      const dateLimit = new Date(updatedAfter).getTime();
      filtered = this.serverProducts.filter((p) => {
        if (!p.updated_at) return true;
        return new Date(p.updated_at).getTime() > dateLimit;
      });
    }

    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      data: filtered
    };
  }

  // 2.3 Sinkronisasi Transaksi Off-line (Batch Upload): POST /api/v1/sync/batch-transactions
  async syncBatchTransactions(payload: SyncBatchPayload): Promise<SyncBatchResponse> {
    await this.checkNetwork();

    if (!payload.transactions || payload.transactions.length === 0) {
      return {
        status: 'success',
        synced_ids: [],
        failed_ids: []
      };
    }

    const synced_ids: string[] = [];
    const failed_ids: string[] = [];

    for (const trx of payload.transactions) {
      try {
        // Save to mock cloud backend
        this.serverTransactions.push({
          ...trx,
          server_received_at: new Date().toISOString()
        });

        // Deduct server-side stock
        for (const item of trx.items) {
          const product = this.serverProducts.find((p) => p.id === item.product_id);
          if (product) {
            product.stock = Math.max(0, product.stock - item.qty);
          }
        }

        synced_ids.push(trx.id);
      } catch (err) {
        failed_ids.push(trx.id);
      }
    }

    return {
      status: failed_ids.length === 0 ? 'success' : 'partial',
      synced_ids,
      failed_ids
    };
  }

  getServerTransactionsCount() {
    return this.serverTransactions.length;
  }
}

export const api = new ApiClient();

