import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';

interface NativeEditorProps {
  filePath: string;
}

export const NativeEditor: React.FC<NativeEditorProps> = ({ filePath }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // 简单的扩展名到语言的映射
  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx': return 'javascript';
      case 'ts':
      case 'tsx': return 'typescript';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'html': return 'html';
      case 'css': return 'css';
      default: return 'plaintext';
    }
  };

  useEffect(() => {
    const loadFile = async () => {
      setLoading(true);
      try {
        const text = await window.ipcRenderer.invoke('explorer:read-file', filePath);
        setContent(text || '');
      } catch (err) {
        console.error('Failed to load file', err);
        setContent('Error loading file content.');
      } finally {
        setLoading(false);
      }
    };
    
    loadFile();
  }, [filePath]);

  if (loading) {
    return <div className="h-full w-full flex items-center justify-center text-[#8e8e8e]">Loading {filePath}...</div>;
  }

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={getLanguage(filePath)}
        theme="vs-dark"
        value={content}
        options={{
          readOnly: true, // 目前先做只读，未来可实现保存
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
        }}
      />
    </div>
  );
};
