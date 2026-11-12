import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import messages from "../client/src/locales/messages.json";
import {
  translate,
  setLanguage,
  getLanguage,
  subscribeLanguage,
  validLanguage,
} from "../client/src/i18n";

test("Spanish and Portuguese catalogs cover interface strings and preserve placeholders", () => {
  const catalog = messages as Record<string, { es: string; pt: string }>;
  const placeholders = (s: string) =>
    [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [english, translations] of Object.entries(catalog)) {
    for (const language of ["es", "pt"] as const) {
      assert.ok(translations[language].trim(), `${language}: ${english}`);
      assert.deepEqual(
        placeholders(translations[language]),
        placeholders(english),
        `${language}: ${english}`,
      );
    }
  }
  for (const name of [
    "main",
    "pages",
    "account",
    "maps",
    "ui",
    "language",
    "i18n",
  ]) {
    const filename = `client/src/${name}.${name === "i18n" ? "ts" : "tsx"}`;
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

test("translation interpolation, fallback, and locale selection", () => {
  assert.equal(translate("Sign the petition", "es"), "Firmar la petición");
  assert.equal(translate("Sign the petition", "pt"), "Assinar a petição");
  assert.equal(translate(" Sign the petition ", "es"), " Firmar la petición ");
  assert.equal(
    translate("{count} selected", "pt", { count: 3 }),
    "3 selecionados",
  );
  assert.equal(translate("María's own story", "pt"), "María's own story");
  assert.equal(validLanguage("fr"), false);
  let changes = 0;
  const unsubscribe = subscribeLanguage(() => changes++);
  setLanguage("es");
  assert.equal(getLanguage(), "es");
  setLanguage("pt");
  assert.equal(getLanguage(), "pt");
  assert.equal(changes, 2);
  unsubscribe();
  setLanguage("en");
  assert.equal(changes, 2);
});
