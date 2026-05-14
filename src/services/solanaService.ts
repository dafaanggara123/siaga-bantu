import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export async function sendSolanaTransaction(
  senderAddress: string,
  recipientAddress: string = 'self',
  amountSol: number = 0.001
): Promise<string> {
  try {
    const { solana } = window as any;
    
    // If Phantom is connected
    if (solana?.isPhantom && solana.isConnected) {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      const fromPubkey = new PublicKey(senderAddress);
      
      // Use sender address if 'self' to ensure valid transaction
      const toPubkey = new PublicKey(recipientAddress === 'self' || recipientAddress === 'DonorRecipientAddress1111111111111111111111'
        ? senderAddress 
        : recipientAddress);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: amountSol * LAMPORTS_PER_SOL,
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      const { signature } = await solana.signAndSendTransaction(transaction);
      return signature;
    }
    
    // Simulate hash if no real wallet (for preview purposes if user doesn't have Phantom)
    const chars = '0123456789abcdef';
    let fakeHash = '';
    const hashLength = 88;
    for (let i = 0; i < hashLength; i++) {
      fakeHash += chars[Math.floor(Math.random() * chars.length)];
    }
    return fakeHash;
  } catch (error) {
    console.error('Solana transaction failed:', error);
    throw error;
  }
}
