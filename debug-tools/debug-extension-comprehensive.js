// 综合诊断工具 - 用于调试Chrome扩展问题
console.log("🔧 启动Chrome扩展综合诊断工具");

async function comprehensiveDiagnosis() {
  console.log("=" .repeat(60));
  console.log("🔍 开始综合诊断");
  console.log("=" .repeat(60));

  try {
    // 1. 检查扩展基本状态
    console.log("\n📋 1. 扩展基本状态检查");
    console.log("-".repeat(30));
    
    if (typeof chrome === 'undefined') {
      console.error("❌ Chrome API不可用");
      return;
    }
    
    console.log("✅ Chrome API可用");
    try {
      console.log("✅ Extension ID:", chrome.runtime.id);
    } catch (e) {
      console.log("⚠️ Extension ID不可用 (可能在popup中运行)");
    }

    // 2. 获取当前标签页信息
    console.log("\n📋 2. 当前标签页信息");
    console.log("-".repeat(30));
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error("❌ 无法获取当前标签页");
      return;
    }
    
    console.log("✅ 标签页ID:", tab.id);
    console.log("✅ 标签页URL:", tab.url);
    console.log("✅ 标签页标题:", tab.title);
    console.log("✅ 标签页状态:", tab.status);

    // 3. 测试Content Script连接
    console.log("\n📋 3. Content Script连接测试");
    console.log("-".repeat(30));
    
    // 3.1 诊断ping测试
    try {
      console.log("🔍 发送诊断ping...");
      const pingResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "diagnostic-ping"
      });
      console.log("✅ 诊断ping成功:", pingResponse);
    } catch (pingError) {
      console.error("❌ 诊断ping失败:", pingError.message);
      
      // 尝试注入content script
      console.log("🔄 尝试重新注入content script...");
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content-simple.js']
        });
        console.log("✅ Content script重新注入成功");
        
        // 重新测试ping
        const retryPingResponse = await chrome.tabs.sendMessage(tab.id, {
          action: "diagnostic-ping"
        });
        console.log("✅ 重新注入后ping成功:", retryPingResponse);
      } catch (injectError) {
        console.error("❌ Content script注入失败:", injectError.message);
        return;
      }
    }

    // 4. 测试页面内容检测
    console.log("\n📋 4. 页面内容检测测试");
    console.log("-".repeat(30));
    
    try {
      console.log("🔍 发送页面内容检测请求...");
      const contentResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "detectPageContent"
      });
      
      if (contentResponse.success !== false) {
        console.log("✅ 页面内容检测成功!");
        console.log("  📎 附件数量:", contentResponse.attachments?.length || 0);
        console.log("  📄 页面文本长度:", contentResponse.pageText?.length || 0);
        console.log("  📊 总计数:", contentResponse.totalCount || 0);
        
        if (contentResponse.attachments && contentResponse.attachments.length > 0) {
          console.log("  📎 检测到的附件:");
          contentResponse.attachments.forEach((att, index) => {
            console.log(`    ${index + 1}. ${att.name} (${att.type}) - ${att.size || '未知大小'}`);
          });
        }
      } else {
        console.error("❌ 页面内容检测失败:", contentResponse.error);
        console.log("📊 调试信息:", contentResponse.contentScriptStatus);
      }
    } catch (contentError) {
      console.error("❌ 页面内容检测异常:", contentError.message);
    }

    // 5. 调试扫描测试
    console.log("\n📋 5. 调试扫描测试");
    console.log("-".repeat(30));
    
    try {
      console.log("🔍 发送调试扫描请求...");
      const debugResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "debug-scan"
      });
      
      if (debugResponse.success) {
        console.log("✅ 调试扫描成功!");
        console.log("  📊 扫描结果:", debugResponse.result);
        console.log("  🔧 调试信息:", debugResponse.debug);
      } else {
        console.error("❌ 调试扫描失败:", debugResponse.error);
      }
    } catch (debugError) {
      console.error("❌ 调试扫描异常:", debugError.message);
    }

    // 6. 页面DOM分析
    console.log("\n📋 6. 页面DOM分析");
    console.log("-".repeat(30));
    
    try {
      const domAnalysis = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            url: window.location.href,
            title: document.title,
            readyState: document.readyState,
            totalElements: document.querySelectorAll('*').length,
            links: document.querySelectorAll('a').length,
            pdfLinks: document.querySelectorAll('a[href*=".pdf"]').length,
            docxLinks: document.querySelectorAll('a[href*=".docx"]').length,
            downloadLinks: document.querySelectorAll('a[download]').length,
            hasContentScript: typeof window.SimpleContentDetector !== 'undefined',
            hasDetectFunction: typeof window.detectPageContent === 'function',
            contentScriptVersion: window.SimpleContentDetector ? 'available' : 'not found'
          };
        }
      });
      
      const analysis = domAnalysis[0].result;
      console.log("✅ DOM分析完成:");
      console.log("  🌐 URL:", analysis.url);
      console.log("  📄 标题:", analysis.title);
      console.log("  ⚡ 就绪状态:", analysis.readyState);
      console.log("  🔢 总元素数:", analysis.totalElements);
      console.log("  🔗 链接数:", analysis.links);
      console.log("  📎 PDF链接:", analysis.pdfLinks);
      console.log("  📎 DOCX链接:", analysis.docxLinks);
      console.log("  ⬇️ 下载链接:", analysis.downloadLinks);
      console.log("  🔧 Content Script:", analysis.hasContentScript ? "✅ 已加载" : "❌ 未加载");
      console.log("  🔧 检测函数:", analysis.hasDetectFunction ? "✅ 可用" : "❌ 不可用");
      
    } catch (domError) {
      console.error("❌ DOM分析失败:", domError.message);
    }

    // 7. 手动执行检测
    console.log("\n📋 7. 手动执行检测");
    console.log("-".repeat(30));
    
    try {
      const manualDetection = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            if (typeof window.detectPageContent === 'function') {
              return window.detectPageContent();
            } else if (typeof window.SimpleContentDetector !== 'undefined') {
              const detector = new window.SimpleContentDetector();
              return detector.detectAll();
            } else {
              return { error: 'No detection methods available' };
            }
          } catch (error) {
            return { error: error.message, stack: error.stack };
          }
        }
      });
      
      const detection = manualDetection[0].result;
      if (detection.error) {
        console.error("❌ 手动检测失败:", detection.error);
      } else {
        console.log("✅ 手动检测成功!");
        console.log("  📎 附件:", detection.totalCount || 0);
        console.log("  📄 文本长度:", detection.pageText?.length || 0);
      }
      
    } catch (manualError) {
      console.error("❌ 手动检测异常:", manualError.message);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 综合诊断完成");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ 诊断过程出错:", error);
  }
}

// 运行诊断
comprehensiveDiagnosis();