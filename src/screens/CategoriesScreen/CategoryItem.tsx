import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";

import type { CategoryDto } from "../../../shared/api";
import { colors } from "../../theme";
import { RowName, RowPressable } from "./CategoryItem.styles";

/**
 * One row in the categories list: just the name. Tapping it opens the category's details screen,
 * where it can be renamed, (de)activated and given subcategories. Only the id is passed: the
 * details screen reads the category from Redux, so its changes show up here on return.
 */
export function CategoryItem({ category }: { category: CategoryDto }) {
  const [pressed, setPressed] = useState(false);

  return (
    <RowPressable
      $pressed={pressed}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => router.push(`/category/${category.id}`)}
      accessibilityRole="button"
      accessibilityLabel={category.name}
      testID={`category-row-${category.id}`}
    >
      <RowName numberOfLines={1}>{category.name}</RowName>
      {/* In RTL, "back" points left, which is the forward direction. */}
      <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
    </RowPressable>
  );
}
