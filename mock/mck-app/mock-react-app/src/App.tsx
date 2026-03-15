import React, { useMemo, useState } from 'react';

export function App() {
  const [keyword, setKeyword] = useState('toolsbox');
  const [counter, setCounter] = useState(0);

  const stats = useMemo(() => {
    return {
      length: keyword.trim().length,
      upper: keyword.toUpperCase(),
      reversed: keyword.split('').reverse().join('')
    };
  }, [keyword]);

  const notify = async () => {
    if (!window.hostApi?.showNotification) return;
    await window.hostApi.showNotification('React Mini App', `Current keyword: ${keyword || '(empty)'}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #101820 0%, #1a2d42 45%, #15304d 100%)',
      color: '#f5f7fa',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      padding: '20px'
    }}>
      <h1 style={{ marginTop: 0 }}>React Mini App</h1>
      <p>Use React state and host API in mini app runtime.</p>

      <div style={{ display: 'grid', gap: '12px', maxWidth: '520px' }}>
        <label>
          <span>Keyword</span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Type anything"
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #2f4257',
              background: '#0f1c2a',
              color: '#fff'
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setCounter((v) => v + 1)} style={buttonStyle}>Count +1</button>
          <button onClick={() => setCounter(0)} style={buttonStyle}>Reset</button>
          <button onClick={notify} style={buttonStyle}>Notify</button>
        </div>

        <div style={{ background: 'rgba(0, 0, 0, 0.24)', borderRadius: '10px', padding: '12px' }}>
          <div>Counter: {counter}</div>
          <div>Length: {stats.length}</div>
          <div>Upper: {stats.upper}</div>
          <div>Reversed: {stats.reversed}</div>
        </div>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  border: '1px solid #395a7a',
  background: '#1f3a56',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: '8px',
  cursor: 'pointer'
};
