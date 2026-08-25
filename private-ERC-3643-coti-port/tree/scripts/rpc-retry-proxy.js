/**
 * Retrying JSON-RPC proxy for COTI testnet.
 *
 * `testnet.coti.io` currently returns HTTP 502 on roughly half of all requests. The load
 * balancer is fine — nginx is answering — but the RPC backend behind it fails to respond,
 * and both LB addresses front the same degraded pool, so pinning an address gains nothing.
 * Failures are per-request and transient, so a retry has a fresh chance of landing on a
 * healthy worker. A test run makes hundreds of calls, so without this no run finishes.
 *
 *   node scripts/rpc-retry-proxy.js &
 *   COTI_TESTNET_RPC_URL=http://127.0.0.1:8545 npx hardhat test ... --network coti-testnet
 *
 * Delete this once the endpoint is healthy — it is a workaround, not infrastructure.
 */
const http = require('http');
const https = require('https');

const UPSTREAM = process.env.UPSTREAM_RPC_URL || 'https://testnet.coti.io/rpc';
const PORT = Number(process.env.PROXY_PORT || 8545);
const MAX_ATTEMPTS = Number(process.env.PROXY_MAX_ATTEMPTS || 12);
const BASE_DELAY_MS = 150;

const upstream = new URL(UPSTREAM);
const agent = new https.Agent({ keepAlive: true, maxSockets: 16 });

let served = 0;
let retried = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function once(body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: upstream.hostname,
        path: upstream.pathname,
        method: 'POST',
        agent,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
        timeout: 30_000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('upstream timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

/**
 * A 200 carrying valid JSON is the only acceptable answer; 502s and HTML error pages are retried.
 *
 * `eth_sendRawTransaction` needs care: a 502 may follow a transaction the node already
 * accepted, so a blind retry can double-send. Retrying is still necessary at this failure
 * rate, so instead the resubmission is treated as idempotent — "already known" and
 * "nonce too low" mean the original landed, and are reported as success.
 */
async function forward(body) {
  let lastErr;
  let isSend = false;
  let txHash = null;
  try {
    const parsed = JSON.parse(body.toString('utf8'));
    isSend = parsed && parsed.method === 'eth_sendRawTransaction';
  } catch { /* non-JSON body: treat as opaque */ }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await once(body);
      if (res.status === 200) {
        try {
          const parsed = JSON.parse(res.body.toString('utf8'));
          if (isSend && parsed.error && typeof parsed.error.message === 'string') {
            const m = parsed.error.message.toLowerCase();
            // The earlier attempt did land; report the hash we already saw rather than an error.
            if ((m.includes('already known') || m.includes('nonce too low')) && txHash) {
              return { status: 200, body: Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: txHash })) };
            }
          }
          if (isSend && parsed.result) txHash = parsed.result;
          return res;
        } catch {
          lastErr = new Error('non-JSON body');
        }
      } else {
        lastErr = new Error(`upstream ${res.status}`);
      }
    } catch (e) {
      lastErr = e;
    }
    retried++;
    await sleep(Math.min(BASE_DELAY_MS * attempt, 1500));
  }
  throw lastErr || new Error('upstream unavailable');
}

http
  .createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      try {
        const out = await forward(body);
        served++;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(out.body);
      } catch (e) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: String(e.message || e) } }));
      }
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`rpc-retry-proxy: 127.0.0.1:${PORT} -> ${UPSTREAM} (up to ${MAX_ATTEMPTS} attempts/call)`);
  });

setInterval(() => {
  if (served) console.log(`rpc-retry-proxy: ${served} calls served, ${retried} upstream retries`);
}, 30_000).unref();
