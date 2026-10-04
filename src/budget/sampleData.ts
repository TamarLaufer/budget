import { strings } from "../strings/he";
import { shekelsToAgorot } from "./money";
import type { BudgetCategory } from "./types";

export const sampleCategories: BudgetCategory[] = [
  {
    id: "food",
    name: strings.CATEGORY_NAMES.FOOD,
    budget: shekelsToAgorot(3000),
    spent: shekelsToAgorot(2400),
  },
  {
    id: "entertainment",
    name: strings.CATEGORY_NAMES.ENTERTAINMENT,
    budget: shekelsToAgorot(800),
    spent: shekelsToAgorot(950),
  },
  {
    id: "transport",
    name: strings.CATEGORY_NAMES.TRANSPORT,
    budget: shekelsToAgorot(1000),
    spent: shekelsToAgorot(700),
  },
];
