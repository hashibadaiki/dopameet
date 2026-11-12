import { tuning } from "./mood";
import type { ReactionEvent, Theme, View } from "./types";

const make = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent: Node,
) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
};

export class Meter {
  private readonly el: HTMLDivElement;
  private readonly face: HTMLDivElement;
  private readonly up: HTMLDivElement;
  private readonly down: HTMLDivElement;
  private readonly timer: HTMLDivElement;
  private readonly caption: HTMLDivElement;
  private readonly pipRow: HTMLDivElement;
  private pips: HTMLElement[] = [];
  private theme: Theme | null = null;
  private cache = new Map<string, string | number | boolean>();
  visible = false;

  constructor(root: ShadowRoot) {
    this.el = make("div", "meter", root);
    this.face = make("div", "face", this.el);
    const body = make("div", "body", this.el);
    const track = make("div", "track", body);
    this.up = make("div", "up", track);
    this.down = make("div", "down", track);
    make("div", "zero", track);
    this.timer = make("div", "timer", body);
    const row = make("div", "row", body);
    this.caption = make("div", "caption", row);
    this.pipRow = make("div", "pips", row);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.el.dataset.theme = theme.id;
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
    this.write("timer", view.rainbowLeft.toFixed(3), (v) => (this.timer.style.transform = `scaleX(${v})`));
    this.write("fever", view.fever, (v) => this.el.classList.toggle("fever", v));
    this.write("caption", this.captionFor(theme, view), (v) => (this.caption.textContent = v));
    if (this.pips.length !== tuning.rainbowCount) {
      this.pipRow.replaceChildren();
      this.pips = Array.from({ length: tuning.rainbowCount }, () => make("i", "", this.pipRow));
      this.cache.delete("pips");
    }
    this.write("pips", view.comboCount, (count) =>
      this.pips.forEach((pip, i) => pip.classList.toggle("on", i < count)),
    );
    const changed = this.write("face", this.faceFor(theme, view), (v) => (this.face.textContent = v));
    if (changed && this.visible) this.pop(this.face, 1.5);
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
    this.pop(this.face, 1.35);
  }

  origin() {
    if (!this.visible) return null;
    const rect = this.face.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top };
  }

  private write<T extends string | number | boolean>(key: string, value: T, apply: (value: T) => void) {
    if (this.cache.get(key) === value) return false;
    this.cache.set(key, value);
    apply(value);
    return true;
  }

  private faceFor(theme: Theme, view: View) {
    const { faces, fever } = theme.meter;
    if (view.fever) return fever;
    const index = Math.min(faces.length - 1, Math.floor(((view.level + 1) / 2) * faces.length));
    return faces[index] ?? "";
  }

  private captionFor(theme: Theme, view: View) {
    const copy = theme.meter;
    if (view.fever) return copy.feverOn;
    if (view.comboCount > 0) {
      return `あと ${tuning.rainbowCount - view.comboCount} 回で${copy.feverName}`;
    }
    if (view.level < -0.4) return copy.low;
    return copy.idle;
  }

  private pop(element: HTMLElement, scale: number) {
    element.animate(
      [{ transform: "scale(1)" }, { transform: `scale(${scale})`, offset: 0.35 }, { transform: "scale(1)" }],
      { duration: 420, easing: "cubic-bezier(.2,.9,.3,1.3)" },
    );
  }
}
