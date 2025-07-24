// Analysis Controller - Manages security analysis operations
export class AnalysisController {
  constructor() {
    this.lastAnalysisResult = null;
    this.currentOperation = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * Initialize analysis controller
   */
  init() {
    this.bindAnalysisEvents();
  }

  /**
   * Bind analysis related events
   */
  bindAnalysisEvents() {
    const analyzeBtn = document.getElementById('analyze-button');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', this.startAnalysis.bind(this));
    }
  }

  /**
   * Start security analysis
   */
  async startAnalysis() {
    try {
      this.currentOperation = 'analysis';
      this.showAnalysisInProgress();

      // Get analysis source (attachment or text)
      const source = this.getAnalysisSource();
      if (!source) {
        throw new Error('No analysis source selected');
      }

      // Send analysis request to background script
      const response = await this.sendAnalysisRequest(source);
      
      if (response.success) {
        this.lastAnalysisResult = response.result;
        this.showAnalysisResults(response.result);
        this.retryCount = 0; // Reset retry count on success
      } else {
        throw new Error(response.error || 'Analysis failed');
      }

    } catch (error) {
      console.error('Analysis failed:', error);
      this.showAnalysisError(error.message);
    } finally {
      this.currentOperation = null;
      this.hideAnalysisInProgress();
    }
  }

  /**
   * Get analysis source (attachment or manual input)
   */
  getAnalysisSource() {
    // Check if an attachment is selected
    const selectedAttachment = this.getSelectedAttachment();
    if (selectedAttachment) {
      return {
        type: 'attachment',
        data: selectedAttachment
      };
    }

    // Check if a file is uploaded
    const uploadedFile = this.getUploadedFile();
    if (uploadedFile) {
      return {
        type: 'file',
        data: uploadedFile
      };
    }

    // Check for manual text input
    const manualText = this.getManualText();
    if (manualText && manualText.trim()) {
      return {
        type: 'text',
        data: manualText
      };
    }

    return null;
  }

  /**
   * Get selected attachment from the list
   */
  getSelectedAttachment() {
    const selectedRadio = document.querySelector('input[name="attachment"]:checked');
    if (selectedRadio) {
      const index = parseInt(selectedRadio.value);
      // This would need to access the attachments from the main popup
      // For now, we'll return a placeholder
      return { index, name: 'Selected Attachment' };
    }
    return null;
  }

  /**
   * Get uploaded file information
   */
  getUploadedFile() {
    // This would integrate with FileUploadHandler
    // For now, return placeholder
    return null;
  }

  /**
   * Get manual text input
   */
  getManualText() {
    const textArea = document.getElementById('manual-text-input');
    return textArea ? textArea.value : '';
  }

