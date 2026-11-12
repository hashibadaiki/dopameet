(() => {
  const INTERACTIVE =
    'button, [role="button"], [role="menu"], [role="toolbar"], [role="listbox"]';

  const emojiFromSrc = (src) => {
    const match = src.match(/notoemoji\/[^/]+\/([0-9a-f_]+)\//i);
    if (!match) return "";
    return String.fromCodePoint(
      ...match[1].split("_").map((hex) => parseInt(hex, 16)),
    );
  };

  const floatingReactionIn = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const images = node.querySelectorAll("img");
    if (images.length !== 1) return null;
    const [image] = images;
    const hasSenderName = node.textContent.trim() !== "";
    if (!hasSenderName || image.closest(INTERACTIVE)) return null;
    return (
      MeetMood.classify(image.alt) ?? MeetMood.classify(emojiFromSrc(image.src))
    );
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        const kind = floatingReactionIn(node);
        if (!kind) continue;
        console.debug("[dopagaki-meet] reaction", kind);
        MeetMood.update((state) => MeetMood.react(state, kind, Date.now()));
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
