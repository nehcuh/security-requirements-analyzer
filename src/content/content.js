// content.js - 页面内容检测脚本
// AttachmentSorter 现在通过 manifest.json 中的脚本顺序加载
class ContentDetector {
  constructor() {
    // PRD-related keywords for prioritizing attachments
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
      "design doc",
      "设计文档",
      "feature",
      "功能",
      "user story",
      "用户故事",
      "backlog",
      "roadmap",
      "路线图",
      "sprint",
      "迭代",
      "epic",
      "史诗",
      "business requirement",
      "业务需求",
      "technical spec",
      "技术规格",
      "market requirement",
      "市场需求",
      "product spec",
      "产品规格",
    ];

    // Negative keywords that indicate non-PRD documents
    this.nonPrdKeywords = [
      "meeting",
      "会议",
      "minutes",
      "纪要",
      "draft",
      "草稿",
      "temp",
      "临时",
      "old",
      "旧版",
      "archive",
      "归档",
      "test",
      "测试",
      "demo",
      "演示",
      "sample",
      "样例",
    ];

    this.attachmentSelectors = [
      // 通用附件选择器
      'a[href*=".pdf"]',
      'a[href*=".docx"]',
      'a[href*=".doc"]',
      "a[download]",
      ".attachment",
      ".file-item",
      ".document-link",

      // PingCode特定选择器
      ".attachment-list a",
      ".file-list-item",
      '[class*="attachment"]',
      '[class*="file"]',
      ".pingcode-attachment",

      // 其他常见平台选择器
      ".jira-attachment",
      ".confluence-attachment",
      ".notion-file",
      ".teambition-file",
      ".tower-attachment",
      ".worktile-file",

      // 通用文件列表选择器
      ".files a",
      ".documents a",
      ".attachments a",
      "[data-file-type]",
      "[data-attachment]",
    ];

