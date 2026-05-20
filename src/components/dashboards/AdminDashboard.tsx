import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile, Goods, LogisticStatus, Donation, BlockchainNetwork, UserRole, FundUsage } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import { Package, ArrowUpRight, ShieldCheck, ExternalLink, Search, Activity, Users, Clock, History, Plus, ArrowRight, CheckCircle, Info, MapPin, Wallet, CreditCard, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { getExplorerUrl, getCurrencySymbol, cn } from '../../lib/utils';
import { sendSolanaTransaction, sendAdminLogisticsMemoToSolana, sendFundUsageMemoToSolana } from '../../services/solanaService';

function formatSolAmount(amount: number) {
  const value = Number(amount || 0);
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M SOL`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K SOL`;
  }
  return `${value.toFixed(2)} SOL`;
}

interface AdminDashboardProps {
  user: UserProfile;
  walletNetwork: BlockchainNetwork | null;
  onConnect: () => void;
}

export default function AdminDashboard({ user, walletNetwork, onConnect }: AdminDashboardProps) {
  const [goodsDonations, setGoodsDonations] = useState<Goods[]>([]);
  const [logistics, setLogistics] = useState<Goods[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [fundUsage, setFundUsage] = useState<FundUsage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFundForm, setShowFundForm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const shortenAddress = (address: string | undefined | null) => {
    if (!address || typeof address !== "string") return "Wallet tidak tersedia";
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const resetAllGoodsDatabase = () => {
    const keysToRemove = [
      "goodsDonations",
      "logistics",
      "pendingGoodsDonations",
      "distributionLedger",
      "inventoryLedger",
      "warehouseItems",
      "volunteerDeliveries",
      "publicGoodsTracking",
      "oldLogistics",
      "goodsDatabase"
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));

    setGoodsDonations([]);
    setLogistics([]);
    
    setShowResetModal(false);
    setNotification({ msg: "Database barang lama berhasil dikosongkan.", type: 'success' });
    setTimeout(() => setNotification(null), 5000);
  };

  const currencySymbol = getCurrencySymbol(walletNetwork || BlockchainNetwork.SOLANA);

  // Logistics Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Makanan');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('Box');
  const [condition, setCondition] = useState('Baru');
  const [destination, setDestination] = useState('Posko Utama - Jakarta');
  const [source, setSource] = useState('Admin');
  const [initialStatus, setInitialStatus] = useState(LogisticStatus.IN_GUDANG);
  const [notes, setNotes] = useState('');

  // Fund Usage Form State
  const [usageType, setUsageType] = useState('Pembelian Logistik');
  const [amountSol, setAmountSol] = useState<string>('1.0');
  const [fundCategory, setFundCategory] = useState('Makanan');
  const [purpose, setPurpose] = useState('');
  const [recipient, setRecipient] = useState('');
  const [fundNote, setFundNote] = useState('');
  const [supportingProof, setSupportingProof] = useState('');
  const [fundStatus, setFundStatus] = useState('Menunggu Verifikasi');

  useEffect(() => {
    // Load data from localStorage as requested
    const savedGoodsDonations = localStorage.getItem("goodsDonations");
    const savedLogistics = localStorage.getItem("logistics");

    setGoodsDonations(savedGoodsDonations ? JSON.parse(savedGoodsDonations) : []);
    setLogistics(savedLogistics ? JSON.parse(savedLogistics) : []);

    const unsubscribeDonations = onSnapshot(collection(db, 'donations'), (snapshot) => {
      const items: Donation[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Donation));
      setDonations(items.sort((a, b) => b.timestamp - a.timestamp));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'donations'));

    const unsubscribeUsage = onSnapshot(collection(db, 'fundUsage'), (snapshot) => {
      const items: FundUsage[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as FundUsage));
      const sortedUsage = items.sort((a, b) => b.createdAt - a.createdAt);
      setFundUsage(sortedUsage);

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
          setLogistics(currentLogistics);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'fundUsage'));

    return () => {
      unsubscribeDonations();
      unsubscribeUsage();
    };
  }, []);

  const totalDonationsAmount = donations.reduce((acc, d) => acc + d.amount, 0);
  const totalUsedFunds = fundUsage.reduce((acc, f) => acc + f.amountSol, 0);
  const availableFunds = totalDonationsAmount - totalUsedFunds;

  // Filter logic as requested
  const pendingGoodsDonations = goodsDonations.filter(
    item => item.verificationStatus === "PENDING" || (item as any).verificationStatus === "MENUNGGU_VERIFIKASI_ADMIN"
  );

  const approvedLogistics = logistics.filter(
    item => item.verificationStatus === "APPROVED" || item.status === "Di Gudang" || item.status === LogisticStatus.IN_GUDANG
  );

  const filteredLogistics = approvedLogistics.filter(g => 
    ((g.itemName || g.name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) || 
    (g.qrcode || "").toLowerCase().includes((searchTerm || "").toLowerCase()))
  );

  const approveGoodsDonation = (donationId: string) => {
    const selectedDonation = goodsDonations.find(
      item => String(item.id) === String(donationId)
    );

    if (!selectedDonation) {
      setNotification({ msg: "Data donasi barang tidak ditemukan.", type: 'error' });
      return;
    }

    const approvedDonation = {
      ...selectedDonation,
      status: "Di Gudang",
      verificationStatus: "APPROVED",
      currentLocation: "Gudang Logistik",
      warehouseStatus: "Masuk Gudang",
      verifiedAt: new Date().toISOString(),
      verifiedBy: user.displayName || "Admin"
    };

    const newLogisticsItem: Goods = {
      id: `LOG-${Date.now()}`,
      uid: selectedDonation.uid || selectedDonation.id,
      itemName: selectedDonation.itemName || (selectedDonation as any).name || "Barang",
      category: selectedDonation.category,
      quantity: selectedDonation.quantity,
      unit: selectedDonation.unit,
      condition: selectedDonation.condition,
      destination: selectedDonation.destination,
      note: selectedDonation.note || (selectedDonation as any).notes || "",
      donorName: selectedDonation.donorName || "Anonim",
      donorWallet: selectedDonation.donorWallet || "",
      transactionHash: selectedDonation.transactionHash || "",
      network: selectedDonation.network || "Solana Devnet",
      source: "Donasi Donatur",
      status: "Di Gudang",
      verificationStatus: "APPROVED",
      currentLocation: "Gudang Logistik",
      warehouseStatus: "Masuk Gudang",
      deliveryStatus: "Belum Dikirim",
      assignedVolunteer: "",
      qrcode: selectedDonation.qrcode,
      warehouseId: user.uid,
      createdAt: selectedDonation.createdAt,
      updatedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      verifiedBy: user.displayName || "Admin",
      deliveredAt: null,
      deliveredBy: null,
      receivedAt: null,
      receivedBy: null
    };

    const updatedGoodsDonations = goodsDonations.map(item =>
      String(item.id) === String(donationId) ? approvedDonation : item
    );

    const updatedLogistics = [newLogisticsItem, ...logistics];

    setGoodsDonations(updatedGoodsDonations);
    setLogistics(updatedLogistics);

    localStorage.setItem("goodsDonations", JSON.stringify(updatedGoodsDonations));
    localStorage.setItem("logistics", JSON.stringify(updatedLogistics));

    setNotification({ msg: "Donasi barang berhasil disetujui dan masuk ke gudang.", type: 'success' });
    setTimeout(() => setNotification(null), 5000);
  };

  const rejectGoodsDonation = (donationId: string, reason: string) => {
    if (!reason || reason.trim() === "") {
      setNotification({ msg: "Alasan penolakan wajib diisi.", type: 'error' });
      return;
    }

    const selectedDonation = goodsDonations.find(
      item => String(item.id) === String(donationId)
    );

    if (!selectedDonation) {
      setNotification({ msg: "Data donasi barang tidak ditemukan.", type: 'error' });
      return;
    }

    // Send notification to donor by writing to donorNotifications in localStorage
    const donorId = selectedDonation.donorId || selectedDonation.uid;
    const newNotification = {
      id: `NOTIF-${Date.now()}`,
      donorId: donorId,
      itemName: selectedDonation.itemName || (selectedDonation as any).name || "Barang",
      reason: reason,
      message: `Donasi barang "${selectedDonation.itemName || (selectedDonation as any).name}" ditolak oleh Admin. Alasan: ${reason}`,
      createdAt: new Date().toISOString(),
      read: false
    };

    try {
      const savedNotifs = localStorage.getItem("donorNotifications");
      const currentNotifs = savedNotifs ? JSON.parse(savedNotifs) : [];
      const updatedNotifs = [newNotification, ...currentNotifs];
      localStorage.setItem("donorNotifications", JSON.stringify(updatedNotifs));
    } catch (e) {
      console.error("Gagal mengirim notifikasi ke donatur:", e);
    }

    // Delete item completely from goodsDonations and logistics to make sure it doesn't appear anywhere
    const updatedGoodsDonations = goodsDonations.filter(
      item => String(item.id) !== String(donationId)
    );

    const updatedLogistics = logistics.filter(
      item => String(item.uid) !== String(selectedDonation.uid) && String(item.id) !== String(donationId)
    );

    setGoodsDonations(updatedGoodsDonations);
    setLogistics(updatedLogistics);

    localStorage.setItem("goodsDonations", JSON.stringify(updatedGoodsDonations));
    localStorage.setItem("logistics", JSON.stringify(updatedLogistics));

    setShowRejectModal(null);
    setRejectionReason('');
    setNotification({ msg: "Donasi barang berhasil ditolak & dihapus seketika. Notifikasi penolakan telah dikirim ke donatur.", type: 'success' });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAddGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.walletAddress) {
      setNotification({ msg: 'Hubungkan wallet Anda terlebih dahulu.', type: 'error' });
      onConnect();
      return;
    }

    setLoading(true);
    try {
      const qrcode = `BLX-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      const logisticsData = {
        itemName: name,
        category,
        quantity,
        unit,
        condition,
        destination,
        source,
        status: initialStatus,
        note: notes
      };

      // Real on-chain registration via Solana Memo Program
      let txHash = '';
      try {
        const { solana } = window as any;
        if (solana?.isPhantom && solana.isConnected) {
          txHash = await sendAdminLogisticsMemoToSolana(solana, logisticsData);
        } else {
          throw new Error('Hubungkan wallet Phantom Anda terlebih dahulu.');
        }
      } catch (e: any) {
        console.error('Real admin transaction failed:', e);
        setNotification({
          msg: e.message || 'Gagal mencatat logistik ke Solana. Silakan coba lagi.',
          type: 'error'
        });
        setLoading(false);
        return;
      }

      const newGoods: Goods = {
        id: `GOOD-${Date.now()}`,
        uid: `GOOD-${Date.now()}`,
        itemName: name,
        category,
        quantity,
        unit,
        condition,
        destination,
        source,
        status: initialStatus,
        warehouseId: user.uid,
        note: notes,
        qrcode,
        donorWallet: user.walletAddress || "",
        donorName: user.displayName || "Admin",
        transactionHash: txHash,
        network: "Solana Devnet",
        verificationStatus: "APPROVED", // Admin input is auto-approved
        currentLocation: initialStatus === LogisticStatus.IN_GUDANG ? "Gudang Logistik" : "Admin Panel",
        warehouseStatus: initialStatus === LogisticStatus.IN_GUDANG ? "Masuk Gudang" : "Belum Masuk Gudang",
        deliveryStatus: "Belum Dikirim",
        assignedVolunteer: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        verifiedBy: user.displayName || "Admin",
      };

      const logisticsRef = collection(db, 'goods');
      try {
        await addDoc(logisticsRef, newGoods);
      } catch (fe) {
        console.warn("Firestore save failed, using local storage update.");
      }

      // Add to logistics since it's admin verified
      const updatedLogistics = [newGoods, ...logistics];
      setLogistics(updatedLogistics);
      localStorage.setItem("logistics", JSON.stringify(updatedLogistics));

      setName('');
      setNotes('');
      setQuantity(1);
      setShowAddForm(false);
      setNotification({
        msg: `Logistik "${newGoods.itemName}" berhasil dicatat ke Solana.`,
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

  const handleUseFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountSol);

    if (amount <= 0) {
      setNotification({ msg: 'Nominal SOL harus lebih dari 0.', type: 'error' });
      return;
    }

    if (amount > availableFunds) {
      setNotification({ msg: 'Dana tersedia tidak mencukupi untuk penggunaan ini.', type: 'error' });
      return;
    }

    if (!user.walletAddress) {
      setNotification({ msg: 'Hubungkan wallet Admin Anda.', type: 'error' });
      onConnect();
      return;
    }

    setLoading(true);
    let signature = '';
    try {
      if (user.role !== UserRole.ADMIN) {
        throw new Error("Hanya admin yang dapat menggunakan dana bantuan.");
      }

      const fundUsageData = {
        usageType,
        amountSol: amount,
        category: fundCategory,
        purpose,
        recipient,
        note: fundNote,
        supportingProof,
        status: fundStatus
      };

      try {
        const { solana } = window as any;
        if (solana?.isPhantom && solana.isConnected) {
          signature = await sendFundUsageMemoToSolana(solana, fundUsageData);
        } else {
          throw new Error('Hubungkan wallet Phantom Anda terlebih dahulu.');
        }
      } catch (err: any) {
        console.error('Fund usage transaction failed:', err);
        setNotification({
          msg: err.message || 'Gagal mencatat penggunaan dana ke Solana. Silakan coba lagi.',
          type: 'error'
        });
        setLoading(false);
        return;
      }

      const newUsageData: Omit<FundUsage, 'id'> = {
        uid: `FUND-${Date.now()}`,
        usageType,
        amountSol: amount,
        category: fundCategory,
        purpose,
        recipient,
        note: fundNote,
        supportingProof,
        status: fundStatus,
        adminWallet: user.walletAddress || "",
        transactionHash: signature,
        network: "Solana Devnet",
        createdAt: Date.now()
      };

      // Automatically register a logistics item for the warehouse when purchasing logistics
      if (usageType === 'Pembelian Logistik') {
        const itemQrcode = `SB-PUR-${Math.floor(Math.random() * 900000 + 100000)}`;
        const purchasedGoods: Goods = {
          id: `GOOD-PURCHASE-${Date.now()}`,
          uid: `GOOD-PURCHASE-${Date.now()}`,
          itemName: purpose || `Pembelian Logistik: ${fundCategory}`,
          category: fundCategory,
          quantity: 1, // 1 package
          unit: "Paket",
          condition: "Baru",
          destination: recipient || "Posko Utama",
          source: "Pembelian Admin (Dana Bantuan)",
          status: LogisticStatus.IN_GUDANG,
          warehouseId: "", 
          note: `Dibeli oleh Admin menggunakan Dana Bantuan. Harap petugas gudang segera menyiapkan paket logistik ini untuk tujuan: ${recipient}. Catatan Admin: ${fundNote || 'Tidak ada'}`,
          qrcode: itemQrcode,
          donorWallet: user.walletAddress || "",
          donorName: `Admin (${user.displayName || 'Bencana Panel'})`,
          transactionHash: signature,
          network: "Solana Devnet",
          verificationStatus: "APPROVED",
          currentLocation: "Gudang Logistik",
          warehouseStatus: "Menunggu Persiapan Gudang",
          deliveryStatus: "Belum Dikirim",
          assignedVolunteer: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString(),
          verifiedBy: user.displayName || "Admin",
        };

        // Write to Firestore 'goods' collection to sync
        try {
          await addDoc(collection(db, 'goods'), purchasedGoods);
        } catch (fe) {
          console.warn("Firestore save failed for purchased goods, using local storage update.");
        }

        // Add to logistics local list so it triggers immediately
        const savedLogistics = localStorage.getItem("logistics");
        const currentLogistics: Goods[] = savedLogistics ? JSON.parse(savedLogistics) : [];
        const updatedLogistics = [purchasedGoods, ...currentLogistics];
        localStorage.setItem("logistics", JSON.stringify(updatedLogistics));
        setLogistics(updatedLogistics);
      }

      try {
        await addDoc(collection(db, 'fundUsage'), newUsageData);
      } catch (dbError: any) {
        console.error("Fund usage database permission error:", dbError);
        
        // Check for permission error
        if (dbError.message.includes('permission') || dbError.message.includes('insufficient')) {
          console.warn("Database save failed, using local state fallback for preview.");
          const fallbackUsage: FundUsage = {
            id: `local-${Date.now()}`,
            ...newUsageData
          };
          
          // Manually update local state so it appears in the list even if Firestore write failed
          setFundUsage(prev => [fallbackUsage, ...prev]);
          
          setNotification({
            msg: "Gagal menyimpan data penggunaan dana ke database. Menggunakan fallback lokal.",
            type: 'error'
          });
          
          // Still clean up the form as if it worked (UX choice since we fell back)
          setAmountSol('1.0');
          setPurpose('');
          setRecipient('');
          setFundNote('');
          setSupportingProof('');
          setShowFundForm(false);
          return;
        } else {
          handleFirestoreError(dbError, OperationType.CREATE, 'fundUsage');
        }
      }
      
      setAmountSol('1.0');
      setPurpose('');
      setRecipient('');
      setFundNote('');
      setSupportingProof('');
      setShowFundForm(false);
      setNotification({
        msg: 'Penggunaan dana berhasil dicatat ke blockchain.',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (error: any) {
      console.error('Error in handleUseFunds:', error);
      
      let errorMsg = `Gagal mencatat penggunaan dana: ${error.message}`;
      
      // Secondary check for permission error in the thrown JSON or message
      if (error.message.includes('permission') || error.message.includes('insufficient')) {
        errorMsg = "Gagal menyimpan data penggunaan dana. Periksa permission database admin.";
      }

      setNotification({
        msg: errorMsg,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
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
                {notification.type === 'success' ? 'Sistem Verified' : 'Sistem Error'}
              </h5>
              <p className="text-sm font-bold leading-tight">{notification.msg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#1e293b] p-6 rounded-3xl border border-slate-700/50 shadow-xl">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold italic tracking-tighter uppercase">Admin Disaster Console</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowFundForm(true)}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            <CreditCard className="h-5 w-5" />
            Gunakan Dana Bantuan
          </button>
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="h-5 w-5" />
            Logistics Input
          </button>
        </div>
      </div>

      {/* Admin Notification Banner for Pending Donations */}
      {pendingGoodsDonations.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl animate-pulse">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-400 uppercase tracking-wider mb-0.5">🔔 Persetujuan Donasi Baru</p>
              <p className="text-xs text-slate-300 font-medium">Ada <span className="text-amber-400 font-extrabold">{pendingGoodsDonations.length} donasi barang baru</span> dari donor yang memerlukan tinjauan, persetujuan, atau penolakan Anda.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              const el = document.getElementById("verifikasi-donasi-barang-sec");
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-5 py-2.5 bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-amber-400 transition-colors shadow-lg cursor-pointer self-start sm:self-auto"
          >
            Tinjau Antrean
          </button>
        </motion.div>
      )}

      {/* Verification Section */}
      {pendingGoodsDonations.length > 0 && (
        <div id="verifikasi-donasi-barang-sec" className="space-y-6 scroll-mt-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-amber-500/20 rounded-lg">
                <Package className="h-5 w-5 text-amber-500" />
             </div>
             <div>
                <h2 className="text-xl font-black text-white italic tracking-tight uppercase">Verifikasi Donasi Barang</h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Menunggu Validasi Admin</p>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingGoodsDonations.map((item) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={item.id} 
                className="bg-slate-900 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden group"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-yellow-400 tracking-widest">
                      Menunggu Verifikasi Admin
                    </p>
                     <h3 className="mt-1 text-lg font-black text-white italic tracking-tight uppercase">
                      {item.itemName || (item as any).name}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {item.quantity} {item.unit} • {item.category}
                    </p>
                  </div>
                  <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-[10px] font-black text-yellow-300 uppercase tracking-tighter">
                    Pending
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Kondisi</p>
                    <p className="font-bold text-slate-200">{item.condition}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tujuan Posko</p>
                    <p className="font-bold text-emerald-400">{item.destination}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Wallet Donatur</p>
                    <p className="font-mono text-slate-300 truncate">
                      {shortenAddress(item.donorWallet || item.donorId)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Solana Proof</p>
                    {item.transactionHash || item.lastTxHash ? (
                      <a 
                        href={`https://explorer.solana.com/tx/${item.transactionHash || item.lastTxHash}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 font-bold flex items-center gap-1 hover:text-blue-300 transition-colors"
                      >
                         Lihat Explorer <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-slate-600 italic">Hash tidak tersedia</span>
                    )}
                  </div>
                </div>

                {(item.note || (item as any).notes) && (
                  <div className="p-3 bg-[#0f172a] rounded-xl border border-slate-800 text-[11px] text-slate-400 italic mb-5">
                    "{item.note || (item as any).notes}"
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                   <button 
                      onClick={() => approveGoodsDonation(item.id)}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                   >
                      Setujui
                   </button>
                   <button 
                      onClick={() => setShowRejectModal(item.id)}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-600/20 cursor-pointer"
                   >
                      Tolak
                   </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Wallet className="text-blue-400" />} 
          label="Donasi Terkumpul" 
          value={formatSolAmount(totalDonationsAmount)} 
          subtext="Total Revenue Proof"
          fullValue={`${totalDonationsAmount} SOL`}
        />
        <StatCard 
          icon={<ShieldCheck className="text-emerald-400" />} 
          label="Dana Tersedia" 
          value={formatSolAmount(availableFunds)} 
          subtext="Ready for Disaster Relief"
          trend="emerald"
          fullValue={`${availableFunds} SOL`}
        />
        <StatCard 
          icon={<Send className="text-orange-400" />} 
          label="Dana Tersalurkan" 
          value={formatSolAmount(totalUsedFunds)} 
          subtext="On-Chain Expenditure"
          fullValue={`${totalUsedFunds} SOL`}
        />
        <StatCard 
          icon={<Package className="text-purple-400" />} 
          label="Total Logistik" 
          value={logistics.length.toLocaleString()} 
          subtext="Inventory Ledger"
        />
      </div>

      {/* Main Content Area */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Logistics Ledger */}
          <div className="bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-xl overflow-hidden min-h-[400px]">
            <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/30">
              <div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase italic">Distribution Control Ledger</h2>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-1 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Inventory Network Live
                </div>
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
                  {filteredLogistics.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-600 font-mono text-xs uppercase tracking-widest">No matching records found</td>
                    </tr>
                  ) : filteredLogistics.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/50 group transition-colors px-6">
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-4">
                            <div className="p-1.5 bg-white rounded-lg shadow-lg border border-slate-200">
                              <QRCodeSVG value={item.qrcode} size={32} />
                            </div>
                            <div>
                              <div className="font-bold text-slate-200">{item.itemName || (item as any).name}</div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                 <div className="text-[10px] font-mono text-slate-500 uppercase">UID: {item.qrcode}</div>
                                 {(item.source || item.donorId) && (
                                   <span className={cn(
                                     "text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest",
                                     item.donorId 
                                       ? "text-blue-400 bg-blue-500/10 border-blue-500/20" 
                                       : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                   )}>
                                     {item.donorId ? `Donatur: ${item.donorName || 'Anonim'}` : `Sumber: ${item.source}`}
                                   </span>
                                 )}
                              </div>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         {item.transactionHash || item.lastTxHash ? (
                           <a 
                             href={getExplorerUrl(item.transactionHash || item.lastTxHash || "", (item.network || item.lastTxNetwork || BlockchainNetwork.SOLANA) as BlockchainNetwork)}
                             target="_blank"
                             rel="noreferrer"
                             className="text-[10px] font-mono text-blue-400 hover:underline flex items-center gap-1 group/hash"
                           >
                              <span className="max-w-[120px] truncate">{item.transactionHash || item.lastTxHash}</span>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                           </a>
                         ) : (
                           <span className="text-[10px] font-bold text-slate-600 italic uppercase">Hash tidak tersedia</span>
                         )}
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-3">
                            <span className={cn(
                               "h-2 w-2 rounded-full",
                               (item.transactionHash || item.lastTxHash) ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-700"
                            )} />
                            <StatusBadge status={item.status as any} />
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fund Usage Ledger */}
          <div className="bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700 bg-emerald-900/10">
              <h2 className="text-xl font-black tracking-tight text-white uppercase italic">Fund Usage Ledger</h2>
              <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest mt-1 flex items-center gap-2">
                Disaster Relief Spending • On-Chain Public Records
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">TYPE / NOMINAL</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">PURPOSE / RECIPIENT</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">RECEIPT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fundUsage.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-600 font-mono text-xs uppercase tracking-widest">Belum ada riwayat penggunaan dana</td>
                    </tr>
                  ) : fundUsage.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-300 text-sm">{f.usageType}</p>
                            <p className="text-[10px] font-black text-emerald-500">{f.amountSol} SOL</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-bold text-slate-400 leading-tight">{f.purpose}</p>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-2.5 w-2.5 text-slate-500" />
                            <p className="text-[9px] font-bold text-slate-500 uppercase">{f.recipient}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <a 
                          href={`https://explorer.solana.com/tx/${f.transactionHash}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-[#0f172a] rounded-lg border border-slate-800 text-[9px] font-bold text-blue-400 uppercase tracking-widest hover:border-blue-500/50 transition-all flex items-center gap-2 w-fit"
                        >
                          Verify Receipt
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Activity Feed */}
        <div className="space-y-6">
           <div className="bg-[#1e293b] rounded-3xl border border-slate-700/50 shadow-xl p-6 overflow-hidden">
              <h3 className="font-bold text-slate-200 mb-6 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                 <Clock className="h-4 w-4 text-blue-500" />
                 Live Activity Ledger
              </h3>
              <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
                 {approvedLogistics.slice(0, 6).map((item, idx) => (
                   <div key={item.id + idx} className="relative pl-8 group">
                      <div className={cn(
                        "absolute left-0 top-1 w-6 h-6 rounded-full bg-[#0f172a] border border-slate-800 flex items-center justify-center z-10",
                        item.status === LogisticStatus.DELIVERED || item.status === "Selesai Disalurkan" ? "text-emerald-500" : "text-blue-500"
                      )}>
                         <ArrowUpRight className="h-3 w-3" />
                      </div>
                      <p className="text-xs font-bold text-slate-200 leading-tight">
                         {item.itemName || (item as any).name}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">
                        {item.donorId ? 'Donor' : (item.source || 'Admin')} → <span className="font-bold text-blue-400">{item.status}</span>
                      </p>
                      <p className="text-[9px] text-slate-600 mt-0.5 font-mono">
                        {typeof item.updatedAt === "number" ? format(item.updatedAt, 'HH:mm:ss') : item.updatedAt}
                      </p>
                   </div>
                 ))}
                 {approvedLogistics.length === 0 && (
                   <p className="text-[10px] text-slate-600 italic text-center py-8 uppercase tracking-widest">No activity found</p>
                 )}
              </div>
           </div>

           <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 p-6 rounded-3xl border border-blue-500/20 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-12 -mt-12 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full" />
              <h3 className="font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-[10px] text-blue-200">
                 <Users className="h-4 w-4" />
                 Recent Donors
              </h3>
              <div className="space-y-4">
                 {donations.slice(0, 3).map((d) => (
                   <div key={d.id} className="p-3 bg-[#0f172a]/50 border border-slate-700/50 rounded-xl hover:bg-[#0f172a] transition-colors">
                      <div className="flex justify-between items-start mb-1 text-[10px] font-bold">
                         <span className="text-emerald-400">{d.amount} {getCurrencySymbol(d.txNetwork || BlockchainNetwork.SOLANA)}</span>
                         <span className="text-slate-500 uppercase tracking-widest font-mono">{format(d.timestamp, 'dd MMM')}</span>
                      </div>
                      <p className="text-[9px] text-slate-600 truncate font-mono">{d.txHash}</p>
                   </div>
                 ))}
                 {donations.length === 0 && (
                   <div className="text-center py-6">
                      <p className="text-[10px] text-slate-500 italic uppercase tracking-widest">Waiting for first donor...</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* Add Logistics Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#1e293b] w-full max-w-lg rounded-3xl shadow-2xl border border-slate-700 p-8 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Package className="text-blue-500" />
                Admin Inventory Sync
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
                          className="w-20 px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Kondisi</label>
                      <select 
                        value={condition} 
                        onChange={e => setCondition(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                      >
                        <option>Baru</option>
                        <option>Layak Pakai</option>
                        <option>Perlu Pemeriksaan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Status Awal</label>
                      <select 
                        value={initialStatus} 
                        onChange={e => setInitialStatus(e.target.value as LogisticStatus)}
                        className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none uppercase text-[10px] font-bold"
                      >
                        <option value={LogisticStatus.IN_GUDANG}>Di Gudang</option>
                        <option value={LogisticStatus.PICKED_UP}>Siap Dijemput</option>
                        <option value={LogisticStatus.IN_TRANSIT}>Dalam Pengiriman</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tujuan / Posko</label>
                      <select 
                        value={destination} 
                        onChange={e => setDestination(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                      >
                        <option>Posko Utama - Jakarta</option>
                        <option>Posko Bencana A - Jawa Barat</option>
                        <option>Gudang Logistik Pusat</option>
                        <option>Yayasan Kasih Bangsa</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Sumber Bantuan</label>
                      <select 
                        value={source} 
                        onChange={e => setSource(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                      >
                        <option>Admin</option>
                        <option>Donatur</option>
                        <option>Lembaga</option>
                        <option>Relawan</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Catatan Admin</label>
                    <textarea 
                      value={notes} 
                      onChange={e => setNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20 resize-none text-sm"
                      placeholder="Detail logistik tambahan..."
                    />
                  </div>

                  {/* Blockchain Proof Preview Card */}
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Blockchain Proof Preview</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[7px] font-bold uppercase">Ready</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[8px] font-mono">
                      <div className="space-y-0.5">
                        <p className="text-slate-500 uppercase">Network</p>
                        <p className="text-slate-300">Solana Devnet</p>
                      </div>
                      <div className="space-y-0.5 text-right">
                        <p className="text-slate-500 uppercase">Record Type</p>
                        <p className="text-slate-300">ADMIN_REGISTER</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-slate-500 uppercase">Wallet Admin</p>
                        <p className="text-slate-300">{user.walletAddress ? `${user.walletAddress.slice(0, 4)}...${user.walletAddress.slice(-4)}` : 'N/A'}</p>
                      </div>
                      <div className="space-y-0.5 text-right">
                        <p className="text-slate-500 uppercase">Status</p>
                        <p className="text-blue-400">Anchor Verified</p>
                      </div>
                    </div>
                  </div>
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
                    className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {loading ? 'Anchoring...' : 'Simpan & Catat →'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gunakan Dana Modal */}
      <AnimatePresence>
        {showFundForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#1e293b] w-full max-w-xl rounded-3xl shadow-2xl border border-slate-700 p-8 max-h-[95vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black italic tracking-tighter text-emerald-400 uppercase">Gunakan Dana Bantuan</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">On-Chain Disaster Fund Usage</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-right">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Available Funds</p>
                  <p className="text-sm font-black text-white">{availableFunds.toFixed(4)} SOL</p>
                </div>
              </div>

              <form onSubmit={handleUseFunds} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Jenis Penggunaan</label>
                    <select 
                      value={usageType} 
                      onChange={e => setUsageType(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-bold text-sm"
                    >
                      <option>Pembelian Logistik</option>
                      <option>Kebutuhan Medis</option>
                      <option>Biaya Distribusi</option>
                      <option>Kebutuhan Posko</option>
                      <option>Bantuan Langsung Korban</option>
                      <option>Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nominal SOL</label>
                    <div className="relative">
                      <input 
                        required 
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={amountSol} 
                        onChange={e => setAmountSol(e.target.value)}
                        className="w-full pl-4 pr-12 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-black"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 uppercase">SOL</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Kategori Penggunaan</label>
                    <select 
                      value={fundCategory} 
                      onChange={e => setFundCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-bold text-sm"
                    >
                      <option>Makanan</option>
                      <option>Minuman</option>
                      <option>Medis</option>
                      <option>Transportasi</option>
                      <option>Posko</option>
                      <option>Pengungsian</option>
                      <option>Bantuan Tunai</option>
                      <option>Operasional Bantuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Status Penggunaan</label>
                    <select 
                      value={fundStatus} 
                      onChange={e => setFundStatus(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-bold text-sm uppercase tracking-widest italic"
                    >
                      <option>Menunggu Verifikasi</option>
                      <option>Diproses</option>
                      <option>Selesai Disalurkan</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tujuan Penggunaan</label>
                    <input 
                      required 
                      value={purpose} 
                      onChange={e => setPurpose(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                      placeholder="Misal: Beli 100 Box Nasi"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Penerima / Posko</label>
                    <input 
                      required 
                      value={recipient} 
                      onChange={e => setRecipient(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                      placeholder="Posko A, RT 05, ds. Sukamaju"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Catatan Admin</label>
                  <textarea 
                    value={fundNote} 
                    onChange={e => setFundNote(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all h-20 resize-none text-sm"
                    placeholder="Lampiran detail..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Bukti Pendukung (Link/Teks)</label>
                  <input 
                    value={supportingProof} 
                    onChange={e => setSupportingProof(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-xs font-mono"
                    placeholder="https://imgur.com/nota-pembelian"
                  />
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="text-[10px] font-bold text-white uppercase italic">Blockchain Anchor Sync</p>
                      <p className="text-[8px] font-mono text-slate-500">Record Type: DISASTER_FUND_USAGE</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">Network</p>
                    <p className="text-[9px] font-bold text-emerald-500">Solana Devnet</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowFundForm(false)}
                    className="flex-1 py-4 font-bold text-slate-500 hover:text-white transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {loading ? 'Signing On-Chain...' : 'Laksanakan & Catat →'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Donation Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#1e293b] w-full max-w-md rounded-3xl shadow-2xl border border-red-500/20 p-8"
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-500">
                <Info className="h-5 w-5" />
                Tolak Donasi Barang
              </h3>
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Harap berikan alasan penolakan untuk donasi ini. Alasan akan ditampilkan kepada donatur.</p>
                <textarea 
                  required
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0f172a] border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-red-500 outline-none transition-all h-32 resize-none text-sm"
                  placeholder="Contoh: Barang tidak layak pakai atau kategori tidak sesuai..."
                />
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setShowRejectModal(null);
                      setRejectionReason('');
                    }}
                    className="flex-1 py-3 font-bold text-slate-500 hover:text-white transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => rejectGoodsDonation(showRejectModal, rejectionReason)}
                    disabled={loading || !rejectionReason.trim()}
                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Tolak Donasi'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
               <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                  <Info className="h-8 w-8 text-red-500" />
               </div>
               <h3 className="text-xl font-bold text-white text-center mb-4 uppercase tracking-tight font-black italic">Konfirmasi Reset Data</h3>
               <p className="text-sm text-slate-400 text-center mb-8">
                 Apakah Anda yakin ingin mengosongkan seluruh database barang/logistik lama di semua tampilan? DATA YANG DIHAPUS TIDAK DAPAT DIKEMBALIKAN.
               </p>
               <div className="flex gap-4">
                  <button 
                    onClick={() => setShowResetModal(false)}
                    className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold transition-all hover:bg-slate-700 font-black uppercase tracking-widest text-[10px]"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={resetAllGoodsDatabase}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black shadow-lg shadow-red-600/20 hover:bg-red-500 transition-all font-black uppercase tracking-widest text-[10px]"
                  >
                    RESET SEKARANG
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, trend, fullValue }: { icon: React.ReactNode, label: string, value: string, subtext: string, trend?: 'emerald', fullValue?: string }) {
  return (
    <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-700/50 shadow-xl flex flex-col justify-between h-32 transform hover:scale-[1.02] transition-all overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity translate-x-2 -translate-y-2">
        {icon}
      </div>
      <div>
        <div 
          className={cn("text-2xl font-bold tracking-tight truncate whitespace-nowrap overflow-hidden max-w-full", trend === 'emerald' ? "text-emerald-400" : "text-slate-200")}
          title={fullValue || value}
        >
          {value}
        </div>
        <div className="text-[9px] font-mono text-slate-600 mt-1 uppercase tracking-widest truncate">{subtext}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LogisticStatus | string }) {
  const styles: Record<string, string> = {
    'Menunggu Verifikasi': "bg-amber-500/10 text-amber-500 border-amber-500/20",
    'Di Gudang': "bg-blue-500/10 text-blue-400 border-blue-500/20",
    'Siap Dijemput': "bg-amber-500/10 text-amber-500 border-amber-500/20",
    'Dalam Pengiriman': "bg-purple-500/10 text-purple-400 border-purple-500/20",
    'Selesai Disalurkan': "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    'Ditolak': "bg-red-500/10 text-red-500 border-red-500/20",
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
