"use strict";

const PAGE = document.body.dataset.page || "events";
const ROOT = PAGE === "admin" ? "../" : "";
const KEYS = { accounts: "soundwave.accounts", profile: "soundwave.profile", bookings: "soundwave.bookings", events: "soundwave.events", session: "soundwave.session", lastOrder: "soundwave.lastOrder" };
const API_URL = ROOT + "php/api.php";
const AUTH_URL = ROOT + "php/auth.php";
const ARTIST_IMAGE = "https://media.stubhubstatic.com/stubhub-v2-catalog/d_vgg-defaultLogo.jpg/q_auto:good,f_auto,c_fill,g_auto,w_1200,h_736/categories/26202/6579799";
window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
});
const defaults = [
    { id: "weeknd-kuala-lumpur-2026-11-04", name: "The Weeknd", date: "2026-11-04", time: "20:30", venue: "Bukit Jalil National Stadium", city: "Kuala Lumpur, Malaysia", price: 149 },
    { id: "weeknd-kuala-lumpur-2026-11-05", name: "The Weeknd", date: "2026-11-05", time: "20:30", venue: "Bukit Jalil National Stadium", city: "Kuala Lumpur, Malaysia", price: 138 },
    { id: "weeknd-singapore-2026-10-02", name: "The Weeknd", date: "2026-10-02", time: "20:00", venue: "Singapore National Stadium", city: "Singapore, Singapore", price: 191 },
    { id: "weeknd-bangkok-2026-10-12", name: "The Weeknd", date: "2026-10-12", time: "20:00", venue: "Rajamangala National Stadium", city: "Bangkok, Thailand", price: 126 }
];
const $ = (selector) => document.querySelector(selector);
const html = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const id = (prefix) => prefix + "-" + (globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(16).slice(2));
const icon = (name) => '<i data-lucide="' + name + '" aria-hidden="true"></i>';
const refreshIcons = () => globalThis.lucide?.createIcons();
function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
}
function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { toast("Could not save. Please allow browser storage and try again."); return false; }
}
function validEvent(event) {
    return event && typeof event.id === "string" && typeof event.name === "string" && typeof event.city === "string" &&
        typeof event.venue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
        /^\d{2}:\d{2}$/.test(event.time) && Number.isFinite(event.price) && event.price > 0;
}
function validProfile(value) {
    return value && typeof value.id === "string" && typeof value.fullName === "string" &&
        typeof value.email === "string" && typeof value.phone === "string" && typeof value.city === "string";
}
let events = read(KEYS.events, defaults);
if (!Array.isArray(events)) events = [...defaults];
events = events.filter(validEvent);
let profile = read(KEYS.profile, null);
if (!validProfile(profile)) profile = null;
let accounts = read(KEYS.accounts, []);
if (!Array.isArray(accounts)) accounts = [];
accounts = accounts.filter(validProfile).filter((account, index, list) => list.findIndex((item) => item.id === account.id) === index);
// Preserve the one-account version of this demo when it upgrades to multiple local accounts.
if (profile && !accounts.some((account) => account.id === profile.id)) accounts.unshift(profile);
try { localStorage.setItem(KEYS.accounts, JSON.stringify(accounts)); } catch { /* The normal save path reports storage errors. */ }
if (profile) profile = publicProfile(accounts.find((account) => account.id === profile.id));
let bookings = read(KEYS.bookings, []);
if (!Array.isArray(bookings)) bookings = [];
bookings = bookings.map((booking) => ({ ...booking, profileId: booking.profileId || profile?.id || "" }))
    .filter((b) => b && typeof b.id === "string" && typeof b.concertId === "string" && typeof b.profileId === "string" && accounts.some((account) => account.id === b.profileId) && Number.isInteger(b.quantity) && b.quantity >= 1 && b.quantity <= 5);
