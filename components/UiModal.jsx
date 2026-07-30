/**
 * Modern white centered dialogs — same UX as StakingPlatform-V4 VoodooUI.
 * No browser alert(), no green ErrorLog banner.
 */
import { useEffect, useRef } from 'react';

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
    >
      <div
        className="voodoo-ui-backdrop"
        data-ui-dismiss="1"
        onClick={() => onClose?.(false)}
      />
      <div className="voodoo-ui-panel" role="document">
        <div className="voodoo-ui-icon" data-type={type} aria-hidden="true">
          {icon}
        </div>
        <h2 className="voodoo-ui-title" id="voodooUiTitle">
          {title}
        </h2>
        <p className="voodoo-ui-message">{message}</p>
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

/** Map connection / wallet errors → user-facing copy (or null = silent) */
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

  let type = variant === 'success' ? 'success' : variant === 'info' ? 'info' : 'error';
  let title = type === 'success' ? 'Success' : type === 'info' ? 'Info' : 'Notice';

  if (/not detected|not ready|install/i.test(raw)) {
    title = 'Wallet';
    type = 'warning';
  } else if (/failed|error|could not/i.test(raw) && type !== 'success') {
    title = 'Something went wrong';
    type = 'error';
  }

  return {
    title,
    message: raw,
    type,
    okText: 'OK',
  };
}
