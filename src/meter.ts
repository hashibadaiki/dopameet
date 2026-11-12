import type { ReactionEvent, Theme, View } from "./types";

const make = (className: string, parent: Node) => {
  const element = document.createElement("div");
  element.className = className;
  parent.appendChild(element);
  return element;
};

export class Meter {
  private readonly el: HTMLDivElement;
  private readonly up: HTMLDivElement;
  private readonly down: HTMLDivElement;
  private theme: Theme | null = null;
  private cache = new Map<string, string | boolean>();
  visible = false;

  constructor(root: ShadowRoot) {
    this.el = make("meter", root);
    const track = make("track", this.el);
    this.up = make("up", track);
    this.down = make("down", track);
    make("zero", track);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.cache.clear();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.el.classList.toggle("shown", visible);
  }

  update(view: View) {
    const theme = this.theme;
    if (!theme) return;
    this.write("up", view.up.toFixed(3), (v) => (this.up.style.transform = `scaleX(${v})`));
    this.write("down", view.down.toFixed(3), (v) => (this.down.style.transform = `scaleX(${v})`));
    this.write("fever", view.fever, (v) => this.el.classList.toggle("fever", v));
    this.write("tone", view.fever ? "" : theme.tone(view), (v) => (this.el.dataset.tone = v));
  }

  bump(event: ReactionEvent) {
    if (!this.visible) return;
    const good = event.kind === "good";
    this.el.animate(
      [
        { translate: "0 0" },
        { translate: good ? "0 -0.35em" : "0.25em 0", offset: 0.3 },
        { translate: good ? "0 0" : "-0.2em 0", offset: 0.6 },
        { translate: "0 0" },
      ],
      { duration: 360, easing: "ease-out" },
    );
  }

  private write<T extends string | boolean>(key: string, value: T, apply: (value: T) => void) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply(value);
  }
}
