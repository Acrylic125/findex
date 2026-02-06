import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_KEY!, { polling: true });

bot.on("message", async (msg) => {
  //   bot.deleteMessage()
  const chatId = msg.chat.id;
  //   try {
  //     const deleted = await bot.deleteMessage(chatId, msg.message_id);
  //     await bot.deleteMessage(chatId, 33333);
  //   } catch (e) {
  //     console.log(e);
  //     // Will fail in private chats — expected
  //   }
  //   bot.send
  bot.sendMessage(chatId, "Index swap with your fellow NTU students!", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Start",
            url: process.env.APP_URL,
            // url: "t.me/Findex_ntu_bot/Findex",
          },
        ],
      ],
    },
  });
  //   bot.sendMessage(chatId, "Received your message");
});

console.log("Bot is running...");
