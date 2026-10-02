// dsh-macos-notify — client plugin bundle
// Loaded by dsh-client-modules at /plugins/dsh-macos-notify/client.js
// Runs directly inside the DeepSeek Harness Electron renderer.
// Uses native Web Notifications inside Electron to ensure macOS displays
// the official DeepSeek Harness application icon and name.

window.__ModuleLoader__.load({
  id: "dsh-macos-notify",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var LS_CONFIG = "dshMacNotify.config";
    var DEFAULTS = {
      enabled: true,
      sound: true,
      volume: 0.6,
      notifyOnComplete: true,
      notifyOnError: true,
      notifyOnApproval: true,
      autoFocus: true,
      onlyWhenHidden: false
    };

    function readConfig() {
      var cfg = {};
      try {
        var raw = localStorage.getItem(LS_CONFIG);
        if (raw) cfg = JSON.parse(raw);
      } catch (e) {}
      for (var k in DEFAULTS) {
        if (!(k in cfg)) cfg[k] = DEFAULTS[k];
      }
      return cfg;
    }

    function writeConfig(patch) {
      var cfg = readConfig();
      for (var k in patch) cfg[k] = patch[k];
      try {
        localStorage.setItem(LS_CONFIG, JSON.stringify(cfg));
      } catch (e) {}
      return cfg;
    }

    var config = readConfig();

    var permAsked = false;
    function requestPermission() {
      if (!("Notification" in window) || permAsked) return;
      permAsked = true;
      try {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(function () {});
        }
      } catch (e) {}
    }

    var audioCtx = null;
    function unlockAudio() {
      try {
        if (!audioCtx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) audioCtx = new AC();
        }
        if (audioCtx && audioCtx.state === "suspended") {
          audioCtx.resume().catch(function () {});
        }
      } catch (e) {}
    }

    function onFirstGesture() {
      unlockAudio();
      requestPermission();
      window.removeEventListener("pointerdown", onFirstGesture, true);
      window.removeEventListener("keydown", onFirstGesture, true);
    }
    window.addEventListener("pointerdown", onFirstGesture, true);
    window.addEventListener("keydown", onFirstGesture, true);

    function playGlassChime() {
      if (!config.sound) return;
      unlockAudio();
      if (!audioCtx || audioCtx.state !== "running") return;
      try {
        var t0 = audioCtx.currentTime;
        var freqs = [1046.5, 2093.0];
        for (var i = 0; i < freqs.length; i++) {
          var osc = audioCtx.createOscillator();
          var gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freqs[i], t0);
          gain.gain.setValueAtTime(0.001, t0);
          gain.gain.exponentialRampToValueAtTime(config.volume * 0.25 / (i + 1), t0 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.5);
        }
      } catch (e) {}
    }

    function playAlertChime() {
      if (!config.sound) return;
      unlockAudio();
      if (!audioCtx || audioCtx.state !== "running") return;
      try {
        var t0 = audioCtx.currentTime;
        var pitches = [880, 1174];
        for (var j = 0; j < pitches.length; j++) {
          (function (idx, freq) {
            var start = t0 + idx * 0.15;
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.001, start);
            gain.gain.exponentialRampToValueAtTime(config.volume * 0.3, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(start);
            osc.stop(start + 0.32);
          })(j, pitches[j]);
        }
      } catch (e) {}
    }

    function focusSession(sessionId) {
      try { window.focus(); } catch (e) {}
      if (!sessionId || !rootCtx) return;
      try {
        var svc = lookupService("sessions");
        if (svc && typeof svc.open === "function") {
          svc.open(sessionId);
        }
      } catch (e) {}
    }

    function isPageHidden() {
      return document.hidden || document.visibilityState === "hidden";
    }

    function showNotification(kind, title, body, sessionId) {
      if (!config.enabled) return;
      if (config.onlyWhenHidden && !isPageHidden()) return;

      requestPermission();

      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted" && Notification.permission !== "default") return;

      try {
        var iconUrl = (location.origin || "") + "/favicon.svg";
        var n = new Notification(title, {
          body: body || "",
          tag: "dsh-notify-" + kind + "-" + (sessionId || "global"),
          renotify: true,
          icon: iconUrl
        });

        if (config.autoFocus) {
          n.onclick = function () {
            focusSession(sessionId);
            n.close();
          };
        }

        setTimeout(function () {
          try { n.close(); } catch (e) {}
        }, 12000);
      } catch (e) {
        try { console.error("[dsh-macos-notify] notification error", e); } catch (e2) {}
      }

      if (kind === "approval" || kind === "error") {
        playAlertChime();
      } else {
        playGlassChime();
      }
    }

    var rootCtx = null;
    var listStore = null;
    var faceSub = null;
    var currentFaceId = null;
    var sessionBaselines = Object.create(null);
    var firedInteractions = Object.create(null);
    var uiStore = null;
    var uiSub = null;

    function lookupService(name) {
      var svc = null;
      try {
        if (rootCtx && typeof rootCtx.get === "function") {
          svc = rootCtx.get(name) || null;
        }
      } catch (e) {}
      if (svc) return svc;
      try {
        if (rootCtx && rootCtx.reflect && typeof rootCtx.reflect.get === "function") {
          svc = rootCtx.reflect.get(name) || null;
        }
      } catch (e) {}
      if (svc) return svc;
      try {
        if (rootCtx && name in rootCtx) {
          svc = rootCtx[name] || null;
        }
      } catch (e) {}
      return svc;
    }

    function getSessionTitle(sessionId) {
      try {
        if (listStore) {
          var st = listStore.getSnapshot();
          if (st && st.byId && st.byId[sessionId]) {
            var row = st.byId[sessionId];
            return row.displayTitle || row.title || "";
          }
        }
      } catch (e) {}
      return "";
    }

    function formatSnippet(snap) {
      if (!snap || !snap.nodes) return "";
      try {
        var nodes = snap.nodes;
        for (var i = nodes.length - 1; i >= 0; i--) {
          var nd = nodes[i];
          if (nd && nd.kind === "assistant" && nd.blocks) {
            for (var b = nd.blocks.length - 1; b >= 0; b--) {
              var block = nd.blocks[b];
              if (block && block.kind === "text" && block.text) {
                var clean = block.text.replace(/\s+/g, " ").trim();
                if (clean) {
                  return clean.length > 90 ? clean.slice(0, 90) + "..." : clean;
                }
              }
            }
          }
        }
      } catch (e) {}
      return "";
    }

    function checkSessionTransition(sessionId, isRunning, snap) {
      var base = sessionBaselines[sessionId];
      if (!base) {
        sessionBaselines[sessionId] = {
          running: isRunning,
          startTime: isRunning ? Date.now() : 0,
          seeded: true
        };
        return;
      }

      if (isRunning && !base.running) {
        base.running = true;
        base.startTime = Date.now();
        return;
      }

      if (!isRunning && base.running) {
        base.running = false;
        var durationSec = base.startTime ? Math.round((Date.now() - base.startTime) / 1000) : 0;
        var sessionTitle = getSessionTitle(sessionId) || "DeepSeek Harness";

        var durationFormatted = "";
        if (durationSec >= 60) {
          durationFormatted = Math.floor(durationSec / 60) + "分" + (durationSec % 60) + "秒";
        } else if (durationSec > 0) {
          durationFormatted = durationSec + "秒";
        }

        var snippet = snap ? formatSnippet(snap) : "";
        var bodyParts = [];
        if (durationFormatted) {
          bodyParts.push("耗时: " + durationFormatted);
        }
        if (snippet) {
          bodyParts.push(snippet);
        } else {
          bodyParts.push("AI 助手已完成任务响应");
        }

        if (config.notifyOnComplete) {
          showNotification(
            "complete",
            sessionTitle + " · 任务已完成",
            bodyParts.join(" | "),
            sessionId
          );
        }
      }
    }

    function bindCurrentFace() {
      if (!listStore) return;
      try {
        var st = listStore.getSnapshot();
        var cur = st && st.current;
        if (!cur) {
          detachFace();
          return;
        }
        if (cur === currentFaceId && faceSub) return;
        detachFace();
        currentFaceId = cur;

        var b = rootCtx.sessions.binding(cur);
        if (!b || !b.session || typeof b.session.subscribe !== "function") return;

        faceSub = b.session.subscribe(function () {
          try {
            var snap = b.session.getSnapshot();
            if (snap) {
              checkSessionTransition(cur, !!snap.running, snap);
            }
          } catch (e) {}
        });

        var initialSnap = b.session.getSnapshot();
        if (initialSnap) {
          checkSessionTransition(cur, !!initialSnap.running, initialSnap);
        }
      } catch (e) {}
    }

    function detachFace() {
      if (faceSub) {
        try { faceSub(); } catch (e) {}
        faceSub = null;
      }
      currentFaceId = null;
    }

    function onListChanged() {
      if (!listStore) return;
      try {
        var st = listStore.getSnapshot();
        bindCurrentFace();
        bindUiSession();

        var byId = (st && st.byId) || {};
        for (var sid in byId) {
          if (sid === currentFaceId) continue;
          var row = byId[sid];
          if (!row) continue;
          checkSessionTransition(sid, !!row.running, null);
        }
      } catch (e) {}
    }

    function bindUiSession() {
      var svc = lookupService("uiSession");
      var store = svc && svc.pendingInteractions;
      if (!store || typeof store.getSnapshot !== "function" || typeof store.subscribe !== "function") return;
      if (uiSub && uiStore === store) return;

      if (uiSub) detachUiSession();
      uiStore = store;
      uiSub = store.subscribe(function () {
        try { evalUiPending(); } catch (e) {}
      });
      evalUiPending();
    }

    function evalUiPending() {
      if (!uiStore || typeof uiStore.getSnapshot !== "function") return;
      var snap = uiStore.getSnapshot();
      if (!snap || typeof snap.forEach !== "function") return;

      snap.forEach(function (it, sid) {
        if (!it) return;
        var key = it.key || (it.kind + ":" + sid);
        if (firedInteractions[key]) return;
        firedInteractions[key] = true;

        var sessionTitle = getSessionTitle(sid) || "DeepSeek Harness";
        var toolName = it.toolName || it.name || "系统操作";
        var reason = it.reason || it.operation || "";

        if (config.notifyOnApproval) {
          var detail = reason ? "请求执行: " + toolName + " | 原因: " + reason : "请求执行敏感操作: " + toolName;
          showNotification(
            "approval",
            sessionTitle + " · 等待操作审批",
            detail,
            sid
          );
        }
      });
    }

    function detachUiSession() {
      if (uiSub) {
        try { uiSub(); } catch (e) {}
        uiSub = null;
      }
      uiStore = null;
    }

    var api = window.__dshMacNotify || {};
    api.version = "1.1.0";
    api.config = function () { return readConfig(); };
    api.setConfig = function (patch) { config = writeConfig(patch); return config; };
    api.test = function (kind) {
      kind = kind || "complete";
      unlockAudio();
      requestPermission();
      if (kind === "approval") {
        showNotification("approval", "DeepSeek Harness · 等待操作审批", "测试通知: 请求执行敏感操作 bash_run", "test");
      } else if (kind === "error") {
        showNotification("error", "DeepSeek Harness · 任务执行出错", "测试通知: 任务执行失败", "test");
      } else {
        showNotification("complete", "DeepSeek Harness · 任务已完成", "测试通知: AI 助手已成功完成响应", "test");
      }
      return "测试通知已触发, 授权状态: " + (typeof Notification !== "undefined" ? Notification.permission : "不支持");
    };
    api.debug = function () {
      return {
        version: api.version,
        config: readConfig(),
        permission: typeof Notification !== "undefined" ? Notification.permission : "不支持",
        hidden: isPageHidden(),
        sessionsSubscribed: !!faceSub,
        currentFace: currentFaceId,
        uiSessionBound: !!uiSub
      };
    };
    window.__dshMacNotify = api;

    var inject = ["sessions", "locale", "slots"];

    function apply(ctx) {
      rootCtx = ctx;

      ctx.effect(function () {
        var disposed = false;
        var unsubs = [];
        var retryTimer = null;

        try {
          var sessionsSvc = ctx.sessions;
          if (sessionsSvc && sessionsSvc.list && typeof sessionsSvc.list.subscribe === "function") {
            listStore = sessionsSvc.list;
            unsubs.push(sessionsSvc.list.subscribe(onListChanged));
            bindUiSession();
            onListChanged();
          }

          retryTimer = setInterval(function () {
            if (disposed) return;
            try { bindCurrentFace(); } catch (e) {}
            try { bindUiSession(); } catch (e) {}
          }, 2000);

          try {
            console.log("[dsh-macos-notify] 客户端原生通知模块已激活");
          } catch (e) {}
        } catch (e) {
          try { console.error("[dsh-macos-notify] 初始化异常", e); } catch (e2) {}
        }

        return function () {
          disposed = true;
          if (retryTimer) clearInterval(retryTimer);
          for (var i = 0; i < unsubs.length; i++) {
            try { unsubs[i](); } catch (e) {}
          }
          detachFace();
          detachUiSession();
        };
      }, "dsh-macos-notify: client watchers");
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
