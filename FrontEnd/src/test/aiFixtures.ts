import type { AiStatus } from '../shared/aiContracts'

export function aiStatusFor(datasetVersion: string): AiStatus {
  return {
    configured: true, dataReady: true, datasetVersion, message: null,
    defaultSelection: { provider: 'gemini', model: 'gemini-2.5-flash' },
    providers: [
      { id: 'gemini', name: 'Gemini', configured: true, defaultModel: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
      { id: 'openrouter', name: 'OpenRouter', configured: true, defaultModel: 'google/gemini-2.5-flash', models: ['google/gemini-2.5-flash', 'openai/gpt-4.1-mini'] },
      { id: 'openai', name: 'OpenAI', configured: false, defaultModel: 'gpt-4.1-mini', models: ['gpt-4.1-mini'] },
    ],
  }
}
