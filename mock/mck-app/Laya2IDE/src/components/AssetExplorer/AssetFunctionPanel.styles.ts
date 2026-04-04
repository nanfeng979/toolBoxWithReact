import { CSSProperties } from 'react';

export const assetFunctionPanelRootStyle: CSSProperties = {
  flex: '0 0 auto',
  width: 'max-content',
  minWidth: 136,
  display: 'flex',
  flexDirection: 'column',
  borderLeft: '1px solid #333',
  background: 'rgba(31,32,35,0.96)'
};

export const assetFunctionPanelHeaderStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  color: '#c0c0c0',
  borderBottom: '1px solid #333',
  letterSpacing: 0.4
};

export const assetFunctionPanelBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12
};

export const assetFunctionPanelButtonStyle: CSSProperties = {
  background: '#2b2d33',
  border: '1px solid #3b3d44',
  color: '#d0d0d0',
  borderRadius: 4,
  fontSize: 12,
  padding: '4px 10px',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

export const assetFunctionApplyNewEnabledStyle: CSSProperties = {
  background: '#284b7b',
  color: '#e6f0ff'
};

export const assetFunctionApplyBatchEnabledStyle: CSSProperties = {
  background: '#2f5b3a',
  color: '#e8fff0'
};

export const assetFunctionButtonDisabledStyle: CSSProperties = {
  background: '#2b2d33',
  color: '#7f858f',
  cursor: 'not-allowed'
};
