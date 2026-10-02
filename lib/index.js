import z from "@deepseek-ai/schemastery";
import { execFile } from "node:child_process";
import path from "node:path";

export const name = "macos-notify";

export const Config = z.object({
  sound: z.string().default("Glass").description("macOS 系统通知提示音，如 Glass、Hero、Ping、Pop，设为 none 则静音").volatile(),
  notifyOnComplete: z.boolean().default(true).description("任务完成时发送系统通知").volatile(),
  notifyOnError: z.boolean().default(true).description("任务出错时发送系统通知").volatile(),
  notifyOnApproval: z.boolean().default(true).description("需要用户确认审批时发送系统通知").volatile(),
  minDurationSeconds: z.number().default(1).description("任务最短执行秒数，低于该秒数的即时响应不发送通知").volatile(),
});

function resolveConfig(config) {
  if (config === null || typeof config !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(config)) {
    out[key] = value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value;
  }
  return out;
}

function sendMacNotification({ title = "DeepSeek Harness", subtitle = "", message = "", sound = "Glass" }) {
  const escapeAppleScript = (str) =>
    String(str)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/[\r\n]+/g, " ")
      .slice(0, 200);

  const titleStr = escapeAppleScript(title);
  const subStr = subtitle ? `subtitle "${escapeAppleScript(subtitle)}"` : "";
  const msgStr = escapeAppleScript(message || "任务已完成");
  const soundStr = sound && sound !== "none" ? `sound name "${escapeAppleScript(sound)}"` : "";

  // 优先通过 DeepSeek Harness 应用标识发送，显示官方图标
  const appScript = `tell application id "com.deepseek.dsh" to display notification "${msgStr}" with title "${titleStr}" ${subStr} ${soundStr}`;

  execFile("osascript", ["-e", appScript], (err) => {
    if (err) {
      // 若应用尚未注册系统通知通道，降级通过系统标准通道发送
      const fallbackScript = `display notification "${msgStr}" with title "${titleStr}" ${subStr} ${soundStr}`;
      execFile("osascript", ["-e", fallbackScript], () => {});
    }
  });
}

export function apply(ctx, config) {
  const logger = ctx.logger("macos-notify");
  const runningAgents = new Map();

  logger.info("DeepSeek Harness macOS 通知插件已加载");

  // 监听 Agent 状态转换
  ctx.on("agent/status", ({ agent, status }) => {
    if (!agent) return;
    const agentId = agent.id || (agent.session && agent.session.id);
    if (!agentId) return;

    if (status === "running") {
      runningAgents.set(agentId, {
        startTime: Date.now(),
        hasError: false,
        errorMessage: "",
        lastReason: "completed",
        turnCount: 0,
        agent,
      });
      return;
    }

    if (status === "idle") {
      const info = runningAgents.get(agentId);
      if (!info) return;
      runningAgents.delete(agentId);

      const durationMs = Date.now() - info.startTime;
      const durationSec = durationMs / 1000;
      const cfg = resolveConfig(config);

      const minDuration = cfg.minDurationSeconds ?? 1;
      if (durationSec < minDuration) {
        return;
      }

      const session = agent.session || (ctx.sessions && ctx.sessions.get(agentId));
      let workspaceName = "";
      if (session?.header?.cwd) {
        workspaceName = path.basename(session.header.cwd);
      }

      let sessionTitle = "";
      try {
        const events = session?.ownEvents ? session.ownEvents() : [];
        const titleEvent = events.findLast((e) => e.type === "session/title");
        if (titleEvent?.data?.title) {
          sessionTitle = titleEvent.data.title;
        }
      } catch {}

      const durationFormatted =
        durationSec >= 60
          ? `${Math.floor(durationSec / 60)}分${Math.round(durationSec % 60)}秒`
          : `${durationSec.toFixed(1)}秒`;

      const sound = cfg.sound ?? "Glass";

      if (info.hasError) {
        if (cfg.notifyOnError !== false) {
          const detail = [
            workspaceName ? `工作区: ${workspaceName}` : "",
            `耗时: ${durationFormatted}`,
            info.errorMessage ? `原因: ${info.errorMessage}` : "",
          ]
            .filter(Boolean)
            .join(" | ");

          sendMacNotification({
            title: sessionTitle || "DeepSeek Harness",
            subtitle: "任务执行出错",
            message: detail || "任务异常中断",
            sound,
          });
        }
      } else if (info.lastReason === "aborted") {
        // 用户主动取消时不重复打扰
      } else {
        if (cfg.notifyOnComplete !== false) {
          const detail = [
            workspaceName ? `工作区: ${workspaceName}` : "",
            `耗时: ${durationFormatted}`,
          ]
            .filter(Boolean)
            .join(" | ");

          sendMacNotification({
            title: sessionTitle || "DeepSeek Harness",
            subtitle: "任务已完成",
            message: detail || "AI 助手已完成任务响应",
            sound,
          });
        }
      }
    }
  });

  // 监听执行错误
  ctx.on("agent/error", ({ agent, error }) => {
    if (!agent) return;
    const agentId = agent.id || (agent.session && agent.session.id);
    if (!agentId) return;

    const info = runningAgents.get(agentId);
    if (info) {
      info.hasError = true;
      info.errorMessage = error?.message || String(error);
    }
  });

  // 监听会话持久事件（包括轮次结束与审批请求）
  ctx.on("session/event", (session, event) => {
    if (!session || !event) return;

    const cfg = resolveConfig(config);

    if (event.type === "turn/end") {
      const info = runningAgents.get(session.id);
      if (info) {
        info.turnCount = (info.turnCount || 0) + 1;
        const reasonKind = event.data?.reason?.kind;
        if (reasonKind) {
          info.lastReason = reasonKind;
          if (reasonKind === "error") {
            info.hasError = true;
            info.errorMessage = event.data?.reason?.error?.message || "LLM 调用失败";
          }
        }
      }
    } else if (event.type === "approval/asked") {
      if (cfg.notifyOnApproval !== false) {
        const toolName = event.data?.toolName || "系统工具";
        const workspaceName = session?.header?.cwd ? path.basename(session.header.cwd) : "";
        const sound = cfg.sound ?? "Glass";

        sendMacNotification({
          title: "DeepSeek Harness",
          subtitle: "等待操作审批",
          message: `${workspaceName ? `[${workspaceName}] ` : ""}请求执行敏感操作: ${toolName}`,
          sound,
        });
      }
    }
  });
}
