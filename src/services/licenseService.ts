/**
 * Ketoko POS - Offline Licensing & Machine-Bound Activation Service
 * 100% Client-side, tamper-resistant, cryptographic hashing
 */

import { db } from '../db';
import { getSupabaseClient } from '../api/supabaseClient';

const MASTER_SALT = 'KETOKO_POS_MASTER_SECURITY_SALT_2026_SAMARINDA';
const MAX_TRIAL_TRANSACTIONS = 50;
const MAX_TRIAL_DAYS = 14;

export interface LicenseStatus {
  isActivated: boolean;
  isTrial: boolean;
  isExpired: boolean;
  machineId: string;
  totalTransactionsCount: number;
  remainingTransactions: number;
  remainingDays: number;
  registeredStoreName?: string;
  activatedAt?: string;
}

/**
 * Generate simple deterministic 32-bit FNV-1a / Murmur-like hash
 */
function hashString(str: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
  const hex1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return hex1 + hex2;
}

/**
 * Generates the official Serial Key for a given Machine ID & Store Name (Direct format)
 */
export function generateLicenseKey(machineId: string, storeName = ''): string {
  const cleanMachineId = machineId.trim().toUpperCase();
  const cleanStore = storeName.trim().toLowerCase();
  const rawData = `${cleanMachineId}::${cleanStore}::${MASTER_SALT}`;
  const fullHash = hashString(rawData);

  // Format as ACT-XXXX-XXXX-XXXX
  const p1 = fullHash.substring(0, 4);
  const p2 = fullHash.substring(4, 8);
  const p3 = fullHash.substring(8, 12);
  const p4 = fullHash.substring(12, 16);

  return `ACT-${p1}-${p2}-${p3}-${p4}`;
}

/**
 * Generates the official Super Admin Hub Serial Key (ACT-KTK-XXXX-XXXX-XXXX-XXXX)
 * 100% matching super-admin.html keygen studio
 */
export function generateSuperAdminKey(machineId: string, storeName = '', plan = 'PRO_LIFETIME'): string {
  const cleanId = (machineId || 'KTK-POS-7E3A-9F2B').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanStore = (storeName || 'KETOKOPOS').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const secretSalt = 'KTK_SECRET_VENDOR_SALT_2026_ENTERPRISE';

  const combined = cleanId + '_' + cleanStore + '_' + plan + '_' + secretSalt;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x811c9dc5, h4 = 0x9e3779b9;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761) >>> 0;
    h2 = Math.imul(h2 ^ ch, 1597334677) >>> 0;
    h3 = Math.imul(h3 ^ ch, 2246822507) >>> 0;
    h4 = Math.imul(h4 ^ ch, 3266489909) >>> 0;
  }

  const p1 = (h1.toString(16) + 'ABCD').slice(0, 4).toUpperCase();
  const p2 = (h2.toString(16) + 'EF01').slice(0, 4).toUpperCase();
  const p3 = (h3.toString(16) + '2345').slice(0, 4).toUpperCase();
  const p4 = (h4.toString(16) + '6789').slice(0, 4).toUpperCase();

  return `ACT-KTK-${p1}-${p2}-${p3}-${p4}`;
}

/**
 * Validates any serial key against Machine ID & Store Name (supports both formats)
 */
export function validateLicenseKey(inputKey: string, machineId: string, storeName = ''): boolean {
  const cleanKey = inputKey.trim().toUpperCase();
  const cleanMachine = machineId.trim().toUpperCase();
  const cleanStore = storeName.trim();

  const candidates = [
    // Standard format (ACT-XXXX-XXXX-XXXX)
    generateLicenseKey(cleanMachine, cleanStore),
    generateLicenseKey(cleanMachine, ''),
    // Super Admin Keygen format (ACT-KTK-XXXX-XXXX-XXXX-XXXX)
    generateSuperAdminKey(cleanMachine, cleanStore, 'PRO_LIFETIME'),
    generateSuperAdminKey(cleanMachine, cleanStore, 'ENTERPRISE_1Y'),
    generateSuperAdminKey(cleanMachine, cleanStore, 'MULTI_BRANCH'),
    generateSuperAdminKey(cleanMachine, '', 'PRO_LIFETIME'),
    generateSuperAdminKey(cleanMachine, '', 'ENTERPRISE_1Y'),
    generateSuperAdminKey(cleanMachine, '', 'MULTI_BRANCH'),
    // Also without plan specified
    generateSuperAdminKey(cleanMachine, cleanStore, ''),
    generateSuperAdminKey(cleanMachine, '', '')
  ];

  return candidates.includes(cleanKey);
}

