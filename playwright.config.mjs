import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const localChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.mjs',timeout:30000,workers:1,
  use:{baseURL:'http://127.0.0.1:5178',viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync(localChrome)?localChrome:undefined)}},
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort',url:'http://127.0.0.1:5178/admin',reuseExistingServer:false,env:{VITE_SUPABASE_URL:'https://sac-test.supabase.co',VITE_SUPABASE_ANON_KEY:'test-public-key',VITE_GOOGLE_AUTH_ENABLED:'false'}},
});
