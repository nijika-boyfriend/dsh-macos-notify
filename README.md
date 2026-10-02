# dsh-macos-notify

macOS 系统通知插件，适用于 DeepSeek Harness。在 Agent 任务完成、执行出错或需要用户审批敏感操作时，自动通过 macOS 系统通知中心发送横幅与提示音提醒。

## 功能特性

- **任务完成通知**：会话从运行变为空闲时触发，标题为「会话标题 · 任务已完成」，正文包含耗时与助手最后一段回复摘要。
- **操作审批通知**：Agent 因敏感操作暂停等待确认时，发送横幅提醒用户返回应用。
- **出错通知（尚未实现）**：配置项与测试入口已预留，但目前没有真实的错误检测逻辑，只有 `__dshMacNotify.test("error")` 会触发。
- **以 DSH 自身身份发送**：通知由客户端通过 Web Notification 发出，macOS 会显示 DeepSeek Harness 的应用图标与名称（不再经由「脚本编辑器」）。点击通知可回到对应会话。
- **提示音**：使用 Web Audio 合成的提示音（完成为 Glass 风格，审批/出错为双音告警），带 800ms 防抖。

> ⚠️ **必须先授予 DeepSeek Harness 系统通知权限**，否则通知不会显示（或显示异常）。见下方「安装与配置 → 3. 授权通知权限」。

## 配置项

通知行为由**客户端**读取，配置保存在渲染进程的 `localStorage["dshMacNotify.config"]`，可在开发者工具 Console 中通过 `window.__dshMacNotify` 操作：

```js
__dshMacNotify.config()                       // 查看当前配置
__dshMacNotify.setConfig({ sound: "none" })   // 修改配置
__dshMacNotify.test("complete")               // 发送测试通知：complete / approval / error
__dshMacNotify.debug()                        // 查看权限与订阅状态
```

| 字段 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `enabled` | boolean | `true` | 总开关 |
| `sound` | string | `"Glass"` | `"none"` 静音；`"system"` 使用系统通知音；其他值使用内置合成提示音 |
| `volume` | number | `0.6` | 合成提示音音量 |
| `notifyOnComplete` | boolean | `true` | 任务完成时通知 |
| `notifyOnError` | boolean | `true` | 出错时通知（暂无真实触发路径） |
| `notifyOnApproval` | boolean | `true` | 等待审批时通知 |
| `autoFocus` | boolean | `true` | 点击通知时聚焦窗口并打开会话 |
| `onlyWhenHidden` | boolean | `false` | 仅在窗口不可见时通知 |

配置只有客户端这一套，`cordis.patch.yml` 中无需也无法配置通知选项。

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

### 3. 授权通知权限

通知由 DeepSeek Harness 应用本身发出，需要在 macOS 中允许它发送通知：

1. 打开「系统设置 → 通知 → DeepSeek Harness」，开启「允许通知」，并建议将提醒样式设为「横幅」或「提醒」。
2. 若列表里没有 DeepSeek Harness，先在应用内点击一次界面（首次交互时会弹出授权请求），或在开发者工具 Console 运行 `__dshMacNotify.test()` 触发授权弹窗，然后在弹窗中选择「允许」。
3. 运行 `__dshMacNotify.debug()`，确认 `permission` 为 `granted`；若为 `denied`，请回到系统设置手动开启。
4. 若系统开启了「专注模式」或「勿扰」，通知会被静默，需在专注模式设置中允许 DeepSeek Harness。

## 开源协议

本项目采用 MIT 协议开源，详见 [LICENSE](LICENSE) 文件。
