import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  type ParsedTransactionWithMeta,
  type PublicKey,
} from "@solana/web3.js";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type HistoryStatus = "idle" | "loading" | "ready" | "error";

type TransactionItem = {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: string;
  err: string | null;
  feeSol: string;
  balanceDeltaSol: string;
  instructionSummary: string;
};

export function TransactionHistoryApp() {
  const { connection } = useConnection();
  const { connected, publicKey, wallet } = useWallet();
  const [status, setStatus] = useState<HistoryStatus>("idle");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const address = publicKey?.toBase58() ?? "";
  const explorerAddressUrl = address
    ? `https://explorer.solana.com/address/${address}`
    : "";

  const fetchTransactions = useCallback(
    async (key: PublicKey) => {
      setStatus("loading");
      setErrorMessage("");

      try {
        const signatures = await connection.getSignaturesForAddress(key, {
          limit: 20,
        });

        if (signatures.length === 0) {
          setTransactions([]);
          setStatus("ready");
          return;
        }

        const parsedTransactions = await connection.getParsedTransactions(
          signatures.map((entry) => entry.signature),
          { maxSupportedTransactionVersion: 0 }
        );

        setTransactions(
          signatures.map((signatureInfo, index) =>
            toTransactionItem(signatureInfo, parsedTransactions[index], key)
          )
        );
        setStatus("ready");
      } catch (error) {
        setTransactions([]);
        setStatus("error");
        setErrorMessage(toReadableError(error));
      }
    },
    [connection]
  );

  useEffect(() => {
    if (!publicKey) {
      setStatus("idle");
      setTransactions([]);
      setErrorMessage("");
      return;
    }

    void fetchTransactions(publicKey);
  }, [fetchTransactions, publicKey]);

  const copyAddress = async () => {
    if (!address) return;

    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (!connected || !publicKey) {
    return <ConnectWaitingScreen />;
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Mainnet beta</p>
          <h1>Transaction History</h1>
          <p className="lead">
            The connected wallet's latest 20 confirmed signatures are loaded
            from Solana RPC and expanded into readable transaction details.
          </p>
        </div>
        <WalletMultiButton />
      </header>

      <section className="stats" aria-label="Wallet status">
        <InfoPanel
          icon={<Wallet size={21} />}
          label="Wallet"
          value={wallet?.adapter.name ?? "Connected"}
          detail="Active wallet adapter"
        />
        <InfoPanel
          icon={<History size={21} />}
          label="Transactions"
          value={status === "loading" ? "Loading" : String(transactions.length)}
          detail="Most recent signatures"
        />
        <InfoPanel
          icon={<ShieldCheck size={21} />}
          label="Cluster"
          value="Mainnet"
          detail="Solana public RPC endpoint"
        />
      </section>

      <section className="address-panel">
        <div>
          <p className="eyebrow gold">Public key</p>
          <code>{address}</code>
        </div>
        <div className="toolbar">
          <IconButton
            label={copied ? "Copied" : "Copy address"}
            onClick={copyAddress}
          >
            {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
          </IconButton>
          <IconLink href={explorerAddressUrl} label="Open wallet in explorer">
            <ExternalLink size={18} />
          </IconLink>
          <IconButton
            label="Refresh transactions"
            onClick={() => void fetchTransactions(publicKey)}
            disabled={status === "loading"}
          >
            <RefreshCw
              size={18}
              className={status === "loading" ? "spin" : ""}
            />
          </IconButton>
        </div>
      </section>

      <TransactionList
        status={status}
        transactions={transactions}
        errorMessage={errorMessage}
      />
    </main>
  );
}

function ConnectWaitingScreen() {
  return (
    <main className="connect-page">
      <section className="connect-shell">
        <div className="connect-header">
          <div>
            <p className="eyebrow">Solana wallet required</p>
            <h1>Transaction History</h1>
          </div>
          <WalletMultiButton />
        </div>

        <div className="connect-grid">
          <div className="feature-panel">
            <div className="icon-box">
              <Search size={24} />
            </div>
            <h2>Connect your wallet to load activity.</h2>
            <p>
              After connection, this app switches to the history view and
              displays recent Solana transactions for the selected public key.
            </p>
          </div>

          <div className="wallet-panel">
            <p className="eyebrow gold">Supported wallets</p>
            <div className="wallet-list">
              <WalletRow name="Phantom" />
              <WalletRow name="Solflare" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function TransactionList({
  status,
  transactions,
  errorMessage,
}: {
  status: HistoryStatus;
  transactions: TransactionItem[];
  errorMessage: string;
}) {
  const content = useMemo(() => {
    if (status === "loading") {
      return (
        <StateMessage
          icon={<Loader2 className="spin" size={22} />}
          title="Loading transaction history"
          detail="Fetching signatures and parsed transaction data from Solana RPC."
        />
      );
    }

    if (status === "error") {
      return (
        <StateMessage
          icon={<AlertCircle size={22} />}
          title="History could not be loaded"
          detail={errorMessage || "Try refreshing the request in a moment."}
        />
      );
    }

    if (transactions.length === 0) {
      return (
        <StateMessage
          icon={<History size={22} />}
          title="No recent transactions"
          detail="This wallet does not have recent transaction signatures on mainnet."
        />
      );
    }

    return (
      <div className="transaction-list">
        {transactions.map((transaction) => (
          <TransactionRow key={transaction.signature} transaction={transaction} />
        ))}
      </div>
    );
  }, [errorMessage, status, transactions]);

  return (
    <section className="activity">
      <div className="section-heading">
        <h2>Recent activity</h2>
        <span>{transactions.length} items</span>
      </div>
      {content}
    </section>
  );
}

function TransactionRow({ transaction }: { transaction: TransactionItem }) {
  const explorerUrl = `https://explorer.solana.com/tx/${transaction.signature}`;

  return (
    <article className="transaction-row">
      <div className="transaction-main">
        <div className="badges">
          <span className={transaction.err ? "badge failed" : "badge success"}>
            {transaction.err ? "Failed" : "Success"}
          </span>
          <span className="badge confirmed">
            {transaction.confirmationStatus}
          </span>
          <time>{formatBlockTime(transaction.blockTime)}</time>
        </div>
        <code>{transaction.signature}</code>
        <p>{transaction.instructionSummary}</p>
      </div>

      <div className="transaction-metrics">
        <Metric label="SOL delta" value={transaction.balanceDeltaSol} />
        <Metric label="Fee" value={transaction.feeSol} />
        <Metric label="Slot" value={transaction.slot.toLocaleString()} />
        <a href={explorerUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} />
          Explorer
        </a>
      </div>
    </article>
  );
}

function InfoPanel({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="info-panel">
      <div className="icon-box">{icon}</div>
      <p className="eyebrow gold">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StateMessage({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="state-message">
      <div>
        <div className="icon-box">{icon}</div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function WalletRow({ name }: { name: string }) {
  return (
    <div className="wallet-row">
      <CheckCircle2 size={18} />
      <span>{name}</span>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="icon-button"
    >
      {children}
    </button>
  );
}

function IconLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      aria-label={label}
      className="icon-button gold-button"
    >
      {children}
    </a>
  );
}

function toTransactionItem(
  signatureInfo: {
    signature: string;
    slot: number;
    blockTime?: number | null;
    confirmationStatus?: string | null;
    err: unknown;
  },
  parsedTransaction: ParsedTransactionWithMeta | null,
  owner: PublicKey
): TransactionItem {
  return {
    signature: signatureInfo.signature,
    slot: signatureInfo.slot,
    blockTime: signatureInfo.blockTime ?? null,
    confirmationStatus: signatureInfo.confirmationStatus ?? "confirmed",
    err: signatureInfo.err ? "Transaction failed" : null,
    feeSol: parsedTransaction?.meta ? formatSol(-parsedTransaction.meta.fee) : "-",
    balanceDeltaSol: parsedTransaction?.meta
      ? calculateBalanceDelta(parsedTransaction, owner)
      : "-",
    instructionSummary: summarizeInstructions(parsedTransaction),
  };
}

function calculateBalanceDelta(
  transaction: ParsedTransactionWithMeta,
  owner: PublicKey
) {
  const accountIndex = transaction.transaction.message.accountKeys.findIndex(
    (account) => account.pubkey.equals(owner)
  );

  if (accountIndex < 0 || !transaction.meta) return "-";

  const preBalance = transaction.meta.preBalances[accountIndex] ?? 0;
  const postBalance = transaction.meta.postBalances[accountIndex] ?? 0;
  return formatSol(postBalance - preBalance);
}

function summarizeInstructions(transaction: ParsedTransactionWithMeta | null) {
  if (!transaction) return "Parsed transaction details are unavailable.";

  const programs = transaction.transaction.message.instructions.map(
    (instruction) => instruction.programId.toBase58()
  );
  const uniquePrograms = Array.from(new Set(programs)).slice(0, 3);

  if (uniquePrograms.length === 0) return "No parsed instructions.";
  return `Programs touched: ${uniquePrograms.join(", ")}`;
}

function toReadableError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Transaction history could not be loaded.";

  if (message.includes("403") || message.toLowerCase().includes("forbidden")) {
    return "The configured Solana RPC endpoint rejected this request. Set VITE_SOLANA_RPC_URL to a dedicated RPC provider if public RPC limits are blocking history reads.";
  }

  return message;
}

function formatSol(lamports: number) {
  const value = lamports / LAMPORTS_PER_SOL;
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} SOL`;
}

function formatBlockTime(blockTime: number | null) {
  if (!blockTime) return "Time unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(blockTime * 1000));
}
