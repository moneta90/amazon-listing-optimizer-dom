export async function onRequestPost(context) {
  try {
    const { provider, model, messages, responseFormat, temperature, maxTokens } = await context.request.json();

    if (!provider || !model || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: { message: "Missing required fields: provider, model, messages" } }, 400);
    }

    const isGemini = provider === "gemini";
    const apiKey = isGemini ? context.env.GEMINI_API_KEY : context.env.GROQ_API_KEY;
    if (!apiKey) {
      return json(
        {
          error: {
            message: `Server secret ${isGemini ? "GEMINI_API_KEY" : "GROQ_API_KEY"} is not configured.`,
          },
        },
        500
      );
    }

    const upstreamUrl = isGemini
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";

    const upstreamBody = {
      model,
      messages,
      temperature: typeof temperature === "number" ? temperature : 0.7,
      max_tokens: typeof maxTokens === "number" ? maxTokens : (isGemini ? 8192 : 3000),
    };

    if (responseFormat) {
      upstreamBody.response_format = responseFormat;
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    const text = await upstreamResponse.text();
    return new Response(text, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": upstreamResponse.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return json(
      {
        error: {
          message: error instanceof Error ? error.message : "Unknown server error",
        },
      },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
