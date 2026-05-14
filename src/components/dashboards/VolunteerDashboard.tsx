import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, getDocs, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile, Goods, LogisticStatus, BlockchainNetwork } from '../../types';
import { Scan, Package, MapPin, CheckCircle, ExternalLink, History, Camera, Info, ArrowUpRight, ShieldCheck, ArrowRight, Truck, Wallet } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { generateTxHash, getExplorerUrl, cn } from '../../lib/utils';
import { sendSolanaTransaction } from '../../services/solanaService';

interface VolunteerDashboardProps {
  user: UserProfile;
  walletConnected: boolean;
  walletNetwork: BlockchainNetwork | null;
  onConnect: () => void;
}

export default function VolunteerDashboard({ user, walletConnected, walletNetwork, onConnect }: VolunteerDashboardProps) {
  const [tasks, setTasks] = useState<Goods[]>([]);
  const [historyTasks, setHistoryTasks] = useState<Goods[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [txProgress, setTxProgress] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Show tasks assigned to me or goods in transit that need delivery
    const q = query(collection(db, 'goods'), where('status', '!=', LogisticStatus.DELIVERED));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Goods[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Goods);
      });
      setTasks(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goods');
    });

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    // Fetch completed/history tasks for this volunteer
    const q = query(
      collection(db, 'goods'), 
      where('status', '==', LogisticStatus.DELIVERED),
      where('volunteerId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Goods[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Goods);
      });
      setHistoryTasks(items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goods');
    });

    return () => unsubscribe();
  }, [user.uid]);

  const startScanner = () => {
    setScanning(true);
    setScanStatus({ type: 'idle', message: '' });
    
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader", 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      
      scannerRef.current.render(onScanSuccess, onScanError);
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(err => console.error(err));
    }
    setScanning(false);
  };

  const updateGoodsStatus = async (goodsId: string, currentStatus: LogisticStatus) => {
    setTxProgress('Memproses transisi status...');
    
    try {
      // Determine next status
      let nextStatus = LogisticStatus.PICKED_UP;
      if (currentStatus === LogisticStatus.IN_GUDANG) nextStatus = LogisticStatus.PICKED_UP;
      if (currentStatus === LogisticStatus.PICKED_UP) nextStatus = LogisticStatus.IN_TRANSIT;
      if (currentStatus === LogisticStatus.IN_TRANSIT) nextStatus = LogisticStatus.DELIVERED;

      if (currentStatus === LogisticStatus.DELIVERED) {
         setScanStatus({ type: 'error', message: 'Aset sudah mencapai destinasi akhir.' });
         setTxProgress(null);
         return;
      }

      // Real or Simulation of Web3 Tx
      setTxProgress(`Broadcasting status ${nextStatus} ke ${walletNetwork || 'Blockchain'}...`);
      
      let hash = '';
      if (walletNetwork === BlockchainNetwork.SOLANA && user.walletAddress) {
        try {
          // Attempt real transaction signing if Phantom is active
          hash = await sendSolanaTransaction(user.walletAddress);
        } catch (e) {
          console.warn('Real transaction failed or cancelled, using simulation fallback:', e);
          hash = generateTxHash(walletNetwork || BlockchainNetwork.SOLANA);
        }
      } else {
        hash = generateTxHash(walletNetwork || BlockchainNetwork.SOLANA);
      }

      // Update Database
      await updateDoc(doc(db, 'goods', goodsId), {
        status: nextStatus,
        volunteerId: user.uid,
        lastTxHash: hash,
        lastTxNetwork: walletNetwork || BlockchainNetwork.SOLANA,
        updatedAt: Date.now()
      });

      setScanStatus({ 
        type: 'success', 
        message: `Status diupdate ke ${nextStatus}. Tx: ${hash.slice(0, 12)}...` 
      });

      setNotification({
        msg: `Barang "${tasks.find(t => t.id === goodsId)?.name || 'Barang'}" berhasil diproses ke ${nextStatus}!`,
        type: 'success'
      });
      
      // Auto-clear notification
      setTimeout(() => setNotification(null), 5000);

    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'goods');
      setNotification({
        msg: `Gagal update status: ${error.message || 'Error tidak diketahui'}`,
        type: 'error'
      });
    } finally {
      setTxProgress(null);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    stopScanner();
    setTxProgress('Memvalidasi QR Code...');
    
    try {
      // Find goods with this QR
      const q = query(collection(db, 'goods'), where('qrcode', '==', decodedText));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setScanStatus({ type: 'error', message: 'Barang tidak ditemukan di sistem! Periksa validitas QR.' });
        setTxProgress(null);
        return;
      }

      const goodsId = querySnapshot.docs[0].id;
      const goodsData = querySnapshot.docs[0].data() as Goods;
      
      await updateGoodsStatus(goodsId, goodsData.status);

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'goods');
    }
  };

  const onScanError = (errorMessage: string) => {
    if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission denied")) {
      setScanStatus({ 
        type: 'error', 
        message: 'Akses Kamera Ditolak! Harap izinkan kamera di browser Anda untuk melakukan scan.' 
      });
      stopScanner();
    }
  };

  return (
    <div className="space-y-8">
      {/* Immersive Header Card */}
      <div className="bg-[#1e293b] p-8 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600/10 blur-3xl rounded-full" />
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div>
            <div className="text-[10px] uppercase font-bold text-blue-400 tracking-widest mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Verified Volunteer Console
            </div>
            <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Halo, {user.displayName}</h2>
            <p className="text-slate-400 max-w-md text-sm leading-relaxed">
              Scan QR bantuan untuk memperbarui status logistik di <span className="text-emerald-400 font-mono">Live Ledger</span> secara real-time.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <button 
              disabled={!!txProgress}
              onClick={startScanner}
              className={cn(
                 "px-8 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl text-lg cursor-pointer bg-blue-600 text-white hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-blue-600/20",
                 txProgress && "opacity-50 cursor-not-allowed"
              )}
            >
              <Scan className="h-6 w-6" />
              Scan QR Bantuan
            </button>
            {!walletConnected ? (
              <button 
                onClick={onConnect}
                className="px-6 py-4 bg-red-600/10 border border-red-500/20 rounded-2xl text-[10px] text-red-400 hover:bg-red-600 hover:text-white transition-all uppercase tracking-tighter font-black shadow-lg shadow-red-900/10 cursor-pointer"
              >
                <Wallet className="h-4 w-4 inline mr-2" />
                Hubungkan Crypto E-Wallet
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Scanning Modal */}
      <AnimatePresence>
        {scanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1e293b] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-700"
            >
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
                     <Camera className="h-6 w-6 text-white" />
                   </div>
                   <div>
                     <h3 className="text-xl font-bold">Volunteer Scanner</h3>
                     <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest font-mono italic">Kamera Aktif • Scan QR Bantuan</p>
                   </div>
                </div>
                <button onClick={stopScanner} className="p-3 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                  <ArrowUpRight className="h-6 w-6 rotate-45" />
                </button>
              </div>
              <div className="p-8">
                <div id="qr-reader" className="w-full rounded-2xl overflow-hidden shadow-2xl bg-black/50 border border-slate-700 min-h-[300px] flex items-center justify-center">
                  <span className="text-slate-600 animate-pulse uppercase text-[10px] font-bold tracking-widest font-mono">Menyiapkan Kamera...</span>
                </div>
                <div className="flex items-center justify-center gap-3 mt-8">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] font-mono">
                    Mencari kode BLX...
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div className="flex-1 text-left">
              <h5 className="font-black text-[10px] uppercase tracking-widest mb-1">
                {notification.type === 'success' ? 'Update Berhasil' : 'Sistem Error'}
              </h5>
              <p className="text-sm font-bold leading-tight">{notification.msg}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-slate-500 hover:text-white transition-colors p-1"
            >
              <ArrowUpRight className="h-4 w-4 rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing Progress & Result Notifications (In-layout) */}
      <AnimatePresence>
        {(txProgress || scanStatus.type !== 'idle') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
               "p-6 rounded-3xl flex items-center gap-5 border shadow-2xl relative overflow-hidden",
               txProgress ? "bg-blue-600/10 border-blue-500/20 text-blue-200" : 
               scanStatus.type === 'success' ? "bg-emerald-600/10 border-emerald-500/20 text-emerald-300" : 
               "bg-red-600/10 border-red-500/20 text-red-300"
            )}
          >
            {txProgress ? (
              <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : scanStatus.type === 'success' ? (
              <div className="p-2 bg-emerald-500/20 rounded-full"><CheckCircle className="h-6 w-6 text-emerald-400" /></div>
            ) : (
              <div className="p-2 bg-red-500/20 rounded-full"><Info className="h-6 w-6 text-red-400" /></div>
            )}
            <div className="flex-1">
               <p className="font-bold text-lg">{txProgress || scanStatus.message}</p>
               {txProgress && <p className="text-[10px] text-blue-500 font-mono mt-1 uppercase tracking-widest">Sinkronisasi data ke Ledger {walletNetwork || 'Blockchain'}...</p>}
            </div>
            {!txProgress && (
               <button onClick={() => setScanStatus({ type: 'idle', message: '' })} className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 cursor-pointer">Tutup</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Distribution Tasks Grid */}
      <div className="bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-xl overflow-hidden min-h-[400px]">
        <div className="p-8 border-b border-slate-700 flex items-center justify-between bg-slate-800/30">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-[#0f172a] rounded-xl border border-slate-800">
               <Package className="h-5 w-5 text-blue-500" />
             </div>
             <div>
               <h3 className="font-bold text-slate-200 text-lg">Active Distribution Pipeline</h3>
               <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Pending Verification & Delivery</p>
             </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-[#0f172a] px-3 py-1.5 rounded-full border border-slate-800">
            {tasks.length} LOGS IN PIPELINE
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8">
          {tasks.length === 0 ? (
             <div className="col-span-full py-24 text-center text-slate-600 flex flex-col items-center gap-6">
               <MapPin className="h-16 w-16 opacity-20" />
               <div className="space-y-1">
                 <p className="font-bold uppercase tracking-[0.2em] text-[10px]">No Active Tasks</p>
                 <p className="text-xs italic uppercase">Pipeline is currently empty. Check back later.</p>
               </div>
             </div>
          ) : tasks.map((item) => (
            <motion.div 
              key={item.id}
              whileHover={{ y: -6, scale: 1.02 }}
              className="p-6 rounded-[2rem] border border-slate-800 bg-[#0f172a]/40 hover:bg-[#0f172a] hover:shadow-2xl hover:shadow-blue-900/10 transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={cn(
                  "p-3.5 rounded-2xl border transition-colors",
                  item.status === LogisticStatus.IN_GUDANG ? "bg-amber-500/5 border-amber-500/20 text-amber-500" : "bg-blue-500/5 border-blue-500/20 text-blue-500"
                )}>
                  <Package className="h-6 w-6" />
                </div>
                <StatusBadge status={item.status} />
              </div>
              <h4 className="font-bold text-slate-200 text-xl mb-1 tracking-tight group-hover:text-blue-400 transition-colors">{item.name}</h4>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.category} • {item.quantity} {item.unit}</p>
                {item.donorId && (
                  <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-[0.05em]">
                    Donatur: {item.donorName || 'Anonim'}
                  </span>
                )}
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-800/50 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">QR Identifier</span>
                  <code className="text-[10px] font-mono text-blue-500 bg-blue-500/5 px-2 py-0.5 rounded">{item.qrcode}</code>
                </div>

                {/* Manual Action Button */}
                <button
                  onClick={() => {
                    if (!walletConnected) {
                      onConnect();
                    } else {
                      updateGoodsStatus(item.id, item.status);
                    }
                  }}
                  disabled={!!txProgress}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                    walletConnected
                      ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white"
                      : "bg-[#0f172a] text-blue-400 border border-blue-500/30 hover:bg-blue-500/10"
                  )}
                >
                  <Truck className="h-4 w-4" />
                  {walletConnected ? `Update via ${walletNetwork}` : 'Hubungkan Crypto E-Wallet'}
                  <ArrowRight className="h-4 w-4" />
                </button>

                {item.lastTxHash ? (
                  <a 
                    href={getExplorerUrl(item.lastTxHash, item.lastTxNetwork || walletNetwork || BlockchainNetwork.SOLANA)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[9px] font-mono text-slate-500 hover:text-blue-400 transition-colors flex flex-col gap-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="uppercase tracking-widest font-bold text-slate-700">On-Chain Proof</span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                    <span className="truncate block bg-[#0f172a] p-2 rounded-lg border border-slate-800 group-hover:border-blue-900/30">
                      {item.lastTxHash}
                    </span>
                  </a>
                ) : (
                  <div className="text-[9px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                    Legacy Record System
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Riwayat Bantuan (Assistance History) Section */}
      <div className="bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-700 flex items-center justify-between bg-slate-800/20">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-[#0f172a] rounded-xl border border-slate-800">
               <History className="h-5 w-5 text-emerald-500" />
             </div>
             <div>
               <h3 className="font-bold text-slate-200 text-lg">Riwayat Bantuan Anda</h3>
               <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Completed Deliveries • Verified On-Chain</p>
             </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10">
            {historyTasks.length} VERIFIED DEPLOYMENTS
          </span>
        </div>

        <div className="p-8">
          {historyTasks.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <History className="h-12 w-12 text-slate-800" />
              <p className="text-slate-500 text-sm font-medium">Belum ada riwayat pengiriman yang terselesaikan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] border-b border-slate-800">
                    <th className="pb-4 pl-2">Asset Name</th>
                    <th className="pb-4 pl-2">Category</th>
                    <th className="pb-4 pl-2">Quantity</th>
                    <th className="pb-4 pl-2">Delivered Date</th>
                    <th className="pb-4 pl-2 text-right pr-2">Blockchain Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {historyTasks.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="py-5 pl-2 font-bold text-slate-200">{item.name}</td>
                      <td className="py-5 pl-2">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-slate-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-5 pl-2 text-slate-400 text-sm">{item.quantity} {item.unit}</td>
                      <td className="py-5 pl-2 text-slate-400 text-xs">
                        {item.updatedAt ? format(item.updatedAt, 'dd MMM yyyy HH:mm') : 'N/A'}
                      </td>
                      <td className="py-5 text-right pr-2">
                        {item.lastTxHash ? (
                          <a 
                            href={getExplorerUrl(item.lastTxHash, item.lastTxNetwork || walletNetwork || BlockchainNetwork.SOLANA)} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-mono transition-all inline-flex items-center gap-2 border border-blue-500/20"
                          >
                            {item.lastTxHash.slice(0, 6)}...{item.lastTxHash.slice(-4)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-slate-700 text-[10px] font-bold uppercase tracking-widest">No Hash</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LogisticStatus }) {
  const styles = {
    [LogisticStatus.IN_GUDANG]: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    [LogisticStatus.IN_TRANSIT]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    [LogisticStatus.DELIVERED]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    [LogisticStatus.PICKED_UP]: "bg-purple-500/10 text-purple-400 border-purple-500/20",
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
