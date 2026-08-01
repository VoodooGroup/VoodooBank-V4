import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ethers } from 'ethers';
import {
  PULSECHAIN_CHAIN_ID,
  PULSECHAIN_NETWORK,
} from '../Contract_Files/constants';
import { createWriteBank } from '../Interaction/bank';
import { shortenAddress } from '../helpers/formatters';

const WalletContext = createContext(null);

const VOODOO_RDNS = 'app.voodoowallet';
const VOODOO_INSTALL_URL = 'https://github.com/Voodoo-Token/voodoo-pulse-extension';

function isVoodooProvider(provider) {
  if (!provider) return false;
  if (provider.isVoodooWallet === true || provider._isVoodooWallet === true) return true;
  if (provider === window.voodooEthereum || provider === window.VoodooWalletProvider) return true;
  if (
    typeof provider.providerInfo?.rdns === 'string'
    && provider.providerInfo.rdns.toLowerCase() === VOODOO_RDNS
  ) {
    return true;
  }
  return false;
}

function listInjected() {
  if (typeof window === 'undefined') return [];
  const out = [];
  const push = (p) => {
    if (p && !out.includes(p)) out.push(p);
  };
  push(window.voodooEthereum);
  push(window.VoodooWalletProvider);
  const eth = window.ethereum;
  if (eth) {
    if (Array.isArray(eth.providers)) eth.providers.forEach(push);
    push(eth);
  }
  return out;
}

function findVoodooSync() {
  if (typeof window === 'undefined') return null;
  if (window.voodooEthereum && isVoodooProvider(window.voodooEthereum)) return window.voodooEthereum;
  if (window.VoodooWalletProvider && isVoodooProvider(window.VoodooWalletProvider)) {
    return window.VoodooWalletProvider;
  }
  return listInjected().find(isVoodooProvider) || null;
}

function discoverVoodooEip6963(timeoutMs = 1200) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const sync = findVoodooSync();
    if (sync) {
      resolve(sync);
      return;
    }

    let settled = false;
    const finish = (p) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      resolve(p || null);
    };
    function onAnnounce(event) {
      const detail = event?.detail;
      const info = detail?.info;
      const provider = detail?.provider;
      if (!provider) return;
      const rdns = String(info?.rdns || '').toLowerCase();
      const name = String(info?.name || '');
      if (rdns === VOODOO_RDNS || /voodoo\s*wallet/i.test(name) || isVoodooProvider(provider)) {
        finish(provider);
      }
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    try {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    } catch {
      /* ignore */
    }
    setTimeout(() => finish(findVoodooSync()), timeoutMs);
  });
}

async function ensurePulseChain(ethereum) {
  const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
  if (chainIdHex === PULSECHAIN_CHAIN_ID) return;
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: PULSECHAIN_CHAIN_ID }],
    });
  } catch (switchErr) {
    if (switchErr?.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [PULSECHAIN_NETWORK],
      });
    } else {
      throw switchErr;
    }
  }
}

/**
 * One eth_requestAccounts per button click only — no focus/blur auto-retry
 * (that re-opened the extension "randomly" after the user clicked away).
 *
 * isCurrent: if user clicks the button again, the old waiter is ignored.
 * Soft timeout only ends OUR wait (does not spawn new popups).
 */
function requestVoodooAccounts(ethereum, { isCurrent, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (ok, val) => {
      if (settled) return;
      // Newer button click superseded this attempt — stop waiting (no new popup here)
      if (typeof isCurrent === 'function' && !isCurrent()) {
        settled = true;
        clearTimeout(hardTimer);
        return;
      }
      settled = true;
      clearTimeout(hardTimer);
      if (ok) resolve(val);
      else reject(val);
    };

    const hardTimer = setTimeout(() => {
      // End our wait only — does not open the wallet again
      const err = new Error('Voodoo Wallet did not respond. Click Voodoo Wallet again.');
      err.code = 'VOODOO_TIMEOUT';
      finish(false, err);
    }, timeoutMs);

    // Opens extension once — only called from connectVoodoo (button click)
    ethereum
      .request({ method: 'eth_requestAccounts' })
      .then((accs) => finish(true, accs || []))
      .catch((err) => finish(false, err));
  });
}

