import { useState, useEffect } from 'react';
import { X, Wallet, ShieldCheck, ExternalLink, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { BlockchainNetwork } from '../../types';

interface WalletConnectProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (address: string, network: BlockchainNetwork) => void;
}

export const NETWORKS = [
  { 
    id: BlockchainNetwork.SOLANA, 
    name: 'Solana Devnet', 
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png', 
    color: 'text-purple-400', 
    banner: 'bg-purple-500/10' 
  },
  { 
    id: BlockchainNetwork.POLYGON, 
    name: 'Polygon', 
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png', 
    color: 'text-blue-400', 
    banner: 'bg-blue-500/10' 
  },
  { 
    id: BlockchainNetwork.ETHEREUM, 
    name: 'Ethereum', 
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png', 
    color: 'text-indigo-400', 
    banner: 'bg-indigo-500/10' 
  },
  { 
    id: BlockchainNetwork.BASE, 
    name: 'Base', 
    icon: 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4', 
    color: 'text-blue-600', 
    banner: 'bg-blue-600/10' 
  },
  { 
    id: BlockchainNetwork.ARBITRUM, 
    name: 'Arbitrum', 
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png', 
    color: 'text-sky-400', 
    banner: 'bg-sky-500/10' 
  },
  { 
    id: BlockchainNetwork.OPTIMISM, 
    name: 'Optimism', 
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png', 
    color: 'text-red-500', 
    banner: 'bg-red-500/10' 
  },
];

