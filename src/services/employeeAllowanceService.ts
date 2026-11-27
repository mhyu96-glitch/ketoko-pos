import { db } from '../db';
import type { Customer, MemberDepositMutation, Transaction } from '../types';
import { lanService } from './lanService';
import { syncService } from './syncService';
import { formatRupiah } from './escposService';
import { filterCustomersForStore, getCurrentActiveStoreId, clampEmployeeAllowance, clampEmployeeBalance, parseEmployeeMeta } from '../utils/customerAccess';

export interface EmployeeMonthTrx {
  receipt_number: string;
  created_at: string;
  grand_total: number;
  store_id: string;
  payment_method?: string;
  items: string;
}

export interface EmployeeAllowanceRecord {
  id: string;
  customer_id: string;
  code: string;
  name: string;
  phone: string;
  store_id: string;
  store_name: string;
  afdeling?: string;
  unit?: string;
  job_title?: string;
  last_purchase_date?: string;
  last_purchase_total?: number;
  last_purchase_items?: string;
  month_transactions?: EmployeeMonthTrx[];
  monthly_allowance: number;
  allowance: number;
  deposit_balance: number;
  remaining_balance: number;
  spent_this_month: number;
  spent: number;
  trx_count_this_month: number;
  cash_spent_this_month: number;
  cash_spent: number;
  cash_trx_count_this_month: number;
  utilization_percent: number;
  status: 'ACTIVE' | 'EXHAUSTED';
  last_allowance_reset: string;
  last_reset: string;
  updated_at: string;
}

export interface AfdelingAllowanceSummary {
  afdeling: string;
  unit: string;
  totalEmployees: number;
  totalAllowance: number;
  totalSpent: number;
  totalCashSpent: number;
  totalRemaining: number;
  utilizationRate: number;
}

export interface EmployeeAllowanceReportSummary {
  monthKey: string;
  monthFormatted: string;
  period_name: string;
  totalEmployees: number;
  totalAllowance: number;
  totalSpent: number;
  totalCashSpent: number;
  totalRemaining: number;
  overallUtilization: number;
  employees: EmployeeAllowanceRecord[];
  afdelingSummary: AfdelingAllowanceSummary[];
  summary: {
    total_employees: number;
    total_allowance: number;
    total_allowance_budget: number;
    total_spent: number;
    total_cash_spent: number;
    cash_shopper_count: number;
    total_remaining_balance: number;
    utilization_rate: number;
    active_count: number;
    exhausted_count: number;
  };
}

export type EmployeeAllowanceReport = EmployeeAllowanceReportSummary;

export class EmployeeAllowanceService {
  /**
   * Format bulan sekarang (YYYY-MM), misal "2026-11"
   */
  public getCurrentMonthKey(): string {
    return new Date().toISOString().slice(0, 7);
  }

  /**
   * Format nama bulan ramah pengguna (misal "November 2026")
   */
  public formatMonthLabel(monthKey: string): string {
    try {
      const [y, m] = monthKey.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } catch {
      return monthKey;
    }
  }

