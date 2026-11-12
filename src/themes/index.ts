import type { Theme } from "../types";
import { halloween } from "./halloween";
import { party } from "./party";
import { simple } from "./simple";

export const themes: readonly Theme[] = [simple, party, halloween];

export const findTheme = (id: string) => themes.find((theme) => theme.id === id) ?? simple;
