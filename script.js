const STORAGE_KEYS = {
    profile: "soundwave.profile",
    bookings: "soundwave.bookings"
};

const concerts = [
    {
        id: "rock-fest-2026",
        name: "Rock Fest 2026",
        date: "Oct 12, 2026",
        venue: "Bukit Jalil National Stadium",
        price: 85,
        originalPrice: 100,
        badge: "15% OFF",
        initials: "RF"
    },
    {
        id: "jazz-stars-2026",
        name: "Jazz Under the Stars",
        date: "Nov 05, 2026",
        venue: "Kuala Lumpur Performing Arts Centre",
        price: 60,
        initials: "JS"
    },
    {
        id: "neon-pop-2026",
        name: "Neon Pop Night",
        date: "Dec 18, 2026",
        venue: "Axiata Arena",
        price: 72,
        initials: "NP"
    },
    {
        id: "indie-weekend-2027",
        name: "Indie Weekend Live",
        date: "Jan 23, 2027",
        venue: "Zepp Kuala Lumpur",
        price: 48,
        initials: "IW"
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

function renderConcerts() {
    elements.concertList.innerHTML = concerts.map((concert) => {
        const price = concert.originalPrice
            ? `<p class="price"><s>${money(concert.originalPrice)}</s>${money(concert.price)}</p>`
            : `<p class="price">${money(concert.price)}</p>`;
        const badge = concert.badge ? `<div class="badge">${concert.badge}</div>` : "";

        return `
            <article class="concert-card">
                ${badge}
                <div class="concert-art" aria-hidden="true">${concert.initials}</div>
                <h3>${concert.name}</h3>
                <p class="concert-meta">${concert.date}</p>
                <p class="concert-meta">${concert.venue}</p>
                ${price}
                <form class="booking-form" data-concert-id="${concert.id}">
                    <label>
                        Tickets
                        <input type="number" name="quantity" min="1" max="5" value="1" required>
                    </label>
                    <button class="primary-btn" type="submit">Book now</button>
                </form>
            </article>
        `;
    }).join("");
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
                <td>${concert.name}</td>
                <td>${concert.date}</td>
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
}

function init() {
    renderConcerts();
    renderProfile();
    renderBookings();
    bindEvents();

    document.querySelectorAll(".booking-form").forEach((form) => {
        form.addEventListener("submit", createBooking);
    });
}

init();
