import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { UserRole, UserProfile } from '../../types';
import { Mail, Lock, User as UserIcon, Shield, ArrowRight, Heart, Home, Truck, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../ui/Logo';

interface LoginProps {
  onPublicTracking: () => void;
}

export default function Login({ onPublicTracking }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.DONOR);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      
      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const userProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'User',
          role: UserRole.DONOR, // Default role for Google sign-in
        };
        await setDoc(doc(db, 'users', user.uid), userProfile);
      }
    } catch (err: any) {
      setError(err.message || 'Google Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          email,
          displayName: name || firebaseUser.email?.split('@')[0] || 'User',
          role: role || UserRole.DONOR,
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), userProfile);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Metode Login Email/Password belum diaktifkan di Firebase Console. Silakan aktifkan di tab Authentication > Sign-in method.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar. Silakan masuk atau gunakan email lain.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Gunakan minimal 6 karakter.');
      } else {
        setError(err.message || 'Gagal melakukan autentikasi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#020617]">
      {/* Left Side: Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-[#0f172a] p-12 text-white border-r border-slate-800">
        <Logo />
        
        <div>
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Transparansi Logistik <br /> 
            <span className="text-blue-400">Di Era Digital.</span>
          </h1>
          
          {/* System Pipeline Information */}
          <div className="mt-12 space-y-8 relative">
            <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-blue-500 via-slate-700 to-emerald-500 hidden sm:block opacity-30"></div>
            
            <div className="flex gap-6 relative group">
              <div className="z-10 bg-[#0f172a] p-3 rounded-full border border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <Heart className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-200">Donasi Terbuka</h4>
                <p className="text-sm text-slate-500 max-w-xs">Donatur mengirimkan bantuan fisik yang didata langsung ke sistem logistik digital.</p>
              </div>
            </div>

            <div className="flex gap-6 relative group">
              <div className="z-10 bg-[#0f172a] p-3 rounded-full border border-slate-700 text-slate-400">
                <Home className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-200">Gudang & Inventaris</h4>
                <p className="text-sm text-slate-500 max-w-xs">Barang diterima di gudang pusat, diverifikasi, dan diberi QR Code identitas unik.</p>
              </div>
            </div>

            <div className="flex gap-6 relative group">
              <div className="z-10 bg-[#0f172a] p-3 rounded-full border border-slate-700 text-slate-400 group-hover:border-blue-400 group-hover:text-blue-400 transition-all">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-200">Distribusi Relawan</h4>
                <p className="text-sm text-slate-500 max-w-xs">Relawan mengambil barang dan memperbarui status perjalanan melalui scan QR.</p>
              </div>
            </div>

            <div className="flex gap-6 relative group">
              <div className="z-10 bg-[#0f172a] p-3 rounded-full border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-200">Bukti Penerimaan</h4>
                <p className="text-sm text-slate-500 max-w-xs">Status terminal terverifikasi di Solana Blockchain sebagai bukti bantuan sampai.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-8 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <span>Off-Chain Data</span>
          <span className="text-slate-800">•</span>
          <span>Solana Mainnet</span>
          <span className="text-slate-800">•</span>
          <span>QR Verification</span>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-[#1e293b]/50 p-8 rounded-3xl shadow-2xl border border-slate-700/50 backdrop-blur-xl">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                {isRegistering ? 'Buat Akun Baru' : 'Secure Login'}
              </h2>
              <p className="text-slate-400 text-sm">
                {isRegistering ? 'Mulai berkontribusi dalam misi kemanusiaan.' : 'Masuk untuk mengelola logistik bantuan.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nama Lengkap</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {isRegistering && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Role / Peran</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 bg-[#0f172a] border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none outline-none"
                  >
                    <option value={UserRole.DONOR}>Donatur (Public)</option>
                    <option value={UserRole.WAREHOUSE}>Gudang (Inventory)</option>
                    <option value={UserRole.VOLUNTEER}>Relawan (Distribution)</option>
                    <option value={UserRole.ADMIN}>Admin (Supervisor)</option>
                  </select>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-500 focus:ring-4 focus:ring-blue-600/20 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-600/20"
              >
                {loading ? 'Processing...' : (isRegistering ? 'Daftar Sekarang' : 'Masuk Dashboard')}
                {!loading && <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-slate-800"></div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">ATAU</span>
                <div className="h-px flex-1 bg-slate-800"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 border border-slate-200"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
                Masuk dengan Google
              </button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {isRegistering ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Buat baru'}
              </button>
              
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-800"></div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">ATAU</span>
                <div className="h-px flex-1 bg-slate-800"></div>
              </div>

              <button
                onClick={onPublicTracking}
                className="w-full py-4 border border-slate-700 rounded-xl text-slate-400 font-semibold hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Cek Tracking Publik (Read Only)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
