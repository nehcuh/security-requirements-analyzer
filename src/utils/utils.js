// src/shared/utils.js - 共享工具函数
import { SUPPORTED_FILE_TYPES, THREAT_LEVELS } from './constants.js';

/**
 * 获取文件类型
 * @param {string} url - 文件URL
 * @param {string} name - 文件名
 * @returns {string} 文件类型
 */
export function getFileType(url, name) {
    const extension = (url.split('.').pop() || name.split('.').pop() || '').toLowerCase();
    const typeMap = {
        'pdf': 'PDF',
        'doc': 'DOC',
        'docx': 'DOCX'
    };
    return typeMap[extension] || extension.toUpperCase();
}

/**
 * 检查是否为支持的文件类型
 * @param {string} type - 文件类型
 * @returns {boolean} 是否支持
 */
export function isSupportedFileType(type) {
    return SUPPORTED_FILE_TYPES.includes(type.toLowerCase());
}

/**
 * 从URL中提取文件名
 * @param {string} url - 文件URL
 * @returns {string} 文件名
 */
export function getFileNameFromUrl(url) {
    try {
        return decodeURIComponent(url.split('/').pop().split('?')[0]);
    } catch {
        return 'unknown_file';
    }
}

/**
 * 评估威胁等级
 * @param {string} text - 威胁描述文本
 * @returns {string} 威胁等级
 */
export function assessThreatLevel(text) {
    const highKeywords = ['严重', '高危', 'critical', 'high'];
    const mediumKeywords = ['中等', 'medium'];

    const lowerText = text.toLowerCase();

    if (highKeywords.some(keyword => lowerText.includes(keyword))) {
        return THREAT_LEVELS.HIGH;
    } else if (mediumKeywords.some(keyword => lowerText.includes(keyword))) {
        return THREAT_LEVELS.MEDIUM;
    }

    return THREAT_LEVELS.LOW;
}

/**
 * 格式化时间戳
 * @param {number|string} timestamp - 时间戳
 * @returns {string} 格式化的时间字符串
 */
export function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

/**
 * 截断文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
export function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 深度克隆对象
 * @param {any} obj - 要克隆的对象
 * @returns {any} 克隆后的对象
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * 验证URL格式
 * @param {string} url - URL字符串
 * @returns {boolean} 是否为有效URL
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}