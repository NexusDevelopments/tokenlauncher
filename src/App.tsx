import { FormEvent, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { launchToken, launchTokenWithPayer } from './solana';

type LaunchResult = {
  mintAddress: string;
  ownerTokenAccount: string;
  signature: string;
  notes: string[];
};

const tutorialSteps = [
  'Connect Phantom and fund it. For testing, use devnet SOL from a faucet. For a real mainnet launch, you must hold real SOL.',
  'Fill in token name, symbol, decimals, supply, and the recipient wallet that should receive the initial minted supply.',
  'Choose whether to revoke freeze or mint authority. Revoke mint if you want a fixed supply. Revoke freeze if you do not want any wallet to freeze token accounts later.',
  'Press Launch Token and approve the transaction in Phantom. The app creates the mint, creates the recipient token account, and mints the supply in one flow.',
  'Copy the mint address after launch. If you want Dexscreener visibility later, create a supported liquidity pool on Solana mainnet and seed it with liquidity.',
];

function OptionRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span className="toggle-control">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch" />
      </span>
      <span className="toggle-text">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="toggle-cost">Included</span>
    </label>
  );
}

function App() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const [tokenName, setTokenName] = useState('Ragnar Token');
  const [tokenSymbol, setTokenSymbol] = useState('RAGN');
  const [description, setDescription] = useState('Battle-forged community token.');
  const [decimals, setDecimals] = useState(9);
  const [initialSupply, setInitialSupply] = useState('1000000');
  const [recipient, setRecipient] = useState('');

  const [creatorInfo, setCreatorInfo] = useState(false);
  const [socialLinks, setSocialLinks] = useState(false);
  const [liquidityPool, setLiquidityPool] = useState(false);

  const [revokeFreeze, setRevokeFreeze] = useState(true);
  const [revokeMint, setRevokeMint] = useState(false);
  const [revokeUpdate, setRevokeUpdate] = useState(false);

  const [telegram, setTelegram] = useState('');
  const [website, setWebsite] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [useFreeDevnetMode, setUseFreeDevnetMode] = useState(true);
  const [burnerWallet] = useState(() => Keypair.generate());
  const [status, setStatus] = useState('Ready to launch. Free Devnet Mode is enabled by default.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);

  const launchMode = useMemo(
    () => ({
      network: 'Devnet',
      platformFee: 0,
    }),
    [],
  );

  const shortBurner = `${burnerWallet.publicKey.toBase58().slice(0, 6)}...${burnerWallet.publicKey.toBase58().slice(-6)}`;

  const ensureFreeModeBalance = async () => {
    const minimumLamports = Math.floor(0.03 * LAMPORTS_PER_SOL);
    const currentBalance = await connection.getBalance(burnerWallet.publicKey, 'confirmed');

    if (currentBalance >= minimumLamports) {
      return;
    }

    const airdropSignature = await connection.requestAirdrop(burnerWallet.publicKey, LAMPORTS_PER_SOL);
    const latest = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction(
      {
        signature: airdropSignature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      'confirmed',
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);

    try {
      setLoading(true);

      let launchResult: LaunchResult;
      const targetRecipient = recipient.trim() || burnerWallet.publicKey.toBase58();

      if (useFreeDevnetMode) {
        setStatus('Free mode: requesting devnet airdrop for temporary wallet...');
        await ensureFreeModeBalance();

        setStatus('Free mode: creating mint and sending transaction...');
        launchResult = await launchTokenWithPayer({
          connection,
          payer: burnerWallet,
          tokenName,
          tokenSymbol,
          decimals,
          initialSupply,
          recipient: targetRecipient,
          revokeMint,
          revokeFreeze,
          revokeUpdate,
        });
      } else {
        if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
          setStatus('Connect a wallet that supports transaction signing, or enable Free Devnet Mode.');
          return;
        }

        if (!recipient.trim()) {
          setStatus('Recipient address is required when Free Devnet Mode is off.');
          return;
        }

        setStatus('Creating mint and sending transaction...');
        launchResult = await launchToken({
          connection,
          wallet: {
            publicKey: wallet.publicKey,
            signTransaction: wallet.signTransaction,
          },
          tokenName,
          tokenSymbol,
          decimals,
          initialSupply,
          recipient,
          revokeMint,
          revokeFreeze,
          revokeUpdate,
        });
      }

      setResult(launchResult);
      setStatus('Token launched successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to launch token.';
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <div className="ambient ambient-top" />
      <div className="ambient ambient-bottom" />

      <header className="hero">
        <div className="brand">
          <img src="/ragnar.svg" alt="Ragnar" className="logo" />
          <div>
            <p className="eyebrow">Ragnar Launchpad</p>
            <h1>Solana Token Launcher</h1>
            <p>Client-side token creator with advanced authority controls, zero platform fee, and a built-in launch tutorial.</p>
          </div>
        </div>
        <WalletMultiButton className="wallet-btn" />
      </header>

      <section className="free-mode-bar">
        <label className="free-mode-toggle">
          <input type="checkbox" checked={useFreeDevnetMode} onChange={(e) => setUseFreeDevnetMode(e.target.checked)} />
          <span>Free Devnet Mode</span>
        </label>
        <p>
          Temporary wallet: <strong>{shortBurner}</strong>. No buy flow needed.
        </p>
      </section>

      <section className="info-strip">
        <article className="info-card emphasis">
          <strong>Free to use app</strong>
          <p>No launcher fee is charged by this site. You still pay Solana network fees and mint rent.</p>
        </article>
        <article className="info-card">
          <strong>Current network</strong>
          <p>{launchMode.network}. Good for testing. Devnet tokens do not show on Dexscreener.</p>
        </article>
        <article className="info-card">
          <strong>Dexscreener rule</strong>
          <p>A token appears there only after a supported mainnet liquidity pool exists and gets indexed.</p>
        </article>
      </section>

      <form className="launcher-card" onSubmit={handleSubmit}>
        <section className="grid-two">
          <label>
            <span>Token Name *</span>
            <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} required />
          </label>
          <label>
            <span>Symbol *</span>
            <input maxLength={10} value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())} required />
          </label>
          <label className="full-width">
            <span>Description</span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            <span>Decimals</span>
            <input
              type="number"
              min={0}
              max={9}
              value={decimals}
              onChange={(e) => setDecimals(Number(e.target.value))}
            />
          </label>
          <label>
            <span>Initial Supply</span>
            <input value={initialSupply} onChange={(e) => setInitialSupply(e.target.value)} />
          </label>
        </section>

        <section className="option-stack">
          <OptionRow
            label="Creator's Info (Optional)"
            description="Adds optional creator details to off-chain launch summary."
            checked={creatorInfo}
            onChange={setCreatorInfo}
          />
          <OptionRow
            label="Add Social Links & Tags"
            description="Attach website and social links for publish checklist."
            checked={socialLinks}
            onChange={setSocialLinks}
          />
          <OptionRow
            label="Luna Liquidity Pool"
            description="Reserves launch section for future DEX integration."
            checked={liquidityPool}
            onChange={setLiquidityPool}
          />
        </section>

        {socialLinks && (
          <section className="grid-three">
            <label>
              <span>Website</span>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </label>
            <label>
              <span>X / Twitter</span>
              <input value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="https://x.com/" />
            </label>
            <label>
              <span>Telegram</span>
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/" />
            </label>
          </section>
        )}

        <section className="authority-block">
          <h2>Revoke Authorities (Investor Boost)</h2>
          <div className="authority-grid">
            <label className={`authority-card ${revokeFreeze ? 'active' : ''}`}>
              <input type="checkbox" checked={revokeFreeze} onChange={(e) => setRevokeFreeze(e.target.checked)} />
              <strong>Revoke Freeze</strong>
              <p>No one will be able to freeze holder token accounts anymore.</p>
              <span>Included</span>
            </label>
            <label className={`authority-card ${revokeMint ? 'active' : ''}`}>
              <input type="checkbox" checked={revokeMint} onChange={(e) => setRevokeMint(e.target.checked)} />
              <strong>Revoke Mint</strong>
              <p>No one will be able to create more tokens anymore.</p>
              <span>Included</span>
            </label>
            <label className={`authority-card ${revokeUpdate ? 'active' : ''}`}>
              <input type="checkbox" checked={revokeUpdate} onChange={(e) => setRevokeUpdate(e.target.checked)} />
              <strong>Revoke Update</strong>
              <p>Metadata update authority revoke is shown as a checklist item.</p>
              <span>Checklist only</span>
            </label>
          </div>
          <small>
            SPL tokens support Mint and Freeze authority natively. Metadata update authority needs Metaplex metadata instructions.
          </small>
        </section>

        <section>
          <label className="full-width">
            <span>Enter token recipient *</span>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={useFreeDevnetMode ? `Optional in free mode. Leave blank to use ${shortBurner}` : 'Enter address who will be the receiver of the token'}
              required={!useFreeDevnetMode}
            />
          </label>
        </section>

        <section className="launch-action">
          <button type="submit" disabled={loading}>
            {loading ? 'Launching...' : 'Launch Token'}
          </button>
          <p>
            Platform Fee: <strong>{launchMode.platformFee.toFixed(1)} SOL</strong>
          </p>
          <p className="sub-fee">Network cost and rent still apply on Solana. Mainnet is never fully free.</p>
          <small>{status}</small>
        </section>
      </form>

      <section className="tutorial-card">
        <div className="tutorial-header">
          <div>
            <p className="eyebrow">Tutorial</p>
            <h2>How to launch a token with this site</h2>
          </div>
          <span className="tutorial-badge">5 steps</span>
        </div>
        <div className="tutorial-list">
          {tutorialSteps.map((step, index) => (
            <article key={step} className="tutorial-step">
              <span>{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
        <div className="faq-grid">
          <article className="faq-card">
            <strong>Can I make a token for free?</strong>
            <p>You can use this website without a launcher fee, but Solana still charges network fees and rent for the mint account. Devnet is the free test environment.</p>
          </article>
          <article className="faq-card">
            <strong>Will it show on Dexscreener?</strong>
            <p>Not just from minting. Dexscreener usually needs a supported mainnet liquidity pool and trading activity before the token is indexed.</p>
          </article>
          <article className="faq-card">
            <strong>Why not on devnet?</strong>
            <p>Dexscreener tracks supported trading venues on mainnet. Devnet tokens are test assets and are not treated like live market listings.</p>
          </article>
        </div>
      </section>

      {result && (
        <section className="result-card">
          <h3>Launch Complete</h3>
          <p>Mint: {result.mintAddress}</p>
          <p>Recipient ATA: {result.ownerTokenAccount}</p>
          <p>
            Tx: <a href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`} target="_blank" rel="noreferrer">{result.signature}</a>
          </p>
          {result.notes.map((note) => (
            <p key={note} className="note">{note}</p>
          ))}
          {(creatorInfo || socialLinks || liquidityPool) && (
            <div className="publish-summary">
              <h4>Launch Summary</h4>
              <p>Name: {tokenName}</p>
              <p>Symbol: {tokenSymbol}</p>
              <p>Description: {description}</p>
              {socialLinks && (
                <>
                  <p>Website: {website || '-'}</p>
                  <p>X: {xUrl || '-'}</p>
                  <p>Telegram: {telegram || '-'}</p>
                </>
              )}
              {liquidityPool && <p>Liquidity pool step reserved for DEX integration.</p>}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