    this.textContentSelectors = [
      // 需求描述区域
      ".requirement-content",
      ".description",
      ".content",
      ".detail",
      ".requirement-detail",

      // 富文本编辑器
      ".rich-text-editor",
      ".editor-content",
      '[contenteditable="true"]',

      // 表单文本区域
      "textarea",
      ".text-area",

      // PingCode特定选择器
      ".requirement-description",
      ".story-content",
      ".epic-content",
    ];
  }

  // 检测页面附件
  detectAttachments() {
    const attachments = [];
    const foundLinks = new Set(); // 避免重复

    this.attachmentSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const attachment = this.parseAttachmentElement(element);
          if (attachment && !foundLinks.has(attachment.url)) {
            attachments.push(attachment);
            foundLinks.add(attachment.url);
          }
        });
      } catch (error) {
        console.warn(`选择器 ${selector} 执行失败:`, error);
      }
    });

    return attachments;
  }

  /**
   * Enhanced method to detect PRD-focused attachments
   * Prioritizes PRD-related files based on filename patterns and metadata
   * @returns {Object} Object containing attachments array and recommended attachment
   */
  detectPRDAttachments() {
    const attachments = this.detectAttachments();

    // Classify and enhance attachments with PRD indicators
    attachments.forEach((attachment) => {
      attachment.isPRD = this.isPRDRelated(attachment.name);
      attachment.relevanceScore = this.classifyAttachmentRelevance(attachment);
    });

    // Sort attachments using the AttachmentSorter (if available)
    const sortedAttachments =
      typeof AttachmentSorter !== "undefined"
        ? AttachmentSorter.sortByPRDStatus(attachments)
        : attachments.sort((a, b) => (b.isPRD ? 1 : 0) - (a.isPRD ? 1 : 0));

    // Get recommended attachments (top 3)
    const recommendedAttachments =
      typeof AttachmentSorter !== "undefined"
        ? AttachmentSorter.getRecommendedAttachments(attachments, 3)
        : sortedAttachments.slice(0, 3);

    // Set primary recommended attachment
    const recommendedAttachment =
      recommendedAttachments.length > 0 ? recommendedAttachments[0] : null;

    // Group attachments by type for better organization
    const groupedAttachments = this.groupAttachmentsByType(attachments);

    // Filter PRD attachments
    const prdAttachments =
      typeof AttachmentSorter !== "undefined"
        ? AttachmentSorter.filterByPRDStatus(attachments, true)
        : attachments.filter((att) => att.isPRD);

    return {
      attachments: sortedAttachments, // Return sorted attachments
      recommendedAttachment,
      recommendedAttachments, // Include top recommendations
      groupedAttachments,
      prdAttachments, // Include PRD-only attachments
      prdCount: prdAttachments.length,
      totalCount: attachments.length,
      sortOptions:
        typeof AttachmentSorter !== "undefined"
          ? {
              byRelevance: () => AttachmentSorter.sortByRelevance(attachments),
              byPRDStatus: () => AttachmentSorter.sortByPRDStatus(attachments),
              byFileType: () => AttachmentSorter.sortByFileType(attachments),
              byDate: () => AttachmentSorter.sortByDate(attachments),
              byName: () => AttachmentSorter.sortByName(attachments),
            }
          : {
              byRelevance: () =>
                attachments.sort((a, b) => b.relevanceScore - a.relevanceScore),
              byPRDStatus: () =>
                attachments.sort(
                  (a, b) => (b.isPRD ? 1 : 0) - (a.isPRD ? 1 : 0),
                ),
              byFileType: () =>
                attachments.sort((a, b) => a.type.localeCompare(b.type)),
              byDate: () =>
                attachments.sort(
                  (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
                ),
              byName: () =>
                attachments.sort((a, b) => a.name.localeCompare(b.name)),
            },
    };
  }

  /**
   * Group attachments by their type
   * @param {Array} attachments - List of attachments
   * @returns {Object} Grouped attachments by type
   */
  groupAttachmentsByType(attachments) {
    const grouped = {
      PDF: [],
      DOCX: [],
      DOC: [],
      other: [],
    };

    attachments.forEach((attachment) => {
      if (grouped[attachment.type]) {
        grouped[attachment.type].push(attachment);
      } else {
        grouped.other.push(attachment);
      }
    });

    return grouped;
  }

  /**
   * Check if filename is PRD-related based on keyword matching
   * @param {string} filename - Name of the file to check
   * @returns {boolean} True if the file is PRD-related
   */
  isPRDRelated(filename) {
    if (!filename) return false;

    const lowerName = filename.toLowerCase();

    // Check for negative keywords first (stronger signal)
    if (this.nonPrdKeywords.some((keyword) => lowerName.includes(keyword))) {
      return false;
    }

    // Check for positive PRD keywords
    return this.prdKeywords.some((keyword) => lowerName.includes(keyword));
  }

  /**
   * Score attachment relevance for prioritization
   * Higher scores indicate more relevant PRD attachments
   * @param {Object} attachment - Attachment object to score
   * @returns {number} Relevance score (higher is more relevant)
   */
  classifyAttachmentRelevance(attachment) {
    let score = 0;
    const lowerName = attachment.name.toLowerCase();

    // PRD-related filename gets highest priority
    if (this.isPRDRelated(attachment.name)) {
      score += 100;
    }

    // File type scoring - PDF and DOCX are preferred
    if (attachment.type === "PDF") score += 50;
    if (attachment.type === "DOCX") score += 40;
    if (attachment.type === "DOC") score += 30;

    // Recent files (if date is in filename) get higher scores
    const dateMatches = lowerName.match(/\d{4}[-_]?\d{2}[-_]?\d{2}/);
    if (dateMatches) {
      const dateStr = dateMatches[0].replace(/[-_]/g, "");
      const fileDate = new Date(
        parseInt(dateStr.substring(0, 4)),
        parseInt(dateStr.substring(4, 6)) - 1,
        parseInt(dateStr.substring(6, 8)),
      );

      // More recent files get higher scores
      if (!isNaN(fileDate.getTime())) {
        const now = new Date();
        const daysDiff = Math.floor((now - fileDate) / (1000 * 60 * 60 * 24));

        // Files less than 30 days old get bonus points
        if (daysDiff < 30) {
          score += 30 - Math.floor(daysDiff / 3);
        }
      } else {
        // If we can't parse the date but it has a date format, still give some points
        score += 15;
      }
    }

    // Version indicators get higher scores
    const versionMatch = lowerName.match(
      /v(\d+(\.\d+)*)|version\s*(\d+(\.\d+)*)/i,
    );
    if (versionMatch) {
      score += 20;

      // Higher versions get higher scores
      const versionStr = versionMatch[1] || versionMatch[3];
      if (versionStr) {
        const versionNum = parseFloat(versionStr);
        if (!isNaN(versionNum)) {
          score += Math.min(versionNum * 5, 20); // Cap at 20 additional points
        }
      }
    }

    // Final/latest indicators get higher scores
    if (/final|latest|最终|最新/i.test(lowerName)) {
      score += 25;
    }

    // File size consideration - if available
    if (attachment.metadata && attachment.metadata.size) {
      // Larger files might contain more detailed PRDs
      const sizeMatch = attachment.metadata.size.match(
        /(\d+(\.\d+)?)\s*(KB|MB|GB)/i,
      );
      if (sizeMatch) {
        const size = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[3].toUpperCase();

        // Convert to KB for comparison
        let sizeKB = size;
        if (unit === "MB") sizeKB = size * 1024;
        if (unit === "GB") sizeKB = size * 1024 * 1024;

        // Ideal PRD size range (not too small, not too large)
        if (sizeKB > 100 && sizeKB < 5000) {
          score += 15;
        }
      }
    }

    // Consider metadata if available
    if (attachment.metadata) {
      // Author information might indicate official documents
      if (
        attachment.metadata.author &&
        /product|manager|pm|产品|经理/i.test(attachment.metadata.author)
      ) {
        score += 15;
      }
    }

    return score;
  }

  /**
   * Parse an attachment element from the DOM
   * @param {Element} element - DOM element to parse
   * @returns {Object|null} Attachment object or null if invalid
   */
  parseAttachmentElement(element) {
    let url, name, type;

    if (element.tagName === "A") {
      url = element.href;
      name =
        element.textContent.trim() ||
        element.getAttribute("download") ||
        this.getFileNameFromUrl(url);
    } else {
      // 查找子元素中的链接
      const link = element.querySelector("a");
      if (link) {
        url = link.href;
        name = link.textContent.trim() || element.textContent.trim();
      }
    }

    if (!url || !name) return null;

    // 确定文件类型
    type = this.getFileType(url, name);

    // 只返回我们关心的文件类型
    if (!["pdf", "docx", "doc"].includes(type.toLowerCase())) {
      return null;
    }

    // Extract metadata from element or filename
    const metadata = this.extractMetadata(element, name, url);
    const size = this.getFileSize(element);
    if (size) {
      metadata.size = size;
    }

    // Create enhanced attachment object with PRD indicators
    return {
      url,
      name: name.substring(0, 100), // 限制长度
      type,
      size,
      isPRD: this.isPRDRelated(name), // Add PRD indicator
      relevanceScore: 0, // Will be calculated later
      metadata, // Add metadata for better classification
      createdAt: metadata.date
        ? new Date(metadata.date.replace(/[-_]/g, "/"))
        : null,
      lastModified: metadata.lastModified || null,
      prdCategory: this.categorizePRD(name, metadata),
      fileExtension: this.getFileExtension(url, name),
    };
  }

  /**
   * Categorize PRD document by type
   * @param {string} filename - Name of the file
   * @param {Object} metadata - Metadata object
   * @returns {string|null} PRD category or null if not a PRD
   */
  categorizePRD(filename, metadata) {
    if (!this.isPRDRelated(filename)) return null;

    const lowerName = filename.toLowerCase();

    if (/market|市场|customer|客户|survey|调研/.test(lowerName)) {
      return "market_requirement";
    } else if (
      /tech|technical|技术|architecture|架构|design|设计/.test(lowerName)
    ) {
      return "technical_spec";
    } else if (/feature|功能|story|用户故事/.test(lowerName)) {
      return "feature_spec";
    } else if (/product|产品|prd/.test(lowerName)) {
      return "product_requirement";
    }

    return "general_requirement";
  }

  /**
   * Get file extension from URL or filename
   * @param {string} url - File URL
   * @param {string} name - File name
   * @returns {string} File extension
   */
  getFileExtension(url, name) {
    const extension = (
      url.split(".").pop() ||
      name.split(".").pop() ||
      ""
    ).toLowerCase();
    return extension.split("?")[0]; // Remove query parameters
  }

  /**
   * Get file type based on extension
   * @param {string} url - File URL
   * @param {string} name - File name
   * @returns {string} File type
   */
  getFileType(url, name) {
    const extension = this.getFileExtension(url, name);
    const typeMap = {
      pdf: "PDF",
      doc: "DOC",
      docx: "DOCX",
    };
    return typeMap[extension] || extension.toUpperCase();
  }

  /**
   * Extract filename from URL
   * @param {string} url - File URL
   * @returns {string} Filename
   */
  getFileNameFromUrl(url) {
    try {
      return decodeURIComponent(url.split("/").pop().split("?")[0]);
    } catch {
      return "unknown_file";
    }
  }

  /**
   * Extract file size from element
   * @param {Element} element - DOM element
   * @returns {string|null} File size string or null
   */
  getFileSize(element) {
    // Try to extract file size from element text
    const sizeText = element.textContent.match(/\(([0-9.]+\s*(KB|MB|GB))\)/i);
    if (sizeText) return sizeText[1];

    // Try to find size in data attributes
    const sizeAttr =
      element.getAttribute("data-size") ||
      element.getAttribute("data-file-size") ||
      element.getAttribute("size");
    if (sizeAttr) {
      // Convert bytes to human-readable format if needed
      const bytes = parseInt(sizeAttr);
      if (!isNaN(bytes)) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024)
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }
      return sizeAttr;
    }

    return null;
  }

  /**
   * Extract comprehensive metadata from element and filename
   * @param {Element} element - DOM element
   * @param {string} filename - File name
   * @param {string} url - File URL
   * @returns {Object} Metadata object
   */
  extractMetadata(element, filename, url) {
    const metadata = {};

    // Try to extract date from filename
    const dateMatch = filename.match(/(\d{4}[-_]?\d{2}[-_]?\d{2})/);
    if (dateMatch) {
      metadata.date = dateMatch[1];
    }

    // Try to extract version from filename
    const versionMatch = filename.match(
      /v(\d+(\.\d+)*)|version\s*(\d+(\.\d+)*)/i,
    );
    if (versionMatch) {
      metadata.version = versionMatch[1] || versionMatch[3];
    }

    // Try to extract author from element
    const authorElement =
      element.closest(".attachment-item")?.querySelector(".author") ||
      element.closest(".file-item")?.querySelector(".uploader") ||
      element
        .closest('[class*="attachment"]')
        ?.querySelector('[class*="author"]') ||
      element.closest('[class*="file"]')?.querySelector('[class*="uploader"]');

    if (authorElement) {
      metadata.author = authorElement.textContent.trim();
    }

    // Try to extract last modified date
    const modifiedElement =
      element.closest(".attachment-item")?.querySelector(".modified") ||
      element.closest(".file-item")?.querySelector(".date") ||
      element
        .closest('[class*="attachment"]')
        ?.querySelector('[class*="date"]') ||
      element.closest('[class*="file"]')?.querySelector('[class*="time"]');

    if (modifiedElement) {
      metadata.lastModified = modifiedElement.textContent.trim();

      // Try to parse the date string
      try {
        const dateStr = modifiedElement.textContent.trim();
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          metadata.lastModifiedDate = parsedDate;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Extract document type from filename
    if (/roadmap|路线图/i.test(filename)) {
      metadata.documentType = "roadmap";
    } else if (/sprint|迭代/i.test(filename)) {
      metadata.documentType = "sprint";
    } else if (/epic|史诗/i.test(filename)) {
      metadata.documentType = "epic";
    } else if (/story|用户故事/i.test(filename)) {
      metadata.documentType = "story";
    } else if (/feature|功能/i.test(filename)) {
      metadata.documentType = "feature";
    } else if (/spec|规格/i.test(filename)) {
      metadata.documentType = "specification";
    } else if (/prd|产品需求/i.test(filename)) {
      metadata.documentType = "prd";
    }

    // Extract URL metadata
    try {
      const urlObj = new URL(url);
      metadata.domain = urlObj.hostname;
      metadata.path = urlObj.pathname;

      // Check if from a known project management system
      if (/jira|atlassian/i.test(urlObj.hostname)) {
        metadata.source = "jira";
      } else if (/confluence/i.test(urlObj.hostname)) {
        metadata.source = "confluence";
      } else if (/pingcode/i.test(urlObj.hostname)) {
        metadata.source = "pingcode";
      } else if (/teambition/i.test(urlObj.hostname)) {
        metadata.source = "teambition";
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    return metadata;
  }

  // 检测页面文本内容
  detectPageText() {
    let textContent = "";
    const foundTexts = [];

    this.textContentSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const text = this.extractTextFromElement(element);
          if (text && text.length > 50) {
            // 只保留有意义的文本
            foundTexts.push(text);
          }
        });
      } catch (error) {
        console.warn(`文本选择器 ${selector} 执行失败:`, error);
      }
    });

    // 合并去重
    textContent = [...new Set(foundTexts)].join("\n\n");

    // 如果没有找到特定区域的文本，尝试获取页面主要内容
    if (!textContent.trim()) {
      textContent = this.extractMainContent();
    }

    return textContent.substring(0, 5000); // 限制长度
  }

  extractTextFromElement(element) {
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
      return element.value;
    }

    if (element.contentEditable === "true") {
      return element.innerText || element.textContent;
    }

    return element.innerText || element.textContent || "";
  }

  extractMainContent() {
    // 尝试获取页面主要内容区域
    const mainSelectors = [
      "main",
      ".main-content",
      ".content",
      "#content",
      ".container",
      "article",
      ".article-content",
    ];

    for (const selector of mainSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.innerText || element.textContent || "";
        if (text.length > 100) {
          return text;
        }
      }
    }

    // 最后尝试body内容（排除导航和脚本）
    const bodyClone = document.body.cloneNode(true);

    // 移除不需要的元素
    const removeSelectors = [
      "script",
      "style",
      "nav",
      "header",
      "footer",
      ".navigation",
    ];
    removeSelectors.forEach((sel) => {
      bodyClone.querySelectorAll(sel).forEach((el) => el.remove());
    });

    return bodyClone.innerText || bodyClone.textContent || "";
  }

  // 检测页面类型（是否为需求管理页面）
  detectPageType() {
    const url = window.location.href;
    const title = document.title;
    const content = document.body.textContent.toLowerCase();

    const indicators = {
      isPingCode: url.includes("pingcode") || content.includes("pingcode"),
      isRequirementPage: /需求|requirement|story|epic|prd/i.test(
        title + content,
      ),
      hasAttachments: this.detectAttachments().length > 0,
      hasTextContent: this.detectPageText().trim().length > 100,
    };

    return indicators;
  }
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle diagnostic ping for debugging
  if (request.action === "diagnostic-ping") {
    try {
      sendResponse({
        success: true,
        message: "Content script is active",
        timestamp: new Date().toISOString(),
        receivedTimestamp: request.timestamp,
        url: window.location.href,
        title: document.title,
        contentScriptStatus: {
          hasContentDetector: typeof ContentDetector !== "undefined",
          hasAttachmentSorter: typeof AttachmentSorter !== "undefined",
          pageReadyState: document.readyState,
          domElements: document.querySelectorAll("*").length,
        },
      });
    } catch (error) {
      sendResponse({
        success: false,
        message: "Content script ping failed",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  }

  if (request.action === "detectContent") {
    try {
      const detector = new ContentDetector();

      // Use enhanced PRD attachment detection
      const attachmentResult = detector.detectPRDAttachments();

      const result = {
        attachments: attachmentResult.attachments,
        recommendedAttachment: attachmentResult.recommendedAttachment,
        groupedAttachments: attachmentResult.groupedAttachments,
        prdCount: attachmentResult.prdCount,
        totalCount: attachmentResult.totalCount,
        pageText: detector.detectPageText(),
        pageType: detector.detectPageType(),
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
      };

      console.log("检测到的内容:", result);
      sendResponse(result);
    } catch (error) {
      console.error("内容检测失败:", error);
      sendResponse({ error: error.message });
    }
  }

  return true; // 保持消息通道开放
});
