import { buildBreadcrumbItems, getVisibleBreadcrumbItems, renderBreadcrumbButtons } from './assetExplorerBreadcrumb';

interface AssetBreadcrumbAreaProps {
  rootPath: string;
  currentPath: string;
  availableWidth: number;
  onClick: (path: string) => void;
}

export function AssetBreadcrumbArea(props: AssetBreadcrumbAreaProps) {
  const { rootPath, currentPath, availableWidth, onClick } = props;
  const items = buildBreadcrumbItems(rootPath, currentPath);
  const visible = getVisibleBreadcrumbItems(items, availableWidth);
  return renderBreadcrumbButtons(visible, onClick);
}
