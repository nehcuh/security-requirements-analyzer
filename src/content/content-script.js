// content-script.js - Unified Content Detection Script
// Production-ready content detection for security requirements analysis

// Inline logging utilities to avoid module import issues
const Logger = {
  debug: (message, data) => {
    if (Logger.isDebugMode()) {
      console.debug(`[ContentScript DEBUG] ${message}`, data || '');
    }
  },
  info: (message, data) => console.info(`[ContentScript INFO] ${message}`, data || ''),
  warn: (message, data) => console.warn(`[ContentScript WARN] ${message}`, data || ''),
  error: (message, data) => console.error(`[ContentScript ERROR] ${message}`, data || ''),
  timer: label => {
    const start = performance.now();
    return {
      end: () => {
        const duration = performance.now() - start;
        Logger.debug(`${label}: ${duration.toFixed(2)}ms`);
      }
    };
  },
  isDebugMode: () => {
    return localStorage.getItem('security-analyzer-debug') === 'true';
  }
};

const Config = {
  isFeatureEnabled: feature => {
    switch (feature) {
      case 'debug':
        return localStorage.getItem('security-analyzer-debug') === 'true';
      case 'cache':
        return localStorage.getItem('security-analyzer-cache') !== 'false';
      default:
        return false;
    }
  }
};

/**
 * Unified Content Detector for page analysis
 */
class ContentDetector {
  constructor() {
    this.prdKeywords = [
      'prd',
      'product requirement',
      'requirement',
      'spec',
      'specification',
      'functional spec',
      '产品需求',
      '需求文档',
      '功能说明',
      '规格说明',
      '需求规格',
      '产品规格',
      '系统需求',
      '业务需求'
    ];

    this.attachmentSelectors = {
      // Group: Direct Indicators (High weight)
      direct: {
        weight: 10,
        selectors: [
          'a[download]',
          'a[data-attachment]',
          'a[href*="downloadFile"]',
          'a[href*="/api/download/"]',
          'a[href*="/attachments/"]',
          'a.attachment-link',
          'a.file-link',
          'a.download-link'
        ]
      },
      // Group: File Extensions (High weight)
      fileExtensions: {
        weight: 9,
        selectors: [
          'a[href$=".pdf"]',
          'a[href$=".docx"]',
          'a[href$=".doc"]',
          'a[href$=".xlsx"]',
          'a[href$=".pptx"]',
          'a[href$=".zip"]',
          'a[href$=".rar"]',
          'a[href$=".txt"]'
        ]
      },
      // Group: Platform Specific (Medium to High weight)
      platform: {
        weight: 8,
        selectors: [
          // PingCode
          '.file-item a',
          '.attachment-item a',
          'a[href*="atlas.pingcode.com"]',

          // Jira/Confluence
          '.attachment-list a',
          '.attachments a',
          '.file-list a'
        ]
      },
      // Group: Keywords in attributes (Medium weight)
      keywords: {
        weight: 5,
        selectors: [
          'a[title*="下载"]',
          'a[title*="Download"]',
          'a[title*="附件"]',
          'a[title*="文件"]',
          'a[aria-label*="下载"]',
          'a[aria-label*="附件"]',
          'a[href*="download"]',
          'a[href*="attachment"]'
        ]
      },
      // Group: Generic class names (Low weight, high chance of false positives)
      genericClasses: {
        weight: 2,
        selectors: [
          'a[class*="attachment"]',
          'a[class*="file"]',
          'a[class*="document"]',
          'a[class*="upload"]',
          'a[class*="attach"]'
        ]
      },
      // Group: Speculative (Very low weight)
      speculative: {
        weight: 1,
        selectors: [
          'a[href*=".pdf"]', // Non-exact match
          'a[href*=".docx"]',
          'a[href*=".doc"]',
          'a[href*=".xlsx"]',
          'a[href*=".pptx"]'
        ]
      }
    };

    this.cache = new Map();
    this.cacheExpiryTime = 30 * 60 * 1000; // 30 minutes
    this.isActivated = false;
    this.connectionTest = false;

    Logger.debug('ContentDetector initialized');
  }

