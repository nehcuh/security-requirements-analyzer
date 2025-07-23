// content-simple.js - 简化的页面内容检测脚本
// 解决PingCode页面检测失败问题

// Content script loaded

// 调试模式开关
const DEBUG_MODE = true;

function debugLog(message, data = null) {
  if (DEBUG_MODE) {
    console.log(`[ContentScript] ${message}`, data || '');
  }
}

// 简化的内容检测器
class SimpleContentDetector {
  constructor() {
    this.prdKeywords = [
      "prd",
      "product requirement",
      "产品需求",
      "需求文档",
      "requirement",
      "spec",
      "specification",
      "规格说明",
      "functional spec",
      "功能说明",
    ];

    this.attachmentSelectors = [
      // 基础文件类型选择器
      'a[href*=".pdf"]',
      'a[href*=".docx"]',
      'a[href*=".doc"]',
      'a[href*=".xlsx"]',
      'a[href*=".pptx"]',
      'a[href$=".pdf"]',
      'a[href$=".docx"]',
      'a[href$=".doc"]',

      // 下载相关选择器
      "a[download]",
      'a[href*="download"]',
      'a[title*="下载"]',
      'a[title*="附件"]',
      'a[title*="文件"]',

      // PingCode特定选择器
      'a[href*="atlas.pingcode.com"]',
      '.thy-action[href*="download"]',

      // 通用容器选择器
      ".attachment-list a",
      ".attachment a",
      ".file-list a",
      ".file a",
      ".document a",
      '[class*="attachment"] a',
      '[class*="file"] a',
      '[class*="download"] a',
      '[class*="document"] a',

      // 数据属性选择器
      "a[data-file-type]",
      "a[data-attachment]",
      "[data-file] a",

      // 通用链接选择器（更宽泛的搜索）
      'a[href*="file"]',
      'a[href*="attachment"]',
    ];

    this.textSelectors = [
      ".styx-pivot-detail-content-body",
      ".thy-tabs",
      ".expandable",
      '[class*="content"]',
      '[class*="description"]',
      '[class*="detail"]',
      ".requirement-content",
      ".description",
      ".content",
    ];
  }

