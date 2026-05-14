import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { BlockchainNetwork } from '../types';

/**
 * Utility for merging Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Simulates a blockchain transaction signature/hash based on network
 */
export function generateTxHash(network: BlockchainNetwork = BlockchainNetwork.SOLANA) {
  if (network === BlockchainNetwork.SOLANA) {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let signature = '';
    for (let i = 0; i < 88; i++) {
      signature += chars[Math.floor(Math.random() * chars.length)];
    }
    return signature;
  } else {
    // EVM networks (Polygon, Ethereum, Base)
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }
}

/**
 * Gets Explorer URL for a given signature/hash and network
 */
export function getExplorerUrl(hash: string, network: BlockchainNetwork = BlockchainNetwork.SOLANA) {
  switch (network) {
    case BlockchainNetwork.SOLANA:
      return `https://explorer.solana.com/tx/${hash}?cluster=devnet`;
    case BlockchainNetwork.POLYGON:
      return `https://polygonscan.com/tx/${hash}`;
    case BlockchainNetwork.ETHEREUM:
      return `https://etherscan.io/tx/${hash}`;
    case BlockchainNetwork.BASE:
      return `https://basescan.org/tx/${hash}`;
    case BlockchainNetwork.ARBITRUM:
      return `https://arbiscan.io/tx/${hash}`;
    case BlockchainNetwork.OPTIMISM:
      return `https://optimistic.etherscan.io/tx/${hash}`;
    default:
      return `https://explorer.solana.com/tx/${hash}`;
  }
}

export function getCurrencySymbol(network: BlockchainNetwork = BlockchainNetwork.SOLANA) {
  switch (network) {
    case BlockchainNetwork.SOLANA: return 'SOL';
    case BlockchainNetwork.POLYGON: return 'POL';
    case BlockchainNetwork.ETHEREUM: return 'ETH';
    case BlockchainNetwork.BASE: return 'ETH';
    case BlockchainNetwork.ARBITRUM: return 'ETH';
    case BlockchainNetwork.OPTIMISM: return 'ETH';
    default: return 'SOL';
  }
}
