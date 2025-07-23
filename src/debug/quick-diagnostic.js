// src/debug/quick-diagnostic.js - 简化诊断脚本，集成到popup中使用
class QuickDiagnostic {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
      recommendations: [],
    };
  }

  /**
   * 运行快速诊断检查
   * @returns {Object} 诊断结果
   */
  async runQuickChecks() {
    console.log("🔍 开始快速诊断...");

    const checks = [
      { name: "chrome-apis", fn: this.checkChromeAPIs },
      { name: "extension-context", fn: this.checkExtensionContext },
      { name: "active-tab", fn: this.checkActiveTab },
      { name: "content-script", fn: this.checkContentScript },
      { name: "background-service", fn: this.checkBackgroundService },
      { name: "storage-access", fn: this.checkStorageAccess },
    ];

    for (const check of checks) {
      try {
        console.log(`检查: ${check.name}`);
        const result = await check.fn.call(this);
        this.results.checks[check.name] = {
          status: result.status || "pass",
          message: result.message || "正常",
          details: result.details || {},
          timestamp: new Date().toISOString(),
        };
        this.updateSummary(result.status || "pass");
      } catch (error) {
        console.error(`检查 ${check.name} 失败:`, error);
        this.results.checks[check.name] = {
          status: "error",
          message: error.message,
          details: { error: error.stack },
          timestamp: new Date().toISOString(),
        };
        this.updateSummary("error");
      }
    }

    this.generateRecommendations();
    console.log("✅ 快速诊断完成", this.results);
    return this.results;
  }

  /**
   * 检查Chrome APIs可用性
   */
  async checkChromeAPIs() {
    const details = {};

    details.chromeRuntime = typeof chrome !== "undefined" && !!chrome.runtime;
    details.chromeStorage = typeof chrome !== "undefined" && !!chrome.storage;
    details.chromeTabs = typeof chrome !== "undefined" && !!chrome.tabs;
    details.chromeScripting =
      typeof chrome !== "undefined" && !!chrome.scripting;

    const essential =
      details.chromeRuntime && details.chromeStorage && details.chromeTabs;

    return {
      status: essential ? "pass" : "fail",
      message: essential ? "Chrome APIs可用" : "Chrome APIs不可用",
      details,
    };
  }

  /**
   * 检查插件上下文
   */
  async checkExtensionContext() {
    const details = {};

    try {
      if (chrome && chrome.runtime) {
        details.extensionId = chrome.runtime.id;
        details.extensionURL = chrome.runtime.getURL("");
        details.lastError = chrome.runtime.lastError;

        return {
          status: "pass",
          message: "插件上下文正常",
          details,
        };
      } else {
        return {
          status: "fail",
          message: "插件上下文不可用",
          details: { error: "chrome.runtime not available" },
        };
      }
    } catch (error) {
      return {
        status: "fail",
        message: "插件上下文检查失败",
        details: { error: error.message },
      };
    }
  }

  /**
   * 检查活动标签页
   */
  async checkActiveTab() {
    const details = {};

    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        details.tabId = tab.id;
        details.tabUrl = tab.url;
        details.tabTitle = tab.title;
        details.tabStatus = tab.status;

        // 检查URL兼容性
        const url = new URL(tab.url);
        details.protocol = url.protocol;
        details.isCompatible =
          url.protocol === "https:" || url.protocol === "http:";

        return {
          status: details.isCompatible ? "pass" : "warning",
          message: details.isCompatible
            ? "活动标签页正常"
            : "当前页面可能不兼容",
          details,
        };
      } else {
        return {
          status: "fail",
          message: "无法获取活动标签页",
          details: { error: "No active tab found" },
        };
      }
    } catch (error) {
      return {
        status: "fail",
        message: "标签页检查失败",
        details: { error: error.message },
      };
    }
  }

  /**
   * 检查Content Script状态
   */
  async checkContentScript() {
    const details = {};

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        return {
          status: "fail",
          message: "无法获取当前标签页",
          details: { error: "No active tab" },
        };
      }

      details.tabId = tab.id;
      details.tabUrl = tab.url;

      // 尝试发送测试消息
      const startTime = Date.now();
      try {
        const response = await this.sendMessageWithTimeout(
          tab.id,
          {
            action: "diagnostic-ping",
            timestamp: startTime,
          },
          5000,
        );

        details.responseTime = Date.now() - startTime;
        details.contentScriptActive = true;
        details.response = response;

        // 测试实际的detectContent功能
        try {
          const detectResponse = await this.sendMessageWithTimeout(
            tab.id,
            {
              action: "detectContent",
            },
            10000,
          );

          details.detectContentWorking =
            !!detectResponse && !detectResponse.error;
          details.attachmentCount = detectResponse.attachments
            ? detectResponse.attachments.length
            : 0;
          details.hasPageText = !!(
            detectResponse.pageText && detectResponse.pageText.length > 0
          );
        } catch (detectError) {
          details.detectContentWorking = false;
          details.detectContentError = detectError.message;
        }

        return {
          status: details.detectContentWorking ? "pass" : "warning",
          message: details.detectContentWorking
            ? "Content Script运行正常"
            : "Content Script连接正常，但内容检测异常",
          details,
        };
      } catch (error) {
        details.contentScriptActive = false;
        details.contentScriptError = error.message;
        details.isConnectionError = error.message.includes(
          "Could not establish connection",
        );
        details.isContextInvalidated = error.message.includes(
          "Extension context invalidated",
        );
        details.isTimeoutError = error.message.includes("timeout");

        let status = "fail";
        let message = "Content Script无响应";

        if (details.isConnectionError) {
          message = "Content Script未注入或页面不兼容";
        } else if (details.isContextInvalidated) {
          message = "插件上下文失效，需要重新加载";
        } else if (details.isTimeoutError) {
          message = "Content Script响应超时";
        }

        return { status, message, details };
      }
    } catch (error) {
      return {
        status: "fail",
        message: "Content Script检查失败",
        details: { error: error.message },
      };
    }
  }

  /**
   * 检查Background Service Worker
   */
  async checkBackgroundService() {
    const details = {};

    try {
      const startTime = Date.now();
      const response = await this.sendRuntimeMessageWithTimeout(
        {
          action: "diagnostic-ping",
          timestamp: startTime,
        },
        5000,
      );

      details.responseTime = Date.now() - startTime;
      details.backgroundActive = true;
      details.response = response;

      return {
        status: "pass",
        message: "Background Service运行正常",
        details,
      };
    } catch (error) {
      details.backgroundActive = false;
      details.backgroundError = error.message;

      return {
        status: "fail",
        message: "Background Service无响应",
        details,
      };
    }
  }

  /**
   * 检查存储访问
   */
  async checkStorageAccess() {
    const details = {};

    try {
      // 测试读取配置
      const config = await chrome.storage.sync.get(["llmConfig"]);
      details.configRead = true;
      details.hasConfig = !!config.llmConfig;
      details.hasApiKey = !!(config.llmConfig && config.llmConfig.apiKey);

      // 测试写入
      const testKey = "diagnostic_test_" + Date.now();
      await chrome.storage.local.set({ [testKey]: { test: true } });
      const testResult = await chrome.storage.local.get([testKey]);
      await chrome.storage.local.remove([testKey]);

      details.writeTest = testResult[testKey] && testResult[testKey].test;

      return {
        status: details.writeTest ? "pass" : "fail",
        message: details.writeTest ? "存储访问正常" : "存储访问异常",
        details,
      };
    } catch (error) {
      return {
        status: "fail",
        message: "存储访问检查失败",
        details: { error: error.message },
      };
    }
  }

  /**
   * 带超时的标签页消息发送
   */
  sendMessageWithTimeout(tabId, message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, timeout);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timer);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 带超时的运行时消息发送
   */
  sendRuntimeMessageWithTimeout(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Runtime message timeout"));
      }, timeout);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 更新统计信息
   */
  updateSummary(status) {
    this.results.summary.total++;

    switch (status) {
      case "pass":
        this.results.summary.passed++;
        break;
      case "fail":
      case "error":
        this.results.summary.failed++;
        break;
      case "warning":
        this.results.summary.warnings++;
        break;
    }
  }

  /**
   * 生成修复建议
   */
  generateRecommendations() {
    const checks = this.results.checks;
    const recommendations = [];

    // Chrome APIs问题
    if (checks["chrome-apis"] && checks["chrome-apis"].status !== "pass") {
      recommendations.push({
        priority: "high",
        title: "重新加载插件",
        description: "Chrome APIs不可用，请在扩展管理页面重新加载插件",
        action: "reload-extension",
      });
    }

    // 插件上下文问题
    if (
      checks["extension-context"] &&
      checks["extension-context"].status !== "pass"
    ) {
      recommendations.push({
        priority: "high",
        title: "重启浏览器",
        description: "插件上下文异常，建议重启浏览器",
        action: "restart-browser",
      });
    }

    // Content Script问题
    if (
      checks["content-script"] &&
      checks["content-script"].status !== "pass"
    ) {
      const details = checks["content-script"].details;

      if (details.isConnectionError) {
        recommendations.push({
          priority: "high",
          title: "刷新页面",
          description: "Content Script未注入，请刷新页面后重试",
          action: "refresh-page",
        });
      } else if (details.isContextInvalidated) {
        recommendations.push({
          priority: "high",
          title: "重新加载插件",
          description: "插件上下文失效，请重新加载插件",
          action: "reload-extension",
        });
      } else if (details.isTimeoutError) {
        recommendations.push({
          priority: "medium",
          title: "检查页面兼容性",
          description: "Content Script响应超时，可能是页面加载缓慢或不兼容",
          action: "check-compatibility",
        });
      }
    }

    // Background Service问题
    if (
      checks["background-service"] &&
      checks["background-service"].status !== "pass"
    ) {
      recommendations.push({
        priority: "high",
        title: "检查Background Service",
        description: "Background Service Worker无响应，请检查是否正常运行",
        action: "check-background",
      });
    }

    // 存储访问问题
    if (
      checks["storage-access"] &&
      checks["storage-access"].status !== "pass"
    ) {
      recommendations.push({
        priority: "medium",
        title: "检查存储权限",
        description: "无法正常访问Chrome存储，检查权限配置",
        action: "check-permissions",
      });
    }

    // 配置相关建议
    if (
      checks["storage-access"] &&
      checks["storage-access"].details &&
      !checks["storage-access"].details.hasApiKey
    ) {
      recommendations.push({
        priority: "medium",
        title: "配置API密钥",
        description: "未检测到LLM API配置，请访问设置页面进行配置",
        action: "configure-api",
      });
    }

    this.results.recommendations = recommendations;
  }

  /**
   * 获取简化的状态报告
   */
  getStatusReport() {
    const { summary } = this.results;

    if (summary.failed > 0) {
      return {
        status: "error",
        message: `发现 ${summary.failed} 个问题需要修复`,
        color: "#dc3545",
      };
    } else if (summary.warnings > 0) {
      return {
        status: "warning",
        message: `有 ${summary.warnings} 个警告项目`,
        color: "#ffc107",
      };
    } else {
      return {
        status: "success",
        message: "所有检查均通过",
        color: "#28a745",
      };
    }
  }

  /**
   * 生成HTML状态摘要
   */
  generateStatusHTML() {
    const report = this.getStatusReport();
    const { summary } = this.results;

    return `
      <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin: 10px 0;">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${report.color}; margin-right: 8px;"></div>
          <strong>${report.message}</strong>
        </div>
        <div style="font-size: 14px; color: #666;">
          检查项目: ${summary.total} |
          通过: ${summary.passed} |
          失败: ${summary.failed} |
          警告: ${summary.warnings}
        </div>
        ${
          this.results.recommendations.length > 0
            ? `
          <div style="margin-top: 10px; font-size: 14px;">
            <strong>建议操作:</strong> ${this.results.recommendations[0].title}
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  /**
   * 获取主要问题
   */
  getMainIssue() {
    const contentScriptCheck = this.results.checks["content-script"];

    if (contentScriptCheck && contentScriptCheck.status !== "pass") {
      const details = contentScriptCheck.details;

      if (details.isConnectionError) {
        return {
          title: "页面连接失败",
          description:
            "Content Script未能注入到当前页面，这通常是因为页面刚加载或插件权限问题。",
          solution: "请刷新页面后重试，或检查当前页面是否支持插件运行。",
        };
      } else if (details.isContextInvalidated) {
        return {
          title: "插件上下文失效",
          description:
            "插件运行上下文已失效，这通常发生在插件更新或重新安装后。",
          solution: "请重新加载插件或重启浏览器。",
        };
      } else if (!details.detectContentWorking) {
        return {
          title: "内容检测功能异常",
          description: "Content Script已连接但内容检测功能无法正常工作。",
          solution: "请检查页面内容是否符合预期，或尝试在其他页面测试。",
        };
      }
    }

    const backgroundCheck = this.results.checks["background-service"];
    if (backgroundCheck && backgroundCheck.status !== "pass") {
      return {
        title: "Background Service异常",
        description: "后台服务无法响应，这会影响插件的核心功能。",
        solution: "请重新加载插件或重启浏览器。",
      };
    }

    return null;
  }
}

// 导出类以供其他模块使用
if (typeof module !== "undefined" && module.exports) {
  module.exports = QuickDiagnostic;
}

// 在浏览器环境中添加到全局作用域
if (typeof window !== "undefined") {
  window.QuickDiagnostic = QuickDiagnostic;
}

// ES6 模块导出
export default QuickDiagnostic;
