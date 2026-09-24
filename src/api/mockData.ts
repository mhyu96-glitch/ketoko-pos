import type { Product, User } from '../types';

export const MOCK_USERS: Record<string, { password: string; user: User }> = {
  suciawati: {
    password: 'admin123',
    user: {
      id: 'usr_001',
      name: 'suciawati Ramadhani',
      role: 'ADMIN',
      branch_id: 'BR-01'
    }
  },
  admin: {
    password: 'admin123',
    user: {
      id: 'usr_001',
      name: 'suciawati Ramadhani',
      role: 'ADMIN',
      branch_id: 'BR-01'
    }
  },
  noor: {
    password: 'kasir123',
    user: {
      id: 'usr_002',
      name: 'Noor Afifah',
      role: 'CASHIER',
      branch_id: 'BR-01'
    }
  },
  kasir: {
    password: 'kasir123',
    user: {
      id: 'usr_002',
      name: 'Noor Afifah',
      role: 'CASHIER',
      branch_id: 'BR-01'
    }
  },
  // Legacy aliases
  admin_pusat: {
    password: 'AdminPassword123',
    user: {
      id: 'usr_001',
      name: 'suciawati Ramadhani',
      role: 'ADMIN',
      branch_id: 'BR-01'
    }
  },
  kasir_toko1: {
    password: 'SecretPassword123',
    user: {
      id: 'usr_002',
      name: 'Noor Afifah',
      role: 'CASHIER',
      branch_id: 'BR-01'
    }
  }
};

// Clean 0-Data initial states for new stores
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_TRANSACTIONS: any[] = [];
export const INITIAL_CUSTOMERS: any[] = [];
export const INITIAL_SUPPLIERS: any[] = [];
export const INITIAL_DEBTS: any[] = [];
export const INITIAL_RECEIVABLES: any[] = [];
export const INITIAL_PURCHASES: any[] = [];
export const INITIAL_STOCK_MOVEMENTS: any[] = [];

export const DEFAULT_STORE_PROFILE = {
  name: 'CV. Tumbuh Makmur Air Conindo',
  tagline: 'Solusi Pendingin Ruangan & AC Terpercaya',
  address: 'Jl. P Antasari No.106, Air Putih, Kec. Samarinda Ulu, Kota Samarinda, Kalimantan Timur 75243',
  city: 'Samarinda',
  phone: '0811 5121 215',
  npwp: '00.000.000.0-000.000',
  footer_message: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar atau dikembalikan.',
  logo_base64: ''
};
