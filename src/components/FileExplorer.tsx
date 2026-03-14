import React, { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { cn } from '../lib/utils';
import { FileNode } from '../stores/appStore';

interface FileTreeItemProps {
  node: FileNode;
  level: number;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (node.isDirectory) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div>
      <div 
        className={cn(
          "flex items-center py-0.5 px-2 hover:bg-[#2a2d2e] cursor-pointer text-sm select-none",
          isOpen && node.isDirectory ? "text-white" : "text-[#cccccc]"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        <span className="mr-1.5 w-4 flex items-center justify-center">
          {node.isDirectory ? (
            isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="w-4" />
          )}
        </span>
        <span className="mr-2">
          {node.isDirectory ? (
            <Folder className="w-4 h-4 text-blue-400 fill-current opacity-70" />
          ) : (
            <File className="w-4 h-4 text-[#cccccc] opacity-70" />
          )}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      
      {node.isDirectory && isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeItem key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC<{ tree: FileNode[]; rootName: string | null }> = ({ tree, rootName }) => {
  if (!rootName) {
    return (
      <div className="p-4 text-center text-[#8e8e8e] text-sm">
        <p>You have not yet opened a folder.</p>
        <button 
          onClick={async () => {
            const result = await window.ipcRenderer.invoke('explorer:open-folder');
            if (result) {
              const { useAppStore } = await import('../stores/appStore');
              useAppStore.getState().setWorkspace(result.path, result.tree);
            }
          }}
          className="mt-4 px-4 py-1.5 bg-[#007acc] text-white hover:bg-[#0062a3] transition-colors rounded-sm w-full"
        >
          Open Folder
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-2 text-[11px] font-bold text-[#bbbbbb] uppercase tracking-wider flex items-center justify-between group">
        <span>Explorer: {rootName.split(/[\\/]/).pop()}</span>
      </div>
      <div className="flex-1 overflow-auto pt-1">
        {tree.map(node => (
          <FileTreeItem key={node.path} node={node} level={0} />
        ))}
      </div>
    </div>
  );
};