const WALLETS: Record<BlockchainNetwork, { name: string; icon: string; color: string }[]> = {
  [BlockchainNetwork.SOLANA]: [
    { name: 'Phantom', icon: 'https://avatars.githubusercontent.com/u/78782331?s=200&v=4', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { name: 'Solflare', icon: 'https://avatars.githubusercontent.com/u/60454354?s=200&v=4', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    { name: 'Backpack', icon: 'https://avatars.githubusercontent.com/u/110599557?s=200&v=4', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ],
  [BlockchainNetwork.POLYGON]: [
    { name: 'MetaMask', icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/Metamask-logo.svg', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { name: 'Trust Wallet', icon: 'https://avatars.githubusercontent.com/u/32333462?s=200&v=4', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { name: 'Coinbase Wallet', icon: 'https://avatars.githubusercontent.com/u/18060234?s=200&v=4', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  ],
  [BlockchainNetwork.ETHEREUM]: [
    { name: 'MetaMask', icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/Metamask-logo.svg', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { name: 'Rainbow', icon: 'https://avatars.githubusercontent.com/u/55122171?s=200&v=4', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { name: 'Safe', icon: 'https://avatars.githubusercontent.com/u/108420427?s=200&v=4', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ],
  [BlockchainNetwork.BASE]: [
    { name: 'Coinbase Wallet', icon: 'https://avatars.githubusercontent.com/u/18060234?s=200&v=4', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    { name: 'MetaMask', icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/Metamask-logo.svg', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { name: 'Rabby', icon: 'https://avatars.githubusercontent.com/u/89667468?s=200&v=4', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  ],
  [BlockchainNetwork.ARBITRUM]: [
    { name: 'MetaMask', icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/Metamask-logo.svg', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { name: 'Rabby', icon: 'https://avatars.githubusercontent.com/u/89667468?s=200&v=4', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    { name: 'Rainbow', icon: 'https://avatars.githubusercontent.com/u/55122171?s=200&v=4', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ],
  [BlockchainNetwork.OPTIMISM]: [
    { name: 'MetaMask', icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/Metamask-logo.svg', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    { name: 'Coinbase Wallet', icon: 'https://avatars.githubusercontent.com/u/18060234?s=200&v=4', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    { name: 'Safe', icon: 'https://avatars.githubusercontent.com/u/108420427?s=200&v=4', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ]
};

export default function WalletConnect({ isOpen, onClose, onConnect }: WalletConnectProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<BlockchainNetwork | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedNetwork(null);
      setConnecting(null);
    }
  }, [isOpen]);

  const handleSelect = async (wallet: string) => {
    if (!selectedNetwork) return;
    setConnecting(wallet);
    
    // Real integration if Phantom is selected on Solana
    if (wallet === 'Phantom' && selectedNetwork === BlockchainNetwork.SOLANA) {
      try {
        const { solana } = window as any;
        if (solana?.isPhantom) {
          const response = await solana.connect();
          onConnect(response.publicKey.toString(), selectedNetwork);
          setConnecting(null);
          return;
        } else {
          // If not installed, open download page
          window.open('https://phantom.app/', '_blank');
          setConnecting(null);
          return;
        }
      } catch (err) {
        console.error('Wallet connection failed:', err);
        setConnecting(null);
        return;
      }
    }

    // Fallback/Simulated connection for other wallets or if Phantom not present
    setTimeout(() => {
      let randomAddress = '';
      if (selectedNetwork === BlockchainNetwork.SOLANA) {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        randomAddress = Array.from({length: 44}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      } else {
        randomAddress = '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      }
      onConnect(randomAddress, selectedNetwork);
      setConnecting(null);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="wallet-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        >
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={onClose}
          />
          
          <motion.div
            key="wallet-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#1e293b] rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-700 pointer-events-auto"
          >
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight uppercase italic">Crypto E-Wallet</h3>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest font-mono">Pilih Secure Keyring</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-8">
              {!selectedNetwork ? (
                <div className="space-y-6">
                  <div className="p-5 bg-slate-800/50 rounded-2xl flex items-center gap-4 border border-slate-700">
                    <Globe className="h-6 w-6 text-blue-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pilih Network</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Bantuan tercatat di ledger pilihan Anda</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {NETWORKS.map((net) => (
                      <button
                        key={net.id}
                        onClick={() => setSelectedNetwork(net.id)}
                        className={cn(
                          "flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all cursor-pointer group",
                          "border-slate-800 bg-[#0f172a]/50 hover:border-blue-500/50 hover:bg-blue-600/5"
                        )}
                      >
                        <img 
                          src={net.icon} 
                          alt={net.name}
                          className="w-12 h-12 object-contain transition-all"
                        />
                        <span className={cn("font-black tracking-tighter text-lg uppercase", net.color)}>{net.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => setSelectedNetwork(null)}
                    className="mb-6 flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                  >
                    ← Kembali ke Network
                  </button>

                  <div className={cn("mb-8 p-5 border rounded-2xl flex items-start gap-4", 
                    NETWORKS.find(n => n.id === selectedNetwork)?.banner,
                    "border-blue-500/10"
                  )}>
                    <div className="mt-1">
                      <ShieldCheck className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-1">Authenticated Bridge</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        Financial assistance recorded on the <span className="text-white">{NETWORKS.find(n => n.id === selectedNetwork)?.name} Protocol</span> provides radical transparency and immutable proof.
                        {selectedNetwork === BlockchainNetwork.SOLANA && (
                          <span className="block mt-2 text-amber-400/80 text-[10px] uppercase font-bold italic">
                            * Pastikan Dompet Phantom Anda berada di Network Devnet
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {WALLETS[selectedNetwork].map((wallet) => (
                      <button
                        key={wallet.name}
                        onClick={() => handleSelect(wallet.name)}
                        disabled={!!connecting}
                        className={cn(
                          "flex items-center justify-between p-5 rounded-2xl border border-slate-800 bg-[#0f172a]/50 transition-all text-left cursor-pointer",
                          connecting === wallet.name ? "border-blue-500 bg-blue-500/10" : "hover:border-slate-600 hover:bg-[#0f172a]",
                          connecting && connecting !== wallet.name ? "opacity-50" : ""
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("p-1 rounded-xl border flex items-center justify-center bg-slate-900/50", wallet.color)}>
                            <img src={wallet.icon} alt={wallet.name} className="h-6 w-6 object-contain" />
                          </div>
                          <span className="font-bold text-slate-200">{wallet.name}</span>
                        </div>
                        {connecting === wallet.name ? (
                          <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-10 text-center">
                <a 
                  href={
                    selectedNetwork === BlockchainNetwork.SOLANA ? "https://solana.com" : 
                    selectedNetwork === BlockchainNetwork.POLYGON ? "https://polygon.technology" :
                    selectedNetwork === BlockchainNetwork.ETHEREUM ? "https://ethereum.org" :
                    selectedNetwork === BlockchainNetwork.BASE ? "https://base.org" :
                    selectedNetwork === BlockchainNetwork.ARBITRUM ? "https://arbitrum.io" :
                    "https://optimism.io"
                  } 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-[0.3em]"
                >
                  Explore Protocol <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
