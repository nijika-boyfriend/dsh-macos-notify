# dsh-macos-notify

macOS 系统通知插件，适用于 DeepSeek Harness。在 Agent 任务完成或需要用户审批敏感操作时，自动通过 macOS 系统通知中心发送横幅与提示音提醒。

## 功能特性

- **提示音**：使用 Web Audio 合成的提示音（完成为 Glass 风格，审批为双音告警），带 800ms 防抖。

> ⚠️ **必须先授予 DeepSeek Harness 系统通知权限**，否则通知不会显示。

## 开源协议

本项目采用 MIT 协议开源，详见 [LICENSE](LICENSE) 文件。
