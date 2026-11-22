import { useState, useCallback, useMemo, useEffect } from 'react';
import type { CartItem, Product, Customer } from '../types';
import { db } from '../db';
import {
  checkCustomerBranchAccess,
  getCurrentActiveStoreId,
  type BranchAccessCheckResult
} from '../utils/customerAccess';

export interface MemberBlockedState extends BranchAccessCheckResult {
  customer: Customer;
}

export function useCart(activeStoreId?: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [memberId, setMemberIdState] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [memberBlockedInfo, setMemberBlockedInfo] = useState<MemberBlockedState | null>(null);
  const [memberDiscountPercent, setMemberDiscountPercent] = useState<number>(0);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(true);
  const [taxRate, setTaxRateState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ketoko_tax_rate');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {}
    return 11;
  });

  const setTaxRate = useCallback((newRate: number) => {
    const validRate = Math.max(0, Math.min(100, isNaN(newRate) ? 0 : newRate));
    setTaxRateState(validRate);
    try {
      localStorage.setItem('ketoko_tax_rate', String(validRate));
      window.dispatchEvent(new CustomEvent('ketoko_tax_rate_changed', { detail: validRate }));
    } catch {}
  }, []);

  // Add item or increment qty with wholesale evaluation
  const addItem = useCallback((product: Product, quantityToAdd = 1) => {
    const cleanId = String(product.id).trim().toLowerCase();
    const cleanBarcode = product.barcode ? String(product.barcode).trim().toLowerCase() : '';
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => {
        const itemPId = String(item.product_id).trim().toLowerCase();
        const itemBc = item.barcode ? String(item.barcode).trim().toLowerCase() : '';
        return itemPId === cleanId || (cleanBarcode && itemBc && itemBc === cleanBarcode);
      });
      const maxAllowed = product.stock > 0 ? product.stock : 999999;

      if (existingIndex > -1) {
        const currentItem = prevItems[existingIndex];
        const newQty = Math.min(maxAllowed, currentItem.qty + quantityToAdd);
        const isWholesale = newQty >= product.min_wholesale_qty;
        const priceApplied = isWholesale ? product.wholesale_price : product.retail_price;

        const updated = [...prevItems];
        updated[existingIndex] = {
          ...currentItem,
          qty: newQty,
          is_wholesale: isWholesale,
          price_applied: priceApplied,
          subtotal_item: newQty * priceApplied
        };
        return updated;
      } else {
        const initialQty = Math.min(maxAllowed, Math.max(1, quantityToAdd));
        const isWholesale = initialQty >= product.min_wholesale_qty;
        const priceApplied = isWholesale ? product.wholesale_price : product.retail_price;

        const newItem: CartItem = {
          product_id: product.id,
          product_name: product.name,
          buy_price: product.buy_price,
          retail_price: product.retail_price,
          wholesale_price: product.wholesale_price,
          min_wholesale_qty: product.min_wholesale_qty,
          unit: product.unit,
          stock: product.stock,
          barcode: product.barcode,
          qty: initialQty,
          is_wholesale: isWholesale,
          price_applied: priceApplied,
          subtotal_item: initialQty * priceApplied
        };
        return [newItem, ...prevItems];
      }
    });
  }, []);

  const updateQuantity = useCallback((productId: string, newQty: number) => {
    const cleanId = String(productId).trim();
    setItems((prevItems) => {
      if (newQty <= 0) {
        return prevItems.filter((item) => String(item.product_id).trim() !== cleanId);
      }
      return prevItems.map((item) => {
        if (String(item.product_id).trim() === cleanId) {
          const maxAllowed = item.stock > 0 ? item.stock : 999999;
          const clampedQty = Math.min(maxAllowed, newQty);
          const isWholesale = clampedQty >= item.min_wholesale_qty;
          const priceApplied = isWholesale ? item.wholesale_price : item.retail_price;
          return {
            ...item,
            qty: clampedQty,
            is_wholesale: isWholesale,
            price_applied: priceApplied,
            subtotal_item: clampedQty * priceApplied
          };
        }
        return item;
      });
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    const cleanId = String(productId).trim();
    setItems((prevItems) => prevItems.filter((item) => String(item.product_id).trim() !== cleanId));
  }, []);

  const clearMemberBlockedInfo = useCallback(() => {
    setMemberBlockedInfo(null);
  }, []);

  const setMemberId = useCallback((id: string, nameOrDiscount?: string | number) => {
    const cleanId = (id || '').trim();
    const resolvedStoreId = activeStoreId || getCurrentActiveStoreId();
    setMemberIdState(cleanId);
    setMemberDiscountPercent(0);

    if (!cleanId) {
      setCustomerName('');
      setMemberBlockedInfo(null);
      return;
    }

    const applyResolvedCustomer = (cust: Customer, explicitSelect: boolean) => {
      const access = checkCustomerBranchAccess(cust, resolvedStoreId);
      if (!access.allowed) {
        setCustomerName('');
        setMemberBlockedInfo({ ...access, customer: cust });
        if (explicitSelect) {
          setMemberIdState('');
        }
        return false;
      }
      setMemberBlockedInfo(null);
      setCustomerName(cust.name);
      return true;
    };

    if (typeof nameOrDiscount === 'string' && nameOrDiscount.trim()) {
      const fallbackName = nameOrDiscount.trim();
      (async () => {
        try {
          const custById = await db.customers.get(cleanId);
          if (custById) {
            applyResolvedCustomer(custById, true);
            return;
          }
        } catch {}
        setMemberBlockedInfo(null);
        setCustomerName(fallbackName);
      })();
      return;
    }

    setMemberBlockedInfo(null);

    // Resolusi cerdas identitas pelanggan (ID, Kode, No HP, atau Nama)
    (async () => {
      try {
        // 1. Cari via ID eksak
        const custById = await db.customers.get(cleanId);
        if (custById && custById.name) {
          applyResolvedCustomer(custById, false);
          return;
        }

        // 2. Cari via Kode Pelanggan (case-insensitive)
        const custByCode = await db.customers.where('code').equalsIgnoreCase(cleanId).first();
        if (custByCode && custByCode.name) {
          applyResolvedCustomer(custByCode, false);
          return;
        }

        // 3. Cari via No HP
        const custByPhone = await db.customers.where('phone').equalsIgnoreCase(cleanId).first();
        if (custByPhone && custByPhone.name) {
          applyResolvedCustomer(custByPhone, false);
          return;
        }

        // 4. Cari via Nama Pelanggan (case-insensitive)
        const custByName = await db.customers.where('name').equalsIgnoreCase(cleanId).first();
        if (custByName && custByName.name) {
          applyResolvedCustomer(custByName, false);
          return;
        }

        // 5. In-Memory Search: Hanya kunci otomatis jika benar-benar identik (exact match) dengan kode, nama lengkap, atau nomor HP
        const allCusts = await db.customers.toArray();
        const lower = cleanId.toLowerCase();
        const cleanDigits = cleanId.replace(/[^0-9]/g, '');
        const exactMatch = allCusts.find(c => {
          const cName = (c.name || '').trim().toLowerCase();
          const cCode = (c.code || '').trim().toLowerCase();
          const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
          return (
            cName === lower ||
            cCode === lower ||
            (cleanDigits.length >= 7 && cPhone === cleanDigits)
          );
        });

        if (exactMatch && exactMatch.name) {
          applyResolvedCustomer(exactMatch, false);
          return;
        }

        // Jika hanya mengetik sebagian kata (query parsial untuk dropdown suggestions):
        // Biarkan customerName kosong agar kasir bebas melihat dan memilih daftar member di dropdown autocomplete
        setCustomerName('');
      } catch (err) {
        console.warn('[useCart] Gagal mencari data pelanggan:', err);
      }
    })();
  }, [activeStoreId]);

  // Sinkronisasi otomatis data pelanggan yang sedang dipilih jika terjadi pembaruan di latar belakang
  useEffect(() => {
    const resolvedStoreId = activeStoreId || getCurrentActiveStoreId();
    const handleCustUpdated = (cust: any) => {
      if (!cust) return;
      const cleanMember = (memberId || '').trim().toLowerCase();
      const cleanCustName = (customerName || '').trim().toLowerCase();
      const matches =
        (cleanMember && (
          cust.id?.toLowerCase() === cleanMember ||
          cust.code?.toLowerCase() === cleanMember ||
          cust.phone?.toLowerCase() === cleanMember
        )) ||
        (cleanCustName && cust.name?.toLowerCase() === cleanCustName);

      if (matches && cust.name) {
        const access = checkCustomerBranchAccess(cust, resolvedStoreId);
        if (!access.allowed) {
          setMemberIdState('');
          setCustomerName('');
          setMemberBlockedInfo({ ...access, customer: cust });
          return;
        }
        setMemberBlockedInfo(null);
        setCustomerName(cust.name);
      }
    };

    const handleCustDeleted = (id: string) => {
      if (!id) return;
      const cleanMember = (memberId || '').trim().toLowerCase();
      if (cleanMember && (id.toLowerCase() === cleanMember)) {
        setMemberIdState('');
        setCustomerName('');
      }
    };

    const onDomUpdate = (e: any) => handleCustUpdated(e?.detail);
    const onDomDelete = (e: any) => handleCustDeleted(e?.detail?.id);

    window.addEventListener('ketoko_customer_updated', onDomUpdate);
    window.addEventListener('ketoko_customer_deleted', onDomDelete);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('ketoko_customer_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'CUSTOMER_UPDATED' && event.data.customer) {
            handleCustUpdated(event.data.customer);
          } else if (event.data?.type === 'CUSTOMER_DELETED' && event.data.id) {
            handleCustDeleted(event.data.id);
          }
        };
      }
    } catch {}

    return () => {
      window.removeEventListener('ketoko_customer_updated', onDomUpdate);
      window.removeEventListener('ketoko_customer_deleted', onDomDelete);
      if (bc) bc.close();
    };
  }, [memberId, customerName]);

  const clearCart = useCallback(() => {
    setItems([]);
    setMemberIdState('');
    setCustomerName('');
    setMemberBlockedInfo(null);
    setMemberDiscountPercent(0);
  }, []);

  // Summary Calculations
  const { subtotal, wholesaleSavings, discountAmount, taxAmount, grandTotal, totalItemCount } = useMemo(() => {
    let sub = 0;
    let savings = 0;
    let totalItems = 0;

    for (const item of items) {
      sub += item.subtotal_item;
      totalItems += item.qty;
      if (item.is_wholesale) {
        savings += item.qty * (item.retail_price - item.wholesale_price);
      }
    }

    // Diskon pelanggan telah dihilangkan secara menyeluruh (0%)
    const disc = 0;
    
    // Tax (PPN) based on dynamic taxRate
    const taxableBase = sub;
    const tax = taxEnabled ? Math.round(taxableBase * (taxRate / 100)) : 0;
    const grand = taxableBase + tax;

    return {
      subtotal: sub,
      wholesaleSavings: savings,
      discountAmount: disc,
      taxAmount: tax,
      grandTotal: grand,
      totalItemCount: totalItems
    };
  }, [items, taxEnabled, taxRate]);

  // Broadcast cart changes in real-time to Customer Facing Display
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('ketoko_customer_display');
        channel.postMessage({
          type: 'CART_UPDATE',
          items: items.map(it => ({
            name: it.product_name,
            qty: it.qty,
            price: it.price_applied,
            subtotal: it.subtotal_item,
            unit: it.unit || 'Pcs'
          })),
          customerName,
          memberId,
          discount: discountAmount,
          tax: taxAmount,
          subtotal,
          grandTotal
        });
        channel.close();
      }
    } catch (e) {
      // Ignore broadcast errors
    }
  }, [items, customerName, memberId, discountAmount, taxAmount, subtotal, grandTotal]);

  return {
    items,
    memberId,
    customerName,
    setCustomerName,
    setMemberId,
    memberBlockedInfo,
    clearMemberBlockedInfo,
    memberDiscountPercent,
    setMemberDiscountPercent,
    taxEnabled,
    setTaxEnabled,
    taxRate,
    setTaxRate,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    wholesaleSavings,
    discountAmount,
    taxAmount,
    grandTotal,
    totalItemCount
  };
}

