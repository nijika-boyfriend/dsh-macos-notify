import z from "@deepseek-ai/schemastery";
import { execFile } from "node:child_process";

export const name = "macos-notify";

export const Config = z.object({
  sound: z.string().default("Glass").description("macOS 系统通知提示音，如 Glass、Hero、Ping，设为 none 则静音").volatile(),
  notifyOnComplete: z.boolean().default(true).description("任务完成时发送通知").volatile(),
  notifyOnError: z.boolean().default(true).description("任务出错时发送通知").volatile(),
  notifyOnApproval: z.boolean().default(true).description("需要用户确认审批时发送通知").volatile(),
  minDurationSeconds: z.number().default(1).description("任务最短执行秒数，低于该秒数的即时响应不发送通知").volatile(),
  headlessFallback: z.boolean().default(false).description("无前端界面（如命令行 CLI）时是否启用 AppleScript 回退").volatile(),
});

function fallbackAppleScript({ title, subtitle, message, sound }) {
  const escapeAppleScript = (str) =>
    String(str)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/[\r\n]+/g, " ")
      .slice(0, 200);

  const titleStr = escapeAppleScript(title || "DeepSeek Harness");
  const subStr = subtitle ? `subtitle "${escapeAppleScript(subtitle)}"` : "";
  const msgStr = escapeAppleScript(message || "任务已完成");
  const soundStr = sound && sound !== "none" ? `sound name "${escapeAppleScript(sound)}"` : "";

  const fallbackScript = `display notification "${msgStr}" with title "${titleStr}" ${subStr} ${soundStr}`;
  execFile("osascript", ["-e", fallbackScript], () => {});
}

export function apply(ctx, config) {
  const logger = ctx.logger("macos-notify");
  logger.info("DeepSeek Harness macOS 通知插件服务端已就绪");

  // 当显式开启无界面回退模式时，监听底层会话事件
  if (config?.headlessFallback) {
    ctx.on("agent/status", ({ agent, status }) => {
      if (status === "idle" && agent) {
        fallbackAppleScript({
          title: "DeepSeek Harness",
          subtitle: "任务已完成",
          message: "AI 助手已完成任务响应",
          sound: config?.sound ?? "Glass",
        });
      }
    });
  }
}
