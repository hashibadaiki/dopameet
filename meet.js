(() => {
  const INTERACTIVE =
    'button, [role="button"], [role="menu"], [role="toolbar"], [role="listbox"]';
  const HEARTBEAT_MS = 20_000;

  const emojiFromSrc = (src) => {
    const match = src.match(/notoemoji\/[^/]+\/([0-9a-f_]+)\//i);
    if (!match) return "";
    return String.fromCodePoint(
      ...match[1].split("_").map((hex) => parseInt(hex, 16)),
    );
  };

  const reactionIn = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const images = node.querySelectorAll("img");
    if (images.length !== 1) return null;
    const [image] = images;
    const hasSenderName = node.textContent.trim() !== "";
    if (!hasSenderName || image.closest(INTERACTIVE)) return null;
    for (const emoji of [image.alt, emojiFromSrc(image.src)]) {
      const kind = Dopameet.classify(emoji);
      if (kind) return { emoji, kind };
    }
    return null;
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        const reaction = reactionIn(node);
        if (!reaction) continue;
        console.debug("[dopameet] reaction", reaction.emoji, reaction.kind);
        Dopameet.mood.update((mood) =>
          Dopameet.react(mood, reaction.emoji, reaction.kind, Date.now()),
        );
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const inCall = () => /[a-z]{3}-[a-z]{4}-[a-z]{3}/.test(location.pathname);
  const beat = () => {
    if (inCall()) Dopameet.call.update(() => ({ at: Date.now() }));
  };
  beat();
  setInterval(beat, HEARTBEAT_MS);
  addEventListener("pagehide", () => Dopameet.call.update(() => ({ at: 0 })));
})();
