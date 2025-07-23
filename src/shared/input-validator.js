/**
 * Input Validation Service
 * 
 * Comprehensive input validation and sanitization for all user inputs
 * Requirements 9.2: Add input validation for all user inputs
 */

class InputValidator {
  constructor() {
    // Define validation rules and limits
    this.limits = {
      maxStringLength: 100000, // 100KB text limit
      maxArrayLength: 1000,
      maxObjectDepth: 10,
      maxUrlLength: 2048,
      maxFileNameLength: 255,
      maxFileSize: 50 * 1024 * 1024 // 50MB
    };
    
    // Dangerous patterns to detect/remove
    this.dangerousPatterns = {
      script: /<script[\s\S]*?<\/script>/gi,
      javascript: /javascript:/gi,
      dataUrl: /data:(?!image\/(?:png|jpe?g|gif|webp|svg\+xml))[^;,]+/gi,
      htmlEvents: /on\w+\s*=/gi,
      sqlInjection: /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/gi,
      xss: /(<iframe|<object|<embed|<link|<meta|<style)/gi,
      pathTraversal: /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c/gi,
      nullBytes: /\0/g,
      controlChars: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
    };
    
    // File type whitelist
    this.allowedFileTypes = ['PDF', 'DOCX', 'DOC'];
    
    // URL scheme whitelist
    this.allowedUrlSchemes = ['http:', 'https:', 'chrome-extension:'];
  }
  
  /**
   * Validate and sanitize text input
   * @param {string} input - Text input to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result
   */
  validateText(input, options = {}) {
    const result = {
      isValid: false,
      sanitized: null,
      errors: [],
      warnings: [],
      originalLength: 0,
      sanitizedLength: 0
    };
    
    try {
      // Basic type validation
      if (input === null || input === undefined) {
        if (options.required) {
          result.errors.push('Input is required');
          return result;
        } else {
          result.isValid = true;
          result.sanitized = '';
          return result;
        }
      }
      
      if (typeof input !== 'string') {
        result.errors.push(`Input must be string, received ${typeof input}`);
        return result;
      }
      
      result.originalLength = input.length;
      
      // Length validation
      const maxLength = options.maxLength || this.limits.maxStringLength;
      if (input.length > maxLength) {
        if (options.truncate) {
          input = input.substring(0, maxLength);
          result.warnings.push(`Input truncated to ${maxLength} characters`);
        } else {
          result.errors.push(`Input too long: ${input.length} characters (maximum ${maxLength})`);
          return result;
        }
      }
      
      // Minimum length validation
      if (options.minLength && input.length < options.minLength) {
        result.errors.push(`Input too short: ${input.length} characters (minimum ${options.minLength})`);
        return result;
      }
      
      // Pattern validation
      if (options.pattern && !options.pattern.test(input)) {
        result.errors.push('Input does not match required pattern');
        return result;
      }
      
      // Sanitization
      let sanitized = input;
      
      // Remove null bytes and control characters
      sanitized = sanitized.replace(this.dangerousPatterns.nullBytes, '');
      sanitized = sanitized.replace(this.dangerousPatterns.controlChars, '');
      
      // Handle dangerous patterns based on context
      if (options.allowHtml !== true) {
        // Remove potentially dangerous HTML/script content
        const originalSanitized = sanitized;
        
        sanitized = sanitized.replace(this.dangerousPatterns.script, '[REMOVED_SCRIPT]');
        sanitized = sanitized.replace(this.dangerousPatterns.javascript, '[REMOVED_JS]');
        sanitized = sanitized.replace(this.dangerousPatterns.dataUrl, '[REMOVED_DATA_URL]');
        sanitized = sanitized.replace(this.dangerousPatterns.htmlEvents, '[REMOVED_EVENT]');
        sanitized = sanitized.replace(this.dangerousPatterns.xss, '[REMOVED_XSS]');
        
        if (sanitized !== originalSanitized) {
          result.warnings.push('Potentially dangerous content was removed from input');
        }
      }
      
      // SQL injection detection (warning only, don't remove)
      if (this.dangerousPatterns.sqlInjection.test(sanitized)) {
        result.warnings.push('Input contains potential SQL keywords');
      }
      
      // Path traversal detection
      if (this.dangerousPatterns.pathTraversal.test(sanitized)) {
        sanitized = sanitized.replace(this.dangerousPatterns.pathTraversal, '[REMOVED_PATH]');
        result.warnings.push('Path traversal patterns were removed');
      }
      
      result.sanitized = sanitized;
      result.sanitizedLength = sanitized.length;
      result.isValid = true;
      
      return result;
      
    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      return result;
    }
  }
  
