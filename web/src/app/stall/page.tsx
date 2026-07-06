'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QrCode, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export default function StallDashboard() {
  const [scanning, setScanning] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');


  const handleTokenScanned = async (token: string) => {
    setScannedToken(token);
    setLoading(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('orders')
        .select(`
          *,
          profiles(phone_number),
          stalls(name),
          order_items(quantity, price_at_time, menu_items(name))
        `)
        .eq('qr_token', token)
        .single();

      if (dbError || !data) {
        throw new Error('Order not found or invalid token');
      }

      if (data.status === 'completed') {
        throw new Error('This order has already been completed.');
      }

      setOrderData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeOrder = async () => {
    if (!orderData) return;
    setLoading(true);
    setError('');

    try {
      // 1. Update order in DB
      await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderData.id);

      // 2. Send "Order Complete" notification via WhatsApp
      const phone = orderData.profiles?.phone_number;
      if (phone) {
        const items = orderData.order_items.map((item: any) => ({
          name: item.menu_items?.name || 'Item',
          quantity: item.quantity
        }));

        const res = await fetch('/api/send-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: phone,
            orderId: orderData.id.split('-')[0],
            totalAmount: `Rs. ${orderData.total_amount}`,
            items,
            stallName: orderData.stalls?.name || 'Campus Stall',
          })
        });
        
        if (!res.ok) {
           const errorData = await res.json().catch(() => ({}));
           throw new Error(errorData.error || 'Failed to send WhatsApp receipt');
        }
      }

      setOrderData(null);
      setScannedToken(null);
      setError('');
      // Show success briefly
      setSuccessMsg('✅ Order completed! Customer notified via WhatsApp.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#061208] text-[#fdf0dc] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-brand-gold mb-8 flex items-center gap-3">
          Stall Dashboard
        </h1>

        {successMsg && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4 text-green-400 font-medium animate-pulse">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Scanner Section */}
          <section className="glass-card rounded-2xl p-6 border border-white/10 h-fit">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <QrCode className="text-brand-gold" /> Scan QR
            </h2>
            
            {scanning ? (
              <div className="bg-white rounded-xl overflow-hidden p-2">
                <Scanner
                  onScan={(result) => {
                    if (result && result.length > 0) {
                      setScanning(false);
                      handleTokenScanned(result[0].rawValue);
                    }
                  }}
                  onError={(error) => console.warn(error)}
                />
                <button 
                  onClick={() => setScanning(false)}
                  className="w-full mt-4 py-2 bg-neutral-200 text-black font-bold rounded-lg"
                >
                  Cancel Scanner
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setOrderData(null);
                  setError('');
                  setScanning(true);
                }}
                className="w-full py-12 border-2 border-dashed border-neutral-600 rounded-xl hover:border-brand-gold hover:bg-brand-gold/5 transition-colors flex flex-col items-center justify-center gap-4 text-white/60 hover:text-brand-gold"
              >
                <QrCode className="w-12 h-12" />
                <span className="font-bold">Click to start scanner</span>
              </button>
            )}
          </section>

          {/* Order Details Section */}
          <section className="glass-card rounded-2xl p-6 border border-white/10 min-h-[400px]">
            <h2 className="text-xl font-bold mb-4">Order Details</h2>

            {loading && !scanning ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-brand-gold" />
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            ) : orderData ? (
              <div className="space-y-6">
                <div className="bg-neutral-900 p-4 rounded-xl border border-white/10">
                  <div className="text-sm text-white/60 mb-1">Order ID: {orderData.id.split('-')[0]}</div>
                  <div className="text-xl font-bold text-brand-gold">Rs. {orderData.total_amount}</div>
                </div>
                {orderData.profiles?.phone_number && (
                  <div className="text-sm text-white/50 mt-2">Customer: {orderData.profiles.phone_number}</div>
                )}

                <div>
                  <h3 className="font-bold mb-3 text-white/80">Items:</h3>
                  <ul className="space-y-2">
                    {orderData.order_items.map((item: any, idx: number) => (
                      <li key={idx} className="flex justify-between bg-neutral-900 p-3 rounded-lg border border-white/10">
                        <span>{item.quantity}x {item.menu_items?.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={completeOrder}
                  className="w-full py-4 rounded-xl bg-green-500 text-black font-extrabold hover:bg-green-400 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-6 h-6" /> Collect Cash & Complete
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 text-white/50">
                <QrCode className="w-16 h-16 mb-4 opacity-50" />
                <p>Scan a token to view order</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
