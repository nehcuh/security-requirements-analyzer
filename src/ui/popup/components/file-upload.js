// File Upload Handler - Manages file upload operations
export class FileUploadHandler {
  constructor() {
    this.selectedFile = null;
    this.fileContent = null;
    this.allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  /**
   * Initialize file upload functionality
   */
  init() {
    this.bindFileEvents();
  }

  /**
   * Bind file upload related events
   */
  bindFileEvents() {
    const uploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');

    if (uploadArea) {
      uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
      uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
      uploadArea.addEventListener('drop', this.handleDrop.bind(this));
    }

    if (fileInput) {
      fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }

    if (browseBtn) {
      browseBtn.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }
  }

  /**
   * Handle drag over event
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
  }

  /**
   * Handle drag leave event
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  }

  /**
   * Handle file drop event
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.handleFileSelect({ target: { files } });
    }
  }

  /**
   * Handle file selection
   */
  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      this.validateFile(file);
      await this.processFile(file);
      this.displaySelectedFile(file);
    } catch (error) {
      this.showError(error.message);
    }
  }

  /**
   * Validate uploaded file
   */
  validateFile(file) {
    if (!this.allowedTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File too large: ${this.formatFileSize(file.size)} (max: ${this.formatFileSize(this.maxFileSize)})`);
    }
  }

  /**
   * Process uploaded file
   */
  async processFile(file) {
    this.selectedFile = file;
    
    // For text files, read content directly
    if (file.type === 'text/plain') {
      this.fileContent = await this.readTextFile(file);
    } else {
      // For PDF/DOCX files, we'll need to parse them later
      this.fileContent = null;
    }
  }

  /**
   * Read text file content
   */
  readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Display selected file information
   */
  displaySelectedFile(file) {
    const fileInfo = document.getElementById('selected-file-info');
    if (!fileInfo) return;

    fileInfo.style.display = 'block';
    
    // Clear existing content
    while (fileInfo.firstChild) {
      fileInfo.removeChild(fileInfo.firstChild);
    }

    // Create file info elements
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = file.name;

    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = this.formatFileSize(file.size);

    const fileType = document.createElement('div');
    fileType.className = 'file-type';
    fileType.textContent = this.getFileTypeDisplay(file.type);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-file-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', this.removeFile.bind(this));

    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    fileInfo.appendChild(fileType);
    fileInfo.appendChild(removeBtn);
  }

  /**
   * Remove selected file
   */
  removeFile() {
    this.selectedFile = null;
    this.fileContent = null;
    
    const fileInfo = document.getElementById('selected-file-info');
    if (fileInfo) {
      fileInfo.style.display = 'none';
    }

    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  /**
   * Get file type display name
   */
  getFileTypeDisplay(type) {
    const typeMap = {
      'application/pdf': 'PDF Document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
      'application/msword': 'Word Document',
      'text/plain': 'Text File'
    };
    return typeMap[type] || 'Unknown';
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.getElementById('file-upload-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      
      // Hide error after 5 seconds
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * Get selected file
   */
  getSelectedFile() {
    return this.selectedFile;
  }

  /**
   * Get file content
   */
  getFileContent() {
    return this.fileContent;
  }

  /**
   * Check if file is selected
   */
  hasFile() {
    return this.selectedFile !== null;
  }
}

export default FileUploadHandler;