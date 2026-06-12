const client = window.supabaseClient;

const state = {
  profile: null,
  assets: [],
  tickets: [],
  users: [],
  auditLogs: [],
  activeSection: null
};

const ROLES = [
  { value: "customer", label: "Customer / Asset Owner" },
  { value: "admin", label: "Admin" },
  { value: "approver", label: "Approver" },
  { value: "technician", label: "Technician" },
  { value: "auditor", label: "Auditor" }
];

const SECTION_IDS = [
  "customerSection",
  "adminSection",
  "workflowSection",
  "reportsSection",
  "auditSection",
  "myRecordsSection"
];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function roleLabel(role) {
  return ROLES.find((item) => item.value === role)?.label || role;
}

function setStatus(message, type = "info") {
  if (!message) return;
  const prefix = type === "error" ? "Error: " : "";
  alert(prefix + message);
}

function isConfigured() {
  return Boolean(window.CADTS_SUPABASE_CONFIGURED);
}

async function init() {
  if (!isConfigured()) {
    $("setupWarning").classList.remove("hidden");
  }

  bindForms();
  bindGlobalButtons();

  const { data } = await client.auth.getSession();
  if (data.session) {
    await loadDashboard();
  } else {
    showAuthView();
  }

  client.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await loadDashboard();
    } else {
      showAuthView();
    }
  });
}

function bindForms() {
  $("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await signIn($("loginEmail").value.trim(), $("loginPassword").value);
  });

  $("registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await signUp(
      $("registerFullName").value.trim(),
      $("registerEmail").value.trim(),
      $("registerPassword").value
    );
  });

  $("assetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await createAsset();
  });

  $("ticketForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await createTicket();
  });
}

function bindGlobalButtons() {
  $("logoutButton").addEventListener("click", signOut);
  $("exportTicketsButton").addEventListener("click", exportTicketsCsv);
}

async function signUp(fullName, email, password) {
  if (!isConfigured()) {
    setStatus("Supabase is not configured yet. Update supabase-config.js first.", "error");
    return;
  }

  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  $("registerForm").reset();
  setStatus("Account created. New accounts start as Customer / Asset Owner. Log in with the new account.");
}

async function signIn(email, password) {
  if (!isConfigured()) {
    setStatus("Supabase is not configured yet. Update supabase-config.js first.", "error");
    return;
  }

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    setStatus(error.message, "error");
  }
}

async function signOut() {
  await client.auth.signOut();
  showAuthView();
}

function showAuthView() {
  state.profile = null;
  $("authView").classList.remove("hidden");
  $("dashboardView").classList.add("hidden");
  $("logoutButton").classList.add("hidden");
}

async function loadDashboard() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    showAuthView();
    return;
  }

  state.profile = profile;
  $("authView").classList.add("hidden");
  $("dashboardView").classList.remove("hidden");
  $("logoutButton").classList.remove("hidden");

  $("profileName").textContent = profile.full_name || profile.email;
  $("profileEmail").textContent = profile.email;
  $("profileRole").textContent = roleLabel(profile.role);

  renderNavigation(profile.role);
  await refreshAllData();

  const defaultSection = getDefaultSection(profile.role);
  showSection(state.activeSection || defaultSection);
}

async function getCurrentUserProfile() {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("id", userData.user.id)
    .single();

  if (error) {
    console.error(error);
    setStatus("Could not load the user profile. Confirm the database SQL was installed in Supabase.", "error");
    return null;
  }

  return data;
}

function getDefaultSection(role) {
  if (role === "customer") return "customerSection";
  if (role === "admin") return "adminSection";
  if (role === "approver" || role === "technician") return "workflowSection";
  if (role === "auditor") return "auditSection";
  return "myRecordsSection";
}

function allowedSections(role) {
  const sections = [
    { id: "myRecordsSection", label: "My Records", roles: ["customer", "admin", "approver", "technician", "auditor"] },
    { id: "customerSection", label: "Customer Requests", roles: ["customer"] },
    { id: "adminSection", label: "User Management", roles: ["admin"] },
    { id: "workflowSection", label: "Workflow Queue", roles: ["admin", "approver", "technician"] },
    { id: "reportsSection", label: "Reports", roles: ["admin", "auditor"] },
    { id: "auditSection", label: "Audit Logs", roles: ["admin", "auditor"] }
  ];
  return sections.filter((section) => section.roles.includes(role));
}

function renderNavigation(role) {
  const nav = $("roleNav");
  nav.innerHTML = "";

  allowedSections(role).forEach((section) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = section.label;
    button.dataset.sectionId = section.id;
    button.addEventListener("click", () => showSection(section.id));
    nav.appendChild(button);
  });
}

