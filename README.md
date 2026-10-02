# dsh-macos-notify

macOS 系统通知插件，适用于 DeepSeek Harness。在 Agent 任务完成、执行出错或需要用户审批敏感操作时，自动通过 macOS 系统通知中心发送横幅与提示音提醒。

## 功能特性

- **任务完成通知**：当 Agent 运行结束并恢复空闲状态时，触发系统通知，告知用户任务已完成、工作区与任务耗时。
- **任务出错通知**：当模型请求失败、工具调用异常或任务异常中止时，触发告警通知并附带错误原因。
- **操作审批通知**：当 Agent 尝试执行危险命令或工具而暂停等待用户确认时，立即发送横幅提醒用户返回应用。
- **沉浸式体验**：优先调用 DeepSeek Harness 官方应用标识，通知附带 DeepSeek 图标与原生提示音。支持快速任务过滤，避免几百毫秒的瞬时应答频繁打扰。
- **动态配置支持**：配置项支持热重载，可自定义提示音、开关通知类型与调节最短通知耗时阈值。

## 配置项

| 配置字段 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `sound` | string | `Glass` | 提示音名称，可选 `Glass`, `Hero`, `Ping`, `Pop`, `default`，设为 `none` 则静音 |
| `notifyOnComplete` | boolean | `true` | 任务正常完成时是否发送通知 |
| `notifyOnError` | boolean | `true` | 任务发生异常时是否发送通知 |
| `notifyOnApproval` | boolean | `true` | 等待敏感操作授权审批时是否发送通知 |
| `minDurationSeconds` | number | `1` | 任务执行最短秒数，低于该时间的快速响应不触发通知 |

## 安装与配置

### 1. 安装插件

克隆本仓库到本地插件目录，例如 `~/.dsh/plugins/dsh-macos-notify`，然后在目标配置目录，如 `~/.dsh/profiles/desktop`，添加依赖：

```bash
cd ~/.dsh/profiles/desktop
pnpm add file:../../plugins/dsh-macos-notify
```

### 2. 注册补丁

在配置目录的 `cordis.patch.yml` 中添加插件配置项：

```yaml
- insert:
    - id: macos-notify
      name: dsh-macos-notify
      config:
        sound: Glass
        notifyOnComplete: true
        notifyOnError: true
        notifyOnApproval: true
        minDurationSeconds: 1
```

在配置目录的 `package.json` 中将插件加入 bundles 列表：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-macos-notify"
      ]
    }
  }
}
```

启动或重载 DeepSeek Harness 后，插件将自动加载并监听任务事件。

## 开源协议

本项目采用 MIT 协议开源，详见 [LICENSE](LICENSE) 文件。
