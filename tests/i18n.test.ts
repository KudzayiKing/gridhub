import { describe, expect, it } from "vitest";
import { translate, UI_LANGUAGES, TOOL_DASHBOARD_TRANSLATION_KEYS, PUBLIC_PAGE_TRANSLATION_KEYS, ADMIN_TRANSLATION_KEYS } from "@/lib/i18n";

describe("fixed interface translations", () => {
  it("provides stable localized billing and plan labels for every supported language", () => {
    const labels = [
      "Billing",
      "Subscription",
      "Single",
      "Unlimited",
      "Current plan",
      "Manage billing",
      "Choose the plan that fits the tools you actually use. Annual billing is charged upfront.",
      "Choose",
      "How tool selection works",
      "All 16 tools",
      "No tool-swap limits",
      "Everything included",
    ];
    for (const language of UI_LANGUAGES.filter((item) => item.code !== "en")) {
      for (const label of labels) expect(translate(label, language.code)).not.toBe(label);
    }
  });

  it("uses natural Russian labels for the billing screen and tool navigation", () => {
    expect(translate("Billing", "ru")).toBe("Оплата");
    // Plan names are localised everywhere they appear, including inside the billing prose.
    expect(translate("Single", "ru")).toBe("Сингл");
    expect(translate("Plus", "ru")).toBe("Плюс");
    expect(translate("Pro", "ru")).toBe("Про");
    expect(translate("Unlimited", "ru")).toBe("Безлимит");
    expect(translate("Single includes any one paid tool, Plus three, Pro six, Unlimited all sixteen.", "ru")).not.toMatch(
      /Single|Plus|Pro|Unlimited/,
    );
    expect(translate("Money", "ru")).toBe("Деньги");
    expect(translate("Wedding", "ru")).toBe("Свадьба");
    expect(translate("Property", "ru")).toBe("Недвижимость");
    expect(translate("Nutrition", "ru")).toBe("Питание");
    expect(translate("Content", "ru")).toBe("Контент");
  });

  it("localizes every tool dashboard heading, KPI, and empty state in every supported language", () => {
    for (const language of UI_LANGUAGES.filter((item) => item.code !== "en")) {
      for (const label of TOOL_DASHBOARD_TRANSLATION_KEYS) {
        expect(translate(label, language.code), `${language.code}: ${label}`).not.toBe(label);
      }
    }
  });

  it("keeps core workspace and assistant settings localized", () => {
    const labels = [
      "Your workspace",
      "Billing is not configured in this environment",
      "Capability",
      "Storage",
      "Gridhub AI responds in English. Changing your interface language does not change AI responses.",
      "Keep history for",
    ];
    for (const language of UI_LANGUAGES.filter((item) => item.code !== "en")) {
      for (const label of labels) {
        expect(translate(label, language.code), `${language.code}: ${label}`).not.toBe(label);
      }
    }
  });

  it("localizes the public pages and shared app controls", () => {
    for (const language of UI_LANGUAGES.filter((item) => item.code !== "en")) {
      for (const label of PUBLIC_PAGE_TRANSLATION_KEYS) {
        expect(translate(label, language.code), `${language.code}: ${label}`).not.toBe(label);
      }
    }
  });

  it("localizes the admin and Journal editorial surfaces", () => {
    for (const language of UI_LANGUAGES.filter((item) => item.code !== "en")) {
      for (const label of ADMIN_TRANSLATION_KEYS) {
        expect(translate(label, language.code), `${language.code}: ${label}`).not.toBe(label);
      }
    }
  });
});
