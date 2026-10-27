import { useState, useCallback, useMemo } from 'react';
import type { CartItem, Product } from '../types';
import { db } from '../db';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [memberId, setMemberIdState] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
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
    const cleanId = String(product.id).trim();
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => String(item.product_id).trim() === cleanId);
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

  const setMemberId = useCallback((id: string, nameOrDiscount?: string | number) => {
    const cleanId = (id || '').trim();
    setMemberIdState(cleanId);
    if (!cleanId) {
      setCustomerName('');
      setMemberDiscountPercent(0);
      return;
    }
    if (typeof nameOrDiscount === 'string' && nameOrDiscount.trim()) {
      setCustomerName(nameOrDiscount.trim());
    } else {
      db.customers.get(cleanId).then((cust) => {
        if (cust && cust.name) {
          setCustomerName(cust.name);
        } else {
          db.customers.where('code').equalsIgnoreCase(cleanId).first().then((c2) => {
            if (c2 && c2.name) setCustomerName(c2.name);
          }).catch(() => {});
        }
      }).catch(() => {});
    }
    // Diskon pelanggan dihilangkan sesuai permintaan
    setMemberDiscountPercent(0);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setMemberIdState('');
    setCustomerName('');
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

  return {
    items,
    memberId,
    customerName,
    setCustomerName,
    setMemberId,
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

