// UI Manager - Handles user interface state and interactions  
import { DOMSanitizer } from '../shared/dom-sanitizer.js';

export class UIManager {
  constructor() {
    this.currentView = 'loading';
    this.eventsbound = false;
    this.timeoutDuration = 10; // seconds
  }

  /**
   * Initialize UI manager
   */
  init() {
    this.showLoading();
    this.bindEvents();
  }

  /**
   * Bind UI events
   */
  bindEvents() {
    if (this.eventsbound) return;

    // Navigation events
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', this.showHelp.bind(this));
    }

    const configBtn = document.getElementById('config-btn');
    if (configBtn) {
      configBtn.addEventListener('click', this.openConfiguration.bind(this));
    }

    const debugToggle = document.getElementById('debug-toggle');
    if (debugToggle) {
      debugToggle.addEventListener('click', this.toggleDebugMode.bind(this));
    }

    // Tab switching
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    this.eventsbound = true;
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.setElementDisplay('loading', 'block');
    this.setElementDisplay('content', 'none');
    this.currentView = 'loading';
  }

  /**
   * Show main content
   */
  showContent() {
    this.setElementDisplay('loading', 'none');
    this.setElementDisplay('content', 'block');
    this.currentView = 'content';
  }

  /**
   * Show configuration alert
   */
  showConfigAlert() {
    const configAlert = document.getElementById('config-alert');
    if (configAlert) {
      configAlert.style.display = 'block';
      this.updateConfigAlertMessage();
    }
  }

  /**
   * Hide configuration alert
   */
  hideConfigAlert() {
    this.setElementDisplay('config-alert', 'none');
  }

  /**
   * Update configuration alert message
   */
  updateConfigAlertMessage() {
    const alertMessage = document.querySelector('.alert-message');
    if (!alertMessage) return;

    // Clear existing content
    while (alertMessage.firstChild) {
      alertMessage.removeChild(alertMessage.firstChild);
    }

    // Create message elements safely
    const title = document.createElement('h3');
    title.textContent = '⚙️ LLM Service Configuration Required';

    const description = document.createElement('p');
    description.textContent = 'Please configure LLM service before using security analysis:';

    const list = document.createElement('ul');
    const listItems = [
      'Select LLM provider (OpenAI, Azure, Anthropic, or Custom)',
      'Configure API endpoint and model',
      'Set API key (if required)'
    ];

    listItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });

    const recommendation = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = 'Recommendation: ';
    recommendation.appendChild(strong);
    recommendation.appendChild(document.createTextNode('If you have local LLM service, select "Custom" and use localhost address.'));

    alertMessage.appendChild(title);
    alertMessage.appendChild(description);
    alertMessage.appendChild(list);
    alertMessage.appendChild(recommendation);
  }

  /**
   * Show configuration status
   */
  showConfigStatus(status) {
    const statusDiv = document.getElementById('config-status');
    if (!statusDiv) return;

    statusDiv.style.display = 'block';
    
    // Clear existing status
    while (statusDiv.firstChild) {
      statusDiv.removeChild(statusDiv.firstChild);
    }

    if (status.isConfigured) {
      const successIcon = document.createElement('span');
      successIcon.textContent = '✅';
      
      const statusText = document.createElement('span');
      statusText.textContent = 'LLM service configured';
      
      statusDiv.appendChild(successIcon);
      statusDiv.appendChild(statusText);
      statusDiv.className = 'config-status success';
    } else {
      const warningIcon = document.createElement('span');
      warningIcon.textContent = '⚠️';
      
      const statusText = document.createElement('span');
      statusText.textContent = 'Configuration required';
      
      statusDiv.appendChild(warningIcon);
      statusDiv.appendChild(statusText);
      statusDiv.className = 'config-status warning';
    }
  }

  /**
   * Show error state
   */
  showError(title, message, options = {}) {
    const errorDiv = document.getElementById('error-display');
    if (!errorDiv) return;

    errorDiv.style.display = 'block';

    const titleEl = errorDiv.querySelector('.error-title');
    const messageEl = errorDiv.querySelector('.error-message');
    const actionsEl = errorDiv.querySelector('.error-actions');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    // Clear existing actions
    if (actionsEl) {
      while (actionsEl.firstChild) {
        actionsEl.removeChild(actionsEl.firstChild);
      }

      // Add retry button if retryable
      if (options.retryable !== false) {
        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'Retry';
        retryBtn.className = 'retry-btn';
        retryBtn.addEventListener('click', options.onRetry || (() => {}));
        actionsEl.appendChild(retryBtn);
      }

      // Add configuration button if needed
      if (options.showConfig) {
        const configBtn = document.createElement('button');
        configBtn.textContent = 'Open Configuration';
        configBtn.className = 'config-btn';
        configBtn.addEventListener('click', this.openConfiguration.bind(this));
        actionsEl.appendChild(configBtn);
      }
    }
  }

  /**
   * Hide error state
   */
  hideError() {
    this.setElementDisplay('error-display', 'none');
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
      content.style.display = 'none';
    });

    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.classList.remove('active');
    });

    // Show selected tab content
    const selectedContent = document.getElementById(`${tabName}-tab`);
    if (selectedContent) {
      selectedContent.style.display = 'block';
    }

    // Add active class to selected tab
    const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedTab) {
      selectedTab.classList.add('active');
    }
  }

  /**
   * Show help dialog
   */
  showHelp() {
    const helpContent = this.generateHelpContent();
    this.showCustomDialog('Help & Usage Guide', helpContent);
  }

  /**
   * Generate help content
   */
  generateHelpContent() {
    const helpDiv = document.createElement('div');
    helpDiv.className = 'help-content';

    const sections = [
      {
        title: 'How to Use',
        content: [
          '1. Navigate to a requirements document page',
          '2. Click the extension icon',
          '3. Select an attachment or upload a file',
          '4. Click "Start Analysis" to begin',
          '5. Review the security analysis results'
        ]
      },
      {
        title: 'Supported Formats',
        content: [
          'PDF documents (.pdf)',
          'Word documents (.docx, .doc)',
          'Plain text files (.txt)',
          'Web page content'
        ]
      },
      {
        title: 'Configuration',
        content: [
          'Configure your preferred LLM provider',
          'Set API keys and endpoints',
          'Test connection before analysis',
          'Choose analysis depth and focus'
        ]
      }
    ];

    sections.forEach(section => {
      const sectionTitle = document.createElement('h4');
      sectionTitle.textContent = section.title;
      helpDiv.appendChild(sectionTitle);

      const sectionList = document.createElement('ul');
      section.content.forEach(item => {
        const listItem = document.createElement('li');
        listItem.textContent = item;
        sectionList.appendChild(listItem);
      });
      helpDiv.appendChild(sectionList);
    });

    return helpDiv;
  }

  /**
   * Show custom dialog
   */
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
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      });
    }

    document.body.appendChild(dialog);
  }

  /**
   * Open configuration page
   */
  openConfiguration() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * Toggle debug mode
   */
  toggleDebugMode() {
    const debugInfo = document.getElementById('debug-info');
    const debugToggle = document.getElementById('debug-toggle');

    if (debugInfo && debugInfo.classList.contains('active')) {
      debugInfo.classList.remove('active');
      if (debugToggle) {
        debugToggle.style.backgroundColor = '#f8f9fa';
        debugToggle.style.color = '#666';
      }
    } else {
      if (debugInfo) debugInfo.classList.add('active');
      if (debugToggle) {
        debugToggle.style.backgroundColor = '#007bff';
        debugToggle.style.color = 'white';
      }
      this.updateDebugStatus();
    }
  }

  /**
   * Update debug status information
   */
  updateDebugStatus() {
    const statusEl = document.getElementById('debug-status');
    if (!statusEl) return;

    // Clear existing content safely
    while (statusEl.firstChild) {
      statusEl.removeChild(statusEl.firstChild);
    }

    // Create debug info elements safely
    const pageInfo = document.createElement('div');
    pageInfo.textContent = `Page: ${window.location.hostname}`;

    const attachmentInfo = document.createElement('div');
    attachmentInfo.textContent = `Attachments: 0 found`; // This would be updated with actual data

    const textInfo = document.createElement('div');
    textInfo.textContent = `Text: 0 characters`; // This would be updated with actual data

    const timeInfo = document.createElement('div');
    timeInfo.textContent = `Time: ${new Date().toLocaleTimeString()}`;

    statusEl.appendChild(pageInfo);
    statusEl.appendChild(attachmentInfo);
    statusEl.appendChild(textInfo);
    statusEl.appendChild(timeInfo);
  }

  /**
   * Set element display property safely
   */
  setElementDisplay(elementId, display) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = display;
    }
  }

  /**
   * Show loading spinner
   */
  showSpinner(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.add('loading-spinner');
    }
  }

  /**
   * Hide loading spinner
   */
  hideSpinner(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.classList.remove('loading-spinner');
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      zIndex: '11000',
      maxWidth: '300px',
      fontSize: '14px'
    });

    // Set colors based on type
    const colors = {
      info: { background: '#e3f2fd', color: '#1976d2', border: '1px solid #bbdefb' },
      success: { background: '#e8f5e8', color: '#2e7d32', border: '1px solid #c8e6c9' },
      warning: { background: '#fff3e0', color: '#f57c00', border: '1px solid #ffcc02' },
      error: { background: '#ffebee', color: '#d32f2f', border: '1px solid #ffcdd2' }
    };

    Object.assign(notification.style, colors[type] || colors.info);

    document.body.appendChild(notification);

    // Auto remove after duration
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }

  /**
   * Get current view
   */
  getCurrentView() {
    return this.currentView;
  }

  /**
   * Check if UI is initialized
   */
  isInitialized() {
    return this.eventsbound;
  }
}

export default UIManager;