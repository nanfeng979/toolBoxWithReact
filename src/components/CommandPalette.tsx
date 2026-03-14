import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { MiniAppManifest } from '../vite-env';
import { cn } from '../lib/utils';

export function CommandPalette({ apps }: { apps: MiniAppManifest[] }) {
  const { isCommandPaletteOpen, setCommandPaletteOpen, openApp } = useAppStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(query.toLowerCase()) ||
    app.id.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const handleSelect = (app: MiniAppManifest) => {
    openApp(app);
    setCommandPaletteOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredApps.length));
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => (prev - 1 + filteredApps.length) % Math.max(1, filteredApps.length));
    } else if (e.key === 'Enter') {
      if (filteredApps[selectedIndex]) {
        handleSelect(filteredApps[selectedIndex]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/20" onClick={() => setCommandPaletteOpen(false)}>
      <div 
        className="w-[600px] bg-[#252526] shadow-2xl rounded-lg border border-[#454545] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-3 py-2 border-b border-[#454545] bg-[#3c3c3c]">
          <Search className="w-4 h-4 text-[#8e8e8e] mr-2" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#cccccc] placeholder-[#8e8e8e]"
            placeholder="Search apps by name..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        
        <div className="max-h-[400px] overflow-y-auto py-1">
          {filteredApps.length === 0 ? (
            <div className="px-10 py-4 text-xs text-[#8e8e8e]">No matching apps found.</div>
          ) : (
            filteredApps.map((app, index) => (
              <div
                key={app.id}
                className={cn(
                  "px-4 py-2 flex items-center cursor-pointer text-sm",
                  index === selectedIndex ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#2a2d2e]"
                )}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => handleSelect(app)}
              >
                <div className="flex flex-col flex-1">
                  <span>{app.name}</span>
                  <span className="text-[10px] opacity-60">{app.id}</span>
                </div>
                <div className="text-[10px] text-[#8e8e8e]">App</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
