import { BudgetCategory } from "../budget/types"

export const useMonthlyBudgetSummary = (categories: BudgetCategory[])=>{

    const totalBudget = categories.reduce((acc, item)=>{
        return acc + item.budget;
    }, 0)

    const totalSpent = categories.reduce((acc, item)=>{
        return acc + item.spent;
    }, 0) 

    const remaining = totalBudget - totalSpent


    return {
        totalBudget,
        totalSpent,
        remaining
    }
}