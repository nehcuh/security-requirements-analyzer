// 简化的popup诊断工具
console.log("🔧 启动简化诊断工具");

async function simpleDiagnosis() {
  try {
    console.log("🔍 开始诊断...");
    
    // 1. 检查Chrome API
    if (typeof chrome === 'undefined') {
      console.error("❌ Chrome API不可用");
      return;
    }
    console.log("✅ Chrome API可用");

    // 2. 获取当前标签页
    let tab;
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = tabs[0];
      if (!tab) {
        console.error("❌ 无法获取当前标签页");
        return;
      }
      console.log("✅ 当前标签页:", tab.url);
    } catch (error) {
      console.error("❌ 获取标签页失败:", error.message);
      return;
    }

    // 3. 测试content script连接
    console.log("🔍 测试content script连接...");
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "diagnostic-ping"
      });
      console.log("✅ Content script连接成功:", response);
    } catch (error) {
      console.error("❌ Content script连接失败:", error.message);
      
      // 尝试注入content script
      console.log("🔄 尝试注入content script...");
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content-simple.js']
        });
        console.log("✅ Content script注入成功");
        
        // 等待一下再测试
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const retryResponse = await chrome.tabs.sendMessage(tab.id, {
          action: "diagnostic-ping"
        });
        console.log("✅ 重新注入后连接成功:", retryResponse);
      } catch (injectError) {
        console.error("❌ Content script注入失败:", injectError.message);
        return;
      }
    }

    // 4. 测试页面内容检测
    console.log("🔍 测试页面内容检测...");
    try {
      const contentResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "detectPageContent"
      });
      
      if (contentResponse.success !== false) {
        console.log("✅ 页面内容检测成功!");
        console.log("  📎 附件数量:", contentResponse.attachments?.length || 0);
        console.log("  📄 页面文本长度:", contentResponse.pageText?.length || 0);
        
        if (contentResponse.attachments && contentResponse.attachments.length > 0) {
          console.log("  📎 检测到的附件:");
          contentResponse.attachments.forEach((att, index) => {
            console.log(`    ${index + 1}. ${att.name} (${att.type})`);
          });
        }
      } else {
        console.error("❌ 页面内容检测失败:", contentResponse.error);
        if (contentResponse.contentScriptStatus) {
          console.log("📊 调试信息:", contentResponse.contentScriptStatus);
        }
      }
    } catch (contentError) {
      console.error("❌ 页面内容检测异常:", contentError.message);
    }

    // 5. 直接在页面执行检测
    console.log("🔍 直接在页面执行检测...");
    try {
      const directResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            // 检查各种可能的检测方法
            const results = {
              hasSimpleContentDetector: typeof window.SimpleContentDetector !== 'undefined',
              hasDetectPageContent: typeof window.detectPageContent === 'function',
              pageInfo: {
                url: window.location.href,
                title: document.title,
                readyState: document.readyState,
                totalElements: document.querySelectorAll('*').length,
                links: document.querySelectorAll('a').length,
                pdfLinks: document.querySelectorAll('a[href*=".pdf"]').length,
                docxLinks: document.querySelectorAll('a[href*=".docx"]').length
              }
            };

            // 尝试执行检测
            if (typeof window.detectPageContent === 'function') {
              results.detection = window.detectPageContent();
            } else if (typeof window.SimpleContentDetector !== 'undefined') {
              const detector = new window.SimpleContentDetector();
              results.detection = detector.detectAll();
            } else {
              results.error = 'No detection methods available';
            }

            return results;
          } catch (error) {
            return { error: error.message, stack: error.stack };
          }
        }
      });
      
      const result = directResult[0].result;
      if (result.error) {
        console.error("❌ 直接检测失败:", result.error);
      } else {
        console.log("✅ 直接检测结果:");
        console.log("  🔧 SimpleContentDetector:", result.hasSimpleContentDetector ? "✅" : "❌");
        console.log("  🔧 detectPageContent:", result.hasDetectPageContent ? "✅" : "❌");
        console.log("  📊 页面信息:", result.pageInfo);
        
        if (result.detection) {
          console.log("  📎 检测结果:");
          console.log("    - 附件数量:", result.detection.totalCount || 0);
          console.log("    - 文本长度:", result.detection.pageText?.length || 0);
        }
      }
    } catch (directError) {
      console.error("❌ 直接检测异常:", directError.message);
    }

    console.log("🎉 诊断完成");

  } catch (error) {
    console.error("❌ 诊断过程出错:", error);
  }
}

// 运行诊断
simpleDiagnosis();