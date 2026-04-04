import { CSSProperties } from 'react';

export const assetBreadcrumbRootStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minWidth: 0,
  overflowX: 'auto',
  whiteSpace: 'nowrap'
};

export const assetBreadcrumbDividerStyle: CSSProperties = {
  color: '#66707c'
};

export const assetBreadcrumbButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#9cb2ce',
  padding: 0,
  cursor: 'pointer',
  fontSize: 11,
  flex: '0 0 auto'
};
