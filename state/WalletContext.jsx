import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import {
  PULSECHAIN_CHAIN_ID,
  PULSECHAIN_NETWORK,
} from '../Contract_Files/constants';
import { createWriteBank } from '../Interaction/bank';
import { shortenAddress } from '../helpers/formatters';

const WalletContext = createContext(null);

export function WalletProvider({ children, onConnected }) {
  const [userAddress, setUserAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [bankContract, setBankContract] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const connectWallet = useCallback(async (setError) => {
    if (typeof window === 'undefined') {
      return false;
    }

    if (window.location.protocol === 'file:') {
      setError?.('MetaMask cannot connect from a saved file. Use START.bat → http://localhost:8080');
      return false;
    }

    const ethereum = window.ethereum?.providers?.find((p) => p.isMetaMask) || window.ethereum;
    if (!ethereum) {
      setError?.('MetaMask not detected. Install from metamask.io and refresh.');
      return false;
    }

    setConnecting(true);

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) return false;

      const address = accounts[0];
      const browserProvider = new ethers.BrowserProvider(ethereum);
      const walletSigner = await browserProvider.getSigner();
      const chainIdHex = await browserProvider.send('eth_chainId', []);

      if (chainIdHex !== PULSECHAIN_CHAIN_ID) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: PULSECHAIN_CHAIN_ID }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [PULSECHAIN_NETWORK],
            });
          } else {
            throw switchErr;
          }
        }
      }

      setUserAddress(address);
      setSigner(walletSigner);
      setBankContract(createWriteBank(walletSigner));
      setError?.('', 'success');
      onConnected?.();
      return true;
    } catch (err) {
      console.error('Connect failed:', err);
      setError?.(err.message || 'Connection failed');
      return false;
    } finally {
      setConnecting(false);
    }
  }, [onConnected]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.selectedAddress) {
      connectWallet();
    }
  }, [connectWallet]);

  const value = useMemo(
    () => ({
      userAddress,
      signer,
      bankContract,
      connecting,
      connectWallet,
      walletLabel: userAddress ? shortenAddress(userAddress) : 'Connect Wallet',
      isConnected: Boolean(userAddress && signer),
    }),
    [userAddress, signer, bankContract, connecting, connectWallet],
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