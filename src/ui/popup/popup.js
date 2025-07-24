// popup.js - Security Requirements Analysis Popup Logic
import { SharedConfigManager } from '../shared/config-manager.js';
import { DOMSanitizer } from '../shared/dom-sanitizer.js';

class SecurityAnalysisPopup {
  constructor() {
    this.attachments = [];
    this.pageText = "";
    this.selectedSource = null;
    this.selectionTimeout = null;
    this.timeoutDuration = 10; // seconds
    this.retryCount = 0;
    this.maxRetries = 3;
    this.currentOperation = null;
    this.eventsbound = false;
    this.configEventsbound = false;
    
    // 文件上传相关属性
    this.selectedFile = null;
    this.fileContent = null;
    
    // 导出相关属性
    this.lastAnalysisResult = null;
    
    this.init();
  }

  async init() {
    this.showLoading();

    // 首先检查配置状态
    const configStatus = await this.checkConfiguration();

    if (!configStatus.isConfigured) {
      this.showConfigAlert();
      return;
    }

    await this.detectPageContent();
    this.bindEvents();
    this.showContent();
    this.showConfigStatus(configStatus);
  }

  showLoading() {
    document.getElementById("loading").style.display = "block";
    document.getElementById("content").style.display = "none";
  }

  showContent() {
    document.getElementById("loading").style.display = "none";
    document.getElementById("content").style.display = "block";
  }

  async detectPageContent() {
    console.log("🔍 开始检测页面内容...");
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error("无法获取当前标签页");
      }

      console.log("📋 当前标签页:", tab.url);

      console.log("📨 向background发送消息获取页面内容...");
      // 向background发送消息，由background转发到content script
      const response = await chrome.runtime.sendMessage({
        action: "detectContent",
        tabId: tab.id
      });

      console.log("📨 收到background响应:", response);

