// Deploys Magnetic to the AWS stack (docs/design/magnetic-hosting.md, H3): builds the image from the workspace, pushes
// it to ECR, and through Session Manager puts the compose files on the host and runs infra/aws/host-deploy.sh there.
//   node infra/aws/deploy.mjs            (with the magnetic SSO profile signed in: aws sso login --profile magnetic)
// Plain Node, like the workspace scripts, so it runs from cmd, PowerShell and bash.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REGION = 'us-east-2';
const STACK = 'magnetic';
/** Who runs the service and where privacy requests go, for /privacy */
const OPERATOR = 'Rodger McIntosh';
const CONTACT = 'rodger@ai-minion.com';
const env = { ...process.env, AWS_PROFILE: process.env.AWS_PROFILE ?? 'magnetic', AWS_REGION: REGION, MSYS_NO_PATHCONV: '1' };

/** Runs a command and answers its output; its errors go to the console */
function run(command, args, options = {}) {
    return execFileSync(command, args, { cwd: ROOT, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024, ...options })?.trim() ?? '';
}
const aws = (...args) => JSON.parse(run('aws', [...args, '--output', 'json']) || 'null');
const step = (text) => process.stdout.write(`\n== ${text}\n`);

step('the stack');
const outputs = Object.fromEntries(aws('cloudformation', 'describe-stacks', '--stack-name', STACK).Stacks[0].Outputs.map((output) => [output.OutputKey, output.OutputValue]));
const repository = outputs.RepositoryUri;
process.stdout.write(`${outputs.InstanceId} at ${outputs.PublicIp}, image ${repository}\n`);

step('the image');
const commit = run('git', ['rev-parse', '--short', 'HEAD']);
const dirty = ['.', 'core', 'expression', 'state', 'state-sync', 'statenet', 'stateui', 'stateui-3d', 'stateui-app', 'stateui-components', 'stateui-mcp', 'stateui-pg', 'magnetic'].some((dir) => run('git', ['-C', dir, 'status', '--porcelain']) !== '');
const tag = `${commit}${dirty ? '-dirty' : ''}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
const image = `${repository}:${tag}`;
run('docker', ['build', '-f', 'docker/Dockerfile', '-t', image, '.'], { stdio: 'inherit' });
// The login gets a Docker config of its own: Windows' credential store refuses ECR's long token ("The stub received
// bad data"), so it is kept in this folder's file for the push and the folder is deleted after
const dockerConfig = mkdtempSync(join(tmpdir(), 'magnetic-ecr-'));
try {
    // Written as `auths` rather than through `docker login`: a config that already holds a login keeps Docker from
    // picking the platform's credential store
    const password = run('aws', ['ecr', 'get-login-password']);
    const auth = Buffer.from(`AWS:${password}`).toString('base64');
    writeFileSync(join(dockerConfig, 'config.json'), JSON.stringify({ auths: { [repository.split('/')[0]]: { auth } } }), { mode: 0o600 });
    run('docker', ['push', '--quiet', image], { stdio: 'inherit', env: { ...env, DOCKER_CONFIG: dockerConfig } });
} finally {
    rmSync(dockerConfig, { recursive: true, force: true });
}

step('the host');
const files = {
    'magnetic.compose.yml': 'docker/magnetic.compose.yml',
    'magnetic.aws.compose.yml': 'docker/magnetic.aws.compose.yml',
    Caddyfile: 'docker/Caddyfile',
    'host-deploy.sh': 'infra/aws/host-deploy.sh'
};
const quote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const commands = [
    'set -eu',
    'mkdir -p /opt/magnetic/docker',
    ...Object.entries(files).map(([name, path]) => `echo ${readFileSync(new URL(`../../${path}`, import.meta.url)).toString('base64')} | base64 -d > /opt/magnetic/docker/${name}`),
    `bash /opt/magnetic/docker/host-deploy.sh ${[image, outputs.DatabaseEndpoint, outputs.DatabaseMasterSecretArn, outputs.AppDbPasswordArn, outputs.SecretKeyArn, OPERATOR, CONTACT].map(quote).join(' ')}`
];
const sent = aws('ssm', 'send-command', '--instance-ids', outputs.InstanceId, '--document-name', 'AWS-RunShellScript', '--comment', `deploy ${tag}`, '--timeout-seconds', '600', '--parameters', JSON.stringify({ commands, executionTimeout: ['1800'] }));
const commandId = sent.Command.CommandId;
let invocation;
for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
        invocation = aws('ssm', 'get-command-invocation', '--command-id', commandId, '--instance-id', outputs.InstanceId);
    } catch {
        continue;
    }
    if (!['Pending', 'InProgress', 'Delayed'].includes(invocation.Status)) break;
    process.stdout.write('.');
}
process.stdout.write(`\n${invocation.StandardOutputContent}`);
if (invocation.StandardErrorContent) process.stdout.write(`\n-- stderr\n${invocation.StandardErrorContent}`);
process.stdout.write(`\n${invocation.Status}: ${image}\n`);
if (invocation.Status !== 'Success') process.exitCode = 1;
