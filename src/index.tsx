import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// No StrictMode: the sim runs its own rAF loop and double-mounted effects
// in dev would briefly run two loops.
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