  // 检测附件
  detectAttachments() {
    debugLog("开始检测附件...");
    const attachments = [];
    const foundUrls = new Set();
    const selectorStats = {};

    // 第一轮：使用预定义选择器
    this.attachmentSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        selectorStats[selector] = elements.length;

        if (elements.length > 0) {
          debugLog(`选择器 "${selector}" 找到 ${elements.length} 个元素`);
        }

        elements.forEach((element) => {
          const attachment = this.parseAttachment(element);
          if (attachment && !foundUrls.has(attachment.url)) {
            debugLog(`解析成功: ${attachment.name}`);
            attachments.push(attachment);
            foundUrls.add(attachment.url);
          }
        });
      } catch (error) {
        debugLog(`选择器 ${selector} 执行失败:`, error);
      }
    });

    // 第二轮：智能文本搜索
    const textFoundAttachments = this.searchByText();
    textFoundAttachments.forEach((attachment) => {
      if (!foundUrls.has(attachment.url)) {
        debugLog(`文本搜索找到: ${attachment.name}`);
        attachments.push(attachment);
        foundUrls.add(attachment.url);
      }
    });

    // 第三轮：DOM结构分析
    const structureFoundAttachments = this.analyzeStructure();
    structureFoundAttachments.forEach((attachment) => {
      if (!foundUrls.has(attachment.url)) {
        debugLog(`结构分析找到: ${attachment.name}`);
        attachments.push(attachment);
        foundUrls.add(attachment.url);
      }
    });

    debugLog(`附件检测完成，总计: ${attachments.length} 个`, selectorStats);
    return attachments;
  }

  // 基于文本内容搜索附件
  searchByText() {
    const attachments = [];
    const filePatterns = [
      /\b\w+\.(pdf|docx?|xlsx?|pptx?)\b/gi,
      /附件[:：]\s*([^，,。.；;]+\.(pdf|docx?|xlsx?|pptx?))/gi,
      /文件[:：]\s*([^，,。.；;]+\.(pdf|docx?|xlsx?|pptx?))/gi,
    ];

    const allText = document.body.textContent;
    filePatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(allText)) !== null) {
        const fileName = match[1] || match[0];
        // 尝试在页面中找到对应的链接
        const links = document.querySelectorAll("a");
        for (const link of links) {
          if (
            link.textContent.includes(fileName) ||
            link.href.includes(fileName) ||
            link.title?.includes(fileName)
          ) {
            const attachment = this.parseAttachment(link);
            if (attachment) {
              attachments.push(attachment);
              break;
            }
          }
        }
      }
    });

    return attachments;
  }

  // 分析DOM结构寻找附件
  analyzeStructure() {
    const attachments = [];

    // 检查表格中的文件链接
    const tables = document.querySelectorAll("table");
    tables.forEach((table) => {
      const links = table.querySelectorAll("a");
      links.forEach((link) => {
        const attachment = this.parseAttachment(link);
        if (attachment) {
          attachments.push(attachment);
        }
      });
    });

    // 检查列表中的文件链接
    const lists = document.querySelectorAll("ul, ol");
    lists.forEach((list) => {
      const links = list.querySelectorAll("a");
      links.forEach((link) => {
        const attachment = this.parseAttachment(link);
        if (attachment) {
          attachments.push(attachment);
        }
      });
    });

    return attachments;
  }

  // 解析单个附件
  parseAttachment(element) {
    let url = element.href || element.getAttribute("href");
    if (!url || url === "javascript:;") return null;

    let name =
      element.textContent?.trim() ||
      element.getAttribute("download") ||
      this.extractFileNameFromUrl(url);

    // 特殊处理PingCode的atlas链接
    if (url.includes("atlas.pingcode.com") && (!name || name.length < 3)) {
      name = this.extractPingCodeFileName(element);
    }

    // 确定文件类型
    const type = this.getFileType(name, url);
    if (!["pdf", "docx", "doc", "xlsx", "pptx"].includes(type.toLowerCase())) {
      return null;
    }

    // 提取文件大小
    const size = this.extractFileSize(element);

    return {
      url,
      name: name.substring(0, 100),
      type: type.toUpperCase(),
      size,
      isPRD: this.isPRDRelated(name),
      metadata: {
        source: "content-script",
        extractedAt: new Date().toISOString(),
      },
    };
  }

  // 从PingCode DOM结构提取文件名
  extractPingCodeFileName(element) {
    let parent = element.parentElement;
    let attempts = 0;

    while (parent && attempts < 5) {
      const text = parent.textContent || "";

      // 查找文件名模式
      const fileMatch = text.match(/([^\/\s]+\.(pdf|docx?|xlsx?|pptx?))/i);
      if (fileMatch) {
        return fileMatch[1];
      }

      // 查找附件名称模式
      const attachmentMatch = text.match(
        /附件名称[：:]\s*([^，,。.；;]+\.(pdf|docx?|xlsx?|pptx?))/i,
      );
      if (attachmentMatch) {
        return attachmentMatch[1];
      }

      parent = parent.parentElement;
      attempts++;
    }

    // 全局搜索文件信息
    const pageText = document.body.textContent || "";
    const globalMatch = pageText.match(
      /([a-zA-Z0-9]+\.(pdf|docx?))\s+(\d+\s*(MB|KB|GB))/i,
    );
    if (globalMatch) {
      return globalMatch[1];
    }

    return "未知文件.pdf";
  }

  // 提取文件大小
  extractFileSize(element) {
    let parent = element.parentElement;
    let attempts = 0;

    while (parent && attempts < 3) {
      const text = parent.textContent || "";
      const sizeMatch = text.match(/(\d+(?:\.\d+)?\s*(MB|KB|GB))/i);
      if (sizeMatch) {
        return sizeMatch[1];
      }
      parent = parent.parentElement;
      attempts++;
    }

    return null;
  }

  // 从URL提取文件名
  extractFileNameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split("/").pop();
      return filename || "unknown-file";
    } catch {
      return "unknown-file";
    }
  }

  // 获取文件类型
  getFileType(name, url) {
    const fullText = (name + " " + url).toLowerCase();

    if (fullText.includes(".pdf")) return "PDF";
    if (fullText.includes(".docx")) return "DOCX";
    if (fullText.includes(".doc") && !fullText.includes(".docx")) return "DOC";
    if (fullText.includes(".xlsx")) return "XLSX";
    if (fullText.includes(".pptx")) return "PPTX";
    if (fullText.includes(".xls") && !fullText.includes(".xlsx")) return "XLS";
    if (fullText.includes(".ppt") && !fullText.includes(".pptx")) return "PPT";

    return "UNKNOWN";
  }

  // 判断是否PRD相关
  isPRDRelated(name) {
    const lowerName = name.toLowerCase();
    return this.prdKeywords.some((keyword) => lowerName.includes(keyword));
  }

  // 检测页面文本
  detectPageText() {
    const textBlocks = [];

    this.textSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const text = element.textContent?.trim();
          if (text && text.length > 50) {
            textBlocks.push({
              text,
              length: text.length,
              selector,
            });
          }
        });
      } catch (error) {
        debugLog(`文本选择器 ${selector} 执行失败:`, error);
      }
    });

    // 按长度排序，选择最长的文本
    textBlocks.sort((a, b) => b.length - a.length);

    // 智能合并，避免重复
    const uniqueTexts = [];
    for (const block of textBlocks) {
      const isSubset = uniqueTexts.some(
        (existing) =>
          existing.includes(block.text.substring(0, 200)) ||
          block.text.includes(existing.substring(0, 200)),
      );

      if (!isSubset) {
        uniqueTexts.push(block.text);
      }
    }

    const result = uniqueTexts.join("\n\n");
    debugLog(
      `文本提取完成: ${textBlocks.length} 个文本块, 合并后 ${uniqueTexts.length} 个, 总长度: ${result.length}`,
    );

    return result;
  }

  // 检测页面类型
  detectPageType() {
    const url = window.location.href;
    const title = document.title;

    if (url.includes("pingcode.com")) {
      if (url.includes("/ideas/")) return "pingcode-idea";
      if (url.includes("/ship/")) return "pingcode-product";
      return "pingcode-other";
    }

    return "unknown";
  }

  // 执行完整检测
  detectAll() {
    debugLog("开始完整检测");

    const startTime = Date.now();
    const attachments = this.detectAttachments();
    const pageText = this.detectPageText();
    const pageType = this.detectPageType();
    const detectionTime = Date.now() - startTime;

    // 分类附件
    const prdAttachments = attachments.filter((att) => att.isPRD);
    const recommendedAttachment =
      prdAttachments.length > 0
        ? prdAttachments[0]
        : attachments.length > 0
          ? attachments[0]
          : null;

    const result = {
      attachments,
      recommendedAttachment,
      prdAttachments,
      prdCount: prdAttachments.length,
      totalCount: attachments.length,
      pageText,
      pageType,
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      detectionTime,
      contentScriptStatus: {
        hasContentDetector: true,
        hasAttachmentSorter: true,
        pageReadyState: document.readyState,
        domElements: document.querySelectorAll("*").length,
        version: "2.0",
        debugMode: DEBUG_MODE,
      },
    };

    debugLog("检测完成", {
      attachments: result.totalCount,
      prdAttachments: result.prdCount,
      pageTextLength: result.pageText.length,
      detectionTime: detectionTime + "ms",
    });

    return result;
  }
}

