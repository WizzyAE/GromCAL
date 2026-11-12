// API credentials are supplied by the person using this device. No defaults.
function GromConfiguredApi(state) {
  const settings = state.settings || {};
  const provider = settings.aiProvider;
  if (GromSessionApi && GromSessionApi.provider === provider) return true;
  const key = provider === "openai" ? settings.openaiKey : provider === "gemini" ? settings.apiKey : "";
  return settings.apiSetupVersion === 1 && typeof key === "string" && key.trim().length > 0;
}

function GromApiErrorMessage(status) {
  if (status === 401 || status === 403) return "Ključ nije prihvaćen ili nema pristup modelu. Provjeri svoj API račun i dozvole ključa.";
  if (status === 429) return "Dosegnut je limit ili nema dostupne kvote. Provjeri potrošnju i naplatu na svom API računu pa pokušaj ponovno.";
  if (status >= 500) return "AI servis je trenutno nedostupan. Pokušaj ponovno kasnije.";
  if (status === 404) return "Odabrani model više nije dostupan. Ponovno provjeri ključ u Profilu → Tvoj API ključ.";
  return "AI zahtjev nije uspio. Provjeri svoj API račun i pokušaj ponovno.";
}

async function GromApiFetch(url, key, provider, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET", signal: controller.signal,
      headers: {
        ...(body ? {"Content-Type": "application/json"} : {}),
        ...(provider === "openai" ? {Authorization: "Bearer " + key} : {"x-goog-api-key": key})
      },
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    if (!response.ok) {
      const error = new Error(GromApiErrorMessage(response.status));
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.status) throw error;
    throw new Error(error.name === "AbortError" ? "AI predugo odgovara. Pokušaj ponovno." : "Nije moguće povezati se s AI servisom. Provjeri internetsku vezu.");
  } finally { clearTimeout(timer); }
}

async function GromGenerate(provider, key, model, text, image, instruction) {
  if (provider === "openai") {
    const content = [{type: "text", text}];
    if (image) content.unshift({type: "image_url", image_url: {url: "data:image/jpeg;base64," + image}});
    const body = {model, response_format: {type: "json_object"}, messages: [{role: "system", content: instruction}, {role: "user", content}]};
    if (model.startsWith("gpt-5")) body.reasoning_effort = "low";
    else body.temperature = .2;
    const result = await GromApiFetch("https://api.openai.com/v1/chat/completions", key, provider, body);
    return Kd(result.choices?.[0]?.message?.content || "");
  }
  const parts = [{text}];
  if (image) parts.unshift({inline_data: {mime_type: "image/jpeg", data: image}});
  const result = await GromApiFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, key, provider, {
    contents: [{role: "user", parts}], systemInstruction: {parts: [{text: instruction}]},
    generationConfig: {responseMimeType: "application/json", temperature: .2}
  });
  return Kd(result.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "");
}

