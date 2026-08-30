import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Returns false on the server and during the client's first render (so it
// matches the server-rendered HTML), then true after hydration completes —
// the React-recommended replacement for the `useEffect(() => setState(true))`
// "mounted" idiom, which this project's lint config forbids
// (react-hooks/set-state-in-effect).
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
