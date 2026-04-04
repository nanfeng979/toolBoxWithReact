import React from 'react';
import { IMAGE_EXTENSIONS } from './assetExplorerConstants';
import { HostApiEntryItem } from './AssetExplorerTypes';
import { canGoParent, dirname, extname, stripExt, toAssetUrl } from './assetExplorerPathUtils';
import {
  assetEntryCardSelectedStyle,
  assetEntryCardStyle,
  assetEntryExtStyle,
  assetEntryFileIconStyle,
  assetEntryFolderIconStyle,
  assetEntryGridLoadingStyle,
  assetEntryGridRootStyle,
  assetEntryMetaStyle,
  assetEntryNameStyle,
  assetEntryPreviewImageStyle,
  assetEntryPreviewStyle
} from './AssetEntryGrid.styles';

interface ParentEntry {
  name: '..';
  path: string;
  isDirectory: true;
  isParent: true;
}

interface AssetEntryGridProps {
  entries: HostApiEntryItem[];
  loading: boolean;
  emptyLabel: string;
  currentPath: string;
  rootPath: string;
  onOpenFolder: (path: string) => void;
  selectedFilePath: string;
  onSelectFile: (path: string) => void;
  onClearSelection: () => void;
  assetCacheToken: number;
}

export function AssetEntryGrid(props: AssetEntryGridProps) {
  const {
    entries,
    loading,
    emptyLabel,
    currentPath,
    rootPath,
    onOpenFolder,
    selectedFilePath,
    onSelectFile,
    onClearSelection,
    assetCacheToken
  } = props;

  if (loading) {
    return <div style={assetEntryGridLoadingStyle}>加载中...</div>;
  }

  const canBack = canGoParent(currentPath, rootPath);
  const displayEntries: Array<HostApiEntryItem | ParentEntry> = [];
  if (canBack) {
    displayEntries.push({ name: '..', path: dirname(currentPath), isDirectory: true, isParent: true });
  }
  displayEntries.push(...entries);

  if (!displayEntries.length) {
    return <div style={assetEntryGridLoadingStyle}>{emptyLabel}</div>;
  }

  return (
    <div
      onClick={() => onClearSelection()}
      style={assetEntryGridRootStyle}
    >
      {displayEntries.map((item) => {
        const isParentEntry = (item as { isParent?: boolean }).isParent === true;
        const extension = item.isDirectory ? 'folder' : extname(item.name);
        const isImageFile = !item.isDirectory && IMAGE_EXTENSIONS.has(extension);
        const isFile = !item.isDirectory && !isParentEntry;
        const isSelected = isFile && selectedFilePath && selectedFilePath === item.path;
        return (
          <div
            key={`${item.path}:${item.name}`}
            onDoubleClick={() => {
              if (item.isDirectory) {
                onOpenFolder(item.path);
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (!isFile) return;
              if (isSelected) onClearSelection();
              else onSelectFile(item.path);
            }}
            style={{
              ...(isSelected ? { ...assetEntryCardStyle, ...assetEntryCardSelectedStyle } : assetEntryCardStyle),
              cursor: item.isDirectory || isFile ? 'pointer' : 'default'
            }}
            title={item.path}
          >
            <div style={assetEntryPreviewStyle}>
              {isImageFile ? (
                <img
                  src={`${toAssetUrl(item.path)}?v=${assetCacheToken}`}
                  alt={item.name}
                  style={assetEntryPreviewImageStyle}
                />
              ) : (
                <span style={item.isDirectory ? assetEntryFolderIconStyle : assetEntryFileIconStyle}>
                  {item.isDirectory ? '📁' : '📄'}
                </span>
              )}
            </div>
            <div style={assetEntryMetaStyle}>
              <div style={assetEntryNameStyle}>
                {isParentEntry ? '..' : stripExt(item.name)}
              </div>
              <div style={assetEntryExtStyle}>{isParentEntry ? 'parent' : extension || '(no ext)'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
