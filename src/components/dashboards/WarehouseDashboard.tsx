import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, getDocs, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile, Goods, LogisticStatus, BlockchainNetwork, FundUsage } from '../../types';
import { Package, QrCode, ClipboardList, Warehouse, History, ArrowRight, CheckCircle, Info, Scan, Camera, ArrowUpRight, Search, MapPin } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = React.useRef<Html5QrcodeScanner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadLogistics = () => {
      const savedLogistics = localStorage.getItem("logistics");
      if (savedLogistics) {
        const allLogistics = JSON.parse(savedLogistics) as Goods[];
        setGoods(allLogistics.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        }));
      }
    };

    loadLogistics();
    
    // Subscribe to fundUsage to sync older purchased logistics
    const unsubscribeUsage = onSnapshot(collection(db, 'fundUsage'), (snapshot) => {
      const items: FundUsage[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as FundUsage));
      
      const purchaseItems = items.filter(f => f.usageType === 'Pembelian Logistik');
      if (purchaseItems.length > 0) {
        const savedLogistics = localStorage.getItem("logistics");
        const currentLogistics: Goods[] = savedLogistics ? JSON.parse(savedLogistics) : [];
        let hasChanges = false;

        purchaseItems.forEach(fund => {
          const isAlreadyRegistered = currentLogistics.some(item => 
            (item.id === `GOOD-PURCHASE-${fund.id}`) ||
            (fund.transactionHash && item.transactionHash === fund.transactionHash) ||
            (item.itemName === (fund.purpose || `Pembelian Logistik: ${fund.category}`) && item.donorWallet === fund.adminWallet)
          );

          if (!isAlreadyRegistered) {
            const itemQrcode = `SB-PUR-${Math.floor(Math.random() * 900000 + 100000)}`;
            const purchasedGoods: Goods = {
              id: `GOOD-PURCHASE-${fund.id}`,
              uid: `GOOD-PURCHASE-${fund.id}`,
              itemName: fund.purpose || `Pembelian Logistik: ${fund.category}`,
              category: fund.category,
              quantity: 1,
              unit: "Paket",
              condition: "Baru",
              destination: fund.recipient || "Posko Utama",
              source: "Pembelian Admin (Dana Bantuan)",
              status: LogisticStatus.IN_GUDANG,
              warehouseId: "", 
              note: fund.note || `Dibeli oleh Admin menggunakan Dana Bantuan. Harap petugas gudang segera menyiapkan paket logistik ini untuk tujuan: ${fund.recipient}.`,
              qrcode: itemQrcode,
              donorWallet: fund.adminWallet || "",
              donorName: `Admin`,
              transactionHash: fund.transactionHash,
              network: fund.network || "Solana Devnet",
              verificationStatus: "APPROVED",
              currentLocation: "Gudang Logistik",
              warehouseStatus: "Menunggu Persiapan Gudang",
              deliveryStatus: "Belum Dikirim",
              assignedVolunteer: "",
              createdAt: new Date(fund.createdAt || Date.now()).toISOString(),
              updatedAt: new Date(fund.createdAt || Date.now()).toISOString(),
              verifiedAt: new Date(fund.createdAt || Date.now()).toISOString(),
              verifiedBy: "Admin",
            };
            currentLogistics.unshift(purchasedGoods);
            hasChanges = true;
          }
        });

        if (hasChanges) {
          localStorage.setItem("logistics", JSON.stringify(currentLogistics));
          loadLogistics();
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'fundUsage'));

    // Polling and events for synchronicity across dashboard roles
    window.addEventListener('storage', loadLogistics);
    const interval = setInterval(loadLogistics, 3000);

    return () => {
      window.removeEventListener('storage', loadLogistics);
      clearInterval(interval);
      unsubscribeUsage();
    };
  }, []);

  const prepareShipment = (id: string) => {
    const savedLogistics = localStorage.getItem("logistics");
    if (!savedLogistics) return;

    const allLogistics = JSON.parse(savedLogistics) as Goods[];
    const updatedLogistics = allLogistics.map(item => {
      if (String(item.id) === String(id)) {
        return {
          ...item,
          status: LogisticStatus.READY_FOR_PICKUP,
          deliveryStatus: "Menunggu Relawan",
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });

    localStorage.setItem("logistics", JSON.stringify(updatedLogistics));
    setGoods(updatedLogistics);
    setNotification({ msg: "Barang siap dijemput oleh relawan.", type: 'success' });
    setTimeout(() => setNotification(null), 5000);
  };

  const warehouseItems = goods.filter(
    item =>
      item.verificationStatus === "APPROVED" &&
      (
        item.status === "Di Gudang" ||
        item.status === "Siap Dikirim" ||
        item.status === "Siap Dijemput" ||
        item.status === "Dalam Pengiriman" ||
        item.status === "Selesai Disalurkan"
      )
  );

  const totalStok = warehouseItems.length;

  const stokDiGudang = warehouseItems.filter(
    item => item.status === "Di Gudang"
  ).length;

  const siapDikirim = warehouseItems.filter(
    item => item.status === "Siap Dikirim" || item.status === "Siap Dijemput"
  ).length;

  const sudahDistribusi = warehouseItems.filter(
    item => item.status === "Selesai Disalurkan"
  ).length;

  const filteredWarehouseItems = warehouseItems.filter(g => 
    (g.itemName || (g as any).name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) || 
    (g.qrcode || "").toLowerCase().includes((searchTerm || "").toLowerCase())
  );

  const onScanSuccess = async (decodedText: string) => {
    scannerRef.current?.clear();
    setScanning(false);
    
    try {
      const savedLogistics = localStorage.getItem("logistics");
      if (!savedLogistics) {
        setNotification({ msg: "Database logistik kosong.", type: "error" });
        return;
      }

      const allLogistics = JSON.parse(savedLogistics) as Goods[];
      const itemIndex = allLogistics.findIndex(g => g.qrcode === decodedText);
      
      if (itemIndex === -1) {
        setNotification({
          msg: `Item dengan QR ${decodedText} tidak ditemukan di sistem.`,
          type: 'error'
        });
        return;
      }

      const item = allLogistics[itemIndex];

      // Reception Logic: If it's a donor item or unassigned or marked as moving, this warehouse receives it
      if (item.verificationStatus === "APPROVED" && (item.warehouseStatus === "Belum Masuk Gudang" || !item.warehouseId)) {
        const updatedItem: Goods = {
          ...item,
          warehouseId: user.uid,
          status: LogisticStatus.IN_GUDANG,
          warehouseStatus: "Masuk Gudang",
          currentLocation: "Gudang Logistik",
          updatedAt: new Date().toISOString()
        };

        const updatedLogistics = [...allLogistics];
        updatedLogistics[itemIndex] = updatedItem;
        localStorage.setItem("logistics", JSON.stringify(updatedLogistics));
        setGoods(updatedLogistics);

        setNotification({
          msg: `Barang "${updatedItem.itemName || (updatedItem as any).name}" berhasil diterima di gudang Anda.`,
          type: 'success'
        });
      } else if (item.warehouseId === user.uid) {
        setNotification({
          msg: `Info Barang: ${item.itemName || (item as any).name} sudah ada di inventaris Anda. Status: ${item.status}`,
          type: 'success'
        });
      } else {
        setNotification({
          msg: `Barang "${item.itemName || (item as any).name}" terdaftar di gudang lain.`,
          type: 'error'
        });
      }
    } catch (error: any) {
      setNotification({
        msg: 'Gagal memproses QR code.',
        type: 'error'
      });
    }
    setTimeout(() => setNotification(null), 5000);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatSummaryCard 
          icon={<Package className="text-blue-400" />} 
          label="Total Stok" 
          value={`${totalStok} Barang`} 
          subtext="Barang terverifikasi"
        />
        <StatSummaryCard 
          icon={<ClipboardList className="text-amber-400" />} 
          label="Stok di Gudang" 
          value={`${stokDiGudang} Barang`} 
          subtext="Tersedia di gudang"
        />
        <StatSummaryCard 
          icon={<ArrowRight className="text-purple-400" />} 
          label="Siap Dikirim" 
          value={`${siapDikirim} Barang`} 
          subtext="Siap didistribusikan"
        />
        <StatSummaryCard 
          icon={<History className="text-emerald-400" />} 
          label="Sudah Didistribusi" 
          value={`${sudahDistribusi} Barang`} 
          subtext="Telah sampai tujuan"
        />
      </div>

      {/* Admin Purchased Goods Preparation Notice */}
      {warehouseItems.some(g => g.source === "Pembelian Admin (Dana Bantuan)" && g.status === LogisticStatus.IN_GUDANG) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
              <Package className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h4 className="font-black text-sm text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                Daftar Persiapan Pembelian Admin
              </h4>
              <p className="text-xs font-bold text-slate-300 mt-1">
                Tim Admin baru saja mencatat pembelian logistik menggunakan Dana Bantuan. Segera siapkan barang-barang berikut di gudang untuk disalurkan ke posko tujuan:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {warehouseItems
                  .filter(g => g.source === "Pembelian Admin (Dana Bantuan)" && g.status === LogisticStatus.IN_GUDANG)
                  .map(g => (
                    <span key={g.id} className="text-[10px] font-black bg-[#0f172a] border border-slate-800 text-amber-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                      📦 {g.itemName} ({g.quantity} {g.unit}) ➔ {g.destination}
                    </span>
                  ))
                }
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#1e293b] p-6 rounded-2xl border border-slate-700/50 shadow-xl gap-4">
        <div className="flex items-center gap-3">
          <Warehouse className="h-6 w-6 text-blue-500" />
          <div>
            <h2 className="text-xl font-bold">Inventory Gudang</h2>
            <p className="text-xs text-slate-400 mt-1">Barang yang telah diverifikasi admin dan siap dikelola gudang</p>
          </div>
        </div>
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
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identifier / Source</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Nama Barang</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Jumlah & Satuan</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Tujuan Posko</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Blockchain Receipt</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Node Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredWarehouseItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="h-10 w-10 text-slate-600 animate-bounce" />
                      <div className="font-bold text-slate-400 text-base">Belum ada barang masuk gudang</div>
                      <div className="text-xs text-slate-500">Barang akan muncul di sini setelah Admin menyetujui donasi barang dari donatur.</div>
                    </div>
                  </td>
                </tr>
              ) : filteredWarehouseItems.map((item) => (
                <motion.tr 
                  layout
                  key={item.id} 
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  {/* Identifier / Source */}
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs text-blue-400 select-all">{item.id}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1">
                      {item.source || "Donasi Donatur"}
                    </div>
                  </td>

                  {/* Nama Barang */}
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-200">{item.itemName || (item as any).name}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{item.category}</div>
                  </td>

                  {/* Jumlah & Satuan */}
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-200">{item.quantity} {item.unit}</div>
                  </td>

                  {/* Tujuan Posko */}
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-300 italic flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-red-500/50" />
                      {item.destination || "Posko Utama"}
                    </div>
                  </td>

                  {/* Blockchain Receipt */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white rounded-lg shadow-lg group-hover:scale-105 transition-transform border border-slate-200 shrink-0">
                        <QRCodeSVG value={item.qrcode} size={28} />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <code className="text-[9px] font-mono bg-[#0f172a] px-1.5 py-0.5 rounded border border-slate-800 text-blue-400 truncate max-w-[124px]">
                          {item.qrcode}
                        </code>
                        {item.transactionHash ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest">ON-CHAIN</div>
                            <code className="text-[9px] font-mono text-slate-500 truncate max-w-[120px]">
                              {item.transactionHash}
                            </code>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">DATABASE ONLY</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Node Status */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        item.transactionHash ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-700"
                      )} />
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="text-[9px] text-slate-600 mt-2 font-mono uppercase">
                      Sync: {item.updatedAt ? format(new Date(item.updatedAt), 'HH:mm:ss') : 'N/A'}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      {item.status === LogisticStatus.IN_GUDANG && (
                         <button 
                           onClick={() => prepareShipment(item.id)}
                           className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 group w-max shadow-md shadow-blue-600/10 cursor-pointer"
                         >
                           Siapkan Pengiriman
                           <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                         </button>
                      )}
                      {(item.status === LogisticStatus.READY_FOR_PICKUP || item.status === "Siap Dikirim") && (
                          <span className="text-[9px] font-bold text-slate-500 italic block">Menunggu Relawan...</span>
                      )}
                      {(item.status === LogisticStatus.PICKED_UP || item.status === "Dalam Pengiriman") && (
                          <span className="text-[9px] font-bold text-amber-500 italic block">Dalam Pengiriman</span>
                      )}
                      {(item.status === LogisticStatus.DELIVERED || item.status === "Selesai Disalurkan") && (
                          <span className="text-[9px] font-bold text-emerald-500 italic block">Selesai Disalurkan</span>
                      )}
                      {item.transactionHash ? (
                        <a 
                          href={`https://explorer.solana.com/tx/${item.transactionHash}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center gap-1 w-max active:scale-95"
                        >
                          Lihat Explorer
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      ) : null}
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

function StatusBadge({ status }: { status: LogisticStatus | string }) {
  const styles: Record<string, string> = {
    'Di Gudang': "bg-blue-500/10 text-blue-400 border-blue-500/20",
    'Dalam Pengiriman': "bg-purple-500/10 text-purple-400 border-purple-500/20",
    'Selesai Disalurkan': "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
      styles[status as string] || "bg-slate-500/10 text-slate-500 border-slate-500/20"
    )}>
      {status}
    </span>
  );
}