// 创建全局实例
window.SimpleContentDetector = SimpleContentDetector;
let detector;

// 确保detector正确初始化
try {
  detector = new SimpleContentDetector();
  debugLog("SimpleContentDetector初始化成功");
} catch (error) {
  console.error("SimpleContentDetector初始化失败:", error);
  detector = null;
}

// 监听消息 - 改进版本，增强错误处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 立即响应以确保连接建立
  if (!request || !request.action) {
    sendResponse({ error: "Invalid request" });
    return true;
  }

  debugLog("收到消息:", request);

  // 如果detector未初始化，尝试重新初始化
  if (!detector) {
    try {
      detector = new SimpleContentDetector();
      debugLog("detector重新初始化成功");
    } catch (error) {
      console.error("detector重新初始化失败:", error);
      sendResponse({
        error: "SimpleContentDetector初始化失败: " + error.message,
        success: false
      });
      return true;
    }
  }

  try {
    switch (request.action) {
      case "detectPageContent":
        try {
          // 确保detector存在
          if (typeof detector === 'undefined' || !detector) {
            throw new Error('SimpleContentDetector未初始化');
          }
          
          // 确保detectAll方法存在
          if (typeof detector.detectAll !== 'function') {
            throw new Error('detectAll方法不存在');
          }
          
          const result = detector.detectAll();
          debugLog("检测完成:", result);
          
          // 确保返回有效的结果结构
          const response = {
            attachments: result.attachments || [],
            pageText: result.pageText || "",
            totalCount: result.totalCount || 0,
            success: true,
            timestamp: new Date().toISOString()
          };
          
          sendResponse(response);
        } catch (error) {
          console.error("页面检测失败:", error);
          sendResponse({
            error: error.message,
            stack: error.stack,
            attachments: [],
            pageText: "",
            totalCount: 0,
            success: false,
            contentScriptStatus: {
              hasContentDetector: typeof detector !== 'undefined',
              hasDetectAll: typeof detector?.detectAll === 'function',
              hasDetectPageContent: typeof detectPageContent === 'function',
              hasWindowDetectPageContent: typeof window.detectPageContent === 'function',
              pageReadyState: document.readyState,
              domElements: document.querySelectorAll("*").length,
              version: "2.0",
              debugMode: DEBUG_MODE,
              url: window.location.href
            }
          });
        }
        break;

      case "debug-scan":
        try {
          const result = detector.detectAll();
          sendResponse({
            success: true,
            result,
            debug: {
              selectors: detector.attachmentSelectors.length,
              pageInfo: {
                url: window.location.href,
                title: document.title,
                readyState: document.readyState,
              },
            },
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message,
          });
        }
        break;

      case "diagnostic-ping":
        sendResponse({
          success: true,
          message: "Content script is active",
          timestamp: new Date().toISOString(),
          version: "2.0",
          pageInfo: {
            url: window.location.href,
            title: document.title,
            readyState: document.readyState
          }
        });
        break;

      default:
        sendResponse({ error: "Unknown action: " + request.action });
    }
  } catch (globalError) {
    console.error("消息处理全局错误:", globalError);
    sendResponse({
      error: "Global message handler error: " + globalError.message,
      success: false
    });
  }

  return true; // 保持异步响应通道开放
});

