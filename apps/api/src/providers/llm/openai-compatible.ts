export interface OpenAiCompatibleAdapterConfig {
  providerId: string;
  modelId: string;
  baseUrl: URL;
  profile: 'hosted' | 'self_hosted_loopback';
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)))
    return false;
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

export function validateOpenAiCompatibleBaseUrl(
  raw: string,
  profile: OpenAiCompatibleAdapterConfig['profile'],
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('INVALID_PROVIDER_BASE_URL');
  }
  if (url.username || url.password || url.hash || url.search)
    throw new Error('INVALID_PROVIDER_BASE_URL');
  const host = url.hostname.toLowerCase();
  const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  const ipv6 = host.replace(/^\[|\]$/gu, '');
  const privateIpv6 =
    /^f[cd][0-9a-f]{2}:/u.test(ipv6) || /^fe[89ab][0-9a-f]:/u.test(ipv6);
  if (profile === 'self_hosted_loopback') {
    if (!loopback || url.protocol !== 'http:')
      throw new Error('INVALID_PROVIDER_BASE_URL');
  } else if (
    url.protocol !== 'https:' ||
    loopback ||
    isPrivateIpv4(host) ||
    privateIpv6 ||
    host === '0.0.0.0'
  )
    throw new Error('INVALID_PROVIDER_BASE_URL');
  return url;
}
