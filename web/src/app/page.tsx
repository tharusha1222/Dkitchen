'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingCart, X, Soup, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/CartProvider';

type Accompaniment = {
  id: string;
  name: string;
  type: 'curry' | 'sauce' | 'side';
  is_available: boolean;
  price: number;
};

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  accompaniments?: Accompaniment[];
};

const typeColors: Record<string, string> = {
  curry: 'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
  sauce: 'bg-wa/10 text-wa border-wa/20',
  side: 'bg-white/10 text-white/70 border-white/20',
};

export default function Home() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showPromo, setShowPromo] = useState(false);
  const [activePromos, setActivePromos] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedAccomps, setSelectedAccomps] = useState<string[]>([]);
  const { cart, addToCart } = useCart();
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  const fetchMenu = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*, accompaniments(*)')
      .eq('is_available', true);

    if (data) {
      setMenuItems(data as MenuItem[]);
    } else {
      setMenuItems([
        { id: '1', name: 'Spicy Chicken Burger', description: 'Juicy chicken patty with special spicy sauce', price: 5.99, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80', is_available: true, accompaniments: [] },
        { id: '2', name: 'Cheesy Fries', description: 'Crispy fries loaded with melted cheese', price: 3.49, image_url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&q=80', is_available: true, accompaniments: [] },
      ]);
    }
  };

  const fetchPromos = async () => {
    const { data } = await supabase.from('offers').select('*').eq('is_active', true);
    if (data && data.length > 0) {
      setActivePromos(data);
      const seenCodes: string[] = JSON.parse(localStorage.getItem('seenPromoCodes') || '[]');
      const newPromos = data.filter((p: any) => !seenCodes.includes(p.code));
      if (newPromos.length > 0) {
        setShowPromo(true);
        const allCodes = data.map((p: any) => p.code);
        localStorage.setItem('seenPromoCodes', JSON.stringify(allCodes));
      }
    }
  };

  useEffect(() => {
    const phone = localStorage.getItem('canteen_user_phone');
    const name = localStorage.getItem('canteen_user_name');
    if (!phone) {
      router.push('/auth');
      return;
    }
    setUserPhone(phone);
    setUserName(name);
    setAuthChecked(true);
    fetchMenu();
    fetchPromos();
  }, [router]);

  const openItemSelector = (item: MenuItem) => {
    const availableAccomps = item.accompaniments?.filter(a => a.is_available) || [];
    if (availableAccomps.length === 0) {
      addToCart({ ...item, selectedAccomps: [] });
    } else {
      setSelectedItem(item);
      setSelectedAccomps([]);
    }
  };

  const toggleAccomp = (id: string) => {
    setSelectedAccomps(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const confirmAddToCart = () => {
    if (!selectedItem) return;
    const chosenAccomps = selectedItem.accompaniments?.filter(a => selectedAccomps.includes(a.id)) || [];
    addToCart({ ...selectedItem, selectedAccomps: chosenAccomps });
    setSelectedItem(null);
    setSelectedAccomps([]);
  };

  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-[#061208] text-[#fdf0dc] font-sans selection:bg-[#d4a017]/30 selection:text-[#fdf0dc] overflow-x-hidden">
      {/* Ambient glow orbs */}
      <div className="fixed pointer-events-none inset-0 z-0" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-[#2D6A4F]/20 blur-[90px]" />
        <div className="absolute bottom-[-10%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-[#40916C]/25 blur-[90px]" />
        <div className="absolute top-[30%] left-[50%] w-[35%] h-[35%] rounded-full bg-[#D4A017]/15 blur-[80px]" />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass-panel rounded-none border-t-0 border-x-0 border-b border-white/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="DKitchen Logo" className="w-10 h-10 rounded-full object-cover border border-brand-gold/30 shadow-[0_0_10px_rgba(212,160,23,0.3)]" />
            <span className="font-bold text-xl tracking-tight text-brand-gold font-serif">DKitchen</span>
          </div>
          <nav className="flex items-center gap-6">
            {userPhone && (
              <div className="flex items-center gap-3">
                {userName && (
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center text-brand-gold text-xs font-bold">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white/80">{userName.split(' ')[0]}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    localStorage.removeItem('canteen_user_phone');
                    localStorage.removeItem('canteen_user_name');
                    router.push('/auth');
                  }}
                  className="text-xs font-medium text-white/40 hover:text-red-400 transition-colors border border-white/10 hover:border-red-400/30 px-3 py-1.5 rounded-lg"
                >
                  Logout
                </button>
              </div>
            )}
            <Link href="/order" className="relative p-2 hover:bg-black/40 rounded-full transition-colors group">
              <ShoppingCart className="w-5 h-5 group-hover:text-brand-gold transition-colors" />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-brand-gold text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-14 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="DKitchen" className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-2 border-brand-gold/40 shadow-[0_0_30px_rgba(212,160,23,0.25)]" />
          </div>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 text-brand-gold text-xs font-medium tracking-widest uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
            Now Serving Fresh Meals
          </div>
          <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight mb-5 text-gradient leading-[1.1]">
            {userName ? `Hello, ${userName.split(' ')[0]}! \uD83D\uDC4B` : 'Satisfy Your Cravings.'}
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto font-light leading-relaxed">
            {userName
              ? `Welcome back to DKitchen! Authentic Sri Lankan Rice & Curry, made fresh daily just for you.`
              : 'Authentic Sri Lankan Rice & Curry. Homestyle meals made fresh daily. Order now, skip the line.'}
          </p>
          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-4 mt-8 mb-2">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-brand-gold/50" />
            <span className="text-brand-gold text-lg">&#10022;</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-brand-gold/50" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
            const availableAccomps = item.accompaniments?.filter(a => a.is_available) || [];
            return (
              <div key={item.id} className="group relative glass-card overflow-hidden hover:border-brand-gold/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,160,23,0.2)]">
                <div className="aspect-video w-full overflow-hidden bg-black/40">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">No Image</div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-serif font-bold text-xl text-white">{item.name}</h3>
                    <span className="font-bold text-brand-gold">Rs. {Number(item.price).toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-white/70 mb-3 line-clamp-2">{item.description}</p>

                  {/* Accompaniment preview tags */}
                  {availableAccomps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="flex items-center gap-1 text-xs text-white/50">
                        <Soup className="w-3 h-3" /> Comes with:
                      </span>
                      {availableAccomps.slice(0, 3).map(a => (
                        <span key={a.id} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColors[a.type]}`}>
                          {a.name}
                        </span>
                      ))}
                      {availableAccomps.length > 3 && (
                        <span className="text-xs text-white/50">+{availableAccomps.length - 3} more</span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => openItemSelector(item)}
                    className="w-full py-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/20 text-brand-gold font-semibold hover:bg-brand-gold hover:text-black transition-all active:scale-[0.98]"
                  >
                    {availableAccomps.length > 0 ? 'Choose & Add to Cart' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Accompaniment Selector Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel rounded-t-3xl md:rounded-2xl w-full md:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-xl font-bold">{selectedItem.name}</h2>
                <button onClick={() => setSelectedItem(null)} className="text-white/70 hover:text-white transition-colors ml-4">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-brand-gold font-bold mb-4">Rs. {Number(selectedItem.price).toFixed(2)}</p>

              <div className="mb-6">
                <p className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
                  <Soup className="w-4 h-4 text-brand-gold" /> Select your curries & sauces:
                </p>
                <div className="space-y-2">
                  {selectedItem.accompaniments?.filter(a => a.is_available).map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAccomp(a.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                        selectedAccomps.includes(a.id)
                          ? 'border-brand-gold bg-brand-gold/10 shadow-[0_0_10px_rgba(212,160,23,0.15)] text-white'
                          : 'border-white/10 bg-black/40 text-white/70 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColors[a.type]}`}>{a.type}</span>
                        <span className="font-medium">{a.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.price > 0 ? (
                          <span className="text-xs font-bold text-brand-gold">+Rs. {Number(a.price).toFixed(2)}</span>
                        ) : (
                          <span className="text-xs text-white/50">free</span>
                        )}
                        {selectedAccomps.includes(a.id) && (
                          <Check className="w-4 h-4 text-brand-gold shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Running extra cost */}
                {(() => {
                  const extraCost = selectedItem.accompaniments
                    ?.filter(a => selectedAccomps.includes(a.id))
                    .reduce((sum, a) => sum + (a.price || 0), 0) ?? 0;
                  return extraCost > 0 ? (
                    <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
                      <div className="flex justify-between text-white/70 text-sm">
                        <span>Base Price</span>
                        <span>Rs. {Number(selectedItem.price).toFixed(2)}</span>
                      </div>
                      {extraCost > 0 && (
                        <div className="flex justify-between text-brand-gold/80 text-sm">
                          <span>Add-ons</span>
                          <span className="text-brand-gold">+Rs. {extraCost.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10 mt-2">
                        <span>Total</span>
                        <span className="text-brand-gold">Rs. {(Number(selectedItem.price) + extraCost).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              <button
                onClick={confirmAddToCart}
                className="w-full py-3.5 rounded-xl bg-brand-gold text-black font-extrabold hover:shadow-[0_0_15px_rgba(212,160,23,0.4)] transition-all active:scale-[0.98]"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promo Popup */}
      {showPromo && activePromos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative bg-neutral-900 border border-brand-gold/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <button onClick={() => setShowPromo(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors bg-black/50 rounded-full p-1 z-10">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h2 className="text-2xl font-black mb-4 text-gradient uppercase tracking-wider">Today's Deals!</h2>
              <div className="space-y-4 mb-2">
                {activePromos.map(promo => (
                  <div key={promo.id} className="relative overflow-hidden rounded-xl border border-brand-gold/20 bg-black/40">
                    {promo.image_url && (
                      <div className="w-full h-40 bg-black/40 relative">
                        <img src={promo.image_url} alt="Promo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                          <span className="text-white font-black text-2xl drop-shadow-md">{promo.discount_percentage}% OFF</span>
                        </div>
                      </div>
                    )}
                    <div className="p-4 flex items-center justify-between bg-brand-gold/5">
                      <div className="flex flex-col items-start">
                        <span className="text-xs text-white/70 uppercase tracking-wider font-bold mb-1">Use Code</span>
                        <span className="font-mono font-bold text-xl text-brand-gold bg-brand-gold/10 px-3 py-1 rounded-lg border border-brand-gold/20">{promo.code}</span>
                      </div>
                      {!promo.image_url && (
                        <span className="font-black text-2xl text-white">{promo.discount_percentage}% OFF</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowPromo(false)} className="mt-6 w-full py-3 bg-black/40 hover:bg-neutral-700 text-white font-bold rounded-xl transition-colors">
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

