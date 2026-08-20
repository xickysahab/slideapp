import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

/**
 * Object storage for resumes — DEMO-02.
 *
 * Backed by Supabase Storage, which Demo Architecture §1 lists as the sanctioned alternative to a
 * private S3 bucket. Talks to the REST API over `fetch` rather than pulling in the Supabase client
 * SDK: it is two signing endpoints and a download, the dependency would not earn its weight, and
 * keeping the HTTP calls explicit makes the eventual swap to real S3 a clearly-scoped change.
 *
 * Rules this service exists to enforce (Demo Security Baseline §1):
 *  - The bucket is private. Nothing is ever served from a public URL.
 *  - Both upload and download go through short-lived signed URLs.
 *  - The service-role key never leaves the backend — the client only ever receives a signed URL.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly baseUrl: string;
  private readonly serviceKey: string;
  private readonly bucket: string;

  /** Download links live just long enough to open a resume, not to be shared onward. */
  static readonly DOWNLOAD_TTL_SECONDS = 300;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('SUPABASE_URL').replace(/\/+$/, '');
    this.serviceKey = config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

  /**
   * Object key for a candidate's resume.
   *
   * Namespaced by user id, with a random filename rather than the uploaded one. Two reasons: the
   * original filename is attacker-controlled text, and a predictable key would let someone guess at
   * other people's objects even though the bucket is private.
   */
  buildResumeKey(userId: string): string {
    return `${userId}/${randomUUID()}.pdf`;
  }

  /**
   * Signed URL the client PUTs the PDF straight to, so the file never transits the API process.
   * The returned token is single-use and scoped to exactly this object key.
   */
  async createSignedUploadUrl(key: string): Promise<{ uploadUrl: string; key: string }> {
    const body = await this.request<{ url: string }>(
      'POST',
      `/storage/v1/object/upload/sign/${this.bucket}/${key}`,
    );
    return { uploadUrl: `${this.baseUrl}/storage/v1${body.url}`, key };
  }

  /** Short-lived signed URL for reading an object. */
  async createSignedDownloadUrl(
    key: string,
    expiresIn: number = StorageService.DOWNLOAD_TTL_SECONDS,
  ): Promise<string> {
    const body = await this.request<{ signedURL: string }>(
      'POST',
      `/storage/v1/object/sign/${this.bucket}/${key}`,
      { expiresIn },
    );
    return `${this.baseUrl}/storage/v1${body.signedURL}`;
  }

  /** Pulls the object into memory so the resume parser can read it (Architecture §6 step 2). */
  async downloadObject(key: string): Promise<Buffer> {
    const res = await fetch(`${this.baseUrl}/storage/v1/object/${this.bucket}/${key}`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      this.logger.error(`Download failed for ${key}: ${res.status} ${await res.text()}`);
      throw new InternalServerErrorException('Could not read the stored file');
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Removes the object itself, not just a database reference. Deleting a row and orphaning the file
   * is the failure mode the full Security doc's deletion pipeline exists to prevent, and it costs
   * nothing to get right from the start.
   */
  async deleteObject(key: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/storage/v1/object/${this.bucket}/${key}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    if (!res.ok && res.status !== 404) {
      this.logger.error(`Delete failed for ${key}: ${res.status} ${await res.text()}`);
      throw new InternalServerErrorException('Could not delete the stored file');
    }
  }

  private authHeaders(): Record<string, string> {
    return { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}` };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // The Content-Type header is only sent alongside an actual body: Supabase's gateway rejects
    // `application/json` with an empty body outright, which is exactly the shape of the
    // upload-signing call.
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers:
        body === undefined
          ? this.authHeaders()
          : { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      // Storage errors can echo back the key and the bucket; they belong in logs, not in a
      // response body (Demo Security Baseline §1 — safe error messages).
      this.logger.error(`Storage ${method} ${path} failed: ${res.status} ${await res.text()}`);
      throw new InternalServerErrorException('File storage is unavailable');
    }

    return (await res.json()) as T;
  }
}
