/**
 * Unified Extension Debugger
 * 统一的Chrome扩展调试工具
 */

console.log("🔧 加载统一调试工具...");

window.extensionDebugger = {

  /**
   * 完整的功能测试
   */
  async runCompleteTest() {
    console.log("=== 🚀 开始完整功能测试 ===");

    // 1. 检查基础环境
    console.log("1️⃣ 检查基础环境:");
    console.log("  contentDetector存在:", typeof contentDetector);
    console.log("  chrome.runtime存在:", typeof chrome.runtime);

    if (typeof contentDetector === 'undefined') {
      console.error("❌ ContentDetector未加载，请检查Content Script是否正确注入");
      return;
    }

    // 2. 测试页面结构分析
    console.log("\n2️⃣ 测试页面结构分析:");
    try {
      const result = contentDetector.detectContent();
      console.log("📊 检测结果:", result);
      console.log("  - 附件数量:", result.attachments?.length || 0);
      console.log("  - 页面文本长度:", result.pageText?.length || 0);
      console.log("  - 文本预览:", result.pageText?.substring(0, 200) + "...");

      if (result.attachments?.length > 0) {
        console.log("  - 附件详情:");
        result.attachments.forEach((att, index) => {
          console.log(`    ${index + 1}. ${att.name} (${att.type}) - ${att.url}`);
        });
      }
    } catch (error) {
      console.error("❌ 检测失败:", error);
    }

    // 3. 测试调试功能
    console.log("\n3️⃣ 测试调试功能:");
    if (typeof contentDetector.debugPageStructure === 'function') {
      try {
        const debugInfo = contentDetector.debugPageStructure();
        console.log("🔍 调试信息:", debugInfo);
      } catch (error) {
        console.error("❌ 调试功能失败:", error);
      }
    } else {
      console.warn("⚠️ 调试功能不可用");
    }

    // 4. 运行自定义页面分析
    console.log("\n4️⃣ 运行自定义页面分析:");
    const customAnalysis = this.analyzeCurrentPage();
    console.log("🔍 自定义分析结果:", customAnalysis);

    // 5. 测试STAC知识库加载
    console.log("\n5️⃣ 测试STAC知识库:");
    await this.testSTACDatabase();

    console.log("\n✅ 完整功能测试完成");
  },

  /**
   * 快速诊断
   */
  quickDiagnose() {
    console.log("🔍 快速诊断开始...");

    const issues = [];
    const warnings = [];

    // 检查基础环境
    if (typeof contentDetector === 'undefined') {
      issues.push("ContentDetector未加载");
    }

    if (typeof chrome === 'undefined' || !chrome.runtime) {
      issues.push("Chrome API不可用");
    }

    // 检查页面内容
    try {
      const result = contentDetector?.detectContent();
      if (!result) {
        issues.push("内容检测失败");
      } else {
        if (result.attachments?.length === 0) {
          warnings.push("未检测到附件");
        }
        if (!result.pageText || result.pageText.length < 100) {
          warnings.push("页面文本内容较少");
        }
      }
    } catch (error) {
      issues.push(`内容检测错误: ${error.message}`);
    }

    // 输出结果
    if (issues.length > 0) {
      console.error("❌ 发现问题:", issues);
    }

    if (warnings.length > 0) {
      console.warn("⚠️ 警告:", warnings);
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log("✅ 诊断通过，功能正常");
    }

    return { issues, warnings };
  },

  /**
   * 分析当前页面
   */
  analyzeCurrentPage() {
    const analysis = {
      url: window.location.href,
      platform: this.detectPlatform(),
      content: this.findBestContentArea(),
      attachments: this.findAllAttachments(),
      recommendations: []
    };

    // 生成建议
    if (analysis.attachments.length === 0) {
      analysis.recommendations.push("未找到附件，请检查附件选择器是否适用于当前平台");
    }

    if (analysis.content.textLength < 100) {
      analysis.recommendations.push("内容文本较短，请检查内容选择器是否正确");
    }

    return analysis;
  },

  /**
   * 检测平台类型
   */
  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('pingcode.com')) return 'PingCode';
    if (hostname.includes('coding.net')) return 'Coding.net';
    if (hostname.includes('atlassian.net') || hostname.includes('jira')) return 'Jira';
    if (hostname.includes('confluence')) return 'Confluence';
    return 'Generic';
  },

  /**
   * 查找最佳内容区域
   */
  findBestContentArea() {
    const contentSelectors = [
      'main', '.main-content', '#main', '.content',
      '.page-content', '.article-content', '.post-content',
      '.requirement-content', '.description', '.detail',
      '.issue-body', '.requirement-detail', '.specification',
      '.prd-content', '.document-content'
    ];

    let bestContent = { selector: null, textLength: 0, element: null };

    for (const selector of contentSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          const textLength = element.textContent?.length || 0;
          if (textLength > bestContent.textLength) {
            bestContent = { selector, textLength, element };
          }
        }
      } catch (error) {
        console.debug(`选择器 "${selector}" 失败:`, error);
      }
    }

    return bestContent;
  },

  /**
   * 查找所有附件
   */
  findAllAttachments() {
    const attachmentSelectors = [
      'a[href*=".pdf"]', 'a[href*=".docx"]', 'a[href*=".doc"]',
      'a[download]', 'a[href*="download"]',
      '.attachment-link', '.file-link', '.download-link',
      '[data-file-type]', '[data-attachment]'
    ];

    const attachments = [];
    const processedUrls = new Set();

    for (const selector of attachmentSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const url = element.href || element.getAttribute('href');
          if (url && !processedUrls.has(url)) {
            attachments.push({
              selector,
              url,
              text: element.textContent?.trim(),
              element: element.tagName
            });
            processedUrls.add(url);
          }
        });
      } catch (error) {
        console.debug(`选择器 "${selector}" 失败:`, error);
      }
    }

    return attachments;
  },

  /**
   * 测试STAC知识库
   */
  async testSTACDatabase() {
    try {
      // 尝试通过chrome.runtime获取STAC数据
      if (chrome.runtime && chrome.runtime.sendMessage) {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'getSTACKnowledge', query: '身份认证' },
            (response) => resolve(response)
          );
        });

        if (response && response.success) {
          console.log("✅ STAC知识库连接正常");
          console.log("📚 知识库条目数:", response.data?.length || 0);
        } else {
          console.warn("⚠️ STAC知识库响应异常:", response);
        }
      } else {
        console.warn("⚠️ 无法访问Chrome Runtime API");
      }
    } catch (error) {
      console.error("❌ STAC知识库测试失败:", error);
    }
  },

  /**
   * 测试LLM连接
   */
  async testLLMConnection() {
    console.log("🤖 测试LLM连接...");

    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              action: 'testLLMConnection',
              testMessage: '这是一个连接测试'
            },
            (response) => resolve(response)
          );
        });

        if (response && response.success) {
          console.log("✅ LLM连接正常");
          console.log("🔧 配置信息:", response.config || '未提供');
        } else {
          console.error("❌ LLM连接失败:", response?.error || '未知错误');
        }
      } else {
        console.warn("⚠️ 无法访问Chrome Runtime API");
      }
    } catch (error) {
      console.error("❌ LLM连接测试失败:", error);
    }
  },

  /**
   * 扩展状态检查
   */
  checkExtensionStatus() {
    console.log("🔍 检查扩展状态...");

    const status = {
      contentScript: typeof contentDetector !== 'undefined',
      chromeAPI: typeof chrome !== 'undefined' && !!chrome.runtime,
      pageTitle: document.title,
      pageURL: window.location.href,
      domReady: document.readyState === 'complete',
      timestamp: new Date().toISOString()
    };

    console.table(status);
    return status;
  },

  /**
   * 生成诊断报告
   */
  generateReport() {
    console.log("📋 生成诊断报告...");

    const report = {
      timestamp: new Date().toISOString(),
      page: {
        url: window.location.href,
        title: document.title,
        platform: this.detectPlatform()
      },
      extension: this.checkExtensionStatus(),
      content: this.analyzeCurrentPage(),
      diagnosis: this.quickDiagnose()
    };

    console.log("📊 完整诊断报告:", report);

    // 保存到localStorage以便后续查看
    try {
      localStorage.setItem('extension-debug-report', JSON.stringify(report, null, 2));
      console.log("💾 报告已保存到localStorage");
    } catch (error) {
      console.warn("⚠️ 无法保存报告到localStorage:", error);
    }

    return report;
  }
};

// 快捷方法
window.quickDebug = () => window.extensionDebugger.quickDiagnose();
window.fullTest = () => window.extensionDebugger.runCompleteTest();
window.debugReport = () => window.extensionDebugger.generateReport();

console.log("✅ 统一调试工具加载完成");
console.log("🔧 可用命令:");
console.log("  - quickDebug(): 快速诊断");
console.log("  - fullTest(): 完整功能测试");
console.log("  - debugReport(): 生成诊断报告");
console.log("  - extensionDebugger.checkExtensionStatus(): 检查扩展状态");
