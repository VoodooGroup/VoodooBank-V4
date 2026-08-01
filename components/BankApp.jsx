import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { SAFE_GRIDS } from '../Contract_Files/constants';
import {
  fetchRewardRates,
  fetchSafeData,
  fetchStats,
} from '../Interaction/bank';
import { getVdoPriceUsd } from '../Interaction/price';
import { computeMultiplier } from '../helpers/multipliers';
import { formatTokenAmount, formatUsd } from '../helpers/formatters';
import { useWallet } from '../state/WalletContext';
import Header from './Header';
import Footer from './Footer';
import Hero from './Hero';
import Stats from './Stats';
import ValuableSafes from './ValuableSafes';
import SafesSection from './SafesSection';
import Modal from './Modal';
import UiModal, { normalizeNotify } from './UiModal';

const DEFAULT_MULTIPLIERS = { one: '--', five: '--', ten: '--' };

export default function BankApp() {
  const {
    userAddress,
    signer,
    connectVoodoo,
    connectOther,
    voodooLabel,
    otherLabel,
    isConnected,
    walletKind,
    connecting,
  } = useWallet();
  const [activeSection, setActiveSection] = useState('home');
  const [safeData, setSafeData] = useState([]);
  const [stats, setStats] = useState({
    safesInUse: 0,
    tvlUsd: '$0',
    tvlTokens: '0 VDO',
    payout: '0 VDO',
  });
  const [multipliers, setMultipliers] = useState(DEFAULT_MULTIPLIERS);
  const [rewardsError, setRewardsError] = useState(false);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [modalSafe, setModalSafe] = useState(null);
  /** White modern dialog (replaces ErrorLog banner + chrome alerts) */
  const [uiDialog, setUiDialog] = useState(null);

  const closeUiDialog = useCallback(() => setUiDialog(null), []);

  /**
   * Notify user with white centered UiModal only (1:1 Plinko / Miner / Governance).
   * User-cancel messages are silent. Never uses ErrorLog / yellow banners.
   */
  const setError = useCallback((message, variant = 'error') => {
    if (!message) {
      setUiDialog(null);
      return;
    }
    const normalized = normalizeNotify(message, variant);
    if (!normalized) {
      // Quiet cancel / empty — no popup, no banner
      console.info('[VoodooBank]', message);
      return;
    }
    // Force modal (never fall back to green/yellow page banners)
    setUiDialog({
      title: normalized.title,
      message: normalized.message,
      type: normalized.type || 'error',
      okText: normalized.okText || 'OK',
    });
  }, []);

  const safeMap = useMemo(() => {
    const map = new Map();
    safeData.forEach((safe) => map.set(Number(safe.safeNumber), safe));
    return map;
  }, [safeData]);

  const loadMultipliers = useCallback(async () => {
    setRewardsLoading(true);
    try {
      const { rate1, rate5, rate10 } = await fetchRewardRates();
      setMultipliers({
        one: computeMultiplier(rate1, 1),
        five: computeMultiplier(rate5, 5),
        ten: computeMultiplier(rate10, 10),
      });
      setRewardsError(false);
    } catch (err) {
      console.error('Failed to load reward multipliers:', err);
      setRewardsError(true);
    } finally {
      setRewardsLoading(false);
    }
  }, []);

  const updateAll = useCallback(async () => {
    try {
      const [data, statsResult] = await Promise.all([fetchSafeData(), fetchStats()]);
      setSafeData(data);

      // On-chain normalized amounts (18 decimals) — tokens locked + total paid out
      const tvlTokensNum = Number(ethers.formatEther(statsResult.tvlBN));
      const paidOutNum = Number(ethers.formatEther(statsResult.paidOutBN));
      const tvlFormatted = formatTokenAmount(tvlTokensNum);
      const payoutFormatted = formatTokenAmount(paidOutNum);

      // Live VDO price (DexScreener) → USD TVL
      const price = await getVdoPriceUsd();
      const tvlUsd = tvlTokensNum > 0 && price > 0 ? tvlTokensNum * price : 0;

      setStats({
        safesInUse: statsResult.inUse,
        tvlUsd: formatUsd(tvlUsd),
        tvlTokens: `${tvlFormatted} VDO`,
        // 0 VDO is valid when nobody has unlocked yet
        payout: `${payoutFormatted} VDO`,
      });

      if (tvlTokensNum > 0 && !(price > 0)) {
        console.warn('[Bank] TVL tokens OK but price=0 — check DexScreener / LCW');
      }
    } catch (err) {
      console.error('updateAll failed:', err);
      setError('Failed to load page (check console)');
    }

    await loadMultipliers();
  }, [setError, loadMultipliers]);

  useEffect(() => {
    updateAll();
  }, [updateAll]);

  useEffect(() => {
    if (isConnected) {
      updateAll();
    }
  }, [isConnected, updateAll]);

  const handleConnectVoodoo = async () => {
    // Already connected via Voodoo — no-op (label shows address)
    if (isConnected && walletKind === 'voodoo') return;
    // Always allow click even if a previous request is still pending
    const connected = await connectVoodoo(setError);
    if (connected) await updateAll();
  };

  const handleConnectOther = async () => {
    // If already on rainbow, open account modal when possible
    if (isConnected && walletKind === 'rainbow') {
      try {
        await window.VoodooRainbow?.openConnectModal?.({ mode: 'account' });
      } catch {
        /* ignore */
      }
      return;
    }
    const connected = await connectOther(setError);
    if (connected) await updateAll();
  };

  const handleNavigate = (sectionId) => {
    setActiveSection(sectionId);
    // Always start at the top of the new section (Lock Up Now / menu)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      // Next frame in case layout shifts after section switch
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    }
  };

  const handleSafeClick = (safeNumber) => setModalSafe(safeNumber);

  const handleCloseModal = () => setModalSafe(null);

  return (
    <>
      <Header
        activeSection={activeSection}
        onNavigate={handleNavigate}
        voodooLabel={voodooLabel}
        otherLabel={otherLabel}
        isConnected={isConnected}
        walletKind={walletKind}
        connecting={connecting}
        onConnectVoodoo={handleConnectVoodoo}
        onConnectOther={handleConnectOther}
      />

      <UiModal
        open={Boolean(uiDialog)}
        title={uiDialog?.title}
        message={uiDialog?.message}
        type={uiDialog?.type || 'info'}
        okText={uiDialog?.okText || 'OK'}
        onClose={closeUiDialog}
      />

      <section id="home" className={`page-section${activeSection === 'home' ? ' active' : ''}`}>
        <Hero
          multipliers={multipliers}
          rewardsError={rewardsError}
          rewardsLoading={rewardsLoading}
          onLockUp={handleNavigate}
        />
        <Stats {...stats} />
        <ValuableSafes safeData={safeData} onSafeClick={handleSafeClick} />
      </section>

      {SAFE_GRIDS.map((grid) => (
        <SafesSection
          key={grid.sectionId}
          id={grid.sectionId}
          title={grid.title}
          start={grid.start}
          end={grid.end}
          safeMap={safeMap}
          onSafeClick={handleSafeClick}
          active={activeSection === grid.sectionId}
        />
      ))}

      <Modal
        safeNumber={modalSafe}
        open={Boolean(modalSafe)}
        onClose={handleCloseModal}
        userAddress={userAddress}
        signer={signer}
        setError={setError}
        onSuccess={updateAll}
      />

      <Footer />
    </>
  );
}