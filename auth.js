const CLIENT_ID = "TON_CLIENT_ID_GITHUB";
const REDIRECT_URI = "https://TON_USER.github.io/TON_REPO/callback.html";
const ALLOWED_USER = "TON_USERNAME_GITHUB";

// utils PKCE
function base64urlencode(str) {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return base64urlencode(buf);
}

function randomString(len = 64) {
  return [...crypto.getRandomValues(new Uint8Array(len))]
    .map(b => ("0" + (b & 255).toString(16)).slice(-2)).join("");
}

async function login() {
  const verifier = randomString();
  const challenge = await sha256(verifier);

  sessionStorage.setItem("verifier", verifier);

  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "read:user",
    state: randomString(16),
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  location.href = url;
}

async function handleCallback() {
  const code = new URLSearchParams(location.search).get("code");
  const verifier = sessionStorage.getItem("verifier");

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Accept": "application/json" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier
    })
  });

  const data = await res.json();
  localStorage.setItem("token", data.access_token);

  const user = await fetch("https://api.github.com/user", {
    headers: { Authorization: `token ${data.access_token}` }
  }).then(r => r.json());

  if (user.login !== ALLOWED_USER) {
    document.body.innerHTML = "⛔ Accès refusé";
    return;
  }

  location.href = "app.html";
}

function requireAuth() {
  const token = localStorage.getItem("token");
  if (!token) location.href = "index.html";
}
