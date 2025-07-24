// src/shared/constants.js - 共享常量定义
export const CONFIG_KEYS = {
    LLM_CONFIG: 'llmConfig',
    THREAT_MODELING_CONFIG: 'threatModelingConfig',
    ANALYSIS_CONFIG: 'analysisConfig',
    DETECTION_CONFIG: 'detectionConfig',
    HAS_COMPLETED_SETUP: 'hasCompletedSetup'
};

export const LLM_PROVIDERS = {
    OPENAI: 'openai',
    AZURE: 'azure',
    ANTHROPIC: 'anthropic',
    CUSTOM: 'custom'
};

export const PROVIDER_DEFAULTS = {
    [LLM_PROVIDERS.OPENAI]: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4-vision-preview'
    },
    [LLM_PROVIDERS.AZURE]: {
        endpoint: 'https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2023-12-01-preview',
        model: 'gpt-4-vision-preview'
    },
    [LLM_PROVIDERS.ANTHROPIC]: {
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-opus-20240229'
    },
    [LLM_PROVIDERS.CUSTOM]: {
        endpoint: '',
        model: ''
    }
};

export const SUPPORTED_FILE_TYPES = ['pdf', 'docx', 'doc'];

export const DOCUMENT_PARSER_CONSTANTS = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    PARSING_TIMEOUT: 30000, // 30 seconds
    CONTENT_TYPES: {
        PDF: 'application/pdf',
        DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        DOC: 'application/msword'
    }
};

export const STAC_CONSTANTS = {
    KNOWLEDGE_BASE_PATH: 'assets/STAC知识库.json',
    MATCH_THRESHOLD: 0.7, // Minimum confidence score for a match
    MAX_RESULTS: 10 // Maximum number of results to return
};

export const MESSAGE_TYPES = {
    DETECT_CONTENT: 'detectContent',
    ANALYZE_CONTENT: 'analyzeContent',
    PARSE_FILE: 'parseFile',
    UPDATE_CONFIG: 'updateConfig',
    TEST_LLM_CONNECTION: 'testLLMConnection'
};

export const ANALYSIS_RESULT_FIELDS = {
    SUMMARY: 'summary',
    ASSETS: 'assets',
    THREATS: 'threats',
    TEST_SCENARIOS: 'testScenarios',
    RECOMMENDATIONS: 'recommendations'
};

export const THREAT_LEVELS = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};