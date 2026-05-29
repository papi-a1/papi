const https = require("https");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "API key belum dikonfigurasi di server." });
  }

  const { messages, userName } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Format request tidak valid." });
  }

  // Konversi format messages ke format Gemini
  const geminiContents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const systemPrompt = `Kamu adalah Papi AI, asisten kecerdasan buatan yang cerdas, ramah, dan sangat membantu. ${userName ? `Nama pengguna yang sedang chat dengan kamu adalah ${userName}.` : ""} Jawab dalam Bahasa Indonesia yang natural dan hangat. Gunakan **bold** untuk penekanan penting. Berikan jawaban yang informatif, jelas, dan mudah dipahami.`;

  const body = JSON.stringify({
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: geminiContents,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    }
  });

  const path = `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

  const options = {
    hostname: "generativelanguage.googleapis.com",
    path: path,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve) => {
    const apiReq = https.request(options, (apiRes) => {
      let data = "";
      apiRes.on("data", (chunk) => (data += chunk));
      apiRes.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            res.status(200).json({
              content: [{ type: "text", text: text }]
            });
          } else {
            const errMsg = parsed.error?.message || "Respons kosong dari Gemini.";
            res.status(500).json({ error: errMsg });
          }
        } catch (e) {
          res.status(500).json({ error: "Gagal memproses respons API." });
        }
        resolve();
      });
    });
    apiReq.on("error", (e) => {
      res.status(500).json({ error: "Koneksi ke API gagal: " + e.message });
      resolve();
    });
    apiReq.write(body);
    apiReq.end();
  });
};
