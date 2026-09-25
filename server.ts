import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // AI endpoint supporting Gemini, Grok, DeepSeek, and OpenAI
  app.post('/api/generate', async (req, res) => {
    try {
      const { prompt, model, provider = 'gemini', apiKeys = {} } = req.body;

      if (provider === 'gemini') {
        const apiKey = apiKeys.gemini || process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(400).json({ error: 'Chưa cấu hình Gemini API Key.' });
        }
        const ai = new GoogleGenAI({ apiKey });
        const geminiModel = model || 'gemini-3.6-flash';
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
        return res.json({ text: response.text });
      } else if (provider === 'openai' || provider === 'deepseek' || provider === 'grok') {
        let apiKey = '';
        let apiUrl = '';
        let defaultModel = '';

        if (provider === 'openai') {
          apiKey = apiKeys.openai || process.env.OPENAI_API_KEY;
          apiUrl = 'https://api.openai.com/v1/chat/completions';
          defaultModel = model || 'gpt-4o-mini';
        } else if (provider === 'deepseek') {
          apiKey = apiKeys.deepseek || process.env.DEEPSEEK_API_KEY;
          apiUrl = 'https://api.deepseek.com/chat/completions';
          defaultModel = model || 'deepseek-chat';
        } else if (provider === 'grok') {
          apiKey = apiKeys.grok || process.env.GROK_API_KEY;
          apiUrl = 'https://api.x.ai/v1/chat/completions';
          defaultModel = model || 'grok-beta';
        }

        if (!apiKey) {
          return res.status(400).json({ error: `Chưa cấu hình ${provider.toUpperCase()} API Key.` });
        }

        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: defaultModel,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const data: any = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error?.message || `${provider} API Error`);
        }

        const text = data.choices?.[0]?.message?.content || '';
        return res.json({ text });
      } else {
        return res.status(400).json({ error: 'Provider không hợp lệ.' });
      }
    } catch (error: any) {
      console.error('AI API Error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate AI response' });
    }
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