async function GromVerifyKey(provider, key) {
  if (!key || key.length < 16 || /\s/.test(key)) throw new Error("Unesi cijeli vlastiti API ključ, bez razmaka.");
  const url = provider === "openai" ? "https://api.openai.com/v1/models" : "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
  const catalog = await GromApiFetch(url, key, provider);
  const available = provider === "openai"
    ? (catalog.data || []).map(model => model.id).filter(id => /^gpt-/.test(id) && !/audio|realtime|image|search|transcribe|tts/.test(id))
    : (catalog.models || []).filter(model => model.supportedGenerationMethods?.includes("generateContent")).map(model => model.name.replace(/^models\//, "")).filter(id => /^gemini-/.test(id) && !/audio|tts|image|robot|computer/.test(id));
  const preferred = provider === "openai" ? eh : th;
  const models = [...new Set([...preferred.filter(model => available.includes(model)), ...available])].slice(0, 3);
  if (!models.length) throw new Error("Ovaj ključ nema dostupan podržani model za analizu. Provjeri dozvole svojeg API računa.");
  let lastError;
  for (const model of models) {
    try {
      const result = await GromGenerate(provider, key, model, 'Vrati isključivo JSON objekt {"ok":true}.', null, "Provjeri vezu. Odgovori valjanim JSON objektom.");
      if (result?.ok !== true) throw new Error("AI nije potvrdio vezu. Pokušaj ponovno.");
      return {model, models};
    } catch (error) {
      lastError = error;
      if (![400, 404].includes(error.status)) throw error;
    }
  }
  throw lastError;
}

async function GromRunAi(text, image, instruction) {
  const state = on();
  if (!GromConfiguredApi(state)) throw new Error("Prvo unesi i provjeri vlastiti API ključ.");
  const {aiProvider: provider} = state.settings;
  const session = GromSessionApi?.provider === provider ? GromSessionApi : null;
  const model = session?.model || state.settings.aiModel;
  const key = session?.key || (provider === "openai" ? state.settings.openaiKey : state.settings.apiKey).trim();
  if (!model) throw new Error("Ponovno provjeri svoj ključ u Profilu → Tvoj API ključ.");
  return GromGenerate(provider, key, model, text, image, Wd + instruction);
}

function GromApiSettings({required = false}) {
  const state = Wt();
  const [provider, setProvider] = L.useState(state.settings.aiProvider || "openai");
  const [key, setKey] = L.useState("");
  const [busy, setBusy] = L.useState(false);
  const [error, setError] = L.useState("");
  const [saved, setSaved] = L.useState(false);
  const [remember, setRemember] = L.useState(true);
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const clean = key.trim();
      const verified = await GromVerifyKey(provider, clean);
      if (remember) {
        // Fail visibly if this device cannot remember a key. Never silently
        // claim persistence after the app store's optional write fails.
        const probe = "gromcal.api-storage-test";
        try {localStorage.setItem(probe, "1"); localStorage.removeItem(probe);}
        catch {throw new Error("Uređaj ne dopušta spremanje ključa. Isključi opciju ‘Zapamti ključ’ i pokušaj ponovno.");}
      }
      GromSessionApi = remember ? null : {provider, key: clean, ...verified};
      Ue(current => ({...current, settings: {
        ...current.settings, apiSetupVersion: 1, aiProvider: provider, aiModel: verified.model,
        apiKey: remember && provider === "gemini" ? clean : "",
        openaiKey: remember && provider === "openai" ? clean : ""
      }}));
      setKey(""); setSaved(true);
    } catch (failure) {setError(failure.message || "Ključ nije spremljen. Pokušaj ponovno.");}
    finally {setBusy(false);}
  };
  return l.jsxs("form", {className: "grom-api-form", onSubmit: submit, children: [
    l.jsx("h2", {children: required ? "Poveži svoj AI" : "Tvoj API ključ"}),
    l.jsx("p", {className: "sub", children: "Za korištenje GromCAL-a unesi vlastiti OpenAI ili Gemini API ključ. Troškove i kvotu određuje tvoj API račun."}),
    !required && GromConfiguredApi(state) && l.jsx("p", {className: "grom-api-connected", children: `Povezano: ${state.settings.aiProvider === "openai" ? "OpenAI" : "Gemini"}`}),
    l.jsxs("label", {children: ["AI servis", l.jsxs("select", {"aria-label": "AI servis", value: provider, disabled: busy, onChange: event => {setProvider(event.target.value); setError(""); setSaved(false);}, children: [l.jsx("option", {value: "openai", children: "OpenAI"}), l.jsx("option", {value: "gemini", children: "Google Gemini"})]})]}),
    l.jsxs("label", {children: ["Vlastiti API ključ", l.jsx("input", {type: "password", value: key, disabled: busy, autoComplete: "off", autoCapitalize: "none", spellCheck: false, placeholder: "Zalijepi svoj API ključ", onChange: event => {setKey(event.target.value); setError(""); setSaved(false);}})]}),
    l.jsxs("label", {className: "grom-api-remember", children: [l.jsx("input", {type: "checkbox", checked: remember, disabled: busy, onChange: event => setRemember(event.target.checked)}), "Zapamti ključ na ovom uređaju"]}),
    l.jsx("p", {className: "sub", children: remember ? "Ključ se sprema u lokalnu pohranu aplikacije na ovom uređaju. Koristi samo svoj pouzdani uređaj." : "Ključ ostaje samo u memoriji do zatvaranja aplikacije."}),
    l.jsx("p", {className: "sub", children: "Ključ i tvoji AI zahtjevi šalju se izravno odabranom servisu. Provjera šalje kratak AI zahtjev koji može biti naplaćen."}),
    error && l.jsx("div", {className: "err", role: "alert", children: error}),
    saved && l.jsx("p", {role: "status", className: "grom-api-connected", children: "Veza je provjerena i ključ je spremljen."}),
    l.jsx("button", {type: "submit", className: "btn", disabled: busy || !key.trim(), children: busy ? "Provjeravam vezu…" : "Provjeri i poveži"}),
    l.jsx("a", {href: provider === "openai" ? "https://platform.openai.com/api-keys" : "https://aistudio.google.com/apikey", target: "_blank", rel: "noopener noreferrer", children: provider === "openai" ? "Napravi vlastiti OpenAI ključ ↗" : "Napravi vlastiti Gemini ključ ↗"})
  ]});
}

let GromSessionApi = null;
function GromAppRoot() {
  const state = Wt();
  return GromConfiguredApi(state) ? l.jsx(Rh, {}) : l.jsx("main", {className: "grom-api-gate", children: l.jsxs("div", {className: "card", children: [
    l.jsxs("div", {className: "logo", children: ["Grom", l.jsx("span", {children: "CAL"})]}),
    l.jsx(GromApiSettings, {required: true})
  ]})});
}
