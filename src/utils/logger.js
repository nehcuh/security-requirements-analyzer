// logger.js - Unified Logging Utility
// 统一的日志工具，支持不同级别和环境的日志输出

/**
 * 统一日志管理器
 */
class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4
    };

    this.currentLevel = this.getLogLevel();
    this.prefix = '[SecurityAnalyzer]';
    this.colors = {
      ERROR: '#ff4444',
      WARN: '#ffaa00',
      INFO: '#0088ff',
      DEBUG: '#00aa00',
      TRACE: '#888888'
    };
  }

  /**
   * 获取当前日志级别
   */
  getLogLevel() {
    try {
      const debugMode = localStorage.getItem('security-analyzer-debug') === 'true';
      const savedLevel = localStorage.getItem('security-analyzer-log-level');

      if (savedLevel && this.levels.hasOwnProperty(savedLevel)) {
        return this.levels[savedLevel];
      }

      return debugMode ? this.levels.DEBUG : this.levels.INFO;
    } catch (error) {
      return this.levels.INFO;
    }
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level) {
    if (typeof level === 'string' && this.levels.hasOwnProperty(level)) {
      this.currentLevel = this.levels[level];
      try {
        localStorage.setItem('security-analyzer-log-level', level);
      } catch (error) {
        // Ignore localStorage errors
      }
    } else if (typeof level === 'number' && level >= 0 && level <= 4) {
      this.currentLevel = level;
    }
  }

  /**
   * 格式化消息
   */
  formatMessage(level, component, message, data) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const componentPrefix = component ? `[${component}]` : '';
    const baseMessage = `${this.prefix}${componentPrefix} ${timestamp} [${level}] ${message}`;

    return { baseMessage, data };
  }

  /**
   * 输出日志
   */
  log(level, component, message, data) {
    if (this.currentLevel < this.levels[level]) {
      return;
    }

    const { baseMessage, data: logData } = this.formatMessage(level, component, message, data);
    const color = this.colors[level];

    try {
      switch (level) {
        case 'ERROR':
          if (logData) {
            console.error(`%c${baseMessage}`, `color: ${color}`, logData);
          } else {
            console.error(`%c${baseMessage}`, `color: ${color}`);
          }
          break;

        case 'WARN':
          if (logData) {
            console.warn(`%c${baseMessage}`, `color: ${color}`, logData);
          } else {
            console.warn(`%c${baseMessage}`, `color: ${color}`);
          }
          break;

        case 'INFO':
          if (logData) {
            console.info(`%c${baseMessage}`, `color: ${color}`, logData);
          } else {
            console.info(`%c${baseMessage}`, `color: ${color}`);
          }
          break;

        case 'DEBUG':
          if (logData) {
            console.debug(`%c${baseMessage}`, `color: ${color}`, logData);
          } else {
            console.debug(`%c${baseMessage}`, `color: ${color}`);
          }
          break;

        case 'TRACE':
          if (logData) {
            console.trace(`%c${baseMessage}`, `color: ${color}`, logData);
          } else {
            console.trace(`%c${baseMessage}`, `color: ${color}`);
          }
          break;
      }
    } catch (error) {
      // Fallback to basic console.log if styled logging fails
      console.log(`${baseMessage}`, logData || '');
    }
  }

  /**
   * 错误日志
   */
  error(component, message, data) {
    this.log('ERROR', component, message, data);
  }

  /**
   * 警告日志
   */
  warn(component, message, data) {
    this.log('WARN', component, message, data);
  }

  /**
   * 信息日志
   */
  info(component, message, data) {
    this.log('INFO', component, message, data);
  }

  /**
   * 调试日志
   */
  debug(component, message, data) {
    this.log('DEBUG', component, message, data);
  }

  /**
   * 跟踪日志
   */
  trace(component, message, data) {
    this.log('TRACE', component, message, data);
  }

  /**
   * 性能计时器
   */
  timer(component, label) {
    const startTime = performance.now();
    const timerLabel = `${component || 'Unknown'}.${label}`;

    this.debug(component, `Timer started: ${label}`);

    return {
      end: () => {
        const duration = performance.now() - startTime;
        this.debug(component, `Timer ended: ${label} - ${duration.toFixed(2)}ms`);
        return duration;
      },

      lap: (lapLabel) => {
        const lapTime = performance.now() - startTime;
        this.debug(component, `Timer lap: ${label}.${lapLabel} - ${lapTime.toFixed(2)}ms`);
        return lapTime;
      }
    };
  }

  /**
   * 分组日志开始
   */
  group(component, label, collapsed = false) {
    const message = `${this.prefix}[${component || 'Unknown'}] ${label}`;

    try {
      if (collapsed) {
        console.groupCollapsed(message);
      } else {
        console.group(message);
      }
    } catch (error) {
      this.info(component, `=== ${label} ===`);
    }
  }

  /**
   * 分组日志结束
   */
  groupEnd() {
    try {
      console.groupEnd();
    } catch (error) {
      // Ignore groupEnd errors
    }
  }

  /**
   * 表格输出
   */
  table(component, label, data) {
    if (this.currentLevel >= this.levels.DEBUG) {
      this.debug(component, label);
      try {
        console.table(data);
      } catch (error) {
        this.debug(component, 'Table data:', data);
      }
    }
  }

  /**
   * 断言日志
   */
  assert(component, condition, message, data) {
    if (!condition) {
      this.error(component, `Assertion failed: ${message}`, data);

      try {
        console.assert(condition, message, data);
      } catch (error) {
        // Ignore assert errors
      }
    }
  }

  /**
   * 获取日志配置
   */
  getConfig() {
    return {
      currentLevel: Object.keys(this.levels).find(key => this.levels[key] === this.currentLevel),
      isDebugMode: this.currentLevel >= this.levels.DEBUG,
      availableLevels: Object.keys(this.levels)
    };
  }

  /**
   * 清空控制台
   */
  clear(component) {
    this.info(component, 'Clearing console...');
    try {
      console.clear();
    } catch (error) {
      // Ignore clear errors
    }
  }
}

// 创建全局日志实例
const logger = new Logger();

// 组件特定的日志器工厂
const createComponentLogger = (componentName) => {
  return {
    error: (message, data) => logger.error(componentName, message, data),
    warn: (message, data) => logger.warn(componentName, message, data),
    info: (message, data) => logger.info(componentName, message, data),
    debug: (message, data) => logger.debug(componentName, message, data),
    trace: (message, data) => logger.trace(componentName, message, data),
    timer: (label) => logger.timer(componentName, label),
    group: (label, collapsed) => logger.group(componentName, label, collapsed),
    groupEnd: () => logger.groupEnd(),
    table: (label, data) => logger.table(componentName, label, data),
    assert: (condition, message, data) => logger.assert(componentName, condition, message, data)
  };
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = { Logger, logger, createComponentLogger };
} else {
  // Browser environment
  window.Logger = Logger;
  window.logger = logger;
  window.createComponentLogger = createComponentLogger;
}

// 向后兼容的全局日志函数
window.securityAnalyzerLog = {
  error: (message, data) => logger.error('Global', message, data),
  warn: (message, data) => logger.warn('Global', message, data),
  info: (message, data) => logger.info('Global', message, data),
  debug: (message, data) => logger.debug('Global', message, data),
  setLevel: (level) => logger.setLogLevel(level),
  getConfig: () => logger.getConfig()
};
