import { describe, expect, it } from "vitest";
import { installView, isEditorPreviewHost, type InstallEnv } from "@/lib/enigma/install";

const base: InstallEnv = {
  standalone: false,
  editorPreview: false,
  secure: true,
  hasPrompt: false,
  ios: false,
  iosSafari: false,
};

describe("Instalar no celular", () => {
  it("hides the install option when the app was opened from the icon", () => {
    expect(installView({ ...base, standalone: true, hasPrompt: true })).toBe("installed");
  });
  it("explains the editor preview / non-HTTPS case instead of offering install", () => {
    expect(installView({ ...base, editorPreview: true, hasPrompt: true })).toBe("editor");
    expect(installView({ ...base, secure: false })).toBe("editor");
  });
  it("uses the Instalar button when the browser offers installation", () => {
    expect(installView({ ...base, hasPrompt: true })).toBe("prompt");
  });
  it("guides iPhone users to Safari and Adicionar à Tela de Início", () => {
    expect(installView({ ...base, ios: true, iosSafari: true })).toBe("ios-safari");
    expect(installView({ ...base, ios: true, iosSafari: false })).toBe("ios-other");
  });
  it("falls back to the browser menu elsewhere", () => {
    expect(installView(base)).toBe("menu");
  });
  it("recognises editor preview addresses but not the published site", () => {
    expect(isEditorPreviewHost("id-preview--abc.lovable.app", false)).toBe(true);
    expect(isEditorPreviewHost("abc.lovableproject.com", false)).toBe(true);
    expect(isEditorPreviewHost("enigma-prize-spinner.lovable.app", false)).toBe(false);
    expect(isEditorPreviewHost("enigma-prize-spinner.lovable.app", true)).toBe(true);
  });
});
