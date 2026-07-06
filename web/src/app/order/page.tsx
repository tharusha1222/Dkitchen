'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/components/CartProvider';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Trash2, CheckCircle2, Loader2, Minus, Plus, Soup, X, ShoppingCart, MapPin, Receipt, Ticket } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const typeColors: Record<string, string> = {
  curry: 'bg-brand-gold/10 text-brand-gold border border-brand-gold/20',
  sauce: 'bg-wa/10 text-wa border border-wa/20',
  side: 'bg-white/10 text-white/70 border border-white/20',
};

export default function OrderPage() {
  const { cart, removeFromCart, updateQuantity, total, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [stalls, setStalls] = useState<any[]>([]);
  const [selectedStallId, setSelectedStallId] = useState<string>('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const phone = localStorage.getItem('canteen_user_phone');
    if (!phone) { router.push('/auth'); return; }
    setUserName(localStorage.getItem('canteen_user_name'));
    const fetchStalls = async () => {
      const { data } = await supabase.from('stalls').select('*').order('name');
      if (data) setStalls(data);
    };
    fetchStalls();
  }, []);

  const applyPromo = async () => {
    setPromoError('');
    if (!promoCodeInput.trim()) return;
    setCheckingPromo(true);

    try {
      const { data, error } = await supabase
        .from('offers')
        .select('code, discount_percentage')
        .eq('code', promoCodeInput.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setPromoError('Invalid or expired promo code.');
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo({ code: data.code, discount: data.discount_percentage });
      setPromoCodeInput('');
    } catch (err) {
      setPromoError('Error checking promo code.');
    } finally {
      setCheckingPromo(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoError('');
  };

  const discountAmount = appliedPromo ? (total * appliedPromo.discount) / 100 : 0;
  const finalTotal = total - discountAmount;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      const userPhone = localStorage.getItem('canteen_user_phone');
      const userNameStored = localStorage.getItem('canteen_user_name');
      if (!userPhone) {
        router.push('/auth');
        return;
      }

      const token = `ORDER_${Date.now()}_${userPhone}`;

      const { data: orderData, error: orderError } = await supabase.from('orders').insert({
        total_amount: finalTotal,
        promo_code: appliedPromo?.code || null,
        qr_token: token,
        status: 'pending',
        stall_id: selectedStallId,
      }).select().single();

      if (orderError) {
        console.error("Supabase insert error:", orderError);
        alert(`Failed to place order: ${orderError.message}`);
        throw new Error(orderError.message);
      }

      if (orderData) {
        const itemsToInsert = cart.map(item => ({
          order_id: orderData.id,
          menu_item_id: item.id,
          quantity: item.quantity,
          price_at_time: item.price,
          // Store accompaniment names as notes (we'll expand this later)
          notes: item.selectedAccomps.map(a => a.name).join(', '),
        }));
        await supabase.from('order_items').insert(itemsToInsert);

        // Send QR + order summary to WhatsApp
        const stallName = stalls.find(s => s.id === selectedStallId)?.name;
        try {
          const orderItems = cart.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            accompaniments: item.selectedAccomps.map(a => ({
              name: a.name,
              price: a.price || 0,
            })),
          }));

          await fetch('/api/send-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              phoneNumber: userPhone,
              name: userNameStored || undefined,
              qrToken: token, 
              stallName,
              items: orderItems,
              subtotal: total,
              discount: discountAmount,
              finalTotal,
              promoCode: appliedPromo?.code || null,
            })
          });
        } catch (err) {
          console.error("Failed to send QR via WhatsApp", err);
        }
      }
      setQrToken(token);
      clearCart();
    } catch (error) {
      console.error("Order placement failed:", error);
      alert("Failed to process order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (qrToken) {
    const firstName = userName ? userName.split(' ')[0] : null;
    return (
      <div className="min-h-screen bg-[#061208] text-[#fdf0dc] relative overflow-x-hidden flex flex-col items-center justify-center p-4">
        <div className="fixed pointer-events-none inset-0 z-0" aria-hidden="true">
          <div className="absolute top-[-10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-[#2D6A4F]/20 blur-[90px]" />
          <div className="absolute bottom-[-10%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-[#40916C]/25 blur-[90px]" />
        </div>
        <div className="relative z-10 glass-card p-8 max-w-md w-full text-center overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-gold to-yellow-500" />
          <CheckCircle2 className="w-16 h-16 text-brand-gold mx-auto mb-5" />
          <h2 className="text-3xl font-serif font-bold mb-2 text-gradient">
            {firstName ? `Thanks, ${firstName}!` : 'Order Placed!'}
          </h2>
          <p className="text-white/60 mb-8">Your QR code has been sent to your WhatsApp. Show it at the stall to collect your meal.</p>
          <Link href="/" className="block w-full py-4 rounded-xl bg-brand-gold text-black font-extrabold hover:bg-brand-gold/90 transition-colors shadow-[0_0_15px_rgba(212,160,23,0.3)]">
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061208] text-[#fdf0dc] relative overflow-x-hidden p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2 hover:bg-black/40 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-bold">Your Cart</h1>
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-24 glass-card rounded-3xl border border-white/10 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <ShoppingCart className="w-12 h-12 text-white/20" />
            </div>
            <p className="text-xl text-white/60 mb-8 font-medium">Your cart is empty.</p>
            <Link href="/" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-gold text-black font-bold hover:bg-orange-400 transition-colors shadow-[0_0_15px_rgba(212,160,23,0.2)]">
              Browse Menu
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <div key={item.cartKey} className="glass-card bg-black/40 p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-5">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Item Icon */}
                      <div className="w-14 h-14 rounded-xl bg-brand-gold/10 flex items-center justify-center shrink-0 border border-brand-gold/20 overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Soup className="w-7 h-7 text-brand-gold" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 pt-1">
                        <h3 className="font-bold text-lg leading-tight text-white/90">{item.name}</h3>
                        <p className="text-brand-gold font-bold mt-1">Rs. {(item.price * item.quantity).toFixed(2)}</p>

                        {/* Accompaniments */}
                        {(item.selectedAccomps?.length ?? 0) > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="flex items-center gap-1 text-xs text-white/50">
                              <Soup className="w-3 h-3" />
                            </span>
                            {item.selectedAccomps?.map(a => (
                              <span key={a.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[a.type]}`}>
                                {a.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Qty controls + delete */}
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-neutral-900 rounded-lg border border-white/10 overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.cartKey, -1)}
                          className="px-2.5 py-1.5 hover:bg-black/40 transition-colors text-white/80"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 py-1.5 font-bold text-sm min-w-[2rem] text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartKey, 1)}
                          className="px-2.5 py-1.5 hover:bg-black/40 transition-colors text-white/80"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.cartKey)}
                        className="p-1.5 text-white/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="glass-card bg-black/40 p-6 rounded-3xl border border-white/10 h-fit sticky top-24">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Receipt className="w-6 h-6 text-brand-gold" />
                Order Summary
              </h3>
              
              {/* Stall Selection */}
              <div className="mb-6 bg-white/5 p-5 rounded-2xl border border-white/5">
                <label className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3">
                  <MapPin className="w-4 h-4 text-brand-gold" />
                  Collection Stall
                </label>
                <select
                  value={selectedStallId}
                  onChange={e => setSelectedStallId(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-gold transition-colors text-white"
                  required
                >
                  <option value="">-- Select a Stall --</option>
                  {stalls.map(stall => (
                    <option key={stall.id} value={stall.id}>
                      {stall.name} {stall.location ? `(${stall.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {/* Promo Code */}
              <div className="mb-6 bg-white/5 p-5 rounded-2xl border border-white/5">
                <label className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3">
                  <Ticket className="w-4 h-4 text-brand-gold" />
                  Promo Code
                </label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                    <div>
                      <span className="font-bold text-green-400">{appliedPromo.code}</span>
                      <span className="text-sm text-green-400/80 ml-2">({appliedPromo.discount}% off)</span>
                    </div>
                    <button onClick={removePromo} className="text-white/50 hover:text-red-400 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 min-w-0 w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-gold transition-colors text-white uppercase"
                      />
                      <button
                        onClick={applyPromo}
                        disabled={checkingPromo || !promoCodeInput.trim()}
                        className="px-4 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-neutral-600 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
                      >
                        {checkingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                    {promoError && <p className="text-red-400 text-sm mt-2">{promoError}</p>}
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-6 text-white/80">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rs. {total.toFixed(2)}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount ({appliedPromo.code})</span>
                    <span>-Rs. {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-3 flex justify-between font-bold text-lg text-white">
                  <span>Total</span>
                  <span className="text-brand-gold">Rs. {finalTotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={loading || !selectedStallId}
                className="w-full py-4 rounded-xl bg-brand-gold text-black font-extrabold shadow-[0_0_15px_rgba(212,160,23,0.4)] hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : !selectedStallId ? (
                  'Select a Stall to Order'
                ) : (
                  'Place Order — Pay at Stall'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
