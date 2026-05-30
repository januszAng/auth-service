import amqp from "amqplib";
import { logger } from "./logger.js";

const rmqLogger = logger.child({ component: "rabbitmq" });

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? "amqp://localhost:5672";
const QUEUE = "email_queue";

let connection: amqp.ChannelModel | null = null;
let channel: amqp.Channel | null = null;

async function getChannel(): Promise<amqp.Channel> {
  if (channel) return channel;

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  rmqLogger.info("rabbitmq connected");

  connection.on("close", () => {
    rmqLogger.warn("rabbitmq connection closed");
    connection = null;
    channel = null;
  });

  return channel;
}

export async function publishToQueue(message: {
  type: string;
  email: string;
  token: string;
}): Promise<void> {
  try {
    const ch = await getChannel();
    ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    rmqLogger.debug("message published", {
      type: message.type,
      email: message.email,
    });
  } catch (err) {
    rmqLogger.error("failed to publish message", {
      error: String(err),
      type: message.type,
    });
  }
}
