// 基础popup功能测试
console.log("🧪 测试Chrome扩展Popup基础功能");

function testPopupBasic() {
  console.log("=" .repeat(40));
  console.log("🔍 开始基础功能测试");
  console.log("=" .repeat(40));
  
  // 1. 检查DOM环境
  console.log("\n📋 1. DOM环境检查");
  console.log("-".repeat(20));
  console.log("Document:", typeof document !== 'undefined' ? '✅ 可用' : '❌ 不可用');
  console.log("Window:", typeof window !== 'undefined' ? '✅ 可用' : '❌ 不可用');
  console.log("Chrome API:", typeof chrome !== 'undefined' ? '✅ 可用' : '❌ 不可用');
  
  // 2. 检查关键UI元素
  console.log("\n📋 2. UI元素检查");
  console.log("-".repeat(20));
  
  const keyElements = [
    'loading',
    'content', 
    'config-alert',
    'attachments-section',
    'text-section',
    'manual-input',
    'custom-prompt',
    'analyze-btn',
    'refresh-btn',
    'config-btn',
    'config-status-indicator'
  ];
  
  keyElements.forEach(id => {
    const element = document.getElementById(id);
    console.log(`${id}: ${element ? '✅ 存在' : '❌ 不存在'}`);
  });
  
  // 3. 检查Chrome API功能
  console.log("\n📋 3. Chrome API功能检查");
  console.log("-".repeat(20));
  
  if (typeof chrome !== 'undefined') {
    console.log("chrome.storage:", chrome.storage ? '✅ 可用' : '❌ 不可用');
    console.log("chrome.runtime:", chrome.runtime ? '✅ 可用' : '❌ 不可用');
    console.log("chrome.tabs:", chrome.tabs ? '✅ 可用' : '❌ 不可用');
    console.log("chrome.scripting:", chrome.scripting ? '✅ 可用' : '❌ 不可用');
  }
  
  // 4. 测试存储访问
  console.log("\n📋 4. 存储访问测试");
  console.log("-".repeat(20));
  
  if (chrome && chrome.storage) {
    chrome.storage.sync.get(['llmConfig']).then(result => {
      console.log("✅ 存储访问成功");
      console.log("当前LLM配置:", result.llmConfig || '未配置');
    }).catch(error => {
      console.log("❌ 存储访问失败:", error);
    });
  }
  
  // 5. 测试消息传递
  console.log("\n📋 5. 消息传递测试");
  console.log("-".repeat(20));
  
  if (chrome && chrome.runtime) {
    chrome.runtime.sendMessage({
      action: "diagnostic-ping"
    }).then(response => {
      console.log("✅ 消息传递成功:", response);
    }).catch(error => {
      console.log("❌ 消息传递失败:", error);
    });
  }
  
  // 6. 基础UI操作测试
  console.log("\n📋 6. 基础UI操作测试");
  console.log("-".repeat(20));
  
  // 显示主内容区域
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  
  if (loading) {
    loading.style.display = 'none';
    console.log("✅ 隐藏加载指示器");
  }
  
  if (content) {
    content.style.display = 'block';
    console.log("✅ 显示主内容区域");
  }
  
  // 测试手动输入框
  const manualInput = document.getElementById('manual-input');
  if (manualInput) {
    manualInput.placeholder = "测试: 请输入要分析的安全需求内容...";
    console.log("✅ 手动输入框可用");
  }
  
  console.log("\n" + "=".repeat(40));
  console.log("🎉 基础功能测试完成");
  console.log("=".repeat(40));
  
  console.log("\n💡 测试结果总结:");
  console.log("- 如果所有项目都显示✅，说明popup环境正常");
  console.log("- 如果有❌项目，说明对应功能可能有问题");
  console.log("- 现在可以运行 fix-popup-only.js 进行修复");
}

// 运行测试
testPopupBasic();