// 页面加载完成后的初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    debugLog("简化版content script已准备就绪");
  });
} else {
  debugLog("简化版content script已准备就绪");
}

// 导出给全局使用
window.detectPageContent = () => detector.detectAll();

// 确保函数在全局作用域中可用
function detectPageContent() {
  try {
    // 如果detector未初始化，尝试初始化
    if (!detector) {
      detector = new SimpleContentDetector();
    }
    
    return detector.detectAll();
  } catch (error) {
    console.error('detectPageContent error:', error);
    return {
      success: false,
      error: error.message,
      attachments: [],
      pageText: "",
      totalCount: 0,
      timestamp: new Date().toISOString()
    };
  }
}

// 初始化调试
debugLog("简化版content script v2.0加载完成");
debugLog("支持的文件类型:", ["PDF", "DOCX", "DOC", "XLSX", "PPTX"]);
debugLog("选择器数量:", detector.attachmentSelectors.length);

// 页面加载完成后自动检测一次（仅在调试模式下）
if (DEBUG_MODE && document.readyState === "complete") {
  setTimeout(() => {
    const result = detector.detectAll();
    if (result.totalCount > 0) {
      debugLog("🎉 自动检测发现附件!", result.totalCount + " 个");
    }
  }, 1000);
}

// Content script v2.0 loaded
