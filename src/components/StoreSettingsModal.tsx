import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Store, 
  FileSpreadsheet, 
  Database, 
  Users, 
  Upload, 
  Download, 
  UserPlus, 
  Trash2, 
  CheckCircle2, 
  Image, 
  Palette,
  Check,
  Sun,
  Moon,
  Feather,
  Package,
  PackageX,
  Boxes,
  RotateCcw,
  Receipt,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import { db } from '../db';
import type { User, Product, StoreProfile } from '../types';
import { useTheme, type ThemeCategory } from '../context/ThemeContext';
import { CustomSelect } from './CustomSelect';

interface StoreSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'theme' | 'csv' | 'backup' | 'users';
  onProfileUpdated?: () => void;
  onUpdated?: () => void;
}

const DEFAULT_STORE_PROFILE: StoreProfile = {
  name: 'Ketoko POS',
  branch_name: 'Cabang Samarinda (BR-01)',
  tagline: 'Solusi Belanja Hemat, Cepat & Terlengkap',
  address: 'Jl. Pahlawan No. 45, Samarinda, Kalimantan Timur',
  phone: '0812-3456-7890',
  footer_message: 'Terima kasih atas kunjungan Anda! Barang yang dibeli dapat ditukar max 3 hari.',
  logo_base64: '',
  npwp: '01.234.567.8-721.000',
  tax_rate: 11
};

