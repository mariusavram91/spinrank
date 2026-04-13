import { buildLanguageSwitch } from "../../../src/ui/shared/components/languageSwitch";
import { getCurrentLanguage, setLanguage } from "../../../src/ui/shared/i18n/runtime";

describe("language switch", () => {
  afterEach(() => {
    setLanguage("en");
  });

  it("dispatches a selection event with the chosen language", () => {
    const { element } = buildLanguageSwitch();
    const handler = vi.fn();

    element.addEventListener("spinrank:language-select", handler);

    const trigger = element.querySelector<HTMLButtonElement>('[data-testid="language-switch-trigger"]');
    const deOption = element.querySelector<HTMLButtonElement>('[data-testid="language-option-de"]');

    expect(trigger).not.toBeNull();
    expect(deOption).not.toBeNull();

    trigger?.click();
    deOption?.click();

    expect(getCurrentLanguage()).toBe("de");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
    expect((handler.mock.calls[0]?.[0] as CustomEvent<{ language: string }>).detail).toEqual({ language: "de" });
  });
});
