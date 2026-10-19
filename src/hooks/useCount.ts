import { useCallback, useState } from "react";

export const useCount = (initial = 0) => {
  const [count, setCount] = useState(initial);

  const increment = useCallback(() => setCount((c) => c + 1), []);
  const decrement = useCallback(() => setCount((c) => c - 1), []);

  return {
    count,
    increment,
    decrement,
  };
};
