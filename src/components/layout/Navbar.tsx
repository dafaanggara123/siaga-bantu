import { UserProfile, UserRole, BlockchainNetwork } from '../../types';
import { LogOut, Wallet, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import Logo from '../ui/Logo';
import { motion } from 'motion/react';
import { NETWORKS } from '../auth/WalletConnect';

interface NavbarProps {
  user: UserProfile | null;
  walletConnected: boolean;
  walletNetwork: BlockchainNetwork | null;
  onConnect: () => void;
  onLogout: () => void;
  activeTab: 'dashboard' | 'tracking';
  setActiveTab: (tab: 'dashboard' | 'tracking') => void;
}

export default function Navbar({ 
  user, 
  walletConnected,
  walletNetwork,
  onConnect, 
  onLogout,
  activeTab,
  setActiveTab
}: NavbarProps) {
  return (
    <nav className="bg-[#0f172a] border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Logo />

            <div className="hidden md:flex space-x-1">
              {user && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    activeTab === 'dashboard' ? "text-blue-400 bg-blue-500/10" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  Dashboard
                </button>
              )}
              <button
                onClick={() => setActiveTab('tracking')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  activeTab === 'tracking' ? "text-blue-400 bg-blue-500/10" : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                Public Tracking
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConnect}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border relative group",
                    walletConnected 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:bg-emerald-500/20" 
                      : "bg-blue-600 text-white border-blue-400/50 hover:bg-blue-500 shadow-xl shadow-blue-600/20"
                  )}
                >
                  <div className={cn(
                    "h-2 w-2 rounded-full border border-white/20 shadow-sm",
                    walletConnected 
                      ? "bg-emerald-500 animate-pulse shadow-emerald-500/50" 
                      : "bg-red-500 shadow-red-500/50"
                  )} />

                    <div className="flex items-center gap-2">
                       {walletConnected ? (
                         <img 
                           src={NETWORKS.find(n => n.id === walletNetwork)?.icon} 
                           alt={walletNetwork || ''} 
                           className="h-4 w-4 object-contain"
                         />
                       ) : (
                         <Wallet className="h-3 w-3" />
                       )}
                       {walletConnected 
                         ? `${walletNetwork} | ${user.walletAddress?.slice(0, 4)}...${user.walletAddress?.slice(-4)}` 
                         : 'Connect Wallet'}
                    </div>
                </motion.button>

                <div className="flex items-center gap-3 ml-2 border-l border-slate-800 pl-4">
                  <div className="flex flex-col items-end hidden sm:flex">
                    <span className="text-sm font-semibold text-slate-200">{user.displayName}</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 flex items-center gap-1">
                      {user.role === UserRole.ADMIN && <Shield className="h-3 w-3 text-red-500" />}
                      {user.role}
                    </span>
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
               <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                 <Shield className="h-4 w-4" />
                 Secure Hybrid System
               </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
