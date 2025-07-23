// 测试扩展修复效果的脚本
console.log("🧪 测试扩展修复效果");

async function testExtensionFix() {
  try {
    console.log("🔍 开始测试扩展修复...");
    
    // 1. 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error("❌ 无法获取当前标签页");
      return;
    }
    
    console.log("✅ 当前标签页:", tab.url);
    
    // 2. 测试Content Script是否存在
    console.log("🔍 测试Content Script连接...");
    let contentScriptExists = false;
    
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, {
        action: "diagnostic-ping"
      });
      console.log("✅ Content Script已存在:", pingResponse);
      contentScriptExists = true;
    } catch (error) {
      console.log("⚠️ Content Script不存在，需要注入");
    }
    
    // 3. 如果不存在，手动注入
    if (!contentScriptExists) {
      console.log("🔄 手动注入Content Script...");
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content-simple.js']
        });
        
        // 等待初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 验证注入成功
        const verifyResponse = await chrome.tabs.sendMessage(tab.id, {
          action: "diagnostic-ping"
        });
        console.log("✅ Content Script注入成功:", verifyResponse);
      } catch (injectError) {
        console.error("❌ Content Script注入失败:", injectError);
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
            console.log(`    ${index + 1}. ${att.name} (${att.type}) - ${att.size || '未知大小'}`);
          });
        }
        
        // 5. 测试扩展popup功能
        console.log("🔍 模拟扩展popup调用...");
        
        // 模拟popup的detectPageContent调用
        const popupTest = {
          attachments: contentResponse.attachments || [],
          pageText: contentResponse.pageText || "",
          selectedSource: null
        };
        
        console.log("✅ 扩展popup数据准备完成:");
        console.log("  - 附件数据:", popupTest.attachments.length, "个");
        console.log("  - 页面文本:", popupTest.pageText.length, "字符");
        
        // 6. 测试分析功能准备
        if (popupTest.attachments.length > 0 || popupTest.pageText.length > 0) {
          console.log("✅ 扩展已准备好进行安全分析");
          console.log("  推荐使用:", popupTest.attachments.length > 0 ? "附件内容" : "页面文本");
        } else {
          console.log("⚠️ 没有可分析的内容");
        }
        
      } else {
        console.error("❌ 页面内容检测失败:", contentResponse.error);
        if (contentResponse.contentScriptStatus) {
          console.log("📊 调试信息:", contentResponse.contentScriptStatus);
        }
      }
    } catch (contentError) {
      console.error("❌ 页面内容检测异常:", contentError);
    }
    
    console.log("🎉 扩展修复测试完成");
    
  } catch (error) {
    console.error("❌ 测试过程出错:", error);
  }
}

// 运行测试
testExtensionFix();