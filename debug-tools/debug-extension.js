// Chrome插件诊断脚本
// 在浏览器控制台中运行此脚本来诊断插件问题

console.log("🔍 开始Chrome插件诊断...");

// 1. 检查content script是否加载
console.log("1. 检查Content Script状态:");
console.log("- SimpleContentDetector类:", typeof window.SimpleContentDetector);
console.log("- detectPageContent函数:", typeof window.detectPageContent);

// 2. 测试页面检测功能
if (typeof window.detectPageContent === 'function') {
    console.log("2. 测试页面检测功能:");
    try {
        const result = window.detectPageContent();
        console.log("✅ 页面检测成功:", result);
    } catch (error) {
        console.error("❌ 页面检测失败:", error);
    }
} else {
    console.error("❌ detectPageContent函数不存在");
}

// 3. 检查页面基本信息
console.log("3. 页面基本信息:");
console.log("- URL:", window.location.href);
console.log("- 标题:", document.title);
console.log("- 就绪状态:", document.readyState);
console.log("- DOM元素数量:", document.querySelectorAll("*").length);

// 4. 检查可能的附件链接
console.log("4. 检查附件链接:");
const attachmentSelectors = [
    'a[href*=".pdf"]',
    'a[href*=".docx"]', 
    'a[href*=".doc"]',
    'a[download]',
    'a[href*="download"]'
];

attachmentSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
        console.log(`- ${selector}: ${elements.length}个`);
    }
});

// 5. 测试Chrome扩展API
console.log("5. 测试Chrome扩展API:");
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log("✅ Chrome扩展API可用");
    console.log("- Extension ID:", chrome.runtime.id);
} else {
    console.error("❌ Chrome扩展API不可用");
}

// 6. 检查错误信息
console.log("6. 检查控制台错误:");
// 这里会显示之前的错误信息

console.log("🏁 诊断完成");