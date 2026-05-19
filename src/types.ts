/**
 * User Roles as requested
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  VOLUNTEER = 'RELAWAN',
  WAREHOUSE = 'GUDANG',
  DONOR = 'DONATUR',
}

export enum BlockchainNetwork {
  SOLANA = 'SOLANA',
  POLYGON = 'POLYGON',
  ETHEREUM = 'ETHEREUM',
  BASE = 'BASE',
  ARBITRUM = 'ARBITRUM',
  OPTIMISM = 'OPTIMISM',
}

/**
 * Logistic Item Status
 */
export enum LogisticStatus {
  PENDING_ADMIN = 'Menunggu Verifikasi',
  IN_GUDANG = 'Di Gudang',
  READY_FOR_PICKUP = 'Siap Dijemput',
  PICKED_UP = 'Dalam Pengiriman',
  DELIVERED = 'Selesai Disalurkan',
  REJECTED = 'Ditolak',
}

/**
 * Type for Logistic Goods
 */
export interface Goods {
  id: string; // Document ID
  uid: string; // Unique ID requested (often same as id or custom)
  itemName: string; 
  name?: string; // Keep for backward compatibility if needed, but prefer itemName
  category: string;
  quantity: number;
  unit: string;
  condition?: string;
  destination?: string;
  note?: string; // Standardized to 'note' as requested
  notes?: string; // Keep for backward compatibility
  status: LogisticStatus | string;
  warehouseId: string;
  volunteerId?: string | null;
  volunteerName?: string | null;
  donorId?: string | null;
  donorName?: string | null;
  donorWallet?: string; // Added as requested
  transactionHash?: string; // On-Chain Transaction Hash
  network?: string; // "Solana Devnet" etc.
  source?: string; // "Donasi Donatur", "Admin", etc.
  qrcode: string; // Unique string for QR
  verificationStatus?: string; // PENDING, APPROVED, REJECTED
  
  // New tracking fields
  currentLocation?: string;
  assignedVolunteer?: string;
  warehouseStatus?: string;
  deliveryStatus?: string;

  createdAt: number | string;
  updatedAt: number | string;
  
  verifiedAt?: number | string | null;
  verifiedBy?: string | null;
  
  rejectedAt?: number | string | null;
  rejectedBy?: string | null;
  rejectionReason?: string;
  
  deliveredAt?: number | string | null;
  deliveredBy?: string | null;
  
  receivedAt?: number | string | null;
  receivedBy?: string | null;

  lastTxHash?: string; // Keep for backward compatibility
  lastTxNetwork?: BlockchainNetwork; // Keep for backward compatibility
}

/**
 * User Profile
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  walletAddress?: string | null;
  walletNetwork?: BlockchainNetwork | null;
}

/**
 * Donation Record
 */
export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  amount: number;
  message?: string;
  txHash: string; // Every donation is on-chain
  txNetwork: BlockchainNetwork; // Network for the hash
  timestamp: number;
}

export interface FundUsage {
  id: string;
  uid: string; // FUND-xxxx
  usageType: string;
  amountSol: number;
  category: string;
  purpose: string;
  recipient: string;
  note?: string;
  supportingProof?: string;
  status: string;
  adminWallet: string;
  transactionHash: string;
  network: string; // "Solana Devnet"
  createdAt: number;
}
