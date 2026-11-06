#!/usr/bin/env node
// bin/workspace.mjs: clone, build, test and report on the library repos of the workspace.
// Plain Node and git, so it runs the same from cmd, PowerShell, Git Bash, macOS and Linux.
//
// The repos are the npm `workspaces` of package.json, in build order (a library comes after the libraries it builds
// on). stateui-app and stateui-components need each other: stateui-app builds first against the components' last
// dist, and stateui-components builds its catalog against stateui-app.
//
// Usage:
//   node bin/workspace.mjs clone [branch]            clone the repos that are not here yet (default branch: develop)
//   node bin/workspace.mjs run <script> [library...] run an npm script in each library that has it; stops at a failure
//   node bin/workspace.mjs status                    branch, changed files and unpushed commits of every repo
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPOS = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).workspaces;
const isWindows = process.platform === 'win32';

/** Runs a command with inherited output and exits with its code when it fails */
function run(command, args, cwd) {
    // npm is npm.cmd on Windows, which only starts through a shell; one command string avoids Node's warning about
    // passing arguments with shell: true (the arguments here are script and library names, never user text)
    const viaShell = isWindows && command === 'npm';
    const result = viaShell
        ? spawnSync([command, ...args].join(' '), { cwd, stdio: 'inherit', shell: true })
        : spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Runs git and returns its trimmed output, or undefined when it fails */
function git(cwd, args) {
    const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() : undefined;
}

function clone(branch = 'develop') {
    for (const lib of REPOS) {
        if (existsSync(join(ROOT, lib, '.git'))) {
            console.log(`${lib} already cloned.`);
            continue;
        }
        console.log(`Cloning ${lib} (branch: ${branch})...`);
        run('git', ['clone', '--branch', branch, `https://github.com/punyts/${lib}.git`, lib], ROOT);
    }
}

function runScript(script, libs) {
    if (!script) {
        console.error('Usage: node bin/workspace.mjs run <script> [library...]');
        process.exit(1);
    }
    for (const lib of libs.length > 0 ? libs : REPOS) {
        const packageJson = join(ROOT, lib, 'package.json');
        if (!existsSync(packageJson)) {
            console.error(`== ${lib}: not cloned (run npm run clone)`);
            process.exit(1);
        }
        if (JSON.parse(readFileSync(packageJson, 'utf8')).scripts?.[script] === undefined) {
            console.log(`== ${lib}: no ${script} script`);
            continue;
        }
        console.log(`== ${lib}: npm run ${script}`);
        run('npm', ['run', script], join(ROOT, lib));
    }
}

function status() {
    for (const lib of ['.', ...REPOS]) {
        const dir = join(ROOT, lib);
        if (!existsSync(join(dir, '.git'))) {
            console.log(`${lib.padEnd(20)} not cloned`);
            continue;
        }
        const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? '?';
        const changed = (git(dir, ['status', '--porcelain']) ?? '').split('\n').filter(Boolean).length;
        const ahead = git(dir, ['rev-list', '--count', '@{u}..HEAD']) ?? '?';
        console.log(`${lib.padEnd(20)} ${branch.padEnd(12)} changed ${String(changed).padEnd(4)} ahead ${ahead}`);
    }
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
    case 'clone':
        clone(args[0]);
        break;
    case 'run':
        runScript(args[0], args.slice(1));
        break;
    case 'status':
        status();
        break;
    default:
        console.error('Usage: node bin/workspace.mjs clone [branch] | run <script> [library...] | status');
        process.exit(1);
}