function showSection(sectionId) {
  state.activeSection = sectionId;
  SECTION_IDS.forEach((id) => $(id).classList.add("hidden"));
  $(sectionId).classList.remove("hidden");

  document.querySelectorAll("#roleNav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionId === sectionId);
  });

  if (sectionId === "customerSection") renderCustomerForms();
  if (sectionId === "adminSection") renderUsersTable();
  if (sectionId === "workflowSection") renderWorkflowQueue();
  if (sectionId === "reportsSection") renderReports();
  if (sectionId === "auditSection") renderAuditLogs();
  if (sectionId === "myRecordsSection") renderMyRecords();
}

async function refreshAllData() {
  await Promise.all([
    loadAssets(),
    loadTickets(),
    state.profile.role === "admin" ? loadUsers() : Promise.resolve(),
    ["admin", "auditor"].includes(state.profile.role) ? loadAuditLogs() : Promise.resolve()
  ]);
}

async function loadAssets() {
  const { data, error } = await client
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    state.assets = [];
    return;
  }
  state.assets = data || [];
}

async function loadTickets() {
  const { data, error } = await client
    .from("destruction_tickets")
    .select("*, assets(asset_tag, asset_type, description), customer:profiles!destruction_tickets_customer_id_fkey(email, full_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    state.tickets = [];
    return;
  }
  state.tickets = data || [];
}

async function loadUsers() {
  const { data, error } = await client
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("email", { ascending: true });

  if (error) {
    console.error(error);
    state.users = [];
    return;
  }
  state.users = data || [];
}

async function loadAuditLogs() {
  const { data, error } = await client
    .from("audit_logs")
    .select("*, actor:profiles(email, full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error);
    state.auditLogs = [];
    return;
  }
  state.auditLogs = data || [];
}

async function createAsset() {
  if (!state.profile || state.profile.role !== "customer") {
    setStatus("Only Customer / Asset Owner accounts can register assets.", "error");
    return;
  }

  const payload = {
    owner_id: state.profile.id,
    asset_tag: $("assetTag").value.trim(),
    asset_type: $("assetType").value,
    description: $("assetDescription").value.trim(),
    status: "Active"
  };

  const { data, error } = await client.from("assets").insert(payload).select().single();
  if (error) {
    setStatus(error.message, "error");
    return;
  }

  await logAction("Created asset", "assets", data.id, { asset_tag: payload.asset_tag });
  $("assetForm").reset();
  await refreshAllData();
  renderCustomerForms();
  renderMyRecords();
  setStatus("Asset registered.");
}

async function createTicket() {
  if (!state.profile || state.profile.role !== "customer") {
    setStatus("Only Customer / Asset Owner accounts can create destruction tickets.", "error");
    return;
  }

  const assetId = $("ticketAssetId").value;
  const payload = {
    asset_id: assetId,
    customer_id: state.profile.id,
    request_reason: $("requestReason").value.trim(),
    status: "Submitted"
  };

  const { data, error } = await client.from("destruction_tickets").insert(payload).select().single();
  if (error) {
    setStatus(error.message, "error");
    return;
  }

  await client.from("assets").update({ status: "Pending Destruction" }).eq("id", assetId);
  await logAction("Created destruction ticket", "destruction_tickets", data.id, { asset_id: assetId });
  $("ticketForm").reset();
  await refreshAllData();
  renderCustomerForms();
  renderMyRecords();
  setStatus("Destruction ticket submitted.");
}

function renderCustomerForms() {
  const assetSelect = $("ticketAssetId");
  assetSelect.innerHTML = "";

  const availableAssets = state.assets.filter((asset) => asset.owner_id === state.profile.id && asset.status !== "Destroyed");

  if (availableAssets.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Register an asset first";
    assetSelect.appendChild(option);
    assetSelect.disabled = true;
    return;
  }

  assetSelect.disabled = false;
  availableAssets.forEach((asset) => {
    const option = document.createElement("option");
    option.value = asset.id;
    option.textContent = `${asset.asset_tag} - ${asset.asset_type}`;
    assetSelect.appendChild(option);
  });
}

