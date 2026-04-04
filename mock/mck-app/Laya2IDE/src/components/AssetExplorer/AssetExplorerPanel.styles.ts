import { CSSProperties } from 'react';

export function getAssetExplorerRootStyle(height: number, minHeight: number): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height,
    minHeight,
    background: 'linear-gradient(180deg, rgba(32,33,36,0.96) 0%, rgba(24,25,27,0.96) 100%)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 2
  };
}

export const assetExplorerDropMaskStyle: CSSProperties = {
  position: 'absolute',
  inset: 6,
  borderRadius: 10,
  border: '2px dashed rgba(88, 166, 255, 0.9)',
  background: 'rgba(88, 166, 255, 0.08)',
  boxShadow: '0 0 0 2px rgba(0,0,0,0.35) inset',
  pointerEvents: 'none',
  zIndex: 3
};

export const assetExplorerTitleStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  color: '#c0c0c0',
  borderBottom: '1px solid #333',
  letterSpacing: 0.4
};

export const assetExplorerContentStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0
};

export function getAssetExplorerProjectPaneStyle(hasExternalFolders: boolean, projectPaneWidth: number): CSSProperties {
  if (hasExternalFolders) {
    return {
      width: projectPaneWidth,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    };
  }
  return {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column'
  };
}

export const assetExplorerHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderBottom: '1px solid #333'
};

export const assetExplorerHeaderLeftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flex: '0 0 auto'
};

export const assetExplorerHeaderLabelStyle: CSSProperties = {
  fontSize: 12,
  color: '#b6b6b6',
  flex: '0 0 auto'
};

export const assetExplorerProjectSelectStyle: CSSProperties = {
  background: '#1f2023',
  border: '1px solid #3b3d44',
  color: '#d0d0d0',
  borderRadius: 4,
  fontSize: 12,
  padding: '4px 6px',
  minWidth: 180
};

export const assetExplorerExternalSelectStyle: CSSProperties = {
  background: '#1f2023',
  border: '1px solid #3b3d44',
  color: '#d0d0d0',
  borderRadius: 4,
  fontSize: 12,
  padding: '4px 6px',
  minWidth: 140
};

export const assetExplorerBreadcrumbWrapStyle: CSSProperties = {
  minWidth: 0,
  flex: '1 1 auto'
};

export const assetExplorerExternalActionWrapStyle: CSSProperties = {
  flex: '0 0 auto'
};

export const assetExplorerRemoveButtonStyle: CSSProperties = {
  background: '#2b2d33',
  border: '1px solid #3b3d44',
  color: '#c8c8c8',
  borderRadius: 4,
  fontSize: 12,
  padding: '4px 8px',
  cursor: 'pointer',
  flex: '0 0 auto'
};

export const assetExplorerSplitStyle: CSSProperties = {
  width: 6,
  cursor: 'col-resize',
  background: 'rgba(255,255,255,0.04)',
  borderLeft: '1px solid #333',
  borderRight: '1px solid #333'
};

export const assetExplorerExternalPaneStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column'
};

export const assetExplorerErrorStyle: CSSProperties = {
  padding: '8px 12px',
  borderTop: '1px solid #333',
  background: 'rgba(0,0,0,0.15)',
  fontSize: 11,
  color: '#ff8f8f'
};