  /**
   * Activate the content detector
   */
  activate() {
    if (this.isActivated) {
      Logger.debug('ContentDetector already activated');
      return;
    }

    const timer = Logger.timer('content-detection-activation');

    try {
      this.isActivated = true;
      this.connectionTest = true;
      Logger.info('Content detector activated successfully');
    } catch (error) {
      Logger.error('Failed to activate content detector:', error);
    } finally {
      timer.end();
    }
  }

  /**
   * Test connection and basic functionality
   */
  testConnection() {
    Logger.info('Content script connection test');
    this.connectionTest = true;
    return {
      status: 'connected',
      timestamp: Date.now(),
      url: window.location.href,
      title: document.title
    };
  }

  /**
   * Detect attachments and page content
   */
  async detectContent() {
    const timer = Logger.timer('content-detection');

    try {
      const attachments = this.detectAttachments();
      const pageText = await this.extractPageText();

      const result = {
        attachments: attachments || [],
        pageText: pageText || '',
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
        detectionSuccess: true
      };

      if (Config.isFeatureEnabled('cache')) {
        this.cacheResult(result);
      }

      Logger.info(
        `Content detection completed: ${attachments.length} attachments, ${pageText.length} chars text`
      );
      return result;
    } catch (error) {
      Logger.error('Content detection failed:', error);
      return {
        attachments: [],
        pageText: '',
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
        detectionSuccess: false,
        error: error.message
      };
    } finally {
      timer.end();
    }
  }

  /**
   * Custom attachment detection for Coding.net
   * @private
   */
  _detectCodingNetAttachments() {
    const attachments = [];
    const processedUrls = new Set();
    const elements = document.querySelectorAll('div.attachments-item-wrapper-3W8snySeRJ');

    Logger.debug(`[Coding.net] Found ${elements.length} potential attachment elements.`);

    elements.forEach(element => {
      try {
        const path = element.dataset.src;
        if (!path) return;

        const url = new URL(path, window.location.origin).href;
        if (processedUrls.has(url)) return;

        const nameElement = element.querySelector('.attachments-item-title-1A7CPhKa6O');
        const sizeElement = element.querySelector('.attachments-item-size-2HWd4zAdEG');

        const name = nameElement
          ? nameElement.textContent.trim()
          : this.extractNameFromUrl(url);
        const size = sizeElement ? sizeElement.textContent.trim() : null;
        const fileType = this.getFileType(url, name);

        const relevanceScore = 200; // High score for specific detector

        attachments.push({
          name: this.cleanAttachmentName(name),
          url,
          type: fileType,
          size,
          lastModified: null,
          relevanceScore,
          sourceSelector: 'coding.net-custom',
          element: {
            tagName: element.tagName,
            className: element.className,
            id: element.id
          }
        });
        processedUrls.add(url);
      } catch (error) {
        Logger.debug('[Coding.net] Failed to parse attachment element:', error);
      }
    });

    return attachments;
  }

