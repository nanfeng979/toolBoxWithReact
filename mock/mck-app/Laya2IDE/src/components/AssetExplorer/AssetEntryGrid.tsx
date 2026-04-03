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
}

export function AssetEntryGrid(props: AssetEntryGridProps) {
  const { entries, loading, emptyLabel, currentPath, rootPath, onOpenFolder } = props;

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
        return (
          <div
            key={`${item.path}:${item.name}`}
            onDoubleClick={() => {
              if (item.isDirectory) {
                onOpenFolder(item.path);
              }
            }}
            style={{
              border: '1px solid #3a3d43',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.02)',
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: item.isDirectory ? 'pointer' : 'default',
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
                  src={toAssetUrl(item.path)}
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
