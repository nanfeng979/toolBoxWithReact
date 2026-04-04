import { CSSProperties } from 'react';

export const inspectorPanelRootStyle: CSSProperties = {
  padding: 12,
  overflow: 'auto',
  height: 'calc(100% - 1px)',
  boxSizing: 'border-box'
};

export const inspectorEmptyStateStyle: CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 6,
  minHeight: 64,
  background: '#2a2a2a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#9aa0a6',
  fontSize: 12,
  textAlign: 'center',
  padding: 12,
  boxSizing: 'border-box'
};

export const inspectorCardStyle: CSSProperties = {
  border: '1px solid #3f3f46',
  borderRadius: 6,
  padding: 10,
  background: '#2a2a2a'
};

export const inspectorCardGapStyle: CSSProperties = {
  marginTop: 12
};

export const inspectorCardTitleStyle: CSSProperties = {
  color: '#9aa0a6',
  fontSize: 11,
  marginBottom: 10
};

export const inspectorNodeNameStyle: CSSProperties = {
  color: '#f0f0f0',
  fontSize: 12,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

export const inspectorNodeTypeStyle: CSSProperties = {
  color: '#7f7f7f',
  fontSize: 11,
  marginTop: 3
};

export const inspectorFieldRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8
};

export const inspectorFieldLabelStyle: CSSProperties = {
  width: 52,
  color: '#bcbcbc',
  fontSize: 12,
  textTransform: 'uppercase'
};

export const inspectorInputStyle: CSSProperties = {
  flex: 1,
  height: 26,
  background: '#1f1f1f',
  border: '1px solid #3f3f46',
  color: '#e5e5e5',
  borderRadius: 4,
  padding: '0 8px',
  fontSize: 12,
  outline: 'none'
};

export const inspectorInputShrinkStyle: CSSProperties = {
  minWidth: 0
};

export const inspectorColorButtonWrapStyle: CSSProperties = {
  position: 'relative'
};

export function getInspectorColorButtonStyle(colorValue: string): CSSProperties {
  return {
    width: 30,
    height: 26,
    padding: 0,
    border: '1px solid #3f3f46',
    background: colorValue,
    borderRadius: 4,
    cursor: 'pointer'
  };
}

export const inspectorHiddenColorInputStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none'
};

export const inspectorToggleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10
};

export const inspectorToggleLabelStyle: CSSProperties = {
  color: '#d0d0d0',
  fontSize: 12
};

export const inspectorRangeGroupStyle: CSSProperties = {
  display: 'block'
};

export const inspectorRangeLabelStyle: CSSProperties = {
  color: '#d0d0d0',
  fontSize: 12,
  marginBottom: 6
};

export const inspectorRangeInputStyle: CSSProperties = {
  width: '100%'
};
