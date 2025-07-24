// validator.js - Input Validation Utility
// 统一的输入验证工具，确保数据安全性和有效性

/**
 * 输入验证器
 */
class InputValidator {
  constructor() {
    this.patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
      apiKey: /^[a-zA-Z0-9_\-]{8,}$/,
      filename: /^[^<>:"/\\|?*\x00-\x1f]+$/,
      jsonString: /^[\],:{}\s]*$/
    };

    this.limits = {
      maxTextLength: 100000,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxApiKeyLength: 512,
      maxUrlLength: 2048,
      maxFilenameLength: 255
    };
  }

  /**
   * 验证字符串是否为空或仅包含空白字符
   */
  isEmpty(value) {
    return !value || typeof value !== 'string' || value.trim().length === 0;
  }

  /**
   * 验证字符串长度
   */
  validateLength(value, minLength = 0, maxLength = Infinity) {
    if (typeof value !== 'string') {
      return { valid: false, error: '输入必须是字符串' };
    }

    const length = value.length;

    if (length < minLength) {
      return { valid: false, error: `长度不能少于 ${minLength} 个字符` };
    }

    if (length > maxLength) {
      return { valid: false, error: `长度不能超过 ${maxLength} 个字符` };
    }

    return { valid: true };
  }

  /**
   * 验证邮箱地址
   */
  validateEmail(email) {
    if (this.isEmpty(email)) {
      return { valid: false, error: '邮箱地址不能为空' };
    }

    if (!this.patterns.email.test(email)) {
      return { valid: false, error: '邮箱地址格式无效' };
    }

    return { valid: true };
  }

  /**
   * 验证URL
   */
  validateUrl(url) {
    if (this.isEmpty(url)) {
      return { valid: false, error: 'URL不能为空' };
    }

    if (url.length > this.limits.maxUrlLength) {
      return { valid: false, error: `URL长度不能超过 ${this.limits.maxUrlLength} 个字符` };
    }

    if (!this.patterns.url.test(url)) {
      return { valid: false, error: 'URL格式无效' };
    }

    return { valid: true };
  }

  /**
   * 验证API密钥
   */
  validateApiKey(apiKey) {
    if (this.isEmpty(apiKey)) {
      return { valid: false, error: 'API密钥不能为空' };
    }

    if (apiKey.length > this.limits.maxApiKeyLength) {
      return { valid: false, error: `API密钥长度不能超过 ${this.limits.maxApiKeyLength} 个字符` };
    }

    if (!this.patterns.apiKey.test(apiKey)) {
      return { valid: false, error: 'API密钥格式无效，只能包含字母、数字、下划线和连字符' };
    }

    return { valid: true };
  }

  /**
   * 验证文件名
   */
  validateFilename(filename) {
    if (this.isEmpty(filename)) {
      return { valid: false, error: '文件名不能为空' };
    }

    if (filename.length > this.limits.maxFilenameLength) {
      return { valid: false, error: `文件名长度不能超过 ${this.limits.maxFilenameLength} 个字符` };
    }

    if (!this.patterns.filename.test(filename)) {
      return { valid: false, error: '文件名包含无效字符' };
    }

    return { valid: true };
  }

  /**
   * 验证文件大小
   */
  validateFileSize(size) {
    if (typeof size !== 'number' || size < 0) {
      return { valid: false, error: '文件大小无效' };
    }

    if (size > this.limits.maxFileSize) {
      const maxSizeMB = Math.round(this.limits.maxFileSize / (1024 * 1024));
      return { valid: false, error: `文件大小不能超过 ${maxSizeMB}MB` };
    }

    return { valid: true };
  }

  /**
   * 验证JSON字符串
   */
  validateJson(jsonString) {
    if (this.isEmpty(jsonString)) {
      return { valid: false, error: 'JSON字符串不能为空' };
    }

    try {
      JSON.parse(jsonString);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'JSON格式无效: ' + error.message };
    }
  }

  /**
   * 验证LLM配置
   */
  validateLLMConfig(config) {
    const errors = [];

    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'LLM配置必须是对象' };
    }

    // 验证提供商
    if (this.isEmpty(config.provider)) {
      errors.push('提供商不能为空');
    }

    // 验证端点URL
    if (config.endpoint) {
      const urlValidation = this.validateUrl(config.endpoint);
      if (!urlValidation.valid) {
        errors.push('端点URL无效: ' + urlValidation.error);
      }
    }

    // 验证API密钥（如果提供）
    if (config.apiKey && !this.isEmpty(config.apiKey)) {
      const keyValidation = this.validateApiKey(config.apiKey);
      if (!keyValidation.valid) {
        errors.push('API密钥无效: ' + keyValidation.error);
      }
    }

    // 验证模型名称
    if (config.model && this.isEmpty(config.model)) {
      errors.push('模型名称不能为空');
    }

    return errors.length > 0
      ? { valid: false, error: errors.join('; ') }
      : { valid: true };
  }

  /**
   * 验证威胁建模平台配置
   */
  validateThreatModelingConfig(config) {
    const errors = [];

    if (!config || typeof config !== 'object') {
      return { valid: false, error: '威胁建模平台配置必须是对象' };
    }

    // 验证基础URL
    if (config.baseUrl) {
      const urlValidation = this.validateUrl(config.baseUrl);
      if (!urlValidation.valid) {
        errors.push('基础URL无效: ' + urlValidation.error);
      }
    }

    // 验证API密钥
    if (config.apiKey && !this.isEmpty(config.apiKey)) {
      const keyValidation = this.validateApiKey(config.apiKey);
      if (!keyValidation.valid) {
        errors.push('API密钥无效: ' + keyValidation.error);
      }
    }

    return errors.length > 0
      ? { valid: false, error: errors.join('; ') }
      : { valid: true };
  }

  /**
   * 清理和净化输入文本
   */
  sanitizeText(text) {
    if (typeof text !== 'string') {
      return '';
    }

    // 移除危险的HTML标签和脚本
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  /**
   * 清理文件名
   */
  sanitizeFilename(filename) {
    if (typeof filename !== 'string') {
      return 'unknown';
    }

    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, this.limits.maxFilenameLength)
      .trim();
  }

  /**
   * 验证文件类型
   */
  validateFileType(filename, allowedTypes = []) {
    if (this.isEmpty(filename)) {
      return { valid: false, error: '文件名不能为空' };
    }

    if (allowedTypes.length === 0) {
      return { valid: true }; // 如果没有限制，允许所有类型
    }

    const extension = filename.toLowerCase().split('.').pop();

    if (!allowedTypes.includes(extension)) {
      return {
        valid: false,
        error: `不支持的文件类型 .${extension}，支持的类型: ${allowedTypes.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * 批量验证
   */
  validateBatch(validations) {
    const results = {};
    let hasErrors = false;

    for (const [key, validation] of Object.entries(validations)) {
      if (typeof validation === 'function') {
        try {
          results[key] = validation();
          if (!results[key].valid) {
            hasErrors = true;
          }
        } catch (error) {
          results[key] = { valid: false, error: error.message };
          hasErrors = true;
        }
      }
    }

    return {
      valid: !hasErrors,
      results,
      errors: Object.entries(results)
        .filter(([_, result]) => !result.valid)
        .map(([key, result]) => `${key}: ${result.error}`)
    };
  }

  /**
   * 获取验证器配置
   */
  getConfig() {
    return {
      patterns: { ...this.patterns },
      limits: { ...this.limits }
    };
  }
}

// 创建全局验证器实例
const validator = new InputValidator();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = { InputValidator, validator };
} else {
  // Browser environment
  window.InputValidator = InputValidator;
  window.validator = validator;
}

// 向后兼容的全局验证函数
window.securityAnalyzerValidator = {
  isEmpty: (value) => validator.isEmpty(value),
  validateEmail: (email) => validator.validateEmail(email),
  validateUrl: (url) => validator.validateUrl(url),
  validateApiKey: (key) => validator.validateApiKey(key),
  validateFilename: (filename) => validator.validateFilename(filename),
  validateJson: (json) => validator.validateJson(json),
  sanitizeText: (text) => validator.sanitizeText(text),
  sanitizeFilename: (filename) => validator.sanitizeFilename(filename)
};
