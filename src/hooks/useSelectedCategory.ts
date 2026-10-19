import { useState } from "react";

/** UI-only selection state for the dashboard's category cards. */
export const useSelectedCategory = () => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const categorySetState = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  const clearSelectedId = () => {
    setSelectedCategoryId(null);
  };

  return {
    selectedCategoryId,
    categorySetState,
    clearSelectedId,
  };
};
