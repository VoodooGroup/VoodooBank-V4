import { ethers } from 'ethers';
import BANK_ABI from '../Contract_Files/bankAbi.json';
import {
  BANK_ADDRESS,
  ERC20_ABI,
  RPC_URL,
  VOODOO_TOKEN,
} from '../Contract_Files/constants';

let readProvider;
let readBank;

function getRpcUrl() {
  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    if (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return `${origin}/rpc`;
    }
  }
  return RPC_URL;
}

export function getReadBank() {
  if (!readBank) {
    readProvider = new ethers.JsonRpcProvider(getRpcUrl());
    readBank = new ethers.Contract(BANK_ADDRESS, BANK_ABI, readProvider);
  }
  return readBank;
}

export function createWriteBank(signer) {
  return new ethers.Contract(BANK_ADDRESS, BANK_ABI, signer);
}

export async function fetchSafeData() {
  return getReadBank().getSafeData();
}

export async function fetchLocksBySafeNumber(safeNumber) {
  return getReadBank().getLocksBySafeNumber(safeNumber);
}

export async function fetchSafeOwner(safeNumber) {
  return getReadBank().safeNumberToAddress(safeNumber);
}

export async function fetchTokenDecimals(tokenAddress) {
  return getReadBank().tokenDecimals(tokenAddress);
}

export async function fetchRewardRates() {
  const bank = getReadBank();
  const [rate1, rate5, rate10] = await Promise.all([
    bank.rateFor1Year(),
    bank.rateFor5Year(),
    bank.rateFor10Year(),
  ]);
  return { rate1, rate5, rate10 };
}

export async function fetchStats() {
  const bank = getReadBank();
  const [tvlBN, paidOutBN, safeData] = await Promise.all([
    bank.totalNormalizedValueLocked(),
    bank.totalNormalizedPaidOut(),
    bank.getSafeData(),
  ]);

  let inUse = 0;
  safeData.forEach((s) => {
    if (s.totalNormalizedLocked > 0n) inUse++;
  });

  return { tvlBN, paidOutBN, inUse, safeData };
}

function isEmptyLock(lock) {
  return lock.amount === 0n && lock.safeNumber === 0n && lock.startTime === 0n;
}

async function getUserLocksLength(userAddress) {
  if (!userAddress) return 0;

  const bank = getReadBank();
  let length = 0;

  while (length < 256) {
    const lock = await bank.locks(userAddress, length);
    if (isEmptyLock(lock)) return length;
    length++;
  }

  return length;
}

export async function fetchUserLocks(userAddress) {
  const length = await getUserLocksLength(userAddress);
  const bank = getReadBank();
  const userLocks = [];

  for (let i = 0; i < length; i++) {
    userLocks.push(await bank.locks(userAddress, i));
  }

  return userLocks;
}

/**
 * Approve exact lock amount (not MaxUint256) so the wallet can show
 * "Allow X VDO" instead of unlimited / blank amount.
 */
export async function approveTokenIfNeeded(signer, userAddress, rawAmount) {
  const tokenContract = new ethers.Contract(VOODOO_TOKEN, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(userAddress, BANK_ADDRESS);

  if (allowance < rawAmount) {
    const tx = await tokenContract.approve(BANK_ADDRESS, rawAmount);
    await tx.wait();
    return true;
  }

  return false;
}

/**
 * Bank.lock — VDO moves via transferFrom inside the contract (native value = 0 PLS).
 * Exact rawAmount is in calldata so wallet simulation can surface the token spend.
 * No intermediate dapp "sending..." UI; wallet opens on this call.
 */
export async function lockSafe(signer, safeNumber, rawAmount, years) {
  const bankContract = createWriteBank(signer);
  // Let the wallet estimate gas (better simulation of ERC20 transferFrom + amount).
  const tx = await bankContract.lock(safeNumber, rawAmount, years, VOODOO_TOKEN);
  return tx.wait();
}

export async function unlockSafe(signer, lockIndex) {
  const bankContract = createWriteBank(signer);
  const tx = await bankContract.unlock(lockIndex);
  return tx.wait();
}

export async function getTokenDecimals(signer) {
  const tokenContract = new ethers.Contract(VOODOO_TOKEN, ERC20_ABI, signer);
  return tokenContract.decimals();
}