import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { policyEvents, participation } from "../shared/campaign";
import { policies } from "../shared/policies";
import background from "../client/src/features/policy/petition-timeline.en.json";
import families from "../client/src/features/policy/humanitarian-cases.en.json";
import messages from "../client/src/i18n/locales/messages.json";
import arabic from "../client/src/i18n/locales/ar.json";
import bengali from "../client/src/i18n/locales/bn.json";
import vietnamese from "../client/src/i18n/locales/vi.json";
import traditionalChinese from "../client/src/i18n/locales/zh-Hant.json";
import {
  translate,
  setLanguage,
  getLanguage,
  getLocale,
  subscribeLanguage,
  validLanguage,
  languageDirection,
  languageNames,
} from "../client/src/i18n/i18n";

test("All language catalogs cover interface strings and preserve placeholders", () => {
  const catalog = messages as Record<
    string,
    { es: string; pt: string; tl: string }
  >;
  const placeholders = (s: string) =>
    [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const additions: Record<string, Record<string, string>> = {
    ar: arabic,
    bn: bengali,
    vi: vietnamese,
    "zh-Hant": traditionalChinese,
  };
  for (const [language, translations] of Object.entries(additions)) {
    assert.deepEqual(
      Object.keys(translations).sort(),
      Object.keys(catalog).sort(),
      `${language}: key coverage`,
    );
    for (const [english, translation] of Object.entries(translations)) {
      assert.ok(translation.trim(), `${language}: ${english}`);
      assert.deepEqual(
        placeholders(translation),
        placeholders(english),
        `${language}: ${english}`,
      );
    }
  }
  for (const [english, translations] of Object.entries(catalog)) {
    for (const language of ["es", "pt", "tl"] as const) {
      assert.ok(translations[language].trim(), `${language}: ${english}`);
      assert.deepEqual(
        placeholders(translations[language]),
        placeholders(english),
        `${language}: ${english}`,
      );
    }
  }
  for (const path of readdirSync("client/src", {
    recursive: true,
    encoding: "utf8",
  })) {
    if (!/\.tsx?$/.test(path)) continue;
    const filename = `client/src/${path}`;
    const source = ts.createSourceFile(
      filename,
      readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "t" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const key = node.arguments[0].text.replace(/\s+/g, " ").trim();
        assert.ok(key in catalog, `${filename}: missing ${key}`);
      }
      if (ts.isJsxText(node))
        assert.ok(
          !/[A-Za-z]/.test(node.text),
          `${filename}: untranslated JSX ${node.text.trim()}`,
        );
      if (
        ts.isJsxAttribute(node) &&
        ["value", "key"].includes(node.name.getText(source))
      ) {
        assert.ok(
          !/\bt\(/.test(node.initializer?.getText(source) || ""),
          `${filename}: translating a stored value or React key`,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});

test("translation interpolation, fallback, and locale selection", async () => {
  for (const lang of ["es", "pt", "tl"] as const) await setLanguage(lang);
  assert.equal(translate("Sign the petition", "es"), "Firmar la petición");
  assert.equal(translate("Sign the petition", "pt"), "Assinar a petição");
  assert.equal(translate(" Sign the petition ", "es"), " Firmar la petición ");
  assert.equal(
    translate("{count} selected", "pt", { count: 3 }),
    "3 selecionados",
  );
  assert.equal(translate("María's own story", "pt"), "María's own story");
  assert.equal(translate("Sign the petition", "tl"), "Lagdaan ang petisyon");
  assert.equal(
    translate("{count} selected", "tl", { count: 3 }),
    "3 ang napili",
  );
  assert.equal(translate("My personal story", "tl"), "My personal story");
  assert.equal(validLanguage("tl"), true);
  assert.equal(validLanguage("fr"), false);
  let changes = 0;
  const unsubscribe = subscribeLanguage(() => changes++);
  await setLanguage("es");
  assert.equal(getLanguage(), "es");
  await setLanguage("pt");
  assert.equal(getLanguage(), "pt");
  assert.equal(changes, 2);
  await setLanguage("tl");
  assert.equal(getLanguage(), "tl");
  assert.equal(getLocale(), "fil-PH");
  assert.equal(changes, 3);
  for (const lang of ["ar", "bn", "vi", "zh-Hant"] as const) {
    assert.equal(validLanguage(lang), true);
    await setLanguage(lang);
    assert.equal(getLanguage(), lang);
    assert.equal(getLocale(), lang);
    assert.notEqual(translate("Sign the petition", lang), "Sign the petition");
    assert.equal(translate("My personal story", lang), "My personal story");
    assert.ok(translate("{count} selected", lang, { count: 3 }).includes("3"));
    assert.equal(languageDirection(lang), lang === "ar" ? "rtl" : "ltr");
  }
  assert.equal(translate("Sign the petition", "vi"), "Ký kiến nghị");
  assert.equal(validLanguage("zh"), false);
  assert.equal(validLanguage("toString"), false);
  assert.equal(Object.keys(languageNames).length, 8);
  assert.equal(changes, 7);
  unsubscribe();
  await setLanguage("en");
  assert.equal(changes, 7);
});

// These strings are passed dynamically to t(), so the JSX literal scan cannot see them.
test("campaign events and participation copy are included in every catalog", () => {
  const keys = [
    background.heading,
    ...Object.values(background.intro),
    ...background.periods.flatMap((period) => [
      period.label,
      ...period.events.flatMap((event) => [
        event.title,
        event.body,
        ...event.sources.map((source) => source.label),
      ]),
    ]),
    families.heading,
    ...families.cases.flatMap((item) => [
      item.name,
      item.title,
      item.detail,
      item.source.label,
      ...(item.note ? [item.note] : []),
    ]),
    ...policyEvents.flatMap((e) => [
      e.kind,
      e.title,
      e.text,
      e.status,
      e.source.label,
    ]),
    ...participation.flatMap((p) => [p.title, p.text, p.action]),
    ...policies.flatMap((p) => [
      p.title,
      p.status,
      p.summary,
      p.background,
      ...p.goals,
      ...p.timeline.flatMap((e) => [e.title, e.text]),
      ...p.sources.map((s) => s.label),
      ...(p.contribute ? [p.contribute] : []),
    ]),
  ];
  for (const key of keys)
    assert.ok(key in messages, `Missing translation: ${key}`);
});

// Direction must also reset when a reader returns from Arabic to another language.
test("language changes update document language, direction and title", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  const document = { documentElement: { lang: "", dir: "" }, title: "" };
  Object.defineProperty(globalThis, "document", {
    value: document,
    configurable: true,
  });
  try {
    for (const lang of ["ar", "bn", "vi", "zh-Hant", "en"] as const) {
      await setLanguage(lang);
      assert.equal(
        document.documentElement.lang,
        lang === "en" ? "en-US" : lang,
      );
      assert.equal(document.documentElement.dir, lang === "ar" ? "rtl" : "ltr");
      assert.equal(
        document.title,
        `Reunite Now — ${translate("Visa processing needs to change.", lang)}`,
      );
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
    await setLanguage("en");
  }
});
