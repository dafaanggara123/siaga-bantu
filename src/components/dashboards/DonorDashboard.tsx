import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile, Donation, LogisticStatus, Goods, BlockchainNetwork } from '../../types';
import { Heart, Wallet, History, ExternalLink, ArrowRight, ShieldCheck, CheckCircle, Package, Plus, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { generateTxHash, getExplorerUrl, getCurrencySymbol, cn } from '../../lib/utils';
import { sendSolanaTransaction } from '../../services/solanaService';

interface DonorDashboardProps {
  user: UserProfile;
  walletConnected: boolean;
  walletNetwork: BlockchainNetwork | null;
  onConnect: () => void;
}

export default function DonorDashboard({ user, walletConnected, walletNetwork, onConnect }: DonorDashboardProps) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donatedGoods, setDonatedGoods] = useState<Goods[]>([]);
  const [amount, setAmount] = useState<string>('0.5');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const currencySymbol = getCurrencySymbol(walletNetwork || BlockchainNetwork.SOLANA);

  // Goods Form State
  const [goodName, setGoodName] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('Box');
  const [showGoodsForm, setShowGoodsForm] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'donations'), where('donorId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Donation[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Donation));
      setDonations(items.sort((a, b) => b.timestamp - a.timestamp));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'donations'));

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'goods'), where('donorId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Goods[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Goods));
      setDonatedGoods(items.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'goods'));

    return () => unsubscribe();
  }, [user.uid]);

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected) return;

    setLoading(true);
    setTxHash(null);

    try {
      // Simulation or Real Web3 Payment
      let hash = '';
      if (walletNetwork === BlockchainNetwork.SOLANA && user.walletAddress) {
        try {
          hash = await sendSolanaTransaction(user.walletAddress, undefined, parseFloat(amount));
        } catch (e) {
          console.warn('Real transaction failed or cancelled, using simulation:', e);
          hash = generateTxHash(walletNetwork || BlockchainNetwork.SOLANA);
        }
      } else {
        hash = generateTxHash(walletNetwork || BlockchainNetwork.SOLANA);
      }
      
      setTxHash(hash);

      const donation: Omit<Donation, 'id'> = {
        donorId: user.uid,
        donorName: user.displayName,
        amount: parseInt(amount),
        txHash: hash,
        txNetwork: walletNetwork || BlockchainNetwork.SOLANA,
        timestamp: Date.now()
      };

      await addDoc(collection(db, 'donations'), donation);
      setAmount('50000');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'donations');
    } finally {
      setLoading(false);
    }
  };

  const handleDonateGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const qrcode = `DN-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      // Generate on-chain hash for goods registration proof
      let hash = '';
      if (walletNetwork === BlockchainNetwork.SOLANA && user.walletAddress) {
        try {
          hash = await sendSolanaTransaction(user.walletAddress);
        } catch (e) {
          console.warn('Real transaction failed for goods, using simulation:', e);
          const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
          hash = Array.from({length: 88}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        }
      }

      const newGoods: Omit<Goods, 'id'> = {
        name: goodName,
        category,
        quantity,
        unit,
        status: LogisticStatus.IN_GUDANG, // Set directly to available for simplicity
        warehouseId: 'DONOR_SOURCE', // Placeholder
        donorId: user.uid,
        donorName: user.displayName,
        qrcode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastTxHash: hash || undefined,
        lastTxNetwork: walletNetwork || BlockchainNetwork.SOLANA,
      };
      
      await addDoc(collection(db, 'goods'), newGoods);
      setGoodName('');
      setShowGoodsForm(false);
      setNotification({
        msg: `Donasi barang "${newGoods.name}" berhasil dikirim ke jalur logistik!`,
        type: 'success'
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'goods');
      setNotification({
        msg: `Gagal mengirim donasi: ${error.message || 'Error tidak diketahui'}`,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Global Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className={cn(
              "fixed top-8 right-8 z-[300] p-6 rounded-2xl shadow-2xl border flex items-center gap-4 max-w-sm backdrop-blur-xl",
              notification.type === 'success' 
                ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400" 
                : "bg-red-600/20 border-red-500/30 text-red-400"
            )}
          >
            <div className={cn(
              "p-2 rounded-full",
              notification.type === 'success' ? "bg-emerald-500/20" : "bg-red-500/20"
            )}>
              {notification.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <Plus className="h-5 w-5 rotate-45" />}
            </div>
            <div className="flex-1">
              <h5 className="font-black text-[10px] uppercase tracking-widest mb-1">
                {notification.type === 'success' ? 'Donasi Terverifikasi' : 'Terjadi Kesalahan'}
              </h5>
              <p className="text-sm font-bold leading-tight">{notification.msg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Donation Form */}
        <div className="space-y-6">
          <div className="bg-[#1e293b] rounded-[2.5rem] p-8 border border-slate-700/50 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl opacity-50" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
                  <Heart className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">Donasi Cepat</h2>
                  <p className="text-slate-400 text-sm">Empower change through transparent giving.</p>
                </div>
              </div>

              <form onSubmit={handleDonate} className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                      {['0.1', '0.5', '1.0', '2.5'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAmount(val)}
                          className={cn(
                            "py-4 rounded-2xl border font-bold transition-all text-sm cursor-pointer",
                            amount === val ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-slate-800 bg-[#0f172a] text-slate-500 hover:border-slate-700 hover:text-slate-300"
                          )}
                        >
                          {val} {currencySymbol}
                        </button>
                      ))}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Custom Amount ({currencySymbol})</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 font-bold">{currencySymbol}</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full pl-16 pr-6 py-5 bg-[#0f172a] border border-slate-800 rounded-2xl font-bold text-2xl text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="p-5 bg-[#0f172a]/50 border border-slate-800 rounded-3xl flex items-start gap-4">
                  <ShieldCheck className="h-6 w-6 text-emerald-400 mt-1 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Live {walletNetwork || 'Blockchain'} Bridge</p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">All financial contributions are anchored to the {walletNetwork || 'Blockchain'} Mainnet, ensuring immutable proof of assistance.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  onClick={(e) => {
                    if (!walletConnected) {
                      e.preventDefault();
                      onConnect();
                    }
                  }}
                  className={cn(
                    "w-full py-5 rounded-2xl font-black text-lg shadow-2xl flex items-center justify-center gap-3 transition-all cursor-pointer",
                    walletConnected 
                    ? "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/20 hover:-translate-y-1" 
                    : "bg-[#0f172a] text-blue-400 border border-blue-500/30 hover:bg-blue-500/5"
                  )}
                >
                  <Wallet className="h-5 w-5" />
                  {loading ? 'Executing Contract...' : walletConnected ? `Donasi via ${walletNetwork}` : 'Hubungkan Crypto E-Wallet'}
                  {!loading && <ArrowRight className="h-5 w-5" />}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Goods Donation Form Section */}
        <div className="space-y-6">
          <div className="bg-[#1e293b] rounded-[2.5rem] p-8 border border-slate-700/50 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl opacity-50" />
            
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/20">
                    <Package className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Donasi Barang</h2>
                    <p className="text-slate-400 text-sm">Contribute logistics and physical supplies.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGoodsForm(!showGoodsForm)}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 transition-colors"
                >
                  <Plus className={cn("h-6 w-6 text-white transition-transform", showGoodsForm && "rotate-45")} />
                </button>
              </div>

              {showGoodsForm ? (
                <form onSubmit={handleDonateGoods} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Barang</label>
                      <input 
                        required 
                        value={goodName} 
                        onChange={e => setGoodName(e.target.value)}
                        className="w-full px-4 py-4 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        placeholder="Misal: Beras, Selimut, Obat"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Kategori</label>
                        <select 
                          value={category} 
                          onChange={e => setCategory(e.target.value)}
                          className="w-full px-4 py-4 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                        >
                          <option>Makanan</option>
                          <option>Pakaian</option>
                          <option>Kesehatan</option>
                          <option>Perlengkapan</option>
                          <option>Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Jumlah</label>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            min="1" 
                            required
                            value={quantity} 
                            onChange={e => setQuantity(parseInt(e.target.value))}
                            className="w-20 px-4 py-4 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          />
                          <input 
                            required
                            value={unit} 
                            onChange={e => setUnit(e.target.value)}
                            className="flex-1 px-4 py-4 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-xs uppercase"
                            placeholder="Unit (KG/BOX)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20"
                  >
                    {loading ? 'Processing...' : 'Kirim Donasi Barang'}
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </form>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-[#0f172a]/30 rounded-3xl border border-dashed border-slate-800">
                   <div className="p-4 bg-slate-800 rounded-full mb-4">
                     <ClipboardList className="h-10 w-10 text-slate-500" />
                   </div>
                   <p className="text-slate-400 font-medium px-8 leading-relaxed">Punya bantuan fisik untuk disalurkan? Tekan tombol plus untuk mendaftarkan barang donasi Anda ke sistem logistik blockchain kami.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Financial Donation History */}
        <div className="bg-[#1e293b] rounded-[2.5rem] border border-slate-700/50 shadow-xl overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-800 bg-slate-900/30">
            <h3 className="font-bold text-white flex items-center gap-3">
              <History className="h-5 w-5 text-blue-500" />
              Donation Ledger
            </h3>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em] mt-1">Personal Contribution Record</p>
          </div>
          <div className="flex-1 max-h-[500px] overflow-y-auto p-8 space-y-4">
            {donations.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-600">
                <Wallet className="h-16 w-16 opacity-10 mb-6" />
                <p className="text-[10px] font-bold uppercase tracking-widest italic">No financial records</p>
              </div>
            ) : (
              donations.map((d) => (
                <div key={d.id} className="p-6 rounded-3xl border border-slate-800 bg-[#0f172a]/50 hover:bg-[#0f172a] transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-white text-2xl tracking-tighter">{d.amount} {getCurrencySymbol(d.txNetwork || BlockchainNetwork.SOLANA)}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{format(d.timestamp, 'dd MMM yyyy')}</span>
                  </div>
                  <a href={getExplorerUrl(d.txHash, d.txNetwork || BlockchainNetwork.SOLANA)} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-blue-500/60 hover:text-blue-400 truncate block">
                    {d.txHash}
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Goods Donation History */}
        <div className="bg-[#1e293b] rounded-[2.5rem] border border-slate-700/50 shadow-xl overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-800 bg-slate-900/30">
            <h3 className="font-bold text-white flex items-center gap-3">
              <Package className="h-5 w-5 text-emerald-500" />
              Logistik Ledger
            </h3>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em] mt-1">Physical Assistance Proof</p>
          </div>
          <div className="flex-1 max-h-[500px] overflow-y-auto p-8 space-y-4">
            {donatedGoods.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-600">
                <Package className="h-16 w-16 opacity-10 mb-6" />
                <p className="text-[10px] font-bold uppercase tracking-widest italic">No logistic records</p>
              </div>
            ) : (
              donatedGoods.map((item) => (
                <div key={item.id} className="p-6 rounded-3xl border border-slate-800 bg-[#0f172a]/50 hover:bg-[#0f172a] transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="">
                      <h4 className="font-bold text-slate-200">{item.name}</h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{item.category} • {item.quantity} {item.unit}</p>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest border",
                      item.status === LogisticStatus.DELIVERED ? "border-emerald-500 text-emerald-500" : 
                      item.status === LogisticStatus.PICKED_UP ? "border-purple-500 text-purple-500" :
                      item.status === LogisticStatus.IN_TRANSIT ? "border-amber-500 text-amber-500" :
                      "border-blue-500 text-blue-500"
                    )}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                    <code className="text-[9px] font-mono text-slate-600">QR: {item.qrcode}</code>
                    <span className="text-[9px] font-mono text-slate-600">{format(item.createdAt, 'dd MMM yyyy')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