export const StoreSettingsModal: React.FC<StoreSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile',
  onProfileUpdated,
  onUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'theme' | 'cloud' | 'csv' | 'backup' | 'users'>(initialTab);
  
  // Theme Hook
  const { currentTheme, setThemeById, allThemes } = useTheme();
  const [themeFilterCategory, setThemeFilterCategory] = useState<'ALL' | ThemeCategory>('ALL');
  const [themeNotification, setThemeNotification] = useState<string | null>(null);

  // Store Profile State
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(() => {
    const saved = localStorage.getItem('ketoko_store_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name && parsed.name !== 'Ketoko POS') return parsed;
      } catch {}
    }
    return DEFAULT_STORE_PROFILE;
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'CASHIER'>('CASHIER');

  // CSV & Backup Notifications
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadUsers();
    }
  }, [isOpen, initialTab]);

  const loadUsers = async () => {
    const allUsers = await db.users.toArray();
    setUsers(allUsers);
    onUpdated?.();
  };

  // Handle Logo Upload (Base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file maksimal 2MB!');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setStoreProfile((prev) => ({ ...prev, logo_base64: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // Remove Logo
  const handleRemoveLogo = () => {
    setStoreProfile((prev) => ({ ...prev, logo_base64: '' }));
  };

  // Save Store Profile
  const handleSaveProfile = () => {
    localStorage.setItem('ketoko_store_profile', JSON.stringify(storeProfile));
    const rateToSave = typeof storeProfile.tax_rate === 'number' ? storeProfile.tax_rate : 11;
    localStorage.setItem('ketoko_tax_rate', String(rateToSave));
    window.dispatchEvent(new CustomEvent('ketoko_tax_rate_changed', { detail: rateToSave }));
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
    onProfileUpdated?.();
  };

  // Switch Theme
  const handleSelectTheme = (themeId: string, themeName: string) => {
    setThemeById(themeId);
    setThemeNotification(`Tema "${themeName}" berhasil diterapkan!`);
    setTimeout(() => setThemeNotification(null), 3000);
  };

  // Export Products to CSV
  const handleExportCSV = async () => {
    const products = await db.products.toArray();
    const headers = ['id', 'barcode', 'name', 'category', 'buy_price', 'retail_price', 'wholesale_price', 'min_wholesale_qty', 'stock', 'unit', 'rack_location'];
    
    const rows = products.map((p) => [
      p.id,
      `"${p.barcode}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.buy_price,
      p.retail_price,
      p.wholesale_price,
      p.min_wholesale_qty,
      p.stock,
      `"${p.unit}"`,
      `"${p.rack_location}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ketoko_master_produk_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCsvStatus(`Berhasil export ${products.length} master produk ke CSV.`);
    setTimeout(() => setCsvStatus(null), 4000);
  };

  // Export JSON Full Master
  const handleExportJSON = async () => {
    const products = await db.products.toArray();
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ketoko_products_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import Products from CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          alert('File CSV kosong atau tidak memiliki data.');
          return;
        }

        const newProducts: Product[] = [];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
          const cleanParts = parts.map((p) => p.trim().replace(/^"|"$/g, ''));

          if (cleanParts.length >= 6) {
            const prod: Product = {
              id: cleanParts[0] || `prod-${Date.now()}-${i}`,
              barcode: cleanParts[1] || `899${Math.floor(1000000000 + Math.random() * 9000000000)}`,
              name: cleanParts[2] || `Item ${i}`,
              category: cleanParts[3] || 'Umum',
              buy_price: Number(cleanParts[4]) || 10000,
              retail_price: Number(cleanParts[5]) || 12000,
              wholesale_price: Number(cleanParts[6]) || Number(cleanParts[5]) || 12000,
              min_wholesale_qty: Number(cleanParts[7]) || 6,
              stock: Number(cleanParts[8]) || 10,
              unit: cleanParts[9] || 'pcs',
              rack_location: cleanParts[10] || 'RAK-A1',
              min_stock_alert: 5,
              updated_at: new Date().toISOString()
            };
            newProducts.push(prod);
          }
        }

        if (newProducts.length > 0) {
          await db.products.bulkPut(newProducts);
          setCsvStatus(`Sukses mengimpor dan memperbarui ${newProducts.length} produk dari CSV.`);
          setTimeout(() => setCsvStatus(null), 4000);
          onUpdated?.();
        }
      } catch (err: any) {
        alert('Gagal membaca file CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Backup Full DB JSON
  const handleBackupDatabase = async () => {
    try {
      const [prods, trxs, custs, sups, debts, recs, purchases, pReturns, sReturns, movements, dbUsers] = await Promise.all([
        db.products.toArray(),
        db.transactions.toArray(),
        db.customers.toArray(),
        db.suppliers.toArray(),
        db.debts.toArray(),
        db.receivables.toArray(),
        db.purchases.toArray(),
        db.purchaseReturns.toArray(),
        db.salesReturns.toArray(),
        db.stockMovements.toArray(),
        db.users.toArray()
      ]);

      const fullBackup = {
        app: 'KetokoPOS',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        storeProfile: storeProfile,
        data: {
          products: prods,
          transactions: trxs,
          customers: custs,
          suppliers: sups,
          debts: debts,
          receivables: recs,
          purchases: purchases,
          purchaseReturns: pReturns,
          salesReturns: sReturns,
          stockMovements: movements,
          users: dbUsers
        }
      };

      const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_ketoko_pos_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setBackupStatus('File backup lengkap database berhasil diunduh.');
      setTimeout(() => setBackupStatus(null), 4000);
    } catch (err: any) {
      alert('Gagal backup database: ' + err.message);
    }
  };

  // Restore DB JSON
  const handleRestoreDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('PERINGATAN: Memulihkan database akan menimpa data transaksi dan produk dengan data dari file backup. Lanjutkan?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const backup = JSON.parse(text);

        if (!backup.data || !backup.app) {
          throw new Error('Format file backup tidak sesuai / korup.');
        }

        if (backup.data.products?.length) await db.products.bulkPut(backup.data.products);
        if (backup.data.transactions?.length) await db.transactions.bulkPut(backup.data.transactions);
        if (backup.data.customers?.length) await db.customers.bulkPut(backup.data.customers);
        if (backup.data.suppliers?.length) await db.suppliers.bulkPut(backup.data.suppliers);
        if (backup.data.debts?.length) await db.debts.bulkPut(backup.data.debts);
        if (backup.data.receivables?.length) await db.receivables.bulkPut(backup.data.receivables);
        if (backup.data.purchases?.length) await db.purchases.bulkPut(backup.data.purchases);
        if (backup.data.purchaseReturns?.length) await db.purchaseReturns.bulkPut(backup.data.purchaseReturns);
        if (backup.data.salesReturns?.length) await db.salesReturns.bulkPut(backup.data.salesReturns);
        if (backup.data.stockMovements?.length) await db.stockMovements.bulkPut(backup.data.stockMovements);
        if (backup.data.users?.length) await db.users.bulkPut(backup.data.users);

        if (backup.storeProfile) {
          localStorage.setItem('ketoko_store_profile', JSON.stringify(backup.storeProfile));
          setStoreProfile(backup.storeProfile);
        }

        setBackupStatus('Database berhasil dipulihkan (Restore Complete)! Silakan refresh aplikasi.');
        onUpdated?.();
        loadUsers();
      } catch (err: any) {
        alert('Gagal restore database: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // 1. Kosongkan Stok Semua Barang (Set Stok = 0)
  const [isClearingStock, setIsClearingStock] = useState(false);
  const handleClearAllStock = async () => {
    if (!window.confirm('⚠️ PERINGATAN: Apakah Anda yakin ingin MENGOSONGKAN SELURUH STOK barang (set stok = 0) untuk seluruh item di toko?')) {
      return;
    }

    setIsClearingStock(true);
    try {
      await db.products.toCollection().modify({ stock: 0 });
      setBackupStatus('Berhasil mengosongkan seluruh stok barang menjadi 0 PCS!');
      onUpdated?.();
    } catch (err: any) {
      alert('Gagal mengosongkan stok: ' + err.message);
    } finally {
      setIsClearingStock(false);
    }
  };

  // 2. Set Stok Massal ke Angka Tertentu
  const [bulkStockVal, setBulkStockVal] = useState<number>(50);
  const [isSettingBulkStock, setIsSettingBulkStock] = useState(false);
  const handleBulkSetStock = async () => {
    if (bulkStockVal < 0) {
      alert('Jumlah stok tidak boleh minus!');
      return;
    }
    if (!window.confirm(`Atur stok SELURUH produk menjadi ${bulkStockVal} PCS?`)) {
      return;
    }

    setIsSettingBulkStock(true);
    try {
      await db.products.toCollection().modify({ stock: bulkStockVal });
      setBackupStatus(`Berhasil memperbarui stok seluruh produk menjadi ${bulkStockVal} PCS!`);
      onUpdated?.();
    } catch (err: any) {
      alert('Gagal mengatur stok massal: ' + err.message);
    } finally {
      setIsSettingBulkStock(false);
    }
  };

  // 3. Bersihkan Riwayat Transaksi Kasir
  const handleClearTransactions = async () => {
    if (!window.confirm('⚠️ Hapus seluruh riwayat transaksi penjualan & nota kasir?')) {
      return;
    }
    try {
      await db.transactions.clear();
      await db.syncQueue.clear();
      setBackupStatus('Riwayat transaksi kasir berhasil dikosongkan!');
      onUpdated?.();
    } catch (err: any) {
      alert('Gagal menghapus transaksi: ' + err.message);
    }
  };

  // 4. Bersihkan Catatan Hutang & Piutang
  const handleClearDebtsAndReceivables = async () => {
    if (!window.confirm('⚠️ Hapus seluruh catatan hutang supplier & piutang pelanggan?')) {
      return;
    }
    try {
      await db.debts.clear();
      await db.receivables.clear();
      setBackupStatus('Catatan hutang & piutang berhasil dibersihkan!');
      onUpdated?.();
    } catch (err: any) {
      alert('Gagal menghapus hutang piutang: ' + err.message);
    }
  };

  // 5. Bersihkan Riwayat Mutasi Stok, PO & Retur
  const handleClearMovementHistory = async () => {
    if (!window.confirm('⚠️ Hapus riwayat mutasi stok masuk/keluar, PO pembelian, dan retur?')) {
      return;
    }
    try {
      await db.stockMovements.clear();
      await db.purchases.clear();
      await db.purchaseReturns.clear();
      await db.salesReturns.clear();
      setBackupStatus('Riwayat mutasi dan pembelian berhasil dibersihkan!');
      onUpdated?.();
    } catch (err: any) {
      alert('Gagal menghapus mutasi: ' + err.message);
    }
  };

  // Kosongkan Seluruh Master Produk (Set ke 0 SKU)
  const [isClearingProducts, setIsClearingProducts] = useState(false);
  const handleClearAllProducts = async () => {
    if (!window.confirm('⚠️ PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SELURUH PRODUK (0 SKU) dari database kasir? Riwayat transaksi dan master toko tidak akan dihapus.')) {
      return;
    }
    setIsClearingProducts(true);
    try {
      await db.products.clear();
      setBackupStatus('Berhasil menghapus seluruh produk (Database kini 0 SKU)!');
      onUpdated?.();
    } catch (err: any) {
      alert('Gagal mengosongkan produk: ' + err.message);
    } finally {
      setIsClearingProducts(false);
    }
  };

  // 6. Factory Reset Database (Kondisi Bersih 0 Data)
  const handleFactoryReset = async () => {
    if (!window.confirm('🚨 PERINGATAN KERAS: Tindakan ini akan menghapus SEMUA DATA toko dan mengembalikan database ke setelan awal BERSIH (0 Produk, 0 Transaksi). Lanjutkan?')) {
      return;
    }
    try {
      await db.products.clear();
      await db.transactions.clear();
      await db.syncQueue.clear();
      await db.customers.clear();
      await db.suppliers.clear();
      await db.debts.clear();
      await db.receivables.clear();
      await db.purchases.clear();
      await db.purchaseReturns.clear();
      await db.salesReturns.clear();
      await db.stockMovements.clear();
      await db.users.clear();

      // Seed clean default system users
      await db.users.bulkPut([
        { id: 'usr-001', username: 'admin', name: 'Owner Toko', role: 'ADMIN', branch_id: 'BR-01' },
        { id: 'usr-002', username: 'kasir', name: 'Kasir Toko', role: 'CASHIER', branch_id: 'BR-01' }
      ]);

      setBackupStatus('Database berhasil di-reset ke kondisi awal bersih (0 Produk, 0 Transaksi)!');
      onUpdated?.();
      loadUsers();
    } catch (err: any) {
      alert('Gagal reset database: ' + err.message);
    }
  };

  // Add New User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim()) return;

    try {
      const newUser: User = {
        id: `usr-${Date.now().toString().slice(-4)}`,
        name: newUserName.trim(),
        username: newUserUsername.trim().toLowerCase(),
        role: newUserRole,
        branch_id: 'BR-01'
      };

      await db.users.put(newUser);
      setIsAddingUser(false);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      loadUsers();
    } catch (err: any) {
      alert('Gagal menambah user: ' + err.message);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Hapus akun user ini?')) {
      await db.users.delete(userId);
      loadUsers();
    }
  };

  const filteredThemes = themeFilterCategory === 'ALL' 
    ? allThemes 
    : allThemes.filter((t) => t.category === themeFilterCategory);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fcf9f5] border border-[#e5d0be] w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header - Coklat Susu Latte Header */}
        <div className="p-4 sm:p-5 border-b border-[#85542f] bg-gradient-to-r from-[#96633b] to-[#a6744c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-[#83532e] text-amber-200 border border-[#a6744c]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Pusat Pengaturan Sistem & Toko</h3>
              <p className="text-xs text-[#fcefe3]">Pengaturan tema warna, data toko, CSV, backup database & manajemen user</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#fcefe3] hover:text-white hover:bg-[#83532e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="px-4 py-3 border-b border-[#e5d0be] bg-[#f5ebe0] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto w-full pb-1 sm:pb-0">
            
            {/* Tab 1: Profile */}
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'profile'
                  ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                  : 'bg-white text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Data Toko & Logo</span>
            </button>

            {/* Tab 2: Theme / Color Palette */}
            <button
              onClick={() => setActiveTab('theme')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'theme'
                  ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                  : 'bg-white text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-amber-500" />
              <span>Tema & Palet Warna</span>
            </button>


            {/* Tab 3: CSV */}
            <button
              onClick={() => setActiveTab('csv')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'csv'
                  ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                  : 'bg-white text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import / Export Item</span>
            </button>

            {/* Tab 4: Backup */}
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'backup'
                  ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                  : 'bg-white text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Backup & Restore DB</span>
            </button>

            {/* Tab 5: Users */}
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'users'
                  ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                  : 'bg-white text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manajemen User ({users.length})</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-[#fcf9f5] min-h-0">
          
          {/* TAB 1: DATA TOKO & LOGO */}
          {activeTab === 'profile' && (
            <div className="space-y-4 animate-fadeIn">
              
              {profileSaved && (
                <div className="p-3.5 bg-[#edf5ee] border border-[#cce2cf] text-[#166534] rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                  <span>Profil dan Logo Toko Berhasil Disimpan!</span>
                </div>
              )}

              <div className="p-5 rounded-3xl bg-white border border-[#e5d0be] shadow-xs space-y-4">
                <h4 className="font-extrabold text-sm text-[#3d2617] border-b border-[#f2e5d8] pb-2 flex items-center space-x-2">
                  <Store className="w-4 h-4 text-[#96633b]" />
                  <span>Identitas & Informasi Toko Retail</span>
                </h4>

                {/* Logo Uploader Section */}
                <div className="p-4 bg-[#fcf9f5] rounded-2xl border border-[#e5d0be] flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-[#ddc3aa] flex items-center justify-center overflow-hidden shrink-0 shadow-2xs relative">
                    {storeProfile.logo_base64 ? (
                      <img src={storeProfile.logo_base64} alt="Logo Toko" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="text-center p-2">
                        <Image className="w-6 h-6 text-[#8a6b53] mx-auto mb-1 opacity-60" />
                        <span className="text-[9px] text-[#8a6b53] font-bold block leading-tight">Belum Ada Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <span className="text-xs font-bold text-[#3d2617] block">Logo Usaha / Toko (Format JPG/PNG)</span>
                    <p className="text-[11px] text-[#8a6b53]">Logo akan tampil di bagian atas struk kasir dan dashboard utama.</p>
                    <div className="flex items-center justify-center sm:justify-start space-x-2 pt-1">
                      <label className="px-3.5 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center space-x-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo Baru</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      {storeProfile.logo_base64 && (
                        <button
                          onClick={handleRemoveLogo}
                          className="px-3 py-1.5 bg-[#fbeeed] text-rose-700 hover:bg-[#f8dbdb] rounded-xl text-xs font-bold border border-[#f4cfcf] transition-colors"
                        >
                          Hapus Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-[#5c3c26] block mb-1">Nama Aplikasi / Nama POS (Brand):</label>
                    <input
                      type="text"
                      value={storeProfile.name}
                      onChange={(e) => setStoreProfile({ ...storeProfile, name: e.target.value })}
                      placeholder="e.g. Ketoko POS / Toko Berkah"
                      className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white font-bold text-[#3d2617] focus:border-[#96633b]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#5c3c26] block mb-1">Nama Cabang / Identitas Outlet (Subtitle):</label>
                    <input
                      type="text"
                      value={storeProfile.branch_name || ''}
                      onChange={(e) => setStoreProfile({ ...storeProfile, branch_name: e.target.value })}
                      placeholder="e.g. Cabang Samarinda (BR-01)"
                      className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white font-semibold text-[#3d2617] focus:border-[#96633b]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-[#5c3c26] block mb-1">Slogan / Tagline Usaha:</label>
                    <input
                      type="text"
                      value={storeProfile.tagline}
                      onChange={(e) => setStoreProfile({ ...storeProfile, tagline: e.target.value })}
                      placeholder="e.g. Solusi Belanja Hemat, Cepat & Terlengkap"
                      className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white focus:border-[#96633b]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-[#5c3c26] block mb-1">Alamat Lengkap Cabang:</label>
                    <input
                      type="text"
                      value={storeProfile.address}
                      onChange={(e) => setStoreProfile({ ...storeProfile, address: e.target.value })}
                      className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white focus:border-[#96633b]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#5c3c26] block mb-1">No. Telepon / WhatsApp Toko:</label>
                    <input
                      type="text"
                      value={storeProfile.phone}
                      onChange={(e) => setStoreProfile({ ...storeProfile, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white focus:border-[#96633b]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#5c3c26] block mb-1">NPWP / NIB Badan Usaha:</label>
                    <input
                      type="text"
                      value={storeProfile.npwp || ''}
                      onChange={(e) => setStoreProfile({ ...storeProfile, npwp: e.target.value })}
                      className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white font-mono focus:border-[#96633b]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#5c3c26] block mb-1">Tarif Pajak PPN Default (%):</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={storeProfile.tax_rate ?? 11}
                        onChange={(e) => setStoreProfile({ ...storeProfile, tax_rate: parseFloat(e.target.value) || 0 })}
                        placeholder="Contoh: 11 (bisa diisi berapa aja)"
                        className="w-full pl-3 pr-8 py-2 border border-[#ddc3aa] rounded-xl bg-white font-bold text-[#3d2617] focus:border-[#96633b]"
                      />
                      <span className="absolute right-3 top-2 text-stone-500 font-bold text-xs">%</span>
                    </div>
                    <span className="text-[10px] text-[#8a6b53] mt-0.5 block">Bisa dimasukkan angka berapa saja (misal: 0, 10, 11, 12, dll).</span>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-[#5c3c26] block mb-1">Pesan Penutup Struk (*Footer Receipt*):</label>
                    <textarea
                      rows={2}
                      value={storeProfile.footer_message}
                      onChange={(e) => setStoreProfile({ ...storeProfile, footer_message: e.target.value })}
                      className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white text-xs font-medium focus:border-[#96633b]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveProfile}
                    className="px-6 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                  >
                    Simpan Pengaturan Toko
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: PALET WARNA & TEMA (NEW FEATURE) */}
          {activeTab === 'theme' && (
            <div className="space-y-4 animate-fadeIn">
              
              {themeNotification && (
                <div className="p-3.5 bg-[#edf5ee] border border-[#cce2cf] text-[#166534] rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                  <span>{themeNotification}</span>
                </div>
              )}

              {/* Theme Header & Category Filter */}
              <div className="p-5 rounded-3xl bg-white border border-[#e5d0be] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f2e5d8] pb-3">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#3d2617] flex items-center space-x-2">
                      <Palette className="w-4 h-4 text-[#96633b]" />
                      <span>Katalog Tema & Palet Warna Antarmuka POS</span>
                    </h4>
                    <p className="text-xs text-[#8a6b53] mt-0.5">
                      Pilih dari koleksi palet warna Soft (lembut), Cerah (fresh), atau Gelap (dark mode) sesuai kenyamanan kasir.
                    </p>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto shrink-0">
                    <button
                      onClick={() => setThemeFilterCategory('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        themeFilterCategory === 'ALL'
                          ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                          : 'bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
                      }`}
                    >
                      Semua ({allThemes.length})
                    </button>

                    <button
                      onClick={() => setThemeFilterCategory('soft')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1 ${
                        themeFilterCategory === 'soft'
                          ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                          : 'bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
                      }`}
                    >
                      <Feather className="w-3 h-3 text-amber-500" />
                      <span>Soft / Lembut ({allThemes.filter(t => t.category === 'soft').length})</span>
                    </button>

                    <button
                      onClick={() => setThemeFilterCategory('bright')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1 ${
                        themeFilterCategory === 'bright'
                          ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                          : 'bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
                      }`}
                    >
                      <Sun className="w-3 h-3 text-amber-500" />
                      <span>Cerah / Fresh ({allThemes.filter(t => t.category === 'bright').length})</span>
                    </button>

                    <button
                      onClick={() => setThemeFilterCategory('dark')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1 ${
                        themeFilterCategory === 'dark'
                          ? 'bg-[#96633b] text-white border-[#96633b] shadow-xs'
                          : 'bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] border-[#ddc3aa]'
                      }`}
                    >
                      <Moon className="w-3 h-3 text-indigo-500" />
                      <span>Gelap / Dark ({allThemes.filter(t => t.category === 'dark').length})</span>
                    </button>
                  </div>
                </div>

                {/* Theme Preset Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredThemes.map((preset) => {
                    const isCurrent = currentTheme.id === preset.id;

                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectTheme(preset.id, preset.name)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative group ${
                          isCurrent
                            ? 'border-[#96633b] bg-white shadow-md ring-2 ring-[#96633b]/20'
                            : 'border-[#e5d0be] bg-white hover:border-[#b8957c] hover:shadow-xs'
                        }`}
                      >
                        {/* Top: Name & Category Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-extrabold text-sm text-[#3d2617] flex items-center space-x-1.5">
                              <span>{preset.name}</span>
                              {isCurrent && (
                                <span className="p-0.5 rounded-full bg-[#15803d] text-white">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 inline-block ${
                              preset.category === 'soft'
                                ? 'bg-[#faebd7] text-[#96633b] border-[#eed7c4]'
                                : preset.category === 'bright'
                                ? 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]'
                                : 'bg-[#1e293b] text-[#f8fafc] border-[#334155]'
                            }`}>
                              {preset.categoryLabel}
                            </span>
                          </div>

                          {/* Color Swatch Dots */}
                          <div className="flex items-center space-x-1 shrink-0 p-1 bg-[#fcf9f5] rounded-xl border border-[#eed7c4]">
                            {preset.colors.swatch.map((c, idx) => (
                              <div
                                key={idx}
                                className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Interactive Visual Mini Mockup */}
                        <div 
                          className="p-2.5 rounded-xl border space-y-2 overflow-hidden shadow-2xs"
                          style={{ 
                            backgroundColor: preset.colors.canvasBg,
                            borderColor: preset.colors.border 
                          }}
                        >
                          {/* Mini Header Strip */}
                          <div 
                            className="p-1.5 rounded-lg flex items-center justify-between text-[10px] font-bold"
                            style={{ 
                              background: `linear-gradient(to right, ${preset.colors.headerFrom}, ${preset.colors.headerTo})`,
                              color: preset.colors.headerText 
                            }}
                          >
                            <span className="truncate">KetokoPOS</span>
                            <span 
                              className="px-1 py-0.2 rounded text-[8px]"
                              style={{ backgroundColor: preset.colors.headerBadge }}
                            >
                              POS
                            </span>
                          </div>

                          {/* Mini Content Card */}
                          <div 
                            className="p-2 rounded-lg border flex items-center justify-between"
                            style={{ 
                              backgroundColor: preset.colors.cardBg,
                              borderColor: preset.colors.borderSubtle,
                              color: preset.colors.textMain 
                            }}
                          >
                            <span className="text-[10px] font-bold">Produk Retail</span>
                            <span 
                              className="px-2 py-0.5 rounded text-[9px] font-extrabold text-white"
                              style={{ backgroundColor: preset.colors.primary }}
                            >
                              Rp 15.000
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-[#8a6b53] leading-relaxed line-clamp-2">
                          {preset.description}
                        </p>

                        {/* Action Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTheme(preset.id, preset.name);
                          }}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                            isCurrent
                              ? 'bg-[#edf5ee] text-[#166534] border border-[#cce2cf]'
                              : 'bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] border border-[#ddc3aa]'
                          }`}
                        >
                          {isCurrent ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#166534] stroke-[2.5]" />
                              <span>Sedang Digunakan</span>
                            </>
                          ) : (
                            <span>Gunakan Tema Ini</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: IMPORT / EXPORT ITEM CSV */}
          {activeTab === 'csv' && (
            <div className="space-y-4 animate-fadeIn">
              
              {csvStatus && (
                <div className="p-3.5 bg-[#edf5ee] border border-[#cce2cf] text-[#166534] rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                  <span>{csvStatus}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Export Card */}
                <div className="p-5 rounded-3xl bg-white border border-[#e5d0be] shadow-xs space-y-3">
                  <div className="flex items-center space-x-2 text-[#96633b]">
                    <Download className="w-5 h-5" />
                    <h4 className="font-extrabold text-sm">Export Data Master Produk</h4>
                  </div>
                  <p className="text-xs text-[#8a6b53]">
                    Unduh seluruh daftar item, harga beli HPP, harga eceran, harga grosir, dan stok ke file CSV atau JSON.
                  </p>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleExportCSV}
                      className="w-full py-2.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-xs transition-all"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Download File CSV / Excel (.csv)</span>
                    </button>

                    <button
                      onClick={handleExportJSON}
                      className="w-full py-2 bg-[#f5ebe0] hover:bg-[#ebd7c5] text-[#5c3c26] rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border border-[#ddc3aa] transition-colors"
                    >
                      <Database className="w-4 h-4" />
                      <span>Download File JSON Master (.json)</span>
                    </button>
                  </div>
                </div>

                {/* Import Card */}
                <div className="p-5 rounded-3xl bg-white border border-[#e5d0be] shadow-xs space-y-3">
                  <div className="flex items-center space-x-2 text-[#166534]">
                    <Upload className="w-5 h-5" />
                    <h4 className="font-extrabold text-sm">Import Master Produk dari CSV</h4>
                  </div>
                  <p className="text-xs text-[#8a6b53]">
                    Unggah file CSV dengan susunan kolom: <i>id, barcode, nama, kategori, harga_beli, harga_jual, harga_grosir, min_qty, stok, satuan, rak</i>.
                  </p>

                  <div className="pt-2">
                    <label className="w-full py-2.5 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-xs transition-all">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Pilih & Upload File CSV Produk</span>
                      <input type="file" accept=".csv,text/csv" onChange={handleImportCSV} className="hidden" />
                    </label>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: BACKUP & PENGATURAN DATABASE */}
          {activeTab === 'backup' && (
            <div className="space-y-4 animate-fadeIn">
              
              {backupStatus && (
                <div className="p-3.5 bg-[#edf5ee] border border-[#cce2cf] text-[#166534] rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0" />
                  <span>{backupStatus}</span>
                </div>
              )}

              {/* Section 1: Backup & Restore */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-[#5c3c26] uppercase tracking-wider flex items-center space-x-1.5">
                  <Database className="w-3.5 h-3.5 text-[#96633b]" />
                  <span>1. Cadangan & Pemulihan Database (Backup & Restore)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Backup Card */}
                  <div className="p-4 rounded-2xl bg-white border border-[#e5d0be] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-[#96633b] font-bold text-xs">
                        <Download className="w-4 h-4" />
                        <h5>Backup Database Toko</h5>
                      </div>
                      <p className="text-[11px] text-[#8a6b53] mt-1">
                        Unduh salinan berkas cadangan (.json) berisi produk, transaksi, hutang, piutang, dan user toko ini.
                      </p>
                    </div>

                    <button
                      onClick={handleBackupDatabase}
                      className="w-full py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File .JSON</span>
                    </button>
                  </div>

                  {/* Restore Card */}
                  <div className="p-4 rounded-2xl bg-white border border-[#e5d0be] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-[#991b1b] font-bold text-xs">
                        <Upload className="w-4 h-4" />
                        <h5>Restore Database Toko</h5>
                      </div>
                      <p className="text-[11px] text-[#8a6b53] mt-1">
                        Pulihkan seluruh data toko dari berkas cadangan JSON yang telah disimpan sebelumnya.
                      </p>
                    </div>

                    <label className="w-full py-2 bg-[#b91c1c] hover:bg-[#991b1b] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs transition-all text-center">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Pilih File .JSON</span>
                      <input type="file" accept=".json,application/json" onChange={handleRestoreDatabase} className="hidden" />
                    </label>
                  </div>

                </div>
              </div>

              {/* Section 2: Operasi & Manajemen Stok Produk */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-black text-[#5c3c26] uppercase tracking-wider flex items-center space-x-1.5">
                  <Boxes className="w-3.5 h-3.5 text-[#7c4e2f]" />
                  <span>2. Pengaturan & Manajemen Stok Barang</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Kosongkan Semua Stok (Set 0) */}
                  <div className="p-4 rounded-2xl bg-white border border-[#e5d0be] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-amber-800 font-bold text-xs">
                        <PackageX className="w-4 h-4 text-amber-700" />
                        <h5>Kosongkan Seluruh Stok (Set Stok = 0)</h5>
                      </div>
                      <p className="text-[11px] text-[#8a6b53] mt-1">
                        Ubah sisa stok seluruh barang di toko menjadi <b>0 PCS</b> sekaligus. Sangat ideal untuk persiapan audit / Stok Opname awal toko.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearAllStock}
                      disabled={isClearingStock}
                      className="w-full py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all"
                    >
                      <PackageX className="w-3.5 h-3.5" />
                      <span>{isClearingStock ? 'Mengosongkan...' : 'Kosongkan Semua Stok (0 PCS)'}</span>
                    </button>
                  </div>

                  {/* Set Stok Massal */}
                  <div className="p-4 rounded-2xl bg-white border border-[#e5d0be] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-[#166534] font-bold text-xs">
                        <Boxes className="w-4 h-4 text-[#166534]" />
                        <h5>Isi / Atur Stok Massal Semua Barang</h5>
                      </div>
                      <p className="text-[11px] text-[#8a6b53] mt-1">
                        Atur nilai sisa stok untuk seluruh produk secara serentak ke angka yang Anda tentukan.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="relative w-24 shrink-0">
                        <input
                          type="number"
                          min="0"
                          value={bulkStockVal}
                          onChange={(e) => setBulkStockVal(parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-2 text-center text-xs font-bold font-mono text-[#332219] bg-[#fcf8f4] border border-[#dfcebe] rounded-xl focus:bg-white focus:border-[#7c4e2f]"
                        />
                        <span className="absolute right-2 top-2.5 text-[10px] text-[#856b59] pointer-events-none">PCS</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleBulkSetStock}
                        disabled={isSettingBulkStock}
                        className="flex-1 py-2.5 bg-[#166534] hover:bg-[#14532d] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-all"
                      >
                        <Boxes className="w-3.5 h-3.5" />
                        <span>{isSettingBulkStock ? 'Memperbarui...' : `Terapkan Stok (${bulkStockVal})`}</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* Section 3: Pembersihan Transaksi & Reset Data */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-black text-[#5c3c26] uppercase tracking-wider flex items-center space-x-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                  <span>3. Pembersihan Data Operasional & Reset</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  
                  {/* Bersihkan Transaksi */}
                  <div className="p-3.5 rounded-2xl bg-white border border-[#e5d0be] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-[#543c2e] font-bold text-xs">
                        <Receipt className="w-3.5 h-3.5 text-[#7c4e2f]" />
                        <h5>Reset Transaksi</h5>
                      </div>
                      <p className="text-[10px] text-[#8a6b53] mt-1">
                        Hapus riwayat penjualan & nota kasir tanpa menghapus daftar master barang.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearTransactions}
                      className="w-full py-2 bg-[#f5ece3] hover:bg-[#ebdccf] text-rose-800 border border-[#dfcebe] rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Transaksi</span>
                    </button>
                  </div>

                  {/* Kosongkan Seluruh Katalog Produk */}
                  <div className="p-3.5 rounded-2xl bg-white border border-[#e5d0be] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-[#543c2e] font-bold text-xs">
                        <Package className="w-3.5 h-3.5 text-[#7c4e2f]" />
                        <h5>Reset Katalog (0 SKU)</h5>
                      </div>
                      <p className="text-[10px] text-[#8a6b53] mt-1">
                        Hapus seluruh daftar barang kembali ke 0 SKU tanpa menghapus transaksi & akun.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearAllProducts}
                      disabled={isClearingProducts}
                      className="w-full py-2 bg-[#f5ece3] hover:bg-[#ebdccf] text-rose-800 border border-[#dfcebe] rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{isClearingProducts ? 'Menghapus...' : 'Hapus Semua SKU'}</span>
                    </button>
                  </div>

                  {/* Bersihkan Hutang Piutang */}
                  <div className="p-3.5 rounded-2xl bg-white border border-[#e5d0be] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-[#543c2e] font-bold text-xs">
                        <CreditCard className="w-3.5 h-3.5 text-[#7c4e2f]" />
                        <h5>Hapus Hutang & Piutang</h5>
                      </div>
                      <p className="text-[10px] text-[#8a6b53] mt-1">
                        Hapus seluruh catatan tagihan hutang ke supplier dan piutang pelanggan.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearDebtsAndReceivables}
                      className="w-full py-2 bg-[#f5ece3] hover:bg-[#ebdccf] text-rose-800 border border-[#dfcebe] rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Hutang Piutang</span>
                    </button>
                  </div>

                  {/* Bersihkan Mutasi & PO */}
                  <div className="p-3.5 rounded-2xl bg-white border border-[#e5d0be] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-[#543c2e] font-bold text-xs">
                        <Boxes className="w-3.5 h-3.5 text-[#7c4e2f]" />
                        <h5>Hapus Mutasi & PO</h5>
                      </div>
                      <p className="text-[10px] text-[#8a6b53] mt-1">
                        Hapus riwayat mutasi stok masuk/keluar, order PO dan retur toko.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearMovementHistory}
                      className="w-full py-2 bg-[#f5ece3] hover:bg-[#ebdccf] text-rose-800 border border-[#dfcebe] rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Mutasi</span>
                    </button>
                  </div>

                  {/* Factory Reset */}
                  <div className="p-3.5 rounded-2xl bg-[#fff5f5] border border-[#fecaca] shadow-xs space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-rose-800 font-bold text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <h5>Reset Total Pabrik</h5>
                      </div>
                      <p className="text-[10px] text-rose-700 mt-1">
                        Kembalikan semua tabel database ke kondisi awal bersih bawaan.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleFactoryReset}
                      className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 shadow-xs transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Factory Reset Total</span>
                    </button>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 5: MANAJEMEN USER */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Add User Form Drawer */}
              {isAddingUser && (
                <div className="p-5 bg-[#fcf5ed] border border-[#eed7c4] rounded-3xl space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#eed7c4] pb-2">
                    <h4 className="font-extrabold text-sm text-[#3d2617] flex items-center space-x-1.5">
                      <UserPlus className="w-4 h-4 text-[#96633b]" />
                      <span>Form Pendaftaran User Baru (Admin / Kasir)</span>
                    </h4>
                    <button onClick={() => setIsAddingUser(false)} className="text-[#8a6b53] hover:text-[#3d2617]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-[#5c3c26] block mb-1">Nama Lengkap Petugas:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Siti Aminah"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white font-bold text-[#3d2617]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[#5c3c26] block mb-1">Username Login:</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. kasir_siti"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white font-mono text-[#3d2617]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[#5c3c26] block mb-1">Kata Sandi (Password):</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-[#ddc3aa] rounded-xl bg-white"
                      />
                    </div>

                    <CustomSelect
                      label="Peran / Role Pengguna:"
                      value={newUserRole}
                      onChange={(val) => setNewUserRole(val as any)}
                      options={[
                        { value: 'CASHIER', label: 'KASIR', sublabel: 'Transaksi POS & Dashboard Ringkas' },
                        { value: 'ADMIN', label: 'ADMIN', sublabel: 'Akses Penuh Semua Laporan & Pengaturan' }
                      ]}
                    />

                    <div className="sm:col-span-2 flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingUser(false)}
                        className="px-4 py-2 bg-[#f5ebe0] text-[#5c3c26] hover:bg-[#ebd7c5] rounded-xl text-xs font-bold"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold shadow-xs"
                      >
                        Simpan User Baru
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Table Users */}
              <div className="bg-white rounded-3xl border border-[#e5d0be] shadow-xs overflow-hidden">
                <div className="p-4 border-b border-[#f2e5d8] flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-[#96633b]" />
                    <h4 className="font-extrabold text-sm text-[#3d2617]">Daftar Akun Pengguna KetokoPOS</h4>
                  </div>

                  {!isAddingUser && (
                    <button
                      onClick={() => setIsAddingUser(true)}
                      className="px-3.5 py-1.5 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ Tambah User</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#f5ebe0] backdrop-blur-xs z-10">
                      <tr className="border-b border-[#ddc3aa] text-[#5c3c26] text-[11px] font-black uppercase tracking-wider">
                        <th className="py-3 px-4">Nama Petugas</th>
                        <th className="py-3 px-4">Username</th>
                        <th className="py-3 px-4 text-center">Role / Hak Akses</th>
                        <th className="py-3 px-4 text-center">Cabang</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f2e5d8] font-medium">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-[#fcf9f5] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#3d2617] text-sm">{u.name}</td>
                          <td className="py-3 px-4 font-mono text-[#5c3c26]">{u.username || u.name.toLowerCase().replace(/\s+/g, '')}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              u.role === 'ADMIN' || u.role === 'MANAGER'
                                ? 'bg-[#faebd7] text-[#96633b] border border-[#eed7c4]'
                                : 'bg-[#f5ebe0] text-[#5c3c26] border border-[#ddc3aa]'
                            }`}>
                              {u.role === 'ADMIN' ? '👑 ADMIN' : u.role === 'MANAGER' ? '👔 MANAGER' : '🛒 KASIR'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-[#8a6b53]">{u.branch_id}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 rounded-lg text-[#8a6b53] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Hapus User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e5d0be] bg-white flex items-center justify-between text-xs text-[#8a6b53] shrink-0">
          <span>Semua konfigurasi tema dan toko disimpan lokal dengan integritas tinggi</span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#96633b] hover:bg-[#83532e] text-white rounded-xl font-bold transition-all shadow-xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
