#!/usr/bin/env node
// Builds the Tide & Timber store through the StateUI MCP tools, as an agent would: a theme, models, datasets, a shared
// header, the storefront app and the back office app. It talks to the store's own server (server.mjs) on stdio.
//
//   node build.mjs            builds into ./data (refuses when the store is already there)
//   node build.mjs --fresh    removes ./data first and builds again
//
// Every step is one tool call; a refused call stops the build with the tool's answer.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BRAND, PRODUCTS, SEED_ORDERS, categoryRecords } from './catalog.mjs';
import { adminApp } from './parts/admin.mjs';
import { MODELS } from './parts/models.mjs';
import { storeApp } from './parts/store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, 'data');
if (process.argv.includes('--fresh')) rmSync(dataDir, { recursive: true, force: true });
else if (existsSync(resolve(dataDir, 'names.json'))) {
    console.error('The store is already built in ./data. Run with --fresh to build it again from nothing.');
    process.exit(1);
}

const client = new Client({ name: 'store-build', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(here, 'server.mjs'), '--data-dir', dataDir, '--quiet'], stderr: 'inherit' }));

/** Calls a tool; a failed call ends the build with its answer */
async function step(tool, args) {
    const result = await client.callTool({ name: tool, arguments: args });
    const text = result.content.find((item) => item.type === 'text')?.text ?? '{}';
    const body = JSON.parse(text);
    if (result.isError) {
        // The blocking errors only, one line each; the warnings a refused write lists beside them are left out
        const shown = Array.isArray(body.errors) ? { ...body, errors: body.errors.filter((entry) => entry.severity !== 'warning').map((entry) => `${entry.code}: ${entry.message}`) } : body;
        console.error(`\n${tool} failed:\n${JSON.stringify(shown, null, 2).slice(0, 6000)}`);
        await client.close();
        process.exit(1);
    }
    const warnings = (body.warnings ?? []).filter((warning) => warning.severity !== 'warning' || process.argv.includes('--warnings'));
    if (warnings.length > 0) console.warn(`  ${tool}: ${warnings.map((warning) => `${warning.code} ${warning.message}`).join('\n    ')}`);
    return body;
}

const records = (map) => Object.entries(map).map(([key, value]) => ({ op: 'set', path: key, value }));

// 1. Theme: the professional preset, with the brand's deep teal and warm paper
console.log('theme');
await step('ui_theme_create', { name: 'tide', preset: 'professional' });
await step('ui_theme_write', {
    theme: 'tide',
    expectedRevision: 1,
    operations: [
        { op: 'set', path: 'color.accent.base', value: '#1f5d5b' },
        { op: 'set', path: 'color.accent.soft', value: '#dcebe8' },
        { op: 'set', path: 'color.accent.on', value: '#ffffff' },
        { op: 'set', path: 'color.surface.base', value: '#faf7f2' },
        { op: 'set', path: 'color.surface.sunken', value: '#f1ece3' },
        { op: 'set', path: 'radius.md', value: '10px' },
        { op: 'set', path: 'radius.lg', value: '16px' }
    ]
});

// 2. Data: the models, then the shared datasets with their seed records
console.log('models');
for (const [model, fields] of Object.entries(MODELS)) {
    await step('ui_model_write', { model, operations: Object.entries(fields).map(([field, declaration]) => ({ op: 'set', field, ...declaration })) });
}
console.log('data');
await step('ui_data_write', { dataset: 'tide-products', model: 'tide-product', operations: records(PRODUCTS) });
await step('ui_data_write', { dataset: 'tide-categories', model: 'tide-category', operations: records(categoryRecords()) });
await step('ui_data_write', { dataset: 'tide-orders', model: 'tide-order', operations: records(SEED_ORDERS) });

// 3. The apps
for (const app of [storeApp(BRAND), adminApp(BRAND)]) {
    console.log(app.name);
    for (const composed of app.composed ?? []) await step('ui_composed_write', composed);
    // Screens name each other (a menu, a navigate), so every screen is made empty first and filled once all exist
    let revision = (await step('ui_app_create', app.create)).revision;
    for (const screen of app.screens) {
        if (screen.name === 'home') continue;
        const { root: _root, ...declared } = screen;
        revision = (await step('ui_screen_create', { app: app.name, expectedRevision: revision, ...declared, root: { component: 'panel' } })).revision;
    }
    for (const screen of app.screens) {
        revision = (await step('ui_nodes_write', { app: app.name, screen: screen.name, expectedRevision: revision, operations: [{ op: 'set', path: 'root', value: screen.root }] })).revision;
    }
    if (app.logic !== undefined) {
        revision = (await step('ui_logic_write', { app: app.name, expectedRevision: revision, operations: Object.entries(app.logic).map(([unit, value]) => ({ op: 'set', unit, value })) })).revision;
    }
    const checked = await step('ui_validate', { app: app.name });
    const errors = checked.errors ?? [];
    const warnings = checked.warnings ?? [];
    for (const warning of warnings.filter((entry) => entry.code !== 'SUI-STATE-LABEL')) console.warn(`  warning ${warning.code}: ${warning.message}`);
    if (!checked.valid) {
        console.error(`${app.name} is not valid:\n${JSON.stringify(errors, null, 2).slice(0, 6000)}`);
        await client.close();
        process.exit(1);
    }
    const preview = await step('ui_preview', { app: app.name });
    console.log(`  ${app.name}: revision ${checked.revision}, ${preview.rendered ? 'rendered' : 'not rendered (is the view server running?)'}\n  ${preview.url}`);
    if ((preview.errors ?? []).length > 0) console.warn(`  runtime errors: ${JSON.stringify(preview.errors).slice(0, 2000)}`);
    // --shots: a picture of every screen in ./shots, to look the build over
    if (process.argv.includes('--shots') && preview.rendered) {
        mkdirSync(resolve(here, 'shots'), { recursive: true });
        for (const screen of app.screens) {
            const shot = await client.callTool({ name: 'ui_screenshot', arguments: { app: app.name, screen: screen.name, fullPage: true } });
            const image = shot.content.find((item) => item.type === 'image');
            if (image !== undefined) writeFileSync(resolve(here, 'shots', `${app.name}-${screen.name}.png`), Buffer.from(image.data, 'base64'));
            else console.warn(`  no picture of ${screen.name}: ${shot.content.find((item) => item.type === 'text')?.text?.slice(0, 300)}`);
        }
    }
}

await client.close();
console.log('done');
