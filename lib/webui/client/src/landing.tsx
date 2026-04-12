import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ReferenceLandingPage } from './pages/ReferenceLandingPage.jsx';
import './fonts.css';
import './landing.css';

createRoot(document.getElementById('root')!).render(createElement(ReferenceLandingPage));