function renderUsersTable() {
  const tbody = $("usersTableBody");
  tbody.innerHTML = "";

  if (state.users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">No users found.</td></tr>`;
    return;
  }

  state.users.forEach((user) => {
    const row = document.createElement("tr");
    const roleOptions = ROLES.map((role) => `
      <option value="${role.value}" ${user.role === role.value ? "selected" : ""}>${role.label}</option>
    `).join("");

    row.innerHTML = `
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.full_name || "")}</td>
      <td>${escapeHtml(roleLabel(user.role))}</td>
      <td>
        <select class="role-select" data-user-id="${escapeHtml(user.id)}">
          ${roleOptions}
        </select>
      </td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll(".role-select").forEach((select) => {
    select.addEventListener("change", async (event) => {
      await updateUserRole(event.target.dataset.userId, event.target.value);
    });
  });
}

async function updateUserRole(userId, newRole) {
  if (state.profile.role !== "admin") {
    setStatus("Only admins can change user roles.", "error");
    return;
  }

  const { error } = await client.from("profiles").update({ role: newRole }).eq("id", userId);
  if (error) {
    setStatus(error.message, "error");
    return;
  }

  await logAction("Updated user role", "profiles", userId, { new_role: newRole });
  await loadUsers();
  renderUsersTable();
  setStatus("User role updated.");
}

function renderWorkflowQueue() {
  const container = $("workflowCards");
  container.innerHTML = "";

  const profileRole = state.profile.role;
  let tickets = state.tickets;

  if (profileRole === "approver") {
    tickets = tickets.filter((ticket) => ["Submitted", "Rejected"].includes(ticket.status));
    $("workflowHelp").textContent = "Approvers approve or reject submitted destruction requests.";
  } else if (profileRole === "technician") {
    tickets = tickets.filter((ticket) => ["Approved", "Assigned", "Destroyed"].includes(ticket.status));
    $("workflowHelp").textContent = "Technicians complete destruction evidence and certification steps.";
  } else {
    $("workflowHelp").textContent = "Admins can view and process all workflow tickets.";
  }

  if (tickets.length === 0) {
    container.innerHTML = `<p class="muted">No workflow tickets are available for this role.</p>`;
    return;
  }

  tickets.forEach((ticket) => {
    const card = document.createElement("article");
    card.className = "ticket-card";
    card.innerHTML = ticketCardHtml(ticket) + workflowActionsHtml(ticket);
    container.appendChild(card);
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const action = event.target.dataset.action;
      const ticketId = event.target.dataset.ticketId;
      await processTicketAction(ticketId, action);
    });
  });
}

function ticketCardHtml(ticket) {
  return `
    <span class="status">${escapeHtml(ticket.status)}</span>
    <h3>${escapeHtml(ticket.assets?.asset_tag || "Unknown Asset")}</h3>
    <p><strong>Type:</strong> ${escapeHtml(ticket.assets?.asset_type || "")}</p>
    <p><strong>Customer:</strong> ${escapeHtml(ticket.customer?.full_name || ticket.customer?.email || ticket.customer_id)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(ticket.request_reason)}</p>
    <p><strong>Evidence:</strong> ${escapeHtml(ticket.evidence_notes || "No evidence submitted yet.")}</p>
    <p class="muted">Created ${formatDate(ticket.created_at)}</p>
  `;
}

function workflowActionsHtml(ticket) {
  const role = state.profile.role;
  const actions = [];

  if (["admin", "approver"].includes(role) && ticket.status === "Submitted") {
    actions.push(`<button class="small" data-action="approve" data-ticket-id="${ticket.id}">Approve</button>`);
    actions.push(`<button class="small danger" data-action="reject" data-ticket-id="${ticket.id}">Reject</button>`);
  }

  if (["admin", "technician"].includes(role) && ["Approved", "Assigned"].includes(ticket.status)) {
    actions.push(`<button class="small" data-action="destroy" data-ticket-id="${ticket.id}">Mark Destroyed</button>`);
  }

  if (["admin", "technician"].includes(role) && ticket.status === "Destroyed") {
    actions.push(`<button class="small" data-action="certify" data-ticket-id="${ticket.id}">Certify Complete</button>`);
  }

  if (actions.length === 0) {
    return `<p class="muted">No actions available for this ticket.</p>`;
  }

  return `<div class="ticket-actions">${actions.join("")}</div>`;
}

async function processTicketAction(ticketId, action) {
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) return;

  const update = {};
  let auditAction = "Updated ticket";

  if (action === "approve") {
    update.status = "Approved";
    update.approver_id = state.profile.id;
    auditAction = "Approved destruction ticket";
  }

  if (action === "reject") {
    update.status = "Rejected";
    update.approver_id = state.profile.id;
    auditAction = "Rejected destruction ticket";
  }

  if (action === "destroy") {
    const notes = prompt("Enter destruction evidence notes:", "Asset sanitized/destroyed according to CADTS procedure.");
    if (notes === null) return;
    update.status = "Destroyed";
    update.technician_id = state.profile.id;
    update.evidence_notes = notes;
    auditAction = "Marked ticket destroyed";
  }

  if (action === "certify") {
    const certificateUrl = prompt("Enter certificate reference or URL:", `CERT-${ticket.id.slice(0, 8).toUpperCase()}`);
    if (certificateUrl === null) return;
    update.status = "Certified";
    update.certificate_url = certificateUrl;
    auditAction = "Certified destruction complete";
  }

  const { error } = await client.from("destruction_tickets").update(update).eq("id", ticketId);
  if (error) {
    setStatus(error.message, "error");
    return;
  }

  if (["destroy", "certify"].includes(action) && ticket.asset_id) {
    await client.from("assets").update({ status: "Destroyed" }).eq("id", ticket.asset_id);
  }

  await logAction(auditAction, "destruction_tickets", ticketId, { status: update.status });
  await refreshAllData();
  renderWorkflowQueue();
  renderReports();
  setStatus("Ticket updated.");
}

function renderReports() {
  const content = $("reportContent");
  const totalAssets = state.assets.length;
  const totalTickets = state.tickets.length;
  const submitted = state.tickets.filter((ticket) => ticket.status === "Submitted").length;
  const certified = state.tickets.filter((ticket) => ticket.status === "Certified").length;

  content.innerHTML = `
    <article class="metric-card"><span>Total Assets</span><strong>${totalAssets}</strong></article>
    <article class="metric-card"><span>Total Tickets</span><strong>${totalTickets}</strong></article>
    <article class="metric-card"><span>Pending Approval</span><strong>${submitted}</strong></article>
    <article class="metric-card"><span>Certified Complete</span><strong>${certified}</strong></article>
  `;
}

function renderAuditLogs() {
  const tbody = $("auditTableBody");
  tbody.innerHTML = "";

  if (state.auditLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No audit logs found.</td></tr>`;
    return;
  }

  state.auditLogs.forEach((log) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDate(log.created_at))}</td>
      <td>${escapeHtml(log.actor?.full_name || log.actor?.email || log.actor_id || "System")}</td>
      <td>${escapeHtml(log.action)}</td>
      <td>${escapeHtml(log.table_name)}</td>
      <td><code>${escapeHtml(JSON.stringify(log.details || {}))}</code></td>
    `;
    tbody.appendChild(row);
  });
}

function renderMyRecords() {
  const assetsList = $("assetsList");
  const ticketsList = $("ticketsList");

  const ownAssets = state.profile.role === "customer"
    ? state.assets.filter((asset) => asset.owner_id === state.profile.id)
    : state.assets;

  const ownTickets = state.profile.role === "customer"
    ? state.tickets.filter((ticket) => ticket.customer_id === state.profile.id)
    : state.tickets;

  assetsList.innerHTML = ownAssets.length
    ? ownAssets.map((asset) => `
      <article class="record-card">
        <span class="status">${escapeHtml(asset.status)}</span>
        <h3>${escapeHtml(asset.asset_tag)}</h3>
        <p><strong>Type:</strong> ${escapeHtml(asset.asset_type)}</p>
        <p>${escapeHtml(asset.description || "No description")}</p>
      </article>
    `).join("")
    : `<p class="muted">No assets found.</p>`;

  ticketsList.innerHTML = ownTickets.length
    ? ownTickets.map((ticket) => `
      <article class="record-card">
        ${ticketCardHtml(ticket)}
        ${ticket.certificate_url ? `<p><strong>Certificate:</strong> ${escapeHtml(ticket.certificate_url)}</p>` : ""}
      </article>
    `).join("")
    : `<p class="muted">No tickets found.</p>`;
}

async function logAction(action, tableName, recordId, details = {}) {
  if (!state.profile) return;

  const { error } = await client.from("audit_logs").insert({
    actor_id: state.profile.id,
    action,
    table_name: tableName,
    record_id: recordId,
    details
  });

  if (error) {
    console.warn("Audit log failed", error);
  }
}

function exportTicketsCsv() {
  const rows = [
    ["Ticket ID", "Status", "Asset Tag", "Asset Type", "Customer", "Reason", "Evidence", "Certificate", "Created"]
  ];

  state.tickets.forEach((ticket) => {
    rows.push([
      ticket.id,
      ticket.status,
      ticket.assets?.asset_tag || "",
      ticket.assets?.asset_type || "",
      ticket.customer?.email || ticket.customer_id,
      ticket.request_reason,
      ticket.evidence_notes || "",
      ticket.certificate_url || "",
      ticket.created_at
    ]);
  });

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cadts-destruction-tickets.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

window.addEventListener("DOMContentLoaded", init);
