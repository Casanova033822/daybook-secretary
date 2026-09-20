import { spawn } from 'node:child_process';
import electron from 'electron';
const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const run = args => spawn(process.execPath, args, { stdio: 'inherit', env, windowsHide: true });
await new Promise((resolve, reject) => { const build = run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.electron.json']); build.on('exit', code => code === 0 ? resolve() : reject(new Error('Electron build failed'))); });
const vite = run(['node_modules/vite/bin/vite.js']);
const watch = run(['node_modules/typescript/bin/tsc', '-p', 'tsconfig.electron.json', '--watch']);
let desktop;
const stop = () => { desktop?.kill(); vite.kill(); watch.kill(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
for (let attempt = 0; attempt < 60; attempt++) { try { const response = await fetch(env.VITE_DEV_SERVER_URL); if (response.ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
desktop = spawn(electron, ['.'], { stdio: 'inherit', env, windowsHide: true });
desktop.on('exit', code => { stop(); process.exit(code ?? 0); });