  /**
   * Detect attachments on the page
   */
  detectAttachments() {
    const timer = Logger.timer('attachment-detection');
    let attachments = [];
    const processedUrls = new Set();

    try {
      // Custom detection for specific platforms like Coding.net
      if (window.location.hostname.includes('coding.net')) {
        const codingAttachments = this._detectCodingNetAttachments();
        if (codingAttachments.length > 0) {
          attachments = attachments.concat(codingAttachments);
          codingAttachments.forEach(att => processedUrls.add(att.url));
        }
      }
      for (const groupName in this.attachmentSelectors) {
        const group = this.attachmentSelectors[groupName];
        const { weight, selectors } = group;

        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              Logger.debug(
                `Selector "${selector}" (group: ${groupName}, weight: ${weight}) found ${elements.length} elements`
              );
            }

            elements.forEach(element => {
              try {
                const sourceInfo = { selector, group: groupName, weight };
                const attachment = this.parseAttachmentElement(element, sourceInfo);

                if (attachment && !processedUrls.has(attachment.url)) {
                  attachments.push(attachment);
                  processedUrls.add(attachment.url);
                  Logger.debug('New attachment detected:', {
                    name: attachment.name,
                    score: attachment.relevanceScore,
                    selector: attachment.sourceSelector
                  });
                } else if (attachment && processedUrls.has(attachment.url)) {
                  const existing = attachments.find(a => a.url === attachment.url);
                  if (existing && attachment.relevanceScore > existing.relevanceScore) {
                    Logger.debug(
                      `Updating attachment with higher score: ${attachment.name}`,
                      {
                        old_score: existing.relevanceScore,
                        new_score: attachment.relevanceScore,
                        selector: attachment.sourceSelector
                      }
                    );
                    existing.relevanceScore = attachment.relevanceScore;
                    existing.sourceSelector = attachment.sourceSelector;
                  }
                }
              } catch (parseError) {
                Logger.debug('Failed to parse attachment element:', parseError);
              }
            });
          } catch (selectorError) {
            Logger.debug(`Selector "${selector}" failed:`, selectorError);
          }
        }
      }

      // Sort attachments by relevance
      attachments.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      Logger.info(`Found ${attachments.length} unique attachments.`);
      if (attachments.length > 0) {
        Logger.debug(
          'Final sorted attachments list:',
          attachments.map(a => ({ name: a.name, score: a.relevanceScore, url: a.url }))
        );
      }
      return attachments;
    } catch (error) {
      Logger.error('Attachment detection failed:', error);
      return [];
    } finally {
      timer.end();
    }
  }

  /**
   * Parse attachment element to extract information
   */
  parseAttachmentElement(element, sourceInfo) {
    try {
      const url = element.href || element.getAttribute('href');
      if (!url) return null;

      const name = this.extractAttachmentName(element);
      const fileType = this.getFileType(url, name);
      const size = this.extractFileSize(element);
      const lastModified = this.extractLastModified(element);
      const relevanceScore = this.calculateRelevanceScore(name, url, element, sourceInfo);

      return {
        name,
        url,
        type: fileType,
        size,
        lastModified,
        relevanceScore,
        sourceSelector: `${sourceInfo.group} > "${sourceInfo.selector}"`,
        element: {
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          title: element.title,
          text: element.textContent?.trim()
        }
      };
    } catch (error) {
      Logger.debug('Failed to parse attachment element:', error);
      return null;
    }
  }

  /**
   * Extract attachment name from element
   */
  extractAttachmentName(element) {
    // Try multiple methods to get attachment name
    const candidates = [
      element.getAttribute('download'),
      element.title,
      element.getAttribute('aria-label'),
      element.textContent?.trim(),
      element.getAttribute('data-filename'),
      this.extractNameFromUrl(element.href)
    ].filter(Boolean);

    for (const candidate of candidates) {
      const cleaned = this.cleanAttachmentName(candidate);
      if (cleaned && cleaned.length > 3) {
        return cleaned;
      }
    }

    return this.generateFallbackName(element);
  }

  /**
   * Extract name from URL
   */
  extractNameFromUrl(url) {
    if (!url) return null;
    try {
      // Using window.location.origin as a base for relative URLs
      const absoluteUrl = new URL(url, window.location.origin).href;
      // Decode the URL to handle encoded characters like %20
      const decodedUrl = decodeURIComponent(absoluteUrl);
      const urlObj = new URL(decodedUrl);

      // Look for a 'filename' or 'file' parameter in the query string
      const filenameFromQuery =
        urlObj.searchParams.get('filename') || urlObj.searchParams.get('file');
      if (filenameFromQuery) {
        return filenameFromQuery;
      }

      // Extract from path
      const pathname = urlObj.pathname;
      // Remove trailing slashes and then get the last part
      const filenameFromPath = pathname.replace(/\/$/, '').split('/').pop();

      // Return the filename from path if it seems valid
      return filenameFromPath || null;
    } catch (error) {
      // If URL parsing fails, fall back to a simpler regex approach
      const match = url.match(/[^/\\?#]+(?=([?#]|$))/);
      return match ? decodeURIComponent(match[0]) : null;
    }
  }

  /**
   * Clean attachment name
   */
  cleanAttachmentName(name) {
    if (!name) return '';

    // Use a textarea to decode HTML entities (e.g., &amp; -> &)
    const textArea = document.createElement('textarea');
    textArea.innerHTML = name;
    let cleaned = textArea.value;

    // Remove file size info often included in the text (e.g., "My Document.pdf (1.2MB)")
    cleaned = cleaned.replace(/\s*\([\d.]+\s*(kb|mb|gb|bytes?)\)$/i, '');

    // Remove common non-filename text
    cleaned = cleaned.replace(/^(下载|附件|文件)\s*[:：]?\s*/, '');

    // Normalize whitespace and remove characters that are unlikely to be in a filename.
    // Keeps letters, numbers, CJK chars, and common filename characters: . _ - ( ) [ ]
    cleaned = cleaned.replace(/[^\w\s\u4e00-\u9fff._()\[\]-]/g, ' ').trim();

    // Collapse multiple spaces into a single space
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Fix common pattern: "file name . ext" -> "file name.ext"
    cleaned = cleaned.replace(/\s+\./g, '.');

    return cleaned;
  }

  /**
   * Get file type from URL or name
   */
  getFileType(url, name) {
    const fullString = `${url} ${name}`.toLowerCase();

    const typeMap = {
      pdf: /\.pdf/,
      docx: /\.docx/,
      doc: /\.doc(?!x)/,
      xlsx: /\.xlsx/,
      pptx: /\.pptx/,
      txt: /\.txt/,
      zip: /\.zip/,
      rar: /\.rar/
    };

    for (const [type, regex] of Object.entries(typeMap)) {
      if (regex.test(fullString)) {
        return type;
      }
    }

    return 'unknown';
  }

  /**
   * Generate fallback name for attachment
   */
  generateFallbackName(element) {
    const contextName = this.extractNameFromPageContext(element);
    if (contextName) return contextName;

    const fileType = this.inferFileTypeFromContext(element);
    const timestamp = Date.now();
    return `attachment_${fileType}_${timestamp}`;
  }

  /**
   * Extract name from page context
   */
  extractNameFromPageContext(element) {
    try {
      const parent = element.closest(
        '[class*="file"], [class*="attachment"], [class*="document"]'
      );
      if (parent) {
        const text = parent.textContent?.trim();
        if (text && text.length < 100) {
          return this.cleanAttachmentName(text);
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Infer file type from context
   */
  inferFileTypeFromContext(element) {
    const context = element.outerHTML.toLowerCase();
    if (context.includes('pdf')) return 'pdf';
    if (context.includes('doc')) return 'doc';
    if (context.includes('excel') || context.includes('xlsx')) return 'xlsx';
    if (context.includes('ppt') || context.includes('pptx')) return 'pptx';
    return 'unknown';
  }

  /**
   * Extract file size information
   */
  extractFileSize(element) {
    const text = element.textContent || '';
    const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB|bytes?)/i);
    return sizeMatch ? sizeMatch[0] : null;
  }

  /**
   * Extract last modified information
   */
  extractLastModified(element) {
    const text = element.textContent || '';
    const dateMatch = text.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/);
    return dateMatch ? dateMatch[0] : null;
  }

  /**
   * Calculate relevance score for attachment
   */
  calculateRelevanceScore(name, url, element, sourceInfo) {
    // Start with a base score from the selector's weight.
    let score = sourceInfo.weight * 10;

    // Boost score for specific keywords in link text or title.
    const linkText = (element.textContent || '').toLowerCase();
    const titleText = (element.title || '').toLowerCase();
    const keywords = ['附件', '下载', 'download', 'attachment', 'file'];

    for (const keyword of keywords) {
      if (linkText.includes(keyword) || titleText.includes(keyword)) {
        score += 20; // Add a significant boost if keywords are found.
        break;
      }
    }

    // Boost for known file extensions in the URL.
    const fileExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.pptx', '.zip', '.rar'];
    for (const ext of fileExtensions) {
      if (url.toLowerCase().endsWith(ext)) {
        score += 30; // Strong indicator of a file download.
        break;
      }
    }

    // Penalize if it's likely just a page navigation link.
    if (element.href && element.href.startsWith('#')) {
      score -= 50;
    }

    // Penalize for very long and complex URLs that might be API calls, not direct downloads.
    if (url.length > 250) {
      score -= 10;
    }

    return Math.max(0, score); // Ensure score is not negative.

    // Check for PRD keywords
    for (const keyword of this.prdKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }

    // Prefer certain file types
    if (text.includes('.docx') || text.includes('.pdf')) score += 5;
    if (text.includes('.doc')) score += 3;

    // Check element context
    if (element.className.includes('requirement') || element.className.includes('prd')) {
      score += 8;
    }

    return score;
  }

  /**
   * Extract page text content with dynamic loading support
   */
  async extractPageText() {
    const timer = Logger.timer('page-text-extraction');

    try {
      // Wait for dynamic content to load
      await this.waitForContentToLoad();

      const contentSelectors = [
        // Coding.net specific selectors
        '.requirement-detail-content',
        '.issue-content',
        '.project-description',
        '.requirement-description',
        '.task-description',
        '.issue-body',
        '.markdown-body',

        // Generic content selectors
        'main',
        '.main-content',
        '#main',
        '.content',
        '.page-content',
        '.article-content',
        '.post-content',
        '.requirement-content',
        '.description',
        '.detail',
        '.specification',
        '.prd-content',
        '.document-content',

        // Requirement specific
        '[data-testid="requirement-content"]',
        '[class*="requirement"]',
        '[class*="description"]',
        '[class*="detail"]'
      ];

      let bestContent = '';
      let maxLength = 0;
      let selectedSelector = null;

      // Try specific content selectors first
      for (const selector of contentSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            const text = this.extractTextFromElement(element);
            if (text.length > maxLength && this.isRequirementContent(text)) {
              bestContent = text;
              maxLength = text.length;
              selectedSelector = selector;
            }
          }
        } catch (error) {
          Logger.debug(`Selector "${selector}" failed:`, error);
        }
      }

      // If no good content found, try to find detailed content sections
      if (!bestContent || maxLength < 500) {
        bestContent = await this.extractDynamicContent();
      }

      // Fallback to body if still no content found
      if (!bestContent || bestContent.length < 100) {
        bestContent = this.extractTextFromElement(document.body);
        selectedSelector = 'document.body (fallback)';
      }

      const trimmedContent = bestContent.substring(0, 50000); // Limit to 50k chars
      Logger.info(
        `Extracted ${trimmedContent.length} characters of page text using selector: ${selectedSelector}`
      );
      Logger.debug(`Content preview: ${trimmedContent.substring(0, 200)}...`);

      return trimmedContent;
    } catch (error) {
      Logger.error('Page text extraction failed:', error);
      return '';
    } finally {
      timer.end();
    }
  }

  /**
   * Wait for dynamic content to load
   */
  async waitForContentToLoad() {
    return new Promise(resolve => {
      // Wait for a short time to allow dynamic content to load
      setTimeout(() => {
        // Check if there are any loading indicators
        const loadingIndicators = document.querySelectorAll(
          '.loading, .spinner, [class*="loading"], [class*="spinner"]'
        );

        if (loadingIndicators.length === 0) {
          resolve();
        } else {
          // Wait a bit more if loading indicators are present
          setTimeout(resolve, 2000);
        }
      }, 1000);
    });
  }

  /**
   * Extract content from dynamically loaded sections
   */
  async extractDynamicContent() {
    try {
      // Look for expandable content areas
      const expandableSelectors = [
        '.expand-btn',
        '.show-more',
        '.load-more',
        '[data-toggle="collapse"]',
        '.collapsed',
        '.expandable'
      ];

      for (const selector of expandableSelectors) {
        const expandBtn = document.querySelector(selector);
        if (expandBtn && expandBtn.offsetParent !== null) {
          try {
            expandBtn.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            Logger.debug(`Failed to expand content with selector ${selector}:`, error);
          }
        }
      }

      // Try to find content in common requirement detail areas
      const detailSelectors = [
        '.requirement-body',
        '.issue-description',
        '.task-body',
        '.content-body',
        '.detail-content',
        '.full-content'
      ];

      for (const selector of detailSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = this.extractTextFromElement(element);
          if (text.length > 200 && this.isRequirementContent(text)) {
            Logger.info(`Found dynamic content with selector: ${selector}`);
            return text;
          }
        }
      }

      return '';
    } catch (error) {
      Logger.debug('Dynamic content extraction failed:', error);
      return '';
    }
  }

  /**
   * Extract text from a DOM element
   */
  extractTextFromElement(element) {
    if (!element) return '';

    // Clone element to avoid modifying original
    const clone = element.cloneNode(true);

    // Remove script and style elements
    const scriptsAndStyles = clone.querySelectorAll('script, style, nav, footer, aside');
    scriptsAndStyles.forEach(el => el.remove());

    // Get text content
    return clone.textContent?.trim() || '';
  }

  /**
   * Check if text appears to be requirement content
   */
  isRequirementContent(text) {
    if (!text || text.length < 50) return false;

    const lowerText = text.toLowerCase();
    let score = 0;

    // PRD and requirement keywords (higher weight)
    for (const keyword of this.prdKeywords) {
      if (lowerText.includes(keyword)) score += 2;
    }

    // Functional indicators (medium weight)
    const functionalIndicators = [
      '功能',
      '需求',
      '用户',
      '系统',
      '接口',
      'api',
      '流程',
      '业务',
      '实现',
      '设计',
      '架构',
      '模块',
      '组件',
      '服务',
      '数据',
      '安全',
      'feature',
      'function',
      'requirement',
      'user',
      'system',
      'design',
      'implement',
      'architecture',
      'module',
      'component',
      'service',
      'data'
    ];
    for (const indicator of functionalIndicators) {
      if (lowerText.includes(indicator)) score += 1;
    }

    // Technical indicators (lower weight)
    const technicalIndicators = [
      '开发',
      '测试',
      '部署',
      '配置',
      '环境',
      '版本',
      '代码',
      '文档',
      'development',
      'test',
      'deploy',
      'config',
      'environment',
      'version'
    ];
    for (const indicator of technicalIndicators) {
      if (lowerText.includes(indicator)) score += 0.5;
    }

    // Negative indicators (reduce score for non-requirement content)
    const negativeIndicators = [
      '登录',
      '注册',
      '用户名',
      '密码',
      '验证码',
      '菜单',
      '导航',
      'login',
      'register',
      'username',
      'password',
      'menu',
      'navigation',
      '404',
      '500',
      'error',
      '错误',
      '异常',
      '失败'
    ];
    for (const indicator of negativeIndicators) {
      if (lowerText.includes(indicator)) score -= 0.5;
    }

    // Boost score for longer, structured content
    if (text.length > 1000) score += 1;
    if (text.length > 3000) score += 1;

    // Check for structured content patterns
    if (text.includes('：') || text.includes(':')) score += 0.5;
    if (text.includes('、') || text.includes(',')) score += 0.5;
    if (/\d+\./.test(text)) score += 0.5; // Numbered lists

    Logger.debug(`Content relevance score: ${score} for text length: ${text.length}`);
    return score >= 1.5;
  }

  /**
   * Cache detection result
   */
  cacheResult(result) {
    if (!Config.isFeatureEnabled('cache')) return;

    try {
      const key = window.location.href;
      this.cache.set(key, {
        data: result,
        timestamp: Date.now()
      });

      // Clean old cache entries
      this.cleanCache();
    } catch (error) {
      Logger.debug('Failed to cache result:', error);
    }
  }

  /**
   * Get cached result
   */
  getCachedResult() {
    if (!Config.isFeatureEnabled('cache')) return null;

    try {
      const key = window.location.href;
      const cached = this.cache.get(key);

      if (cached && Date.now() - cached.timestamp < this.cacheExpiryTime) {
        Logger.debug('Using cached result');
        return cached.data;
      }

      return null;
    } catch (error) {
      Logger.debug('Failed to get cached result:', error);
      return null;
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanCache() {
    try {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheExpiryTime) {
          this.cache.delete(key);
        }
      }
    } catch (error) {
      Logger.debug('Failed to clean cache:', error);
    }
  }

  /**
   * Get detection summary
   */
  getSummary() {
    return {
      isActivated: this.isActivated,
      connectionTest: this.connectionTest,
      cacheSize: this.cache.size,
      supportedPlatforms: ['PingCode', 'Coding.net', 'Jira', 'Confluence', 'Generic'],
      version: '1.0.0'
    };
  }

  /**
   * Debug page structure
   */
  debugPageStructure() {
    if (!Config.isFeatureEnabled('debug')) return;

    Logger.debug('=== Page Structure Debug ===');
    Logger.debug('URL:', window.location.href);
    Logger.debug('Title:', document.title);

    // Check for attachments
    Logger.debug('Attachment elements found:');
    for (const selector of this.attachmentSelectors.slice(0, 10)) {
      // Limit to first 10
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        Logger.debug(`${selector}: ${elements.length} elements`);
      }
    }

    // Check for content areas
    const contentSelectors = ['main', '.main-content', '.content', '.page-content'];
    Logger.debug('Content areas found:');
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        Logger.debug(`${selector}: ${element.textContent?.length || 0} characters`);
      }
    }
  }
}

