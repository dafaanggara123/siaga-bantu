import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Goods, LogisticStatus, BlockchainNetwork } from '../../types';
import { 
  Search, 
  Package, 
  MapPin, 
  History, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle,
  Truck,
  Warehouse,
  ArrowRight,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { getExplorerUrl, cn } from '../../lib/utils';
import Logo from '../ui/Logo';

export default function PublicTracking() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState<Goods | null>(null);
  const [latestGoods, setLatestGoods] = useState<Goods[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Show last 10 activities publicly
    const q = query(collection(db, 'goods'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Goods[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Goods));
      setLatestGoods(items.slice(0, 10));
    });

    return () => unsubscribe();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;
    
    setSearching(true);
    const q = query(collection(db, 'goods'), where('qrcode', '==', searchTerm.trim().toUpperCase()));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      setSearchResult({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Goods);
    } else {
      setSearchResult(null);
    }
    setSearching(false);
  };

  const getStepStatus = (currentStatus: LogisticStatus, targetStatus: LogisticStatus) => {
    const order = [LogisticStatus.IN_GUDANG, LogisticStatus.PICKED_UP, LogisticStatus.IN_TRANSIT, LogisticStatus.DELIVERED];
    const currentIndex = order.indexOf(currentStatus);
    const targetIndex = order.indexOf(targetStatus);
    
    if (currentIndex > targetIndex) return 'completed';
    if (currentIndex === targetIndex) return 'current';
    return 'pending';
  };

  const TimelineStep = ({ title, desc, status, icon: Icon }: any) => (
    <div className="relative pl-12 pb-10 last:pb-0">
      {/* Connector */}
      <div className={cn(
        "absolute left-[19px] top-10 bottom-0 w-px",
        status === 'completed' ? "bg-emerald-500" : "bg-slate-800"
      )} />
      
      {/* Icon Node */}
      <div className={cn(
        "absolute left-0 top-0 w-10 h-10 rounded-2xl flex items-center justify-center z-10 border border-slate-700 transition-all duration-500 shadow-2xl",
        status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : 
        status === 'current' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 animate-pulse border-blue-400" : 
        "bg-[#0f172a] text-slate-600"
      )}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="pt-1">
        <h4 className={cn(
          "font-bold text-base uppercase tracking-widest",
          status === 'completed' ? "text-emerald-400" : 
          status === 'current' ? "text-white" : "text-slate-600"
        )}>
          {title}
        </h4>
        <p className="text-xs text-slate-500 mt-1 font-medium">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-16 pb-20 mt-12 px-6">
      <div className="flex justify-center">
        <Logo className="scale-125 translate-y-4" />
      </div>

      {/* Search Hero */}
      <div className="text-center space-y-6 relative pt-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-12 w-64 h-64 bg-blue-600/10 blur-3xl rounded-full" />
        
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="inline-flex items-center gap-3 px-5 py-2 bg-blue-600/10 border border-blue-500/20 rounded-full text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">
             <ShieldCheck className="h-4 w-4" /> Live Tracking Ecosystem
          </div>
            <div className="flex items-center gap-2 text-[9px] font-mono text-slate-600 uppercase tracking-widest font-bold">
            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
            Last Verified Hub: Multi-Chain Synchronization
          </div>
        </div>
        <h2 className="text-5xl font-black text-white tracking-tighter leading-none relative z-10">
          Cek Status <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Logistik.</span>
        </h2>
        <p className="text-slate-500 max-w-lg mx-auto text-sm font-medium leading-relaxed relative z-10">
          Cross-reference internal database UUIDs with the Blockchain Network's immutable proof of distribution.
        </p>

        <form onSubmit={handleSearch} className="max-w-xl mx-auto pt-8 relative z-10">
           <div className="relative group">
              <input 
                type="text" 
                placeholder="Masukkan ID-QR SB..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-40 py-6 bg-[#0f172a] border-2 border-slate-800 rounded-[2.5rem] shadow-2xl focus:border-blue-600 transition-all outline-none text-xl font-bold text-white placeholder:text-slate-700 font-mono tracking-widest"
              />
              <button 
                type="submit"
                className="absolute right-3 top-2.5 bottom-2.5 px-8 bg-blue-600 text-white rounded-[2rem] font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-3 cursor-pointer group-hover:scale-[1.02]"
              >
                 {searching ? (
                   <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                 ) : (
                   <>Track Hub <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" /></>
                 )}
              </button>
           </div>
           <p className="mt-4 text-[10px] font-mono text-slate-700 uppercase tracking-widest">Global Scan Active • Multi-Protocol Ecosystem</p>
        </form>
      </div>

      {/* Result Section */}
      <AnimatePresence mode="wait">
        {searchResult ? (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1e293b] rounded-[3rem] shadow-3xl border border-slate-700/50 overflow-hidden"
          >
             <div className="p-8 md:p-16 grid lg:grid-cols-2 gap-16 items-start">
                <div className="space-y-10">
                   <div>
                     <div className="flex items-center gap-5 mb-8">
                        <div className="p-5 bg-blue-600 rounded-[2rem] shadow-2xl shadow-blue-600/20">
                           <Package className="h-10 w-10 text-white" />
                        </div>
                        <div>
                           <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Authenticated Asset</div>
                           <h3 className="text-4xl font-black text-white tracking-tighter">{searchResult.name}</h3>
                           <div className="flex items-center gap-3 mt-3">
                              <span className="px-3 py-1 bg-[#0f172a] rounded-lg border border-slate-800 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{searchResult.qrcode}</span>
                              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                           </div>
                        </div>
                     </div>
                     
                     {/* Blockchain Ledger Insight */}
                     <div className="bg-[#0f172a] rounded-[2.5rem] p-8 border border-slate-800 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl -mr-12 -mt-12 rounded-full" />
                        <div className="flex items-center justify-between mb-8">
                          <div className="flex items-center gap-3 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            <History className="h-4 w-4" /> Protocol Continuity
                          </div>
                          <Database className="h-4 w-4 text-slate-800" />
                        </div>
                        <div className="space-y-1 mb-10">
                          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Sequence Timestamp</p>
                          <p className="text-xl font-bold text-slate-200 tracking-tight">{format(searchResult.updatedAt, 'dd MMMM yyyy, HH:mm:ss')}</p>
                        </div>
                        
                        {searchResult.lastTxHash ? (
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Hash Proof ({searchResult.lastTxNetwork || 'SECURE LEDGER'})</p>
                            <a 
                              href={getExplorerUrl(searchResult.lastTxHash, searchResult.lastTxNetwork || BlockchainNetwork.SOLANA)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between p-5 bg-blue-500/5 hover:bg-blue-500/10 rounded-2xl border border-blue-500/20 transition-all font-mono text-[10px] text-blue-400 font-bold group/link"
                            >
                               <span className="truncate">{searchResult.lastTxHash}</span>
                               <ExternalLink className="h-4 w-4 opacity-100 group-hover/link:translate-x-1 group-hover/link:-translate-y-1 transition-transform" />
                            </a>
                          </div>
                        ) : (
                          <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-600 text-[10px] text-center font-bold uppercase tracking-widest italic">
                            Awaiting On-Chain Anchoring...
                          </div>
                        )}
                     </div>
                   </div>
                </div>

                <div className="bg-slate-900/30 p-8 md:p-12 rounded-[2.5rem] border border-slate-800">
                   <div className="flex items-center gap-3 mb-12">
                      <div className="h-px flex-1 bg-slate-800" />
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Logistics Pipeline</h4>
                      <div className="h-px flex-1 bg-slate-800" />
                   </div>
                   <div className="flex flex-col">
                      <TimelineStep 
                        title="Registered" 
                        desc="Batch verified at global distribution hub."
                        status={getStepStatus(searchResult.status, LogisticStatus.IN_GUDANG)}
                        icon={Warehouse}
                      />
                      <TimelineStep 
                        title="Assigned" 
                        desc="Field agents engaged for transit operation."
                        status={getStepStatus(searchResult.status, LogisticStatus.PICKED_UP)}
                        icon={MapPin}
                      />
                      <TimelineStep 
                        title="In Transit" 
                        desc="Assets in motion via secure ground transport."
                        status={getStepStatus(searchResult.status, LogisticStatus.IN_TRANSIT)}
                        icon={Truck}
                      />
                      <TimelineStep 
                        title="Delivered" 
                        desc="Terminal verified at target coordinates."
                        status={getStepStatus(searchResult.status, LogisticStatus.DELIVERED)}
                        icon={CheckCircle}
                      />
                   </div>
                </div>
             </div>
          </motion.div>
        ) : searchTerm && !searching ? (
          <motion.div 
            key="notfound"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="text-center py-24 p-8 border-2 border-dashed border-slate-800 rounded-[3rem] text-slate-700 bg-slate-900/10"
          >
             <Search className="h-16 w-16 mx-auto mb-6 opacity-10" />
             <p className="font-bold text-xl uppercase tracking-widest text-slate-500">Asset Record Not Found</p>
             <p className="text-sm mt-2 font-mono">CODE: ERROR_IDENTIFIER_UNRESOLVED</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Global Explorer */}
      {!searchResult && (
        <div className="space-y-8">
           <div className="flex items-center gap-4">
              <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Recent Pipeline Activities</h3>
           </div>
           <div className="grid md:grid-cols-2 gap-6">
              {latestGoods.map((item) => (
                <button 
                  key={item.id} 
                  className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/10 transition-all text-left group flex items-center justify-between cursor-pointer"
                  onClick={() => { setSearchTerm(item.qrcode); setSearchResult(item); }}
                >
                   <div className="flex items-center gap-5">
                      <div className="p-4 bg-[#0f172a] text-slate-600 group-hover:text-blue-400 transition-colors rounded-2xl border border-slate-800">
                         <Package className="h-6 w-6" />
                      </div>
                      <div>
                         <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors leading-tight">{item.name}</h4>
                         <p className="text-[10px] text-slate-500 uppercase font-mono mt-1 tracking-widest">{item.qrcode}</p>
                      </div>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                       <span className={cn(
                          "px-3 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest",
                          item.status === LogisticStatus.DELIVERED ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                       )}>
                          {item.status}
                       </span>
                       <span className="text-[9px] text-slate-600 font-mono font-bold uppercase tracking-widest">
                          {format(item.updatedAt, 'HH:mm')} • {format(item.updatedAt, 'dd MMM')}
                       </span>
                   </div>
                </button>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}
