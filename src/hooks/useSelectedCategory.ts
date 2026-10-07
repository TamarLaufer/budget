import { useState } from "react"
import { BudgetCategory } from "../budget/types"

export const useSelectedCategory = (categories: BudgetCategory[])=>{
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  
  const categorySetState = (categoryId: string | null) =>{
    setSelectedCategoryId(categoryId)
  }

  const clearSelectedId = ()=>{
    setSelectedCategoryId(null)
  }

  return {
    selectedCategoryId,
    categorySetState,
    clearSelectedId
  }
}