// Initialize content detector
console.log('🔧 初始化 ContentDetector...');
const contentDetector = new ContentDetector();
console.log('✅ ContentDetector 初始化完成:', contentDetector);

// Global functions for extension communication
window.detectPageContent = async () => {
  Logger.info('detectPageContent called');
  return await contentDetector.detectContent();
};

window.activateContentDetector = () => {
  Logger.info('activateContentDetector called');
  contentDetector.activate();
  return contentDetector.getSummary();
};

window.testContentScript = () => {
  Logger.info('testContentScript called');
  return contentDetector.testConnection();
};

window.debugPageStructure = () => {
  Logger.info('debugPageStructure called');
  contentDetector.debugPageStructure();
  return contentDetector.getSummary();
};

// Message listener for extension communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content Script 收到消息:', request);
  Logger.debug('Message received:', request);

  // 确保全局对象始终可用
  if (!window.ContentDetector) {
    console.log('🔧 强制暴露 ContentDetector 到全局');
    window.ContentDetector = ContentDetector;
    window.contentDetector = contentDetector;
  }

  const handleMessage = async () => {
    try {
      switch (request.action) {
        case 'detectContent':
          console.log('🔍 开始执行 detectContent...');
          const result = await contentDetector.detectContent();
          console.log('✅ detectContent 完成:', result);
          const response = { success: true, data: result };
          console.log('📤 Content Script 发送响应:', response);
          return response;

        case 'activateDetector':
          contentDetector.activate();
          const activateResponse = { success: true, data: contentDetector.getSummary() };
          console.log('📤 activateDetector 响应:', activateResponse);
          return activateResponse;

        case 'testConnection':
          const testResult = contentDetector.testConnection();
          const testResponse = { success: true, data: testResult };
          console.log('📤 testConnection 响应:', testResponse);
          return testResponse;

        case 'debugPage':
          contentDetector.debugPageStructure();
          const debugResponse = { success: true, data: contentDetector.getSummary() };
          console.log('📤 debugPage 响应:', debugResponse);
          return debugResponse;

        case 'diagnostic-ping':
          // 诊断ping请求，返回基本状态信息
          console.log('💓 响应 diagnostic-ping');
          const pingResponse = {
            success: true,
            data: {
              status: 'active',
              timestamp: Date.now(),
              url: window.location.href,
              contentDetectorActive: contentDetector?.isActivated || false,
              version: '1.0.0',
              globalObjects: {
                ContentDetector: typeof window.ContentDetector,
                contentDetector: typeof window.contentDetector
              }
            }
          };
          console.log('💓 ping 响应内容:', pingResponse);
          return pingResponse;

        default:
          Logger.warn('Unknown action:', request.action);
          const unknownResponse = { success: false, error: 'Unknown action' };
          console.log('📤 Unknown action 响应:', unknownResponse);
          return unknownResponse;
      }
    } catch (error) {
      Logger.error('Message handling failed:', error);
      const errorResponse = { success: false, error: error.message };
      console.error('📤 Error 响应:', errorResponse);
      return errorResponse;
    }
  };

  // 使用 Promise 方式处理异步响应
  handleMessage()
    .then(sendResponse)
    .catch(error => {
      console.error('❌ 消息处理异常:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true; // Keep message channel open for async response
});

// Auto-activate on load
document.addEventListener('DOMContentLoaded', () => {
  Logger.info('DOM loaded, activating content detector');
  contentDetector.activate();
});

// Immediate activation if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => contentDetector.activate());
} else {
  contentDetector.activate();
}

// Export for debugging
console.log('🌐 暴露到全局对象...');
try {
  window.ContentDetector = ContentDetector;
  window.contentDetector = contentDetector;
  console.log('✅ 全局对象暴露成功');
} catch (error) {
  console.error('❌ 全局对象暴露失败:', error);
}

// 验证暴露是否成功
setTimeout(() => {
  console.log('🔍 验证全局对象:', {
    ContentDetector: window.ContentDetector,
    contentDetector: window.contentDetector,
    isFunction: typeof window.ContentDetector === 'function',
    isObject: typeof window.contentDetector === 'object'
  });

  // 如果验证失败，再次尝试暴露
  if (!window.ContentDetector || !window.contentDetector) {
    console.warn('⚠️ 全局对象验证失败，重新暴露...');
    window.ContentDetector = ContentDetector;
    window.contentDetector = contentDetector;
  }
}, 100);

Logger.info('Content script loaded successfully');
