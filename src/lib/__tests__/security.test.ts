import { describe, it, expect } from "vitest";
import { sanitizeInput, sanitizeFields } from "../security";

describe("sanitizeInput (L-03)", () => {
  it("strips simple HTML tags", () => {
    expect(sanitizeInput("<b>hello</b>")).toBe("hello");
    expect(sanitizeInput("<p>paragraph</p>")).toBe("paragraph");
  });

  it("strips script tags and their content entirely", () => {
    // The script regex removes <script>...</script> including inner content
    expect(sanitizeInput('<script>alert("xss")</script>safe')).toBe("safe");
  });

  it("strips nested script tags to prevent bypass", () => {
    // The inner <script>...</script> is stripped; the remaining `<scr` has its
    // `<` entity-escaped to `&lt;scr`
    expect(sanitizeInput('<scr<script>ipt>alert(1)</script>')).toBe("&lt;scr");
  });

  it("strips style tags and their content entirely", () => {
    expect(sanitizeInput('<style>body{color:red}</style>safe')).toBe("safe");
  });

  it("escapes HTML entities", () => {
    // Note: < c > is treated as an HTML tag by the tag stripper (<[^>]+>)
    // so it gets removed. Only standalone & is entity-escaped.
    expect(sanitizeInput("a & b < c > d")).toBe("a &amp; b  d");
    expect(sanitizeInput("a & b")).toBe("a &amp; b");
  });

  it("escapes quotes", () => {
    expect(sanitizeInput('He said "hello" and \'bye\'')).toBe(
      "He said &quot;hello&quot; and &#x27;bye&#x27;"
    );
  });

  it("returns empty string for null/undefined", () => {
    expect(sanitizeInput(null)).toBe("");
    expect(sanitizeInput(undefined)).toBe("");
  });

  it("trims whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeInput("")).toBe("");
  });

  it("handles complex XSS payloads", () => {
    // img tags are stripped (contentless), leaving only the escaped inner text
    expect(sanitizeInput('<img src=x onerror=alert(1)>')).toBe("");
    // iframe tags are stripped, leaving only escaped inner text
    expect(sanitizeInput("<iframe src='javascript:alert(1)'></iframe>")).toBe("");
  });

  it("preserves text without HTML", () => {
    expect(sanitizeInput("Hello World 123")).toBe("Hello World 123");
  });

  it("handles malformed tags gracefully", () => {
    // Malformed tags without > are treated as plain text, then entity-escaped
    expect(sanitizeInput("unclosed <b tag")).toContain("unclosed");
    expect(sanitizeInput("missing close <i")).toContain("missing close");
  });
});

describe("sanitizeFields", () => {
  it("sanitizes specified string fields in an object", () => {
    const data = { name: "<b>John</b>", email: "john@test.com", age: 30 };
    const result = sanitizeFields(data, ["name"]);
    expect(result.name).toBe("John");
    expect(result.email).toBe("john@test.com"); // not sanitized (not in fields list)
    expect(result.age).toBe(30);
  });

  it("sanitizes multiple fields", () => {
    const data = { title: "<script>alert(1)</script>", body: "<p>text</p>" };
    const result = sanitizeFields(data, ["title", "body"]);
    expect(result.title).toBe(""); // script content removed entirely
    expect(result.body).toBe("text");
  });

  it("leaves non-string fields untouched", () => {
    const data = { name: "<b>test</b>", count: 42, active: true };
    const result = sanitizeFields(data, ["name", "count"]);
    expect(result.name).toBe("test");
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });

  it("returns original object when no fields match", () => {
    const data: Record<string, string> = { a: "<b>hello</b>", b: "world" };
    const result = sanitizeFields(data, ["nonexistent"]);
    expect(result.a).toBe("<b>hello</b>");
  });
});
