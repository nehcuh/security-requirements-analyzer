// 快速配置LLM的脚本
console.log("⚙️ 快速LLM配置工具");

async function quickLLMConfig() {
  console.log("🔧 开始快速配置LLM...");
  
  // 常见的LLM配置选项
  const commonConfigs = {
    "本地LM Studio": {
      provider: "custom",
      endpoint: "http://localhost:1234/v1/chat/completions",
      apiKey: "",
      model: "local-model"
    },
    "本地Ollama": {
      provider: "custom", 
      endpoint: "http://localhost:11434/v1/chat/completions",
      apiKey: "",
      model: "llama2"
    },
    "OpenAI": {
      provider: "openai",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "your-openai-api-key",
      model: "gpt-3.5-turbo"
    },
    "自定义": {
      provider: "custom",
      endpoint: "http://your-endpoint/v1/chat/completions",
      apiKey: "your-api-key",
      model: "your-model"
    }
  };
  
  console.log("📋 可用配置选项:");
  Object.keys(commonConfigs).forEach((name, index) => {
    const config = commonConfigs[name];
    console.log(`${index + 1}. ${name}:`);
    console.log(`   Endpoint: ${config.endpoint}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   需要API Key: ${config.apiKey ? '是' : '否'}`);
  });
  
  // 检查当前配置
  try {
    const result = await chrome.storage.sync.get(['llmConfig']);
    const currentConfig = result.llmConfig || {};
    
    console.log("\n📊 当前配置:", currentConfig);
    
    if (!currentConfig.endpoint) {
      console.log("\n⚠️ 未检测到LLM配置，建议使用以下配置:");
      
      const recommendedConfig = commonConfigs["本地LM Studio"];
      console.log("🎯 推荐配置 (本地LM Studio):");
      console.log("   适合本地开发和测试");
      console.log("   不需要API密钥");
      console.log("   配置:", JSON.stringify(recommendedConfig, null, 2));
      
      // 自动应用推荐配置
      console.log("\n🔄 自动应用推荐配置...");
      await chrome.storage.sync.set({ llmConfig: recommendedConfig });
      console.log("✅ 配置已保存");
      
      // 测试配置
      console.log("🔍 测试新配置...");
      try {
        const testResult = await chrome.runtime.sendMessage({
          action: "testLLMConnection",
          data: recommendedConfig
        });
        
        if (testResult.success) {
          console.log("✅ 配置测试成功:", testResult.message);
          console.log("🎉 LLM配置完成，现在可以使用分析功能了！");
        } else {
          console.log("❌ 配置测试失败:", testResult.error);
          console.log("💡 可能的解决方案:");
          console.log("   1. 确保LM Studio正在运行并监听1234端口");
          console.log("   2. 检查防火墙设置");
          console.log("   3. 尝试其他配置选项");
        }
      } catch (testError) {
        console.log("❌ 测试配置时出错:", testError);
      }
      
    } else {
      console.log("✅ 已有LLM配置");
      
      // 测试现有配置
      console.log("🔍 测试现有配置...");
      try {
        const testResult = await chrome.runtime.sendMessage({
          action: "testLLMConnection", 
          data: currentConfig
        });
        
        if (testResult.success) {
          console.log("✅ 现有配置工作正常:", testResult.message);
        } else {
          console.log("❌ 现有配置有问题:", testResult.error);
          console.log("💡 建议重新配置或检查服务状态");
        }
      } catch (testError) {
        console.log("❌ 测试现有配置时出错:", testError);
      }
    }
    
  } catch (error) {
    console.error("❌ 配置过程出错:", error);
  }
}

// 手动设置配置的函数
window.setLLMConfig = async function(configName) {
  const configs = {
    "lmstudio": {
      provider: "custom",
      endpoint: "http://localhost:1234/v1/chat/completions",
      apiKey: "",
      model: "local-model"
    },
    "ollama": {
      provider: "custom",
      endpoint: "http://localhost:11434/v1/chat/completions", 
      apiKey: "",
      model: "llama2"
    }
  };
  
  const config = configs[configName];
  if (config) {
    await chrome.storage.sync.set({ llmConfig: config });
    console.log("✅ 配置已设置:", config);
    
    // 测试配置
    const testResult = await chrome.runtime.sendMessage({
      action: "testLLMConnection",
      data: config
    });
    console.log("测试结果:", testResult);
  } else {
    console.log("❌ 未知配置名称，可用选项: lmstudio, ollama");
  }
};

// 运行快速配置
quickLLMConfig();

console.log("\n💡 使用提示:");
console.log("如需手动设置配置，可以运行:");
console.log("  setLLMConfig('lmstudio')  // 设置LM Studio配置");
console.log("  setLLMConfig('ollama')    // 设置Ollama配置");