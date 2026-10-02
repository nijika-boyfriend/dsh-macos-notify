import z from "@deepseek-ai/schemastery";

export const name = "macos-notify";

// 所有配置由客户端 localStorage 管理（见 README），服务端无配置项。
export const Config = z.object({});

// 通知全部由客户端 (lib/client.js) 通过 Web Notification 发出，
// 这样 macOS 会把发件方识别为 DeepSeek Harness 本身。
// 服务端不再调用 osascript，否则通知会被归到「脚本编辑器」名下。
export function apply(ctx) {
  const logger = ctx.logger("macos-notify");
  logger.info("DeepSeek Harness macOS 通知插件服务端已就绪");
}
