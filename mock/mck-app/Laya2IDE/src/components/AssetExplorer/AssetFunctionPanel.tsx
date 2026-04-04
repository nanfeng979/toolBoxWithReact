import React from 'react';

interface AssetFunctionPanelProps {
  onAddExternalFolder: () => void;
  onApplyNewFile: () => void;
  canApplyNewFile: boolean;
}

export const AssetFunctionPanel = React.forwardRef<HTMLDivElement, AssetFunctionPanelProps>((props, ref) => {
  const { onAddExternalFolder, onApplyNewFile, canApplyNewFile } = props;

  return (
    <div
      ref={ref}
      style={{
        flex: '0 0 auto',
        width: 'max-content',
        minWidth: 136,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #333',
        background: 'rgba(31,32,35,0.96)'
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          fontSize: 12,
          color: '#c0c0c0',
          borderBottom: '1px solid #333',
          letterSpacing: 0.4
        }}
      >
        功能区
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
        <button
          type="button"
          onClick={onApplyNewFile}
          disabled={!canApplyNewFile}
          style={{
            background: canApplyNewFile ? '#284b7b' : '#2b2d33',
            border: '1px solid #3b3d44',
            color: canApplyNewFile ? '#e6f0ff' : '#7f858f',
            borderRadius: 4,
            fontSize: 12,
            padding: '4px 10px',
            cursor: canApplyNewFile ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap'
          }}
        >
          应用新的文件
        </button>
        <button
          type="button"
          onClick={onAddExternalFolder}
          style={{
            background: '#2b2d33',
            border: '1px solid #3b3d44',
            color: '#d0d0d0',
            borderRadius: 4,
            fontSize: 12,
            padding: '4px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          导入外部文件夹
        </button>
      </div>
    </div>
  );
});

AssetFunctionPanel.displayName = 'AssetFunctionPanel';
