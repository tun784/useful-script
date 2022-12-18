// https://stackoverflow.com/a/70949953
// https://stackoverflow.com/a/9517879
// https://stackoverflow.com/a/2920207/11898496

(async () => {
  // https://stackoverflow.com/a/8578840/11898496
  function injectScript(
    src,
    onload,
    type = "text/javascript",
    async = false,
    defer = false
  ) {
    let s = document.createElement("script");
    s.type = type;
    s.async = async;
    s.defer = defer;
    s.addEventListener("load", () => {
      console.log("Useful-scripts injected " + src);
      onload?.();
      s.remove();
    });
    s.src = src;
    let head =
      document.head ||
      document.getElementsByTagName("head")[0] ||
      document.documentElement;
    head.insertBefore(s, head.firstChild);
    // (document.head || document.documentElement).prepend(s);
  }

  injectScript(
    chrome.runtime.getURL(
      "/scripts/content-scripts/scripts/ufs_global_webpage_context.js"
    )
  );

  let key = "activeScripts";
  let ids = (await chrome.storage.sync.get([key]))?.[key] || "";
  let search = new URLSearchParams({
    ids: ids,
    event: "onDocumentStart",
    path: chrome.runtime.getURL("/scripts/"),
  }).toString();

  injectScript(
    chrome.runtime.getURL("/scripts/content-scripts/run_scripts.js") +
      "?" +
      search
  );
})();

(async () => {
  try {
    const { MsgType, ClickType } = await import("../helpers/constants.js");
    const { isFunction } = await import("../helpers/utils.js");

    chrome.runtime.onMessage.addListener(async function (
      message,
      sender,
      sendResponse
    ) {
      console.log("> Received message:", message);

      switch (message.type) {
        case MsgType.runScript:
          let scriptId = message.scriptId;
          const script = (await import("../" + scriptId + ".js"))?.default;

          if (script && isFunction(script[ClickType.onClickContentScript])) {
            script[ClickType.onClickContentScript]();
            console.log("> Run script " + scriptId);
          }
          break;
      }
    });
  } catch (e) {
    console.log("ERROR: ", e);
  }
})();
