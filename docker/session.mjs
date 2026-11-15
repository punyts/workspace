// Signs a test person in for the compose stack, whose servers have no development sign-in, and prints the cookie.
// docker compose -f docker/statenet.compose.yml exec magnetic-2 node docker/session.mjs <name>
import { createDatabase } from '@punyts/stateui-pg';
import { Accounts } from '../magnetic/dist/accounts/Accounts.js';
import { Sessions } from '../magnetic/dist/accounts/Sessions.js';

const name = process.argv[2] ?? 'tester';
const db = createDatabase({ url: process.env.MAGNETIC_DATABASE_URL });
try {
    const user = await new Accounts(db).signIn({ provider: 'compose', subject: name }, { name });
    const token = await new Sessions(db).start(user.id);
    process.stdout.write(`magnetic_session=${token} ${user.id}\n`);
} finally {
    await db.close();
}
