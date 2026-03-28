import { SceneNode } from '../types/scene';

export const imageCache: Record<string, HTMLImageElement> = {};

async function canAccessFile(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function normalizeSceneAssetPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '');
}

export async function resolveAssetUrl(scenePath: string, skinName: string) {
  const parts = scenePath.split('/');
  parts.pop();
  while (parts.length > 0) {
    const testUrl = 'workspace-file://' + parts.join('/') + '/Laya/assets/' + skinName;
    try {
      const res = await fetch(testUrl, { method: 'HEAD' });
      if (res.ok) return testUrl;
    } catch (e) {}
    parts.pop();
  }
  return 'workspace-file://' + scenePath.split('/').slice(0, -1).join('/') + '/' + skinName;
}

export async function resolveSceneBgUrl(scenePath: string, sceneBgPath: string) {
  const normalizedBg = normalizeSceneAssetPath(sceneBgPath);
  const sceneDirParts = scenePath.split('/');
  sceneDirParts.pop();

  // Prefer laya-prefixed path resolution: find laya parent upward, then append remainder.
  if (/^laya\//i.test(normalizedBg)) {
    const remainder = normalizedBg.replace(/^laya\//i, '');

    // Strategy A: if scene is already under a Laya/laya folder, reuse that folder as root.
    for (let i = sceneDirParts.length - 1; i >= 0; i -= 1) {
      if (sceneDirParts[i].toLowerCase() === 'laya') {
        const layaRoot = sceneDirParts.slice(0, i + 1).join('/');
        const directUrl = 'workspace-file://' + layaRoot + '/' + remainder;
        if (await canAccessFile(directUrl)) return directUrl;
        break;
      }
    }

    // Strategy B: go upward and probe <parent>/Laya and <parent>/laya.
    for (let end = sceneDirParts.length; end > 0; end -= 1) {
      const parent = sceneDirParts.slice(0, end).join('/');
      const candidates = [
        'workspace-file://' + parent + '/Laya/' + remainder,
        'workspace-file://' + parent + '/laya/' + remainder
      ];

      for (const candidate of candidates) {
        if (await canAccessFile(candidate)) return candidate;
      }
    }
  }

  // Fallback: treat sceneBg as relative path from current scene directory.
  return 'workspace-file://' + sceneDirParts.join('/') + '/' + normalizedBg;
}

async function preloadImageToCache(cacheKey: string, url: string) {
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      imageCache[cacheKey] = img;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

export async function preloadImages(node: SceneNode, scenePath: string) {
  const p = node.props || {};
  const skin = p.skin || p.texture;
  const sceneBg = typeof p.sceneBg === 'string' ? p.sceneBg : '';

  if ((node.type === 'Image' || node.type === 'Sprite') && skin && !imageCache[skin]) {
    const url = await resolveAssetUrl(scenePath, skin);
    await preloadImageToCache(skin, url);
  }

  if ((node.type === 'Scene' || node.type === 'View' || node.type === 'Dialog') && sceneBg && !imageCache[sceneBg]) {
    const bgUrl = await resolveSceneBgUrl(scenePath, sceneBg);
    await preloadImageToCache(sceneBg, bgUrl);
  }

  if (node.child) {
    for (const c of node.child) {
      await preloadImages(c, scenePath);
    }
  }
}
