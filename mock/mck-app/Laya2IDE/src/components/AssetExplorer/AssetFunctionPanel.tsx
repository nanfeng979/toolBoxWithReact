import React, { useCallback, useEffect, useRef, useImperativeHandle } from 'react';
import {
  assetFunctionApplyBatchEnabledStyle,
  assetFunctionApplyNewEnabledStyle,
  assetFunctionButtonDisabledStyle,
  assetFunctionPanelBodyStyle,
  assetFunctionPanelButtonStyle,
  assetFunctionPanelHeaderStyle,
  assetFunctionPanelRootStyle
} from './AssetFunctionPanel.styles';

export interface AssetFunctionPanelRef {
  sendToNewPage: (data: unknown) => void;
  closeNewPage: () => void;
  getWidth: () => number;
}

interface AssetFunctionPanelProps {
  onAddExternalFolder: () => void;
  onApplyNewFile: () => void;
  canApplyNewFile: boolean;
  onApplyBatchReplace: () => void;
  canApplyBatchReplace: boolean;
  batchReplaceLabel?: string;
  newPageUrl?: string;
  initialData?: unknown;
  onMessageFromNewPage?: (data: unknown) => void;
}

export const AssetFunctionPanel = React.forwardRef<AssetFunctionPanelRef, AssetFunctionPanelProps>((props, ref) => {
  const {
    onAddExternalFolder,
    onApplyNewFile,
    canApplyNewFile,
    onApplyBatchReplace,
    canApplyBatchReplace,
    batchReplaceLabel,
    newPageUrl,
    initialData,
    onMessageFromNewPage
  } = props;

  const newWindowRef = useRef<Window | null>(null);
  const rootDivRef = useRef<HTMLDivElement>(null);

  // 获取面板宽度
  const getWidth = useCallback(() => {
    return rootDivRef.current?.clientWidth || 0;
  }, []);

  // 向新窗口发送数据
  const sendToNewPage = useCallback((data: unknown) => {
    if (newWindowRef.current && !newWindowRef.current.closed) {
      newWindowRef.current.postMessage(
        {
          type: 'update',
          source: 'Laya2IDE',
          data
        },
        '*'
      );
    }
  }, []);

  // 关闭新窗口
  const closeNewPage = useCallback(() => {
    if (newWindowRef.current && !newWindowRef.current.closed) {
      newWindowRef.current.close();
      newWindowRef.current = null;
    }
  }, []);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    sendToNewPage,
    closeNewPage,
    getWidth
  }), [sendToNewPage, closeNewPage, getWidth]);

  const handleOpenNewPage = useCallback(() => {
    const url = newPageUrl || 'about:blank';
    const target = '_blank';
    const features = 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no';

    newWindowRef.current = window.open(url, target, features);

    if (newWindowRef.current) {
      // 发送初始化数据到新窗口
      newWindowRef.current.onload = () => {
        newWindowRef.current?.postMessage(
          {
            type: 'init',
            source: 'Laya2IDE',
            data: initialData || { timestamp: Date.now() }
          },
          '*'
        );
      };
    }
  }, [newPageUrl, initialData]);

  // 监听来自新窗口的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 可以添加 origin 验证以提高安全性
      if (event.data && event.data.type && onMessageFromNewPage) {
        onMessageFromNewPage(event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMessageFromNewPage]);

  return (
    <div ref={rootDivRef} style={assetFunctionPanelRootStyle}>
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
        <button
          type="button"
          onClick={handleOpenNewPage}
          style={assetFunctionPanelButtonStyle}
        >
          打开独立页面
        </button>
      </div>
    </div>
  );
});

AssetFunctionPanel.displayName = 'AssetFunctionPanel';
