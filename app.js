// Signup forms: check the tags against Steam's list, then hand off to Polar's hosted checkout
// with email + tags pre-filled. No server involved.
(function () {
  const cfg = window.RADAR || {};
  const $ = (s, el = document) => el.querySelector(s);
  let tags = null;

  async function loadTags() {
    if (tags) return tags;
    try {
      const r = await fetch(cfg.root + "tags.json");
      tags = await r.json();
    } catch (e) {
      tags = [];
    }
    const dl = $("#steam-tags");
    if (dl && !dl.children.length) dl.innerHTML = tags.map(t => `<option value="${t.replace(/"/g, "&quot;")}">`).join("");
    return tags;
  }

  // "cozy, roguelike deckbuilder" -> ["Cozy", "Roguelike Deckbuilder"] or an error message
  async function checkTags(raw, max) {
    const list = await loadTags();
    const byLower = new Map(list.map(t => [t.toLowerCase(), t]));
    const wanted = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (!wanted.length) return { error: "Pick at least one Steam tag." };
    if (wanted.length > max) return { error: max === 1 ? "The free plan tracks one tag. Pick your main one." : `Up to ${max} tags, please.` };
    const out = [], bad = [];
    for (const w of wanted) {
      const hit = byLower.get(w.toLowerCase());
      hit ? out.push(hit) : bad.push(w);
    }
    if (bad.length && list.length) return { error: `Steam doesn't have a tag called "${bad[0]}". Start typing and pick one from the list.` };
    return { tags: list.length ? out : wanted };
  }

  function go(link, params, errEl, plan) {
    if (!link) {
      // Checkout not live yet: open a prefilled waitlist email instead of a dead end.
      const body = [`Email: ${params.customer_email || ""}`, `Tags: ${params[`custom_field_data.${cfg.fields.tags}`] || ""}`,
                    `Launch date: ${params[`custom_field_data.${cfg.fields.launch}`] || "-"}`, `Plan: ${plan}`].join("\n");
      errEl.textContent = `Checkout opens soon. Opening your mail app so you can join the waitlist (or write to ${cfg.contact}).`;
      window.location.href = `mailto:${cfg.contact}?subject=${encodeURIComponent("Genre Radar waitlist")}&body=${encodeURIComponent(body)}`;
      return;
    }
    const u = new URL(link);
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    window.location.href = u.toString();
  }

  document.addEventListener("focusin", e => { if (e.target.matches("[list=steam-tags]")) loadTags(); });

  const free = $("#free-form");
  if (free) free.addEventListener("submit", async e => {
    e.preventDefault();
    const err = $(".form-error", free);
    err.textContent = "";
    const res = await checkTags(free.tag.value, 1);
    if (res.error) { err.textContent = res.error; return; }
    go(cfg.checkout.free, {
      customer_email: free.email.value.trim(),
      [`custom_field_data.${cfg.fields.tags}`]: res.tags.join(", "),
      utm_source: "site", utm_content: free.dataset.spot || "free",
    }, err, "free");
  });

  const paid = $("#paid-form");
  if (paid) paid.addEventListener("submit", async e => {
    e.preventDefault();
    const err = $(".form-error", paid);
    err.textContent = "";
    const res = await checkTags(paid.tags.value, 5);
    if (res.error) { err.textContent = res.error; return; }
    const yearly = ($("input[name=billing]:checked") || {}).value === "yearly";
    go(yearly ? cfg.checkout.yearly : cfg.checkout.monthly, {
      customer_email: paid.email.value.trim(),
      [`custom_field_data.${cfg.fields.tags}`]: res.tags.join(", "),
      [`custom_field_data.${cfg.fields.launch}`]: paid.launch.value,
      utm_source: "site", utm_content: yearly ? "yearly" : "monthly",
    }, err, yearly ? "paid, yearly" : "paid, monthly");
  });

  // monthly / yearly switch
  document.querySelectorAll("input[name=billing]").forEach(r => r.addEventListener("change", () => {
    const yearly = r.value === "yearly" && r.checked;
    document.querySelectorAll("[data-monthly]").forEach(el => {
      el.innerHTML = yearly ? el.dataset.yearly : el.dataset.monthly;
    });
  }));
})();
