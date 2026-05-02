import { useEffect, useState } from "react";
import { G, subscribe } from "../logic/engine";

export function useGameState() {
  const [state, setState] = useState(() => ({ ...G }));

  useEffect(() => {
    return subscribe(() => {
      setState({ ...G });
    });
  }, []);

  return state;
}
