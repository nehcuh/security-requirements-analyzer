// debug-helper.js - Chrome插件调试辅助工具
class ExtensionDebugger {
  constructor() {
    this.isDebugMode = true;
    this.logs = [];
    this.init();
  }

  init() {
    if (this.isDebugMode) {
      this.setupConsoleInterception();
      this.setupErrorHandling();
      this.addDebugPanel();
    }
  }

  // 拦截console输出
  setupConsoleInterception() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      this.addLog('log', args);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      this.addLog('error', args);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      this.addLog('warn', args);
      originalWarn.apply(console, args);
    };
  }

  // 设置错误处理
  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      this.addLog('error', [`Uncaught Error: ${event.message}`, event.filename, event.lineno]);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.addLog('error', [`Unhandled Promise Rejection: ${event.reason}`]);
    });
  }

  // 添加调试面板
  addDebugPanel() {
    if (document.body) {
      this.createDebugPanel();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        this.createDebugPanel();
      });
    }
  }

  createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'extension-debug-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      max-height: 400px;
      background: rgba(0,0,0,0.9);
      color: white;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 5px;
      z-index: 10000;
      overflow-y: auto;
      display: none;
    `;

    const header = document.createElement('div');
    header.innerHTML = `
      <strong>🐛 Extension Debug</strong>
      <button onclick="this.parentElement.parentElement.style.display='none'" 
              style="float: right; background: red; color: white; border: none; padding: 2px 6px; border-radius: 3px;">×</button>
      <button onclick="document.getElementById('debug-logs').innerHTML=''" 
              style="float: right; background: #666; color: white; border: none; padding: 2px 6px; border-radius: 3px; margin-right: 5px;">Clear</button>
    `;

    const logs = document.createElement('div');
    logs.id = 'debug-logs';
    logs.style.cssText = 'margin-top: 10px; max-height: 300px; overflow-y: auto;';

    panel.appendChild(header);
    panel.appendChild(logs);
    document.body.appendChild(panel);

    // 添加快捷键显示/隐藏
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  addLog(type, args) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      type,
      timestamp,
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
    };

    this.logs.push(logEntry);

    // 更新调试面板
    const logsContainer = document.getElementById('debug-logs');
    if (logsContainer) {
      const logElement = document.createElement('div');
      logElement.style.cssText = `
        margin: 2px 0;
        padding: 2px;
        border-left: 3px solid ${this.getLogColor(type)};
        padding-left: 8px;
      `;
      logElement.innerHTML = `<small>${timestamp}</small> ${logEntry.message}`;
      logsContainer.appendChild(logElement);
      logsContainer.scrollTop = logsContainer.scrollHeight;

      // 限制日志数量
      if (logsContainer.children.length > 100) {
        logsContainer.removeChild(logsContainer.firstChild);
      }
    }
  }

  getLogColor(type) {
    const colors = {
      log: '#4CAF50',
      warn: '#FF9800',
      error: '#F44336'
    };
    return colors[type] || '#2196F3';
  }

  // 导出日志
  exportLogs() {
    const blob = new Blob([JSON.stringify(this.logs, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 检查扩展状态
  checkExtensionStatus() {
    return {
      isContentScript: typeof chrome !== 'undefined' && chrome.runtime,
      hasStorageAccess: typeof chrome !== 'undefined' && chrome.storage,
      hasTabsAccess: typeof chrome !== 'undefined' && chrome.tabs,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
  }
}

// 自动初始化调试器
if (typeof window !== 'undefined') {
  window.extensionDebugger = new ExtensionDebugger();
  
  // 添加全局调试函数
  window.debugExtension = () => {
    console.log('Extension Status:', window.extensionDebugger.checkExtensionStatus());
    console.log('Recent Logs:', window.extensionDebugger.logs.slice(-10));
  };
  
  console.log('🐛 Extension Debugger loaded. Press Ctrl+Shift+D to toggle debug panel');
}