  /**
   * Pengecekan dan eksekusi Otomatis Reset Saldo Karyawan Bulanan saat aplikasi dibuka
   */
  public async checkAndAutoResetMonthlyAllowance(targetStoreId?: string): Promise<number> {
    try {
      const currentMonth = this.getCurrentMonthKey();
      const activeStoreId = targetStoreId || getCurrentActiveStoreId();
      const allCustomers = await db.customers.toArray();
      const employees = filterCustomersForStore(allCustomers, activeStoreId).filter((c) => c.type === 'KARYAWAN');

      const needReset = employees.filter((e) => !e.last_allowance_reset || e.last_allowance_reset !== currentMonth);
      if (needReset.length === 0) return 0;

      console.log(`[EmployeeAllowance] Ditemukan ${needReset.length} karyawan belum reset kuota bulan ${currentMonth}. Menjalankan auto-reset...`);

      const now = new Date().toISOString();
      let resetCount = 0;

      for (const emp of needReset) {
        const allowance = Number(emp.monthly_allowance) || 2000000;
        const oldBalance = Number(emp.deposit_balance) || 0;
        const newBalance = allowance;

        const updatedEmp: Customer = {
          ...emp,
          deposit_balance: newBalance,
          monthly_allowance: allowance,
          last_allowance_reset: currentMonth,
          updated_at: now
        };

        await db.customers.put(updatedEmp);

        const mutation: MemberDepositMutation = {
          id: `dep-reset-${emp.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          customer_id: emp.id,
          customer_name: emp.name,
          customer_code: emp.code,
          type: 'MONTHLY_RESET',
          amount: allowance,
          balance_before: oldBalance,
          balance_after: newBalance,
          payment_method: 'SYSTEM',
          store_id: emp.store_id || 'store-01',
          store_name: emp.store_name || 'Cabang Utama',
          cashier_id: 'SYSTEM',
          cashier_name: 'Auto Reset Bulanan',
          receipt_number: `RESET-${currentMonth}`,
          notes: `Auto Reset Kuota Saldo Karyawan Bulanan (${this.formatMonthLabel(currentMonth)})`,
          created_at: now
        };

        await db.memberDeposits.put(mutation);
        resetCount++;

        // Broadcast perubahan
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ketoko_customer_updated', { detail: updatedEmp }));
          window.dispatchEvent(new CustomEvent('ketoko_member_deposit_updated', { detail: { customer: updatedEmp, mutation } }));
        }
      }

      // Sync ke server LAN jika aktif
      if (lanService.isLanActive()) {
        await lanService.resetEmployeeAllowance().catch(() => {});
      }

      // Sync hasil auto-reset bulanan ke Supabase Cloud & siarkan ke cabang Koperasi lain
      if (navigator.onLine) {
        syncService.pushCustomersToSupabase().then(() => {
          syncService.broadcastCloudEvent('customers_bulk_synced', {
            store_id: activeStoreId,
            month: currentMonth,
            count: resetCount
          }).catch(() => {});
        }).catch(() => {});
      }

      console.log(`[EmployeeAllowance] Berhasil auto-reset kuota saldo ${resetCount} karyawan ke Rp 2.000.000`);
      return resetCount;
    } catch (err) {
      console.warn('[EmployeeAllowance] Gagal auto-reset:', err);
      return 0;
    }
  }

  /**
   * Reset Saldo Kuota Karyawan secara Manual oleh Admin (Bisa 1 Karyawan atau Semua)
   */
  public async resetEmployeeAllowance(customerId?: string, customAmount?: number, targetStoreId?: string): Promise<{ success: boolean; count: number; message: string }> {
    try {
      const currentMonth = this.getCurrentMonthKey();
      const now = new Date().toISOString();
      const activeStoreId = targetStoreId || getCurrentActiveStoreId();
      const allCustomers = await db.customers.toArray();
      let targets = filterCustomersForStore(allCustomers, activeStoreId).filter((c) => c.type === 'KARYAWAN');

      if (customerId) {
        targets = targets.filter((c) => c.id === customerId || c.code === customerId);
      }

      if (targets.length === 0) {
        return { success: false, count: 0, message: 'Tidak ada data karyawan yang ditemukan.' };
      }

      // Simpan snapshot saldo sebelum reset ke localStorage agar bisa di-undo/dipulihkan kapan saja
      try {
        if (typeof window !== 'undefined') {
          const snapshot = targets.map((e) => ({
            id: e.id,
            code: e.code,
            name: e.name,
            deposit_balance: Number(e.deposit_balance) || 0,
            monthly_allowance: Number(e.monthly_allowance) || 2000000
          }));
          localStorage.setItem(
            'ketoko_pre_reset_balance_snapshot',
            JSON.stringify({ timestamp: now, storeId: activeStoreId, items: snapshot })
          );
        }
      } catch {}

      let count = 0;
      for (const emp of targets) {
        const allowance = customAmount !== undefined ? customAmount : (Number(emp.monthly_allowance) || 2000000);
        const oldBalance = Number(emp.deposit_balance) || 0;
        const newBalance = allowance;

        const updatedEmp: Customer = {
          ...emp,
          deposit_balance: newBalance,
          monthly_allowance: allowance,
          last_allowance_reset: currentMonth,
          updated_at: now
        };

        await db.customers.put(updatedEmp);

        const mutation: MemberDepositMutation = {
          id: `dep-reset-${emp.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          customer_id: emp.id,
          customer_name: emp.name,
          customer_code: emp.code,
          type: 'MONTHLY_RESET',
          amount: allowance,
          balance_before: oldBalance,
          balance_after: newBalance,
          payment_method: 'SYSTEM',
          store_id: emp.store_id || 'store-01',
          store_name: emp.store_name || 'Cabang Utama',
          cashier_id: 'ADMIN',
          cashier_name: 'Admin',
          receipt_number: `RESET-${currentMonth}`,
          notes: `Reset Kuota Saldo Karyawan Bulanan (${this.formatMonthLabel(currentMonth)})`,
          created_at: now
        };

        await db.memberDeposits.put(mutation);
        count++;

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ketoko_customer_updated', { detail: updatedEmp }));
          window.dispatchEvent(new CustomEvent('ketoko_member_deposit_updated', { detail: { customer: updatedEmp, mutation } }));
        }
      }

      // Sync ke LAN Server
      if (lanService.isLanActive()) {
        lanService.resetEmployeeAllowance(customerId, customAmount).catch(() => {});
      }

      // Sync ke Supabase Cloud & Cabang Koperasi Kedua secara real-time
      if (customerId && targets.length === 1) {
        const singleUpdated = await db.customers.get(targets[0].id).catch(() => null);
        if (singleUpdated) {
          await syncService.syncCustomerChange(singleUpdated).catch(() => {});
        }
      } else if (navigator.onLine) {
        syncService.pushCustomersToSupabase().then(() => {
          syncService.broadcastCloudEvent('customers_bulk_synced', {
            store_id: activeStoreId,
            month: currentMonth,
            count
          }).catch(() => {});
        }).catch(() => {});
      }

      return {
        success: true,
        count,
        message: `Berhasil mereset saldo kuota ${count} karyawan menjadi ${formatRupiah(customAmount || 2000000)}.`
      };
    } catch (err: any) {
      console.error('[EmployeeAllowance] Gagal reset manual:', err);
      return { success: false, count: 0, message: err.message || 'Gagal mereset saldo karyawan.' };
    }
  }

