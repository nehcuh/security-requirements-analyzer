// 手动注入Content Script的脚本
console.log("🔧 手动注入Content Script");

async function manualInjectContentScript() {
  try {
    console.log("🔍 开始手动注入...");
    
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error("❌ 无法获取当前标签页");
      return;
    }
    
    console.log("✅ 当前标签页:", tab.url);
    
    // 注入Content Script
    console.log("🔄 注入Content Script...");
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/content-simple.js']
    });
    
    console.log("✅ Content Script注入成功");
    
    // 等待一下让脚本初始化
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试连接
    console.log("🔍 测试连接...");
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "diagnostic-ping"
    });
    
    console.log("✅ 连接测试成功:", response);
    
    // 测试页面内容检测
    console.log("🔍 测试页面内容检测...");
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
    } else {
      console.error("❌ 页面内容检测失败:", contentResponse.error);
      if (contentResponse.contentScriptStatus) {
        console.log("📊 调试信息:", contentResponse.contentScriptStatus);
      }
    }
    
    console.log("🎉 手动注入完成，现在可以使用扩展了！");
    
  } catch (error) {
    console.error("❌ 手动注入失败:", error);
  }
}

// 运行手动注入
manualInjectContentScript();