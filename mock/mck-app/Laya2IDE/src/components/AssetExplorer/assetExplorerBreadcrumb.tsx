import React from 'react';
import { BreadcrumbItem } from './AssetExplorerTypes';
import { getProjectRelativePath, isWithinRoot, joinPath } from './assetExplorerPathUtils';

export function buildBreadcrumbItems(rootPath: string, currentPath: string) {
  if (!rootPath || !currentPath || !isWithinRoot(currentPath, rootPath)) return [] as BreadcrumbItem[];

  const items: BreadcrumbItem[] = [{ label: 'assets', path: rootPath }];
  const relative = getProjectRelativePath(rootPath, currentPath);
  if (!relative) return items;

  const segments = relative.split('/').filter(Boolean);
  let walkPath = rootPath;
  for (const seg of segments) {
    walkPath = joinPath(walkPath, seg);
    items.push({ label: seg, path: walkPath });
  }
  return items;
}

function estimateBreadcrumbWidth(label: string) {
  return Math.max(44, label.length * 8 + 22);
}

export function getVisibleBreadcrumbItems(items: BreadcrumbItem[], availableWidth: number) {
  if (!items.length) return [] as BreadcrumbItem[];

  const gapWidth = 6;
  const ellipsisWidth = 24;
  let totalWidth = 0;
  const widths = items.map((item) => estimateBreadcrumbWidth(item.label));

  for (let i = 0; i < widths.length; i += 1) {
    totalWidth += widths[i];
    if (i > 0) totalWidth += gapWidth;
  }

  if (totalWidth <= availableWidth) return items;

  let startIndex = 0;
  let usedWidth = ellipsisWidth;

  for (let i = widths.length - 1; i >= 0; i -= 1) {
    const nextWidth = widths[i] + (usedWidth > ellipsisWidth ? gapWidth : 0);
    if (usedWidth + nextWidth > availableWidth) break;
    usedWidth += nextWidth;
    startIndex = i;
  }

  return items.slice(startIndex);
}

export function renderBreadcrumbButtons(items: BreadcrumbItem[], onClick: (path: string) => void) {
  if (!items.length) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && <span style={{ color: '#66707c' }}>/</span>}
          <button
            type="button"
            onClick={() => onClick(item.path)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9cb2ce',
              padding: 0,
              cursor: 'pointer',
              fontSize: 11,
              flex: '0 0 auto'
            }}
            title={item.path}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
