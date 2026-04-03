import { SceneNode } from '../../types/scene';
import { DirWatchChange, HostApiEntryItem } from './AssetExplorerTypes';
import { dirname, normalizeForCompare } from './assetExplorerPathUtils';

export function sortEntries(entries: HostApiEntryItem[]) {
  return [...entries].sort((a, b) => {
    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
    return a.isDirectory ? -1 : 1;
  });
}

export function applyDirChanges(entries: HostApiEntryItem[], changes: DirWatchChange[]) {
  const map = new Map<string, HostApiEntryItem>();
  entries.forEach((entry) => {
    map.set(normalizeForCompare(entry.path), entry);
  });

  changes.forEach((change) => {
    const key = normalizeForCompare(change.path);
    if (change.op === 'remove') {
      map.delete(key);
      return;
    }

    if (change.entry) {
      map.set(normalizeForCompare(change.entry.path), change.entry);
    }
  });

  return sortEntries([...map.values()]);
}

export function collectSkinFolders(sceneNode: SceneNode | null) {
  const folders = new Set<string>();
  const visit = (node: SceneNode | null) => {
    if (!node) return;
    const props = node.props || {};
    const isImageLike = node.type === 'Image' || node.type === 'Sprite';
    const skin = isImageLike && typeof props.skin === 'string' ? props.skin.trim() : '';
    if (skin) {
      const folder = dirname(skin);
      if (folder && folder !== '.' && folder !== '/') {
        folders.add(folder.replace(/^\/+/, ''));
      }
    }

    if (Array.isArray(node.child)) {
      node.child.forEach((child) => visit(child));
    }
  };

  visit(sceneNode);
  return [...folders].sort((a, b) => a.localeCompare(b));
}
