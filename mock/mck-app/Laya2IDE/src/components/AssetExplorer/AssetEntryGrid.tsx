import React from 'react';
import { IMAGE_EXTENSIONS } from './assetExplorerConstants';
import { HostApiEntryItem } from './AssetExplorerTypes';
import { canGoParent, dirname, extname, stripExt, toAssetUrl } from './assetExplorerPathUtils';

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
    return <div style={{ padding: 12, color: '#8d8d8d', fontSize: 12 }}>加载中...</div>;
  }

  const canBack = canGoParent(currentPath, rootPath);
  const displayEntries: Array<HostApiEntryItem | ParentEntry> = [];
  if (canBack) {
    displayEntries.push({ name: '..', path: dirname(currentPath), isDirectory: true, isParent: true });
  }
  displayEntries.push(...entries);

  if (!displayEntries.length) {
    return <div style={{ padding: 12, color: '#8d8d8d', fontSize: 12 }}>{emptyLabel}</div>;
  }

  return (
    <div
      onClick={() => onClearSelection()}
      style={{
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
      }}
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
              if (isSelected) {
                onClearSelection();
                return;
              }
              onSelectFile(item.path);
            }}
            style={{
              border: isSelected ? '1px solid #58a6ff' : '1px solid #3a3d43',
              borderRadius: 6,
              background: isSelected ? 'rgba(88, 166, 255, 0.18)' : 'rgba(255,255,255,0.02)',
              boxShadow: isSelected ? '0 0 0 1px rgba(88, 166, 255, 0.25) inset' : 'none',
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: item.isDirectory ? 'pointer' : isFile ? 'pointer' : 'default',
              alignSelf: 'start'
            }}
            title={item.path}
          >
            <div
              style={{
                height: 68,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1a1b1f',
                border: '1px solid #2f3238',
                borderRadius: 4,
                overflow: 'hidden'
              }}
            >
              {isImageFile ? (
                <img
                  src={`${toAssetUrl(item.path)}?v=${assetCacheToken}`}
                  alt={item.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              ) : (
                <span style={{ fontSize: 26, color: item.isDirectory ? '#d7b76d' : '#90a8c8', lineHeight: 1 }}>
                  {item.isDirectory ? '📁' : '📄'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#c9c9c9', lineHeight: 1.2 }}>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isParentEntry ? '..' : stripExt(item.name)}
              </div>
              <div style={{ color: '#8d8d8d' }}>{isParentEntry ? 'parent' : extension || '(no ext)'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
