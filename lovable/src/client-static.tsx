import { startTransition } from "react";
import { createRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

// Static hosting sends the same route-neutral shell for every URL. Render the
// document on the client rather than hydrate route-specific server markup.
startTransition(() => {
  createRoot(document).render(<StartClient />);
});
