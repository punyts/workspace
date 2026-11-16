// Checks the compose stack end to end: an app made at magnetic-1, written through a view there, and viewed and written
// through magnetic-2, whose view is tunnelled to magnetic-1 over the mesh.
//   docker compose -f docker/statenet.compose.yml cp docker/session.mjs magnetic-2:/punyts/docker/session.mjs
//   docker compose -f docker/statenet.compose.yml exec magnetic-2 node docker/session.mjs tester   (prints the cookie)
//   node docker/check.mjs '<cookie>'
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const cookie = process.argv[2];
const one = process.env.MAGNETIC_ONE ?? 'http://127.0.0.1:4401';
const two = process.env.MAGNETIC_TWO ?? 'http://127.0.0.1:4402';
if (cookie === undefined) throw new Error('Give the session cookie: node docker/check.mjs magnetic_session=...');

const made = await fetch(`${one}/new`, { method: 'POST', headers: { Cookie: cookie, Origin: one, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: `compose-${Date.now()}` }).toString() });
if (made.status !== 201) throw new Error(`POST /new at magnetic-1: ${made.status} ${await made.text()}`);
const { id } = await made.json();

/** A view at a server: welcomed, with every frame it is sent */
async function view(origin) {
    const html = await (await fetch(`${origin}/apps/${id}`, { headers: { Cookie: cookie } })).text();
    const namespace = /data-namespace="([^"]+)"/.exec(html)?.[1];
    const ws = new WebSocket(`${origin.replace('http', 'ws')}/apps/${id}/sync?view=${randomUUID()}`, { headers: { Origin: origin, Cookie: cookie } });
    const frames = [];
    const waiting = [];
    ws.on('message', (data) => {
        const frame = JSON.parse(data.toString());
        frames.push(frame);
        for (const wait of [...waiting]) if (wait.test(frame)) {
            waiting.splice(waiting.indexOf(wait), 1);
            wait.resolve(frame);
        }
    });
    const next = (test, what) =>
        new Promise((resolve, reject) => {
            const seen = frames.find(test);
            if (seen !== undefined) return resolve(seen);
            const timer = setTimeout(() => reject(new Error(`${origin}: no ${what} in 10 s`)), 10_000);
            waiting.push({ test, resolve: (frame) => (clearTimeout(timer), resolve(frame)) });
        });
    await new Promise((resolve, reject) => (ws.once('open', resolve), ws.once('error', reject)));
    ws.send(JSON.stringify({ type: 'hello', namespace, revision: 0, clientId: randomUUID(), protocol: 2 }));
    const welcome = await next((frame) => frame.type === 'welcome', 'welcome');
    const write = async (path, value) => {
        const change = { id: randomUUID(), op: 'set', path, value, base: welcome.revision };
        ws.send(JSON.stringify({ type: 'change', change }));
        return next((frame) => frame.type === 'ack' && frame.id === change.id, 'ack');
    };
    return { ws, frames, welcome, write, next };
}

const atOne = await view(one);
const first = await atOne.write('$.app.from', 'magnetic-1');
const atTwo = await view(two);
const second = await atTwo.write('$.app.reply', 'magnetic-2');
await atOne.next((frame) => frame.type === 'changes' && JSON.stringify(frame).includes('app.reply'), 'change from magnetic-2');

const checks = {
    'the write at magnetic-1 was applied': first.result === 'applied',
    'the view at magnetic-2 got the state magnetic-1 holds': JSON.stringify(atTwo.welcome).includes('magnetic-1'),
    'the write at magnetic-2 was applied': second.result === 'applied',
    'the view at magnetic-1 saw the write made at magnetic-2': true
};
for (const [check, ok] of Object.entries(checks)) process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${check}\n`);
process.stdout.write(`app ${id}\n`);
atOne.ws.close();
atTwo.ws.close();
if (Object.values(checks).some((ok) => !ok)) process.exitCode = 1;
