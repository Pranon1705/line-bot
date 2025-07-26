import express from "express";
import {
  middleware,
  JSONParseError,
  SignatureValidationFailed,
  Client,
} from "@line/bot-sdk";
import fetch from "node-fetch";

const app = express();
const config = {
  channelSecret: "96db582e9e00643f751a1ed334de65d7",
  channelAccessToken:
    "h2qOq81qCmNps7Smh8j8tFmmEcL8KHiO0/I9YE2z+xZ7x0dRHd5s3LtGWh5qrC4htMygECngFk1A09rWuKiTWzc/OcuwlKXox/w+SI69zrbqLPVBbKdV0n3xIoIru096AMyA+9uMcCz8jTYsYQ+c+wdB04t89/1O/w1cDnyilFU=",
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
  const token = "DTPPRFJZPPNZTDJUCBRRXNQ4BE3C3OX5";
  const url = `https://api.wit.ai/message?v=20230726&q=${encodeURIComponent(
    messageText
  )}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Wit.ai API error: ${res.statusText}`);
  }

  const data = await res.json();
  return data;
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
