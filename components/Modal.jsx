import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import {
  MIN_LOCK_AMOUNT,
  VDO_LOGO_URL,
} from '../Contract_Files/constants';
import {
  approveTokenIfNeeded,
  fetchLocksBySafeNumber,
  fetchSafeOwner,
  fetchTokenDecimals,
  fetchUserLocks,
  getTokenDecimals,
  lockSafe as lockSafeTx,
  unlockSafe as unlockSafeTx,
} from '../Interaction/bank';
import { formatTokenAmount } from '../helpers/formatters';

export default function Modal({
  safeNumber,
  open,
  onClose,
  userAddress,
  signer,
  setError,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [modalState, setModalState] = useState(null);

  useEffect(() => {
    if (!open || !safeNumber) {
      setModalState(null);
      return;
    }

    let cancelled = false;

    async function loadModal() {
      setLoading(true);

      try {
        let locks = [];
        let owner = ethers.ZeroAddress;

        try {
          locks = await fetchLocksBySafeNumber(safeNumber);
          owner = await fetchSafeOwner(safeNumber);
        } catch (err) {
          if (!err.reason?.includes('Safe number does not exist or is available')) {
            if (!cancelled) {
              setModalState({
                type: 'error',
                message: err.reason || err.message || 'Error loading safe',
              });
            }
            return;
          }
        }

        const activeLocks = locks.filter((l) => l.isLocked);
        const isClosed = activeLocks.length > 0;

        if (!isClosed) {
          if (!cancelled) {
            setModalState({ type: 'lock' });
          }
          return;
        }

        const lock = activeLocks[activeLocks.length - 1];
        let dec = 18;

        try {
          dec = await fetchTokenDecimals(lock.token);
        } catch {
          dec = 18;
        }

        const amountStr = ethers.formatUnits(lock.amount, dec);
        const amountFormatted = formatTokenAmount(amountStr);
        const startDate = new Date(Number(lock.startTime) * 1000).toLocaleString();
        const endDate = new Date(Number(lock.unlockTime) * 1000).toLocaleString();
        const now = Date.now();
        const unlockMs = Number(lock.unlockTime) * 1000;
        const isUnlocked = now >= unlockMs;
        const daysLeft = Math.max(0, Math.ceil((unlockMs - now) / 86400000));

        let lockIndex = -1;
        let isOwner = false;

        if (userAddress && userAddress.toLowerCase() === owner.toLowerCase()) {
          isOwner = true;
          const userLocks = await fetchUserLocks(userAddress);
          lockIndex = userLocks.findIndex(
            (l) => l.safeNumber.toString() === safeNumber.toString() && l.isLocked,
          );
        }

        if (!cancelled) {
          setModalState({
            type: 'locked',
            lock,
            amountFormatted,
            startDate,
            endDate,
            isUnlocked,
            daysLeft,
            isOwner,
            lockIndex,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setModalState({
            type: 'error',
            message: err.reason || err.message || 'Error loading safe',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadModal();

    return () => {
      cancelled = true;
    };
  }, [open, safeNumber, userAddress]);

  const handleLock = async () => {
    if (!signer) {
      setError('Please connect your wallet first');
      return;
    }

    const amountInput = document.getElementById('amount');
    const durationInput = document.getElementById('duration');
    const amountStr = amountInput?.value;
    const years = Number(durationInput?.value || 1);

    if (!amountStr || BigInt(amountStr) < MIN_LOCK_AMOUNT) {
      setError('Please enter a valid amount (min 10000)');
      return;
    }

    try {
      setError('');
      const dec = await getTokenDecimals(signer);
      const amount = BigInt(amountStr);
      const rawAmount = amount * 10n ** BigInt(dec);

      setError('Approval required...');
      const approved = await approveTokenIfNeeded(signer, userAddress, rawAmount);
      if (approved) {
        setError('Approval confirmed. Sending lock transaction...');
      } else {
        setError('Sending lock transaction...');
      }

      await lockSafeTx(signer, safeNumber, rawAmount, years);
      setError('Lock successful!', 'success');
      onClose();
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.reason || err.message || 'Failed');
    }
  };

  const handleUnlock = async (lockIndex) => {
    if (!signer) {
      setError('Wallet not connected');
      return;
    }

    try {
      setError('');
      await unlockSafeTx(signer, lockIndex);
      setError('Unlocked successfully!', 'success');
      onClose();
      onSuccess();
    } catch (err) {
      setError(err.reason || err.message || 'Failed');
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="overlay open" onClick={onClose} />
      <div className="modal open">
        <div id="modal-content">
          <h2
            style={{
              margin: '0 0 24px',
              fontSize: '28px',
              textAlign: 'center',
              color: '#1f2937',
            }}
          >
            Safe #{safeNumber}
          </h2>

          {loading && <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading safe...</p>}

          {!loading && modalState?.type === 'error' && (
            <p style={{ color: '#ef4444', textAlign: 'center' }}>{modalState.message}</p>
          )}

          {!loading && modalState?.type === 'lock' && (
            <div className="modal-form">
              <div className="form-row">
                <span className="form-label">Token:</span>
                <div className="token-display">
                  VDO <img src={VDO_LOGO_URL} alt="Voodoo Token" />
                </div>
              </div>
              <div className="form-row">
                <span className="form-label">Amount (min 10000):</span>
                <input
                  type="number"
                  id="amount"
                  min="10000"
                  defaultValue="10000"
                  className="form-input"
                />
              </div>
              <div className="form-row">
                <span className="form-label">Duration:</span>
                <select id="duration" className="form-select" defaultValue="1">
                  <option value="1">1 Year</option>
                  <option value="5">5 Years</option>
                  <option value="10">10 Years</option>
                </select>
              </div>
              <button className="modal-btn" onClick={handleLock}>
                Lock Now
              </button>
              <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', marginTop: '16px' }}>
                Approval will be requested automatically if needed (MetaMask)
              </p>
            </div>
          )}

          {!loading && modalState?.type === 'locked' && (
            <>
              <div
                style={{
                  margin: '20px 0',
                  padding: '24px',
                  background: '#f9fafb',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              >
                <div className="info-row">
                  <span className="info-label">Status:</span>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Locked</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Locked since:</span>
                  <span className="info-value">{modalState.startDate}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Lock ends:</span>
                  <span className="info-value">{modalState.endDate}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Amount locked:</span>
                  <strong>{modalState.amountFormatted} VDO</strong>
                </div>
                <div className="info-row">
                  <span className="info-label">Duration:</span>
                  <span className="info-value">{modalState.lock.duration} years</span>
                </div>
                {modalState.isUnlocked ? (
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <strong style={{ color: '#22c55e' }}>Unlock ready!</strong>
                  </div>
                ) : (
                  <div className="timer">≈ {modalState.daysLeft} days remaining</div>
                )}
              </div>

              {modalState.isOwner && modalState.lockIndex !== -1 && (
                <>
                  <button
                    className="modal-btn unlock"
                    disabled={!modalState.isUnlocked}
                    onClick={() => modalState.isUnlocked && handleUnlock(modalState.lockIndex)}
                  >
                    Withdraw & Claim Rewards
                  </button>
                  {!modalState.isUnlocked && (
                    <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', marginTop: '12px' }}>
                      You can only withdraw after the lock period ends
                    </p>
                  )}
                </>
              )}

              {modalState.isOwner && modalState.lockIndex === -1 && (
                <p style={{ color: '#ef4444', textAlign: 'center' }}>Cannot find lock index</p>
              )}

              {!modalState.isOwner && (
                <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '16px' }}>
                  This safe belongs to someone else.
                </p>
              )}
            </>
          )}
        </div>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
      </div>
    </>
  );
}