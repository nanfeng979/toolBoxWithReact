export function normalizeSlashes(input: string) {
  return input.replace(/\\/g, '/');
}

export function trimTrailingSlash(input: string) {
  return input.replace(/\/+$/g, '');
}

export function joinPath(base: string, next: string) {
  const normalizedBase = trimTrailingSlash(normalizeSlashes(base));
  const normalizedNext = next.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedNext}`;
}

export function dirname(input: string) {
  const normalized = trimTrailingSlash(normalizeSlashes(input));
  const idx = normalized.lastIndexOf('/');
  if (idx < 0) return '';
  if (idx === 0) return '/';
  return normalized.slice(0, idx);
}

export function basename(input: string) {
  const normalized = trimTrailingSlash(normalizeSlashes(input));
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export function extname(fileName: string) {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return '';
  return fileName.slice(idx).toLowerCase();
}

export function stripExt(fileName: string) {
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return fileName;
  return fileName.slice(0, idx);
}

export function normalizeForCompare(input: string) {
  return normalizeSlashes(input).toLowerCase();
}

export function isWithinRoot(targetPath: string, rootPath: string) {
  const target = normalizeForCompare(trimTrailingSlash(targetPath));
  const root = normalizeForCompare(trimTrailingSlash(rootPath));
  return target === root || target.startsWith(`${root}/`);
}

export function canGoParent(currentPath: string, rootPath: string) {
  if (!currentPath || !rootPath) return false;
  return normalizeForCompare(trimTrailingSlash(currentPath)) !== normalizeForCompare(trimTrailingSlash(rootPath));
}

export function toAssetUrl(absPath: string) {
  const normalized = normalizeSlashes(absPath).replace(/^\/+/, '');
  return `asset://local/${encodeURI(normalized)}`;
}

export function findLayaAssetsFolder(sceneFilePath: string) {
  if (!sceneFilePath) return '';
  const normalized = normalizeSlashes(sceneFilePath);
  const parts = normalized.split('/').filter((p) => p.length > 0);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i].toLowerCase() === 'laya') {
      const prefix = parts.slice(0, i + 1).join('/');
      const hasDrive = /^[a-zA-Z]:$/.test(parts[0]);
      const root = hasDrive ? prefix : `/${prefix}`;
      return `${root}/assets`;
    }
  }

  return '';
}

export function toProjectTemporaryFolderKey(path: string) {
  return `tmp:${normalizeSlashes(path)}`;
}

export function getProjectRelativePath(rootPath: string, targetPath: string) {
  const root = trimTrailingSlash(normalizeSlashes(rootPath));
  const target = trimTrailingSlash(normalizeSlashes(targetPath));
  if (!root || !target) return '';
  if (normalizeForCompare(root) === normalizeForCompare(target)) return '';
  const prefix = `${root}/`;
  if (!normalizeForCompare(target).startsWith(normalizeForCompare(prefix))) return '';
  return target.slice(prefix.length);
}

export function getNormalizedWidth(value: number, minWidth: number, maxWidth: number) {
  if (!Number.isFinite(value) || value <= 0) return minWidth;
  return Math.max(minWidth, Math.min(maxWidth, value));
}
