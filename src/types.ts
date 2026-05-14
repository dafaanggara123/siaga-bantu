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
  IN_GUDANG = 'DI GUDANG',
  PICKED_UP = 'DIAMBIL',
  IN_TRANSIT = 'DIKIRIM',
  DELIVERED = 'SAMPAI',
}

/**
 * Type for Logistic Goods
 */
export interface Goods {
  id: string; // Document ID
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: LogisticStatus;
  warehouseId: string;
  volunteerId?: string | null;
  donorId?: string | null;
  donorName?: string | null;
  qrcode: string; // Unique string for QR
  createdAt: number;
  updatedAt: number;
  lastTxHash?: string; // On-Chain Transaction Hash
  lastTxNetwork?: BlockchainNetwork; // Network for the hash
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
