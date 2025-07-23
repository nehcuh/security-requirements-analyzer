// src/debug/diagnostic-tool.js - Chrome插件综合诊断工具
class ExtensionDiagnosticTool {
  constructor() {
    this.results = {};
    this.checks = [];
    this.isRunning = false;
    this.onProgress = null;
    this.onComplete = null;
  }

  /**
   * 运行所有诊断检查
   * @param {Object} options - 诊断选项
   * @returns {Object} 诊断结果
   */
  async runDiagnostics(options = {}) {
    if (this.isRunning) {
      throw new Error('诊断工具已在运行中');
    }

    this.isRunning = true;
    this.results = {
      timestamp: new Date().toISOString(),
      overall: 'unknown',
      checks: {},
      summary: {},
      recommendations: []
    };

    try {
      const checks = [
        { name: 'extension-context', desc: '检查插件上下文', fn: this.checkExtensionContext },
        { name: 'permissions', desc: '检查权限配置', fn: this.checkPermissions },
        { name: 'content-script', desc: '检查Content Script状态', fn: this.checkContentScript },
        { name: 'background-service', desc: '检查Background Service Worker', fn: this.checkBackgroundService },
        { name: 'storage-access', desc: '检查存储访问', fn: this.checkStorageAccess },
        { name: 'message-passing', desc: '检查消息传递机制', fn: this.checkMessagePassing },
        { name: 'page-compatibility', desc: '检查页面兼容性', fn: this.checkPageCompatibility },
        { name: 'api-configuration', desc: '检查API配置', fn: this.checkAPIConfiguration }
      ];

      for (let i = 0; i < checks.length; i++) {
        const check = checks[i];
        this.reportProgress(check.desc, i + 1, checks.length);

        try {
          const result = await check.fn.call(this);
          this.results.checks[check.name] = {
            status: result.status || 'pass',
            message: result.message || '正常',
            details: result.details || {},
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          this.results.checks[check.name] = {
            status: 'error',
            message: error.message,
            details: { error: error.stack },
            timestamp: new Date().toISOString()
          };
        }
      }

      this.generateSummary();
      this.generateRecommendations();

    } finally {
      this.isRunning = false;
      if (this.onComplete) {
        this.onComplete(this.results);
      }
    }

    return this.results;
  }

  /**
   * 检查插件上下文状态
   */
  async checkExtensionContext() {
    const details = {};

    // 检查Chrome APIs可用性
    details.chromeRuntime = typeof chrome !== 'undefined' && !!chrome.runtime;
    details.chromeStorage = typeof chrome !== 'undefined' && !!chrome.storage;
    details.chromeTabs = typeof chrome !== 'undefined' && !!chrome.tabs;
    details.chromeScripting = typeof chrome !== 'undefined' && !!chrome.scripting;

    // 检查运行环境
    details.isContentScript = typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime;
    details.isPopup = typeof window !== 'undefined' && window.location && window.location.protocol === 'chrome-extension:';
    details.isBackground = typeof self !== 'undefined' && typeof window === 'undefined';

    // 检查扩展ID
    if (chrome && chrome.runtime) {
      details.extensionId = chrome.runtime.id;
      details.extensionURL = chrome.runtime.getURL('');
    }

    const hasBasicAPIs = details.chromeRuntime && details.chromeStorage;

    return {
      status: hasBasicAPIs ? 'pass' : 'fail',
      message: hasBasicAPIs ? '插件上下文正常' : '插件上下文异常，基础API不可用',
      details
    };
  }

  /**
   * 检查权限配置
   */
  async checkPermissions() {
    const details = {};

    try {
      // 检查存储权限
      if (chrome.storage) {
        await chrome.storage.local.get(['test']);
        details.storageAccess = true;
      }

      // 检查活动标签页权限
      if (chrome.tabs) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        details.activeTabAccess = tabs.length > 0;
        details.currentTabId = tabs.length > 0 ? tabs[0].id : null;
        details.currentTabUrl = tabs.length > 0 ? tabs[0].url : null;
      }

      // 检查脚本注入权限
      if (chrome.scripting && details.currentTabId) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: details.currentTabId },
            func: () => true
          });
          details.scriptingAccess = true;
        } catch (error) {
          details.scriptingAccess = false;
          details.scriptingError = error.message;
        }
      }

    } catch (error) {
      details.permissionError = error.message;
    }

    const hasRequiredPermissions = details.storageAccess && details.activeTabAccess;

    return {
      status: hasRequiredPermissions ? 'pass' : 'fail',
      message: hasRequiredPermissions ? '权限配置正常' : '权限不足或配置异常',
      details
    };
  }

  /**
   * 检查Content Script状态
   */
  async checkContentScript() {
    const details = {};

    try {
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        return {
          status: 'fail',
          message: '无法获取当前标签页',
          details: { error: 'No active tab found' }
        };
      }

      details.tabId = tab.id;
      details.tabUrl = tab.url;
      details.tabTitle = tab.title;

      // 尝试向content script发送测试消息
      const startTime = Date.now();
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'diagnostic-ping',
          timestamp: startTime
        });

        details.responseTime = Date.now() - startTime;
        details.contentScriptActive = true;
        details.contentScriptResponse = response;

        // 如果支持detectContent，测试该功能
        try {
          const detectResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'detectContent'
          });
          details.detectContentWorking = !!detectResponse;
          details.detectContentResponse = detectResponse;
        } catch (error) {
          details.detectContentWorking = false;
          details.detectContentError = error.message;
        }

      } catch (error) {
        details.contentScriptActive = false;
        details.contentScriptError = error.message;
        details.isConnectionError = error.message.includes('Could not establish connection');
        details.isContextInvalidated = error.message.includes('Extension context invalidated');
      }

    } catch (error) {
      details.generalError = error.message;
    }

    return {
      status: details.contentScriptActive ? 'pass' : 'fail',
      message: details.contentScriptActive ? 'Content Script运行正常' : 'Content Script未响应或未注入',
      details
    };
  }

  /**
   * 检查Background Service Worker
   */
  async checkBackgroundService() {
    const details = {};

    try {
      // 检查background script是否响应
      const startTime = Date.now();
      const response = await chrome.runtime.sendMessage({
        action: 'diagnostic-ping',
        timestamp: startTime
      });

      details.responseTime = Date.now() - startTime;
      details.backgroundActive = true;
      details.backgroundResponse = response;

      // 测试LLM连接测试功能
      try {
        const testConfig = {
          provider: 'test',
          endpoint: 'https://api.example.com/test',
          apiKey: 'test-key',
          model: 'test-model'
        };

        const testResponse = await chrome.runtime.sendMessage({
          action: 'testLLMConnection',
          data: testConfig
        });

        details.llmTestAvailable = true;
        details.llmTestResponse = testResponse;
      } catch (error) {
        details.llmTestAvailable = false;
        details.llmTestError = error.message;
      }

    } catch (error) {
      details.backgroundActive = false;
      details.backgroundError = error.message;
    }

    return {
      status: details.backgroundActive ? 'pass' : 'fail',
      message: details.backgroundActive ? 'Background Service正常运行' : 'Background Service无响应',
      details
    };
  }

  /**
   * 检查存储访问
   */
  async checkStorageAccess() {
    const details = {};

    try {
      // 测试sync存储
      const testKey = 'diagnostic_test_' + Date.now();
      const testValue = { test: true, timestamp: Date.now() };

      await chrome.storage.sync.set({ [testKey]: testValue });
      const result = await chrome.storage.sync.get([testKey]);

      details.syncStorageWrite = true;
      details.syncStorageRead = result[testKey] && result[testKey].test === true;

      // 清理测试数据
      await chrome.storage.sync.remove([testKey]);
      details.syncStorageClean = true;

      // 测试local存储
      await chrome.storage.local.set({ [testKey]: testValue });
      const localResult = await chrome.storage.local.get([testKey]);

      details.localStorageWrite = true;
      details.localStorageRead = localResult[testKey] && localResult[testKey].test === true;

      await chrome.storage.local.remove([testKey]);
      details.localStorageClean = true;

      // 检查现有配置
      const config = await chrome.storage.sync.get(['llmConfig', 'threatModelingConfig']);
      details.hasLLMConfig = !!config.llmConfig;
      details.hasAPIKey = !!(config.llmConfig && config.llmConfig.apiKey);

    } catch (error) {
      details.storageError = error.message;
    }

    const storageWorking = details.syncStorageRead && details.localStorageRead;

    return {
      status: storageWorking ? 'pass' : 'fail',
      message: storageWorking ? '存储访问正常' : '存储访问异常',
      details
    };
  }

  /**
   * 检查消息传递机制
   */
  async checkMessagePassing() {
    const details = {};

    try {
      // 检查runtime消息
      const runtimeTest = await this.testRuntimeMessage();
      details.runtimeMessage = runtimeTest;

      // 检查tab消息（如果有活动标签页）
      const tabTest = await this.testTabMessage();
      details.tabMessage = tabTest;

      // 检查消息监听器
      details.hasRuntimeListener = !!chrome.runtime.onMessage.hasListeners();

    } catch (error) {
      details.messageError = error.message;
    }

    const messagingWorking = details.runtimeMessage.success && details.tabMessage.success;

    return {
      status: messagingWorking ? 'pass' : 'warning',
      message: messagingWorking ? '消息传递正常' : '消息传递部分异常',
      details
    };
  }

  /**
   * 检查页面兼容性
   */
  async checkPageCompatibility() {
    const details = {};

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab) {
        details.currentUrl = tab.url;
        details.protocol = new URL(tab.url).protocol;
        details.domain = new URL(tab.url).hostname;

        // 检查URL协议兼容性
        details.isHttps = details.protocol === 'https:';
        details.isHttp = details.protocol === 'http:';
        details.isChromeExtension = details.protocol === 'chrome-extension:';
        details.isChromePages = details.currentUrl.startsWith('chrome://');

        // 检查是否为支持的页面类型
        details.isWebPage = details.isHttps || details.isHttp;
        details.contentScriptShouldWork = details.isWebPage;

        // 检查特定平台
        const supportedPlatforms = ['pingcode', 'jira', 'confluence', 'teambition', 'worktile'];
        details.isSupportedPlatform = supportedPlatforms.some(platform =>
          details.domain.includes(platform)
        );

        // 尝试检测页面内容
        if (details.contentScriptShouldWork) {
          try {
            const contentResult = await chrome.tabs.sendMessage(tab.id, {
              action: 'detectContent'
            });
            details.contentDetectionWorking = !!contentResult;
            details.attachmentsFound = contentResult.attachments ? contentResult.attachments.length : 0;
            details.hasPageText = !!(contentResult.pageText && contentResult.pageText.length > 0);
          } catch (error) {
            details.contentDetectionWorking = false;
            details.contentDetectionError = error.message;
          }
        }
      }

    } catch (error) {
      details.compatibilityError = error.message;
    }

    return {
      status: details.contentScriptShouldWork && details.contentDetectionWorking ? 'pass' : 'warning',
      message: details.contentDetectionWorking ? '页面兼容性良好' : '页面可能不兼容或需要特殊处理',
      details
    };
  }

  /**
   * 检查API配置
   */
  async checkAPIConfiguration() {
    const details = {};

    try {
      const config = await chrome.storage.sync.get(['llmConfig', 'threatModelingConfig']);

      details.hasConfig = !!config.llmConfig;

      if (config.llmConfig) {
        const llmConfig = config.llmConfig;
        details.hasEndpoint = !!llmConfig.endpoint;
        details.hasApiKey = !!llmConfig.apiKey;
        details.hasModel = !!llmConfig.model;
        details.provider = llmConfig.provider;

        // 验证URL格式
        if (llmConfig.endpoint) {
          try {
            new URL(llmConfig.endpoint);
            details.validEndpointUrl = true;
          } catch (error) {
            details.validEndpointUrl = false;
          }
        }

        // 检查API密钥格式（不暴露实际密钥）
        if (llmConfig.apiKey) {
          details.apiKeyLength = llmConfig.apiKey.length;
          details.apiKeyFormat = llmConfig.apiKey.startsWith('sk-') ? 'openai' :
                                 llmConfig.apiKey.startsWith('claude-') ? 'anthropic' : 'unknown';
        }
      }

      details.configurationComplete = details.hasEndpoint && details.hasApiKey && details.hasModel;

    } catch (error) {
      details.configError = error.message;
    }

    return {
      status: details.configurationComplete ? 'pass' : 'warning',
      message: details.configurationComplete ? 'API配置完整' : 'API配置不完整，需要设置',
      details
    };
  }

  /**
   * 测试运行时消息
   */
  async testRuntimeMessage() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'diagnostic-ping',
        timestamp: Date.now()
      });
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试标签页消息
   */
  async testTabMessage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        return { success: false, error: 'No active tab' };
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'diagnostic-ping',
        timestamp: Date.now()
      });
      return { success: true, response, tabId: tab.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成诊断摘要
   */
  generateSummary() {
    const checks = this.results.checks;
    const summary = {
      total: Object.keys(checks).length,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: 0
    };

    Object.values(checks).forEach(check => {
      switch (check.status) {
        case 'pass':
          summary.passed++;
          break;
        case 'fail':
          summary.failed++;
          break;
        case 'warning':
          summary.warnings++;
          break;
        case 'error':
          summary.errors++;
          break;
      }
    });

    // 确定整体状态
    if (summary.failed > 0 || summary.errors > 0) {
      this.results.overall = 'fail';
    } else if (summary.warnings > 0) {
      this.results.overall = 'warning';
    } else {
      this.results.overall = 'pass';
    }

    this.results.summary = summary;
  }

  /**
   * 生成修复建议
   */
  generateRecommendations() {
    const checks = this.results.checks;
    const recommendations = [];

    // 插件上下文问题
    if (checks['extension-context'] && checks['extension-context'].status !== 'pass') {
      recommendations.push({
        priority: 'high',
        title: '重新加载插件',
        description: '插件上下文异常，建议在chrome://extensions/页面重新加载插件',
        action: 'reload-extension'
      });
    }

    // 权限问题
    if (checks['permissions'] && checks['permissions'].status !== 'pass') {
      recommendations.push({
        priority: 'high',
        title: '检查权限配置',
        description: '插件权限不足，检查manifest.json中的permissions配置',
        action: 'check-permissions'
      });
    }

    // Content Script问题
    if (checks['content-script'] && checks['content-script'].status !== 'pass') {
      const details = checks['content-script'].details;
      if (details.isConnectionError) {
        recommendations.push({
          priority: 'high',
          title: '刷新页面',
          description: 'Content Script未注入，刷新页面后重试',
          action: 'refresh-page'
        });
      } else if (details.isContextInvalidated) {
        recommendations.push({
          priority: 'high',
          title: '重启浏览器',
          description: '插件上下文失效，重启浏览器可能解决问题',
          action: 'restart-browser'
        });
      }
    }

    // API配置问题
    if (checks['api-configuration'] && checks['api-configuration'].status !== 'pass') {
      recommendations.push({
        priority: 'medium',
        title: '配置API设置',
        description: '完善LLM API配置以启用完整功能',
        action: 'configure-api'
      });
    }

    // Background Service问题
    if (checks['background-service'] && checks['background-service'].status !== 'pass') {
      recommendations.push({
        priority: 'high',
        title: '检查Background Service',
        description: 'Background Service Worker无响应，检查background.js是否正常运行',
        action: 'check-background'
      });
    }

    this.results.recommendations = recommendations;
  }

  /**
   * 报告进度
   */
  reportProgress(message, current, total) {
    if (this.onProgress) {
      this.onProgress({
        message,
        current,
        total,
        percentage: Math.round((current / total) * 100)
      });
    }
  }

  /**
   * 导出诊断报告
   */
  exportReport() {
    const report = {
      ...this.results,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      chromeVersion: navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'unknown'
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-diagnostic-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 获取简化的状态报告
   */
  getStatusReport() {
    if (!this.results.summary) {
      return { status: 'not-run', message: '诊断未运行' };
    }

    const { overall, summary } = this.results;
    const messages = {
      pass: `所有检查通过 (${summary.passed}/${summary.total})`,
      warning: `部分检查有警告 (${summary.warnings} 个警告)`,
      fail: `存在问题 (${summary.failed} 个失败, ${summary.errors} 个错误)`
    };

    return {
      status: overall,
      message: messages[overall] || '状态未知',
      summary
    };
  }
}

// 全局实例
if (typeof window !== 'undefined') {
  window.ExtensionDiagnosticTool = ExtensionDiagnosticTool;
}

// 如果在background script中
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.ExtensionDiagnosticTool = ExtensionDiagnosticTool;
}

export default ExtensionDiagnosticTool;
