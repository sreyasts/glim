import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './Explorer';
import 'maplibre-gl/dist/maplibre-gl.css';
import './atlas.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
