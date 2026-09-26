import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // =========================================================
  // FIREBASE CONFIG
  // =========================================================
  // Firebase config được lưu trong Render Environment Variables
  // dưới dạng JSON ở biến FIREBASE_CONFIG_JSON.
  //
  // Không lưu firebase-applet-config.json thật vào GitHub.
  // =========================================================

  app.get('/firebase-applet-config.json', (req, res) => {
    const firebaseConfigJson = process.env.FIREBASE_CONFIG_JSON;

    if (!firebaseConfigJson) {
      console.error('FIREBASE_CONFIG_JSON chưa được cấu hình.');

      return res.status(500).json({
        error: 'Firebase configuration chưa được cấu hình trên server.'
      });
    }

    try {
      const firebaseConfig = JSON.parse(firebaseConfigJson);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');

      return res.json(firebaseConfig);
    } catch (error) {
      console.error('FIREBASE_CONFIG_JSON không phải JSON hợp lệ.');

      return res.status(500).json({
        error: 'Firebase configuration không hợp lệ.'
      });
    }
  });

  // =========================================================
  // AI ENDPOINT
  // Supporting Gemini, Grok, DeepSeek, and OpenAI
  // =========================================================

  app.post('/api/generate', async (req, res) => {
    try {
      const {
        prompt,
        model,
        provider = 'gemini',
        apiKeys = {}
      } = req.body;

      // -------------------------------------------------------
      // GEMINI
      // -------------------------------------------------------

      if (provider === 'gemini') {
        const apiKey =
          apiKeys.gemini || process.env.GEMINI_API_KEY;

        if (!apiKey) {
          return res.status(400).json({
            error: 'Chưa cấu hình Gemini API Key.'
          });
        }

        const ai = new GoogleGenAI({
          apiKey
        });

        const geminiModel =
          model || 'gemini-3.6-flash';

        const response =
          await ai.models.generateContent({
            model: geminiModel,
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }]
            }
          });

        return res.json({
          text: response.text
        });
      }

      // -------------------------------------------------------
      // OPENAI / DEEPSEEK / GROK
      // -------------------------------------------------------

      else if (
        provider === 'openai' ||
        provider === 'deepseek' ||
        provider === 'grok'
      ) {
        let apiKey = '';
        let apiUrl = '';
        let defaultModel = '';

        // OPENAI
        if (provider === 'openai') {
          apiKey =
            apiKeys.openai ||
            process.env.OPENAI_API_KEY;

          apiUrl =
            'https://api.openai.com/v1/chat/completions';

          defaultModel =
            model || 'gpt-4o-mini';
        }

        // DEEPSEEK
        else if (provider === 'deepseek') {
          apiKey =
            apiKeys.deepseek ||
            process.env.DEEPSEEK_API_KEY;

          apiUrl =
            'https://api.deepseek.com/chat/completions';

          defaultModel =
            model || 'deepseek-chat';
        }

        // GROK
        else if (provider === 'grok') {
          apiKey =
            apiKeys.grok ||
            process.env.GROK_API_KEY;

          apiUrl =
            'https://api.x.ai/v1/chat/completions';

          defaultModel =
            model || 'grok-beta';
        }

        if (!apiKey) {
          return res.status(400).json({
            error: `Chưa cấu hình ${provider.toUpperCase()} API Key.`
          });
        }

        const resp = await fetch(apiUrl, {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },

          body: JSON.stringify({
            model: defaultModel,

            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          })
        });

        const data: any = await resp.json();

        if (!resp.ok) {
          throw new Error(
            data.error?.message ||
            `${provider} API Error`
          );
        }

        const text =
          data.choices?.[0]?.message?.content || '';

        return res.json({
          text
        });
      }

      // -------------------------------------------------------
      // INVALID PROVIDER
      // -------------------------------------------------------

      else {
        return res.status(400).json({
          error: 'Provider không hợp lệ.'
        });
      }

    } catch (error: any) {
      console.error('AI API Error:', error);

      return res.status(500).json({
        error:
          error.message ||
          'Failed to generate AI response'
      });
    }
  });

  // =========================================================
  // VITE
  // =========================================================

  const vite = await createViteServer({
    server: {
      middlewareMode: true
    },

    appType: 'spa'
  });

  app.use(vite.middlewares);

  // =========================================================
  // SERVER
  // =========================================================

  const port =
    Number(process.env.PORT) || 3000;

  app.listen(
    port,
    '0.0.0.0',
    () => {
      console.log(
        `Server running on http://localhost:${port}`
      );
    }
  );
}

startServer();