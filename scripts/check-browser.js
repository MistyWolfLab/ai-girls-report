// Prints install hints when the Playwright browser is missing.
// Never fails the install; build will give a precise error later.
import { chromium } from "playwright";

try {
  await chromium.launch();
  console.log("[aig] chromium ready");
  process.exit(0);
} catch {
  console.log("[aig] chromium not found. Run:  npx playwright install chromium");
  process.exit(0);
}
