const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const REQUEST_TIMEOUT = 60000;

const logger = require('./logger');

const mapHttpError = (status, body = null) => {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  const upstreamMessage = parsed?.error?.message;

  switch (status) {
    case 401:
      return 'Invalid API Key';
    case 404:
      return 'Model Not Found';
    case 429:
      return 'Rate limit exceeded';
    case 500:
    case 502:
    case 503:
      return 'OpenRouter Offline';
    default:
      return upstreamMessage || `OpenRouter error ${status}`;
  }
};

const timedFetch = async (url, options = {}, signal) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Timeout');
    }
    throw error;
  }
};

const chat = async (apiKey, model, prompt, images = []) => {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Empty API Key');
  }

  if (!model || !model.trim()) {
    throw new Error('Model is required');
  }

  const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  if (!trimmedPrompt) {
    throw new Error('Prompt is required');
  }

  const imageList = Array.isArray(images) ? images.filter((img) => typeof img === 'string' && img.trim()).map((img) => img.trim()) : [];

  const startTime = Date.now();
  logger.info('OpenRouter chat request', { model, imageCount: imageList.length });

  const userContent = imageList.length
    ? [
        { type: 'text', text: trimmedPrompt },
        ...imageList.map((url) => ({ type: 'image_url', image_url: { url } }))
      ]
    : trimmedPrompt;

  try {
    const response = await timedFetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 1200
      })
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const text = await response.text();
      const message = mapHttpError(response.status, text);
      logger.error('OpenRouter chat failed', { model, status: response.status, duration, message });
      throw new Error(message);
    }

    const data = await response.json();
    logger.success('OpenRouter chat completed', { model, duration });
    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error.message === 'Timeout') {
      logger.error('OpenRouter chat timeout', { model, duration });
      throw new Error('Timeout');
    }
    if (error.message === 'Empty API Key' || error.message === 'Model is required' || error.message === 'Prompt is required') {
      throw error;
    }
    if (error.message.includes('Invalid API Key') || error.message.includes('Model Not Found') || error.message.includes('OpenRouter Offline')) {
      throw error;
    }
    if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED') {
      logger.error('No Internet connection', { model, duration });
      throw new Error('No Internet');
    }
    logger.error('OpenRouter chat error', { model, duration, error: error.message });
    throw error;
  }
};

const fetchModels = async (apiKey) => {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Empty API Key');
  }

  logger.info('OpenRouter fetch models request');
  const startTime = Date.now();

  try {
    const response = await timedFetch(OPENROUTER_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      }
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const text = await response.text();
      const message = mapHttpError(response.status, text);
      logger.error('OpenRouter fetch models failed', { status: response.status, duration, message });
      throw new Error(message);
    }

    const data = await response.json();
    logger.success('OpenRouter fetch models completed', { duration });
    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error.message === 'Timeout') {
      logger.error('OpenRouter fetch models timeout', { duration });
      throw new Error('Timeout');
    }
    if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED') {
      logger.error('No Internet connection for models', { duration });
      throw new Error('No Internet');
    }
    throw error;
  }
};

module.exports = { chat, fetchModels };
