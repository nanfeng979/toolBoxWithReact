import { SceneNode } from '../types';

export const imageCache: Record<string, HTMLImageElement> = {};

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

export async function preloadImages(node: SceneNode, scenePath: string) {
  const p = node.props || {};
  const skin = p.skin || p.texture;
  
  if ((node.type === 'Image' || node.type === 'Sprite') && skin && !imageCache[skin]) {
    const url = await resolveAssetUrl(scenePath, skin);
    await new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => { imageCache[skin] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = url;
    });
  }
  
  if (node.child) {
    for (const c of node.child) {
      await preloadImages(c, scenePath);
    }
  }
}
