/**
 * Modern white centered dialogs — 1:1 with Plinko / Miner / Voodoo Governance.
 * No browser alert(), no green/yellow ErrorLog banner for wallet errors.
 */
import { useEffect, useRef } from 'react';

/** Canonical not-detected copy (all Voodoo dApps) */
export const VOODOO_NOT_DETECTED_MSG =
  'Voodoo Wallet was not detected. Install the extension, open it and sign in, then refresh this page and try again.';

export default function UiModal({
  open,
  title = 'Notice',
  message = '',
  type = 'info', // info | error | success | warning
  okText = 'OK',
  cancelText = null,
  onClose,
  onConfirm,
}) {
  const okRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('voodoo-ui-open');
    const t = setTimeout(() => okRef.current?.focus?.(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('voodoo-ui-open');
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Same glyphs as Plinko/Miner ui.js
  const icon =
    type === 'success' ? '✓'
      : type === 'error' || type === 'warning' ? '!'
        : 'i';

  return (
    <div
      id="voodooUiModal"
      className="voodoo-ui-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voodooUiTitle"
      data-type={type || 'info'}
    >
      <div
        className="voodoo-ui-backdrop"
        data-ui-dismiss="1"
        onClick={() => onClose?.(false)}
      />
      <div className="voodoo-ui-panel" role="document">
        {/* Gray circle only — never yellow/red/green tints (1:1 Plinko/Miner) */}
        <div className="voodoo-ui-icon" data-type={type} aria-hidden="true">
          {icon}
        </div>
        <h2 className="voodoo-ui-title" id="voodooUiTitle">
          {title}
        </h2>
        {message ? <p className="voodoo-ui-message">{message}</p> : null}
        <div className="voodoo-ui-actions">
          {cancelText ? (
            <button
              type="button"
              className="voodoo-ui-btn voodoo-ui-btn-ghost"
              onClick={() => onClose?.(false)}
            >
              {cancelText}
            </button>
          ) : null}
          <button
            ref={okRef}
            type="button"
            className="voodoo-ui-btn voodoo-ui-btn-primary"
            onClick={() => (onConfirm ? onConfirm() : onClose?.(true))}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Map connection / wallet errors → user-facing copy (or null = silent).
 * Same rules as Plinko/Miner/DAO normalizeNotify.
 */
export function normalizeNotify(message, variant = 'error') {
  const raw = String(message || '').trim();
  if (!raw) return null;

  // User intentionally closed / rejected — no noisy popup
  if (
    /cancelled in wallet|connection cancelled|user rejected|user denied|rejected the request|ACTION_REJECTED/i.test(raw)
    || raw === '4001'
  ) {
    return null;
  }

  // Intermediate lock progress (wallet already open) — never show as Notice
  if (
    /sending lock transaction|approval required|approval confirmed|sending unlock/i.test(raw)
  ) {
    return null;
  }

  let type = variant === 'success' ? 'success' : variant === 'info' ? 'info' : 'error';
  let title = type === 'success' ? 'Success' : type === 'info' ? 'Info' : 'Notice';
  let msg = raw;

  if (type === 'success' || /lock successful|locked \d|unlocked successfully/i.test(raw)) {
    title = 'Success';
    type = 'success';
  } else if (/not detected|not ready/i.test(raw)) {
    // 1:1 popup as Plinko / Miner / Governance
    title = 'Voodoo Wallet';
    type = 'error';
    msg = VOODOO_NOT_DETECTED_MSG;
  } else if (/failed|error|could not/i.test(raw) && type !== 'success') {
    title = 'Something went wrong';
    type = 'error';
  }

  return {
    title,
    message: msg,
    type,
    okText: 'OK',
  };
}
