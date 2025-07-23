// popup.js - 插件弹窗逻辑
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
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab) {
        throw new Error("无法获取当前标签页");
      }

      // 向content script发送消息获取页面内容
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "detectContent",
      });

      if (response) {
        this.attachments = response.attachments || [];
        this.pageText = response.pageText || "";
        this.updateUI();
      } else {
        throw new Error("页面内容检测返回空结果");
      }
    } catch (error) {
      console.error("检测页面内容失败:", error);

      // 尝试运行快速诊断
      await this.runQuickDiagnostic(error);

      let errorMessage = "无法检测页面内容";
      let fallbackOptions = {};

      if (error.message.includes("Could not establish connection")) {
        errorMessage = "无法连接到页面，请刷新页面后重试";
        fallbackOptions = {
          fallback: {
            text: "手动输入内容",
            action: () => this.focusManualInput(),
          },
          diagnostic: {
            text: "运行诊断",
            action: () => this.showDiagnosticResults(),
          },
        };
      } else if (error.message.includes("Extension context invalidated")) {
        errorMessage = "插件需要重新加载，请关闭弹窗后重新打开";
        fallbackOptions = {
          retryable: false,
          diagnostic: {
            text: "查看诊断",
            action: () => this.showDiagnosticResults(),
          },
        };
      } else {
        errorMessage = `页面检测失败: ${error.message}`;
        fallbackOptions = {
          fallback: {
            text: "手动输入内容",
            action: () => this.focusManualInput(),
          },
          diagnostic: {
            text: "运行诊断",
            action: () => this.showDiagnosticResults(),
          },
        };
      }

      this.showError("页面检测失败", errorMessage, fallbackOptions);
    }
  }

  /**
   * 运行快速诊断
   */
  async runQuickDiagnostic(originalError) {
    try {
      // 动态导入快速诊断工具
      const QuickDiagnostic =
        (await import("../debug/quick-diagnostic.js")).default ||
        window.QuickDiagnostic;

      if (!QuickDiagnostic) {
        console.warn("快速诊断工具不可用");
        return;
      }

      const diagnostic = new QuickDiagnostic();
      this.diagnosticResults = await diagnostic.runQuickChecks();

      console.log("快速诊断完成:", this.diagnosticResults);

      // 如果有主要问题，更新错误信息
      const mainIssue = diagnostic.getMainIssue();
      if (mainIssue) {
        this.mainIssue = mainIssue;
      }
    } catch (error) {
      console.warn("快速诊断失败:", error);
      this.diagnosticResults = {
        summary: { total: 0, passed: 0, failed: 1, warnings: 0 },
        checks: {
          "diagnostic-error": {
            status: "error",
            message: "诊断工具运行失败",
            details: { error: error.message },
          },
        },
        recommendations: [
          {
            priority: "high",
            title: "手动检查",
            description: "自动诊断失败，请手动检查插件状态",
          },
        ],
      };
    }
  }

  /**
   * 显示诊断结果
   */
  showDiagnosticResults() {
    if (!this.diagnosticResults) {
      this.showTimeoutNotification("诊断结果不可用，请先运行诊断");
      return;
    }

    // 创建诊断结果窗口
    const diagnosticWindow = window.open(
      "",
      "_blank",
      "width=800,height=600,scrollbars=yes",
    );

    const diagnosticHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>Chrome插件诊断报告</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; line-height: 1.6; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
          .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #ccc; }
          .stat-card.pass { border-left-color: #28a745; background: #f8fff9; }
          .stat-card.fail { border-left-color: #dc3545; background: #fff8f8; }
          .stat-card.warning { border-left-color: #ffc107; background: #fffbf0; }
          .stat-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
          .stat-card.pass .stat-number { color: #28a745; }
          .stat-card.fail .stat-number { color: #dc3545; }
          .stat-card.warning .stat-number { color: #ffc107; }
          .check-item { display: flex; align-items: center; padding: 12px; margin: 8px 0; background: #f8f9fa; border-radius: 6px; }
          .check-status { width: 20px; height: 20px; border-radius: 50%; margin-right: 12px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 12px; }
          .check-status.pass { background: #28a745; }
          .check-status.fail { background: #dc3545; }
          .check-status.warning { background: #ffc107; }
          .check-status.error { background: #6c757d; }
          .recommendation { background: white; border: 1px solid #e9ecef; border-left: 4px solid #17a2b8; padding: 15px; margin: 10px 0; border-radius: 6px; }
          .recommendation.high { border-left-color: #dc3545; }
          .recommendation.medium { border-left-color: #ffc107; }
          .priority-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-bottom: 8px; }
          .priority-badge.high { background: #dc3545; color: white; }
          .priority-badge.medium { background: #ffc107; color: #333; }
          .priority-badge.low { background: #17a2b8; color: white; }
          .main-issue { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛡️ Chrome插件诊断报告</h1>
          <p>安全需求分析助手 - 系统状态检查</p>
        </div>

        ${
          this.mainIssue
            ? `
          <div class="main-issue">
            <h3>🔍 主要问题</h3>
            <h4>${this.mainIssue.title}</h4>
            <p>${this.mainIssue.description}</p>
            <p><strong>解决方案:</strong> ${this.mainIssue.solution}</p>
          </div>
        `
            : ""
        }

        <div class="summary">
          <div class="stat-card pass">
            <div class="stat-number">${this.diagnosticResults.summary.passed}</div>
            <div>通过</div>
          </div>
          <div class="stat-card fail">
            <div class="stat-number">${this.diagnosticResults.summary.failed}</div>
            <div>失败</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-number">${this.diagnosticResults.summary.warnings}</div>
            <div>警告</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${this.diagnosticResults.summary.total}</div>
            <div>总计</div>
          </div>
        </div>

        <h3>检查详情</h3>
        ${Object.entries(this.diagnosticResults.checks)
          .map(
            ([name, check]) => `
          <div class="check-item">
            <div class="check-status ${check.status}">${this.getStatusIcon(check.status)}</div>
            <div>
              <strong>${this.getCheckDisplayName(name)}</strong><br>
              <small>${check.message}</small>
            </div>
          </div>
        `,
          )
          .join("")}

        ${
          this.diagnosticResults.recommendations.length > 0
            ? `
          <h3>修复建议</h3>
          ${this.diagnosticResults.recommendations
            .map(
              (rec) => `
            <div class="recommendation ${rec.priority}">
              <div class="priority-badge ${rec.priority}">${this.getPriorityText(rec.priority)}</div>
              <h4>${rec.title}</h4>
              <p>${rec.description}</p>
            </div>
          `,
            )
            .join("")}
        `
            : ""
        }

        <div style="margin-top: 30px; text-align: center;">
          <button onclick="window.close()" style="background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer;">关闭</button>
        </div>
      </body>
      </html>
    `;

    diagnosticWindow.document.write(diagnosticHtml);
    diagnosticWindow.document.close();
  }

  getStatusIcon(status) {
    const icons = { pass: "✓", fail: "✗", warning: "⚠", error: "⚠" };
    return icons[status] || "?";
  }

  getCheckDisplayName(checkName) {
    const names = {
      "chrome-apis": "Chrome APIs",
      "extension-context": "插件上下文",
      "active-tab": "活动标签页",
      "content-script": "Content Script",
      "background-service": "Background Service",
      "storage-access": "存储访问",
    };
    return names[checkName] || checkName;
  }

  getPriorityText(priority) {
    const texts = { high: "高", medium: "中", low: "低" };
    return texts[priority] || priority;
  }

  focusManualInput() {
    this.hideError();
    const manualInput = document.getElementById("manual-input");
    manualInput.focus();
    manualInput.placeholder = "请在此输入或粘贴需要分析的内容...";
    this.showTimeoutNotification("已切换到手动输入模式");
  }

  updateUI() {
    // 更新附件列表
    if (this.attachments.length > 0) {
      this.showAttachments();
    }

    // 更新页面文本预览
    if (this.pageText.trim()) {
      this.showPageText();
    }
  }

  showAttachments() {
    const section = document.getElementById("attachments-section");
    const list = document.getElementById("attachment-list");
    const summary = document.getElementById("attachment-summary");

    section.style.display = "block";
    list.innerHTML = "";

    // 计算PRD相关附件数量
    const prdAttachments = this.attachments.filter((att) =>
      this.isPRDFile(att),
    );

    // 更新统计信息
    document.getElementById("attachment-count").textContent =
      this.attachments.length;
    document.getElementById("prd-count").textContent = prdAttachments.length;
    summary.style.display = "block";

    // 按相关性排序附件
    const sortedAttachments = this.sortAttachmentsByRelevance(this.attachments);

    sortedAttachments.forEach((attachment, index) => {
      const item = this.createAttachmentItem(attachment, index);
      list.appendChild(item);
    });

    // 如果有多个附件，启动选择超时
    if (this.attachments.length > 2) {
      this.startSelectionTimeout();
    } else {
      // 自动选择最相关的附件
      this.autoSelectBestAttachment();
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

    const typeSpan = document.createElement("span");
    typeSpan.className = "attachment-type";
    typeSpan.textContent = attachment.type;

    const sizeSpan = document.createElement("span");
    sizeSpan.className = "attachment-size";
    sizeSpan.textContent = attachment.size || "未知大小";

    const relevanceSpan = document.createElement("span");
    relevanceSpan.textContent = `相关性: ${this.getRelevanceScore(attachment)}%`;

    metadata.appendChild(typeSpan);
    metadata.appendChild(sizeSpan);
    metadata.appendChild(relevanceSpan);

    const preview = document.createElement("div");
    preview.className = "attachment-preview";
    preview.textContent = this.generateAttachmentPreview(attachment);

    const actions = document.createElement("div");
    actions.className = "attachment-actions";

    const previewBtn = document.createElement("button");
    previewBtn.className = "attachment-btn";
    previewBtn.textContent = "预览";
    previewBtn.onclick = (e) => {
      e.stopPropagation();
      this.previewAttachment(attachment);
    };

    actions.appendChild(previewBtn);

    content.appendChild(name);
    content.appendChild(metadata);
    content.appendChild(preview);
    content.appendChild(actions);

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

    // PRD关键词匹配
    const prdKeywords = ["prd", "需求", "requirement", "产品", "product"];
    prdKeywords.forEach((keyword) => {
      if (name.includes(keyword)) score += 30;
    });

    // 文件类型评分
    if (["pdf", "docx"].includes(attachment.type.toLowerCase())) {
      score += 20;
    } else if (attachment.type.toLowerCase() === "doc") {
      score += 15;
    }

    // 文件名长度和结构评分
    if (name.length > 10 && name.length < 50) score += 10;
    if (name.includes("v") || name.includes("版本")) score += 5;

    return Math.min(score, 100);
  }

  generateAttachmentPreview(attachment) {
    const keywords = this.extractKeywordsFromFilename(attachment.name);
    return `关键词: ${keywords.join(", ")} | 类型: ${attachment.type} | 推荐度: ${this.isPRDFile(attachment) ? "高" : "中"}`;
  }

  extractKeywordsFromFilename(filename) {
    const keywords = [];
    const name = filename.toLowerCase();

    if (name.includes("prd")) keywords.push("PRD");
    if (name.includes("需求")) keywords.push("需求文档");
    if (name.includes("product")) keywords.push("产品");
    if (name.includes("requirement")) keywords.push("需求");
    if (name.includes("设计")) keywords.push("设计");
    if (name.includes("spec")) keywords.push("规格");

    return keywords.length > 0 ? keywords : ["文档"];
  }

  startSelectionTimeout() {
    const timeoutDiv = document.getElementById("selection-timeout");
    const counter = document.getElementById("timeout-counter");
    const progressBar = document.getElementById("timeout-progress-bar");

    timeoutDiv.classList.add("active");

    let remaining = this.timeoutDuration;
    counter.textContent = remaining;

    this.selectionTimeout = setInterval(() => {
      remaining--;
      counter.textContent = remaining;

      const progress =
        ((this.timeoutDuration - remaining) / this.timeoutDuration) * 100;
      progressBar.style.width = `${progress}%`;

      if (remaining <= 0) {
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

    return bestAttachment
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

    const selectedRadio = document.querySelector(
      'input[name="attachment"]:checked',
    );
    if (selectedRadio) {
      const selectedItem = selectedRadio.closest(".attachment-item");
      selectedItem.classList.add("selected");
    }
  }

  previewAttachment(attachment) {
    // 显示附件预览对话框
    const previewWindow = window.open(
      "",
      "_blank",
      "width=600,height=400,scrollbars=yes",
    );

    const previewHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>附件预览 - ${attachment.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .metadata { background: #e9ecef; padding: 10px; border-radius: 4px; margin: 10px 0; }
          .metadata-item { margin: 5px 0; }
          .close-btn { background: #007cba; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>📎 ${attachment.name}</h2>
        </div>

        <div class="metadata">
          <div class="metadata-item"><strong>文件类型:</strong> ${attachment.type}</div>
          <div class="metadata-item"><strong>文件大小:</strong> ${attachment.size || "未知"}</div>
          <div class="metadata-item"><strong>相关性评分:</strong> ${this.getRelevanceScore(attachment)}%</div>
          <div class="metadata-item"><strong>是否PRD相关:</strong> ${this.isPRDFile(attachment) ? "是" : "否"}</div>
          <div class="metadata-item"><strong>提取的关键词:</strong> ${this.extractKeywordsFromFilename(attachment.name).join(", ")}</div>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button class="close-btn" onclick="window.close()">关闭预览</button>
        </div>
      </body>
      </html>
    `;

    previewWindow.document.write(previewHtml);
    previewWindow.document.close();
  }

  showTimeoutNotification(message) {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #d4edda;
      color: #155724;
      padding: 12px 16px;
      border: 1px solid #c3e6cb;
      border-radius: 5px;
      max-width: 300px;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    notification.innerHTML = `
      <strong>自动选择:</strong> ${message}
      <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 16px; cursor: pointer; margin-left: 10px;">&times;</button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 4000);
  }

  // Progress Tracking Methods
  showProgress(text = "处理中...", details = "") {
    const container = document.getElementById("progress-container");
    const progressText = document.getElementById("progress-text");
    const progressDetails = document.getElementById("progress-details");

    container.classList.add("active");
    progressText.textContent = text;
    progressDetails.textContent = details;

    this.hideError();
    this.hideRetry();
  }

  updateProgress(percentage, text, details = "") {
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
    const progressDetails = document.getElementById("progress-details");

    progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    if (text) progressText.textContent = text;
    if (details) progressDetails.textContent = details;
  }

  updateProgressStep(stepId, status) {
    const stepIcon = document.getElementById(`step-${stepId}`);
    if (!stepIcon) return;

    // Remove all status classes
    stepIcon.classList.remove("pending", "active", "completed", "error");
    stepIcon.classList.add(status);

    // Update icon content
    switch (status) {
      case "active":
        stepIcon.textContent = "⟳";
        break;
      case "completed":
        stepIcon.textContent = "✓";
        break;
      case "error":
        stepIcon.textContent = "✗";
        break;
      default:
        // Keep original number for pending
        break;
    }
  }

  hideProgress() {
    const container = document.getElementById("progress-container");
    container.classList.remove("active");

    // Reset progress
    document.getElementById("progress-fill").style.width = "0%";

    // Reset all steps to pending
    ["parse", "stac", "ai", "result"].forEach((stepId, index) => {
      const stepIcon = document.getElementById(`step-${stepId}`);
      if (stepIcon) {
        stepIcon.classList.remove("active", "completed", "error");
        stepIcon.classList.add("pending");
        stepIcon.textContent = (index + 1).toString();
      }
    });
  }

  // Error Handling Methods
  showError(title, message, options = {}) {
    const container = document.getElementById("error-container");
    const titleEl = document.getElementById("error-title");
    const messageEl = document.getElementById("error-message");
    const actionsEl = document.getElementById("error-actions");

    container.classList.add("active");
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Clear existing actions
    actionsEl.innerHTML = "";

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

    // Add diagnostic button if available
    if (options.diagnostic) {
      const diagnosticBtn = document.createElement("button");
      diagnosticBtn.className = "error-btn";
      diagnosticBtn.textContent = options.diagnostic.text || "运行诊断";
      diagnosticBtn.onclick = options.diagnostic.action;
      actionsEl.appendChild(diagnosticBtn);
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

  showRetry(attempt) {
    const container = document.getElementById("retry-container");
    const message = document.getElementById("retry-message");
    const attempts = document.getElementById("retry-attempts");

    container.classList.add("active");
    message.textContent = "正在重试操作...";
    attempts.textContent = `重试次数: ${attempt}/${this.maxRetries}`;

    this.hideError();
  }

  hideRetry() {
    const container = document.getElementById("retry-container");
    container.classList.remove("active");
  }

  async handleRetry() {
    this.retryCount++;
    this.showRetry(this.retryCount);

    try {
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Retry the current operation
      if (this.currentOperation) {
        await this.currentOperation();
      }

      this.hideRetry();
      this.retryCount = 0; // Reset on success
    } catch (error) {
      this.hideRetry();

      if (this.retryCount >= this.maxRetries) {
        this.showError(
          "重试失败",
          `已达到最大重试次数 (${this.maxRetries})。请检查网络连接或稍后再试。`,
          {
            retryable: false,
            fallback: {
              text: "使用页面文本",
              action: () => this.fallbackToPageText(),
            },
          },
        );
      } else {
        this.showError("操作失败", error.message || "未知错误", {
          retryable: true,
          fallback: {
            text: "使用页面文本",
            action: () => this.fallbackToPageText(),
          },
        });
      }
    }
  }

  async fallbackToPageText() {
    this.hideError();
    this.selectedSource = { type: "pageText", content: this.pageText };
    this.showTimeoutNotification("已切换到页面文本分析模式");
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

  bindEvents() {
    // 配置相关按钮
    this.bindConfigEvents();

    // 刷新按钮
    document.getElementById("refresh-btn").addEventListener("click", () => {
      this.init();
    });

    // 分析按钮
    document.getElementById("analyze-btn").addEventListener("click", () => {
      this.startAnalysis();
    });

    // 附件选择变化
    document.addEventListener("change", (e) => {
      if (e.target.name === "attachment") {
        const index = parseInt(e.target.value);
        this.selectAttachment(index, this.attachments[index]);
      }
    });
  }

  async startAnalysis() {
    const analyzeBtn = document.getElementById("analyze-btn");
    const originalText = analyzeBtn.textContent;

    // Set current operation for retry functionality
    this.currentOperation = () => this.performAnalysis();

    try {
      analyzeBtn.textContent = "🔄 分析中...";
      analyzeBtn.disabled = true;
      this.retryCount = 0;

      await this.performAnalysis();
    } catch (error) {
      console.error("分析过程出错:", error);
      this.showError("分析失败", error.message || "分析过程中出现未知错误", {
        retryable: true,
        fallback: {
          text: "使用简化分析",
          action: () => this.fallbackAnalysis(),
        },
      });
    } finally {
      analyzeBtn.textContent = originalText;
      analyzeBtn.disabled = false;
    }
  }

  async performAnalysis() {
    // Step 1: Parse content
    this.showProgress("解析文档内容...", "正在提取和处理文档内容");
    this.updateProgressStep("parse", "active");
    this.updateProgress(10, "解析文档内容...", "正在提取文档内容");

    const content = await this.getAnalysisContent();
    this.updateProgressStep("parse", "completed");
    this.updateProgress(25, "文档解析完成", "内容提取成功");

    // Step 2: STAC matching
    this.updateProgressStep("stac", "active");
    this.updateProgress(40, "STAC知识库匹配...", "正在匹配安全场景");

    // Simulate STAC processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.updateProgressStep("stac", "completed");
    this.updateProgress(60, "STAC匹配完成", "已识别相关安全场景");

    // Step 3: AI analysis
    this.updateProgressStep("ai", "active");
    this.updateProgress(70, "AI分析补充...", "正在生成安全分析");

    const customPrompt = document.getElementById("custom-prompt").value.trim();

    // Send to background for analysis
    const result = await chrome.runtime.sendMessage({
      action: "analyzeContent",
      data: {
        content,
        prompt: customPrompt,
        source: this.selectedSource,
      },
    });

    if (!result.success) {
      this.updateProgressStep("ai", "error");
      throw new Error(result.error || "AI分析失败");
    }

    this.updateProgressStep("ai", "completed");
    this.updateProgress(85, "AI分析完成", "正在整合分析结果");

    // Step 4: Generate results
    this.updateProgressStep("result", "active");
    this.updateProgress(95, "生成分析结果...", "正在格式化输出");

    await new Promise((resolve) => setTimeout(resolve, 500));
    this.updateProgressStep("result", "completed");
    this.updateProgress(100, "分析完成", "结果已生成");

    // Hide progress and show results
    setTimeout(() => {
      this.hideProgress();
      this.showAnalysisResult(result.data);
    }, 1000);
  }

  async fallbackAnalysis() {
    this.hideError();
    this.showProgress("使用简化分析...", "正在进行基础安全分析");

    try {
      const content = await this.getAnalysisContent();
      const basicPrompt =
        "请对以下内容进行基础的安全风险分析，识别主要的安全威胁和建议。";

      const result = await chrome.runtime.sendMessage({
        action: "analyzeContent",
        data: {
          content,
          prompt: basicPrompt,
          source: this.selectedSource,
          fallbackMode: true,
        },
      });

      this.hideProgress();

      if (result.success) {
        this.showAnalysisResult(result.data);
      } else {
        throw new Error(result.error || "简化分析也失败了");
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

  async getAnalysisContent() {
    // 优先级：手动输入 > 选中附件 > 页面文本
    const manualInput = document.getElementById("manual-input").value.trim();

    if (manualInput) {
      return { type: "manual", content: manualInput };
    }

    if (this.selectedSource && this.selectedSource.type === "attachment") {
      // 这里需要解析附件内容
      return {
        type: "attachment",
        content: await this.parseAttachment(this.selectedSource.data),
      };
    }

    if (this.pageText.trim()) {
      return { type: "pageText", content: this.pageText };
    }
  }

  async parseAttachment(attachment) {
    try {
      // 发送到background script进行文件解析
      const result = await chrome.runtime.sendMessage({
        action: "parseFile",
        data: attachment,
      });

      if (result.success) {
        return result.content;
      } else {
        throw new Error(result.error || "文件解析失败");
      }
    } catch (error) {
      // Enhanced error handling for different failure types
      if (error.message.includes("CORS")) {
        throw new Error(
          "文件访问被阻止，可能是跨域限制。请尝试下载文件后重新上传。",
        );
      } else if (error.message.includes("timeout")) {
        throw new Error("文件解析超时，文件可能过大或格式复杂。");
      } else if (error.message.includes("format")) {
        throw new Error("不支持的文件格式或文件已损坏。");
      } else if (error.message.includes("size")) {
        throw new Error("文件过大，超出处理限制。");
      } else {
        throw new Error(`文件解析失败: ${error.message}`);
      }
    }
  }

  showAnalysisResult(result) {
    // 创建结果显示窗口
    const resultWindow = window.open(
      "",
      "_blank",
      "width=800,height=600,scrollbars=yes",
    );

    const resultHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>安全需求分析结果</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; padding: 15px; border: 1px solid #dee2e6; border-radius: 5px; position: relative; }
          .section h3 { margin-top: 0; color: #495057; }

          /* STAC vs AI Section Styling */
          .stac-section { border-left: 4px solid #28a745; background: #f8fff9; }
          .ai-section { border-left: 4px solid #007cba; background: #f8fbff; }

          /* Source Badges */
          .source-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .stac-badge { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .ai-badge { background: #cce5ff; color: #004085; border: 1px solid #99d6ff; }

          /* Coverage Overview */
          .stac-coverage { border-left: 4px solid #6f42c1; background: #faf8ff; }
          .coverage-overview { display: flex; align-items: center; gap: 20px; margin: 15px 0; }
          .coverage-stat { text-align: center; }
          .coverage-percentage {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .coverage-stat.high .coverage-percentage { color: #28a745; }
          .coverage-stat.medium .coverage-percentage { color: #ffc107; }
          .coverage-stat.low .coverage-percentage { color: #dc3545; }
          .coverage-label { font-size: 12px; color: #666; }
          .coverage-details { flex: 1; }
          .coverage-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 5px 0;
          }
          .coverage-number {
            background: #e9ecef;
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: bold;
            min-width: 24px;
            text-align: center;
          }

          /* Expandable Items */
          .expandable { border: 1px solid #e9ecef; border-radius: 5px; margin: 8px 0; }
          .expandable .threat-header,
          .expandable .test-header {
            padding: 12px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
          }
          .expandable .threat-header:hover,
          .expandable .test-header:hover { background: #e9ecef; }
          .expandable .threat-content,
          .expandable .test-content {
            padding: 12px;
            display: none;
            border-top: 1px solid #e9ecef;
          }
          .expandable.expanded .threat-content,
          .expandable.expanded .test-content { display: block; }
          .expandable.expanded .expand-icon { transform: rotate(180deg); }
          .expand-icon { transition: transform 0.2s; }

          /* Source Indicators */
          .source-indicator {
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 8px;
          }
          .source-indicator.stac { background: #28a745; color: white; }
          .source-indicator.ai { background: #007cba; color: white; }

          /* Confidence Badges */
          .confidence-badge {
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 10px;
            margin-left: 8px;
          }
          .confidence-high { background: #d4edda; color: #155724; }
          .confidence-medium { background: #fff3cd; color: #856404; }
          .confidence-low { background: #f8d7da; color: #721c24; }

          /* Matched Scenarios */
          .matched-scenarios { margin-top: 15px; }
          .matched-scenarios h4 { margin-bottom: 10px; color: #28a745; }
          .matched-scenarios ul { margin: 0; padding-left: 20px; }
          .matched-scenarios li { margin: 5px 0; }

          /* AI Context */
          .ai-context {
            background: #e7f3ff;
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 10px;
            font-size: 13px;
          }

          /* Legacy Threat Styles */
          .threat { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 3px; }
          .threat.high { background: #f8d7da; }
          .threat.medium { background: #fff3cd; }
          .threat.low { background: #d1ecf1; }
          .test-scenario { background: #d4edda; padding: 10px; margin: 5px 0; border-radius: 3px; }

          pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
          .export-btn { background: #007cba; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛡️ 安全需求分析结果</h1>
          <p><strong>分析时间:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
          <button class="export-btn" onclick="exportToJson()">导出JSON</button>
          <button class="export-btn" onclick="window.print()">打印报告</button>
        </div>

        ${this.formatAnalysisResult(result)}

        <script>
          function exportToJson() {
            const data = ${JSON.stringify(result, null, 2)};
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'security-analysis-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
          }
        </script>
      </body>
      </html>
    `;

    resultWindow.document.write(resultHtml);
    resultWindow.document.close();
  }

  formatAnalysisResult(result) {
    let html = "";

    try {
      const analysis =
        typeof result.analysis === "string"
          ? JSON.parse(result.analysis)
          : result.analysis;

      // STAC Coverage Overview
      if (analysis.stacAnalysis) {
        html += this.formatSTACCoverage(analysis.stacAnalysis);
      }

      // Combined Summary
      if (analysis.combined && analysis.combined.summary) {
        html += `
          <div class="section">
            <h3>📋 分析概述</h3>
            <p>${analysis.combined.summary}</p>
          </div>
        `;
      }

      // Assets
      if (
        analysis.combined &&
        analysis.combined.assets &&
        analysis.combined.assets.length > 0
      ) {
        html += `
          <div class="section">
            <h3>🎯 关键资产</h3>
            <ul>
              ${analysis.combined.assets.map((asset) => `<li>${asset}</li>`).join("")}
            </ul>
          </div>
        `;
      }

      // STAC-based Threats
      if (
        analysis.stacAnalysis &&
        analysis.stacAnalysis.matchedScenarios &&
        analysis.stacAnalysis.matchedScenarios.length > 0
      ) {
        html += this.formatSTACThreats(analysis.stacAnalysis);
      }

      // AI-generated Threats (for gaps)
      if (
        analysis.aiAnalysis &&
        analysis.aiAnalysis.securityRequirements &&
        analysis.aiAnalysis.securityRequirements.length > 0
      ) {
        html += this.formatAIThreats(analysis.aiAnalysis);
      }

      // STAC Test Cases
      if (
        analysis.stacAnalysis &&
        analysis.stacAnalysis.testCases &&
        analysis.stacAnalysis.testCases.length > 0
      ) {
        html += this.formatSTACTestCases(analysis.stacAnalysis);
      }

      // AI Test Cases
      if (
        analysis.aiAnalysis &&
        analysis.aiAnalysis.testCases &&
        analysis.aiAnalysis.testCases.length > 0
      ) {
        html += this.formatAITestCases(analysis.aiAnalysis);
      }

      // Combined Recommendations
      if (
        analysis.combined &&
        analysis.combined.recommendations &&
        analysis.combined.recommendations.length > 0
      ) {
        html += `
          <div class="section">
            <h3>💡 综合安全建议</h3>
            <ul>
              ${analysis.combined.recommendations.map((rec) => `<li>${rec}</li>`).join("")}
            </ul>
          </div>
        `;
      }

      // Fallback for legacy format
      if (
        !analysis.stacAnalysis &&
        !analysis.aiAnalysis &&
        !analysis.combined
      ) {
        html += this.formatLegacyAnalysis(analysis);
      }
    } catch (error) {
      html += `
        <div class="section">
          <h3>📄 原始分析结果</h3>
          <pre>${result.analysis}</pre>
        </div>
      `;
    }

    return html;
  }

  formatSTACCoverage(stacAnalysis) {
    const coverage = stacAnalysis.coverage || {
      total: 0,
      matched: 0,
      percentage: 0,
    };
    const coverageClass =
      coverage.percentage >= 80
        ? "high"
        : coverage.percentage >= 50
          ? "medium"
          : "low";

    return `
      <div class="section stac-coverage">
        <h3>📊 STAC知识库覆盖度分析</h3>
        <div class="coverage-overview">
          <div class="coverage-stat ${coverageClass}">
            <div class="coverage-percentage">${coverage.percentage}%</div>
            <div class="coverage-label">总体覆盖度</div>
          </div>
          <div class="coverage-details">
            <div class="coverage-item">
              <span class="coverage-number">${coverage.matched}</span>
              <span class="coverage-text">个场景已匹配</span>
            </div>
            <div class="coverage-item">
              <span class="coverage-number">${coverage.total - coverage.matched}</span>
              <span class="coverage-text">个场景需AI补充</span>
            </div>
          </div>
        </div>
        ${
          stacAnalysis.matchedScenarios &&
          stacAnalysis.matchedScenarios.length > 0
            ? `
          <div class="matched-scenarios">
            <h4>✅ 已匹配的STAC场景:</h4>
            <ul>
              ${stacAnalysis.matchedScenarios
                .map(
                  (scenario) => `
                <li>
                  <strong>${scenario.scenario}</strong>
                  <span class="confidence-badge confidence-${this.getConfidenceClass(scenario.confidence)}">
                    置信度: ${Math.round(scenario.confidence * 100)}%
                  </span>
                </li>
              `,
                )
                .join("")}
            </ul>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  formatSTACThreats(stacAnalysis) {
    const threats = [];
    stacAnalysis.matchedScenarios.forEach((scenario) => {
      if (scenario.threats) {
        threats.push(
          ...scenario.threats.map((threat) => ({
            ...threat,
            source: "STAC",
            scenario: scenario.scenario,
          })),
        );
      }
    });

    if (threats.length === 0) return "";

    return `
      <div class="section stac-section">
        <h3>🛡️ STAC知识库 - 识别的威胁</h3>
        <div class="source-badge stac-badge">基于STAC知识库</div>
        ${threats
          .map(
            (threat) => `
          <div class="threat-item stac-threat expandable">
            <div class="threat-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="threat-title">
                <strong>${threat.name || "未命名威胁"}</strong>
                <span class="source-indicator stac">STAC</span>
              </div>
              <div class="expand-icon">▼</div>
            </div>
            <div class="threat-content">
              <p><strong>描述:</strong> ${threat.details}</p>
              <p><strong>来源场景:</strong> ${threat.scenario}</p>
              ${
                threat.security_requirement
                  ? `
                <div class="security-requirement">
                  <strong>安全要求:</strong> ${threat.security_requirement.details || threat.security_requirement.name}
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  formatAIThreats(aiAnalysis) {
    if (
      !aiAnalysis.securityRequirements ||
      aiAnalysis.securityRequirements.length === 0
    )
      return "";

    return `
      <div class="section ai-section">
        <h3>🤖 AI分析 - 补充威胁识别</h3>
        <div class="source-badge ai-badge">AI生成内容 - 置信度: ${this.getConfidenceText(aiAnalysis.confidence)}</div>
        ${
          aiAnalysis.generatedFor && aiAnalysis.generatedFor.length > 0
            ? `
          <div class="ai-context">
            <strong>补充分析领域:</strong> ${aiAnalysis.generatedFor.join(", ")}
          </div>
        `
            : ""
        }
        ${aiAnalysis.securityRequirements
          .map(
            (req) => `
          <div class="threat-item ai-threat expandable">
            <div class="threat-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="threat-title">
                <strong>${req.name}</strong>
                <span class="source-indicator ai">AI</span>
              </div>
              <div class="expand-icon">▼</div>
            </div>
            <div class="threat-content">
              <p>${req.details}</p>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  formatSTACTestCases(stacAnalysis) {
    const testCases = stacAnalysis.testCases || [];
    if (testCases.length === 0) return "";

    return `
      <div class="section stac-section">
        <h3>🧪 STAC知识库 - 测试用例</h3>
        <div class="source-badge stac-badge">基于STAC知识库</div>
        ${testCases
          .map(
            (testCase) => `
          <div class="test-case-item stac-test expandable">
            <div class="test-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="test-title">
                <strong>${testCase.name}</strong>
                <span class="source-indicator stac">STAC</span>
              </div>
              <div class="expand-icon">▼</div>
            </div>
            <div class="test-content">
              <p><strong>测试详情:</strong> ${testCase.details}</p>
              ${testCase.expectedResult ? `<p><strong>预期结果:</strong> ${testCase.expectedResult}</p>` : ""}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  formatAITestCases(aiAnalysis) {
    const testCases = aiAnalysis.testCases || [];
    if (testCases.length === 0) return "";

    return `
      <div class="section ai-section">
        <h3>🤖 AI生成 - 补充测试用例</h3>
        <div class="source-badge ai-badge">AI生成内容 - 置信度: ${this.getConfidenceText(aiAnalysis.confidence)}</div>
        ${testCases
          .map(
            (testCase) => `
          <div class="test-case-item ai-test expandable">
            <div class="test-header" onclick="this.parentElement.classList.toggle('expanded')">
              <div class="test-title">
                <strong>${testCase.name}</strong>
                <span class="source-indicator ai">AI</span>
              </div>
              <div class="expand-icon">▼</div>
            </div>
            <div class="test-content">
              <p><strong>测试详情:</strong> ${testCase.details}</p>
              ${testCase.expectedResult ? `<p><strong>预期结果:</strong> ${testCase.expectedResult}</p>` : ""}
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  formatLegacyAnalysis(analysis) {
    let html = "";

    if (analysis.summary) {
      html += `
        <div class="section">
          <h3>📋 需求概述</h3>
          <p>${analysis.summary}</p>
        </div>
      `;
    }

    if (analysis.assets && analysis.assets.length > 0) {
      html += `
        <div class="section">
          <h3>🎯 关键资产</h3>
          <ul>
            ${analysis.assets.map((asset) => `<li>${asset}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    if (analysis.threats && analysis.threats.length > 0) {
      html += `
        <div class="section">
          <h3>⚠️ 识别的威胁</h3>
          ${analysis.threats
            .map(
              (threat) => `
            <div class="threat ${threat.level || "medium"}">
              <strong>${threat.type || "未分类威胁"}:</strong> ${threat.description}
              <br><small>风险等级: ${threat.level || "中等"}</small>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    }

    if (analysis.testScenarios && analysis.testScenarios.length > 0) {
      html += `
        <div class="section">
          <h3>🧪 安全测试场景</h3>
          ${analysis.testScenarios
            .map(
              (scenario) => `
            <div class="test-scenario">
              <strong>${scenario.category || "安全测试"}:</strong> ${scenario.description}
              ${scenario.steps ? `<br><small>测试步骤: ${scenario.steps.join(", ")}</small>` : ""}
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      html += `
        <div class="section">
          <h3>💡 安全建议</h3>
          <ul>
            ${analysis.recommendations.map((rec) => `<li>${rec}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    return html;
  }

  getConfidenceClass(confidence) {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.6) return "medium";
    return "low";
  }

  getConfidenceText(confidence) {
    switch (confidence) {
      case "high":
        return "高";
      case "medium":
        return "中";
      case "low":
        return "低";
      default:
        return "未知";
    }
  }

  async checkConfiguration() {
    try {
      const result = await chrome.storage.sync.get(["llmConfig"]);
      const llmConfig = result.llmConfig || {};

      const isConfigured = !!(
        llmConfig.endpoint &&
        llmConfig.model &&
        (llmConfig.provider === "custom" || llmConfig.apiKey)
      );

      return {
        isConfigured,
        config: llmConfig,
        missingFields: this.getMissingConfigFields(llmConfig),
      };
    } catch (error) {
      console.error("检查配置失败:", error);
      return { isConfigured: false, config: {}, missingFields: ["all"] };
    }
  }

  getMissingConfigFields(config) {
    const required = ["endpoint", "model"];
    // 只有非自定义提供商才需要API密钥
    if (config.provider !== "custom") {
      required.push("apiKey");
    }
    return required.filter((field) => !config[field]);
  }

  showConfigAlert() {
    document.getElementById("loading").style.display = "none";
    document.getElementById("config-alert").style.display = "block";

    this.bindConfigEvents();
  }

  bindConfigEvents() {
    // 配置按钮事件
    document.getElementById("open-config")?.addEventListener("click", () => {
      this.openConfigPage();
    });

    document.getElementById("setup-config")?.addEventListener("click", () => {
      this.openConfigPage();
    });

    document.getElementById("show-help")?.addEventListener("click", () => {
      this.showHelpDialog();
    });

    document.getElementById("dismiss-alert")?.addEventListener("click", () => {
      this.dismissConfigAlert();
    });
  }

  openConfigPage() {
    chrome.runtime.openOptionsPage();
  }

  showHelpDialog() {
    const helpWindow = window.open(
      "",
      "_blank",
      "width=600,height=500,scrollbars=yes",
    );

    const helpHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>使用帮助</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .step { background: #e9ecef; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .step h4 { margin: 0 0 10px 0; color: #495057; }
          code { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; }
          .provider-example { background: #d4edda; padding: 10px; margin: 5px 0; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🛡️ 安全需求分析助手 - 使用帮助</h1>
        </div>

        <div class="section">
          <h2>🚀 快速开始</h2>

          <div class="step">
            <h4>步骤1: 配置AI服务</h4>
            <p>点击插件图标右上角的 ⚙️ 按钮，或点击"立即配置"按钮打开配置页面。</p>
          </div>

          <div class="step">
            <h4>步骤2: 选择LLM提供商</h4>
            <p>支持以下AI服务提供商：</p>

            <div class="provider-example">
              <strong>OpenAI GPT-4</strong><br>
              端点: <code>https://api.openai.com/v1/chat/completions</code><br>
              模型: <code>gpt-4-vision-preview</code><br>
              密钥: <code>sk-your-openai-api-key</code>
            </div>

            <div class="provider-example">
              <strong>Azure OpenAI</strong><br>
              端点: <code>https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-12-01-preview</code><br>
              模型: <code>gpt-4-vision-preview</code><br>
              密钥: <code>your-azure-api-key</code>
            </div>
          </div>

          <div class="step">
            <h4>步骤3: 测试配置</h4>
            <p>在配置页面点击"🧪 测试配置"按钮，确认API连接正常。</p>
          </div>

          <div class="step">
            <h4>步骤4: 开始分析</h4>
            <p>在产品需求页面点击插件图标，选择需求内容，点击"🚀 开始分析"。</p>
          </div>
        </div>

        <div class="section">
          <h2>💡 使用技巧</h2>
          <ul>
            <li>插件会自动检测页面中的PDF/DOCX附件</li>
            <li>如果没有附件，会提取页面文本内容</li>
            <li>可以手动输入或粘贴需求内容</li>
            <li>支持自定义分析提示词</li>
            <li>分析结果可以导出为JSON格式</li>
          </ul>
        </div>

        <div class="section">
          <h2>🔧 故障排除</h2>
          <ul>
            <li><strong>API调用失败</strong>: 检查API密钥和网络连接</li>
            <li><strong>页面检测失败</strong>: 确保页面完全加载后再使用</li>
            <li><strong>分析结果异常</strong>: 尝试调整提示词或检查模型支持</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <button onclick="window.close()" style="background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">关闭帮助</button>
        </div>
      </body>
      </html>
    `;

    helpWindow.document.write(helpHtml);
    helpWindow.document.close();
  }

  async dismissConfigAlert() {
    // 隐藏配置提醒，继续使用（但功能受限）
    document.getElementById("config-alert").style.display = "none";

    // 显示受限模式提示
    await this.detectPageContent();
    this.bindEvents();
    this.showContent();

    // 添加受限模式提示
    this.showLimitedModeWarning();
  }

  showLimitedModeWarning() {
    const warningDiv = document.createElement("div");
    warningDiv.className = "config-status not-configured";
    warningDiv.innerHTML = `
      ⚠️ 受限模式：未配置AI服务，无法进行智能分析
      <button id="limited-mode-config-btn"
              style="float: right; background: #ffc107; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
        立即配置
      </button>
    `;

    const content = document.getElementById("content");
    content.insertBefore(warningDiv, content.firstChild);

    // 绑定配置按钮事件
    document
      .getElementById("limited-mode-config-btn")
      .addEventListener("click", () => {
        this.openConfigPage();
      });
  }

  showConfigStatus(configStatus) {
    const indicator = document.getElementById("config-status-indicator");
    const statusIcon = document.getElementById("status-icon");
    const statusText = document.getElementById("status-text");
    const statusBtn = document.getElementById("status-config-btn");

    if (!indicator) return;

    indicator.style.display = "flex";

    if (configStatus.isConfigured) {
      indicator.className = "config-status configured";
      statusIcon.textContent = "✅";
      statusText.textContent = `AI服务已配置 (${configStatus.config.provider || "Custom"})`;
    } else {
      indicator.className = "config-status not-configured";
      statusIcon.textContent = "⚠️";
      statusText.textContent = "需要配置AI服务";
    }

    // 绑定配置按钮事件
    statusBtn.addEventListener("click", () => {
      this.openConfigPage();
    });
  }

  showError(message) {
    // 创建更友好的错误显示
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #f8d7da;
      color: #721c24;
      padding: 15px;
      border: 1px solid #f5c6cb;
      border-radius: 5px;
      max-width: 300px;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    errorDiv.innerHTML = `
      <strong>错误:</strong> ${message}
      <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
    `;

    document.body.appendChild(errorDiv);

    // 5秒后自动移除
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }
}

// 全局变量供HTML内联事件使用
let popup;

// 初始化弹窗
document.addEventListener("DOMContentLoaded", () => {
  popup = new SecurityAnalysisPopup();
});

// 导出popup实例供诊断工具使用
if (typeof window !== "undefined") {
  window.securityAnalysisPopup = popup;
}
