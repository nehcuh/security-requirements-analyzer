// 调试UI显示问题的脚本
console.log("🔍 调试UI显示问题");

async function debugUIDisplay() {
  try {
    console.log("🔍 开始调试UI显示...");
    
    // 1. 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error("❌ 无法获取当前标签页");
      return;
    }
    
    console.log("✅ 当前标签页:", tab.url);
    
    // 2. 确保Content Script存在
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'diagnostic-ping' });
      console.log("✅ Content Script已存在");
    } catch (error) {
      console.log("⚠️ Content Script不存在，正在注入...");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/content-simple.js']
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("✅ Content Script注入完成");
    }
    
    // 3. 测试页面内容检测
    console.log("🔍 测试页面内容检测...");
    const contentResponse = await chrome.tabs.sendMessage(tab.id, {
      action: "detectPageContent"
    });
    
    console.log("📊 检测响应:", contentResponse);
    
    if (contentResponse.success !== false) {
      console.log("✅ 页面内容检测成功!");
      console.log("  📎 附件数量:", contentResponse.attachments?.length || 0);
      console.log("  📄 页面文本长度:", contentResponse.pageText?.length || 0);
      
      // 4. 模拟popup的updateUI逻辑
      console.log("🔍 模拟popup UI更新...");
      
      const attachments = contentResponse.attachments || [];
      const pageText = contentResponse.pageText || "";
      
      // 检查UI元素是否存在
      const attachmentsSection = document.getElementById("attachments-section");
      const attachmentList = document.getElementById("attachment-list");
      const attachmentSummary = document.getElementById("attachment-summary");
      const textSection = document.getElementById("text-section");
      const textPreview = document.getElementById("text-preview");
      
      console.log("🔍 UI元素检查:");
      console.log("  - attachments-section:", attachmentsSection ? "✅ 存在" : "❌ 不存在");
      console.log("  - attachment-list:", attachmentList ? "✅ 存在" : "❌ 不存在");
      console.log("  - attachment-summary:", attachmentSummary ? "✅ 存在" : "❌ 不存在");
      console.log("  - text-section:", textSection ? "✅ 存在" : "❌ 不存在");
      console.log("  - text-preview:", textPreview ? "✅ 存在" : "❌ 不存在");
      
      // 5. 模拟显示附件
      if (attachments.length > 0 && attachmentsSection && attachmentList) {
        console.log("🔍 模拟显示附件...");
        
        attachmentsSection.style.display = "block";
        attachmentList.innerHTML = "";
        
        attachments.forEach((attachment, index) => {
          console.log(`  处理附件 ${index + 1}:`, attachment);
          
          const item = document.createElement("div");
          item.className = "attachment-item";
          item.innerHTML = `
            <input type="radio" name="attachment" value="${index}" id="attachment-${index}">
            <div class="attachment-content">
              <div class="attachment-name">${attachment.name}</div>
              <div class="attachment-metadata">
                <span class="attachment-type">${attachment.type}</span>
                <span class="attachment-size">${attachment.size || '未知大小'}</span>
              </div>
            </div>
          `;
          
          attachmentList.appendChild(item);
        });
        
        if (attachmentSummary) {
          attachmentSummary.style.display = "block";
          const countEl = document.getElementById("attachment-count");
          const prdCountEl = document.getElementById("prd-count");
          if (countEl) countEl.textContent = attachments.length;
          if (prdCountEl) prdCountEl.textContent = attachments.filter(att => att.isPRD).length;
        }
        
        console.log("✅ 附件显示完成");
      } else if (attachments.length === 0) {
        console.log("⚠️ 没有检测到附件");
        const debugTip = document.getElementById("attachment-debug");
        if (debugTip) {
          debugTip.style.display = "block";
        }
      }
      
      // 6. 模拟显示页面文本
      if (pageText.trim() && textSection && textPreview) {
        console.log("🔍 模拟显示页面文本...");
        textSection.style.display = "block";
        textPreview.textContent = pageText.substring(0, 500) + (pageText.length > 500 ? "..." : "");
        console.log("✅ 页面文本显示完成");
      }
      
    } else {
      console.error("❌ 页面内容检测失败:", contentResponse.error);
    }
    
    // 7. 检查LLM配置
    console.log("🔍 检查LLM配置...");
    try {
      const configResult = await chrome.storage.sync.get(['llmConfig']);
      const llmConfig = configResult.llmConfig || {};
      
      console.log("📊 当前LLM配置:", llmConfig);
      
      if (!llmConfig.endpoint || !llmConfig.model) {
        console.log("⚠️ LLM配置不完整");
        console.log("  需要配置: endpoint, model");
        console.log("  建议配置:");
        console.log("    endpoint: http://localhost:1234/v1/chat/completions");
        console.log("    model: 你的模型名称");
        console.log("    apiKey: 你的API密钥（如果需要）");
      } else {
        console.log("✅ LLM配置看起来完整");
        
        // 测试LLM连接
        console.log("🔍 测试LLM连接...");
        try {
          const testResult = await chrome.runtime.sendMessage({
            action: "testLLMConnection",
            data: llmConfig
          });
          
          if (testResult.success) {
            console.log("✅ LLM连接测试成功:", testResult.message);
          } else {
            console.error("❌ LLM连接测试失败:", testResult.error);
          }
        } catch (testError) {
          console.error("❌ LLM连接测试异常:", testError);
        }
      }
    } catch (configError) {
      console.error("❌ 获取配置失败:", configError);
    }
    
    console.log("🎉 UI显示调试完成");
    
  } catch (error) {
    console.error("❌ 调试过程出错:", error);
  }
}

// 运行调试
debugUIDisplay();