async function waitForRainbowReady(maxMs = 15000) {
  if (typeof window === 'undefined') return null;
  if (window.VoodooRainbow?.ready && window.VoodooRainbow.openConnectModal) {
    return window.VoodooRainbow;
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.VoodooRainbow?.ready && window.VoodooRainbow.openConnectModal) {
        cleanup();
        resolve(window.VoodooRainbow);
      } else if (Date.now() - started >= maxMs) {
        cleanup();
        reject(new Error('RainbowKit is still loading. Wait a moment and try Other again.'));
      }
    }, 100);
    function onReady() {
      if (window.VoodooRainbow?.ready) {
        cleanup();
        resolve(window.VoodooRainbow);
      }
    }
    function cleanup() {
      clearInterval(timer);
      window.removeEventListener('voodoo:rainbow-ready', onReady);
    }
    window.addEventListener('voodoo:rainbow-ready', onReady);
  });
}

export function WalletProvider({ children, onConnected }) {
  const [userAddress, setUserAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [bankContract, setBankContract] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [walletKind, setWalletKind] = useState(null); // 'voodoo' | 'rainbow'
  const activeEth = useRef(null);
  const voodooClickGen = useRef(0);
  /** Always-current wallet kind for event handlers (avoids stale closures). */
  const walletKindRef = useRef(null);
  /**
   * True only while the user explicitly clicked Other and we wait for RainbowKit.
   * Prevents RK from stealing a Voodoo extension session (address on Other + flash disconnect).
   */
  const otherConnectPendingRef = useRef(false);
  /** Intentional Voodoo session — ignore all RainbowKit connect/disconnect noise. */
  const voodooSessionRef = useRef(false);

  useEffect(() => {
    walletKindRef.current = walletKind;
  }, [walletKind]);

  /** Stops rainbow-bridge zombie kill (~2.5s) from wiping a live Voodoo session */
  const publishVoodooWalletApi = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!window.VoodooWallet || typeof window.VoodooWallet !== 'object') {
      window.VoodooWallet = {};
    }
    window.VoodooWallet.getActiveProvider = () => {
      if (activeEth.current) return activeEth.current;
      if (voodooSessionRef.current) return findVoodooSync();
      return null;
    };
    window.VoodooWallet.getActiveWalletKind = () => walletKindRef.current;
  }, []);

  useEffect(() => {
    publishVoodooWalletApi();
  }, [publishVoodooWalletApi]);

  const applyConnection = useCallback(async (ethereum, kind, setError, opts = {}) => {
    if (!ethereum) return false;
    const { isCurrent } = opts;

    // Never let a stray RainbowKit event overwrite an active Voodoo session
    if (
      kind === 'rainbow'
      && (voodooSessionRef.current || walletKindRef.current === 'voodoo')
      && !otherConnectPendingRef.current
    ) {
      console.info('[Wallet] ignore rainbow apply — Voodoo session owns the wallet');
      return false;
    }

    let accounts = [];
    try {
      if (kind === 'voodoo') {
        // Detect "closed without cancel" so a later click can open again
        accounts = await requestVoodooAccounts(ethereum, {
          isCurrent,
          timeoutMs: 90_000,
        });
      } else {
        try {
          accounts = await ethereum.request({ method: 'eth_accounts' });
        } catch {
          accounts = [];
        }
        if (!accounts?.length) {
          accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        }
      }
    } catch (err) {
      // User closed / rejected / dismissed popup — silent
      if (
        err?.code === 4001
        || err?.code === 'VOODOO_TIMEOUT'
        || /reject|denied|cancel|dismiss/i.test(err?.message || '')
      ) {
        console.info('[Wallet] user cancelled or dismissed connect');
        return false;
      }
      throw err;
    }

    if (!accounts?.length) {
      setError?.('No account returned. Unlock the wallet and try again.');
      return false;
    }

    if (typeof isCurrent === 'function' && !isCurrent()) return false;

    // Re-check after async gap (RK may have raced while popup was open)
    if (
      kind === 'rainbow'
      && (voodooSessionRef.current || walletKindRef.current === 'voodoo')
      && !otherConnectPendingRef.current
    ) {
      console.info('[Wallet] ignore rainbow apply after accounts — Voodoo owns session');
      return false;
    }

    try {
      await ensurePulseChain(ethereum);
    } catch (e) {
      console.warn('PulseChain switch best-effort', e);
    }

    if (typeof isCurrent === 'function' && !isCurrent()) return false;

    const browserProvider = new ethers.BrowserProvider(ethereum);
    const walletSigner = await browserProvider.getSigner();
    const address = accounts[0];

    activeEth.current = ethereum;
    if (kind === 'voodoo') {
      voodooSessionRef.current = true;
      otherConnectPendingRef.current = false;
    } else {
      voodooSessionRef.current = false;
      otherConnectPendingRef.current = false;
    }
    walletKindRef.current = kind;
    setUserAddress(address);
    setSigner(walletSigner);
    setBankContract(createWriteBank(walletSigner));
    setWalletKind(kind);
    publishVoodooWalletApi();
    setError?.('', 'success');
    onConnected?.();
    return true;
  }, [onConnected, publishVoodooWalletApi]);

  const disconnect = useCallback((opts = {}) => {
    // RainbowKit disconnect events must never wipe a Voodoo extension session
    if (opts.fromRainbow && (voodooSessionRef.current || walletKindRef.current === 'voodoo')) {
      console.info('[Wallet] ignore rainbow disconnect — Voodoo session active');
      return;
    }

    const wasRainbow = walletKindRef.current === 'rainbow';
    activeEth.current = null;
    voodooSessionRef.current = false;
    otherConnectPendingRef.current = false;
    walletKindRef.current = null;
    setUserAddress(null);
    setSigner(null);
    setBankContract(null);
    setWalletKind(null);
    publishVoodooWalletApi();

    // Only hard-reset RainbowKit when we were on the Other path
    if (wasRainbow || opts.fromRainbow) {
      try {
        window.VoodooRainbow?.hardReset?.();
      } catch {
        /* ignore */
      }
    }
  }, [publishVoodooWalletApi]);

  /** Standalone Voodoo Wallet button — opens the browser extension ONLY on this click */
  const connectVoodoo = useCallback(async (setError) => {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol === 'file:') {
      setError?.('Open via http://localhost (not a saved file). Extensions need http/https.');
      return false;
    }

    // Cancel any pending Other flow so RK events cannot claim this session
    otherConnectPendingRef.current = false;

    // Every button click = new attempt (supersedes previous hung waiter)
    const gen = ++voodooClickGen.current;
    const isCurrent = () => gen === voodooClickGen.current;
    setConnecting(true);
    // Always free the UI after a few seconds even if extension request hangs
    // (click-away without Reject leaves eth_requestAccounts pending)
    const unlockUi = setTimeout(() => {
      if (isCurrent()) setConnecting(false);
    }, 2500);

    try {
      const ethereum = findVoodooSync() || (await discoverVoodooEip6963(1500));
      if (!ethereum) {
        setError?.(
          'Voodoo Wallet was not detected. Install the extension, open it and sign in, then refresh this page and try again.',
        );
        return false;
      }
      if (!isCurrent()) return false;

      // One eth_requestAccounts per this click only
      return await applyConnection(ethereum, 'voodoo', setError, { isCurrent });
    } catch (err) {
      if (!isCurrent()) return false;
      if (err?.code === 4001 || /dismiss|reject|denied|cancel/i.test(err?.message || '')) {
        return false;
      }
      console.error('Voodoo connect failed:', err);
      setError?.(err?.message || 'Voodoo Wallet connection failed');
      return false;
    } finally {
      clearTimeout(unlockUi);
      if (isCurrent()) setConnecting(false);
    }
  }, [applyConnection]);

  /**
   * Other button — opens RainbowKit (same bridge as StakingPlatform-V4).
   * WalletConnect QR + MetaMask/Rabby/… live inside that modal.
   */
  const connectOther = useCallback(async (setError) => {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol === 'file:') {
      setError?.('Open via http://localhost (not a saved file).');
      return false;
    }

    // Leaving Voodoo path if user deliberately picks Other
    voodooSessionRef.current = false;
    otherConnectPendingRef.current = true;
    setConnecting(true);
    try {
      const rk = await waitForRainbowReady();
      if (!rk?.openConnectModal) {
        otherConnectPendingRef.current = false;
        setError?.('RainbowKit not ready. Wait 2 seconds and click Other again.');
        return false;
      }

      // Open modal (force connect list)
      const opened = await rk.openConnectModal({ mode: 'connect', forceConnect: true });
      if (opened === false) {
        otherConnectPendingRef.current = false;
        setError?.('Could not open wallet list. Refresh and try again.');
        return false;
      }

      // Wait for bridge connection event (user picks wallet in RainbowKit)
      return await new Promise((resolve) => {
        let settled = false;
        const timeout = setTimeout(() => {
          cleanup();
          // User may have closed modal — not a hard error
          resolve(false);
        }, 180_000);

        async function onConnected(event) {
          if (settled) return;
          if (!otherConnectPendingRef.current) return;
          const detail = event?.detail || {};
          const provider = detail.provider;
          if (!provider) return;
          cleanup();
          settled = true;
          try {
            const ok = await applyConnection(provider, 'rainbow', setError);
            resolve(ok);
          } catch (err) {
            console.error(err);
            setError?.(err?.message || 'Connection failed');
            resolve(false);
          }
        }

        function onDisconnected() {
          /* modal closed without connect — keep waiting until timeout */
        }

        function cleanup() {
          settled = true;
          clearTimeout(timeout);
          otherConnectPendingRef.current = false;
          window.removeEventListener('voodoo:rainbow-connected', onConnected);
          window.removeEventListener('voodoo:rainbow-disconnected', onDisconnected);
        }

        window.addEventListener('voodoo:rainbow-connected', onConnected);
        window.addEventListener('voodoo:rainbow-disconnected', onDisconnected);
      });
    } catch (err) {
      otherConnectPendingRef.current = false;
      console.error('Other/RainbowKit connect failed:', err);
      setError?.(err?.message || 'Could not open wallets');
      return false;
    } finally {
      setConnecting(false);
    }
  }, [applyConnection]);

  // RainbowKit events — only apply when user chose Other (never steal Voodoo)
  useEffect(() => {
    function onConnected(event) {
      const provider = event?.detail?.provider;
      if (!provider) return;

      // Opportunistic RK auto-connect after Voodoo eth_requestAccounts — ignore
      if (voodooSessionRef.current || walletKindRef.current === 'voodoo') {
        console.info('[Wallet] ignore voodoo:rainbow-connected during Voodoo session');
        return;
      }
      if (!otherConnectPendingRef.current && walletKindRef.current !== 'rainbow') {
        console.info('[Wallet] ignore unsolicited rainbow-connected');
        return;
      }

      applyConnection(provider, 'rainbow').catch((e) => console.warn(e));
    }
    function onDisconnected() {
      if (voodooSessionRef.current || walletKindRef.current === 'voodoo') {
        console.info('[Wallet] ignore voodoo:rainbow-disconnected during Voodoo session');
        return;
      }
      if (walletKindRef.current === 'rainbow') {
        disconnect({ fromRainbow: true });
      }
    }
    window.addEventListener('voodoo:rainbow-connected', onConnected);
    window.addEventListener('voodoo:rainbow-disconnected', onDisconnected);
    return () => {
      window.removeEventListener('voodoo:rainbow-connected', onConnected);
      window.removeEventListener('voodoo:rainbow-disconnected', onDisconnected);
    };
  }, [applyConnection, disconnect]);

  // Account / chain listeners
  useEffect(() => {
    const eth = activeEth.current;
    if (!eth?.on) return undefined;
    const onAccounts = (accounts) => {
      if (activeEth.current !== eth) return;
      if (!accounts?.length) {
        // Extension revoked accounts — clear without Rainbow hardReset for Voodoo
        if (walletKindRef.current === 'voodoo' || voodooSessionRef.current) {
          activeEth.current = null;
          voodooSessionRef.current = false;
          walletKindRef.current = null;
          setUserAddress(null);
          setSigner(null);
          setBankContract(null);
          setWalletKind(null);
          return;
        }
        disconnect();
        return;
      }
      setUserAddress(accounts[0]);
    };
    const onChain = () => {
      window.location.reload();
    };
    try {
      eth.on('accountsChanged', onAccounts);
      eth.on('chainChanged', onChain);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        eth.removeListener?.('accountsChanged', onAccounts);
        eth.removeListener?.('chainChanged', onChain);
      } catch {
        /* ignore */
      }
    };
  }, [userAddress, disconnect]);

  const value = useMemo(
    () => ({
      userAddress,
      signer,
      bankContract,
      connecting,
      walletKind,
      connectVoodoo,
      connectOther,
      disconnect,
      voodooLabel:
        userAddress && walletKind === 'voodoo' ? shortenAddress(userAddress) : 'Voodoo Wallet',
      otherLabel:
        userAddress && walletKind === 'rainbow' ? shortenAddress(userAddress) : 'Other',
      isConnected: Boolean(userAddress && signer),
      VOODOO_INSTALL_URL,
    }),
    [
      userAddress,
      signer,
      bankContract,
      connecting,
      walletKind,
      connectVoodoo,
      connectOther,
      disconnect,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
