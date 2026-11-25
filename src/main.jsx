import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { initialData } from './App.jsx';
import { FactoryProvider } from './context/FactoryContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><FactoryProvider initialValue={initialData}><App /></FactoryProvider></React.StrictMode>);
