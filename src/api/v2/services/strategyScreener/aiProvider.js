import boom from '@hapi/boom';

const point = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'evidenceId'],
  properties: { text: { type: 'string' }, evidenceId: { type: 'string' } },
};

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendations'],
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['symbol', 'verdict', 'reasons', 'risks'],
        properties: {
          symbol: { type: 'string' },
          verdict: { type: 'string', enum: ['CONSIDER', 'AVOID', 'WAIT'] },
          reasons: { type: 'array', items: point },
          risks: { type: 'array', items: point },
        },
      },
    },
  },
};

const instructions = [
  'Analiza empresas únicamente para la estrategia Collar Spread y el horizonte indicado.',
  'En CANDIDATES elige hasta tres candidatas distintas y ordénalas de mejor a menor ajuste. Usa CONSIDER para cada una.',
  'Compara la protección, el costo y el potencial de ganancia del collar junto con la evidencia de la empresa. Si ninguna destaca, devuelve una lista vacía.',
  'En SYMBOL devuelve exactamente un resultado para el símbolo seleccionado y da un veredicto directo.',
  'El resultado es informativo para revisión humana. CONSIDER significa que vale la pena evaluar la estrategia.',
  'AVOID significa que la evidencia es desfavorable. WAIT significa que hay un riesgo o conflicto que conviene aclarar.',
  'Da uno o dos motivos por empresa. Explica por qué destaca o qué determina el veredicto, con una frase breve por motivo.',
  'Incluye hasta dos riesgos concretos que puedan cambiar la decisión. Si la evidencia no muestra un riesgo relevante, devuelve risks como una lista vacía.',
  'Escribe en español sencillo. Usa términos como collar o prima solo cuando ayuden a explicar la decisión y acláralos si hace falta. Deja las cifras y siglas de los indicadores en el detalle de evidencia.',
  'Usa solo los datos suministrados. Cita en cada motivo y riesgo el identificador de la evidencia de esa empresa.',
  'El puntaje de confluencia mide señales y no representa una probabilidad de rendimiento.',
  'Distingue los resultados estimados del calendario y las métricas históricas. No afirmes que habrá ganancias.',
  'Abstente de indicar órdenes, montos, cantidades, precios objetivo o recomendaciones personalizadas.',
].join('\n');

function createStructuredProvider({ name, keyName, modelName, defaultModel, buildRequest, readOutput }, {
  request = fetch,
  apiKey = () => process.env[keyName]?.trim(),
  model = () => process.env[modelName]?.trim() || defaultModel,
  now = Date.now,
} = {}) {
  let recentRequests = [];
  return function prepare() {
    const key = apiKey();
    if (!key) throw boom.serverUnavailable(`Core de IA no configurado. Define ${keyName} en el servidor.`);

    return async function complete(input, signal) {
      signal?.throwIfAborted();
      const timestamp = now();
      recentRequests = recentRequests.filter(time => timestamp - time < 60_000);
      if (recentRequests.length >= 12) throw boom.tooManyRequests('El Core de IA alcanzó su límite temporal. Inténtalo en un minuto.');
      recentRequests.push(timestamp);

      const selectedModel = model();
      const payload = buildRequest(key, selectedModel, JSON.stringify(input));
      const timeout = AbortSignal.timeout(30_000);
      const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let response;
      let body;
      try {
        response = await request(payload.url, {
          method: 'POST',
          signal: requestSignal,
          headers: { ...payload.headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.body),
        });
        if (response.ok) body = await response.json();
      } catch (error) {
        signal?.throwIfAborted();
        if (timeout.aborted) throw boom.serverUnavailable(`${name} no respondió a tiempo.`);
        if (error instanceof SyntaxError) throw boom.badGateway(`${name} devolvió una respuesta inválida.`);
        throw boom.serverUnavailable(`No se pudo comunicar con ${name}.`);
      }
      if (response.status === 429) {
        throw boom.tooManyRequests(`${name} alcanzó su límite de uso. Consulta la cuota de tu proyecto.`);
      }
      if (!response.ok) throw boom.serverUnavailable(`${name} rechazó la consulta (HTTP ${response.status}).`);

      const output = readOutput(body);
      if (!output?.text) throw boom.badGateway(`${name} no entregó un análisis completo.`);
      try {
        const reportedModel = typeof output.model === 'string' ? output.model.trim() : '';
        return { model: reportedModel || selectedModel, result: JSON.parse(output.text) };
      } catch {
        throw boom.badGateway(`${name} devolvió un análisis con formato inválido.`);
      }
    };
  };
}

export function createOpenAiProvider(options) {
  return createStructuredProvider({
    name: 'OpenAI',
    keyName: 'OPENAI_API_KEY',
    modelName: 'OPENAI_AI_MODEL',
    defaultModel: 'gpt-6-luna',
    buildRequest(key, model, input) {
      return {
        url: 'https://api.openai.com/v1/responses',
        headers: { Authorization: `Bearer ${key}` },
        body: {
          model,
          store: false,
          instructions,
          input,
          max_output_tokens: 3000,
          text: { format: { type: 'json_schema', name: 'collar_analysis', strict: true, schema } },
        },
      };
    },
    readOutput(body) {
      if (body?.status !== 'completed' || !Array.isArray(body.output)) return null;
      const parts = body.output.flatMap(item =>
        item?.type === 'message' && Array.isArray(item.content) ? item.content : []);
      if (parts.some(part => part?.type === 'refusal')) return null;
      const text = parts.filter(part => part?.type === 'output_text' && typeof part.text === 'string')
        .map(part => part.text).join('');
      return { model: body.model, text };
    },
  }, options);
}

export function createGeminiProvider(options) {
  return createStructuredProvider({
    name: 'Gemini',
    keyName: 'GEMINI_API_KEY',
    modelName: 'GEMINI_AI_MODEL',
    defaultModel: 'gemini-3.1-flash-lite',
    buildRequest(key, model, input) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        headers: { 'x-goog-api-key': key },
        body: {
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: 'user', parts: [{ text: input }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
            maxOutputTokens: 3000,
          },
        },
      };
    },
    readOutput(body) {
      const candidate = body?.candidates?.[0];
      const parts = candidate?.content?.parts;
      if (candidate?.finishReason !== 'STOP' || !Array.isArray(parts)) return null;
      const text = parts.filter(part => part && !part.thought && typeof part.text === 'string')
        .map(part => part.text).join('');
      return { model: body.modelVersion, text };
    },
  }, options);
}

export function createAiProvider({
  selected = () => process.env.AI_PROVIDER?.trim().toLowerCase() || 'gemini',
  gemini = createGeminiProvider(),
  openai = createOpenAiProvider(),
} = {}) {
  return function prepare() {
    switch (selected()) {
      case 'gemini':
        return gemini();
      case 'openai':
        return openai();
      default:
        throw boom.serverUnavailable('AI_PROVIDER debe ser gemini u openai en el servidor.');
    }
  };
}
