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
 * eth_requestAccounts that does NOT hang forever when the user just closes
 * the extension window (no official "Reject").
 *
 * Detects dismiss: page blurs (popup open) → focus returns → still no accounts
 * → treat as cancelled so the next button click can open again.
 */
function requestVoodooAccounts(ethereum, { isCurrent, timeoutMs = 90_000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sawBlur = false;
    const started = Date.now();
    let focusedSince = null;

    const finish = (ok, val) => {
      if (settled) return;
      // Superseded by a newer button click — ignore, free this waiter
      if (typeof isCurrent === 'function' && !isCurrent()) {
        settled = true;
        cleanup();
        return;
      }
      settled = true;
      cleanup();
      if (ok) resolve(val);
      else reject(val);
    };

    const dismissedErr = () => {
      const err = new Error('dismissed');
      err.code = 4001;
      return err;
    };

    const cleanup = () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(hardTimer);
      clearInterval(pollTimer);
    };

    const onBlur = () => {
      sawBlur = true;
      focusedSince = null;
    };

    const tryDismissIfClosed = async () => {
      if (settled) return;
      if (typeof isCurrent === 'function' && !isCurrent()) {
        settled = true;
        cleanup();
        return;
      }
      if (Date.now() - started < 700) return;
      try {
        const accs = await ethereum.request({ method: 'eth_accounts' });
        if (Array.isArray(accs) && accs.length) {
          finish(true, accs);
          return;
        }
        // Focus back, no accounts → user closed extension without reject
        if (sawBlur) finish(false, dismissedErr());
      } catch {
        if (sawBlur) finish(false, dismissedErr());
      }
    };

    const onFocus = () => {
      setTimeout(tryDismissIfClosed, 400);
    };

    const onVis = () => {
      if (document.visibilityState === 'visible') onFocus();
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    // Poll: extension may not always fire blur; if page focused long enough after start with no accounts, dismiss
    const pollTimer = setInterval(async () => {
      if (settled) return;
      if (typeof isCurrent === 'function' && !isCurrent()) {
        settled = true;
        cleanup();
        return;
      }
      const pageFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
      if (pageFocused && document.visibilityState === 'visible') {
        if (focusedSince == null) focusedSince = Date.now();
        // After popup closed, page is focused again for ~0.9s with still no accounts
        if (Date.now() - started > 1200 && Date.now() - focusedSince > 900) {
          try {
            const accs = await ethereum.request({ method: 'eth_accounts' });
            if (accs?.length) finish(true, accs);
            else if (sawBlur || Date.now() - started > 2500) finish(false, dismissedErr());
          } catch {
            if (sawBlur || Date.now() - started > 2500) finish(false, dismissedErr());
          }
        }
      } else {
        focusedSince = null;
        sawBlur = true; // lost focus → treat as popup interaction
      }
    }, 350);

    const hardTimer = setTimeout(() => {
      const err = new Error('Voodoo Wallet did not respond. Click Voodoo Wallet again.');
      err.code = 'VOODOO_TIMEOUT';
      finish(false, err);
    }, timeoutMs);

    // Kick the extension open
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

  const applyConnection = useCallback(async (ethereum, kind, setError, opts = {}) => {
    if (!ethereum) return false;
    const { isCurrent } = opts;

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

    try {
      await ensurePulseChain(ethereum);
    } catch (e) {
      console.warn('PulseChain switch best-effort', e);
    }

    const browserProvider = new ethers.BrowserProvider(ethereum);
    const walletSigner = await browserProvider.getSigner();
    const address = accounts[0];

    activeEth.current = ethereum;
    setUserAddress(address);
    setSigner(walletSigner);
    setBankContract(createWriteBank(walletSigner));
    setWalletKind(kind);
    setError?.('', 'success');
    onConnected?.();
    return true;
  }, [onConnected]);

  const disconnect = useCallback(() => {
    activeEth.current = null;
    setUserAddress(null);
    setSigner(null);
    setBankContract(null);
    setWalletKind(null);
    try {
      window.VoodooRainbow?.hardReset?.();
    } catch {
      /* ignore */
    }
  }, []);

  /** Standalone Voodoo Wallet button — opens the browser extension */
  const connectVoodoo = useCallback(async (setError) => {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol === 'file:') {
      setError?.('Open via http://localhost (not a saved file). Extensions need http/https.');
      return false;
    }

    // Every click = new attempt. Supersedes a hung previous eth_requestAccounts waiter.
    const gen = ++voodooClickGen.current;
    const isCurrent = () => gen === voodooClickGen.current;
    setConnecting(true);
    try {
      const ethereum = findVoodooSync() || (await discoverVoodooEip6963(1500));
      if (!ethereum) {
        setError?.(
          'Voodoo Wallet not detected. Install the extension, unlock it, refresh, then try again.',
        );
        return false;
      }
      if (!isCurrent()) return false;

      // If a previous request may still be pending, try to force a fresh permission UI
      try {
        await Promise.race([
          ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          }),
          new Promise((r) => setTimeout(r, 1500)),
        ]);
      } catch (permErr) {
        // Unsupported or rejected — eth_requestAccounts still runs below
        if (permErr?.code === 4001) {
          console.info('[Wallet] permissions rejected');
          return false;
        }
      }
      if (!isCurrent()) return false;

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

    setConnecting(true);
    try {
      const rk = await waitForRainbowReady();
      if (!rk?.openConnectModal) {
        setError?.('RainbowKit not ready. Wait 2 seconds and click Other again.');
        return false;
      }

      // Open modal (force connect list)
      const opened = await rk.openConnectModal({ mode: 'connect', forceConnect: true });
      if (opened === false) {
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
          window.removeEventListener('voodoo:rainbow-connected', onConnected);
          window.removeEventListener('voodoo:rainbow-disconnected', onDisconnected);
        }

        window.addEventListener('voodoo:rainbow-connected', onConnected);
        window.addEventListener('voodoo:rainbow-disconnected', onDisconnected);
      });
    } catch (err) {
      console.error('Other/RainbowKit connect failed:', err);
      setError?.(err?.message || 'Could not open wallets');
      return false;
    } finally {
      setConnecting(false);
    }
  }, [applyConnection]);

  // Listen for RainbowKit connects even if user re-connects later
  useEffect(() => {
    function onConnected(event) {
      const provider = event?.detail?.provider;
      if (!provider) return;
      applyConnection(provider, 'rainbow').catch((e) => console.warn(e));
    }
    function onDisconnected() {
      // Only clear if we were on rainbow (avoid nuking Voodoo session)
      if (walletKind === 'rainbow') disconnect();
    }
    window.addEventListener('voodoo:rainbow-connected', onConnected);
    window.addEventListener('voodoo:rainbow-disconnected', onDisconnected);
    return () => {
      window.removeEventListener('voodoo:rainbow-connected', onConnected);
      window.removeEventListener('voodoo:rainbow-disconnected', onDisconnected);
    };
  }, [applyConnection, disconnect, walletKind]);

  // Account / chain listeners
  useEffect(() => {
    const eth = activeEth.current;
    if (!eth?.on) return undefined;
    const onAccounts = (accounts) => {
      if (!accounts?.length) {
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
