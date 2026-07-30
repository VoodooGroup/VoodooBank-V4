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

  const applyConnection = useCallback(async (ethereum, kind, setError) => {
    if (!ethereum) return false;

    let accounts = [];
    try {
      if (kind === 'voodoo') {
        // Always re-open extension on each connect attempt
        accounts = await ethereum.request({ method: 'eth_requestAccounts' });
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
      // User closed / rejected — silent (no banner/popup spam)
      if (err?.code === 4001 || /reject|denied|cancel/i.test(err?.message || '')) {
        console.info('[Wallet] user cancelled connect');
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

    const gen = ++voodooClickGen.current;
    setConnecting(true);
    try {
      let ethereum = findVoodooSync() || (await discoverVoodooEip6963(1500));
      if (!ethereum) {
        setError?.(
          'Voodoo Wallet not detected. Install the extension, unlock it, refresh, then try again.',
        );
        return false;
      }
      if (gen !== voodooClickGen.current) return false;
      return await applyConnection(ethereum, 'voodoo', setError);
    } catch (err) {
      if (gen !== voodooClickGen.current) return false;
      console.error('Voodoo connect failed:', err);
      setError?.(err?.message || 'Voodoo Wallet connection failed');
      return false;
    } finally {
      if (gen === voodooClickGen.current) setConnecting(false);
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