  /**
   * Pulihkan / Hitung Ulang Sisa Saldo Karyawan dari Riwayat Nota Transaksi Bulan Berjalan
   * Digunakan jika terjadi kesalahan klik Reset Saldo di tengah bulan:
   * Sisa Saldo dikembalikan secara akurat ke (Plafon Rp 2.000.000 - Total Belanja Potong Saldo Bulan Ini).
   */
  public async recalculateBalancesFromTransactions(
    customerId?: string,
    monthKey: string = this.getCurrentMonthKey(),
    targetStoreId?: string
  ): Promise<{ success: boolean; updatedCount: number; affectedWithSpend: number; message: string }> {
    try {
      const now = new Date().toISOString();
      const activeStoreId = targetStoreId || getCurrentActiveStoreId();
      if (navigator.onLine) {
        await syncService.pullTransactionsFromSupabase(500).catch(() => {});
      }
      const [allCustomers, allTransactions] = await Promise.all([
        db.customers.toArray(),
        db.transactions.toArray()
      ]);

      let employees = filterCustomersForStore(allCustomers, activeStoreId).filter(
        (c) => c.type === 'KARYAWAN'
      );
      if (customerId) {
        employees = employees.filter((c) => c.id === customerId || c.code === customerId);
      }
      if (employees.length === 0) {
        return { success: false, updatedCount: 0, affectedWithSpend: 0, message: 'Tidak ada data karyawan ditemukan.' };
      }

      const knownIdsAndCodes = new Set<string>();
      for (const emp of employees) {
        if (emp.id) knownIdsAndCodes.add(emp.id.trim().toLowerCase());
        if (emp.code) knownIdsAndCodes.add(emp.code.trim().toLowerCase());
      }

      const monthSaldoTrx = allTransactions.filter(
        (t) => t.payment_method === 'SALDO' && (t.created_at || '').slice(0, 7) === monthKey
      );

      let updatedCount = 0;
      let affectedWithSpend = 0;

      for (const emp of employees) {
        const empId = (emp.id || '').trim().toLowerCase();
        const empCode = (emp.code || '').trim().toLowerCase();
        const empName = (emp.name || '').trim().toLowerCase();

        const empSales = monthSaldoTrx.filter((t) => {
          const tId = (t.member_id || '').trim().toLowerCase();
          const tCode = (t.member_code || '').trim().toLowerCase();
          if (tId && (tId === empId || (empCode && tId === empCode))) return true;
          if (tCode && empCode && tCode === empCode) return true;
          if ((tId && knownIdsAndCodes.has(tId)) || (tCode && knownIdsAndCodes.has(tCode))) return false;
          const tName = (t.customer_name || '').trim().toLowerCase();
          return tName !== '' && tName === empName;
        });

        const spent = empSales.reduce((sum, t) => {
          const gt = Number(t.grand_total) || Number(t.subtotal) || 0;
          return sum + gt;
        }, 0);

        const allowance = clampEmployeeAllowance(emp.monthly_allowance);
        const restoredBalance = Math.max(0, allowance - spent);
        const oldBalance = Number(emp.deposit_balance) || 0;

        if (spent > 0) affectedWithSpend++;

        if (oldBalance !== restoredBalance) {
          const updatedEmp: Customer = {
            ...emp,
            deposit_balance: restoredBalance,
            monthly_allowance: allowance,
            updated_at: now
          };
          await db.customers.put(updatedEmp);
          updatedCount++;

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ketoko_customer_updated', { detail: updatedEmp }));
          }
        }
      }

      if (customerId && employees.length === 1) {
        const single = await db.customers.get(employees[0].id).catch(() => null);
        if (single) await syncService.syncCustomerChange(single).catch(() => {});
      } else if (navigator.onLine) {
        syncService.pushCustomersToSupabase().then(() => {
          syncService.broadcastCloudEvent('customers_bulk_synced', {
            store_id: activeStoreId,
            month: monthKey,
            count: updatedCount
          }).catch(() => {});
        }).catch(() => {});
      }

      return {
        success: true,
        updatedCount,
        affectedWithSpend,
        message: `Saldo berhasil dipulihkan dari riwayat transaksi bulan ${this.formatMonthLabel(monthKey)} (${affectedWithSpend} karyawan bertransaksi aktif, ${updatedCount} saldo disesuaikan kembali).`
      };
    } catch (err: any) {
      console.error('[EmployeeAllowance] Gagal pulihkan saldo:', err);
      return {
        success: false,
        updatedCount: 0,
        affectedWithSpend: 0,
        message: err.message || 'Gagal memulihkan saldo dari riwayat transaksi.'
      };
    }
  }

  /**
   * Edit / Sesuaikan Saldo atau Plafon Karyawan secara Spesifik
   */
  public async adjustEmployee(
    customerId: string,
    updates: { deposit_balance?: number; monthly_allowance?: number; notes?: string }
  ): Promise<{ success: boolean; data?: Customer; message: string }> {
    try {
      const emp = await db.customers.get(customerId);
      if (!emp) {
        return { success: false, message: 'Karyawan tidak ditemukan.' };
      }

      const now = new Date().toISOString();
      const oldBalance = Number(emp.deposit_balance) || 0;
      const MAX_ALLOWANCE = 2000000;
      const newBalance = updates.deposit_balance !== undefined ? Math.min(MAX_ALLOWANCE, Math.max(0, Number(updates.deposit_balance))) : Math.min(MAX_ALLOWANCE, oldBalance);
      const newAllowance = updates.monthly_allowance !== undefined ? Math.min(MAX_ALLOWANCE, Math.max(0, Number(updates.monthly_allowance))) : Math.min(MAX_ALLOWANCE, (Number(emp.monthly_allowance) || 2000000));

      const updatedEmp: Customer = {
        ...emp,
        type: 'KARYAWAN',
        deposit_balance: newBalance,
        monthly_allowance: newAllowance,
        updated_at: now
      };

      await db.customers.put(updatedEmp);

      if (newBalance !== oldBalance) {
        const mutation: MemberDepositMutation = {
          id: `dep-adj-${emp.id}-${Date.now()}`,
          customer_id: emp.id,
          customer_name: emp.name,
          customer_code: emp.code,
          type: 'ADJUSTMENT',
          amount: Math.abs(newBalance - oldBalance),
          balance_before: oldBalance,
          balance_after: newBalance,
          payment_method: 'SYSTEM',
          store_id: emp.store_id || 'store-01',
          store_name: emp.store_name || 'Cabang Utama',
          cashier_id: 'ADMIN',
          cashier_name: 'Admin',
          notes: updates.notes || 'Penyesuaian Saldo Karyawan oleh Admin',
          created_at: now
        };
        await db.memberDeposits.put(mutation);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ketoko_customer_updated', { detail: updatedEmp }));
      }

      if (lanService.isLanActive()) {
        lanService.adjustEmployeeAllowance(customerId, updates).catch(() => {});
      }

      await syncService.syncCustomerChange(updatedEmp).catch(() => {});

      return { success: true, data: updatedEmp, message: `Data saldo karyawan "${updatedEmp.name}" berhasil diperbarui.` };
    } catch (err: any) {
      console.error('[EmployeeAllowance] Gagal adjust employee:', err);
      return { success: false, message: err.message || 'Gagal memperbarui data karyawan.' };
    }
  }

  /**
   * Menghitung Laporan Rekapitulasi Saldo & Pemakaian Belanja Karyawan Bulanan
   */
  public async generateMonthlyReport(
    customCustomers?: Customer[],
    customTransactions?: Transaction[],
    monthKey: string = this.getCurrentMonthKey(),
    targetStoreId?: string
  ): Promise<EmployeeAllowanceReportSummary> {
    const activeStoreId = targetStoreId || getCurrentActiveStoreId();
    const customers = customCustomers && customCustomers.length > 0 ? customCustomers : await db.customers.toArray();
    const transactions = customTransactions && customTransactions.length > 0 ? customTransactions : await db.transactions.toArray();
    const isolatedCusts = filterCustomersForStore(customers, activeStoreId);
    const employees = isolatedCusts.filter((c) => c.type === 'KARYAWAN');

    // Filter transaksi belanja yang dibayar menggunakan SALDO maupun CASH (Tunai/Non-Saldo) pada bulan terpilih
    const saldoTrx = transactions.filter((t) => t.payment_method === 'SALDO');
    const cashDirectTrx = transactions.filter(
      (t) => t.payment_method !== 'SALDO' && t.payment_method !== 'TEMPO' && (t.member_id || (t.customer_name && t.customer_name !== 'PELANGGAN UMUM'))
    );
    const monthTrx = saldoTrx.filter((t) => (t.created_at || '').slice(0, 7) === monthKey);
    const monthCashTrx = cashDirectTrx.filter((t) => (t.created_at || '').slice(0, 7) === monthKey);
    const isCurrentMonth = monthKey === this.getCurrentMonthKey();

    const knownEmpIdsAndCodes = new Set<string>();
    for (const emp of employees) {
      if (emp.id) knownEmpIdsAndCodes.add(emp.id.trim().toLowerCase());
      if (emp.code) knownEmpIdsAndCodes.add(emp.code.trim().toLowerCase());
    }

    const getTrxEffectiveTotal = (t?: Transaction): number => {
      if (!t) return 0;
      const gt = Number(t.grand_total) || 0;
      if (gt > 0) return gt;
      const st = Number(t.subtotal) || 0;
      if (st > 0) return st;
      return (t.items || []).reduce(
        (sum, it: any) =>
          sum + (Number(it.subtotal_item) || (Number(it.price_applied) || 0) * (Number(it.qty) || 1)),
        0
      );
    };

    const matchesEmp = (t: Transaction, emp: Customer) => {
      const empId = (emp.id || '').trim().toLowerCase();
      const empCode = (emp.code || '').trim().toLowerCase();
      const tMemberId = (t.member_id || '').trim().toLowerCase();
      const tMemberCode = (t.member_code || '').trim().toLowerCase();

      if (tMemberId && (tMemberId === empId || (empCode && tMemberId === empCode))) {
        return true;
      }
      if (tMemberCode && empCode && tMemberCode === empCode) {
        return true;
      }
      // Jika transaksi sudah punya member_id/member_code yang merujuk ke karyawan lain, jangan samakan hanya karena nama kembar (misal: 2 karyawan bernama JEFRIANUS SERAN)
      if ((tMemberId && knownEmpIdsAndCodes.has(tMemberId)) || (tMemberCode && knownEmpIdsAndCodes.has(tMemberCode))) {
        return false;
      }
      const tCustName = (t.customer_name || '').trim().toLowerCase();
      return tCustName !== '' && tCustName === (emp.name || '').trim().toLowerCase();
    };

    const summarizeItems = (t?: Transaction) =>
      (t?.items || [])
        .map((it: any) => `${Number(it.qty) || 1}x ${it.product_name || it.name || 'Barang'}`)
        .join(', ');

    const records: EmployeeAllowanceRecord[] = employees.map((emp) => {
      const empSales = monthTrx.filter((t) => matchesEmp(t, emp));
      const empCashSales = monthCashTrx.filter((t) => matchesEmp(t, emp));
      const empAllSales = [...saldoTrx, ...cashDirectTrx]
        .filter((t) => matchesEmp(t, emp))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const lastTrx = empAllSales[0];

      const spent = empSales.reduce((sum, t) => sum + getTrxEffectiveTotal(t), 0);
      const cashSpent = empCashSales.reduce((sum, t) => sum + getTrxEffectiveTotal(t), 0);
      const allowance = clampEmployeeAllowance(emp.monthly_allowance);
      // Pastikan Sisa Saldo selalu sinkron dengan Plafon - Potong Saldo (tidak selisih jika ada nama kembar / sinkronisasi)
      const computedRemaining = Math.max(0, allowance - spent);
      const currentBalance = isCurrentMonth
        ? (spent > 0 ? computedRemaining : clampEmployeeBalance(emp.deposit_balance, allowance))
        : computedRemaining;
      const utilization = allowance > 0 ? Math.min(100, (spent / allowance) * 100) : 0;
      const status: 'ACTIVE' | 'EXHAUSTED' = currentBalance > 0 ? 'ACTIVE' : 'EXHAUSTED';

      const meta = parseEmployeeMeta(emp);
      const combinedMonthTrx = [...empSales, ...empCashSales].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at))
      );

      return {
        id: emp.id,
        customer_id: emp.id,
        code: emp.code || '-',
        name: emp.name,
        phone: emp.phone || '-',
        store_id: emp.store_id || 'store-01',
        store_name: emp.store_name || 'Cabang Utama',
        afdeling: meta.afdeling,
        unit: meta.unit_profile,
        job_title: meta.job_code,
        monthly_allowance: allowance,
        allowance,
        deposit_balance: currentBalance,
        remaining_balance: currentBalance,
        spent_this_month: spent,
        spent,
        trx_count_this_month: empSales.length,
        cash_spent_this_month: cashSpent,
        cash_spent: cashSpent,
        cash_trx_count_this_month: empCashSales.length,
        utilization_percent: Math.round(utilization * 10) / 10,
        status,
        last_allowance_reset: emp.last_allowance_reset || '-',
        last_reset: emp.last_allowance_reset || 'Awal Bulan',
        updated_at: emp.updated_at || '-',
        last_purchase_date: lastTrx?.created_at,
        last_purchase_total: getTrxEffectiveTotal(lastTrx),
        last_purchase_items: summarizeItems(lastTrx),
        month_transactions: combinedMonthTrx.map((t) => ({
          receipt_number: t.receipt_number,
          created_at: t.created_at,
          grand_total: getTrxEffectiveTotal(t),
          store_id: t.store_id || '',
          payment_method: t.payment_method,
          items: summarizeItems(t)
        }))
      };
    });

    // Urutkan berdasarkan pemakaian saldo/cash tertinggi atau nama
    records.sort(
      (a, b) =>
        (b.spent_this_month + b.cash_spent_this_month) - (a.spent_this_month + a.cash_spent_this_month) ||
        a.name.localeCompare(b.name)
    );

    const totalAllowance = records.reduce((s, r) => s + r.monthly_allowance, 0);
    const totalSpent = records.reduce((s, r) => s + r.spent_this_month, 0);
    const totalCashSpent = records.reduce((s, r) => s + r.cash_spent_this_month, 0);
    const cashShopperCount = records.filter((r) => r.cash_spent_this_month > 0).length;
    const totalRemaining = records.reduce((s, r) => s + r.deposit_balance, 0);
    const overallUtilization = totalAllowance > 0 ? Math.round((totalSpent / totalAllowance) * 1000) / 10 : 0;
    const activeCount = records.filter(r => r.status === 'ACTIVE').length;
    const exhaustedCount = records.filter(r => r.status === 'EXHAUSTED').length;
    const formatted = this.formatMonthLabel(monthKey);

    return {
      monthKey,
      monthFormatted: formatted,
      period_name: formatted,
      totalEmployees: records.length,
      totalAllowance,
      totalSpent,
      totalCashSpent,
      totalRemaining,
      overallUtilization,
      employees: records,
      afdelingSummary: this.generateAfdelingSummaries(records),
      summary: {
        total_employees: records.length,
        total_allowance: totalAllowance,
        total_allowance_budget: totalAllowance,
        total_spent: totalSpent,
        total_cash_spent: totalCashSpent,
        cash_shopper_count: cashShopperCount,
        total_remaining_balance: totalRemaining,
        utilization_rate: overallUtilization,
        active_count: activeCount,
        exhausted_count: exhaustedCount
      }
    };
  }

  /**
   * Cetak Laporan Saldo Karyawan Bulanan ke Format Dokumen A4 / Print Dialog
   */
  public printEmployeeAllowanceReport(report: EmployeeAllowanceReportSummary, storeNameOrProfile: any = 'Koperasi MSL'): void {
    const storeName = typeof storeNameOrProfile === 'object' ? (storeNameOrProfile?.name || 'Koperasi MSL') : String(storeNameOrProfile || 'Koperasi MSL');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Saldo Karyawan - ${report.monthFormatted}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; margin: 0; padding: 10px; font-size: 11px; }
    .header { text-align: center; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 18px; color: #064e3b; }
    .header h2 { margin: 4px 0 0 0; font-size: 13px; color: #4b5563; font-weight: normal; }
    .kpi-container { display: flex; justify-content: space-between; margin-bottom: 16px; gap: 8px; }
    .kpi-card { flex: 1; background: #f8faf9; border: 1px solid #d1fae5; border-radius: 8px; padding: 10px; text-align: center; }
    .kpi-label { font-size: 9.5px; color: #065f46; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-value { font-size: 14px; font-weight: bold; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #064e3b; color: #ffffff; padding: 8px 6px; font-size: 10px; text-align: left; }
    th.num, td.num { text-align: right; }
    th.center, td.center { text-align: center; }
    td { padding: 6px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; }
    .signature-box { text-align: center; width: 180px; margin-top: 30px; }
    .signature-line { border-bottom: 1px solid #000; margin-top: 50px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${storeName}</h1>
    <h2>LAPORAN REKAPITULASI SALDO KUOTA &amp; PEMBELIAN CASH KARYAWAN</h2>
    <div style="font-size: 11px; font-weight: bold; margin-top: 4px; color: #047857;">Periode: ${report.monthFormatted}</div>
  </div>

  <div class="kpi-container">
    <div class="kpi-card">
      <div class="kpi-label">Total Karyawan</div>
      <div class="kpi-value">${report.totalEmployees} Orang</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Plafon Kuota</div>
      <div class="kpi-value">${formatRupiah(report.totalAllowance)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Potong Saldo / Gaji</div>
      <div class="kpi-value" style="color: #b91c1c;">${formatRupiah(report.totalSpent)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Belanja Cash (Tunai)</div>
      <div class="kpi-value" style="color: #0369a1;">${formatRupiah(report.totalCashSpent || 0)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Sisa Saldo Kuota</div>
      <div class="kpi-value" style="color: #047857;">${formatRupiah(report.totalRemaining)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Penyerapan Saldo</div>
      <div class="kpi-value">${report.overallUtilization}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width: 28px;">No</th>
        <th>NIK / Kode</th>
        <th>Nama Karyawan</th>
        <th>Unit / Afdeling</th>
        <th class="num">Plafon</th>
        <th class="num">Potong Saldo</th>
        <th class="num">Beli Cash</th>
        <th class="num">Sisa Saldo</th>
        <th>Barang Terakhir Dibeli</th>
        <th class="num">Nominal Terakhir</th>
      </tr>
    </thead>
    <tbody>
      ${report.employees.map((e, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold;">${e.code}</td>
          <td><b>${e.name}</b></td>
          <td>${e.unit || '-'} • Afd ${e.afdeling || '-'}</td>
          <td class="num">${formatRupiah(e.monthly_allowance)}</td>
          <td class="num" style="color: #b91c1c; font-weight: bold;">${formatRupiah(e.spent_this_month)}</td>
          <td class="num" style="color: #0369a1; font-weight: bold;">${e.cash_spent_this_month ? formatRupiah(e.cash_spent_this_month) : '-'}</td>
          <td class="num" style="color: #047857; font-weight: bold;">${formatRupiah(e.deposit_balance)}</td>
          <td style="font-size: 9.5px;">${e.last_purchase_items || '-'}${e.last_purchase_date ? `<br/><span style="color:#6b7280">${new Date(e.last_purchase_date).toLocaleDateString('id-ID')}</span>` : ''}</td>
          <td class="num">${e.last_purchase_total ? formatRupiah(e.last_purchase_total) : '-'}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background: #ecfdf5; font-weight: bold;">
        <td colspan="4" class="num" style="padding: 8px;">TOTAL</td>
        <td class="num" style="padding: 8px;">${formatRupiah(report.totalAllowance)}</td>
        <td class="num" style="padding: 8px; color: #b91c1c;">${formatRupiah(report.totalSpent)}</td>
        <td class="num" style="padding: 8px; color: #0369a1;">${formatRupiah(report.totalCashSpent || 0)}</td>
        <td class="num" style="padding: 8px; color: #047857;">${formatRupiah(report.totalRemaining)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>Dicetak otomatis pada: ${new Date().toLocaleString('id-ID')}</div>
    <div style="display: flex; gap: 40px;">
      <div class="signature-box">
        <div>Dibuat Oleh,</div>
        <div class="signature-line"></div>
        <div>( Kasir / Admin )</div>
      </div>
      <div class="signature-box">
        <div>Mengetahui,</div>
        <div class="signature-line"></div>
        <div>( Manajemen / HRD )</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  /**
   * Ekspor Laporan Saldo Karyawan ke Excel (.xls) dengan tampilan persis
   * seperti Laporan Rekapitulasi Saldo Kuota & Pembelian Cash Karyawan (A4):
   * Header Tengah Koperasi, 6 Kartu KPI Ringkasan, 10 Kolom Rapi Berwarna, dan Baris Total.
   */
  public exportEmployeeAllowanceExcel(
    report: EmployeeAllowanceReportSummary,
    storeName: string = 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI'
  ): void {
    const esc = (v: any) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const titleName =
      !storeName || storeName.toUpperCase() === 'KETOKO POS'
        ? 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI'
        : storeName.toUpperCase();

    const cols: Array<{ title: string; width: number; align: 'left' | 'center' | 'right' }> = [
      { title: 'No', width: 42, align: 'center' },
      { title: 'NIK / Kode', width: 145, align: 'left' },
      { title: 'Nama Karyawan', width: 220, align: 'left' },
      { title: 'Unit / Afdeling', width: 210, align: 'left' },
      { title: 'Plafon', width: 120, align: 'right' },
      { title: 'Potong Saldo', width: 120, align: 'right' },
      { title: 'Beli Cash', width: 115, align: 'right' },
      { title: 'Sisa Saldo', width: 125, align: 'right' },
      { title: 'Barang Terakhir Dibeli', width: 470, align: 'left' },
      { title: 'Nominal Terakhir', width: 125, align: 'right' }
    ];
    const colCount = cols.length;

    const rowsHtml = report.employees
      .map((e, idx) => {
        const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
        const dateLabel = e.last_purchase_date
          ? new Date(e.last_purchase_date).toLocaleDateString('id-ID')
          : '';
        const itemsHtml = e.last_purchase_items
          ? `${esc(e.last_purchase_items)}${dateLabel ? `<br/><span style="color:#6b7280;font-size:8.5pt;">${esc(dateLabel)}</span>` : ''}`
          : '-';
        return `
      <tr>
        <td style="background:${bg};text-align:center;color:#374151;">${idx + 1}</td>
        <td style="background:${bg};font-family:Consolas,'Courier New',monospace;font-weight:bold;color:#111827;mso-number-format:'\\@';">${esc(e.code)}</td>
        <td style="background:${bg};font-weight:bold;color:#111827;">${esc(e.name)}</td>
        <td style="background:${bg};color:#374151;">${esc(`${e.unit || '-'} • Afd ${e.afdeling || '-'}`)}</td>
        <td style="background:${bg};text-align:right;color:#1f2937;">${esc(formatRupiah(e.monthly_allowance))}</td>
        <td style="background:${bg};text-align:right;color:#b91c1c;font-weight:bold;">${esc(formatRupiah(e.spent_this_month))}</td>
        <td style="background:${bg};text-align:right;color:#0369a1;font-weight:bold;">${e.cash_spent_this_month ? esc(formatRupiah(e.cash_spent_this_month)) : '-'}</td>
        <td style="background:${bg};text-align:right;color:#047857;font-weight:bold;">${esc(formatRupiah(e.deposit_balance))}</td>
        <td style="background:${bg};white-space:normal;font-size:9.5pt;color:#1f2937;">${itemsHtml}</td>
        <td style="background:${bg};text-align:right;color:#1f2937;">${e.last_purchase_total ? esc(formatRupiah(e.last_purchase_total)) : '-'}</td>
      </tr>`;
      })
      .join('');

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Laporan Saldo ${esc(report.monthKey)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>8</x:SplitHorizontal><x:TopRowBottomPane>8</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 10pt; color: #1f2937; }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 6px 8px; vertical-align: middle; border-bottom: 0.5pt solid #e5e7eb; mso-number-format:"\\@"; }
  br { mso-data-placement: same-cell; }
  .hdr-title { font-size: 16pt; font-weight: bold; color: #064e3b; text-align: center; border: none; padding: 6px 0 2px 0; }
  .hdr-sub { font-size: 11pt; color: #4b5563; text-align: center; border: none; padding: 2px 0; }
  .hdr-period { font-size: 10.5pt; font-weight: bold; color: #047857; text-align: center; border-top: none; border-left: none; border-right: none; border-bottom: 2pt solid #047857; padding: 2px 0 10px 0; }
  .kpi-lbl { background: #f8faf9; border-top: 1pt solid #d1fae5; border-left: 1pt solid #d1fae5; border-right: 1pt solid #d1fae5; border-bottom: none; font-size: 8.5pt; font-weight: bold; color: #065f46; text-align: center; text-transform: uppercase; padding: 8px 6px 2px 6px; }
  .kpi-val { background: #f8faf9; border-bottom: 1pt solid #d1fae5; border-left: 1pt solid #d1fae5; border-right: 1pt solid #d1fae5; border-top: none; font-size: 12.5pt; font-weight: bold; color: #0f172a; text-align: center; padding: 2px 6px 8px 6px; }
  .tbl-th { background: #064e3b; color: #ffffff; font-weight: bold; font-size: 10pt; border: 0.5pt solid #064e3b; height: 32px; }
  .tot-td { background: #ecfdf5; font-weight: bold; font-size: 10.5pt; border-top: 1.5pt solid #047857; border-bottom: 1.5pt solid #047857; padding: 8px; }
</style>
</head>
<body>
<table>
  <colgroup>${cols.map((c) => `<col width="${c.width}" style="width:${c.width}px">`).join('')}</colgroup>
  <tr><td colspan="${colCount}" class="hdr-title">${esc(titleName)}</td></tr>
  <tr><td colspan="${colCount}" class="hdr-sub">LAPORAN REKAPITULASI SALDO KUOTA &amp; PEMBELIAN CASH KARYAWAN</td></tr>
  <tr><td colspan="${colCount}" class="hdr-period">Periode: ${esc(report.monthFormatted)}</td></tr>
  <tr><td colspan="${colCount}" style="border:none;height:10px;padding:0;"></td></tr>
  <tr>
    <td colspan="2" class="kpi-lbl">TOTAL KARYAWAN</td>
    <td colspan="2" class="kpi-lbl">TOTAL PLAFON KUOTA</td>
    <td colspan="2" class="kpi-lbl">POTONG SALDO / GAJI</td>
    <td class="kpi-lbl">BELANJA CASH (TUNAI)</td>
    <td colspan="2" class="kpi-lbl">SISA SALDO KUOTA</td>
    <td class="kpi-lbl">PENYERAPAN SALDO</td>
  </tr>
  <tr>
    <td colspan="2" class="kpi-val">${report.totalEmployees} Orang</td>
    <td colspan="2" class="kpi-val">${esc(formatRupiah(report.totalAllowance))}</td>
    <td colspan="2" class="kpi-val" style="color:#b91c1c;">${esc(formatRupiah(report.totalSpent))}</td>
    <td class="kpi-val" style="color:#0369a1;">${esc(formatRupiah(report.totalCashSpent || 0))}</td>
    <td colspan="2" class="kpi-val" style="color:#047857;">${esc(formatRupiah(report.totalRemaining))}</td>
    <td class="kpi-val">${esc(report.overallUtilization)}%</td>
  </tr>
  <tr><td colspan="${colCount}" style="border:none;height:10px;padding:0;"></td></tr>
  <tr>
    ${cols.map((c) => `<th class="tbl-th" style="text-align:${c.align};">${esc(c.title)}</th>`).join('')}
  </tr>
  ${rowsHtml}
  <tr>
    <td colspan="4" class="tot-td" style="text-align:right;color:#064e3b;">TOTAL</td>
    <td class="tot-td" style="text-align:right;color:#0f172a;">${esc(formatRupiah(report.totalAllowance))}</td>
    <td class="tot-td" style="text-align:right;color:#b91c1c;">${esc(formatRupiah(report.totalSpent))}</td>
    <td class="tot-td" style="text-align:right;color:#0369a1;">${esc(formatRupiah(report.totalCashSpent || 0))}</td>
    <td class="tot-td" style="text-align:right;color:#047857;">${esc(formatRupiah(report.totalRemaining))}</td>
    <td colspan="2" class="tot-td"></td>
  </tr>
</table>
</body>
</html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Saldo_Karyawan_${report.monthKey}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /**
   * Ekspor Laporan Saldo Karyawan (diarahkan ke format Excel .xls rapi sesuai tampilan laporan A4)
   */
  public exportEmployeeAllowanceCSV(
    report: EmployeeAllowanceReportSummary,
    storeName: string = 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI'
  ): void {
    this.exportEmployeeAllowanceExcel(report, storeName);
  }

  /**
   * Rekapitulasi Pemakaian Kuota Saldo Karyawan per Afdeling / Unit
   */
  public generateAfdelingSummaries(employees: EmployeeAllowanceRecord[]): AfdelingAllowanceSummary[] {
    const map = new Map<string, AfdelingAllowanceSummary>();

    for (const emp of employees) {
      const afdKey = emp.afdeling || 'UMUM';
      const unitKey = emp.unit || 'MSL INTI-1';
      const key = `${unitKey} - Afdeling ${afdKey}`;

      if (!map.has(key)) {
        map.set(key, {
          afdeling: afdKey,
          unit: unitKey,
          totalEmployees: 0,
          totalAllowance: 0,
          totalSpent: 0,
          totalCashSpent: 0,
          totalRemaining: 0,
          utilizationRate: 0
        });
      }

      const item = map.get(key)!;
      item.totalEmployees += 1;
      item.totalAllowance += emp.monthly_allowance;
      item.totalSpent += emp.spent_this_month;
      item.totalCashSpent += emp.cash_spent_this_month || 0;
      item.totalRemaining += emp.deposit_balance;
    }

    const result = Array.from(map.values());
    for (const item of result) {
      item.utilizationRate = item.totalAllowance > 0
        ? Math.round((item.totalSpent / item.totalAllowance) * 1000) / 10
        : 0;
    }

    result.sort((a, b) => a.unit.localeCompare(b.unit) || a.afdeling.localeCompare(b.afdeling));
    return result;
  }

  /**
   * Cetak Rekapitulasi per Afdeling (Untuk Potongan Payroll / Gaji HRD)
   */
  public printAfdelingSummaryReport(
    summaries: AfdelingAllowanceSummary[],
    monthFormatted: string,
    storeName: string = 'KOPERASI KARYAWAN PT. MUARATOYU SUBUR LESTARI'
  ): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalEmps = summaries.reduce((s, a) => s + a.totalEmployees, 0);
    const totalAllow = summaries.reduce((s, a) => s + a.totalAllowance, 0);
    const totalSpent = summaries.reduce((s, a) => s + a.totalSpent, 0);
    const totalCash = summaries.reduce((s, a) => s + (a.totalCashSpent || 0), 0);
    const totalRem = summaries.reduce((s, a) => s + a.totalRemaining, 0);
    const overallUtil = totalAllow > 0 ? (totalSpent / totalAllow * 100).toFixed(1) : '0';

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekapitulasi Belanja Karyawan Per Afdeling - ${monthFormatted}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 0; padding: 10px; font-size: 11px; }
    .header { text-align: center; border-bottom: 2px solid #065f46; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 16px; color: #064e3b; text-transform: uppercase; font-weight: 800; }
    .header h2 { margin: 4px 0 0 0; font-size: 13px; color: #334155; font-weight: bold; }
    .header .period { font-size: 12px; color: #047857; font-weight: 800; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { background: #064e3b; color: #ffffff; padding: 8px 6px; font-size: 10px; text-align: left; text-transform: uppercase; }
    th.num, td.num { text-align: right; }
    th.center, td.center { text-align: center; }
    td { padding: 6px; border-bottom: 1px solid #cbd5e1; font-size: 10px; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px; color: #475569; }
    .signature-box { text-align: center; width: 180px; }
    .signature-line { border-bottom: 1px solid #000; margin-top: 60px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${storeName}</h1>
    <h2>REKAPITULASI PEMAKAIAN SALDO &amp; BELANJA CASH KARYAWAN PER AFDELING</h2>
    <div class="period">Periode Potongan: ${monthFormatted}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width: 35px;">No</th>
        <th>Unit Kerja</th>
        <th>Afdeling / Divisi</th>
        <th class="center" style="width: 65px;">Jml Org</th>
        <th class="num">Total Plafon</th>
        <th class="num" style="color: #fecdd3;">Potong Gaji (Saldo)</th>
        <th class="num" style="color: #bae6fd;">Beli Cash (Tunai)</th>
        <th class="num">Sisa Saldo</th>
        <th class="center" style="width: 60px;">Penyerapan</th>
      </tr>
    </thead>
    <tbody>
      ${summaries.map((s, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td style="font-weight: bold;">${s.unit}</td>
          <td><b>Afdeling ${s.afdeling}</b></td>
          <td class="center font-mono">${s.totalEmployees}</td>
          <td class="num">${formatRupiah(s.totalAllowance)}</td>
          <td class="num" style="font-weight: bold; color: #b91c1c;">${formatRupiah(s.totalSpent)}</td>
          <td class="num" style="font-weight: bold; color: #0369a1;">${s.totalCashSpent ? formatRupiah(s.totalCashSpent) : '-'}</td>
          <td class="num" style="color: #047857;">${formatRupiah(s.totalRemaining)}</td>
          <td class="center font-mono">${s.utilizationRate}%</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background: #e2e8f0; font-weight: 800;">
        <td colspan="3" class="num" style="padding: 10px;">TOTAL KESELURUHAN</td>
        <td class="center" style="padding: 10px;">${totalEmps}</td>
        <td class="num" style="padding: 10px;">${formatRupiah(totalAllow)}</td>
        <td class="num" style="padding: 10px; color: #b91c1c;">${formatRupiah(totalSpent)}</td>
        <td class="num" style="padding: 10px; color: #0369a1;">${formatRupiah(totalCash)}</td>
        <td class="num" style="padding: 10px; color: #047857;">${formatRupiah(totalRem)}</td>
        <td class="center" style="padding: 10px;">${overallUtil}%</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
    <div style="display: flex; gap: 40px;">
      <div class="signature-box">
        <div>Pengurus Koperasi,</div>
        <div class="signature-line"></div>
        <div>( Ketua / Kasir )</div>
      </div>
      <div class="signature-box">
        <div>Diterima Bagian Payroll / HRD,</div>
        <div class="signature-line"></div>
        <div>( HR & GA Dept )</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

export const employeeAllowanceService = new EmployeeAllowanceService();