try { localStorage.setItem(KEYS.bookings, JSON.stringify(bookings)); } catch { /* The normal save path reports storage errors. */ }
let active = false;
try { active = Boolean(profile && sessionStorage.getItem(KEYS.session) === profile.id); } catch { /* Storage can be disabled in private browsing. */ }
let serverAvailable = false;
function startSession() {
    try { if (profile?.id) sessionStorage.setItem(KEYS.session, profile.id); active = Boolean(profile); return true; }
    catch { toast("Please allow browser storage to continue."); return false; }
}
function clearLoginState() {
    profile = null;
    active = false;
    try {
        sessionStorage.removeItem(KEYS.session);
        localStorage.removeItem(KEYS.profile);
    } catch { /* Login is already cleared in memory. */ }
}
async function requestJson(url, action, payload = {}) {
    const response = await fetch(url + "?action=" + encodeURIComponent(action), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin"
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "Database request failed.");
    return data;
}
async function loadServerState() {
    try {
        const response = await fetch(API_URL + "?action=bootstrap", { credentials: "same-origin" });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || "Database is not ready.");
        applyServerState(data);
        serverAvailable = true;
    } catch {
        serverAvailable = false;
    }
}
function applyServerState(data) {
    if (Array.isArray(data.events)) events = data.events.filter(validEvent);
    if (Array.isArray(data.accounts)) accounts = data.accounts.filter(validProfile);
    profile = validProfile(data.profile) ? data.profile : null;
    bookings = Array.isArray(data.bookings) ? data.bookings.filter((b) =>
        b && typeof b.id === "string" && typeof b.concertId === "string" && typeof b.profileId === "string" && Number.isInteger(b.quantity) && b.quantity >= 1 && b.quantity <= 5
    ) : [];
    active = Boolean(profile);
    try {
        if (profile) sessionStorage.setItem(KEYS.session, profile.id);
        else {
            sessionStorage.removeItem(KEYS.session);
            localStorage.removeItem(KEYS.profile);
        }
        if (data.admin) sessionStorage.setItem(ADMIN_SESSION_KEY, "admin");
        else sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch { /* Server session is still the source of truth. */ }
}
async function refreshServerState() {
    if (!serverAvailable) return;
    await loadServerState();
    shell();
}
function currentBookings() {
    return profile ? bookings.filter((booking) => booking.profileId === profile.id) : [];
}
function firstName() {
    return (profile?.fullName || "Account").trim().split(/\s+/)[0] || "Account";
}
function publicProfile(account) {
    if (!account) return null;
    const { password, ...safeProfile } = account;
    return safeProfile;
}
function orderNo() {
    return "CT" + new Date().toISOString().slice(2, 10).replaceAll("-", "") + Math.floor(1000 + Math.random() * 9000);
}
function bookingOrderNo(booking) {
    return booking?.orderNo || booking?.id?.replace(/\W/g, "").slice(-10).toUpperCase() || orderNo();
}
function bookingBuyerName(booking) {
    return booking?.buyerName || profile?.fullName || "";
}
function bookingBuyerEmail(booking) {
    return booking?.buyerEmail || profile?.email || "";
}
function showBookingConfirmation(booking, event) {
    if (!$("#purchaseResult") || !booking || !event) return;
    save(KEYS.lastOrder, { bookingId: booking.id, concertId: event.id, orderNo: bookingOrderNo(booking) });
    $("#purchaseResult").innerHTML = '<section class="booking-confirmed">' +
        '<span class="confirmed-icon">' + icon("circle-check") + '</span><div><p class="eyebrow">Booking Confirmed</p><h2>Your tickets are ready.</h2>' +
        '<dl class="order-meta"><div><dt>Order No.</dt><dd>' + html(bookingOrderNo(booking)) + '</dd></div>' +
        '<div><dt>Event</dt><dd>' + html(event.name) + '</dd></div>' +
        '<div><dt>Date</dt><dd>' + html(dateText(event.date)) + ' / ' + html(timeText(event.time)) + '</dd></div>' +
        '<div><dt>Tickets</dt><dd>' + booking.quantity + (booking.quantity === 1 ? ' ticket' : ' tickets') + '</dd></div>' +
        '<div><dt>Account email</dt><dd>' + html(bookingBuyerEmail(booking)) + '</dd></div></dl>' +
        '<div class="button-row"><a class="primary-btn" href="ticket.html">' + icon("ticket") + 'View My Tickets</a><a class="secondary-btn" href="ticket.html?view=history">' + icon("receipt-text") + 'View Receipt</a></div></div></section>';
    refreshIcons();
}
async function activateAccount(accountId) {
    const selected = accounts.find((account) => account.id === accountId);
    if (!selected) { toast("That account is no longer available. Refresh this page and try again."); return; }
    profile = publicProfile(selected);
    if (!save(KEYS.profile, profile)) return;
    if (startSession()) continueAfterSignIn();
}
let toastTimer;
function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4200);
}
function day(date) { return new Date(date + "T12:00:00"); }
function dateText(date) { return day(date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
function timeText(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return (hours % 12 || 12) + ":" + String(minutes).padStart(2, "0") + (hours >= 12 ? " PM" : " AM");
}
function dateBadge(event) {
    const d = day(event.date);
    return '<div class="date-badge"><span>' + d.toLocaleDateString("en-GB", { month: "short" }) + '</span><strong>' + d.getDate() + '</strong><small>' + d.toLocaleDateString("en-GB", { weekday: "short" }) + "</small></div>";
}
function eventLink(event) { return ROOT + "ticket.html?event=" + encodeURIComponent(event.id); }
function profileLink() {
    const eventId = new URLSearchParams(location.search).get("event");
    return ROOT + (active ? "profile.html" : "signin.html") + (eventId ? "?event=" + encodeURIComponent(eventId) : "");
}
function shell() {
    $("#siteHeader").innerHTML = '<div class="announcement">Independent concert ticketing demo <span>Prices shown in USD</span></div>' +
        '<nav class="navbar" aria-label="Main navigation"><a class="brand" href="' + ROOT + 'index.html">sound<span>wave</span><span class="brand-dot">.</span></a>' +
        '<form class="site-search" role="search"><label class="sr-only" for="concertSearch">Search events</label>' + icon("search") +
        '<input id="concertSearch" type="search" placeholder="Search artists, events or venues" name="q" maxlength="150"></form>' +
        '<div class="nav-actions"><a href="' + ROOT + 'index.html"' + (PAGE === "events" ? ' aria-current="page"' : "") + '>Explore</a>' +
        '<a href="' + ROOT + 'ticket.html"' + (PAGE === "tickets" ? ' aria-current="page"' : "") + '>My tickets</a>' +
        (active ? '<details class="account-menu"><summary>' + icon("user-round") + '<span>' + html(firstName()) + '</span>' + icon("chevron-down") + '</summary><div class="account-dropdown">' +
            '<a href="' + ROOT + 'profile.html">' + icon("user-round") + 'My Profile</a>' +
            '<a href="' + ROOT + 'ticket.html?view=history">' + icon("receipt-text") + 'Order History</a>' +
            '<a href="' + ROOT + 'signout.html">' + icon("log-out") + 'Sign Out</a></div></details>' :
            '<a id="accountLink" href="' + profileLink() + '">' + icon("user-round") + '<span>Sign In / Register</span></a>') + '</div></nav>';
    $("#siteFooter").innerHTML = '<a class="brand" href="' + ROOT + 'index.html">sound<span>wave</span>.</a><p>Demo events and prices. No payment is collected.<br>' + (serverAvailable ? 'Profiles and bookings are saved in the database.' : 'Profiles and bookings are saved only in this browser.') + '</p><a href="' + ROOT + 'admin/crud.html">Event management</a>';
    $(".site-search").addEventListener("submit", (e) => {
        e.preventDefault();
        if (PAGE === "events") renderEventLists();
        else location.href = ROOT + "index.html?q=" + encodeURIComponent($("#concertSearch").value.trim());
    });
}
function artistPanel() {
    return '<aside class="artist-panel"><img class="artist-photo" src="' + ARTIST_IMAGE + '" alt="The Weeknd performing on stage" width="1200" height="736">' +
        '<div class="artist-info"><div class="genre-tags"><span>Pop</span><span>Contemporary R&amp;B</span></div><h2>The Weeknd</h2><p>After Hours. Dawn FM. Hurry Up Tomorrow.</p>' +
        '<a class="text-link" href="https://www.theweeknd.com/" target="_blank" rel="noopener noreferrer">Official artist website ' + icon("arrow-up-right") + '</a></div>' +
        '<div class="tour-note"><span class="note-line"></span><h3>A night worth being there for.</h3><p>Find your date. Choose your tickets.</p></div></aside>';
}
function eventRow(event) {
    return '<article class="event-row">' + dateBadge(event) + '<div class="event-main"><h3>' + html(event.name) + '</h3><p>' + html(timeText(event.time)) + ' <span class="separator">/</span> ' + html(event.city) + '</p><p class="venue">' + html(event.venue) + '</p></div>' +
        '<div class="event-actions"><span class="from-price">From <strong>' + money(event.price) + '</strong></span><a class="ticket-btn" href="' + eventLink(event) + '">See tickets ' + icon("arrow-right") + '</a></div></article>';
}
function eventsPage() {
    $("#app").innerHTML = '<div class="market-layout"><section class="event-content"><p class="breadcrumb">Concerts <span>/</span> R&amp;B <span>/</span> The Weeknd</p>' +
        '<h1>The Weeknd Tickets</h1><div class="event-tabs"><span class="selected">Events</span><span id="eventCount"></span></div>' +
        '<div class="filter-strip"><label>' + icon("map-pin") + '<span class="sr-only">Location</span><select id="locationFilter"><option value="">All locations</option></select></label>' +
        '<label>' + icon("calendar-days") + '<span class="sr-only">Month</span><select id="dateFilter"><option value="">All dates</option></select></label>' +
        '<label>' + icon("arrow-up-down") + '<span class="sr-only">Sort events</span><select id="sortFilter"><option value="date">Date: earliest</option><option value="price">Price: lowest</option></select></label>' +
        '<button class="text-button" id="resetFilters" type="button" title="Reset filters">' + icon("rotate-ccw") + 'Reset</button></div>' +
        '<div id="concertList" aria-live="polite"></div></section>' + artistPanel() + '</div>';
    [...new Set(events.map((event) => event.city))].sort().forEach((city) => $("#locationFilter").add(new Option(city, city)));
    [...new Set(events.map((event) => event.date.slice(0, 7)))].sort().forEach((month) => $("#dateFilter").add(new Option(day(month + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" }), month)));
    $("#concertSearch").value = new URLSearchParams(location.search).get("q") || "";
    ["#locationFilter", "#dateFilter", "#sortFilter"].forEach((s) => $(s).addEventListener("change", renderEventLists));
    $("#concertSearch").addEventListener("input", renderEventLists);
    $("#resetFilters").addEventListener("click", () => {
        $("#locationFilter").value = ""; $("#dateFilter").value = ""; $("#sortFilter").value = "date"; $("#concertSearch").value = ""; renderEventLists();
    });
    renderEventLists();
}
function renderEventLists() {
    const query = $("#concertSearch").value.trim().toLowerCase();
    const filtered = events.filter((event) => (!$("#locationFilter").value || event.city === $("#locationFilter").value) &&
        (!$("#dateFilter").value || event.date.startsWith($("#dateFilter").value)) &&
        [event.name, event.city, event.venue, dateText(event.date)].join(" ").toLowerCase().includes(query))
        .sort((a, b) => $("#sortFilter").value === "price" ? a.price - b.price : (a.date + a.time).localeCompare(b.date + b.time));
    $("#eventCount").textContent = filtered.length + (filtered.length === 1 ? " event" : " events");
    const group = (label, list) => list.length ? '<section class="event-group"><h2>' + label + '</h2>' + list.map(eventRow).join("") + "</section>" : "";
    if ($("#locationFilter").value || $("#sortFilter").value === "price") {
        $("#concertList").innerHTML = group("Available events", filtered);
    } else {
        $("#concertList").innerHTML = group("Kuala Lumpur", filtered.filter((event) => event.city.startsWith("Kuala Lumpur"))) +
            group("Other locations", filtered.filter((event) => !event.city.startsWith("Kuala Lumpur")));
    }
    if (!filtered.length) $("#concertList").innerHTML = '<div class="empty-state"><h2>No matching events</h2><p>Try another location, date or search.</p></div>';
    refreshIcons();
}
function accountRoute(file) {
    const eventId = new URLSearchParams(location.search).get("event");
    return file + (eventId ? "?event=" + encodeURIComponent(eventId) : "");
}
function signInPage() {
    $("#app").innerHTML = '<div class="account-layout"><section class="account-form"><a class="back-link" href="index.html">' + icon("arrow-left") + 'Back to events</a>' +
        '<p class="eyebrow">Your SoundWave account</p><h1>Sign in</h1><p class="muted">Use the same email you used when booking tickets.</p>' +
        '<form id="signInForm" class="form-stack"><label for="loginEmail">Email address</label><input id="loginEmail" name="email" type="email" autocomplete="email" maxlength="150" required>' +
        '<label for="loginPassword">Password</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" maxlength="100" required>' +
        '<p id="signInError" class="login-error" role="alert"></p><button class="primary-btn" type="submit">' + icon("log-in") + 'Sign in</button></form>' +
        '<p class="muted account-return">New to SoundWave? <a class="text-link" href="' + accountRoute("createaccount.html") + '">Create account</a></p>' +
        '<div class="account-bottom"><a class="text-link" href="admin/crud.html">' + icon("log-in") + 'Admin sign in</a>' +
        (active ? '<a class="text-link" href="signout.html">' + icon("log-out") + 'Sign out</a>' : '') + '</div></section>' +
        '<aside class="account-photo"><img src="' + ARTIST_IMAGE + '" alt="The Weeknd live on stage" width="1200" height="736"><div><p>THE WEEKND</p><h2>Be part of the night.</h2></div></aside></div>';
    $("#signInForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = $("#loginEmail").value.trim().toLowerCase();
        const password = $("#loginPassword").value;
        if (serverAvailable) {
            try {
                const data = await requestJson(AUTH_URL, "sign_in", { email, password });
                applyServerState(data);
                location.replace(signInDestination());
            } catch {
                $("#signInError").textContent = "Email or password is incorrect.";
                $("#loginPassword").value = "";
                $("#loginPassword").focus();
            }
            return;
        }
        const account = accounts.find((item) => item.email.toLowerCase() === email && item.password === password);
        if (!account) {
            $("#signInError").textContent = "Email or password is incorrect.";
            $("#loginPassword").value = "";
            $("#loginPassword").focus();
            return;
        }
        profile = publicProfile(account);
        if (!save(KEYS.profile, profile)) return;
        if (startSession()) location.replace(signInDestination());
    });
    refreshIcons();
}
function createAccountPage() {
    $("#app").innerHTML = '<div class="account-layout"><section class="account-form"><a class="back-link" href="index.html">' + icon("arrow-left") + 'Back to events</a>' +
        '<p class="eyebrow">Join SoundWave</p><h1>Create account</h1><p class="muted">Enter your details to create your concert profile.</p>' +
        '<form id="createAccountForm" class="form-stack"><label for="fullName">Full name</label><input id="fullName" name="fullName" autocomplete="name" maxlength="100" required>' +
        '<label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" maxlength="150" required>' +
        '<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="6" maxlength="100" required>' +
        '<div class="form-pair"><div><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="30" required></div>' +
        '<div><label for="city">City</label><input id="city" name="city" autocomplete="address-level2" maxlength="100"></div></div>' +
        '<p class="login-error" id="createAccountError" role="alert"></p>' +
        '<button class="primary-btn" id="createAccountBtn" type="submit">' + icon("user-plus") + 'Create account</button></form>' +
        '<p class="muted account-return">Already have an account? <a class="text-link" href="' + accountRoute("signin.html") + '">Sign in</a></p></section>' +
        '<aside class="account-photo"><img src="' + ARTIST_IMAGE + '" alt="The Weeknd live on stage" width="1200" height="736"><div><p>THE WEEKND</p><h2>Be part of the night.</h2></div></aside></div>';
    $("#createAccountForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const next = { id: id("profile"), fullName: $("#fullName").value.trim(), email: $("#email").value.trim(), password: $("#password").value, phone: $("#phone").value.trim(), city: $("#city").value.trim() };
        if (!next.fullName || !next.email || !next.phone || next.password.length < 6 || !$("#createAccountForm").reportValidity()) {
            $("#createAccountError").textContent = 'Enter your details and a password with at least 6 characters.';
            return;
        }
        if (serverAvailable) {
            try {
                const data = await requestJson(AUTH_URL, "create_account", next);
                applyServerState(data);
                continueToSignIn();
            } catch (error) {
                $("#createAccountError").textContent = error.message.includes("email") ? "This email address is already in use." : error.message;
            }
            return;
        }
        if (accounts.some((account) => account.email.toLowerCase() === next.email.toLowerCase())) {
            $("#createAccountError").textContent = "This email address is already in use.";
            return;
        }
        const nextAccounts = [...accounts, next];
        if (!save(KEYS.accounts, nextAccounts)) return;
        accounts = nextAccounts;
        clearLoginState();
        continueToSignIn();
    });
    refreshIcons();
}
function continueToSignIn() {
    location.href = accountRoute("signin.html");
}
function profilePage() {
    if (PAGE === "account" && !active) {
        $("#app").innerHTML = '<section class="admin-login"><a class="back-link" href="index.html">' + icon("arrow-left") + 'Back to events</a>' +
            '<p class="eyebrow">Your SoundWave account</p><h1>Your profile</h1><p class="muted">Sign in to view and manage your saved profile.</p>' +
            '<a class="primary-btn" href="' + accountRoute("signin.html") + '">' + icon("log-in") + 'Sign in</a>' +
            '<div class="account-bottom"><a class="text-link" href="' + accountRoute("createaccount.html") + '">' + icon("user-plus") + 'Create account</a></div></section>';
        refreshIcons();
        return;
    }
    $("#app").innerHTML = '<div class="account-layout"><section class="account-form"><a class="back-link" href="index.html">' + icon("arrow-left") + 'Back to events</a>' +
        '<p class="eyebrow">Your SoundWave account</p><h1>Your profile</h1>' +
        '<div class="profile-card"><span class="profile-photo">' + icon("user-round") + '</span><div><p class="eyebrow">Profile Photo</p><strong>' + html(profile?.fullName || "") + '</strong><small>' + html(profile?.email || "") + '</small></div></div>' +
        '<p><a class="text-link" href="ticket.html">' + icon("ticket") + 'My tickets</a></p>' +
        '<form id="profileForm" class="form-stack"><input id="profileId" type="hidden" value="' + html(profile?.id || "") + '">' +
        '<label for="fullName">Full name</label><input id="fullName" autocomplete="name" maxlength="100" required value="' + html(profile?.fullName || "") + '">' +
        '<label for="email">Email address</label><input id="email" type="email" autocomplete="email" maxlength="150" required value="' + html(profile?.email || "") + '">' +
        '<div class="form-pair"><div><label for="phone">Phone number</label><input id="phone" type="tel" autocomplete="tel" maxlength="30" required value="' + html(profile?.phone || "") + '"></div>' +
        '<div><label for="city">City</label><input id="city" autocomplete="address-level2" maxlength="100" value="' + html(profile?.city || "") + '"></div></div>' +
        '<button id="saveProfileBtn" class="primary-btn" type="submit">' + icon("check") + 'Edit Profile</button></form>' +
        '<details class="password-panel"><summary>' + icon("key-round") + 'Change Password</summary><form id="passwordForm" class="form-stack">' +
        '<label for="currentPassword">Current password</label><input id="currentPassword" type="password" autocomplete="current-password" maxlength="100">' +
        '<label for="newPassword">New password</label><input id="newPassword" type="password" autocomplete="new-password" minlength="6" maxlength="100">' +
        '<p id="passwordError" class="login-error" role="alert"></p><button class="secondary-btn" type="submit">' + icon("key-round") + 'Change Password</button></form></details>' +
        '<div id="profileSummary" class="account-bottom"><a class="text-link" href="admin/crud.html">' + icon("log-in") + 'Admin sign in</a><a class="text-link" href="signout.html">' + icon("log-out") + 'Sign out</a><button id="deleteProfileBtn" class="danger-link" type="button">' + icon("trash-2") + 'Delete profile and bookings</button></div></section>' +
        '<aside class="account-photo"><img src="' + ARTIST_IMAGE + '" alt="The Weeknd live on stage" width="1200" height="736"><div><p>THE WEEKND</p><h2>Be part of the night.</h2></div></aside></div>';
    $("#profileForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const next = { id: profile?.id || id("profile"), fullName: $("#fullName").value.trim(), email: $("#email").value.trim(), phone: $("#phone").value.trim(), city: $("#city").value.trim() };
        if (!next.fullName || !next.email || !next.phone) { toast("Enter your name, email and phone number."); return; }
        if (serverAvailable) {
            try {
                const data = await requestJson(API_URL, "update_profile", next);
                applyServerState(data);
                shell(); profilePage(); refreshIcons(); toast("Profile saved.");
            } catch (error) {
                toast(error.message.includes("email") ? "This email address is already in use." : error.message);
            }
            return;
        }
        if (accounts.some((account) => account.id !== next.id && account.email.toLowerCase() === next.email.toLowerCase())) { toast("This email address is already in use."); return; }
        const nextAccounts = accounts.map((account) => account.id === next.id ? { ...account, ...next } : account);
        if (!save(KEYS.accounts, nextAccounts) || !save(KEYS.profile, next)) return;
        accounts = nextAccounts;
        profile = next;
        if (!startSession()) return;
        shell(); profilePage(); refreshIcons(); toast("Profile saved.");
    });
    $("#passwordForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const currentPassword = $("#currentPassword").value;
        const newPassword = $("#newPassword").value;
        if (newPassword.length < 6) {
            $("#passwordError").textContent = "Use a password with at least 6 characters.";
            return;
        }
        if (serverAvailable) {
            try {
                const data = await requestJson(API_URL, "change_password", { currentPassword, newPassword });
                applyServerState(data);
                $("#currentPassword").value = "";
                $("#newPassword").value = "";
                $("#passwordError").textContent = "";
                toast("Password changed.");
            } catch (error) {
                $("#passwordError").textContent = error.message;
            }
            return;
        }
        const account = accounts.find((item) => item.id === profile.id);
        if (!account || account.password !== currentPassword) {
            $("#passwordError").textContent = "Current password is incorrect.";
            return;
        }
        const nextAccounts = accounts.map((item) => item.id === profile.id ? { ...item, password: newPassword } : item);
        if (!save(KEYS.accounts, nextAccounts)) return;
        accounts = nextAccounts;
        $("#currentPassword").value = "";
        $("#newPassword").value = "";
        $("#passwordError").textContent = "";
        toast("Password changed.");
    });
    $("#deleteProfileBtn")?.addEventListener("click", async () => {
        if (!confirm("Delete your profile and all bookings saved in this browser?")) return;
        if (serverAvailable) {
            try {
                const data = await requestJson(API_URL, "delete_profile");
                applyServerState(data);
                shell(); profilePage(); refreshIcons(); toast("Profile and bookings deleted.");
            } catch (error) {
                toast(error.message);
            }
            return;
        }
        const nextBookings = bookings.filter((booking) => booking.profileId !== profile.id);
        const nextAccounts = accounts.filter((account) => account.id !== profile.id);
        if (!save(KEYS.bookings, nextBookings) || !save(KEYS.accounts, nextAccounts) || !save(KEYS.profile, null)) return;
        bookings = nextBookings;
        accounts = nextAccounts;
        profile = null; active = false;
        try { sessionStorage.removeItem(KEYS.session); } catch { /* No active session remains. */ }
        shell(); profilePage(); refreshIcons(); toast("Profile and bookings deleted.");
    });
}
function signInDestination() {
    const eventId = new URLSearchParams(location.search).get("event");
    return eventId ? "ticket.html?event=" + encodeURIComponent(eventId) : "index.html";
}
function continueAfterSignIn() {
    location.href = signInDestination();
}
function quantityOptions(value = 1) { return [1, 2, 3, 4, 5].map((n) => '<option value="' + n + '"' + (n === value ? " selected" : "") + ">" + n + (n === 1 ? " ticket" : " tickets") + "</option>").join(""); }
function ticketsPage() {
    const eventId = new URLSearchParams(location.search).get("event");
    const view = new URLSearchParams(location.search).get("view");
    const event = events.find((item) => item.id === eventId);
    $("#app").innerHTML = '<a class="back-link" href="index.html">' + icon("arrow-left") + 'All events</a>' +
        (eventId ? (event ? '<section class="ticket-detail"><div><p class="eyebrow">Concert tickets</p><h1>' + html(event.name) + '</h1><p class="detail-date">' + html(dateText(event.date)) + ' / ' + html(timeText(event.time)) + '</p><p>' + html(event.venue) + '<br>' + html(event.city) + '</p><div class="ticket-type">' + icon("ticket") + '<span>Standard admission</span></div></div>' +
        '<form id="bookingForm" class="booking-box"><h2>Your tickets</h2><label for="quantity">Quantity</label><select id="quantity">' + quantityOptions() + '</select><div class="price-line"><span>Per ticket</span><strong>' + money(event.price) + '</strong></div><div class="price-line total"><span>Total</span><strong id="bookingTotal">' + money(event.price) + '</strong></div><button class="primary-btn" type="submit">' + icon(active ? "ticket" : "log-in") + (active ? "Reserve tickets" : "Sign In / Register") + '</button><p class="fine-print">Demo reservation. No payment or ticket delivery.</p></form></section><div id="purchaseResult"></div>' :
        '<div class="empty-state"><h1>Event unavailable</h1><p>This event may have been removed.</p><a class="ticket-btn" href="index.html">Browse events</a></div>') : '<div class="page-heading"><p class="eyebrow">Your next night out</p><h1>' + (view === "history" ? "Order History" : "My tickets") + '</h1></div>') +
        '<section class="bookings-section" id="bookings"><div class="section-title"><h2>' + (view === "history" ? "Receipts" : "My bookings") + '</h2><a class="text-link" href="index.html">Explore events ' + icon("arrow-right") + '</a></div><div id="bookingRows"></div></section>' +
        '<dialog id="editBookingDialog"><form id="editBookingForm" class="form-stack"><div class="section-title"><h2>Edit booking</h2><button class="icon-btn" id="cancelEditBtn" type="button" aria-label="Close" title="Close">' + icon("x") + '</button></div><input id="editBookingId" type="hidden"><label for="editQuantity">Quantity</label><select id="editQuantity">' + quantityOptions() + '</select><button class="primary-btn" type="submit">' + icon("check") + 'Save changes</button></form></dialog>';
    $("#quantity")?.addEventListener("change", () => $("#bookingTotal").textContent = money(Number($("#quantity").value) * event.price));
    $("#bookingForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!active) { location.href = profileLink(); return; }
        const quantity = Number($("#quantity").value);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) { toast("Choose 1 to 5 tickets."); return; }
        if (serverAvailable) {
            try {
                const data = await requestJson(API_URL, "create_booking", { concertId: event.id, quantity });
                applyServerState(data);
                const savedBooking = currentBookings().find((booking) => booking.concertId === event.id);
                shell(); showBookingConfirmation(savedBooking, event); renderBookings(); toast("Tickets reserved.");
            } catch (error) {
                toast(error.message);
            }
            return;
        }
        const existing = bookings.find((b) => b.concertId === event.id && b.profileId === profile.id);
        if (existing && existing.quantity + quantity > 5) { toast("You can reserve up to 5 tickets per event. Edit your existing booking below."); return; }
        const newBooking = { id: id("booking"), profileId: profile.id, concertId: event.id, orderNo: orderNo(), buyerName: profile.fullName, buyerEmail: profile.email, quantity, createdAt: new Date().toISOString() };
        const next = existing ? bookings.map((b) => b.id === existing.id ? { ...b, quantity: b.quantity + quantity } : b) : [...bookings, newBooking];
        if (!save(KEYS.bookings, next)) return;
        bookings = next; showBookingConfirmation(existing ? bookings.find((b) => b.id === existing.id) : newBooking, event); renderBookings(); toast(existing ? "Booking updated." : "Tickets reserved.");
    });
    $("#bookingRows").addEventListener("click", (e) => {
        const button = e.target.closest("[data-booking-id]");
        if (!button || !active) return;
        const booking = bookings.find((b) => b.id === button.dataset.bookingId && b.profileId === profile.id);
        if (!booking) return;
        if (button.dataset.action === "edit") {
            $("#editBookingId").value = booking.id; $("#editQuantity").value = booking.quantity; $("#editBookingDialog").showModal();
        } else if (confirm("Cancel this booking?")) {
            if (serverAvailable) {
                requestJson(API_URL, "delete_booking", { bookingId: booking.id })
                    .then((data) => { applyServerState(data); shell(); renderBookings(); toast("Booking cancelled."); })
                    .catch((error) => toast(error.message));
                return;
            }
            const next = bookings.filter((b) => b.id !== booking.id);
            if (save(KEYS.bookings, next)) { bookings = next; renderBookings(); toast("Booking cancelled."); }
        }
    });
    $("#cancelEditBtn").addEventListener("click", () => $("#editBookingDialog").close());
    $("#editBookingForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const quantity = Number($("#editQuantity").value);
        if (!active || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) { toast("Choose 1 to 5 tickets."); return; }
        if (serverAvailable) {
            try {
                const data = await requestJson(API_URL, "update_booking", { bookingId: $("#editBookingId").value, quantity });
                applyServerState(data);
                shell(); renderBookings(); $("#editBookingDialog").close(); toast("Booking updated.");
            } catch (error) {
                toast(error.message);
            }
            return;
        }
        const next = bookings.map((b) => b.id === $("#editBookingId").value && b.profileId === profile.id ? { ...b, quantity } : b);
        if (save(KEYS.bookings, next)) { bookings = next; renderBookings(); $("#editBookingDialog").close(); toast("Booking updated."); }
    });
    renderBookings();
}
function renderBookings() {
    if (!active) {
        $("#bookingRows").innerHTML = '<div class="empty-state"><h3>Your tickets, all in one place.</h3><p>Sign in to view your bookings.</p><a class="ticket-btn" href="' + profileLink() + '">Sign In / Register</a></div>';
        return;
    }
    const visibleBookings = currentBookings();
    $("#bookingRows").innerHTML = visibleBookings.length ? visibleBookings.map((booking) => {
        const event = events.find((item) => item.id === booking.concertId);
        return '<article class="booking-row">' + (event ? dateBadge(event) : "") + '<div class="event-main"><h3>' + html(event?.name || "Unavailable event") + '</h3><p>Order No. ' + html(bookingOrderNo(booking)) + '</p><p>' + html(event?.venue || "This event has been removed.") + '</p><p>' + booking.quantity + (booking.quantity === 1 ? " ticket" : " tickets") + (event ? " / " + money(booking.quantity * event.price) : "") + '</p><p>Booked for ' + html(bookingBuyerName(booking)) + ' / ' + html(bookingBuyerEmail(booking)) + '</p></div><div class="row-actions">' +
            (event ? '<button class="icon-btn" data-action="edit" data-booking-id="' + html(booking.id) + '" aria-label="Edit booking" title="Edit booking">' + icon("pencil") + '</button>' : "") +
            '<button class="icon-btn danger-link" data-action="delete" data-booking-id="' + html(booking.id) + '" aria-label="Cancel booking" title="Cancel booking">' + icon("trash-2") + '</button></div></article>';
    }).join("") : '<div class="empty-state" id="emptyBookings"><h3>No bookings yet</h3><p>Your next concert is waiting.</p><a class="ticket-btn" href="index.html">Find tickets ' + icon("arrow-right") + '</a></div>';
    refreshIcons();
}
function signoutPage() {
    $("#app").innerHTML = '<section class="signout-page"><span class="signout-icon">' + icon("log-out") + '</span><h1>' + (active ? "Ready to sign out?" : "You are signed out.") + '</h1><p>Your profile and bookings stay saved for your next sign in.</p>' +
        (active ? '<button class="primary-btn" id="signoutBtn">' + icon("log-out") + 'Sign out</button><a class="text-link" href="ticket.html">Back to my tickets</a>' : '<a class="primary-btn" href="signin.html">Sign in again</a><a class="text-link" href="index.html">Explore events</a>') + '</section>';
    $("#signoutBtn")?.addEventListener("click", async () => {
        if (serverAvailable) {
            try { await requestJson(AUTH_URL, "sign_out"); }
            catch (error) { toast(error.message); return; }
        }
        try { sessionStorage.removeItem(KEYS.session); }
        catch { toast("Unable to sign out. Please try again."); return; }
        clearLoginState(); shell(); signoutPage(); refreshIcons();
    });
}
// Demo-only credentials. A browser-side check is not a security boundary.
const ADMIN_SESSION_KEY = "soundwave.adminSession";
function adminSignedIn() {
    try { return sessionStorage.getItem(ADMIN_SESSION_KEY) === "admin"; }
    catch { return false; }
}
function adminLoginPage() {
    $("#app").innerHTML = '<section class="admin-login"><a class="back-link" href="../index.html">' + icon("arrow-left") + 'Back to events</a>' +
        '<p class="eyebrow">SoundWave / Management</p><h1>Admin sign in</h1>' +
        '<p class="muted">Demo access only. This login does not secure a public website.</p>' +
        '<form id="adminLoginForm" class="form-stack"><label for="adminUsername">Username</label>' +
        '<input id="adminUsername" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="100" required>' +
        '<label for="adminPassword">Password</label><input id="adminPassword" name="password" type="password" autocomplete="current-password" maxlength="100" required>' +
        '<p id="adminLoginError" class="login-error" role="alert"></p>' +
        '<button class="primary-btn" type="submit">' + icon("log-in") + 'Sign in</button></form></section>';
    $("#adminLoginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (serverAvailable) {
            try {
                await requestJson(AUTH_URL, "admin_sign_in", { username: $("#adminUsername").value.trim(), password: $("#adminPassword").value });
                sessionStorage.setItem(ADMIN_SESSION_KEY, "admin");
                adminPage(); refreshIcons(); $("#adminLogoutBtn").focus(); toast("Signed in as admin.");
            } catch (error) {
                $("#adminLoginError").textContent = error.message;
                $("#adminPassword").value = "";
                $("#adminPassword").focus();
            }
            return;
        }
        if ($("#adminUsername").value.trim() !== "admin" || $("#adminPassword").value !== "admin123") {
            $("#adminLoginError").textContent = "Incorrect username or password.";
            $("#adminPassword").value = "";
            $("#adminPassword").focus();
            return;
        }
        try { sessionStorage.setItem(ADMIN_SESSION_KEY, "admin"); }
        catch { $("#adminLoginError").textContent = "Please allow browser storage to sign in."; return; }
        adminPage(); refreshIcons(); $("#adminLogoutBtn").focus(); toast("Signed in as admin.");
    });
    refreshIcons();
}
function adminPage() {
    if (!adminSignedIn()) { adminLoginPage(); return; }
    $("#app").innerHTML = '<div class="page-heading"><p class="eyebrow">SoundWave / Management</p><h1>Events</h1><p class="muted">' + (serverAvailable ? 'Database editor. Changes are saved to RDS.' : 'Local demo editor. Changes apply only to this browser.') + '</p></div><div class="admin-layout">' +
        '<section><div class="section-title"><h2>Event catalogue</h2><span id="adminCount" class="muted"></span></div><div id="adminEvents"></div></section>' +
        '<section class="editor"><h2 id="editorTitle">Add event</h2><form id="eventForm" class="form-stack"><input id="eventId" type="hidden"><label for="eventName">Artist / event</label><input id="eventName" required maxlength="120">' +
        '<div class="form-pair"><div><label for="eventDate">Date</label><input id="eventDate" type="date" required></div><div><label for="eventTime">Time</label><input id="eventTime" type="time" required></div></div>' +
        '<label for="eventVenue">Venue</label><input id="eventVenue" required maxlength="150"><label for="eventCity">City, country</label><input id="eventCity" required maxlength="150">' +
        '<label for="eventPrice">Price per ticket (USD)</label><input id="eventPrice" type="number" min="0.01" max="100000" step="0.01" required>' +
        '<div class="button-row"><button class="primary-btn" type="submit">' + icon("save") + 'Save event</button><button class="secondary-btn" type="button" id="clearEvent">' + icon("plus") + 'New event</button></div></form></section></div>';
    $(".page-heading").insertAdjacentHTML("beforeend", '<button id="adminLogoutBtn" class="secondary-btn" type="button">' + icon("log-out") + 'Sign out of admin</button>');
    $("#adminLogoutBtn").addEventListener("click", async () => {
        if (serverAvailable) {
            try { await requestJson(AUTH_URL, "admin_sign_out"); }
            catch (error) { toast(error.message); return; }
        }
        try { sessionStorage.removeItem(ADMIN_SESSION_KEY); }
        catch { toast("Unable to sign out. Please try again."); return; }
        adminLoginPage(); $("#adminUsername").focus(); toast("Admin signed out.");
    });
    $("#clearEvent").addEventListener("click", clearEditor);
    $("#eventForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!adminSignedIn()) { adminLoginPage(); return; }
        const nextEvent = { id: $("#eventId").value || id("event"), name: $("#eventName").value.trim(), date: $("#eventDate").value, time: $("#eventTime").value, venue: $("#eventVenue").value.trim(), city: $("#eventCity").value.trim(), price: Number($("#eventPrice").value) };
        if (!validEvent(nextEvent) || !nextEvent.name || !nextEvent.venue || !nextEvent.city || nextEvent.price > 100000) { toast("Complete all event fields with a valid price."); return; }
        if (serverAvailable) {
            const wasEditing = Boolean($("#eventId").value);
            try {
                const data = await requestJson(API_URL, "save_event", nextEvent);
                applyServerState(data);
                clearEditor(); renderAdminEvents(); toast(wasEditing ? "Event updated." : "Event added.");
            } catch (error) {
                toast(error.message);
            }
            return;
        }
        const previous = events.find((event) => event.id === nextEvent.id);
        if (previous && previous.price !== nextEvent.price && bookings.some((b) => b.concertId === previous.id)) {
            toast("This event has bookings. Cancel those bookings before changing its price."); return;
        }
        const next = previous ? events.map((event) => event.id === nextEvent.id ? nextEvent : event) : [...events, nextEvent];
        if (save(KEYS.events, next)) { events = next; clearEditor(); renderAdminEvents(); toast(previous ? "Event updated." : "Event added."); }
    });
    $("#adminEvents").addEventListener("click", (e) => {
        if (!adminSignedIn()) { adminLoginPage(); return; }
        const button = e.target.closest("[data-event-id]");
        if (!button) return;
        const event = events.find((item) => item.id === button.dataset.eventId);
        if (!event) return;
        if (button.dataset.action === "edit") {
            $("#eventId").value = event.id; $("#eventName").value = event.name; $("#eventDate").value = event.date;
            $("#eventTime").value = event.time; $("#eventVenue").value = event.venue; $("#eventCity").value = event.city; $("#eventPrice").value = event.price;
            $("#editorTitle").textContent = "Edit event"; $("#eventName").focus();
        } else {
            if (bookings.some((b) => b.concertId === event.id)) { toast("This event has bookings. Cancel them in My tickets before deleting the event."); return; }
            if (!confirm("Delete " + event.name + " on " + dateText(event.date) + "?")) return;
            if (serverAvailable) {
                requestJson(API_URL, "delete_event", { id: event.id })
                    .then((data) => { applyServerState(data); if ($("#eventId").value === event.id) clearEditor(); renderAdminEvents(); toast("Event deleted."); })
                    .catch((error) => toast(error.message));
                return;
            }
            const next = events.filter((item) => item.id !== event.id);
            if (save(KEYS.events, next)) { events = next; if ($("#eventId").value === event.id) clearEditor(); renderAdminEvents(); toast("Event deleted."); }
        }
    });
    renderAdminEvents();
}
function clearEditor() { $("#eventForm").reset(); $("#eventId").value = ""; $("#editorTitle").textContent = "Add event"; }
function renderAdminEvents() {
    $("#adminCount").textContent = events.length + " events";
    $("#adminEvents").innerHTML = events.length ? [...events].sort((a, b) => a.date.localeCompare(b.date)).map((event) =>
        '<article class="admin-event">' + dateBadge(event) + '<div class="event-main"><a class="event-name" href="' + eventLink(event) + '">' + html(event.name) + '</a><p>' + html(event.venue) + '</p><p>' + html(event.city) + ' / ' + money(event.price) + '</p></div><div class="row-actions"><button class="icon-btn" data-action="edit" data-event-id="' + html(event.id) + '" title="Edit event" aria-label="Edit event">' + icon("pencil") + '</button><button class="icon-btn danger-link" data-action="delete" data-event-id="' + html(event.id) + '" title="Delete event" aria-label="Delete event">' + icon("trash-2") + '</button></div></article>'
    ).join("") : '<div class="empty-state">No events. Add your first event using the form.</div>';
    refreshIcons();
}
async function init() {
    await loadServerState();
    shell();
    ({ events: eventsPage, signin: signInPage, account: profilePage, register: createAccountPage, tickets: ticketsPage, signout: signoutPage, admin: adminPage }[PAGE] || eventsPage)();
    refreshIcons();
}
init();
