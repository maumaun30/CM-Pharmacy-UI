"use client";

import { useEffect, useRef, useState } from "react";

// Google Identity Services (GIS) — ID token model. renderButton() draws Google's
// brand-compliant button and fires `callback` with a `credential` (a signed ID
// token JWT). That token is what the API verifies at /auth/google[/link].
// We deliberately do NOT use the OAuth token model (oauth2.initTokenClient),
// which returns an access token the backend can't verify the same way.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface GoogleIdConfig {
  client_id: string;
  callback: (resp: { credential?: string }) => void;
}
interface GoogleButtonOptions {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "small" | "medium" | "large";
  width?: number;
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill";
  logo_alignment?: "left" | "center";
}
interface GoogleAccountsId {
  initialize: (config: GoogleIdConfig) => void;
  renderButton: (el: HTMLElement, options: GoogleButtonOptions) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

// Load the GIS script exactly once across the whole app.
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

interface Props {
  /** Called with the Google ID token (JWT) once the user completes sign-in. */
  onCredential: (idToken: string) => void;
  text?: GoogleButtonOptions["text"];
  /** Fixed pixel width of Google's button (max 400). */
  width?: number;
}

export default function GoogleSignInButton({
  onCredential,
  text = "continue_with",
  width = 320,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-initializing GIS on every render.
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !divRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => {
            if (resp.credential) cbRef.current(resp.credential);
          },
        });
        // Clear first so React StrictMode's double-mount can't stack two buttons.
        divRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(divRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          logo_alignment: "center",
          width,
          text,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [text, width]);

  if (!CLIENT_ID) {
    return (
      <p className="text-xs text-center text-gray-400">
        Google sign-in is not configured
      </p>
    );
  }
  if (failed) {
    return (
      <p className="text-xs text-center text-red-400">
        Could not load Google sign-in
      </p>
    );
  }
  return <div ref={divRef} className="flex justify-center" />;
}
