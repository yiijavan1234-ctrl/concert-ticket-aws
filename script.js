const STORAGE_KEYS = {
    profile: "soundwave.profile",
    bookings: "soundwave.bookings"
};

const concerts = [
    {
        id: "weeknd-kuala-lumpur-2026-11-04",
        name: "The Weeknd",
        date: "Wed, Nov 04, 2026",
        month: "Nov",
        day: "04",
        time: "8:30 PM",
        venue: "Bukit Jalil National Stadium",
        city: "Kuala Lumpur, Malaysia",
        price: 149,
        badge: "Selling fast",
        tags: ["Mobile tickets", "Clear view"]
    },
    {
        id: "weeknd-kuala-lumpur-2026-11-05",
        name: "The Weeknd",
        date: "Thu, Nov 05, 2026",
        month: "Nov",
        day: "05",
        time: "8:30 PM",
        venue: "Bukit Jalil National Stadium",
        city: "Kuala Lumpur, Malaysia",
        price: 138,
        originalPrice: 165,
        badge: "17% OFF",
        tags: ["2 tickets together", "Best value"]
    },
    {
        id: "weeknd-singapore-2026-10-02",
        name: "The Weeknd",
        date: "Fri, Oct 02, 2026",
        month: "Oct",
        day: "02",
        time: "8:00 PM",
        venue: "Singapore National Stadium",
        city: "Singapore, Singapore",
        price: 191,
        badge: "Last tickets",
        tags: ["Instant download", "Seated together"]
    },
    {
        id: "weeknd-bangkok-2026-10-12",
        name: "The Weeknd",
        date: "Mon, Oct 12, 2026",
        month: "Oct",
        day: "12",
        time: "8:00 PM",
        venue: "Rajamangala National Stadium",
        city: "Bangkok, Thailand",
        price: 126,
        tags: ["Fan favourite", "No extra fees"]
    }
];

const elements = {
    profileForm: document.querySelector("#profileForm"),
    profileId: document.querySelector("#profileId"),
    fullName: document.querySelector("#fullName"),
    email: document.querySelector("#email"),
    phone: document.querySelector("#phone"),
    city: document.querySelector("#city"),
    saveProfileBtn: document.querySelector("#saveProfileBtn"),
    deleteProfileBtn: document.querySelector("#deleteProfileBtn"),
    profileSummary: document.querySelector("#profileSummary"),
    profileGreeting: document.querySelector("#profileGreeting"),
    concertSearch: document.querySelector("#concertSearch"),
    concertList: document.querySelector("#concertList"),
    bookingRows: document.querySelector("#bookingRows"),
    emptyBookings: document.querySelector("#emptyBookings"),
    editBookingDialog: document.querySelector("#editBookingDialog"),
    editBookingForm: document.querySelector("#editBookingForm"),
    editBookingId: document.querySelector("#editBookingId"),
    editQuantity: document.querySelector("#editQuantity"),
    cancelEditBtn: document.querySelector("#cancelEditBtn"),
    toast: document.querySelector("#toast")
};

let profile = readFromStorage(STORAGE_KEYS.profile, null);
let bookings = readFromStorage(STORAGE_KEYS.bookings, []);
let toastTimer = null;

function readFromStorage(key, fallbackValue) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallbackValue;
    } catch (error) {
        console.warn(`Could not read ${key}`, error);
        return fallbackValue;
    }
}

function writeToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function money(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(value);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        elements.toast.classList.remove("show");
    }, 2600);
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findConcert(concertId) {
    return concerts.find((concert) => concert.id === concertId);
}

function renderConcerts(searchText = "") {
    const normalizedSearch = searchText.trim().toLowerCase();
    const visibleConcerts = concerts.filter((concert) => {
        const searchableText = `${concert.name} ${concert.date} ${concert.time} ${concert.venue} ${concert.city}`.toLowerCase();
        return searchableText.includes(normalizedSearch);
    });

    if (visibleConcerts.length === 0) {
        elements.concertList.innerHTML = `<div class="no-results">No matching events found.</div>`;
        return;
    }

    elements.concertList.innerHTML = visibleConcerts.map((concert) => {
        const price = concert.originalPrice
            ? `<p class="price"><s>${money(concert.originalPrice)}</s>${money(concert.price)}</p>`
            : `<p class="price">${money(concert.price)}</p>`;
        const tags = [
            ...(concert.tags || []),
            ...(concert.badge ? [concert.badge] : [])
        ];

        return `
            <article class="concert-card">
                <div class="date-badge" aria-hidden="true">
                    <span>${escapeHtml(concert.month)}</span>
                    <strong>${escapeHtml(concert.day)}</strong>
                </div>
                <div class="event-main">
                    <h3>${escapeHtml(concert.name)}</h3>
                    <p class="concert-meta">${escapeHtml(concert.date)} - ${escapeHtml(concert.time)}</p>
                    <p class="concert-meta">${escapeHtml(concert.venue)}</p>
                    <p class="concert-meta">${escapeHtml(concert.city)}</p>
                    <div class="event-tags">
                        ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
                    </div>
                </div>
                <div class="event-actions">
                    ${price}
                    <form class="booking-form" data-concert-id="${concert.id}">
                        <label>
                            Tickets
                            <input type="number" name="quantity" min="1" max="5" value="1" required>
                        </label>
                        <button class="primary-btn" type="submit">See tickets</button>
                    </form>
                </div>
            </article>
        `;
    }).join("");

    bindBookingForms();
}

