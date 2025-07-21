// content.js - 页面内容检测脚本
class ContentDetector {
  constructor() {
    this.attachmentSelectors = [
      // 通用附件选择器
      'a[href*=".pdf"]',
      'a[href*=".docx"]', 
      'a[href*=".doc"]',
      'a[download]',
      '.attachment',
      '.file-item',
      '.document-link',
      
      // PingCode特定选择器
      '.attachment-list a',
      '.file-list-item',
      '[class*="attachment"]',
      '[class*="file"]',
      '.pingcode-attachment',
      
      // 其他常见平台选择器
      '.jira-attachment',
      '.confluence-attachment',
      '.notion-file',
      '.teambition-file',
      '.tower-attachment',
      '.worktile-file',
      
      // 通用文件列表选择器
      '.files a',
      '.documents a',
      '.attachments a',
      '[data-file-type]',
      '[data-attachment]'
    ];

    this.textContentSelectors = [
      // 需求描述区域
      '.requirement-content',
      '.description',
      '.content',
      '.detail',
      '.requirement-detail',
      
      // 富文本编辑器
      '.rich-text-editor',
      '.editor-content',
      '[contenteditable="true"]',
      
      // 表单文本区域
      'textarea',
      '.text-area',
      
      // PingCode特定选择器
      '.requirement-description',
      '.story-content',
      '.epic-content'
    ];
  }

  // 检测页面附件
  detectAttachments() {
    const attachments = [];
    const foundLinks = new Set(); // 避免重复

    this.attachmentSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
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

  parseAttachmentElement(element) {
    let url, name, type;

    if (element.tagName === 'A') {
      url = element.href;
      name = element.textContent.trim() || element.getAttribute('download') || this.getFileNameFromUrl(url);
    } else {
      // 查找子元素中的链接
      const link = element.querySelector('a');
      if (link) {
        url = link.href;
        name = link.textContent.trim() || element.textContent.trim();
      }
    }

    if (!url || !name) return null;

    // 确定文件类型
    type = this.getFileType(url, name);
    
    // 只返回我们关心的文件类型
    if (!['pdf', 'docx', 'doc'].includes(type.toLowerCase())) {
      return null;
    }

    return {
      url,
      name: name.substring(0, 100), // 限制长度
      type,
      size: this.getFileSize(element)
    };
  }

  getFileType(url, name) {
    const extension = (url.split('.').pop() || name.split('.').pop() || '').toLowerCase();
    const typeMap = {
      'pdf': 'PDF',
      'doc': 'DOC', 
      'docx': 'DOCX'
    };
    return typeMap[extension] || extension.toUpperCase();
  }

  getFileNameFromUrl(url) {
    try {
      return decodeURIComponent(url.split('/').pop().split('?')[0]);
    } catch {
      return 'unknown_file';
    }
  }

  getFileSize(element) {
    // 尝试从元素中提取文件大小信息
    const sizeText = element.textContent.match(/\(([0-9.]+\s*(KB|MB|GB))\)/i);
    return sizeText ? sizeText[1] : null;
  }

  // 检测页面文本内容
  detectPageText() {
    let textContent = '';
    const foundTexts = [];

    this.textContentSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          const text = this.extractTextFromElement(element);
          if (text && text.length > 50) { // 只保留有意义的文本
            foundTexts.push(text);
          }
        });
      } catch (error) {
        console.warn(`文本选择器 ${selector} 执行失败:`, error);
      }
    });

    // 合并去重
    textContent = [...new Set(foundTexts)].join('\n\n');

    // 如果没有找到特定区域的文本，尝试获取页面主要内容
    if (!textContent.trim()) {
      textContent = this.extractMainContent();
    }

    return textContent.substring(0, 5000); // 限制长度
  }

  extractTextFromElement(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value;
    }
    
    if (element.contentEditable === 'true') {
      return element.innerText || element.textContent;
    }

    return element.innerText || element.textContent || '';
  }

  extractMainContent() {
    // 尝试获取页面主要内容区域
    const mainSelectors = [
      'main',
      '.main-content',
      '.content',
      '#content',
      '.container',
      'article',
      '.article-content'
    ];

    for (const selector of mainSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.innerText || element.textContent || '';
        if (text.length > 100) {
          return text;
        }
      }
    }

    // 最后尝试body内容（排除导航和脚本）
    const bodyClone = document.body.cloneNode(true);
    
    // 移除不需要的元素
    const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', '.navigation'];
    removeSelectors.forEach(sel => {
      bodyClone.querySelectorAll(sel).forEach(el => el.remove());
    });

    return bodyClone.innerText || bodyClone.textContent || '';
  }

  // 检测页面类型（是否为需求管理页面）
  detectPageType() {
    const url = window.location.href;
    const title = document.title;
    const content = document.body.textContent.toLowerCase();

    const indicators = {
      isPingCode: url.includes('pingcode') || content.includes('pingcode'),
      isRequirementPage: /需求|requirement|story|epic|prd/i.test(title + content),
      hasAttachments: this.detectAttachments().length > 0,
      hasTextContent: this.detectPageText().trim().length > 100
    };

    return indicators;
  }
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectContent') {
    try {
      const detector = new ContentDetector();
      
      const result = {
        attachments: detector.detectAttachments(),
        pageText: detector.detectPageText(),
        pageType: detector.detectPageType(),
        url: window.location.href,
        title: document.title
      };

      console.log('检测到的内容:', result);
      sendResponse(result);
    } catch (error) {
      console.error('内容检测失败:', error);
      sendResponse({ error: error.message });
    }
  }
  
  return true; // 保持消息通道开放
});