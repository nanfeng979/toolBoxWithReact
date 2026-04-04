import { CSSProperties } from 'react';

export const hierarchyPanelEmptyStyle: CSSProperties = {
  margin: 12,
  border: '1px solid #3f3f46',
  borderRadius: 6,
  height: 'calc(100% - 24px)',
  background: '#2a2a2a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#9aa0a6',
  fontSize: 12
};

export const hierarchyPanelRootStyle: CSSProperties = {
  height: 'calc(100% - 1px)',
  overflow: 'auto',
  padding: '6px 0'
};

export const hierarchyRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 24,
  paddingRight: 8,
  background: 'transparent',
  color: '#d4d4d4',
  cursor: 'pointer',
  userSelect: 'none'
};

export const hierarchyRowSelectedStyle: CSSProperties = {
  background: '#37373d',
  color: '#ffffff'
};

export const hierarchyRowToggleStyle: CSSProperties = {
  width: 14,
  fontSize: 10,
  color: '#a9a9a9',
  textAlign: 'center',
  flexShrink: 0
};

export const hierarchyRowLabelStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  width: '100%'
};

export const hierarchyRowInputStyle: CSSProperties = {
  width: '100%',
  height: 20,
  background: '#1f1f1f',
  border: '1px solid #4b4b4b',
  color: '#ffffff',
  borderRadius: 4,
  padding: '0 6px',
  fontSize: 12,
  outline: 'none'
};

export const hierarchyContextMenuStyle: CSSProperties = {
  position: 'fixed',
  minWidth: 140,
  background: '#2a2a2a',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  zIndex: 9999,
  padding: 4
};

export const hierarchyMenuButtonStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: '#d4d4d4',
  textAlign: 'left',
  fontSize: 12,
  padding: '6px 8px',
  cursor: 'pointer'
};

export const hierarchyMenuButtonDangerStyle: CSSProperties = {
  color: '#ffb4b4'
};

export const hierarchyMenuButtonDangerDisabledStyle: CSSProperties = {
  color: '#777777',
  cursor: 'not-allowed'
};
