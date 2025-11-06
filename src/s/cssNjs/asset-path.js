const ABSOLUTE_URL_RE = /^(?:[a-zA-Z][a-zA-Z\d+\-.]*:|\/\/)/;

let cachedDefaultBaseUrl = null;
let currentAssetsBaseUrl = null;

function ensureTrailingSlash(url) {
  if (!url || url.endsWith('/')) {
    return url;
  }
  return `${url}/`;
}

function computeDefaultBaseUrl() {
  if (!cachedDefaultBaseUrl) {
    try {
      cachedDefaultBaseUrl = ensureTrailingSlash(new URL('./', import.meta.url).href);
    } catch (error) {
      cachedDefaultBaseUrl = '/';
    }
  }
  return cachedDefaultBaseUrl;
}

export function normalizeAssetsBaseUrl(baseUrl) {
  if (baseUrl == null) {
    return computeDefaultBaseUrl();
  }
  if (baseUrl instanceof URL) {
    return ensureTrailingSlash(baseUrl.href);
  }
  const raw = String(baseUrl).trim();
  if (!raw) {
    return computeDefaultBaseUrl();
  }
  if (ABSOLUTE_URL_RE.test(raw)) {
    return ensureTrailingSlash(raw);
  }
  if (raw.startsWith('/')) {
    return ensureTrailingSlash(raw);
  }
  if (typeof document !== 'undefined' && document.baseURI) {
    return ensureTrailingSlash(new URL(raw, document.baseURI).href);
  }
  try {
    return ensureTrailingSlash(new URL(raw, computeDefaultBaseUrl()).href);
  } catch (error) {
    return ensureTrailingSlash(raw);
  }
}

export function setAssetsBaseUrl(baseUrl) {
  currentAssetsBaseUrl = normalizeAssetsBaseUrl(baseUrl);
  return currentAssetsBaseUrl;
}

export function getAssetsBaseUrl() {
  if (!currentAssetsBaseUrl) {
    currentAssetsBaseUrl = computeDefaultBaseUrl();
  }
  return currentAssetsBaseUrl;
}

export function resolveAssetUrl(relativePath) {
  return resolveAssetUrlFrom(getAssetsBaseUrl(), relativePath);
}

function resolveWithBase(baseUrl, relativePath) {
  if (relativePath == null) {
    return baseUrl;
  }
  const rawPath = String(relativePath).trim();
  if (!rawPath) {
    return baseUrl;
  }
  if (ABSOLUTE_URL_RE.test(rawPath) || rawPath.startsWith('/')) {
    return rawPath;
  }
  try {
    return new URL(rawPath, baseUrl).href;
  } catch (error) {
    const normalizedPath = rawPath.replace(/^\.\//, '');
    return `${ensureTrailingSlash(baseUrl)}${normalizedPath}`;
  }
}

export function resolveAssetUrlFrom(baseUrl, relativePath) {
  const normalizedBase = normalizeAssetsBaseUrl(baseUrl);
  return resolveWithBase(normalizedBase, relativePath);
}

export function resetAssetsBaseUrlForTests() {
  currentAssetsBaseUrl = computeDefaultBaseUrl();
}
