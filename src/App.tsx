import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc,
  collection,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserRole, UserProfile, Goods, BlockchainNetwork } from './types';
import Login from './components/auth/Login';
import Navbar from './components/layout/Navbar';
import AdminDashboard from './components/dashboards/AdminDashboard';
import WarehouseDashboard from './components/dashboards/WarehouseDashboard';
import VolunteerDashboard from './components/dashboards/VolunteerDashboard';
import DonorDashboard from './components/dashboards/DonorDashboard';
import PublicTracking from './components/dashboards/PublicTracking';
import WalletConnectModal from './components/auth/WalletConnect';
import { CheckCircle, Info, Sparkles } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './components/ui/Logo';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletNetwork, setWalletNetwork] = useState<BlockchainNetwork | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tracking'>('dashboard');
  const [welcomeNote, setWelcomeNote] = useState<string | null>(null);

  useEffect(() => {
    // System Reset - One time clearance of old goods database as requested
    const DB_VERSION = 'v3.0.0';
    const currentVersion = localStorage.getItem('siagabantu_db_version');

    if (currentVersion !== DB_VERSION) {
      console.log('Performing system reset to clear old goods database...');
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
      
      localStorage.setItem('siagabantu_db_version', DB_VERSION);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setUser(userData);
            if (!user) {
              setWelcomeNote(`Selamat datang kembali, ${userData.displayName}!`);
              setTimeout(() => setWelcomeNote(null), 5000);
            }
            if (userDoc.data().walletAddress) {
              setWalletAddress(userDoc.data().walletAddress);
              setWalletNetwork(userDoc.data().walletNetwork || BlockchainNetwork.SOLANA);
              setWalletConnected(true);
            }
          } else {
            // Default to DONOR if profile missing for some reason
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.email?.split('@')[0] || 'User',
              role: UserRole.DONOR,
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'users');
        }
      } else {
        setUser(null);
        setWalletConnected(false);
        setWalletAddress(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleConnectWallet = (address: string, network: BlockchainNetwork) => {
    setWalletAddress(address);
    setWalletNetwork(network);
    setWalletConnected(true);
    setShowWalletModal(false);
    
    // Persist wallet to profile
    if (user) {
      setDoc(doc(db, 'users', user.uid), { 
        walletAddress: address,
        walletNetwork: network
      }, { merge: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-6">
        <Logo iconOnly className="scale-150 mb-4" />
        <motion.div 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-white font-black text-2xl tracking-tighter"
        >
          Siaga<span className="text-blue-500">Bantu</span>
        </motion.div>
      </div>
    );
  }

  if (!user && activeTab !== 'tracking') {
    return <Login onPublicTracking={() => setActiveTab('tracking')} />;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      <Navbar 
        user={user} 
        walletConnected={walletConnected} 
        walletNetwork={walletNetwork}
        onConnect={() => setShowWalletModal(true)}
        onLogout={() => signOut(auth)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {activeTab === 'tracking' ? (
            <motion.div
              key="tracking"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PublicTracking />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {user?.role === UserRole.ADMIN && (
                <AdminDashboard 
                  user={user} 
                  walletNetwork={walletNetwork} 
                  onConnect={() => setShowWalletModal(true)} 
                />
              )}
              {user?.role === UserRole.WAREHOUSE && (
                <WarehouseDashboard 
                  user={user} 
                  walletConnected={walletConnected} 
                  walletNetwork={walletNetwork} 
                  onConnect={() => setShowWalletModal(true)}
                />
              )}
              {user?.role === UserRole.VOLUNTEER && (
                <VolunteerDashboard 
                  user={user} 
                  walletConnected={walletConnected} 
                  walletNetwork={walletNetwork} 
                  onConnect={() => setShowWalletModal(true)}
                />
              )}
              {user?.role === UserRole.DONOR && (
                <DonorDashboard 
                  user={user} 
                  walletConnected={walletConnected} 
                  walletNetwork={walletNetwork} 
                  onConnect={() => setShowWalletModal(true)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <WalletConnectModal 
        isOpen={showWalletModal} 
        onClose={() => setShowWalletModal(false)}
        onConnect={handleConnectWallet}
      />

      {/* Welcome Toast */}
      <AnimatePresence>
        {welcomeNote && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9, transition: { duration: 0.2 } }}
            className="fixed bottom-8 left-8 z-[500] p-5 rounded-2xl bg-white border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center gap-4 min-w-[320px]"
          >
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h5 className="font-black text-[10px] text-blue-600 uppercase tracking-widest leading-none mb-1">Authenticated</h5>
              <p className="text-sm font-bold text-slate-800">{welcomeNote}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
