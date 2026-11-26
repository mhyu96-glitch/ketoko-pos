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
  totalRemaining: number;
  overallUtilization: number;
  employees: EmployeeAllowanceRecord[];
  afdelingSummary: AfdelingAllowanceSummary[];
  summary: {
    total_employees: number;
    total_allowance: number;
    total_allowance_budget: number;
    total_spent: number;
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

    // Filter transaksi belanja yang dibayar menggunakan SALDO pada bulan terpilih
    const saldoTrx = transactions.filter((t) => t.payment_method === 'SALDO');
    const monthTrx = saldoTrx.filter((t) => (t.created_at || '').slice(0, 7) === monthKey);
    const isCurrentMonth = monthKey === this.getCurrentMonthKey();

    const matchesEmp = (t: Transaction, emp: Customer) => {
      const tMemberId = (t.member_id || '').toLowerCase();
      const tCustName = (t.customer_name || '').toLowerCase();
      return (
        tMemberId === (emp.id || '').toLowerCase() ||
        tMemberId === (emp.code || '').toLowerCase() ||
        (tCustName !== '' && tCustName === (emp.name || '').toLowerCase())
      );
    };

    const summarizeItems = (t?: Transaction) =>
      (t?.items || [])
        .map((it: any) => `${Number(it.qty) || 1}x ${it.product_name || it.name || 'Barang'}`)
        .join(', ');

    const records: EmployeeAllowanceRecord[] = employees.map((emp) => {
      const empSales = monthTrx.filter((t) => matchesEmp(t, emp));
      const empAllSales = saldoTrx
        .filter((t) => matchesEmp(t, emp))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const lastTrx = empAllSales[0];

      const spent = empSales.reduce((sum, t) => sum + (Number(t.grand_total) || 0), 0);
      const allowance = clampEmployeeAllowance(emp.monthly_allowance);
      // Bulan berjalan: pakai saldo aktual. Bulan lalu: kuota - pemakaian (histori potong gaji tetap utuh walau sudah reset Tgl 1)
      const currentBalance = isCurrentMonth
        ? clampEmployeeBalance(emp.deposit_balance, allowance)
        : Math.max(0, allowance - spent);
      const utilization = allowance > 0 ? Math.min(100, (spent / allowance) * 100) : 0;
      const status: 'ACTIVE' | 'EXHAUSTED' = currentBalance > 0 ? 'ACTIVE' : 'EXHAUSTED';

      const meta = parseEmployeeMeta(emp);

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
        utilization_percent: Math.round(utilization * 10) / 10,
        status,
        last_allowance_reset: emp.last_allowance_reset || '-',
        last_reset: emp.last_allowance_reset || 'Awal Bulan',
        updated_at: emp.updated_at || '-',
        last_purchase_date: lastTrx?.created_at,
        last_purchase_total: lastTrx ? Number(lastTrx.grand_total) || 0 : 0,
        last_purchase_items: summarizeItems(lastTrx),
        month_transactions: empSales.map((t) => ({
          receipt_number: t.receipt_number,
          created_at: t.created_at,
          grand_total: Number(t.grand_total) || 0,
          store_id: t.store_id || '',
          items: summarizeItems(t)
        }))
      };
    });

    // Urutkan berdasarkan pemakaian tertinggi atau nama
    records.sort((a, b) => b.spent_this_month - a.spent_this_month || a.name.localeCompare(b.name));

    const totalAllowance = records.reduce((s, r) => s + r.monthly_allowance, 0);
    const totalSpent = records.reduce((s, r) => s + r.spent_this_month, 0);
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
      totalRemaining,
      overallUtilization,
      employees: records,
      afdelingSummary: this.generateAfdelingSummaries(records),
      summary: {
        total_employees: records.length,
        total_allowance: totalAllowance,
        total_allowance_budget: totalAllowance,
        total_spent: totalSpent,
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
    .header { text-align: center; border-bottom: 2px solid #96633b; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 18px; color: #5c3c26; }
    .header h2 { margin: 4px 0 0 0; font-size: 13px; color: #4b5563; font-weight: normal; }
    .kpi-container { display: flex; justify-content: space-between; margin-bottom: 16px; gap: 10px; }
    .kpi-card { flex: 1; background: #faf5f0; border: 1px solid #e7d8cb; border-radius: 8px; padding: 10px; text-align: center; }
    .kpi-label { font-size: 10px; color: #7c5c43; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-value { font-size: 15px; font-weight: bold; color: #3d2617; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #5c3c26; color: #ffffff; padding: 8px 6px; font-size: 10.5px; text-align: left; }
    th.num, td.num { text-align: right; }
    th.center, td.center { text-align: center; }
    td { padding: 6px; border-bottom: 1px solid #e5e7eb; font-size: 10.5px; }
    tr:nth-child(even) { background-color: #fdfaf7; }
    .progress-bar { background: #e5e7eb; border-radius: 4px; height: 6px; width: 60px; display: inline-block; overflow: hidden; vertical-align: middle; margin-right: 4px; }
    .progress-fill { background: #10b981; height: 100%; }
    .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; }
    .signature-box { text-align: center; width: 180px; margin-top: 30px; }
    .signature-line { border-bottom: 1px solid #000; margin-top: 50px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${storeName}</h1>
    <h2>LAPORAN REKAPITULASI SALDO &amp; POTONGAN BELANJA KARYAWAN</h2>
    <div style="font-size: 11px; font-weight: bold; margin-top: 4px; color: #84532d;">Periode: ${report.monthFormatted}</div>
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
      <div class="kpi-label">Total Belanja Terpakai</div>
      <div class="kpi-value" style="color: #b91c1c;">${formatRupiah(report.totalSpent)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Sisa Saldo Kuota</div>
      <div class="kpi-value" style="color: #047857;">${formatRupiah(report.totalRemaining)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Persentase Penyerapan</div>
      <div class="kpi-value">${report.overallUtilization}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width: 30px;">No</th>
        <th>NIK / Kode</th>
        <th>Nama Karyawan</th>
        <th>Unit / Afdeling</th>
        <th class="num">Plafon</th>
        <th class="num">Potong Gaji</th>
        <th class="num">Sisa</th>
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
          <td class="num" style="color: #047857; font-weight: bold;">${formatRupiah(e.deposit_balance)}</td>
          <td style="font-size: 9.5px;">${e.last_purchase_items || '-'}${e.last_purchase_date ? `<br/><span style="color:#6b7280">${new Date(e.last_purchase_date).toLocaleDateString('id-ID')}</span>` : ''}</td>
          <td class="num">${e.last_purchase_total ? formatRupiah(e.last_purchase_total) : '-'}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr style="background: #f4ede6; font-weight: bold;">
        <td colspan="4" class="num" style="padding: 8px;">TOTAL</td>
        <td class="num" style="padding: 8px;">${formatRupiah(report.totalAllowance)}</td>
        <td class="num" style="padding: 8px; color: #b91c1c;">${formatRupiah(report.totalSpent)}</td>
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
   * Ekspor Laporan Saldo Karyawan ke File CSV
   */
  public exportEmployeeAllowanceCSV(report: EmployeeAllowanceReportSummary): void {
    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'No',
      'NIK/Kode',
      'Nama Karyawan',
      'Unit',
      'Afdeling',
      'Jabatan',
      'Plafon Bulanan (Rp)',
      'Terpakai / Potong Gaji (Rp)',
      'Sisa Saldo (Rp)',
      'Utilisasi (%)',
      'Jumlah Nota',
      'Tgl Belanja Terakhir',
      'Barang Terakhir Dibeli',
      'Nominal Belanja Terakhir (Rp)'
    ];

    const rows = report.employees.map((e, idx) => [
      idx + 1,
      q(e.code),
      q(e.name),
      q(e.unit),
      q(e.afdeling),
      q(e.job_title),
      e.monthly_allowance,
      e.spent_this_month,
      e.deposit_balance,
      `${e.utilization_percent}%`,
      e.trx_count_this_month,
      q(e.last_purchase_date ? new Date(e.last_purchase_date).toLocaleString('id-ID') : '-'),
      q(e.last_purchase_items || '-'),
      e.last_purchase_total || 0
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map((r) => r.join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Saldo_Karyawan_${report.monthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          totalRemaining: 0,
          utilizationRate: 0
        });
      }

      const item = map.get(key)!;
      item.totalEmployees += 1;
      item.totalAllowance += emp.monthly_allowance;
      item.totalSpent += emp.spent_this_month;
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
    <h2>REKAPITULASI PEMAKAIAN SALDO BELANJA KARYAWAN PER AFDELING</h2>
    <div class="period">Periode Potongan: ${monthFormatted}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width: 35px;">No</th>
        <th>Unit Kerja</th>
        <th>Afdeling / Divisi</th>
        <th class="center" style="width: 70px;">Jumlah Org</th>
        <th class="num">Total Plafon</th>
        <th class="num" style="color: #fecdd3;">Total Terpakai (Potong Gaji)</th>
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
