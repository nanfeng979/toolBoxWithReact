import React from 'react';
import {
  assetFunctionApplyBatchEnabledStyle,
  assetFunctionApplyNewEnabledStyle,
  assetFunctionButtonDisabledStyle,
  assetFunctionPanelBodyStyle,
  assetFunctionPanelButtonStyle,
  assetFunctionPanelHeaderStyle,
  assetFunctionPanelRootStyle
} from './AssetFunctionPanel.styles';

interface AssetFunctionPanelProps {
  onAddExternalFolder: () => void;
  onApplyNewFile: () => void;
  canApplyNewFile: boolean;
  onApplyBatchReplace: () => void;
  canApplyBatchReplace: boolean;
  batchReplaceLabel?: string;
}

export const AssetFunctionPanel = React.forwardRef<HTMLDivElement, AssetFunctionPanelProps>((props, ref) => {
  const {
    onAddExternalFolder,
    onApplyNewFile,
    canApplyNewFile,
    onApplyBatchReplace,
    canApplyBatchReplace,
    batchReplaceLabel
  } = props;

  return (
    <div ref={ref} style={assetFunctionPanelRootStyle}>
      <div style={assetFunctionPanelHeaderStyle}>
        功能区
      </div>
      <div style={assetFunctionPanelBodyStyle}>
        <button
          type="button"
          onClick={onApplyNewFile}
          disabled={!canApplyNewFile}
          style={canApplyNewFile ? { ...assetFunctionPanelButtonStyle, ...assetFunctionApplyNewEnabledStyle } : { ...assetFunctionPanelButtonStyle, ...assetFunctionButtonDisabledStyle }}
        >
          应用新的文件
        </button>
        <button
          type="button"
          onClick={onApplyBatchReplace}
          disabled={!canApplyBatchReplace}
          style={
            canApplyBatchReplace
              ? { ...assetFunctionPanelButtonStyle, ...assetFunctionApplyBatchEnabledStyle }
              : { ...assetFunctionPanelButtonStyle, ...assetFunctionButtonDisabledStyle }
          }
        >
          {batchReplaceLabel || '批量替换同名图片'}
        </button>
        <button
          type="button"
          onClick={onAddExternalFolder}
          style={assetFunctionPanelButtonStyle}
        >
          导入外部文件夹
        </button>
      </div>
    </div>
  );
});

AssetFunctionPanel.displayName = 'AssetFunctionPanel';