  /**
   * Validate URL input
   * @param {string} url - URL to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result
   */
  validateUrl(url, options = {}) {
    const result = {
      isValid: false,
      sanitized: null,
      errors: [],
      warnings: [],
      parsedUrl: null
    };
    
    try {
      // Basic validation
      const textResult = this.validateText(url, { 
        maxLength: options.maxLength || this.limits.maxUrlLength,
        required: options.required 
      });
      
      if (!textResult.isValid) {
        result.errors = textResult.errors;
        return result;
      }
      
      if (!textResult.sanitized) {
        result.isValid = true;
        result.sanitized = '';
        return result;
      }
      
      // URL parsing validation
      let parsedUrl;
      try {
        parsedUrl = new URL(textResult.sanitized);
      } catch (urlError) {
        result.errors.push(`Invalid URL format: ${urlError.message}`);
        return result;
      }
      
      // Scheme validation
      if (!this.allowedUrlSchemes.includes(parsedUrl.protocol)) {
        result.errors.push(`Unsupported URL scheme: ${parsedUrl.protocol}. Allowed: ${this.allowedUrlSchemes.join(', ')}`);
        return result;
      }
      
      // Hostname validation
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        if (!parsedUrl.hostname) {
          result.errors.push('URL hostname is required for http/https');
          return result;
        }
        
        // Check for suspicious hostnames
        if (this._isSuspiciousHostname(parsedUrl.hostname)) {
          if (options.allowSuspiciousHosts) {
            result.warnings.push(`Potentially suspicious hostname: ${parsedUrl.hostname}`);
          } else {
            result.errors.push(`Suspicious hostname not allowed: ${parsedUrl.hostname}`);
            return result;
          }
        }
      }
      
      result.sanitized = parsedUrl.toString();
      result.parsedUrl = parsedUrl;
      result.isValid = true;
      result.warnings = textResult.warnings;
      
      return result;
      
    } catch (error) {
      result.errors.push(`URL validation error: ${error.message}`);
      return result;
    }
  }
  
  /**
   * Validate file attachment data
   * @param {Object} attachment - Attachment object to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result
   */
  validateAttachment(attachment, options = {}) {
    const result = {
      isValid: false,
      sanitized: null,
      errors: [],
      warnings: []
    };
    
    try {
      // Basic type validation
      if (!attachment || typeof attachment !== 'object') {
        result.errors.push('Attachment must be an object');
        return result;
      }
      
      const sanitized = {};
      
      // Validate URL
      if (attachment.url) {
        const urlResult = this.validateUrl(attachment.url, { 
          required: true,
          allowSuspiciousHosts: options.allowSuspiciousHosts 
        });
        
        if (!urlResult.isValid) {
          result.errors.push(`Invalid attachment URL: ${urlResult.errors.join(', ')}`);
          return result;
        }
        
        sanitized.url = urlResult.sanitized;
        result.warnings.push(...urlResult.warnings);
      } else {
        result.errors.push('Attachment URL is required');
        return result;
      }
      
      // Validate file name
      if (attachment.name) {
        const nameResult = this.validateText(attachment.name, {
          maxLength: this.limits.maxFileNameLength,
          required: false
        });
        
        if (!nameResult.isValid) {
          result.errors.push(`Invalid attachment name: ${nameResult.errors.join(', ')}`);
          return result;
        }
        
        sanitized.name = nameResult.sanitized;
        result.warnings.push(...nameResult.warnings);
        
        // Additional filename security checks
        if (this._hasSuspiciousFileExtension(nameResult.sanitized)) {
          result.warnings.push(`Potentially suspicious file extension in: ${nameResult.sanitized}`);
        }
      }
      
      // Validate file type
      if (attachment.type) {
        const typeResult = this.validateText(attachment.type, { maxLength: 20 });
        
        if (!typeResult.isValid) {
          result.errors.push(`Invalid attachment type: ${typeResult.errors.join(', ')}`);
          return result;
        }
        
        const normalizedType = typeResult.sanitized.toUpperCase();
        
        if (!this.allowedFileTypes.includes(normalizedType)) {
          result.errors.push(`Unsupported file type: ${normalizedType}. Allowed: ${this.allowedFileTypes.join(', ')}`);
          return result;
        }
        
        sanitized.type = normalizedType;
      }
      
      // Validate file size if provided
      if (attachment.size !== undefined) {
        if (typeof attachment.size !== 'number' || attachment.size < 0) {
          result.errors.push('File size must be a non-negative number');
          return result;
        }
        
        if (attachment.size > this.limits.maxFileSize) {
          result.errors.push(`File too large: ${Math.round(attachment.size / 1024 / 1024)}MB (maximum 50MB)`);
          return result;
        }
        
        sanitized.size = attachment.size;
      }
      
      // Copy other safe properties
      const safeProperties = ['isPRD', 'relevanceScore'];
      for (const prop of safeProperties) {
        if (attachment[prop] !== undefined) {
          if (prop === 'isPRD' && typeof attachment[prop] === 'boolean') {
            sanitized[prop] = attachment[prop];
          } else if (prop === 'relevanceScore' && typeof attachment[prop] === 'number') {
            sanitized[prop] = Math.max(0, Math.min(1, attachment[prop])); // Clamp to 0-1
          }
        }
      }
      
      result.sanitized = sanitized;
      result.isValid = true;
      
      return result;
      
    } catch (error) {
      result.errors.push(`Attachment validation error: ${error.message}`);
      return result;
    }
  }
  
  /**
   * Validate object input with depth checking
   * @param {Object} obj - Object to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result
   */
  validateObject(obj, options = {}) {
    const result = {
      isValid: false,
      sanitized: null,
      errors: [],
      warnings: []
    };
    
    try {
      if (obj === null || obj === undefined) {
        if (options.required) {
          result.errors.push('Object is required');
          return result;
        } else {
          result.isValid = true;
          result.sanitized = null;
          return result;
        }
      }
      
      if (typeof obj !== 'object') {
        result.errors.push(`Input must be object, received ${typeof obj}`);
        return result;
      }
      
      // Check depth to prevent deeply nested objects
      const depth = this._calculateObjectDepth(obj);
      const maxDepth = options.maxDepth || this.limits.maxObjectDepth;
      
      if (depth > maxDepth) {
        result.errors.push(`Object too deeply nested: depth ${depth} (maximum ${maxDepth})`);
        return result;
      }
      
      // Sanitize object recursively
      const sanitized = this._sanitizeObjectRecursive(obj, 0, maxDepth);
      
      result.sanitized = sanitized.value;
      result.warnings = sanitized.warnings;
      result.isValid = true;
      
      return result;
      
    } catch (error) {
      result.errors.push(`Object validation error: ${error.message}`);
      return result;
    }
  }
  
  /**
   * Validate array input
   * @param {Array} arr - Array to validate
   * @param {Object} options - Validation options
   * @returns {Object} - Validation result
   */
  validateArray(arr, options = {}) {
    const result = {
      isValid: false,
      sanitized: null,
      errors: [],
      warnings: []
    };
    
    try {
      if (arr === null || arr === undefined) {
        if (options.required) {
          result.errors.push('Array is required');
          return result;
        } else {
          result.isValid = true;
          result.sanitized = [];
          return result;
        }
      }
      
      if (!Array.isArray(arr)) {
        result.errors.push(`Input must be array, received ${typeof arr}`);
        return result;
      }
      
      // Length validation
      const maxLength = options.maxLength || this.limits.maxArrayLength;
      if (arr.length > maxLength) {
        if (options.truncate) {
          arr = arr.slice(0, maxLength);
          result.warnings.push(`Array truncated to ${maxLength} items`);
        } else {
          result.errors.push(`Array too long: ${arr.length} items (maximum ${maxLength})`);
          return result;
        }
      }
      
      // Validate each item if validator provided
      const sanitized = [];
      
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        
        if (options.itemValidator) {
          const itemResult = options.itemValidator(item);
          if (!itemResult.isValid) {
            result.errors.push(`Array item ${i}: ${itemResult.errors.join(', ')}`);
            return result;
          }
          sanitized.push(itemResult.sanitized);
          result.warnings.push(...itemResult.warnings);
        } else {
          // Basic sanitization for non-validated items
          if (typeof item === 'string') {
            const textResult = this.validateText(item, { maxLength: 10000 });
            sanitized.push(textResult.sanitized || '');
          } else {
            sanitized.push(item);
          }
        }
      }
      
      result.sanitized = sanitized;
      result.isValid = true;
      
      return result;
      
    } catch (error) {
      result.errors.push(`Array validation error: ${error.message}`);
      return result;
    }
  }
  
  /**
   * Check if hostname appears suspicious
   * @private
   * @param {string} hostname - Hostname to check
   * @returns {boolean} - True if suspicious
   */
  _isSuspiciousHostname(hostname) {
    const suspiciousPatterns = [
      /^\d+\.\d+\.\d+\.\d+$/, // IP addresses
      /localhost/i,
      /127\.0\.0\.1/,
      /0\.0\.0\.0/,
      /\.tk$|\.ml$|\.ga$|\.cf$/i, // Suspicious TLDs
      /[0-9a-f]{16,}/, // Long hex strings
    ];
    
    const suspiciousDomains = [
      'bit.ly', 'tinyurl.com', 't.co',
      'tempfile.org', 'temp-share.com',
      'pastebin.com', 'paste.ee'
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(hostname)) return true;
    }
    
    for (const domain of suspiciousDomains) {
      if (hostname.includes(domain)) return true;
    }
    
    return false;
  }
  
  /**
   * Check if filename has suspicious extension
   * @private
   * @param {string} filename - Filename to check
   * @returns {boolean} - True if suspicious
   */
  _hasSuspiciousFileExtension(filename) {
    const suspiciousExtensions = [
      '.exe', '.bat', '.cmd', '.scr', '.com', '.pif', 
      '.vbs', '.js', '.jar', '.app', '.deb', '.dmg',
      '.msi', '.pkg', '.run'
    ];
    
    const lowerFilename = filename.toLowerCase();
    
    return suspiciousExtensions.some(ext => lowerFilename.includes(ext));
  }
  
  /**
   * Calculate object depth recursively
   * @private
   * @param {Object} obj - Object to measure
   * @param {number} currentDepth - Current depth level
   * @returns {number} - Maximum depth
   */
  _calculateObjectDepth(obj, currentDepth = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }
    
    let maxDepth = currentDepth;
    
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const depth = this._calculateObjectDepth(value, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    
    return maxDepth;
  }
  
  /**
   * Sanitize object recursively
   * @private
   * @param {Object} obj - Object to sanitize
   * @param {number} currentDepth - Current depth
   * @param {number} maxDepth - Maximum allowed depth
   * @returns {Object} - Sanitization result
   */
  _sanitizeObjectRecursive(obj, currentDepth, maxDepth) {
    const result = {
      value: null,
      warnings: []
    };
    
    if (currentDepth >= maxDepth) {
      result.warnings.push('Object depth limit reached, truncating');
      result.value = {};
      return result;
    }
    
    if (Array.isArray(obj)) {
      const sanitizedArray = [];
      
      for (let i = 0; i < Math.min(obj.length, this.limits.maxArrayLength); i++) {
        const itemResult = this._sanitizeObjectRecursive(obj[i], currentDepth + 1, maxDepth);
        sanitizedArray.push(itemResult.value);
        result.warnings.push(...itemResult.warnings);
      }
      
      if (obj.length > this.limits.maxArrayLength) {
        result.warnings.push(`Array truncated to ${this.limits.maxArrayLength} items`);
      }
      
      result.value = sanitizedArray;
    } else if (typeof obj === 'object' && obj !== null) {
      const sanitizedObj = {};
      let propertyCount = 0;
      
      for (const [key, value] of Object.entries(obj)) {
        if (propertyCount >= 1000) { // Limit object properties
          result.warnings.push('Object property limit reached, truncating');
          break;
        }
        
        // Sanitize key
        const keyResult = this.validateText(key, { maxLength: 100 });
        const sanitizedKey = keyResult.sanitized || key;
        
        // Sanitize value
        const valueResult = this._sanitizeObjectRecursive(value, currentDepth + 1, maxDepth);
        sanitizedObj[sanitizedKey] = valueResult.value;
        result.warnings.push(...valueResult.warnings);
        
        propertyCount++;
      }
      
      result.value = sanitizedObj;
    } else if (typeof obj === 'string') {
      const textResult = this.validateText(obj, { maxLength: 10000 });
      result.value = textResult.sanitized || '';
      result.warnings.push(...textResult.warnings);
    } else {
      result.value = obj;
    }
    
    return result;
  }
  
  /**
   * Create specialized validator for specific use cases
   * @param {Object} config - Validator configuration
   * @returns {Function} - Specialized validator function
   */
  createSpecializedValidator(config) {
    return (input) => {
      switch (config.type) {
        case 'text':
          return this.validateText(input, config.options);
        case 'url':
          return this.validateUrl(input, config.options);
        case 'attachment':
          return this.validateAttachment(input, config.options);
        case 'object':
          return this.validateObject(input, config.options);
        case 'array':
          return this.validateArray(input, config.options);
        default:
          return {
            isValid: false,
            errors: [`Unknown validator type: ${config.type}`],
            warnings: []
          };
      }
    };
  }
}

// Export for use in other modules
export default InputValidator;