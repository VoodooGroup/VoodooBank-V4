import { SAFE_SECTIONS } from '../Contract_Files/constants';

export default function Header({
  activeSection,
  onNavigate,
  voodooLabel,
  otherLabel,
  isConnected,
  walletKind,
  onConnectVoodoo,
  onConnectOther,
  connecting,
}) {
  return (
    <header>
      <div className="logo">Voodoo Bank</div>
      <nav>
        <ul id="mainMenu">
          {SAFE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href="#"
                data-target={section.id}
                className={activeSection === section.id ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(section.id);
                }}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="wallet-actions">
        <button
          type="button"
          id="voodooWalletBtn"
          className={`wallet-btn wallet-btn-voodoo${isConnected && walletKind === 'voodoo' ? ' is-connected' : ''}`}
          title="Connect with Voodoo Wallet browser extension"
          disabled={connecting && walletKind !== 'voodoo'}
          onClick={onConnectVoodoo}
        >
          {voodooLabel}
        </button>
        <button
          type="button"
          id="connectBtn"
          className={`wallet-btn wallet-btn-other${isConnected && walletKind === 'rainbow' ? ' is-connected' : ''}`}
          title="Other wallets via RainbowKit (MetaMask, WalletConnect, Rabby, …)"
          disabled={connecting && walletKind !== 'rainbow'}
          onClick={onConnectOther}
        >
          {otherLabel}
        </button>
      </div>
    </header>
  );
}
