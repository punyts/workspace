#!/usr/bin/env node
// The store's server: the StateUI MCP server (@punyts/stateui-mcp) with the store's payment procedure registered.
// It serves no HTTP. The pages come from the view server (npm run mcp in the workspace: Vite on 5180) and the live
// state goes through the statenet (4200).
//
//   node server.mjs            MCP on stdin and stdout, for an MCP client (an agent that edits the store)
//   node server.mjs --serve    no MCP client: it only runs the store (its logic, orders and payments) until stopped
//
// Options: --data-dir <dir> (default ./data beside this file), --statenet <url>, --view-url <url>

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStateUiTools, DEFAULT_STATENET_URL, DEFAULT_VIEW_URL, startServer } from '@punyts/stateui-mcp';
import { startInventory } from './inventory.mjs';
import { createCharge, paymentMode } from './payments.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function option(name, fallback) {
    const at = process.argv.indexOf(name);
    return at >= 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
}

const serve = process.argv.includes('--serve');
const quiet = process.argv.includes('--quiet');
const dataDir = resolve(option('--data-dir', resolve(here, 'data')));
const report = { info: (message, fields) => process.stderr.write(`[store] ${message} ${fields === undefined ? '' : JSON.stringify(fields)}\n`) };

const server = await startServer({
    dataDir,
    statenetUrl: option('--statenet', DEFAULT_STATENET_URL),
    viewUrl: option('--view-url', DEFAULT_VIEW_URL),
    report: quiet ? { info: () => undefined } : report,
    transport: serve ? 'none' : 'stdio',
    procedures: { 'payment.charge': createCharge() }
});
// Stock follows the orders (nothing to do until the store is built)
const stopInventory = startInventory(createStateUiTools(server.services), server.services.onPartChange, quiet ? { info: () => undefined } : report);
process.stderr.write(`store: payments in ${paymentMode().mode} mode, data in ${dataDir}, views at ${server.viewUrl}\n`);

let stopping = false;
const stop = () => {
    if (stopping) return;
    stopping = true;
    stopInventory();
    void server.stop().finally(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
if (serve) setInterval(() => undefined, 60_000);
else process.stdin.on('close', stop);
