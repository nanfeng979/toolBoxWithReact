import { ASSET_EXPLORER_LAYOUT_STORAGE_KEY } from './assetExplorerConstants';

export function readAssetExplorerLayoutPreference() {
  try {
    const raw = localStorage.getItem(ASSET_EXPLORER_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { projectPaneWidth?: unknown };
    return typeof parsed.projectPaneWidth === 'number' ? parsed.projectPaneWidth : null;
  } catch {
    return null;
  }
}

export function saveAssetExplorerLayoutPreference(projectPaneWidth: number) {
  try {
    localStorage.setItem(
      ASSET_EXPLORER_LAYOUT_STORAGE_KEY,
      JSON.stringify({ projectPaneWidth })
    );
  } catch {
    // Ignore storage failures.
  }
}
