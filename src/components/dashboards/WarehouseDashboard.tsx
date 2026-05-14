import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, getDocs, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile, Goods, LogisticStatus, BlockchainNetwork } from '../../types';
import { Package, Plus, QrCode, ClipboardList, Warehouse, History, ArrowRight, CheckCircle, Info, Scan, Camera, ArrowUpRight, Search } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn, getExplorerUrl } from '../../lib/utils';

interface WarehouseDashboardProps {
  user: UserProfile;
  walletConnected: boolean;
  walletNetwork: BlockchainNetwork | null;
  onConnect: () => void;
}

export default function WarehouseDashboard({ user, walletConnected, walletNetwork, onConnect }: WarehouseDashboardProps) {
  const [goods, setGoods] = useState<Goods[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = React.useRef<Html5QrcodeScanner | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('Box');

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Synchronized with Admin: Show ALL goods in the system
    const q = collection(db, 'goods');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Goods[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Goods);
      });
      // Standardized sorting: updatedAt descending
      setGoods(items.sort((a, b) => b.updatedAt - a.updatedAt));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goods');
    });

    return () => unsubscribe();
  }, []);

  const filteredGoods = goods.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.qrcode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onScanSuccess = async (decodedText: string) => {
    scannerRef.current?.clear();
    setScanning(false);
    
    try {
      // Find item in Firestore (it might not be in the local 'goods' list if it's new/from donor)
      const q = query(collection(db, 'goods'), where('qrcode', '==', decodedText));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setNotification({
          msg: `Item dengan QR ${decodedText} tidak ditemukan di sistem.`,
          type: 'error'
        });
        return;
      }

      const docRef = snap.docs[0].ref;
      const data = snap.docs[0].data() as Goods;

      // Logic: If it's a donor item or unassigned, this warehouse receives it
      if (data.warehouseId === 'DONOR_SOURCE' || !data.warehouseId) {
        await updateDoc(docRef, {
          warehouseId: user.uid,
          status: LogisticStatus.IN_GUDANG,
          updatedAt: Date.now()
        });
        setNotification({
          msg: `Barang "${data.name}" berhasil diterima di gudang Anda.`,
          type: 'success'
        });
      } else if (data.warehouseId === user.uid) {
        setNotification({
          msg: `Info Barang: ${data.name} sudah ada di inventaris Anda. Status: ${data.status}`,
          type: 'success'
        });
      } else {
        setNotification({
          msg: `Barang "${data.name}" terdaftar di gudang lain.`,
          type: 'error'
        });
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'goods');
      setNotification({
        msg: 'Gagal memproses QR code.',
        type: 'error'
      });
    }
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAddGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const qrcode = `BLX-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const newGoods = {
        name,
        category,
        quantity,
        unit,
        status: LogisticStatus.IN_GUDANG,
        warehouseId: user.uid,
        qrcode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await addDoc(collection(db, 'goods'), newGoods);
      setName('');
      setShowAddForm(false);
      setNotification({
        msg: `Barang "${newGoods.name}" berhasil diregistrasi di gudang.`,
        type: 'success'
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'goods');
      setNotification({
        msg: `Gagal meregistrasi barang: ${error.message || 'Error tidak diketahui'}`,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
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
              {notification.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <h5 className="font-black text-[10px] uppercase tracking-widest mb-1">
                {notification.type === 'success' ? 'Registrasi Berhasil' : 'Registrasi Gagal'}
              </h5>
              <p className="text-sm font-bold leading-tight">{notification.msg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatSummaryCard 
          icon={<Package className="text-blue-400" />} 
          label="Total Stok" 
          value={`${goods.length} Barang`} 
          subtext="Warehouse Inventory"
        />
        <StatSummaryCard 
          icon={<ClipboardList className="text-amber-400" />} 
          label="Stok di Gudang" 
          value={goods.filter(g => g.status === LogisticStatus.IN_GUDANG).length.toString()} 
          subtext="Available for Distribution"
        />
        <StatSummaryCard 
          icon={<History className="text-emerald-400" />} 
          label="Sudah Didistribusi" 
          value={goods.filter(g => g.status !== LogisticStatus.IN_GUDANG).length.toString()} 
          subtext="Tracked On-chain"
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1e293b] p-6 rounded-2xl border border-slate-700/50 shadow-xl gap-4">
        <div className="flex items-center gap-3">
          <Warehouse className="h-6 w-6 text-blue-500" />
          <div>
            <h2 className="text-xl font-bold">Manajemen Barang & QR Tracking</h2>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-1">Gudang: {user.displayName}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
        >
          <Plus className="h-5 w-5" />
          Input Barang Baru
        </button>
        <button 
          onClick={() => {
            setScanning(true);
            setTimeout(() => {
              scannerRef.current = new Html5QrcodeScanner("warehouse-qr-reader", { fps: 10, qrbox: 250 }, false);
              scannerRef.current.render(onScanSuccess, (err) => {
                if (err.includes("NotAllowedError") || err.includes("Permission denied")) {
                  setNotification({
                    msg: 'Akses Kamera Ditolak! Harap izinkan kamera untuk melakukan scan.',
                    type: 'error'
                  });
                  scannerRef.current?.clear();
                  setScanning(false);
                }
              });
            }, 100);
          }}
          className="w-full sm:w-auto bg-slate-800 text-slate-200 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-all border border-slate-700 cursor-pointer"
        >
          <Scan className="h-5 w-5" />
          Scan Check-in
        </button>
      </div>

      {/* Scanning Modal */}
      <AnimatePresence>
        {scanning && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1e293b] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-700"
            >
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-blue-600 rounded-xl">
                     <Camera className="h-6 w-6 text-white" />
                   </div>
                   <h3 className="text-xl font-bold">Warehouse Scanner</h3>
                </div>
                <button 
                  onClick={() => {
                    scannerRef.current?.clear();
                    setScanning(false);
                  }} 
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <ArrowUpRight className="h-6 w-6 rotate-45" />
                </button>
              </div>
              <div className="p-8">
                <div id="warehouse-qr-reader" className="w-full rounded-2xl overflow-hidden"></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#1e293b] w-full max-w-lg rounded-3xl shadow-2xl border border-slate-700 p-8"
            >
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Package className="text-blue-500" />
                Registrasi Logistik
              </h3>
              <form onSubmit={handleAddGoods} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Barang</label>
                    <input 
                      required 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Misal: Beras Super, Tenda Darurat"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Kategori</label>
                      <select 
                        value={category} 
                        onChange={e => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none"
                      >
                        <option>Makanan</option>
                        <option>Pakaian</option>
                        <option>Kesehatan</option>
                        <option>Perlengkapan</option>
                        <option>Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Jumlah & Satuan</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          min="1" 
                          value={quantity} 
                          onChange={e => setQuantity(parseInt(e.target.value))}
                          className="w-20 px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                        <input 
                          value={unit} 
                          onChange={e => setUnit(e.target.value)}
                          className="flex-1 px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-xs uppercase"
                          placeholder="BOX/KG"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#0f172a] rounded-2xl border border-dashed border-slate-800 text-center">
                   <div className="bg-white p-3 inline-block rounded-xl shadow-lg mb-3">
                     <QrCode className="h-10 w-10 text-slate-900" />
                   </div>
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Digital Identifiers</p>
                   <p className="text-[9px] text-slate-600 mt-1 italic">Unique UUID will be assigned automatically</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-4 font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Processing...' : 'Simpan & Sync'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/30">
          <div>
            <h3 className="font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
              Distribution Control Ledger
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 text-[9px] font-bold">LIVE SYNC</span>
            </h3>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-1">Gudang Node: {user.displayName}</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search UUID/Name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[#0f172a] border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">IDENTIFIER / SOURCE</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">BLOCKCHAIN RECEIPT</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">NODE STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredGoods.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center text-slate-600 italic font-mono text-xs uppercase tracking-widest">
                    No matching records in warehouse ledger
                  </td>
                </tr>
              ) : filteredGoods.map((item) => (
                <motion.tr 
                  layout
                  key={item.id} 
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-200">{item.name}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{item.category} • {item.quantity} {item.unit}</div>
                      {item.donorId && (
                        <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-[0.05em]">
                          Donatur: {item.donorName || 'Anonim'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="p-1.5 bg-white rounded-lg shadow-lg group-hover:scale-105 transition-transform border border-slate-200">
                        <QRCodeSVG value={item.qrcode} size={32} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <code className="text-[10px] font-mono bg-[#0f172a] px-2 py-1 rounded border border-slate-800 text-blue-400">
                          {item.qrcode}
                        </code>
                        {item.lastTxHash ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-bold uppercase tracking-widest animate-pulse">
                              <History className="h-3 w-3" /> ON-CHAIN PERSISTENCE
                            </div>
                            <a 
                              href={getExplorerUrl(item.lastTxHash, item.lastTxNetwork || walletNetwork || BlockchainNetwork.SOLANA)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] font-mono text-blue-500 hover:text-blue-400 truncate max-w-[150px]"
                            >
                              {item.lastTxHash}
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                            DATABASE ONLY
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          item.lastTxHash ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-700"
                        )} />
                        <StatusBadge status={item.status} />
                     </div>
                     <div className="text-[9px] text-slate-600 mt-2 font-mono uppercase">
                        Sync: {format(item.updatedAt, 'HH:mm:ss')}
                     </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatSummaryCard({ icon, label, value, subtext }: { icon: React.ReactNode, label: string, value: string, subtext: string }) {
  return (
    <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700/50 shadow-xl flex items-center gap-4 transform hover:scale-[1.02] transition-all">
      <div className="p-3 bg-[#0f172a] rounded-xl border border-slate-800">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold text-slate-200 tracking-tight">{value}</p>
        <p className="text-[9px] text-slate-600 font-mono truncate">{subtext}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LogisticStatus }) {
  const styles = {
    [LogisticStatus.IN_GUDANG]: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    [LogisticStatus.PICKED_UP]: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    [LogisticStatus.IN_TRANSIT]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    [LogisticStatus.DELIVERED]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
      styles[status]
    )}>
      {status}
    </span>
  );
}
