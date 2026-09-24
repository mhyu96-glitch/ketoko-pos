import { useState, useCallback, useMemo } from 'react';
import type { CartItem, Product } from '../types';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [memberId, setMemberId] = useState<string>('');
  const [taxEnabled, setTaxEnabled] = useState<boolean>(true);

  // Add item or increment qty with wholesale evaluation
  const addItem = useCallback((product: Product, quantityToAdd = 1) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.product_id === product.id);
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
    setItems((prevItems) => {
      if (newQty <= 0) {
        return prevItems.filter((item) => item.product_id !== productId);
      }
      return prevItems.map((item) => {
        if (item.product_id === productId) {
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
    setItems((prevItems) => prevItems.filter((item) => item.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setMemberId('');
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

    // Member discount e.g. 5% if member is active
    const disc = memberId.trim().length > 0 ? Math.round(sub * 0.05) : 0;
    
    // Tax 11% (PPN) after discount
    const taxableBase = Math.max(0, sub - disc);
    const tax = taxEnabled ? Math.round(taxableBase * 0.11) : 0;
    const grand = taxableBase + tax;

    return {
      subtotal: sub,
      wholesaleSavings: savings,
      discountAmount: disc,
      taxAmount: tax,
      grandTotal: grand,
      totalItemCount: totalItems
    };
  }, [items, memberId, taxEnabled]);

  return {
    items,
    memberId,
    setMemberId,
    taxEnabled,
    setTaxEnabled,
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

