import {defineConfig} from '@playwright/test';
// Software WebGL in cloud runners shares the CPU; serialize browser captures.
export default defineConfig({testDir:'tests',testMatch:'*.visual.spec.ts',workers:1,timeout:60000,use:{viewport:{width:1440,height:1000},launchOptions:{executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},webServer:{command:'npm run dev -- --port 5173',url:'http://localhost:5173',reuseExistingServer:true}});
