import {mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
mkdirSync('dist-pages',{recursive:true});
copyFileSync('dist-worker/worker.js','dist-pages/_worker.js');
writeFileSync('dist-pages/_routes.json',JSON.stringify({version:1,include:['/*'],exclude:[]})+'\n');
writeFileSync('dist-pages/index.html','<!doctype html><meta charset="utf-8"><title>BNB Guardian V0.0.3</title><p>API service: /healthz. No signing or broadcasting.</p>');
console.log('Pages advanced-mode artifact prepared locally. Nothing deployed.');
