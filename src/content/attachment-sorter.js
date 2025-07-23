// src/content/attachment-sorter.js
/**
 * Utility class for sorting and prioritizing attachments
 * Provides methods to sort attachments based on various criteria
 */
class AttachmentSorter {
  /**
   * Sort attachments by relevance score (highest first)
   * @param {Array} attachments - Array of attachment objects
   * @returns {Array} Sorted attachments
   */
  static sortByRelevance(attachments) {
    return [...attachments].sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
  
  /**
   * Sort attachments by PRD status (PRD first) then by relevance
   * @param {Array} attachments - Array of attachment objects
   * @returns {Array} Sorted attachments
   */
  static sortByPRDStatus(attachments) {
    return [...attachments].sort((a, b) => {
      // First sort by PRD status
      if (a.isPRD && !b.isPRD) return -1;
      if (!a.isPRD && b.isPRD) return 1;
      
      // Then by relevance score
      return b.relevanceScore - a.relevanceScore;
    });
  }
  
  /**
   * Sort attachments by file type preference (PDF > DOCX > DOC > others)
   * @param {Array} attachments - Array of attachment objects
   * @returns {Array} Sorted attachments
   */
  static sortByFileType(attachments) {
    const typeOrder = {
      'PDF': 1,
      'DOCX': 2,
      'DOC': 3
    };
    
    return [...attachments].sort((a, b) => {
      const aOrder = typeOrder[a.type] || 999;
      const bOrder = typeOrder[b.type] || 999;
      return aOrder - bOrder;
    });
  }
  
  /**
   * Sort attachments by date (newest first)
   * @param {Array} attachments - Array of attachment objects
   * @returns {Array} Sorted attachments
   */
  static sortByDate(attachments) {
    return [...attachments].sort((a, b) => {
      // Use createdAt date if available
      const aDate = a.createdAt || 
                   (a.metadata && a.metadata.lastModifiedDate) || 
                   new Date(0);
      const bDate = b.createdAt || 
                   (b.metadata && b.metadata.lastModifiedDate) || 
                   new Date(0);
      
      // Sort newest first
      return bDate - aDate;
    });
  }
  
  /**
   * Sort attachments by name
   * @param {Array} attachments - Array of attachment objects
   * @returns {Array} Sorted attachments
   */
  static sortByName(attachments) {
    return [...attachments].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  }
  
  /**
   * Get recommended attachments based on various criteria
   * @param {Array} attachments - Array of attachment objects
   * @param {number} limit - Maximum number of recommendations
   * @returns {Array} Recommended attachments
   */
  static getRecommendedAttachments(attachments, limit = 3) {
    // First prioritize by PRD status and relevance
    const sorted = this.sortByPRDStatus(attachments);
    
    // Return top N recommendations
    return sorted.slice(0, limit);
  }
  
  /**
   * Filter attachments by PRD status
   * @param {Array} attachments - Array of attachment objects
   * @param {boolean} isPRD - Whether to return PRD or non-PRD attachments
   * @returns {Array} Filtered attachments
   */
  static filterByPRDStatus(attachments, isPRD = true) {
    return attachments.filter(attachment => attachment.isPRD === isPRD);
  }
  
  /**
   * Filter attachments by file type
   * @param {Array} attachments - Array of attachment objects
   * @param {string} type - File type to filter by
   * @returns {Array} Filtered attachments
   */
  static filterByType(attachments, type) {
    return attachments.filter(attachment => attachment.type === type);
  }
}

export default AttachmentSorter;