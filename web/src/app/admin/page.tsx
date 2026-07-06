'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, XCircle, Plus, Trash2, ChevronDown, ChevronUp, Soup, DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

// Toggle switch component
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-brand-gold' : 'bg-neutral-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [stallPasswordInput, setStallPasswordInput] = useState('');
  const [passwordUpdateMsg, setPasswordUpdateMsg] = useState('');

  const [botStatus, setBotStatus] = useState<{ connected: boolean; qr: string | null }>({ connected: false, qr: null });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', image_url: '', is_available: true });
  
  // Accompaniments for the new item being created
  const [newAccompaniments, setNewAccompaniments] = useState<{ name: string; type: 'curry' | 'sauce' | 'side'; price: number }[]>([]);
  const [newAccompInput, setNewAccompInput] = useState({ name: '', type: 'curry' as 'curry' | 'sauce' | 'side', price: '' });

  // Promo Blast state
  const [promoMessage, setPromoMessage] = useState('');
  const [sendingPromo, setSendingPromo] = useState(false);
  const [promoResult, setPromoResult] = useState('');

  // Offers state
  const [offers, setOffers] = useState<any[]>([]);
  const [newOffer, setNewOffer] = useState({ code: '', discount_percentage: '', image_url: '', is_active: true });

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  // Stalls state
  const [stalls, setStalls] = useState<any[]>([]);
  const [newStall, setNewStall] = useState({ name: '', location: '' });

  useEffect(() => {
    checkBotStatus();
    const interval = setInterval(checkBotStatus, 5000);
    fetchMenu();
    fetchOffers();
    fetchStalls();
    fetchAnalytics();
    fetchStallPassword();
    if (sessionStorage.getItem('adminAuth') === 'true') {
      setIsAuthenticated(true);
    }
    return () => clearInterval(interval);
  }, []);

  const fetchStallPassword = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'stall_password').single();
    if (data) setStallPasswordInput(data.value);
  };

  const updateStallPassword = async () => {
    const { error } = await supabase.from('settings').upsert({ key: 'stall_password', value: stallPasswordInput });
    if (!error) {
      setPasswordUpdateMsg('Password updated successfully!');
      setTimeout(() => setPasswordUpdateMsg(''), 3000);
    } else {
      setPasswordUpdateMsg('Error updating password.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput })
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('adminAuth', 'true');
      } else {
        setAuthError(data.error || 'Invalid password');
      }
    } catch (err) {
      setAuthError('Error verifying password');
    }
  };

  const fetchAnalytics = async () => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(*, menu_items(name)), stalls(name)')
      .eq('status', 'completed');

    if (error || !orders) return;

    let totalRev = 0;
    const itemsMap: Record<string, number> = {};
    const stallsMap: Record<string, number> = {};

    orders.forEach(o => {
      totalRev += o.total_amount;
      
      const stallName = o.stalls?.name || 'Unknown';
      stallsMap[stallName] = (stallsMap[stallName] || 0) + o.total_amount;

      o.order_items.forEach((oi: any) => {
        const itemName = oi.menu_items?.name || 'Unknown';
        itemsMap[itemName] = (itemsMap[itemName] || 0) + oi.quantity;
      });
    });

    const topItems = Object.entries(itemsMap)
      .map(([name, qty]) => ({ name, value: qty }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const stallData = Object.entries(stallsMap)
      .map(([name, rev]) => ({ name, value: rev }));

    setAnalyticsData({
      totalRevenue: totalRev,
      totalOrders: orders.length,
      averageOrder: orders.length ? (totalRev / orders.length) : 0,
      topItems,
      stallData
    });
  };

  const fetchStalls = async () => {
    const { data } = await supabase.from('stalls').select('*').order('created_at', { ascending: false });
    if (data) setStalls(data);
  };

  const handleAddStall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStall.name.trim()) return;
    const { data } = await supabase.from('stalls').insert([{
      name: newStall.name,
      location: newStall.location
    }]).select();

    if (data) {
      setStalls([data[0], ...stalls]);
      setNewStall({ name: '', location: '' });
    }
  };

  const handleDeleteStall = async (id: string) => {
    await supabase.from('stalls').delete().eq('id', id);
    setStalls(stalls.filter(s => s.id !== id));
  };

  const checkBotStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setBotStatus(data);
    } catch (e) {
      // Bot offline - silently ignore
    }
  };

  const fetchMenu = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*, accompaniments(*)')
      .order('created_at', { ascending: false });
    if (data) setMenuItems(data as MenuItem[]);
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('menu_items').insert([{
      ...newItem,
      price: parseFloat(newItem.price)
    }]).select();

    if (data && data[0]) {
      const itemId = data[0].id;

      // Insert accompaniments if any
      if (newAccompaniments.length > 0) {
        await supabase.from('accompaniments').insert(
          newAccompaniments.map(a => ({ ...a, menu_item_id: itemId }))
        );
      }

      setMenuItems([{ ...data[0], accompaniments: newAccompaniments.map((a, i) => ({ ...a, id: `temp-${i}`, is_available: true })) }, ...menuItems]);
      setNewItem({ name: '', description: '', price: '', image_url: '', is_available: true });
      setNewAccompaniments([]);
      // Re-fetch to get real IDs
      fetchMenu();
    }
  };

  const addAccompToNewItem = () => {
    if (!newAccompInput.name.trim()) return;
    setNewAccompaniments([...newAccompaniments, { 
      name: newAccompInput.name, 
      type: newAccompInput.type, 
      price: parseFloat(newAccompInput.price) || 0 
    }]);
    setNewAccompInput({ name: '', type: 'curry', price: '' });
  };

  const removeAccompFromNewItem = (index: number) => {
    setNewAccompaniments(newAccompaniments.filter((_, i) => i !== index));
  };

  const toggleItemAvailability = async (id: string, current: boolean) => {
    await supabase.from('menu_items').update({ is_available: !current }).eq('id', id);
    setMenuItems(menuItems.map(item => item.id === id ? { ...item, is_available: !current } : item));
  };

  const deleteItem = async (id: string) => {
    await supabase.from('menu_items').delete().eq('id', id);
    setMenuItems(menuItems.filter(item => item.id !== id));
  };

  const toggleAccompAvailability = async (menuItemId: string, accompId: string, current: boolean) => {
    await supabase.from('accompaniments').update({ is_available: !current }).eq('id', accompId);
    setMenuItems(menuItems.map(item => {
      if (item.id !== menuItemId) return item;
      return {
        ...item,
        accompaniments: item.accompaniments?.map(a =>
          a.id === accompId ? { ...a, is_available: !current } : a
        )
      };
    }));
  };

  const addAccompToExistingItem = async (menuItemId: string, name: string, type: 'curry' | 'sauce' | 'side', price: number) => {
    if (!name.trim()) return;
    const { data } = await supabase.from('accompaniments').insert([{
      menu_item_id: menuItemId, name, type, is_available: true, price: price || 0
    }]).select().single();

    if (data) {
      setMenuItems(menuItems.map(item => {
        if (item.id !== menuItemId) return item;
        return { ...item, accompaniments: [...(item.accompaniments || []), data] };
      }));
    }
  };

  const deleteAccomp = async (menuItemId: string, accompId: string) => {
    await supabase.from('accompaniments').delete().eq('id', accompId);
    setMenuItems(menuItems.map(item => {
      if (item.id !== menuItemId) return item;
      return { ...item, accompaniments: item.accompaniments?.filter(a => a.id !== accompId) };
    }));
  };

  const fetchOffers = async () => {
    const { data } = await supabase.from('offers').select('*').order('created_at', { ascending: false });
    if (data) setOffers(data);
  };

  const handleAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from('offers').insert([{
      code: newOffer.code,
      discount_percentage: parseFloat(newOffer.discount_percentage),
      image_url: newOffer.image_url,
      is_active: newOffer.is_active
    }]).select();
    if (data) {
      setOffers([...data, ...offers]);
      setNewOffer({ code: '', discount_percentage: '', image_url: '', is_active: true });
    }
  };

  const toggleOfferStatus = async (id: string, current: boolean) => {
    await supabase.from('offers').update({ is_active: !current }).eq('id', id);
    setOffers(offers.map(o => o.id === id ? { ...o, is_active: !current } : o));
  };

  const deleteOffer = async (id: string) => {
    await supabase.from('offers').delete().eq('id', id);
    setOffers(offers.filter(o => o.id !== id));
  };

  const typeColors = {
    curry: 'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
    sauce: 'bg-red-500/10 text-red-400 border-red-500/20',
    side: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };

  const tabs = [
    { id: 'bot',   label: 'Bot Connection', icon: '🤖' },
    { id: 'menu',  label: 'Menu',           icon: '🍽️' },
    { id: 'stalls', label: 'Stalls',         icon: '🏪' },
    { id: 'promos', label: 'Promos',        icon: '🏷️' },
    { id: 'analytics', label: 'Analytics',  icon: '📈' },
    { id: 'security', label: 'Security', icon: '🔒' },
  ];
  const [activeTab, setActiveTab] = useState('bot');

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#061208] flex items-center justify-center p-4">
        <form onSubmit={handleAdminLogin} className="glass-card p-8 rounded-2xl w-full max-w-sm border border-brand-gold/20 shadow-[0_0_20px_rgba(212,160,23,0.15)]">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="DKitchen Admin" className="w-20 h-20 rounded-full object-cover border-2 border-brand-gold/40 shadow-[0_0_15px_rgba(212,160,23,0.4)]" />
          </div>
          <h2 className="text-2xl font-bold mb-6 text-white text-center">Admin Login</h2>
          <input
            type="password"
            value={adminPasswordInput}
            onChange={(e) => setAdminPasswordInput(e.target.value)}
            className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-gold mb-4 transition-colors"
            placeholder="Enter Admin Password"
          />
          {authError && <p className="text-red-400 text-sm mb-4 text-center">{authError}</p>}
          <button type="submit" className="w-full bg-brand-gold text-black font-extrabold py-3 rounded-xl hover:shadow-[0_0_15px_rgba(212,160,23,0.4)] transition-all active:scale-[0.98]">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061208] text-[#fdf0dc]">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-gold to-yellow-600 flex items-center justify-center font-bold text-black text-sm">C</div>
            <span className="font-bold text-lg text-orange-50">DKitchen <span className="text-white/50 font-normal text-sm">/ Admin</span></span>
          </div>
          {/* Bot indicator */}
          <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
            botStatus.connected
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${botStatus.connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {botStatus.connected ? 'Bot Online' : 'Bot Offline'}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex gap-1 pb-0 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'border-brand-gold text-brand-gold'
                  : 'border-transparent text-white/50 hover:text-white/80'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">

        {/* ── BOT TAB ── */}
        {activeTab === 'bot' && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-8 border border-white/10">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                WhatsApp Bot Connection
                {botStatus.connected ? <CheckCircle2 className="text-green-500 w-5 h-5" /> : <XCircle className="text-red-500 w-5 h-5" />}
              </h2>
              {!botStatus.connected ? (
                <div className="flex flex-col items-center py-10 bg-neutral-900 rounded-xl border border-white/10">
                  {botStatus.qr ? (
                    <>
                      <p className="text-white/60 mb-6 text-center max-w-xs">Open WhatsApp on your phone → Linked Devices → Link a Device, then scan this code.</p>
                      <div className="bg-white p-5 rounded-2xl shadow-lg shadow-black/40">
                        <QRCodeSVG value={botStatus.qr} size={240} />
                      </div>
                      <p className="text-xs text-neutral-600 mt-4">QR refreshes automatically every ~20 seconds</p>
                    </>
                  ) : (
                    <div className="text-center">
                      <p className="text-white/50 animate-pulse mb-2">Waiting for QR Code from Baileys...</p>
                      <p className="text-xs text-neutral-600">Make sure the WhatsApp bot server is running on port 3001</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 bg-green-500/5 border border-green-500/20 rounded-xl gap-3">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                  <p className="text-green-400 font-bold text-lg">WhatsApp Bot is Connected!</p>
                  <p className="text-white/50 text-sm">The bot is ready to send OTPs, receipts, and broadcast messages.</p>
                  <button 
                    onClick={async () => {
                      const res = await fetch('/api/disconnect', { method: 'POST' });
                      if (res.ok) {
                        checkBotStatus();
                      } else {
                        alert('Failed to disconnect');
                      }
                    }}
                    className="mt-4 bg-red-500/20 text-red-400 hover:bg-red-500/30 px-6 py-2 rounded-xl font-bold transition-colors border border-red-500/30"
                  >
                    Disconnect Device
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MENU TAB ── */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            {/* Add New Item */}
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <h2 className="text-lg font-bold mb-5 text-brand-gold uppercase tracking-widest text-sm">Add New Item</h2>
              <form onSubmit={handleAddMenuItem} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Item Name" required value={newItem.name}
                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors" />
                  <input type="number" step="0.01" placeholder="Price (e.g. 3.50)" required value={newItem.price}
                    onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors" />
                  <input type="text" placeholder="Image URL" value={newItem.image_url}
                    onChange={e => setNewItem({ ...newItem, image_url: e.target.value })}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors" />
                  <label className="flex items-center gap-3 cursor-pointer bg-neutral-900 border border-white/10 rounded-xl px-4 py-3">
                    <Toggle checked={newItem.is_available} onChange={() => setNewItem({ ...newItem, is_available: !newItem.is_available })} />
                    <span className="text-sm text-white/80">Available on menu</span>
                  </label>
                  <textarea placeholder="Description" required value={newItem.description}
                    onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors md:col-span-2" rows={2} />
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                    <Soup className="w-4 h-4 text-brand-gold" /> Curries & Sauces
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 mb-3">
                    <input type="text" placeholder="e.g. Dhal Curry, BBQ Sauce" value={newAccompInput.name}
                      onChange={e => setNewAccompInput({ ...newAccompInput, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAccompToNewItem(); } }}
                      className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-colors w-full" />
                    <select value={newAccompInput.type} onChange={e => setNewAccompInput({ ...newAccompInput, type: e.target.value as any })}
                      className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-colors w-full sm:w-auto">
                      <option value="curry">Curry</option>
                      <option value="sauce">Sauce</option>
                      <option value="side">Side</option>
                    </select>
                    <input type="number" step="0.01" min="0" placeholder="Extra price"
                      value={newAccompInput.price}
                      onChange={e => setNewAccompInput({ ...newAccompInput, price: e.target.value })}
                      className="bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-gold transition-colors w-full sm:w-32" />
                    <button type="button" onClick={addAccompToNewItem}
                      className="bg-white/10 hover:bg-brand-gold hover:text-black text-white px-4 py-2.5 rounded-xl font-bold transition-colors w-full sm:w-auto flex justify-center items-center">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {newAccompaniments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newAccompaniments.map((a, i) => (
                        <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${typeColors[a.type]}`}>
                          {a.name}
                          {a.price > 0 && <span className="opacity-80 font-bold">+Rs. {a.price.toFixed(2)}</span>}
                          <span className="opacity-60">({a.type})</span>
                          <button type="button" onClick={() => removeAccompFromNewItem(i)} className="ml-1 hover:text-red-400">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" className="w-full bg-brand-gold text-black font-extrabold py-3 rounded-xl hover:bg-brand-gold/90 transition-colors flex justify-center items-center gap-2">
                  <Plus className="w-5 h-5" /> Add to Menu
                </button>
              </form>
            </div>

            {/* Existing items */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50 px-1">Current Menu ({menuItems.length} items)</h2>
              {menuItems.map(item => (
                <div key={item.id} className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate">{item.name}</h3>
                      <p className="text-white/60 text-xs truncate">{item.description}</p>
                      <p className="text-brand-gold font-bold text-sm mt-0.5">Rs. {Number(item.price).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Toggle checked={item.is_available} onChange={() => toggleItemAvailability(item.id, item.is_available)} />
                      <button onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                        className="flex items-center gap-1.5 text-xs text-white/60 hover:text-brand-gold transition-colors px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/10">
                        <Soup className="w-3.5 h-3.5" />
                        <span>{item.accompaniments?.length || 0}</span>
                        {expandedItemId === item.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <button onClick={() => deleteItem(item.id)} className="p-1.5 text-white/50 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {expandedItemId === item.id && (
                    <AccompanimentPanel item={item} typeColors={typeColors}
                      onToggle={toggleAccompAvailability} onDelete={deleteAccomp} onAdd={addAccompToExistingItem} />
                  )}
                </div>
              ))}
              {menuItems.length === 0 && (
                <div className="text-center py-16 glass-card rounded-2xl border border-white/10 border-dashed text-neutral-600">
                  No menu items yet — add one above!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STALLS TAB ── */}
        {activeTab === 'stalls' && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <h2 className="text-lg font-bold mb-5">Stalls Management</h2>
              <form onSubmit={handleAddStall} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <input type="text" placeholder="Stall Name (e.g. Main Hall)" required value={newStall.name}
                  onChange={e => setNewStall({ ...newStall, name: e.target.value })}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors" />
                <input type="text" placeholder="Location Description" value={newStall.location}
                  onChange={e => setNewStall({ ...newStall, location: e.target.value })}
                  className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors" />
                <button type="submit" className="bg-brand-gold text-black font-bold py-3 rounded-xl hover:bg-brand-gold/90 transition-colors flex justify-center items-center gap-2">
                  <Plus className="w-5 h-5" /> Add Stall
                </button>
              </form>
              <div className="space-y-3">
                {stalls.length === 0 && <p className="text-center text-neutral-600 py-8">No stalls configured yet.</p>}
                {stalls.map(stall => (
                  <div key={stall.id} className="flex items-center justify-between p-4 bg-neutral-900 rounded-xl border border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-brand-gold/10 rounded-lg flex items-center justify-center">
                        <span className="text-brand-gold font-bold text-lg">🏪</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-200">{stall.name}</h3>
                        {stall.location && <p className="text-white/60 text-sm">{stall.location}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleDeleteStall(stall.id)} className="p-1.5 text-white/50 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PROMOS TAB ── */}
        {activeTab === 'promos' && (
            <div className="space-y-8">
              <div className="glass-card rounded-2xl p-6 border border-white/10">
                <h2 className="text-lg font-bold mb-5">Offer Codes</h2>
                <form onSubmit={handleAddOffer} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <input type="text" placeholder="PROMO CODE" required value={newOffer.code}
                    onChange={e => setNewOffer({ ...newOffer, code: e.target.value.toUpperCase() })}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors uppercase" />
                  <input type="number" placeholder="Discount %" required value={newOffer.discount_percentage}
                    onChange={e => setNewOffer({ ...newOffer, discount_percentage: e.target.value })}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors" />
                  <input type="url" placeholder="Popup Image URL (Optional)" value={newOffer.image_url}
                    onChange={e => setNewOffer({ ...newOffer, image_url: e.target.value })}
                    className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-gold transition-colors" />
                  <button type="submit" className="bg-brand-gold text-black font-bold py-3 rounded-xl hover:bg-brand-gold/90 transition-colors">
                    Add Code
                  </button>
                </form>

                <div className="space-y-3">
                  {offers.map(offer => (
                    <div key={offer.id} className="flex items-center justify-between bg-neutral-900 p-4 rounded-xl border border-white/10">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg text-white tracking-wide">{offer.code}</span>
                          <span className="bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded-lg font-bold text-sm">
                            {offer.discount_percentage}% OFF
                          </span>
                        </div>
                        {offer.image_url && <span className="text-xs text-white/50 truncate max-w-xs">{offer.image_url}</span>}
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleOfferStatus(offer.id, offer.is_active)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-bold ${offer.is_active ? 'bg-green-500/10 text-green-400' : 'bg-white/10 text-white/60'}`}>
                          {offer.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => deleteOffer(offer.id)} className="text-white/50 hover:text-red-400">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ANALYTICS TAB ── */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {!analyticsData ? (
                <div className="text-center text-white/50 py-12">Loading analytics...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3 text-white/60 mb-2">
                        <DollarSign className="w-5 h-5 text-green-400" /> Total Revenue
                      </div>
                      <div className="text-3xl font-bold text-white">Rs. {analyticsData.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3 text-white/60 mb-2">
                        <ShoppingBag className="w-5 h-5 text-brand-gold" /> Total Orders
                      </div>
                      <div className="text-3xl font-bold text-white">{analyticsData.totalOrders}</div>
                    </div>
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3 text-white/60 mb-2">
                        <TrendingUp className="w-5 h-5 text-blue-400" /> Avg. Order Value
                      </div>
                      <div className="text-3xl font-bold text-white">Rs. {analyticsData.averageOrder.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                      <h3 className="text-lg font-bold mb-6">Top Selling Items</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsData.topItems} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3' }} width={100} />
                            <Tooltip cursor={{ fill: '#333' }} contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '8px' }} />
                            <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/10">
                      <h3 className="text-lg font-bold mb-6">Revenue by Stall</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.stallData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {analyticsData.stallData.map((entry: any, index: number) => {
                                const COLORS = ['#f97316', '#eab308', '#ef4444', '#10b981', '#3b82f6'];
                                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                              })}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '8px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center flex-wrap gap-4 mt-4">
                          {analyticsData.stallData.map((entry: any, index: number) => {
                            const COLORS = ['#f97316', '#eab308', '#ef4444', '#10b981', '#3b82f6'];
                            return (
                              <div key={entry.name} className="flex items-center gap-2 text-sm text-white/60">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                {entry.name}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        {/* ── SECURITY TAB ── */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <h2 className="text-lg font-bold mb-5 text-brand-gold uppercase tracking-widest text-sm">Security Settings</h2>
              <div className="bg-neutral-900 border border-white/10 rounded-xl p-5 max-w-lg">
                <p className="text-white/70 mb-4 text-sm">This password is used to protect the Stall dashboard.</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="New Stall Password"
                    value={stallPasswordInput}
                    onChange={e => setStallPasswordInput(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-gold transition-colors" />
                  <button onClick={updateStallPassword}
                    className="px-6 py-3 bg-brand-gold text-black font-bold rounded-xl hover:bg-brand-gold/90 transition-colors">
                    Update
                  </button>
                </div>
                {passwordUpdateMsg && <p className="mt-3 text-sm text-green-400 font-medium">{passwordUpdateMsg}</p>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Sub-component for Accompaniment panel
function AccompanimentPanel({ item, typeColors, onToggle, onDelete, onAdd }: {
  item: MenuItem;
  typeColors: Record<string, string>;
  onToggle: (menuItemId: string, id: string, current: boolean) => void;
  onDelete: (menuItemId: string, id: string) => void;
  onAdd: (menuItemId: string, name: string, type: 'curry' | 'sauce' | 'side', price: number) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'curry' | 'sauce' | 'side'>('curry');
  const [price, setPrice] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(item.id, name, type, parseFloat(price) || 0);
    setName('');
    setPrice('');
  };

  return (
    <div className="border-t border-white/10 bg-neutral-900/50 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Curries & Sauces</p>

      {/* Existing accompaniments */}
      {item.accompaniments && item.accompaniments.length > 0 ? (
        <div className="space-y-2">
          {item.accompaniments.map(a => (
            <div key={a.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${typeColors[a.type]}`}>{a.type}</span>
                <span className={`text-sm font-medium truncate ${!a.is_available ? 'line-through text-neutral-600' : 'text-neutral-200'}`}>{a.name}</span>
                {a.price > 0 && (
                  <span className="text-xs font-bold text-brand-gold shrink-0">+Rs. {Number(a.price).toFixed(2)}</span>
                )}
                {(!a.price || a.price === 0) && (
                  <span className="text-xs text-neutral-600 shrink-0">free</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Toggle checked={a.is_available} onChange={() => onToggle(item.id, a.id, a.is_available)} />
                <button onClick={() => onDelete(item.id, a.id)} className="text-neutral-600 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-600">No curries or sauces added yet.</p>
      )}

      {/* Add new accompaniment inline */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 pt-1">
        <input type="text" placeholder="Name (e.g. Dhal Curry)" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-gold transition-colors w-full" />
        <select value={type} onChange={e => setType(e.target.value as any)}
          className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none w-full sm:w-auto">
          <option value="curry">Curry</option>
          <option value="sauce">Sauce</option>
          <option value="side">Side</option>
        </select>
        <input type="number" step="0.01" min="0" placeholder="Price (0=free)"
          value={price}
          onChange={e => setPrice(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-gold transition-colors w-full sm:w-28" />
        <button type="button" onClick={handleAdd}
          className="bg-brand-gold/20 text-brand-gold hover:bg-brand-gold hover:text-black px-3 py-2 rounded-lg transition-colors font-bold text-sm w-full sm:w-auto flex justify-center items-center">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
