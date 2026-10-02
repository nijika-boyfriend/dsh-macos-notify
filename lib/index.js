import z from "@deepseek-ai/schemastery";

export const name = "macos-notify";

export const Config = z.object({
  sound: z.string().default("Glass").description("提示音（客户端 localStorage 配置优先）").volatile(),
  notifyOnComplete: z.boolean().default(true).description("任务完成时发送通知").volatile(),
  notifyOnError: z.boolean().default(true).description("任务出错时发送通知").volatile(),
  notifyOnApproval: z.boolean().default(true).description("需要用户确认审批时发送通知").volatile(),
  minDurationSeconds: z.number().default(1).description("任务最短执行秒数，低于该秒数的即时响应不发送通知").volatile(),
});

// 通知全部由客户端 (lib/client.js) 通过 Web Notification 发出，
// 这样 macOS 会把发件方识别为 DeepSeek Harness 本身。
// 服务端不再调用 osascript，否则通知会被归到「脚本编辑器」名下。
export function apply(ctx) {
  const logger = ctx.logger("macos-notify");
  logger.info("DeepSeek Harness macOS 通知插件服务端已就绪");
}
