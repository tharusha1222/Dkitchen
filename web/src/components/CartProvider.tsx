'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Accompaniment = {
  id: string;
  name: string;
  type: 'curry' | 'sauce' | 'side';
  price: number;
};

export type CartItem = {
  cartKey: string;      // unique key: itemId + sorted accomp ids
  id: string;           // menu_item id
  name: string;
  price: number;
  quantity: number;
  selectedAccomps: Accompaniment[];
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: any) => void;
  removeFromCart: (cartKey: string) => void;
  updateQuantity: (cartKey: string, delta: number) => void;
  clearCart: () => void;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

function buildCartKey(itemId: string, accomps: Accompaniment[]): string {
  const sorted = [...accomps].sort((a, b) => a.id.localeCompare(b.id)).map(a => a.id).join('_');
  return `${itemId}__${sorted}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('canteen_cart');
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('canteen_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item: any) => {
    const accomps: Accompaniment[] = item.selectedAccomps || [];
    const cartKey = buildCartKey(item.id, accomps);

    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing) {
        return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        cartKey,
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        selectedAccomps: accomps,
      }];
    });
  };

  const removeFromCart = (cartKey: string) => {
    setCart(prev => prev.filter(i => i.cartKey !== cartKey));
  };

  const updateQuantity = (cartKey: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const total = cart.reduce((sum, item) => {
    const accompTotal = item.selectedAccomps?.reduce((s, a) => s + (a.price || 0), 0) ?? 0;
    return sum + (item.price + accompTotal) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