  /**
   * Send analysis request to background script
   */
  async sendAnalysisRequest(source) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'analyzeSecurityRequirements',
        source: source,
        timestamp: Date.now()
      }, (response) => {
        resolve(response || { success: false, error: 'No response received' });
      });
    });
  }

  /**
   * Show analysis in progress state
   */
  showAnalysisInProgress() {
    const analyzeBtn = document.getElementById('analyze-button');
    const progressDiv = document.getElementById('analysis-progress');

    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Analyzing...';
    }

    if (progressDiv) {
      progressDiv.style.display = 'block';
    }

    // Show progress animation
    this.startProgressAnimation();
  }

  /**
   * Hide analysis in progress state
   */
  hideAnalysisInProgress() {
    const analyzeBtn = document.getElementById('analyze-button');
    const progressDiv = document.getElementById('analysis-progress');

    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Start Analysis';
    }

    if (progressDiv) {
      progressDiv.style.display = 'none';
    }

    this.stopProgressAnimation();
  }

  /**
   * Start progress animation
   */
  startProgressAnimation() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.animation = 'progress 2s linear infinite';
    }
  }

  /**
   * Stop progress animation
   */
  stopProgressAnimation() {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.animation = 'none';
    }
  }

  /**
   * Show analysis results
   */
  showAnalysisResults(result) {
    const resultsDiv = document.getElementById('analysis-results');
    if (!resultsDiv) return;

    resultsDiv.style.display = 'block';
    
    // Clear existing results
    while (resultsDiv.firstChild) {
      resultsDiv.removeChild(resultsDiv.firstChild);
    }

    // Create results sections
    this.createResultsSummary(resultsDiv, result);
    this.createThreatsSection(resultsDiv, result.threats || []);
    this.createTestScenariosSection(resultsDiv, result.testScenarios || []);
    this.createRecommendationsSection(resultsDiv, result.recommendations || []);

    // Show export options
    this.showExportOptions();
  }

  /**
   * Create results summary section
   */
  createResultsSummary(container, result) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'results-summary';

    const title = document.createElement('h3');
    title.textContent = 'Analysis Summary';
    
    const summary = document.createElement('p');
    summary.textContent = result.summary || 'No summary available';

    summaryDiv.appendChild(title);
    summaryDiv.appendChild(summary);
    container.appendChild(summaryDiv);
  }

  /**
   * Create threats section
   */
  createThreatsSection(container, threats) {
    if (threats.length === 0) return;

    const threatsDiv = document.createElement('div');
    threatsDiv.className = 'threats-section';

    const title = document.createElement('h3');
    title.textContent = `Security Threats (${threats.length})`;
    threatsDiv.appendChild(title);

    threats.forEach(threat => {
      const threatItem = document.createElement('div');
      threatItem.className = 'threat-item';

      const threatType = document.createElement('h4');
      threatType.textContent = threat.type || 'Unknown Threat';

      const threatDesc = document.createElement('p');
      threatDesc.textContent = threat.description || 'No description';

      const threatLevel = document.createElement('span');
      threatLevel.className = `threat-level ${threat.level?.toLowerCase() || 'unknown'}`;
      threatLevel.textContent = threat.level || 'Unknown';

      threatItem.appendChild(threatType);
      threatItem.appendChild(threatDesc);
      threatItem.appendChild(threatLevel);
      threatsDiv.appendChild(threatItem);
    });

    container.appendChild(threatsDiv);
  }

  /**
   * Create test scenarios section
   */
  createTestScenariosSection(container, scenarios) {
    if (scenarios.length === 0) return;

    const scenariosDiv = document.createElement('div');
    scenariosDiv.className = 'scenarios-section';

    const title = document.createElement('h3');
    title.textContent = `Test Scenarios (${scenarios.length})`;
    scenariosDiv.appendChild(title);

    scenarios.forEach(scenario => {
      const scenarioItem = document.createElement('div');
      scenarioItem.className = 'scenario-item';

      const scenarioCategory = document.createElement('h4');
      scenarioCategory.textContent = scenario.category || 'General Test';

      const scenarioDesc = document.createElement('p');
      scenarioDesc.textContent = scenario.description || 'No description';

      scenarioItem.appendChild(scenarioCategory);
      scenarioItem.appendChild(scenarioDesc);

      if (scenario.steps && scenario.steps.length > 0) {
        const stepsList = document.createElement('ol');
        scenario.steps.forEach(step => {
          const stepItem = document.createElement('li');
          stepItem.textContent = step;
          stepsList.appendChild(stepItem);
        });
        scenarioItem.appendChild(stepsList);
      }

      scenariosDiv.appendChild(scenarioItem);
    });

    container.appendChild(scenariosDiv);
  }

  /**
   * Create recommendations section
   */
  createRecommendationsSection(container, recommendations) {
    if (recommendations.length === 0) return;

    const recommendationsDiv = document.createElement('div');
    recommendationsDiv.className = 'recommendations-section';

    const title = document.createElement('h3');
    title.textContent = 'Security Recommendations';
    recommendationsDiv.appendChild(title);

    const list = document.createElement('ul');
    recommendations.forEach(recommendation => {
      const listItem = document.createElement('li');
      listItem.textContent = recommendation;
      list.appendChild(listItem);
    });

    recommendationsDiv.appendChild(list);
    container.appendChild(recommendationsDiv);
  }

  /**
   * Show export options
   */
  showExportOptions() {
    const exportDiv = document.getElementById('export-options');
    if (exportDiv) {
      exportDiv.style.display = 'block';
    }
  }

  /**
   * Show analysis error
   */
  showAnalysisError(message) {
    const errorDiv = document.getElementById('analysis-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';

      // Hide error after 10 seconds
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 10000);
    }

    // Show retry option if retries are available
    if (this.retryCount < this.maxRetries) {
      this.showRetryOption();
    }
  }

  /**
   * Show retry option
   */
  showRetryOption() {
    const retryDiv = document.getElementById('retry-option');
    if (retryDiv) {
      retryDiv.style.display = 'block';
      
      const retryBtn = retryDiv.querySelector('.retry-btn');
      if (retryBtn) {
        retryBtn.onclick = () => {
          this.retryCount++;
          this.startAnalysis();
        };
      }
    }
  }

  /**
   * Get last analysis result
   */
  getLastResult() {
    return this.lastAnalysisResult;
  }

  /**
   * Clear analysis results
   */
  clearResults() {
    this.lastAnalysisResult = null;
    const resultsDiv = document.getElementById('analysis-results');
    if (resultsDiv) {
      resultsDiv.style.display = 'none';
    }
  }
}

export default AnalysisController;