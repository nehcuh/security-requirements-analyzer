// Test script to verify content script functionality
console.log("🧪 Testing Chrome Extension Content Script");

// Test if we can communicate with the content script
async function testContentScript() {
  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.error("❌ No active tab found");
      return;
    }
    
    console.log("📋 Testing tab:", tab.url);
    
    // Test 1: Diagnostic ping
    console.log("🔍 Test 1: Diagnostic ping...");
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "diagnostic-ping"
      });
      console.log("✅ Diagnostic ping successful:", pingResponse);
    } catch (error) {
      console.error("❌ Diagnostic ping failed:", error);
    }
    
    // Test 2: Detect page content
    console.log("🔍 Test 2: Detect page content...");
    try {
      const contentResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "detectPageContent"
      });
      
      if (contentResponse.success !== false) {
        console.log("✅ Content detection successful:");
        console.log("  - Attachments:", contentResponse.attachments?.length || 0);
        console.log("  - Page text length:", contentResponse.pageText?.length || 0);
        console.log("  - Total count:", contentResponse.totalCount || 0);
      } else {
        console.error("❌ Content detection failed:", contentResponse.error);
        console.log("📊 Debug info:", contentResponse.contentScriptStatus);
      }
    } catch (error) {
      console.error("❌ Content detection error:", error);
    }
    
    // Test 3: Debug scan
    console.log("🔍 Test 3: Debug scan...");
    try {
      const debugResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "debug-scan"
      });
      console.log("✅ Debug scan result:", debugResponse);
    } catch (error) {
      console.error("❌ Debug scan failed:", error);
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testContentScript();