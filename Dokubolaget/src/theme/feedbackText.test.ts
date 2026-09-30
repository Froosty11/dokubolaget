import { expect, test } from "bun:test";
import { composeFeedbackText } from "./feedbackText";
import { modern } from "./themes/modern";

const copy = modern.copy.en;

test("near miss is prefixed with the theme's title", () => {
  expect(composeFeedbackText({ kind: "near", message: "Spain, but not Red wine." }, copy, () => 0)).toBe(
    "So close! Spain, but not Red wine.",
  );
});

test("correct picks one of the theme's cheers", () => {
  expect(composeFeedbackText({ kind: "correct", message: "" }, copy, () => 0)).toBe("Skål!");
  expect(composeFeedbackText({ kind: "correct", message: "" }, copy, () => 0.99)).toBe("Nailed it!");
});

test("a plain miss keeps the model's message", () => {
  expect(composeFeedbackText({ kind: "miss", message: "Neither A nor B." }, copy, () => 0)).toBe("Neither A nor B.");
});
