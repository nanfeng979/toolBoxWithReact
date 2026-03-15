import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('React mount node #root not found');
}

document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';

createRoot(container).render(<App />);
