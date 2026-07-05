import { SAFE_SECTIONS } from '../Contract_Files/constants';

export default function Header({ activeSection, onNavigate, walletLabel, isConnected, onConnect }) {
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
      <button
        id="connectWallet"
        className={`wallet-button${isConnected ? ' connected' : ''}`}
        onClick={onConnect}
      >
        {walletLabel}
      </button>
    </header>
  );
}