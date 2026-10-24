const GRAPH_VERSION = "v23.0";
const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_MESSAGE_LENGTH = 4000;

const ROLES = {
  sofie: {
    name: "Sofie",
    role: "Sekretariat und Vorgangsverantwortliche",
    instructions:
      "Ordne Anliegen, fasse den Stand zusammen und stelle nötige Rückfragen. Erfinde keine erledigten Aufgaben oder Befugnisse."
  },
  paul: {
    name: "Paul",
    role: "Berater und Einsatzplanung",
    instructions:
      "Berate praktisch, zerlege Aufgaben in sinnvolle Schritte und nenne Unsicherheiten. Behaupte nicht, externe Arbeiten ausgeführt zu haben."
  },
  nova: {
    name: "Nova",
    role: "Vertretung der Geschäftsleitung",
    instructions:
      "Hilf innerhalb des Chef-Profils mit kleinen, reversiblen Entscheidungen. Genehmige weder Ausgaben noch neue Außenbefugnisse oder Datenzugriffe."
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(request, body, appSecret) {
  const signature = request.headers.get("X-Hub-Signature-256") || "";
  if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = `sha256=${hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))
  )}`;
  const receivedBytes = new TextEncoder().encode(signature.toLowerCase());
  const expectedBytes = new TextEncoder().encode(expected);
  if (receivedBytes.length !== expectedBytes.length) return false;

  let difference = 0;
  for (let i = 0; i < receivedBytes.length; i++) {
    difference |= receivedBytes[i] ^ expectedBytes[i];
  }
  return difference === 0;
}

function selectRole(text) {
  const match = text.match(/^\/(sofie|paul|nova)\b(?:\s+|$)/i);
  const id = match ? match[1].toLowerCase() : "sofie";
  return { id, role: ROLES[id], message: match ? text.slice(match[0].length).trim() : text.trim() };
}

async function generateReply(text, role, env) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text: `Du bist ${role.name}, ${role.role}, im Kometenwerk-Team. ${role.instructions} Antworte auf Deutsch, freundlich und knapp. Du bist eine KI, kein Mensch. Behaupte niemals, auf Kalender, Team-Chat, Dateien, YouTube, E-Mail oder andere Konten zugreifen oder dort etwas ausgeführt zu haben. Bitte nie um Passwörter, Tokens oder geheime Schlüssel.`
        }]
      },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.5 }
    })
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
  const data = await response.json();
  const answer = (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
  if (!answer) throw new Error("Gemini returned an empty answer");
  return answer.slice(0, MAX_MESSAGE_LENGTH);
}

async function sendWhatsApp(text, recipient, env) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: false, body: text }
    })
  });
  if (!response.ok) throw new Error(`WhatsApp send failed (${response.status})`);
}

function configured(env) {
  return [
    "META_APP_SECRET",
    "META_VERIFY_TOKEN",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "OWNER_WA_ID",
    "GEMINI_API_KEY"
  ].every((name) => typeof env[name] === "string" && env[name].length > 0);
}

async function handleWebhook(request, env) {
  if (!configured(env)) return json({ error: "Worker secrets are not configured." }, 503);

  const url = new URL(request.url);
  if (request.method === "GET") {
    if (
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === env.META_VERIFY_TOKEN
    ) {
      return new Response(url.searchParams.get("hub.challenge") || "", {
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }
    return new Response("Webhook verification failed.", { status: 403 });
  }

  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405 });
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 65536) return new Response("Payload too large.", { status: 413 });

  const body = await request.text();
  if (new TextEncoder().encode(body).length > 65536) {
    return new Response("Payload too large.", { status: 413 });
  }
  if (!(await verifySignature(request, body, env.META_APP_SECRET))) {
    return new Response("Invalid signature.", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  if (!payload || !Array.isArray(payload.entry)) {
    return json({ error: "Invalid webhook payload." }, 400);
  }

  const messages = payload.entry
    .filter((entry) => entry && Array.isArray(entry.changes))
    .flatMap((entry) => entry.changes || [])
    .flatMap((change) =>
      change?.value && Array.isArray(change.value.messages) ? change.value.messages : []
    );

  for (const message of messages) {
    if (
      message.from !== env.OWNER_WA_ID ||
      message.type !== "text" ||
      typeof message.text?.body !== "string"
    ) continue;

    const text = message.text.body.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) continue;
    const selected = selectRole(text);
    if (!selected.message) continue;

    const answer = await generateReply(selected.message, selected.role, env);
    await sendWhatsApp(`${selected.role.name} (KI): ${answer}`, message.from, env);
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/webhook") return new Response("Not found.", { status: 404 });
    return handleWebhook(request, env);
  }
};

export { selectRole, verifySignature };
