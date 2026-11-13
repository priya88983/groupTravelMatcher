import 'dotenv/config';
import { seedAll, demoEmailFor } from '../src/services/seedService.js';
import { listInterests } from '../src/data/interestsCatalog.js';

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD;

  if (!password || password.length < 8) {
    console.error(
      '[seed] SEED_DEMO_PASSWORD environment variable is required (at least 8 characters).',
    );
    console.error('[seed] Set it, e.g. in PowerShell:  $env:SEED_DEMO_PASSWORD = "your-secure-demo-password"');
    process.exit(1);
  }

  const result = await seedAll(password);

  console.log('[seed] Demo accounts use the pattern <first.last>@example.com');
  console.log(`[seed] Example demo login: email=sarah.thomas@example.com, password=<SEED_DEMO_PASSWORD>`);
  console.log('[seed] Summary:', JSON.stringify(result));

  if (listInterests().length === 0) {
    throw new Error('Interests catalog is empty');
  }
}

main().catch((error) => {
  console.error('[seed] Failed:', error.message);
  process.exit(1);
});
