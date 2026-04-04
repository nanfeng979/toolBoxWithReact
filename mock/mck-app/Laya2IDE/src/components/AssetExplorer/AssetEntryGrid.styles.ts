import { CSSProperties } from 'react';

export const assetEntryGridLoadingStyle: CSSProperties = {
  padding: 12,
  color: '#8d8d8d',
  fontSize: 12
};

export const assetEntryGridRootStyle: CSSProperties = {
  padding: 10,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, 104px)',
  gridAutoRows: '124px',
  justifyContent: 'start',
  alignContent: 'start',
  alignItems: 'start',
  gap: 10,
  overflow: 'auto',
  minHeight: 0,
  flex: 1
};

export const assetEntryCardStyle: CSSProperties = {
  border: '1px solid #3a3d43',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.02)',
  boxShadow: 'none',
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  alignSelf: 'start'
};

export const assetEntryCardSelectedStyle: CSSProperties = {
  border: '1px solid #58a6ff',
  background: 'rgba(88, 166, 255, 0.18)',
  boxShadow: '0 0 0 1px rgba(88, 166, 255, 0.25) inset'
};

export const assetEntryPreviewStyle: CSSProperties = {
  height: 68,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#1a1b1f',
  border: '1px solid #2f3238',
  borderRadius: 4,
  overflow: 'hidden'
};

export const assetEntryPreviewImageStyle: CSSProperties = {
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  display: 'block'
};

export const assetEntryMetaStyle: CSSProperties = {
  fontSize: 11,
  color: '#c9c9c9',
  lineHeight: 1.2
};

export const assetEntryNameStyle: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

export const assetEntryExtStyle: CSSProperties = {
  color: '#8d8d8d'
};

export const assetEntryFolderIconStyle: CSSProperties = {
  fontSize: 26,
  color: '#d7b76d',
  lineHeight: 1
};

export const assetEntryFileIconStyle: CSSProperties = {
  fontSize: 26,
  color: '#90a8c8',
  lineHeight: 1
};
