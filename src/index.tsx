/* @refresh reload */
import { render } from "solid-js/web";
import { init as initNostrLogin } from "nostr-login";
import "./index.css";
import App from "./App";

const root = document.getElementById("root");
initNostrLogin({
  /*options*/
});
if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?"
  );
}
render(() => <App />, root!);
