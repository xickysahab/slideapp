import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { StorageService } from '../src/shared/storage/storage.service';

/**
 * DEMO-02 acceptance check, kept as a re-runnable script rather than a one-off.
 *
 * Does the whole round trip against real storage — sign an upload URL, PUT a file through it, sign
 * a download URL, read the bytes back, verify they match, then clean up. A test that only asserts
 * "a URL was returned" would pass against a completely broken bucket.
 *
 * Worth re-running after DEMO-20, when the deployed backend gets its own environment variables.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/verify-storage.ts
 */

// Smallest structurally valid PDF — enough for the bucket's application/pdf restriction to accept.
const TEST_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
trailer<</Root 1 0 R>>
%%EOF`,
  'utf8',
);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const storage = app.get(StorageService);

  const key = storage.buildResumeKey('00000000-0000-0000-0000-000000000000');
  let uploaded = false;

  try {
    const { uploadUrl } = await storage.createSignedUploadUrl(key);
    console.log('signed PUT url   :', uploadUrl.split('?')[0] + '?token=…');

    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: new Uint8Array(TEST_PDF),
    });
    if (!put.ok) throw new Error(`upload failed: ${put.status} ${await put.text()}`);
    uploaded = true;
    console.log('upload           : HTTP', put.status);

    const downloadUrl = await storage.createSignedDownloadUrl(key);
    console.log('signed GET url   :', downloadUrl.split('?')[0] + '?token=…');

    const get = await fetch(downloadUrl);
    const bytes = Buffer.from(await get.arrayBuffer());
    console.log('download         : HTTP', get.status, `${bytes.length} bytes`);

    if (!bytes.equals(TEST_PDF)) throw new Error('downloaded bytes differ from what was uploaded');
    console.log('round trip       : bytes match');

    // The bucket must not be readable without a token — that's the whole point of it being private.
    const unsigned = await fetch(downloadUrl.split('?')[0]);
    console.log('unsigned GET     : HTTP', unsigned.status, unsigned.ok ? '!! PUBLICLY READABLE' : '(correctly refused)');
    if (unsigned.ok) throw new Error('bucket is publicly readable');

    console.log('\nDEMO-02 acceptance: PASS');
  } finally {
    if (uploaded) {
      await storage.deleteObject(key);
      console.log('cleanup          : test object deleted');
    }
    await app.close();
  }
}

main().catch((err) => {
  console.error('\nDEMO-02 acceptance: FAIL\n', err.message);
  process.exit(1);
});