function renderProfile() {
    if (!profile) {
        elements.profileForm.reset();
        elements.profileId.value = "";
        elements.saveProfileBtn.textContent = "Save profile";
        elements.deleteProfileBtn.disabled = true;
        elements.profileGreeting.textContent = "Create your profile to start booking.";
        elements.profileSummary.innerHTML = "No profile saved yet.";
        return;
    }

    elements.profileId.value = profile.id;
    elements.fullName.value = profile.fullName;
    elements.email.value = profile.email;
    elements.phone.value = profile.phone;
    elements.city.value = profile.city || "";
    elements.saveProfileBtn.textContent = "Update profile";
    elements.deleteProfileBtn.disabled = false;
    elements.profileGreeting.textContent = `Welcome back, ${profile.fullName}.`;
    elements.profileSummary.innerHTML = `
        <strong>${escapeHtml(profile.fullName)}</strong><br>
        ${escapeHtml(profile.email)}<br>
        ${escapeHtml(profile.phone)}${profile.city ? `<br>${escapeHtml(profile.city)}` : ""}
    `;
}

function renderBookings() {
    elements.emptyBookings.hidden = bookings.length > 0;

    elements.bookingRows.innerHTML = bookings.map((booking) => {
        const concert = findConcert(booking.concertId);
        if (!concert) {
            return "";
        }

        return `
            <tr>
                <td>${escapeHtml(concert.name)}</td>
                <td>${escapeHtml(concert.date)}</td>
                <td>${booking.quantity}</td>
                <td>${money(booking.quantity * concert.price)}</td>
                <td>
                    <div class="row-actions">
                        <button class="icon-btn" type="button" data-action="edit" data-booking-id="${booking.id}" aria-label="Edit ${concert.name} booking">Edit</button>
                        <button class="icon-btn delete" type="button" data-action="delete" data-booking-id="${booking.id}" aria-label="Delete ${concert.name} booking">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function saveProfile(event) {
    event.preventDefault();

    profile = {
        id: elements.profileId.value || createId("profile"),
        fullName: elements.fullName.value.trim(),
        email: elements.email.value.trim(),
        phone: elements.phone.value.trim(),
        city: elements.city.value.trim()
    };

    writeToStorage(STORAGE_KEYS.profile, profile);
    renderProfile();
    showToast("Profile saved.");
}

function deleteProfile() {
    if (!profile) {
        return;
    }

    const confirmed = confirm("Delete your profile and all saved bookings?");
    if (!confirmed) {
        return;
    }

    profile = null;
    bookings = [];
    localStorage.removeItem(STORAGE_KEYS.profile);
    writeToStorage(STORAGE_KEYS.bookings, bookings);
    renderProfile();
    renderBookings();
    showToast("Profile and bookings deleted.");
}

function createBooking(event) {
    event.preventDefault();

    if (!profile) {
        showToast("Create your profile before booking.");
        elements.fullName.focus();
        return;
    }

    const form = event.currentTarget;
    const concertId = form.dataset.concertId;
    const quantity = Number(form.quantity.value);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
        showToast("Choose 1 to 5 tickets.");
        return;
    }

    const existingBooking = bookings.find((booking) => booking.concertId === concertId);

    if (existingBooking) {
        existingBooking.quantity = Math.min(existingBooking.quantity + quantity, 5);
        showToast("Booking updated.");
    } else {
        bookings.push({
            id: createId("booking"),
            concertId,
            quantity,
            createdAt: new Date().toISOString()
        });
        showToast("Booking created.");
    }

    writeToStorage(STORAGE_KEYS.bookings, bookings);
    renderBookings();
    form.reset();
}

function openEditBooking(bookingId) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) {
        return;
    }

    elements.editBookingId.value = booking.id;
    elements.editQuantity.value = booking.quantity;
    elements.editBookingDialog.showModal();
}

function updateBooking(event) {
    event.preventDefault();

    const bookingId = elements.editBookingId.value;
    const quantity = Number(elements.editQuantity.value);
    const booking = bookings.find((item) => item.id === bookingId);

    if (!booking || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
        showToast("Choose 1 to 5 tickets.");
        return;
    }

    booking.quantity = quantity;
    writeToStorage(STORAGE_KEYS.bookings, bookings);
    renderBookings();
    elements.editBookingDialog.close();
    showToast("Booking updated.");
}

function deleteBooking(bookingId) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking) {
        return;
    }

    const concert = findConcert(booking.concertId);
    const confirmed = confirm(`Delete booking for ${concert ? concert.name : "this event"}?`);
    if (!confirmed) {
        return;
    }

    bookings = bookings.filter((item) => item.id !== bookingId);
    writeToStorage(STORAGE_KEYS.bookings, bookings);
    renderBookings();
    showToast("Booking deleted.");
}

function handleBookingAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const bookingId = button.dataset.bookingId;

    if (button.dataset.action === "edit") {
        openEditBooking(bookingId);
        return;
    }

    if (button.dataset.action === "delete") {
        deleteBooking(bookingId);
    }
}

function bindEvents() {
    elements.profileForm.addEventListener("submit", saveProfile);
    elements.deleteProfileBtn.addEventListener("click", deleteProfile);
    elements.bookingRows.addEventListener("click", handleBookingAction);
    elements.editBookingForm.addEventListener("submit", updateBooking);
    elements.cancelEditBtn.addEventListener("click", () => elements.editBookingDialog.close());
    elements.concertSearch.addEventListener("input", () => renderConcerts(elements.concertSearch.value));
}

function bindBookingForms() {
    document.querySelectorAll(".booking-form").forEach((form) => {
        form.addEventListener("submit", createBooking);
    });
}

function init() {
    renderConcerts();
    renderProfile();
    renderBookings();
    bindEvents();
}

init();
