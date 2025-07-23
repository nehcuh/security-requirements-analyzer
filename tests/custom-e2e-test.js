const puppeteer = require("puppeteer");
const path = require("path");

// --- Configuration ---
const EXTENSION_PATH = path.resolve(__dirname, "..");
// Note: Please ensure you are running a local web server from the project root.
// For example, run `python3 -m http.server 8080` in your terminal.
const TEST_PAGE_URL =
  "http://localhost:8080/assets/prd/%E9%9C%80%E6%B1%82%E6%B1%A0%20-%20%E5%A4%A9%E5%B7%A5%E7%A0%94%E5%8F%91%E7%AE%A1%E7%90%86%E5%B9%B3%E5%8F%B0.html";
const AI_CONFIG = {
  llmConfig: {
    provider: "custom",
    endpoint: "http://127.0.0.1:1234/v1/chat/completions",
    apiKey: "asdfasdf",
    model: "deepseek/deepseek-r1-0528-qwen3-8b",
  },
};

const PAUSE_DURATION = 3000; // 3 seconds to observe steps

/**
 * A helper function to pause execution for a specified duration.
 * @param {number} ms - The duration to pause in milliseconds.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Main test function.
 */
(async () => {
  let browser;
  try {
    console.log("Launching browser with extension...");
    browser = await puppeteer.launch({
      headless: false, // Set to false to watch the test run
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    console.log("Browser launched.");
    await sleep(PAUSE_DURATION);

    // --- 1. Set the AI configuration in the extension's storage ---
    console.log("Waiting for extension background page...");
    const backgroundPageTarget = await browser.waitForTarget(
      (target) => target.type() === "service_worker",
    );
    if (!backgroundPageTarget) {
      throw new Error(
        "Could not find the extension's background service worker.",
      );
    }
    const backgroundPage = await backgroundPageTarget.page();
    backgroundPage.on("console", (msg) => {
      const type = msg.type().toUpperCase();
      const text = msg.text();
      console.log(`[BACKGROUND CONSOLE ${type}]: ${text}`);
    });
    console.log("Found background page. Setting AI configuration...");

    await backgroundPage.evaluate(async (config) => {
      await chrome.storage.local.set(config);
    }, AI_CONFIG);

    console.log("AI configuration has been set successfully.");
    await sleep(PAUSE_DURATION);

    // --- 2. Open the test page ---
    console.log(`Navigating to test page: ${TEST_PAGE_URL}`);
    const page = await browser.newPage();
    await page.goto(TEST_PAGE_URL, { waitUntil: "networkidle2" });
    console.log("Test page loaded.");
    await sleep(PAUSE_DURATION);

    // --- 3. Open the extension popup and trigger analysis ---
    const extensionId = backgroundPage.url().split("/")[2];
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    console.log(`Opening extension popup: ${popupUrl}`);
    const popupPage = await browser.newPage();
    await popupPage.goto(popupUrl, { waitUntil: "networkidle2" });
    console.log("Popup opened.");
    await sleep(PAUSE_DURATION);

    console.log('Waiting for the "Analyze" button to be ready...');
    // The content script should have already detected attachments and enabled the button.
    const analyzeButtonSelector = "#analyze-button";
    await popupPage.waitForSelector(analyzeButtonSelector, { timeout: 10000 });

    console.log('Clicking the "Analyze" button...');
    await popupPage.click(analyzeButtonSelector);

    // --- 4. Verify the results ---
    console.log("Analysis started. Waiting for results...");
    const resultsSelector = "#analysis-results";
    await popupPage.waitForSelector(resultsSelector, { timeout: 60000 }); // Wait up to 60 seconds for LLM to respond

    const resultsContent = await popupPage.$eval(
      resultsSelector,
      (el) => el.innerText,
    );

    if (
      resultsContent &&
      resultsContent.trim() !== "Analysis results will appear here."
    ) {
      console.log("✅ SUCCESS: Analysis results were found!");
      console.log("--- Results Snippet ---");
      console.log(resultsContent.substring(0, 500) + "...");
      console.log("-----------------------");
    } else {
      throw new Error(
        "❌ FAILURE: Analysis results area is empty or unchanged.",
      );
    }
  } catch (error) {
    console.error("An error occurred during the test:", error);
  } finally {
    if (browser) {
      console.log("Test finished. Closing browser in 10 seconds...");
      await sleep(10000);
      await browser.close();
      console.log("Browser closed.");
    }
  }
})();
