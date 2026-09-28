import { createCn } from "cn/config";

// Teach the class merger the custom radius tokens from app/globals.css, so
// `cn("rounded-card", "rounded-none")` resolves to the last one.
export const cn = createCn({
  extend: {
    theme: {
      radius: ["control", "card"],
    },
  },
});
