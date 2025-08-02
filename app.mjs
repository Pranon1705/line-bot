import express from "express";
import {
  middleware,
  JSONParseError,
  SignatureValidationFailed,
  Client,
} from "@line/bot-sdk";
import fetch from "node-fetch";
require("dotenv").config();
const app = express();
const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANEL_ACCESS_TOKEN,
};
const client = new Client(config);

app.use(middleware(config));
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const events = req.body.events;

  if (!Array.isArray(events)) {
    console.log("Invalid event format");
    return res.status(400).send("Invalid format");
  }

  const replyPromises = events.map(async (event, index) => {
    console.log(`--- Event ${index + 1} ---`);
    console.log("Event type:", event.type);

    try {
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text;
        if (event.replyToken) {
          await replyWithAIResponse(client, event.replyToken, userMessage);
        }
      } else {
        if (event.replyToken) {
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `Event type ${event.type} not supported.`,
          });
        }
      }
    } catch (err) {
      console.error(`Error handling event ${index + 1}:`, err);
    }
  });

  await Promise.allSettled(replyPromises);
  res.status(200).send("OK");
});

app.use((err, req, res, next) => {
  if (err instanceof SignatureValidationFailed) {
    res.status(401).send(err.signature);
    return;
  } else if (err instanceof JSONParseError) {
    res.status(400).send(err.raw);
    return;
  }
  next(err);
});

async function call_ai(messageText) {
  const apiKey = process.env.GEMINI_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: messageText,
          },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.statusText}`);
  }

  const data = await res.json();
  const rawText =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
  const cleanText = rawText.replace(/[\n"]/g, "");
  return cleanText;
}

async function replyWithAIResponse(client, replyToken, messageText) {
  try {
    const aiResult = await call_ai(messageText);
    const replyText = JSON.stringify(aiResult, null, 2);
    await client.replyMessage(replyToken, {
      type: "text",
      text: replyText,
    });
  } catch (err) {
    console.error("Error calling AI:", err);
    await client.replyMessage(replyToken, {
      type: "text",
      text: "Sorry, something went wrong with AI service.",
    });
  }
}

app.listen(3000);
