import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import type { AssetRecord, AssetService } from '@/features/assets/service';
import type { CredentialService } from '@/features/credential/service';
import { executeHttpRequest } from './http-client';
import type { HttpClientRequest, HttpClientSettings } from './protocol';

interface HttpClientAsset extends AssetRecord, HttpClientSettings {
  type: 'httpClient';
  credentialId: string;
}

export class HttpClientService implements AssetProvider {
  readonly type = 'httpClient';
  readonly label = 'HTTP Client';
  readonly icon = 'globe';
  readonly capabilities = { httpClient: true };

  constructor(
    private readonly assets: AssetService,
    private readonly credentials: CredentialService,
  ) {}

  getFormValues(record?: AssetRecord): AssetFormValues {
    const asset = record ? requireHttpClient(record) : undefined;
    return {
      name: asset?.name ?? '',
      description: record?.description ?? '',
      host: '',
      port: 443,
      database: '',
      tls: true,
      enableAI: record?.enableAI !== false,
      storageScope: record?.scope ?? 'global',
      credentialId: asset?.credentialId ?? '',
      httpClient: {
        baseUrl: asset?.baseUrl ?? '',
        headers: asset?.headers ?? {},
        authType: asset?.authType ?? 'none',
        apiKeyName: asset?.apiKeyName ?? 'X-API-Key',
        apiKeyLocation: asset?.apiKeyLocation ?? 'header',
        timeoutMs: asset?.timeoutMs ?? 60000,
      },
    };
  }

  async saveConfiguration(values: AssetFormValues, previous?: AssetRecord, folder?: string): Promise<void> {
    if (!values.httpClient) throw new Error('HTTP client settings are required.');
    const asset = requireHttpClient({
      ...values.httpClient,
      id: previous?.id ?? randomUUID(),
      type: this.type,
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      baseUrl: values.httpClient.baseUrl.trim(),
      credentialId: values.credentialId,
      enableAI: values.enableAI,
      scope: values.storageScope,
      folder: previous?.folder ?? folder,
    });
    if (!asset.name) throw new Error('Name is required.');
    if (asset.authType !== 'none') await this.requireCredential(asset);
    await this.assets.save(asset);
  }

  toViewEntry(record: AssetRecord): AssetViewEntry {
    const asset = requireHttpClient(record);
    return {
      path: asset.id,
      name: asset.name,
      type: 'file',
      detail: asset.baseUrl,
      context: { assetId: asset.id, assetType: this.type },
    };
  }

  async execute(record: AssetRecord, request: AssetRequest): Promise<void> {
    if (request.action !== 'connect') return;
    const asset = requireHttpClient(record);
    await vscode.commands.executeCommand('toolkit.assets.edit', { assetId: asset.id });
  }

  async send(input: HttpClientRequest, signal: AbortSignal) {
    const asset = requireHttpClient(await this.assets.requireAiAsset(input.id));
    const base = new URL(asset.baseUrl);
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const url = new URL(input.path, base);
    if (url.origin !== base.origin || url.username || url.password) {
      throw new Error('Request path must resolve to the HTTP client origin without URL credentials.');
    }
    for (const [key, value] of Object.entries(input.query ?? {})) url.searchParams.set(key, value);
    const headers = new Headers(asset.headers);
    new Headers(input.headers).forEach((value, key) => headers.set(key, value));
    if (asset.authType !== 'none') {
      const credential = await this.requireCredential(asset);
      const secret = credential.password ?? '';
      if (asset.authType === 'basic') {
        headers.set(
          'Authorization',
          `Basic ${Buffer.from(`${credential.username ?? ''}:${secret}`).toString('base64')}`,
        );
      } else if (asset.authType === 'bearer') {
        headers.set('Authorization', `Bearer ${secret}`);
      } else if (asset.apiKeyLocation === 'query') {
        url.searchParams.set(asset.apiKeyName, secret);
      } else {
        headers.set(asset.apiKeyName, secret);
      }
    }
    const method = (input.method ?? 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)) {
      throw new Error('Unsupported HTTP method.');
    }
    if ((method === 'GET' || method === 'HEAD') && input.body !== undefined) {
      throw new Error('GET and HEAD requests cannot have a body.');
    }
    const response = await executeHttpRequest(
      { method, url: url.href, headers: Object.fromEntries(headers), body: input.body },
      { signal, timeoutMs: asset.timeoutMs, redirect: 'error' },
    );
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
      durationMs: response.durationMs,
      sizeBytes: response.sizeBytes,
    };
  }

  private async requireCredential(asset: HttpClientAsset) {
    const credential = (await this.credentials.list()).find((entry) => entry.id === asset.credentialId);
    if (!credential || credential.type !== 'password' || !credential.password) {
      throw new Error('Select a password credential for HTTP authentication.');
    }
    return credential;
  }

  invalidate(): void {}

  dispose(): void {}
}

function requireHttpClient(
  record: AssetRecord & Partial<HttpClientSettings> & { credentialId?: string },
): HttpClientAsset {
  const asset = record as HttpClientAsset;
  if (
    asset.type !== 'httpClient' ||
    typeof asset.baseUrl !== 'string' ||
    !['none', 'basic', 'bearer', 'apiKey'].includes(asset.authType) ||
    !['header', 'query'].includes(asset.apiKeyLocation) ||
    typeof asset.apiKeyName !== 'string' ||
    typeof asset.credentialId !== 'string' ||
    !Number.isInteger(asset.timeoutMs) ||
    asset.timeoutMs < 1 ||
    asset.timeoutMs > 300000 ||
    !asset.headers ||
    typeof asset.headers !== 'object' ||
    Array.isArray(asset.headers) ||
    !Object.values(asset.headers).every((value) => typeof value === 'string')
  )
    throw new Error('Invalid HTTP client configuration.');
  const url = new URL(asset.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new Error('Base URL must be HTTP(S), without credentials, query parameters or a fragment.');
  }
  new Headers(asset.headers);
  if (asset.authType === 'apiKey') {
    if (!asset.apiKeyName.trim()) throw new Error('API key name is required.');
    if (asset.apiKeyLocation === 'header') new Headers({ [asset.apiKeyName]: 'validate' });
  }
  return asset;
}
