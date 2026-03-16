import {
  AuthorityType,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

export interface WalletSigner {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
}

export interface LaunchTokenInput {
  connection: Connection;
  wallet: WalletSigner;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  initialSupply: string;
  recipient: string;
  revokeMint: boolean;
  revokeFreeze: boolean;
  revokeUpdate: boolean;
}

export interface LaunchTokenResult {
  mintAddress: string;
  ownerTokenAccount: string;
  signature: string;
  notes: string[];
}

function toBaseUnits(rawAmount: string, decimals: number): bigint {
  const clean = rawAmount.trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error('Initial supply must be a positive number.');
  }

  const [whole, fraction = ''] = clean.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Initial supply supports up to ${decimals} decimal places.`);
  }

  const paddedFraction = fraction.padEnd(decimals, '0');
  const normalized = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, '');
  return BigInt(normalized || '0');
}

export async function launchToken(input: LaunchTokenInput): Promise<LaunchTokenResult> {
  const {
    connection,
    wallet,
    tokenName,
    tokenSymbol,
    decimals,
    initialSupply,
    recipient,
    revokeMint,
    revokeFreeze,
    revokeUpdate,
  } = input;

  if (!tokenName.trim() || !tokenSymbol.trim()) {
    throw new Error('Token name and symbol are required.');
  }

  const owner = new PublicKey(recipient);
  const mintAmount = toBaseUnits(initialSupply, decimals);

  const mint = Keypair.generate();
  const recipientAta = getAssociatedTokenAddressSync(mint.publicKey, owner, false, TOKEN_PROGRAM_ID);
  const rentLamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

  const tx = new Transaction();

  tx.add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: rentLamports,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      wallet.publicKey,
      revokeFreeze ? null : wallet.publicKey,
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      recipientAta,
      owner,
      mint.publicKey,
      TOKEN_PROGRAM_ID,
    ),
    createMintToInstruction(
      mint.publicKey,
      recipientAta,
      wallet.publicKey,
      mintAmount,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  if (revokeMint) {
    tx.add(
      createSetAuthorityInstruction(
        mint.publicKey,
        wallet.publicKey,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;
  tx.partialSign(mint);

  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  const notes = [
    'Token metadata and social links require Metaplex metadata instructions, which are not included in this free client-only build.',
    'Liquidity pool creation requires DEX-specific contracts and cannot be done as a generic one-click action from this page.',
  ];

  if (revokeUpdate) {
    notes.push('Revoke Update is selected as a checklist item. On-chain metadata authority revoke requires Metaplex metadata instructions.');
  }

  return {
    mintAddress: mint.publicKey.toBase58(),
    ownerTokenAccount: recipientAta.toBase58(),
    signature,
    notes,
  };
}
