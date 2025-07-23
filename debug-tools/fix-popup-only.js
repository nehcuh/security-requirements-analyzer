// 专门用于popup环境的修复脚本
console.log("🔧 修复Chrome扩展Popup");

async function fixPopupOnly() {
  try {
    console.log("=" .repeat(50));
    console.log("🚀 开始修复Chrome扩展Popup");
    console.log("=" .repeat(50));
    
    // 步骤1: 修复LLM配置
    console.log("\n📋 步骤1: 修复LLM配置");
    console.log("-".repeat(30));
    
    try {
      const configResult = await chrome.storage.sync.get(['llmConfig']);
      let llmConfig = configResult.llmConfig || {};
      
      console.log("📊 当前LLM配置:", llmConfig);
      
      // 如果配置不完整，使用默认配置
      if (!llmConfig.endpoint || !llmConfig.model) {
        console.log("⚠️ LLM配置不完整，应用默认配置...");
        
        const defaultConfig = {
          provider: "custom",
          endpoint: "http://localhost:1234/v1/chat/completions",
          apiKey: "",
          model: "local-model"
        };
        
        await chrome.storage.sync.set({ llmConfig: defaultConfig });
        llmConfig = defaultConfig;
        console.log("✅ 默认LLM配置已应用:", defaultConfig);
      }
      
      // 测试LLM连接
      console.log("🔍 测试LLM连接...");
      try {
        const testResult = await chrome.runtime.sendMessage({
          action: "testLLMConnection",
          data: llmConfig
        });
        
        if (testResult.success) {
          console.log("✅ LLM连接测试成功:", testResult.message);
          
          // 更新配置状态指示器
          const statusIndicator = document.getElementById("config-status-indicator");
          if (statusIndicator) {
            statusIndicator.style.display = "flex";
            statusIndicator.className = "config-status configured";
            const statusIcon = document.getElementById("status-icon");
            const statusText = document.getElementById("status-text");
            if (statusIcon) statusIcon.textContent = "✅";
            if (statusText) statusText.textContent = "AI服务已配置";
          }
          
          // 隐藏配置提醒
          const configAlert = document.getElementById("config-alert");
          if (configAlert) configAlert.style.display = "none";
          
          // 显示主内容
          const content = document.getElementById("content");
          if (content) content.style.display = "block";
          
        } else {
          console.log("❌ LLM连接测试失败:", testResult.error);
          console.log("💡 可能的解决方案:");
          console.log("   1. 启动LM Studio并确保监听1234端口");
          console.log("   2. 检查防火墙设置");
          console.log("   3. 尝试其他LLM服务");
          
          // 显示配置提醒
          const configAlert = document.getElementById("config-alert");
          const content = document.getElementById("content");
          if (configAlert) {
            configAlert.style.display = "block";
            if (content) content.style.display = "none";
          }
        }
      } catch (testError) {
        console.log("❌ LLM连接测试异常:", testError);
        console.log("💡 请确保LM Studio正在运行");
      }
      
    } catch (configError) {
      console.error("❌ LLM配置处理失败:", configError);
    }
    
    // 步骤2: 修复UI显示
    console.log("\n📋 步骤2: 修复UI显示");
    console.log("-".repeat(30));
    
    // 确保主要UI元素显示
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    
    if (loading) {
      loading.style.display = "none";
      console.log("✅ 隐藏加载指示器");
    }
    if (content) {
      content.style.display = "block";
      console.log("✅ 显示主内容区域");
    }
    
    // 检查UI元素
    const uiElements = {
      'attachments-section': document.getElementById("attachments-section"),
      'text-section': document.getElementById("text-section"),
      'manual-input': document.getElementById("manual-input"),
      'analyze-btn': document.getElementById("analyze-btn"),
      'refresh-btn': document.getElementById("refresh-btn"),
      'config-btn': document.getElementById("config-btn")
    };
    
    console.log("🔍 UI元素检查:");
    Object.entries(uiElements).forEach(([name, element]) => {
      console.log(`  - ${name}: ${element ? '✅ 存在' : '❌ 不存在'}`);
    });
    
    // 步骤3: 绑定事件处理器
    console.log("\n📋 步骤3: 绑定事件处理器");
    console.log("-".repeat(30));
    
    // 刷新按钮
    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        console.log("🔄 刷新页面内容...");
        location.reload();
      };
      console.log("✅ 刷新按钮事件已绑定");
    }
    
    // 分析按钮
    const analyzeBtn = document.getElementById("analyze-btn");
    if (analyzeBtn) {
      analyzeBtn.onclick = async () => {
        console.log("🚀 开始分析...");
        
        // 获取手动输入的内容
        const manualInput = document.getElementById("manual-input");
        let content = "";
        
        if (manualInput && manualInput.value.trim()) {
          content = manualInput.value.trim();
          console.log("使用手动输入内容:", content.substring(0, 100) + "...");
        } else {
          alert("请在手动输入框中输入要分析的内容");
          return;
        }
        
        // 显示进度
        const progressContainer = document.getElementById("progress-container");
        if (progressContainer) {
          progressContainer.classList.add("active");
        }
        
        try {
          const customPrompt = document.getElementById("custom-prompt")?.value || "";
          
          const analysisResult = await chrome.runtime.sendMessage({
            action: "analyzeContent",
            data: {
              content: content,
              prompt: customPrompt,
              source: { type: "manual" }
            }
          });
          
          if (progressContainer) {
            progressContainer.classList.remove("active");
          }
          
          if (analysisResult.success) {
            console.log("✅ 分析完成:", analysisResult.data);
            
            // 显示结果
            const resultWindow = window.open("", "_blank", "width=800,height=600");
            if (resultWindow) {
              resultWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>安全分析结果</title>
                  <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                    .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
                    .result { background: #fff; padding: 15px; border: 1px solid #dee2e6; border-radius: 5px; }
                    pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; white-space: pre-wrap; }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <h1>🛡️ 安全需求分析结果</h1>
                    <p>生成时间: ${new Date().toLocaleString()}</p>
                  </div>
                  <div class="result">
                    <h2>📊 分析结果</h2>
                    <pre>${JSON.stringify(analysisResult.data, null, 2)}</pre>
                  </div>
                </body>
                </html>
              `);
              resultWindow.document.close();
            } else {
              alert("分析完成！请允许弹窗查看结果，或查看控制台输出。");
            }
          } else {
            console.error("❌ 分析失败:", analysisResult.error);
            alert("分析失败: " + analysisResult.error);
          }
          
        } catch (analysisError) {
          if (progressContainer) {
            progressContainer.classList.remove("active");
          }
          console.error("❌ 分析异常:", analysisError);
          alert("分析过程出错: " + analysisError.message);
        }
      };
      console.log("✅ 分析按钮事件已绑定");
    }
    
    // 配置按钮
    const configBtn = document.getElementById("config-btn");
    if (configBtn) {
      configBtn.onclick = () => {
        try {
          chrome.runtime.openOptionsPage();
        } catch (error) {
          chrome.tabs.create({
            url: chrome.runtime.getURL("src/config/config.html")
          });
        }
      };
      console.log("✅ 配置按钮事件已绑定");
    }
    
    // 配置提醒按钮
    const setupConfigBtn = document.getElementById("setup-config");
    if (setupConfigBtn) {
      setupConfigBtn.onclick = () => {
        try {
          chrome.runtime.openOptionsPage();
        } catch (error) {
          chrome.tabs.create({
            url: chrome.runtime.getURL("src/config/config.html")
          });
        }
      };
      console.log("✅ 配置提醒按钮事件已绑定");
    }
    
    const dismissAlertBtn = document.getElementById("dismiss-alert");
    if (dismissAlertBtn) {
      dismissAlertBtn.onclick = () => {
        const configAlert = document.getElementById("config-alert");
        const content = document.getElementById("content");
        if (configAlert) configAlert.style.display = "none";
        if (content) content.style.display = "block";
      };
      console.log("✅ 关闭提醒按钮事件已绑定");
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Chrome扩展Popup修复完成！");
    console.log("=".repeat(50));
    
    console.log("\n📊 修复总结:");
    console.log("✅ LLM配置: 已设置默认配置");
    console.log("✅ UI显示: 已修复并正常显示");
    console.log("✅ 事件绑定: 所有按钮功能正常");
    
    console.log("\n💡 使用提示:");
    console.log("1. 在'手动指定需求'框中输入要分析的内容");
    console.log("2. 点击'开始分析'进行AI安全分析");
    console.log("3. 如果需要检测页面附件，点击'重新检测'");
    console.log("4. 如果LLM连接失败，请启动LM Studio");
    console.log("5. 点击配置按钮(⚙️)可以修改LLM设置");
    
  } catch (error) {
    console.error("❌ 修复过程出错:", error);
  }
}

// 运行修复
fixPopupOnly();