      if (response && response.success !== false) {
        this.attachments = response.attachments || [];
        this.pageText = response.pageText || "";

        console.log("✅ 页面内容检测完成:");
        console.log("- 附件数量:", this.attachments.length);
        console.log("- 页面文本长度:", this.pageText.length);
        
        if (this.attachments.length > 0) {
          console.log("📎 检测到的附件:", this.attachments.map(a => a.name));
        }

        this.updateUI();
      } else {
        // 处理错误响应
        const errorMsg = response?.error || "页面内容检测返回空结果";
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error("❌ 检测页面内容失败:", error);

      let errorMessage = "无法检测页面内容";
      let fallbackOptions = {};

      if (error.message.includes("Could not establish connection")) {
        errorMessage = "无法连接到页面，请刷新页面后重试";
        fallbackOptions = {
          fallback: {
            text: "手动输入内容",
            action: () => this.focusManualInput(),
          },
        };
      } else if (error.message.includes("Extension context invalidated")) {
        errorMessage = "插件需要重新加载，请关闭弹窗后重新打开";
        fallbackOptions = {
          retryable: false,
        };
      } else {
        errorMessage = `页面检测失败: ${error.message}`;
        fallbackOptions = {
          fallback: {
            text: "手动输入内容",
            action: () => this.focusManualInput(),
          },
        };
      }

      this.showError("页面检测失败", errorMessage, fallbackOptions);
    }
  }

  updateUI() {
    console.log("📱 开始更新UI...");
    console.log("📎 附件数量:", this.attachments.length);
    console.log("📄 页面文本长度:", this.pageText.length);

    // 更新附件列表
    if (this.attachments.length > 0) {
      console.log("📎 显示附件列表，附件详情:");
      this.attachments.forEach((att, index) => {
        console.log(`  ${index + 1}. ${att.name} (${att.type}) - ${att.size || '未知大小'} - ${att.url.substring(0, 50)}`);
      });
      this.showAttachments();
    } else {
      console.log("📎 没有检测到附件");
      const section = document.getElementById("attachments-section");
      if (section) {
        section.style.display = "none";
      }
      // 显示调试提示
      this.showAttachmentDebugTip();
    }

    // 更新页面文本预览
    if (this.pageText.trim()) {
      console.log("📄 显示页面文本预览");
      this.showPageText();
    } else {
      console.log("📄 没有页面文本内容");
    }

    console.log("✅ UI更新完成");
  }

  showAttachments() {
    console.log("📎 开始显示附件列表...");

    const section = document.getElementById("attachments-section");
    const list = document.getElementById("attachment-list");
    const summary = document.getElementById("attachment-summary");

    console.log("📱 UI元素检查:", {
      section: section ? "✅ 找到" : "❌ 未找到",
      list: list ? "✅ 找到" : "❌ 未找到",
      summary: summary ? "✅ 找到" : "❌ 未找到"
    });

    if (!section || !list || !summary) {
      console.error("❌ 附件UI元素未找到");
      return;
    }

    section.style.display = "block";
    // Clear list content safely
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    // 计算PRD相关附件数量
    const prdAttachments = this.attachments.filter((att) =>
      this.isPRDFile(att),
    );

    console.log("📊 附件统计:", {
      total: this.attachments.length,
      prd: prdAttachments.length
    });

    // 更新统计信息
    const countEl = document.getElementById("attachment-count");
    const prdCountEl = document.getElementById("prd-count");

    if (countEl) countEl.textContent = this.attachments.length;
    if (prdCountEl) prdCountEl.textContent = prdAttachments.length;

    summary.style.display = "block";

    // 按相关性排序附件
    const sortedAttachments = this.sortAttachmentsByRelevance(this.attachments);
    console.log("📋 排序后的附件列表:");
    sortedAttachments.forEach((att, index) => {
      console.log(`  ${index + 1}. ${att.name} (得分: ${this.getRelevanceScore(att)})`);
    });

    sortedAttachments.forEach((attachment, index) => {
      console.log(`📎 创建附件项 ${index + 1}:`, attachment.name);
      const item = this.createAttachmentItem(attachment, index);
      list.appendChild(item);
    });

    // 如果有多个附件，启动选择超时
    if (this.attachments.length > 2) {
      console.log("⏱️ 启动选择超时");
      this.startSelectionTimeout();
    } else {
      // 自动选择最相关的附件
      console.log("🎯 自动选择最佳附件");
      this.autoSelectBestAttachment();
    }

    console.log("✅ 附件列表显示完成");
  }

  showAttachmentDebugTip() {
    const debugTip = document.getElementById("attachment-debug");
    if (debugTip) {
      debugTip.style.display = "block";
    }
  }

  createAttachmentItem(attachment, index) {
    const item = document.createElement("div");
    const isPRD = this.isPRDFile(attachment);

    item.className = `attachment-item ${isPRD ? "prd-recommended" : ""}`;
    item.dataset.index = index;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "attachment";
    radio.value = index;
    radio.id = `attachment-${index}`;

    const content = document.createElement("div");
    content.className = "attachment-content";

    const name = document.createElement("div");
    name.className = "attachment-name";
    name.textContent = attachment.name;

    const metadata = document.createElement("div");
    metadata.className = "attachment-metadata";

    const type = document.createElement("span");
    type.className = "attachment-type";
    type.textContent = attachment.type;

    const size = document.createElement("span");
    size.className = "attachment-size";
    size.textContent = attachment.size || "大小未知";

    metadata.appendChild(type);
    metadata.appendChild(size);

    content.appendChild(name);
    content.appendChild(metadata);

    item.appendChild(radio);
    item.appendChild(content);

    // 点击整个项目来选择
    item.addEventListener("click", () => {
      radio.checked = true;
      this.selectAttachment(index, attachment);
      this.updateAttachmentSelection();
    });

    return item;
  }

  sortAttachmentsByRelevance(attachments) {
    return [...attachments].sort((a, b) => {
      const scoreA = this.getRelevanceScore(a);
      const scoreB = this.getRelevanceScore(b);
      return scoreB - scoreA;
    });
  }

  getRelevanceScore(attachment) {
    let score = 0;
    const name = attachment.name.toLowerCase();

    // PRD相关关键词
    const prdKeywords = ["prd", "requirement", "需求", "产品"];
    if (prdKeywords.some((keyword) => name.includes(keyword))) {
      score += 50;
    }

    // 文件类型优先级
    if (attachment.type === "PDF") score += 30;
    else if (attachment.type === "DOCX") score += 25;
    else if (attachment.type === "DOC") score += 20;

    return score;
  }

  startSelectionTimeout() {
    const timeoutDiv = document.getElementById("selection-timeout");
    const counterSpan = document.getElementById("timeout-counter");
    const progressBar = document.getElementById("timeout-progress-bar");

    timeoutDiv.classList.add("active");

    let remainingTime = this.timeoutDuration;
    counterSpan.textContent = remainingTime;
    progressBar.style.width = "100%";

    this.selectionTimeout = setInterval(() => {
      remainingTime--;
      counterSpan.textContent = remainingTime;
      progressBar.style.width = `${(remainingTime / this.timeoutDuration) * 100}%`;

      if (remainingTime <= 0) {
        this.handleSelectionTimeout();
      }
    }, 1000);
  }

  handleSelectionTimeout() {
    this.clearSelectionTimeout();

    // 自动选择最相关的PRD附件
    const bestAttachment = this.findBestPRDAttachment();
    if (bestAttachment) {
      this.selectAttachment(bestAttachment.index, bestAttachment.attachment);
      this.showTimeoutNotification("已自动选择最相关的PRD文档");
    }
  }

  clearSelectionTimeout() {
    if (this.selectionTimeout) {
      clearInterval(this.selectionTimeout);
      this.selectionTimeout = null;
    }

    const timeoutDiv = document.getElementById("selection-timeout");
    timeoutDiv.classList.remove("active");
  }

  findBestPRDAttachment() {
    let bestScore = 0;
    let bestAttachment = null;
    let bestIndex = 0;

    this.attachments.forEach((attachment, index) => {
      const score = this.getRelevanceScore(attachment);
      if (score > bestScore) {
        bestScore = score;
        bestAttachment = attachment;
        bestIndex = index;
      }
    });

    return bestScore > 0
      ? { attachment: bestAttachment, index: bestIndex }
      : null;
  }

  autoSelectBestAttachment() {
    const best = this.findBestPRDAttachment();
    if (best) {
      this.selectAttachment(best.index, best.attachment);
    }
  }

  selectAttachment(index, attachment) {
    this.selectedSource = { type: "attachment", data: attachment };
    this.clearSelectionTimeout();
    this.updateAttachmentSelection();
  }

  updateAttachmentSelection() {
    // 更新UI显示选中状态
    document.querySelectorAll(".attachment-item").forEach((item) => {
      item.classList.remove("selected");
    });

    const selectedItem = document.querySelector(".attachment-item.selected");
    if (selectedItem) {
      selectedItem.classList.add("selected");
    }
  }

  showPageText() {
    const section = document.getElementById("text-section");
    const preview = document.getElementById("text-preview");

    section.style.display = "block";
    preview.textContent =
      this.pageText.substring(0, 500) +
      (this.pageText.length > 500 ? "..." : "");
  }

  isPRDFile(attachment) {
    const name = attachment.name.toLowerCase();
    const prdKeywords = ["prd", "需求", "requirement", "产品"];
    return (
      prdKeywords.some((keyword) => name.includes(keyword)) ||
      ["pdf", "docx", "doc"].includes(attachment.type.toLowerCase())
    );
  }

  focusManualInput() {
    this.hideError();
    const manualInput = document.getElementById("manual-input");
    manualInput.focus();
    manualInput.placeholder = "请在此输入或粘贴需要分析的内容...";
    this.showTimeoutNotification("已切换到手动输入模式");
  }

  showTimeoutNotification(message) {
    // 创建临时通知
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 12px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 3000);
  }

  bindEvents() {
    // 避免重复绑定
    if (this.eventsbound) return;
    this.eventsbound = true;

    // 配置相关按钮
    this.bindConfigEvents();

    // 刷新按钮
    document.getElementById("refresh-btn")?.addEventListener("click", () => {
      this.init();
    });

    // 分析按钮
    document.getElementById("analyze-btn")?.addEventListener("click", () => {
      this.startAnalysis();
    });

    // 导出按钮
    document.getElementById("export-btn")?.addEventListener("click", () => {
      this.showExportOptions();
    });

    // 批量分析按钮
    document.getElementById("batch-analysis-btn")?.addEventListener("click", () => {
      this.openBatchAnalysis();
    });

    // 附件选择变化
    document.addEventListener("change", (e) => {
      if (e.target.name === "attachment") {
        const index = parseInt(e.target.value);
        this.selectAttachment(index, this.attachments[index]);
      }
    });

    // 帮助按钮
    document.getElementById("help-btn")?.addEventListener("click", () => {
      this.showHelpDialog();
    });

    // 调试相关按钮
    document.getElementById("debug-toggle")?.addEventListener("click", () => {
      this.toggleDebugMode();
    });

    document.getElementById("debug-scan")?.addEventListener("click", () => {
      this.runDebugScan();
    });

    document
      .getElementById("debug-content-script")
      ?.addEventListener("click", () => {
        this.testContentScript();
      });

    // 文件上传事件
    this.bindFileUploadEvents();
  }

  // 绑定文件上传事件
  bindFileUploadEvents() {
    console.log("🔧 开始绑定文件上传事件...");
    
    const fileInput = document.getElementById("file-upload");
    const dropZone = document.getElementById("file-drop-zone");
    const removeBtn = document.getElementById("remove-file-btn");

    console.log("📁 文件上传元素检查:", {
      fileInput: fileInput ? "✅ 找到" : "❌ 未找到",
      dropZone: dropZone ? "✅ 找到" : "❌ 未找到", 
      removeBtn: removeBtn ? "✅ 找到" : "❌ 未找到"
    });

    if (!fileInput) {
      console.error("❌ file-upload 元素未找到");
      return;
    }

    if (!dropZone) {
      console.error("❌ file-drop-zone 元素未找到");
      return;
    }

    // 文件选择事件
    fileInput.addEventListener("change", (e) => {
      console.log("📁 文件选择事件触发:", e.target.files);
      this.handleFileSelect(e.target.files[0]);
    });

    // 点击拖拽区域打开文件选择器
    dropZone.addEventListener("click", (e) => {
      console.log("📁 点击拖拽区域");
      e.preventDefault();
      fileInput.click();
    });

    // 拖拽事件
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      console.log("📁 文件拖拽放置事件触发:", e.dataTransfer.files);
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    // 移除文件按钮
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        console.log("📁 移除文件按钮点击");
        this.removeSelectedFile();
      });
    }

    console.log("✅ 文件上传事件绑定完成");
  }

  // 处理文件选择
  handleFileSelect(file) {
    console.log("📁 开始处理文件选择:", file);
    
    if (!file) {
      console.warn("❌ 没有选择文件");
      return;
    }

    console.log("📁 文件信息:", {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toLocaleString()
    });

    // 验证文件类型
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    const allowedExtensions = ['.pdf', '.docx', '.doc'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    console.log("📁 文件类型验证:", {
      fileType: file.type,
      fileName: fileName,
      hasValidExtension: hasValidExtension,
      typeAllowed: allowedTypes.includes(file.type)
    });

    if (!hasValidExtension && !allowedTypes.includes(file.type)) {
      const errorMsg = '不支持的文件类型。请选择 PDF、DOCX 或 DOC 文件。';
      console.error("❌", errorMsg);
      alert(errorMsg);
      return;
    }

    // 验证文件大小（限制为10MB）
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const errorMsg = '文件太大。请选择小于10MB的文件。';
      console.error("❌", errorMsg, `文件大小: ${this.formatFileSize(file.size)}`);
      alert(errorMsg);
      return;
    }

    console.log("✅ 文件验证通过");
    this.selectedFile = file;
    this.showSelectedFile(file);
    console.log("✅ 文件选择处理完成");
  }

  // 显示选中的文件信息
  showSelectedFile(file) {
    console.log("📁 开始显示选中的文件信息:", file.name);
    
    const fileInfo = document.getElementById("file-selected-info");
    const fileName = document.getElementById("selected-file-name");
    const fileSize = document.getElementById("selected-file-size");
    const dropZone = document.getElementById("file-drop-zone");

    console.log("📁 UI元素检查:", {
      fileInfo: fileInfo ? "✅ 找到" : "❌ 未找到",
      fileName: fileName ? "✅ 找到" : "❌ 未找到",
      fileSize: fileSize ? "✅ 找到" : "❌ 未找到",
      dropZone: dropZone ? "✅ 找到" : "❌ 未找到"
    });

    if (!fileInfo || !fileName || !fileSize) {
      console.error("❌ 文件信息显示元素未找到");
      return;
    }

    fileName.textContent = file.name;
    fileSize.textContent = this.formatFileSize(file.size);
    
    fileInfo.style.display = "flex";
    
    // 隐藏拖拽区域
    if (dropZone) {
      dropZone.style.display = "none";
    }

    console.log("✅ 文件信息显示完成");
  }

  // 移除选中的文件
  removeSelectedFile() {
    console.log("📁 开始移除选中的文件");
    
    this.selectedFile = null;
    this.fileContent = null;
    
    const fileInfo = document.getElementById("file-selected-info");
    const dropZone = document.getElementById("file-drop-zone");
    const fileInput = document.getElementById("file-upload");

    if (fileInfo) {
      fileInfo.style.display = "none";
    }
    
    if (dropZone) {
      dropZone.style.display = "block";
    }
    
    if (fileInput) {
      fileInput.value = "";
    }

    console.log("✅ 文件移除完成");
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async startAnalysis() {
    console.log("🚀 开始分析按钮被点击");
    try {
      this.showProgress();
      this.updateProgress(10, "准备分析...", "正在验证输入内容");

      console.log("📊 获取分析内容...");
      const content = await this.getAnalysisContent();
      console.log("📊 分析内容获取结果:", content);
      
      if (!content || !content.content) {
        throw new Error("没有可分析的内容");
      }

      this.updateProgress(30, "解析内容...", "正在处理文档内容");
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.updateProgress(70, "AI分析中...", "正在生成安全分析");
      console.log("🤖 调用AI分析...");
      const result = await this.performAnalysis(content);
      console.log("🤖 AI分析结果:", result);

      this.updateProgress(100, "分析完成", "正在生成结果");
      this.hideProgress();

      setTimeout(() => {
        this.showAnalysisResult(result);
      }, 500);
    } catch (error) {
      console.error("❌ 分析过程出错:", error);
      this.hideProgress();
      this.showError("分析失败", error.message || "分析过程中出现未知错误", {
        retryable: true,
        fallback: {
          text: "使用简化分析",
          action: () => this.fallbackAnalysis(),
        },
      });
    }
  }

  async getAnalysisContent() {
    console.log("📊 开始获取分析内容...");
    
    // 优先级：本地文件 > 手动输入 > 选中附件 > 页面文本
    
    // 1. 检查本地文件
    if (this.selectedFile) {
      console.log("📁 使用本地文件:", this.selectedFile.name);
      try {
        this.updateProgress(20, "解析本地文件...", "正在读取文件内容");
        const fileContent = await this.parseLocalFile(this.selectedFile);
        console.log("✅ 本地文件解析成功，内容长度:", fileContent.length);
        return { 
          type: "localFile", 
          content: fileContent,
          filename: this.selectedFile.name 
        };
      } catch (error) {
        console.warn("❌ 本地文件解析失败:", error);
        // 显示错误信息但继续尝试其他内容源
        this.showTimeoutNotification(`本地文件解析失败: ${error.message}`);
      }
    }

    // 2. 手动输入
    const manualInput = document.getElementById("manual-input").value.trim();
    if (manualInput) {
      console.log("✏️ 使用手动输入，内容长度:", manualInput.length);
      return { type: "manual", content: manualInput };
    }

    // 3. 选中的附件
    if (this.selectedSource && this.selectedSource.type === "attachment") {
      console.log("📎 使用选中附件:", this.selectedSource.data.name);
      return {
        type: "attachment",
        content: `附件名称: ${this.selectedSource.data.name}\n类型: ${this.selectedSource.data.type}\n大小: ${this.selectedSource.data.size || "未知"}`,
      };
    }

    // 4. 页面文本
    if (this.pageText && this.pageText.trim()) {
      console.log("📄 使用页面文本，内容长度:", this.pageText.length);
      return { type: "pageText", content: this.pageText };
    }

    const errorMsg = "没有可分析的内容，请上传文件、输入内容或选择附件";
    console.error("❌", errorMsg);
    console.log("🔍 调试信息:");
    console.log("- 本地文件:", this.selectedFile ? "有" : "无");
    console.log("- 手动输入:", manualInput ? `有(${manualInput.length}字符)` : "无");
    console.log("- 选中附件:", this.selectedSource ? "有" : "无");
    console.log("- 页面文本:", this.pageText ? `有(${this.pageText.length}字符)` : "无");
    throw new Error(errorMsg);
  }

  // 解析本地文件
  async parseLocalFile(file) {
    console.log("📁 开始解析本地文件:", file.name);
    
    try {
      // 将文件转换为ArrayBuffer
      console.log("📁 转换文件为ArrayBuffer...");
      const arrayBuffer = await this.fileToArrayBuffer(file);
      console.log("📁 ArrayBuffer长度:", arrayBuffer.byteLength);
      
      // 发送ArrayBuffer到background进行解析
      console.log("📁 发送文件到background解析...");
      const result = await chrome.runtime.sendMessage({
        action: "parseFile",
        data: {
          arrayBuffer: Array.from(new Uint8Array(arrayBuffer)), // 转换为数组传输
          name: file.name,
          type: file.type,
          size: file.size
        },
      });

      console.log("📁 background解析结果:", result);

      if (!result) {
        throw new Error("background未返回解析结果");
      }

      if (!result.success) {
        throw new Error(result.error || "文件解析失败");
      }

      const content = result.content || result.data;
      if (!content) {
        throw new Error("解析结果为空");
      }

      console.log("✅ 文件解析成功，内容长度:", content.length);
      return content;
      
    } catch (error) {
      console.error("❌ 文件解析错误:", error);
      throw new Error(`文件解析失败: ${error.message}`);
    }
  }

  // 将文件转换为ArrayBuffer
  fileToArrayBuffer(file) {
    console.log("📁 开始将文件转换为ArrayBuffer:", file.name);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        console.log("✅ 文件读取成功，ArrayBuffer大小:", reader.result.byteLength);
        resolve(reader.result);
      };
      
      reader.onerror = () => {
        console.error("❌ 文件读取失败:", reader.error);
        reject(reader.error);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  async performAnalysis(content) {
    const customPrompt = document.getElementById("custom-prompt").value.trim();

    // Send to background for analysis
    const result = await chrome.runtime.sendMessage({
      action: "analyzeContent",
      data: {
        content: content.content,
        prompt: customPrompt,
        source: this.selectedSource,
      },
    });

    if (!result.success) {
      throw new Error(result.error || "AI分析失败");
    }

    return result.data;
  }

  async fallbackAnalysis() {
    try {
      const content = await this.getAnalysisContent();
      const basicPrompt = "简单分析这个内容的安全风险点";

      const result = await chrome.runtime.sendMessage({
        action: "analyzeContent",
        data: {
          content: content.content,
          prompt: basicPrompt,
          source: this.selectedSource,
          fallbackMode: true,
        },
      });

      if (result.success) {
        this.showAnalysisResult(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.hideProgress();
      this.showError(
        "简化分析失败",
        "所有分析方法都失败了。请检查配置或网络连接。",
        { retryable: false },
      );
    }
  }

  showProgress() {
    const container = document.getElementById("progress-container");
    container.classList.add("active");
    this.hideError();
  }

  updateProgress(percentage, text, details = "") {
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
    const progressDetails = document.getElementById("progress-details");

    if (progressFill)
      progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    if (progressText && text) progressText.textContent = text;
    if (progressDetails && details) progressDetails.textContent = details;
  }

  hideProgress() {
    const container = document.getElementById("progress-container");
    container.classList.remove("active");
  }

  showError(title, message, options = {}) {
    const container = document.getElementById("error-container");
    const titleEl = document.getElementById("error-title");
    const messageEl = document.getElementById("error-message");
    const actionsEl = document.getElementById("error-actions");

    container.classList.add("active");
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Clear existing actions
    // Clear actions element safely
    while (actionsEl.firstChild) {
      actionsEl.removeChild(actionsEl.firstChild);
    }

    // Add retry button if retryable
    if (options.retryable !== false && this.retryCount < this.maxRetries) {
      const retryBtn = document.createElement("button");
      retryBtn.className = "error-btn primary";
      retryBtn.textContent = "重试";
      retryBtn.onclick = () => this.handleRetry();
      actionsEl.appendChild(retryBtn);
    }

    // Add fallback button if available
    if (options.fallback) {
      const fallbackBtn = document.createElement("button");
      fallbackBtn.className = "error-btn";
      fallbackBtn.textContent = options.fallback.text || "使用备选方案";
      fallbackBtn.onclick = options.fallback.action;
      actionsEl.appendChild(fallbackBtn);
    }

    // Add dismiss button
    const dismissBtn = document.createElement("button");
    dismissBtn.className = "error-btn";
    dismissBtn.textContent = "关闭";
    dismissBtn.onclick = () => this.hideError();
    actionsEl.appendChild(dismissBtn);

    this.hideProgress();
  }

  hideError() {
    const container = document.getElementById("error-container");
    container.classList.remove("active");
  }

  async handleRetry() {
    this.retryCount++;
    this.hideError();

    if (this.currentOperation === "analysis") {
      await this.startAnalysis();
    } else {
      await this.detectPageContent();
    }
  }

  showAnalysisResult(result) {
    // 保存分析结果以供导出
    this.lastAnalysisResult = result;
    
    // 显示导出按钮
    const exportBtn = document.getElementById("export-btn");
    if (exportBtn) {
      exportBtn.style.display = "inline-block";
    }

    const resultHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>安全需求分析结果</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; padding: 15px; border: 1px solid #dee2e6; border-radius: 5px; }
          .analysis { background: #fff; }
          pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛡️ 安全需求分析结果</h1>
          <p>生成时间: ${new Date().toLocaleString()}</p>
        </div>
        <div class="section analysis">
          <h2>📊 分析结果</h2>
          <pre>${JSON.stringify(result, null, 2)}</pre>
        </div>
      </body>
      </html>
    `;

    // 尝试使用chrome.tabs.create
    if (chrome?.tabs?.create) {
      const dataUrl =
        "data:text/html;charset=utf-8," + encodeURIComponent(resultHtml);
      chrome.tabs.create({ url: dataUrl }).catch(() => {
        this.fallbackShowResult(resultHtml);
      });
    } else {
      this.fallbackShowResult(resultHtml);
    }
  }

  fallbackShowResult(html) {
    const newWindow = window.open(
      "",
      "_blank",
      "width=800,height=600,scrollbars=yes",
    );
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    } else {
      // Analysis completed
      alert("分析完成！请查看控制台输出或允许弹窗查看详细结果。");
    }
  }

  // 显示导出选项
  showExportOptions() {
    if (!this.lastAnalysisResult) {
      alert('没有可导出的分析结果');
      return;
    }

    const exportOptions = [
      { value: 'json', text: 'JSON 格式', icon: '📄' },
      { value: 'txt', text: '文本格式', icon: '📝' },
      { value: 'html', text: 'HTML 报告', icon: '🌐' }
    ];

    let optionsHtml = '<div style="text-align: center; margin-bottom: 15px;"><strong>选择导出格式</strong></div>';
    
    exportOptions.forEach(option => {
      optionsHtml += `
        <button onclick="popup.exportResult('${option.value}')" 
                style="display: block; width: 100%; margin: 8px 0; padding: 10px; 
                       border: 1px solid #ddd; border-radius: 5px; background: #f8f9fa; 
                       cursor: pointer; font-size: 14px;">
          ${option.icon} ${option.text}
        </button>
      `;
    });

    this.showCustomDialog('导出分析结果', optionsHtml);
  }

  // 导出结果
  exportResult(format) {
    if (!this.lastAnalysisResult) {
      alert('没有可导出的分析结果');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `security-analysis-${timestamp}`;

    let content, mimeType, extension;

    switch (format) {
      case 'json':
        content = JSON.stringify(this.lastAnalysisResult, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
      
      case 'txt':
        content = this.formatResultAsText(this.lastAnalysisResult);
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      
      case 'html':
        content = this.formatResultAsHTML(this.lastAnalysisResult);
        mimeType = 'text/html';
        extension = 'html';
        break;
      
      default:
        alert('不支持的导出格式');
        return;
    }

    this.downloadFile(content, `${filename}.${extension}`, mimeType);
    
    // 关闭导出选项对话框
    const dialog = document.querySelector('.custom-dialog');
    if (dialog) {
      dialog.remove();
    }
  }

  // 格式化为文本格式
  formatResultAsText(result) {
    let text = '🛡️ 安全需求分析结果\n';
    text += '='.repeat(30) + '\n';
    text += `生成时间: ${new Date().toLocaleString()}\n\n`;

    if (result.analysis) {
      text += '📊 分析内容:\n';
      text += '-'.repeat(20) + '\n';
      text += result.analysis + '\n\n';
    }

    if (result.threats && result.threats.length > 0) {
      text += '⚠️ 识别的威胁:\n';
      text += '-'.repeat(20) + '\n';
      result.threats.forEach((threat, index) => {
        text += `${index + 1}. ${threat.description || threat.type}\n`;
        text += `   威胁等级: ${threat.level}\n`;
        if (threat.impact) text += `   影响范围: ${threat.impact}\n`;
        text += '\n';
      });
    }

    if (result.securityScenarios && result.securityScenarios.length > 0) {
      text += '🔍 安全测试场景:\n';
      text += '-'.repeat(20) + '\n';
      result.securityScenarios.forEach((scenario, index) => {
        text += `${index + 1}. ${scenario.category || scenario.description}\n`;
        if (scenario.description && scenario.category !== scenario.description) {
          text += `   描述: ${scenario.description}\n`;
        }
        if (scenario.steps && scenario.steps.length > 0) {
          text += `   测试步骤:\n`;
          scenario.steps.forEach((step, stepIndex) => {
            text += `     ${stepIndex + 1}) ${step}\n`;
          });
        }
        text += '\n';
      });
    }

    if (result.recommendations && result.recommendations.length > 0) {
      text += '💡 安全建议:\n';
      text += '-'.repeat(20) + '\n';
      result.recommendations.forEach((rec, index) => {
        text += `${index + 1}. ${rec}\n`;
      });
    }

    return text;
  }

  // 格式化为HTML格式
  formatResultAsHTML(result) {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>安全需求分析报告</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            line-height: 1.6; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
            color: #333; 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            margin-bottom: 30px; 
            text-align: center;
          }
          .section { 
            margin-bottom: 30px; 
            padding: 20px; 
            border: 1px solid #e1e5e9; 
            border-radius: 8px; 
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .section h2 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            margin-top: 0;
          }
          .threat-item, .scenario-item {
            background: #f8f9fa;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #3498db;
            border-radius: 4px;
          }
          .threat-level {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .threat-level.high { background: #e74c3c; color: white; }
          .threat-level.medium { background: #f39c12; color: white; }
          .threat-level.low { background: #27ae60; color: white; }
          .steps { margin-top: 10px; }
          .steps ol { margin: 5px 0; padding-left: 20px; }
          .recommendations { background: #e8f5e8; }
          .timestamp { text-align: center; color: #7f8c8d; margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛡️ 安全需求分析报告</h1>
          <p>由安全需求分析助手生成</p>
        </div>

        ${result.analysis ? `
        <div class="section">
          <h2>📊 分析概述</h2>
          <div>${result.analysis.replace(/\n/g, '<br>')}</div>
        </div>
        ` : ''}

        ${result.threats && result.threats.length > 0 ? `
        <div class="section">
          <h2>⚠️ 识别的威胁 (${result.threats.length})</h2>
          ${result.threats.map(threat => `
            <div class="threat-item">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>${threat.description || threat.type}</strong>
                <span class="threat-level ${threat.level}">${threat.level}</span>
              </div>
              ${threat.impact ? `<div><strong>影响范围:</strong> ${threat.impact}</div>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${result.securityScenarios && result.securityScenarios.length > 0 ? `
        <div class="section">
          <h2>🔍 安全测试场景 (${result.securityScenarios.length})</h2>
          ${result.securityScenarios.map((scenario, index) => `
            <div class="scenario-item">
              <h3>${index + 1}. ${scenario.category || scenario.description}</h3>
              ${scenario.description && scenario.category !== scenario.description ? 
                `<div><strong>描述:</strong> ${scenario.description}</div>` : ''}
              ${scenario.steps && scenario.steps.length > 0 ? `
                <div class="steps">
                  <strong>测试步骤:</strong>
                  <ol>
                    ${scenario.steps.map(step => `<li>${step}</li>`).join('')}
                  </ol>
                </div>
              ` : ''}
              ${scenario.expectedResult ? 
                `<div><strong>预期结果:</strong> ${scenario.expectedResult}</div>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${result.recommendations && result.recommendations.length > 0 ? `
        <div class="section recommendations">
          <h2>💡 安全建议</h2>
          <ul>
            ${result.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div class="timestamp">
          报告生成时间: ${new Date().toLocaleString()}
        </div>
      </body>
      </html>
    `;
  }

  // 下载文件
  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    console.log(`文件已下载: ${filename}`);
  }

  // Show custom dialog using secure DOM manipulation
  showCustomDialog(title, content) {
    // Remove existing dialog
    const existingDialog = document.querySelector('.custom-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Create dialog using DOMSanitizer
    const dialog = DOMSanitizer.createModal({
      title: title,
      body: content,
      buttons: [
        {
          text: '×',
          className: 'close-btn',
          onClick: (e) => {
            e.target.closest('.custom-dialog').remove();
          }
        }
      ]
    });
    
    dialog.className = 'custom-dialog';
    
    // Add styles programmatically
    Object.assign(dialog.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.5)',
      zIndex: '10000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });
    
    const modalContent = dialog.querySelector('.modal-content');
    if (modalContent) {
      Object.assign(modalContent.style, {
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        maxWidth: '300px',
        width: '90%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      });
    }
    
    document.body.appendChild(dialog);
  }

  showHelpDialog() {
    const helpHtml = `
      <div style="max-width: 500px;">
        <h3>🛡️ 安全需求分析助手 - 使用帮助</h3>
        <h4>📋 功能说明</h4>
        <ul>
          <li>自动检测页面中的PDF/DOCX附件</li>
          <li>提取页面文本内容进行分析</li>
          <li>使用AI生成安全测试场景</li>
          <li>支持手动输入需求内容</li>
        </ul>
        <h4>🚀 使用步骤</h4>
        <ol>
          <li>在需求文档页面打开插件</li>
          <li>选择检测到的附件或使用页面文本</li>
          <li>可以自定义分析提示词</li>
          <li>点击"开始分析"获取结果</li>
        </ol>
        <h4>⚙️ 常见问题</h4>
        <ul>
          <li><strong>无法检测附件</strong>: 确保页面完全加载</li>
          <li><strong>分析失败</strong>: 检查AI服务配置</li>
          <li><strong>没有内容</strong>: 尝试手动输入或刷新页面</li>
        </ul>
      </div>
    `;

    const helpWindow = window.open(
      "",
      "_blank",
      "width=600,height=500,scrollbars=yes",
    );
    if (helpWindow) {
      helpWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>使用帮助</title></head>
        <body style="font-family: Arial, sans-serif; margin: 20px; line-height: 1.6;">
          ${helpHtml}
        </body>
        </html>
      `);
      helpWindow.document.close();
    }
  }

  // 调试相关方法
  toggleDebugMode() {
    const debugInfo = document.getElementById("debug-info");
    const debugToggle = document.getElementById("debug-toggle");

    if (debugInfo && debugInfo.classList.contains("active")) {
      debugInfo.classList.remove("active");
      if (debugToggle) {
        debugToggle.style.backgroundColor = "#f8f9fa";
        debugToggle.style.color = "#666";
      }
    } else {
      if (debugInfo) debugInfo.classList.add("active");
      if (debugToggle) {
        debugToggle.style.backgroundColor = "#007cba";
        debugToggle.style.color = "white";
      }
      this.updateDebugStatus();
    }
  }

  updateDebugStatus() {
    const statusEl = document.getElementById("debug-status");
    if (statusEl) {
      // Clear existing content safely
      while (statusEl.firstChild) {
        statusEl.removeChild(statusEl.firstChild);
      }
      
      // Create debug info elements safely
      const pageInfo = document.createElement('div');
      pageInfo.textContent = `页面: ${window.location.hostname}`;
      
      const attachmentInfo = document.createElement('div');
      attachmentInfo.textContent = `附件: ${this.attachments.length} 个`;
      
      const textInfo = document.createElement('div');
      textInfo.textContent = `文本: ${this.pageText.length} 字符`;
      
      const timeInfo = document.createElement('div');
      timeInfo.textContent = `时间: ${new Date().toLocaleTimeString()}`;
      
      statusEl.appendChild(pageInfo);
      statusEl.appendChild(attachmentInfo);
      statusEl.appendChild(textInfo);
      statusEl.appendChild(timeInfo);
    }
  }

  async runDebugScan() {
    // Running debug scan
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "debug-scan",
        });
        // Debug scan completed
      }
    } catch (error) {
      console.error("调试扫描失败:", error);
    }
  }

  async testContentScript() {
    // Testing content script
    try {
      if (typeof window.detectPageContent === "function") {
        const result = window.detectPageContent();
        // Content script test completed
      } else {
        throw new Error("detectPageContent 函数不可用");
      }
    } catch (error) {
      console.error("Content Script测试失败:", error);
    }
  }

  // 配置相关方法
  async checkConfiguration() {
    try {
      const { llmConfig } = await SharedConfigManager.loadConfig();
      const validation = SharedConfigManager.validateConfig(llmConfig);
      
      return {
        isConfigured: validation.isValid,
        config: llmConfig,
        missingFields: validation.errors,
      };
    } catch (error) {
      console.error("检查配置失败:", error);
      return { isConfigured: false, config: {}, missingFields: ["配置加载失败"] };
    }
  }

  getMissingConfigFields(config) {
    return SharedConfigManager.getMissingConfigFields(config);
  }

  showConfigAlert() {
    // 显示配置提示
    document.getElementById("loading").style.display = "none";
    const configAlert = document.getElementById("config-alert");
    if (configAlert) {
      configAlert.style.display = "block";
      
      // Update configuration alert message securely
      const alertMessage = configAlert.querySelector('.alert-message');
      if (alertMessage) {
        // Clear existing content
        while (alertMessage.firstChild) {
          alertMessage.removeChild(alertMessage.firstChild);
        }
        
        // Create message elements safely
        const title = document.createElement('h3');
        title.textContent = '⚙️ 需要配置LLM服务';
        
        const description = document.createElement('p');
        description.textContent = '使用安全分析功能前，请先配置LLM服务：';
        
        const list = document.createElement('ul');
        const listItems = [
          '选择LLM提供商（OpenAI、Azure、Anthropic或自定义）',
          '配置API端点和模型',
          '设置API密钥（如需要）'
        ];
        
        listItems.forEach(item => {
          const li = document.createElement('li');
          li.textContent = item;
          list.appendChild(li);
        });
        
        const recommendation = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = '推荐：';
        recommendation.appendChild(strong);
        recommendation.appendChild(document.createTextNode('如果有本地LLM服务，可选择"自定义"并使用localhost地址。'));
        
        alertMessage.appendChild(title);
        alertMessage.appendChild(description);
        alertMessage.appendChild(list);
        alertMessage.appendChild(recommendation);
      }
    }
    this.bindConfigEvents();
  }

  bindConfigEvents() {
    if (this.configEventsbound) return;
    this.configEventsbound = true;

    // 配置按钮事件
    document.getElementById("open-config")?.addEventListener("click", () => {
      this.openConfigPage();
    });

    document.getElementById("config-btn")?.addEventListener("click", () => {
      this.openConfigPage();
    });

    document.getElementById("setup-config")?.addEventListener("click", () => {
      this.openConfigPage();
    });

    document.getElementById("dismiss-alert")?.addEventListener("click", () => {
      document.getElementById("config-alert").style.display = "none";
      document.getElementById("content").style.display = "block";
      this.detectPageContent();
    });
  }

  openConfigPage() {
    // Opening configuration page
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error("打开配置页面失败:", error);
      chrome.tabs.create({
        url: chrome.runtime.getURL("src/config/config.html"),
      });
    }
  }

  showConfigStatus(configStatus) {
    const indicator = document.getElementById("config-status-indicator");
    if (!indicator) return;

    indicator.style.display = "flex";

    if (configStatus.isConfigured) {
      indicator.className = "config-status configured";
      const statusIcon = document.getElementById("status-icon");
      const statusText = document.getElementById("status-text");

      if (statusIcon) statusIcon.textContent = "✅";
      if (statusText) statusText.textContent = "AI服务已配置";
    }
  }

  // 打开批量分析界面
  async openBatchAnalysis() {
    try {
      // 动态导入批量分析UI
      const { BatchAnalysisUI } = await import('../shared/batch-analysis-ui.js');
      const batchUI = new BatchAnalysisUI();
      await batchUI.init();
      batchUI.showBatchAnalysisUI();
    } catch (error) {
      console.error('批量分析功能初始化失败:', error);
      alert('批量分析功能暂时不可用，请稍后再试');
    }
  }
}

// 全局变量供HTML内联事件使用
let popup;

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  popup = new SecurityAnalysisPopup();
});
