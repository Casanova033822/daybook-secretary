import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ReminderCard } from './ReminderCard';
import './styles.css';
import './refinements.css';
ReactDOM.createRoot(document.getElementById('root')!).render(window.location.hash === '#reminder' ? <ReminderCard/> : <React.StrictMode><App /></React.StrictMode>);
