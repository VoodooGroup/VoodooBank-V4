export const OPEN_URL = '/voodoo-token-safe-open.webp';
/** Real closed-safe asset (was wrongly the same as open → grid never looked locked). */
export const CLOSED_URL = '/voodoo-token-safe-closed.png';
export const HERO_IMAGE_URL = '/voodoo-token-bank-image.webp';
export const VDO_LOGO_URL = '/favicon.png';

export const BANK_ADDRESS = '0x66C49BC2B59D4F61FA1836736bE17173d616C5D5';
export const PULSECHAIN_CHAIN_ID = '0x171';
export const RPC_URL = 'https://rpc.pulsechain.com';
export const VOODOO_TOKEN = '0x1c5f8e8E84AcC71650F7a627cfA5B24B80f44f00';

export const LCW_API_KEY = process.env.NEXT_PUBLIC_LCW_API_KEY || '';

export const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];

export const PULSECHAIN_NETWORK = {
  chainId: PULSECHAIN_CHAIN_ID,
  chainName: 'PulseChain',
  nativeCurrency: { name: 'Pulse', symbol: 'PLS', decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ['https://scan.pulsechain.com'],
};

export const SAFE_SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'safes1-15', label: 'Safes 1-15' },
  { id: 'safes16-30', label: 'Safes 16-30' },
  { id: 'safes31-45', label: 'Safes 31-45' },
  { id: 'safes46-60', label: 'Safes 46-60' },
];

export const SAFE_GRIDS = [
  { sectionId: 'safes1-15', title: 'Safes 1 to 15', start: 1, end: 15 },
  { sectionId: 'safes16-30', title: 'Safes 16 to 30', start: 16, end: 30 },
  { sectionId: 'safes31-45', title: 'Safes 31 to 45', start: 31, end: 45 },
  { sectionId: 'safes46-60', title: 'Safes 46 to 60', start: 46, end: 60 },
];

export const MIN_LOCK_AMOUNT = 10000n;
export const TOTAL_SAFES = 60;