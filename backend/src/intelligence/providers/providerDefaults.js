export const openAiCompatibleDefaults = {
  OPENAI: 'https://api.openai.com/v1',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/openai',
  OLLAMA: 'http://127.0.0.1:11434/v1',
};

export function getDefaultIntelligenceBaseUrl(provider) {
  return openAiCompatibleDefaults[String(provider || '').toUpperCase()] || null;
}