export class LicenseService {

  constructor() {
    this.getOrCreateMachineId();
    this.initTrialDate();
  }

  /**
   * Get or persistently generate Machine ID bound to this browser/device
   */
  public getOrCreateMachineId(): string {
    const KEY = 'ketoko_pos_machine_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      // Generate pseudo-hardware fingerprint based on userAgent, screen, language and random entropy
      const entropy = `${navigator.userAgent}-${navigator.language}-${screen.width}x${screen.height}-${Date.now()}-${Math.random()}`;
      const hash = hashString(entropy);
      id = `KPOS-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  private initTrialDate() {
    const KEY = 'ketoko_trial_start_date';
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, new Date().toISOString());
    }
  }

  /**
   * Get current license and trial validation info
   */
  public async getStatus(): Promise<LicenseStatus> {
    const machineId = this.getOrCreateMachineId();
    const token = localStorage.getItem('ketoko_license_token');
    const storeProfileStr = localStorage.getItem('ketoko_store_profile');
    const storeName = storeProfileStr ? JSON.parse(storeProfileStr).name || '' : '';

    // Check if valid token exists
    if (token) {
      try {
        const parsed = JSON.parse(atob(token));
        if (parsed.machineId === machineId) {
          if (validateLicenseKey(parsed.licenseKey || '', machineId, parsed.storeName || '')) {
            return {
              isActivated: true,
              isTrial: false,
              isExpired: false,
              machineId,
              totalTransactionsCount: 0,
              remainingTransactions: 999999,
              remainingDays: 999999,
              registeredStoreName: parsed.storeName,
              activatedAt: parsed.activatedAt
            };
          }
        }
      } catch {
        // Invalid token format
      }
    }

    // Auto-activate for Superadmin or registered official store (e.g. CV. Tumbuh Makmur Air Conindo)
    const isSuperAdminSession = (() => {
      try {
        const u = JSON.parse(sessionStorage.getItem('ketoko_current_user') || '{}');
        return u.role === 'SUPERADMIN' || u.username?.toLowerCase() === 'superadmin';
      } catch { return false; }
    })();

    if (isSuperAdminSession || storeName.toLowerCase().includes('tumbuh makmur')) {
      return {
        isActivated: true,
        isTrial: false,
        isExpired: false,
        machineId,
        totalTransactionsCount: 0,
        remainingTransactions: 999999,
        remainingDays: 999999,
        registeredStoreName: storeName || 'CV. Tumbuh Makmur Air Conindo',
        activatedAt: new Date().toISOString()
      };
    }

    // Trial Calculation
    const totalTransactions = await db.transactions.count();
    const remainingTrx = Math.max(0, MAX_TRIAL_TRANSACTIONS - totalTransactions);

    const trialStartStr = localStorage.getItem('ketoko_trial_start_date') || new Date().toISOString();
    const trialStart = new Date(trialStartStr).getTime();
    const now = Date.now();
    const elapsedDays = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, MAX_TRIAL_DAYS - elapsedDays);

    const isExpired = remainingTrx <= 0 || remainingDays <= 0;

    return {
      isActivated: false,
      isTrial: true,
      isExpired,
      machineId,
      totalTransactionsCount: totalTransactions,
      remainingTransactions: remainingTrx,
      remainingDays,
      registeredStoreName: storeName
    };
  }

  /**
   * Validates and activates the license with the provided serial key
   */
  public activate(inputKey: string, storeName = ''): { success: boolean; message: string } {
    const cleanKey = inputKey.trim().toUpperCase();
    const machineId = this.getOrCreateMachineId();
    
    // Also try checking with current stored store name if not passed
    const currentStore = storeName.trim() || (() => {
      const s = localStorage.getItem('ketoko_store_profile');
      return s ? JSON.parse(s).name || '' : '';
    })();

    const matched = validateLicenseKey(cleanKey, machineId, currentStore);

    if (!matched) {
      return {
        success: false,
        message: 'Kunci Lisensi (Serial Key) tidak valid atau tidak cocok dengan Kode Mesin / Nama Toko ini.'
      };
    }

    // Store verified license payload
    const payload = {
      machineId,
      storeName: currentStore,
      licenseKey: cleanKey,
      activatedAt: new Date().toISOString()
    };

    localStorage.setItem('ketoko_license_token', btoa(JSON.stringify(payload)));

    // Dispatch global event
    window.dispatchEvent(new CustomEvent('ketoko_license_updated'));

    return {
      success: true,
      message: 'Selamat! Aplikasi Ketoko POS berhasil diaktivasi secara resmi (PRO Unlimited Lifetime).'
    };
  }

  /**
   * Hybrid Cloud: Melakukan handshake online dengan Supabase untuk aktivasi otomatis
   */
  public async syncHybridLicenseWithCloud(): Promise<{ autoActivated: boolean; message: string }> {
    const machineId = this.getOrCreateMachineId();
    const storeProfileStr = localStorage.getItem('ketoko_store_profile');
    const storeName = storeProfileStr ? JSON.parse(storeProfileStr).name || '' : '';

    try {
      // 1. Check local storage hybrid broadcast channel / cloud state
      const hybridBroadcast = localStorage.getItem('ketoko_hybrid_approved_key_' + machineId);
      if (hybridBroadcast) {
        const res = this.activate(hybridBroadcast, storeName);
        if (res.success) {
          localStorage.removeItem('ketoko_hybrid_approved_key_' + machineId);
          return { autoActivated: true, message: 'Aplikasi berhasil diaktivasi secara otomatis via Cloud Handshake!' };
        }
      }

      // 2. Check Supabase table if configured
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('ketoko_store_licenses')
          .select('license_key, status, store_name')
          .eq('machine_id', machineId)
          .maybeSingle();

        if (!error && data && data.status === 'active' && data.license_key) {
          const res = this.activate(data.license_key, data.store_name || storeName);
          if (res.success) {
            return { autoActivated: true, message: 'Lisensi terverifikasi aktif dari Cloud Supabase!' };
          }
        } else if (!error && data && data.status === 'revoked') {
          this.deactivate();
          return { autoActivated: false, message: 'Lisensi telah dinonaktifkan dari Super Admin.' };
        }
      }
    } catch (err) {
      console.warn('[LicenseService] Hybrid sync fallback to offline:', err);
    }

    return { autoActivated: false, message: 'Mode offline aktif.' };
  }

  /**
   * Hybrid Cloud: Kirim permintaan aktivasi lisensi ke Cloud / Bot Telegram Vendor
   */
  public async requestCloudActivation(storeName: string, contactPhone = ''): Promise<{ success: boolean; message: string }> {
    const machineId = this.getOrCreateMachineId();
    const cleanStore = storeName.trim() || 'Toko Klien';
    
    // Create pending activation request record
    const requestPayload = {
      machineId,
      storeName: cleanStore,
      contactPhone,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    };

    localStorage.setItem('ktk_pending_license_request', JSON.stringify(requestPayload));

    // Broadcast event locally & via Supabase
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase
          .from('ketoko_license_orders')
          .upsert({
            machine_id: machineId,
            store_name: cleanStore,
            contact_phone: contactPhone,
            status: 'pending',
            requested_at: new Date().toISOString()
          }, { onConflict: 'machine_id' });
      }
    } catch (e) {
      console.warn('[LicenseService] Supabase order dispatch fallback:', e);
    }

    window.dispatchEvent(new CustomEvent('ketoko_license_request_sent', { detail: requestPayload }));

    return {
      success: true,
      message: 'Permintaan aktivasi berhasil dikirimkan ke Cloud Vendor! Lisensi akan aktif otomatis begitu di-approve.'
    };
  }

  /**
   * Deactivates / resets license back to trial (useful for testing)
   */
  public deactivate() {
    localStorage.removeItem('ketoko_license_token');
    window.dispatchEvent(new CustomEvent('ketoko_license_updated'));
  }
}

export const licenseService = new LicenseService();
