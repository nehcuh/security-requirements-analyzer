// debug-scripts.js - 调试脚本集合
const DebugScripts = {
    // 测试content script功能
    testContentScript() {
        console.log('🧪 Testing Content Script...');

        // 测试页面检测
        if (typeof ContentDetector !== 'undefined') {
            const detector = new ContentDetector();
            const attachments = detector.detectAttachments();
            const pageText = detector.detectPageText();

            console.log('Detected attachments:', attachments);
            console.log('Page text length:', pageText.length);
            console.log('Page type:', detector.detectPageType());
        } else {
            console.error('ContentDetector not found');
        }
    },

    // 测试popup功能
    testPopup() {
        console.log('🧪 Testing Popup...');

        // 模拟popup消息
        chrome.runtime.sendMessage({
            action: 'detectContent'
        }, (response) => {
            console.log('Popup response:', response);
        });
    },

    // 测试background script
    async testBackground() {
        console.log('🧪 Testing Background Script...');

        try {
            // 测试配置加载
            const config = await chrome.storage.sync.get(['llmConfig']);
            console.log('Current config:', config);

            // 测试LLM连接（如果配置了）
            if (config.llmConfig && config.llmConfig.apiKey) {
                const testResult = await chrome.runtime.sendMessage({
                    action: 'testLLMConnection',
                    data: config.llmConfig
                });
                console.log('LLM test result:', testResult);
            }
        } catch (error) {
            console.error('Background test failed:', error);
        }
    },

    // 测试存储功能
    async testStorage() {
        console.log('🧪 Testing Storage...');

        // 写入测试数据
        await chrome.storage.sync.set({
            debugTest: {
                timestamp: Date.now(),
                data: 'test data'
            }
        });

        // 读取测试数据
        const result = await chrome.storage.sync.get(['debugTest']);
        console.log('Storage test result:', result);

        // 清理测试数据
        await chrome.storage.sync.remove(['debugTest']);
    },

    // 模拟分析流程
    async simulateAnalysis() {
        console.log('🧪 Simulating Analysis Flow...');

        const testContent = {
            type: 'manual',
            content: '用户登录功能需求：用户可以通过用户名和密码登录系统，支持记住密码功能。'
        };

        try {
            const result = await chrome.runtime.sendMessage({
                action: 'analyzeContent',
                data: {
                    content: testContent,
                    prompt: '请分析这个登录功能的安全风险',
                    source: { type: 'manual' }
                }
            });

            console.log('Analysis simulation result:', result);
        } catch (error) {
            console.error('Analysis simulation failed:', error);
        }
    },

    // 检查权限
    checkPermissions() {
        console.log('🧪 Checking Permissions...');

        const permissions = {
            activeTab: !!chrome.tabs,
            storage: !!chrome.storage,
            scripting: !!chrome.scripting,
            runtime: !!chrome.runtime
        };

        console.log('Available permissions:', permissions);
        return permissions;
    },

    // 运行所有测试
    async runAllTests() {
        console.log('🚀 Running All Debug Tests...');

        this.checkPermissions();
        await this.testStorage();
        this.testContentScript();
        await this.testBackground();

        console.log('✅ All tests completed');
    }
};

// 在不同环境中暴露调试脚本
if (typeof window !== 'undefined') {
    window.DebugScripts = DebugScripts;
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
    // 在扩展环境中自动运行基础检查
    DebugScripts.checkPermissions();
}

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugScripts;
}