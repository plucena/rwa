import hre from 'hardhat';
import { getDecryptionTxDataViaProxy, prepareMessageForBubble256 } from './bubbleCryptoTransport';

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
  });

  try {
    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function toBigInt(value: bigint | { toString(): string }): bigint {
  return typeof value === 'bigint' ? value : BigInt(value.toString());
}

export function buildItUint256(amount: bigint, userAddress: string, keyHex: string, tokenAddress: string) {
  const { encryptedHigh, encryptedLow } = prepareMessageForBubble256(amount, userAddress, keyHex, tokenAddress);
  return {
    userAddress,
    ciphertext: {
      ciphertextHigh: encryptedHigh,
      ciphertextLow: encryptedLow,
    },
  };
}

export async function getDecryptionTxDataWithRetry(params: {
  proxyUrl: string;
  chainId: number;
  contractAddress: string;
  decryptId: bigint;
  attempts?: number;
  waitMs?: number;
}): Promise<string> {
  const {
    proxyUrl,
    chainId,
    contractAddress,
    decryptId,
    attempts = 12,
    waitMs = 5000,
  } = params;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await getDecryptionTxDataViaProxy(proxyUrl, chainId, contractAddress, decryptId);
    } catch (err) {
      lastErr = err;
      const msg = String((err as { message?: string })?.message || err);
      const notReady = msg.includes('decrypt data is not ready yet') || msg.includes('HTTP 503');
      if (!notReady || i === attempts - 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastErr;
}

export async function finalizeMintDecryptCallback(params: {
  privateToken: any;
  signer: any;
  proxyUrl: string;
  decryptId: bigint;
  label?: string;
}) {
  const { privateToken, signer, proxyUrl, decryptId, label = 'callbackMint' } = params;
  const pending = await privateToken.isMintDecryptPending(decryptId);
  if (!pending) {
    return;
  }

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const txData = await getDecryptionTxDataWithRetry({
    proxyUrl,
    chainId,
    contractAddress: privateToken.address,
    decryptId,
  });

  try {
    const tx = await signer.sendTransaction({ to: privateToken.address, data: txData });
    await tx.wait();
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err);
    const stillPending = await privateToken.isMintDecryptPending(decryptId);
    if (
      !stillPending &&
      (msg.includes('Invalid request ID') || msg.includes('CALL_EXCEPTION') || msg.includes('transaction failed'))
    ) {
      return;
    }
    throw new Error(`[${label}] ${msg}`);
  }
}

export async function finalizeLatestMint(privateToken: any, signer: any, proxyUrl: string, label = 'callbackMint latest') {
  const decryptId = BigInt((await privateToken.getLastDecryptRequestId()).toString());
  await finalizeMintDecryptCallback({ privateToken, signer, proxyUrl, decryptId, label });
}
