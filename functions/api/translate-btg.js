export async function onRequestPost(context) {
  try {
    const { paths } = await context.request.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return json({ error: { message: "Missing paths array" } }, 400);
    }

    const apiKey = context.env.GEMINI_API_KEY;
    if (!apiKey) {
      return json({ error: { message: "Server secret GEMINI_API_KEY is not configured." } }, 500);
    }

    const uniquePaths = [...new Set(paths.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 40);
    const prompt = `Translate these Amazon BTG category paths from German to Polish.

Rules:
- Preserve the breadcrumb structure using " > ".
- Translate naturally into Polish for e-commerce users.
- Keep technical product names accurate.
- Do not add explanations.
- Return ONLY valid JSON in this exact format:
{"translations":{"original path":"translated path"}}

Paths:
${uniquePaths.map((path, index) => `${index + 1}. ${path}`).join("\n")}`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-lite-preview",
        messages: [
          {
            role: "system",
            content: "You are a taxonomy translator. Output JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return json({ error: { message: error || `Błąd HTTP ${response.status}` } }, response.status);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return json({ translations: parsed.translations || {} });
  } catch (error) {
    return json(
      { error: { message: error instanceof Error ? error.message : "Unknown server error" } },
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
