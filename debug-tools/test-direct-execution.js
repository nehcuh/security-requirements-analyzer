// 直接在页面执行Content Script代码进行测试
console.log("🧪 直接执行Content Script代码测试");

// 复制SimpleContentDetector类的核心代码
class TestContentDetector {
  constructor() {
    this.attachmentSelectors = [
      // PingCode特定选择器
      'a[href*="atlas.pingcode.com"]',
      
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

      // 通用链接选择器
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

  detectAttachments() {
    console.log("🔍 开始检测附件...");
    const attachments = [];
    const foundUrls = new Set();
    const selectorStats = {};

    this.attachmentSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        selectorStats[selector] = elements.length;

        if (elements.length > 0) {
          console.log(`✅ 选择器 "${selector}" 找到 ${elements.length} 个元素`);
          
          elements.forEach((element, index) => {
            console.log(`  元素 ${index + 1}:`, {
              href: element.href,
              text: element.textContent?.trim(),
              title: element.title,
              download: element.getAttribute('download')
            });
            
            const attachment = this.parseAttachment(element);
            if (attachment && !foundUrls.has(attachment.url)) {
              console.log(`✅ 解析成功: ${attachment.name}`);
              attachments.push(attachment);
              foundUrls.add(attachment.url);
            } else if (attachment) {
              console.log(`⚠️ 重复URL跳过: ${attachment.url}`);
            } else {
              console.log(`❌ 解析失败`);
            }
          });
        }
      } catch (error) {
        console.error(`❌ 选择器 ${selector} 执行失败:`, error);
      }
    });

    console.log("📊 选择器统计:", selectorStats);
    console.log(`✅ 附件检测完成，总计: ${attachments.length} 个`);
    return attachments;
  }

  parseAttachment(element) {
    let url = element.href || element.getAttribute("href");
    if (!url || url === "javascript:;") {
      console.log("❌ 无效URL:", url);
      return null;
    }

    let name = element.textContent?.trim() || 
               element.getAttribute("download") || 
               this.extractFileNameFromUrl(url);

    // 特殊处理PingCode的atlas链接
    if (url.includes("atlas.pingcode.com") && (!name || name.length < 3)) {
      name = this.extractPingCodeFileName(element);
      console.log("🔍 PingCode文件名提取:", name);
    }

    // 确定文件类型
    const type = this.getFileType(name, url);
    console.log("🔍 文件类型判断:", { name, url, type });
    
    // 对于PingCode的atlas链接，放宽文件类型限制
    if (url.includes("atlas.pingcode.com")) {
      console.log("✅ PingCode atlas链接，接受为附件");
    } else if (!["pdf", "docx", "doc", "xlsx", "pptx"].includes(type.toLowerCase())) {
      console.log("❌ 不支持的文件类型:", type);
      return null;
    }

    const size = this.extractFileSize(element);

    return {
      url,
      name: name.substring(0, 100),
      type: type.toUpperCase() || "UNKNOWN",
      size,
      isPRD: this.isPRDRelated(name),
      metadata: {
        source: "test-content-script",
        extractedAt: new Date().toISOString(),
      },
    };
  }

  extractPingCodeFileName(element) {
    let parent = element.parentElement;
    let attempts = 0;

    while (parent && attempts < 5) {
      const text = parent.textContent || "";
      console.log(`🔍 检查父元素 ${attempts + 1}:`, text.substring(0, 100));

      // 查找文件名模式
      const fileMatch = text.match(/([^\/\s]+\.(pdf|docx?|xlsx?|pptx?))/i);
      if (fileMatch) {
        console.log("✅ 找到文件名模式:", fileMatch[1]);
        return fileMatch[1];
      }

      // 查找附件名称模式
      const attachmentMatch = text.match(/附件名称[：:]\s*([^，,。.；;]+\.(pdf|docx?|xlsx?|pptx?))/i);
      if (attachmentMatch) {
        console.log("✅ 找到附件名称模式:", attachmentMatch[1]);
        return attachmentMatch[1];
      }

      parent = parent.parentElement;
      attempts++;
    }

    // 全局搜索文件信息
    const pageText = document.body.textContent || "";
    const globalMatch = pageText.match(/([a-zA-Z0-9\u4e00-\u9fff]+\.(pdf|docx?))\s+(\d+\s*(MB|KB|GB))/i);
    if (globalMatch) {
      console.log("✅ 全局搜索找到文件:", globalMatch[1]);
      return globalMatch[1];
    }

    return "PingCode附件.pdf";
  }

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

  getFileType(name, url) {
    const fullText = (name + " " + url).toLowerCase();

    if (fullText.includes(".pdf")) return "PDF";
    if (fullText.includes(".docx")) return "DOCX";
    if (fullText.includes(".doc") && !fullText.includes(".docx")) return "DOC";
    if (fullText.includes(".xlsx")) return "XLSX";
    if (fullText.includes(".pptx")) return "PPTX";

    // 对于PingCode的atlas链接，默认为PDF
    if (url.includes("atlas.pingcode.com")) return "PDF";

    return "UNKNOWN";
  }

  isPRDRelated(name) {
    const lowerName = name.toLowerCase();
    const prdKeywords = ["prd", "product requirement", "产品需求", "需求文档", "requirement"];
    return prdKeywords.some((keyword) => lowerName.includes(keyword));
  }

  detectPageText() {
    const textBlocks = [];

    this.textSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`🔍 文本选择器 "${selector}" 找到 ${elements.length} 个元素`);
        
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
        console.error(`❌ 文本选择器 ${selector} 执行失败:`, error);
      }
    });

    const result = textBlocks.map(block => block.text).join("\n\n");
    console.log(`✅ 文本提取完成: ${textBlocks.length} 个文本块, 总长度: ${result.length}`);
    return result;
  }

  detectAll() {
    console.log("🚀 开始完整检测");
    const startTime = Date.now();
    
    const attachments = this.detectAttachments();
    const pageText = this.detectPageText();
    const detectionTime = Date.now() - startTime;

    const result = {
      attachments,
      totalCount: attachments.length,
      pageText,
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      detectionTime,
    };

    console.log("🎉 检测完成", {
      attachments: result.totalCount,
      pageTextLength: result.pageText.length,
      detectionTime: detectionTime + "ms",
    });

    return result;
  }
}

// 执行测试
function runTest() {
  console.log("=" .repeat(50));
  console.log("🧪 开始直接执行测试");
  console.log("=" .repeat(50));

  const detector = new TestContentDetector();
  const result = detector.detectAll();

  console.log("\n📊 最终结果:");
  console.log("  📎 附件数量:", result.totalCount);
  console.log("  📄 页面文本长度:", result.pageText.length);
  console.log("  ⏱️ 检测耗时:", result.detectionTime + "ms");

  if (result.attachments.length > 0) {
    console.log("\n📎 检测到的附件:");
    result.attachments.forEach((att, index) => {
      console.log(`  ${index + 1}. ${att.name} (${att.type}) - ${att.size || '未知大小'}`);
      console.log(`     URL: ${att.url}`);
    });
  }

  return result;
}

// 运行测试
runTest();