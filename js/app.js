const GLAMORA_USERS_KEY = "glamoraUsers";
const GLAMORA_SESSION_KEY = "glamoraSession";
const GLAMORA_APPOINTMENTS_KEY = "glamoraAppointments";

const services = [
    { id: "haircut", name: "Signature Haircut", description: "A consultation-led cut and finish tailored to your style.", price: 1200, duration: 45, icon: "✂" },
    { id: "color", name: "Hair Color", description: "A considered color refresh with a polished salon finish.", price: 3500, duration: 120, icon: "◈" },
    { id: "beard", name: "Beard Styling", description: "Precision shaping and grooming for a clean, confident look.", price: 700, duration: 30, icon: "✦" },
    { id: "skin", name: "Signature Facial", description: "A restorative facial designed around your skin-care needs.", price: 1500, duration: 50, icon: "♡" }
];

const stylists = ["Any available stylist", "Aarav Mehta", "Ishita Rao", "Kabir Shah"];
const timeSlots = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const currentPage = document.body.dataset.page;

function readStorage(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error(`Could not read GLAMORA storage key "${key}":`, error);
        return fallback;
    }
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const bytes = window.crypto.getRandomValues(new Uint16Array(8));
        return Array.from(bytes, value => value.toString(16).padStart(4, "0")).join("-");
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getCurrentUser() {
    const raw = sessionStorage.getItem(GLAMORA_SESSION_KEY) ||
        localStorage.getItem(GLAMORA_SESSION_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error("Could not read the GLAMORA demo session:", error);
        return null;
    }
}

function getAppointments() {
    const appointments = readStorage(GLAMORA_APPOINTMENTS_KEY, []);
    return Array.isArray(appointments) ? appointments : [];
}

function saveAppointments(appointments) {
    localStorage.setItem(GLAMORA_APPOINTMENTS_KEY, JSON.stringify(appointments));
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatPrice(price) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(price);
}

function formatDate(date) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function displayNameForStylist(stylist) {
    return stylist === "any" ? "First available stylist" : stylist;
}

function getService(id) {
    return services.find(service => service.id === id);
}

function setMessage(element, message, isError) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", Boolean(isError));
}

function setupHeader() {
    const user = getCurrentUser();
    const actions = document.querySelector("[data-header-actions]");
    if (!actions) return;

    if (user) {
        actions.innerHTML = `
            <a href="dashboard.html" class="action-primary">${escapeHtml(user.name.split(" ")[0])}</a>
            <button type="button" class="logout-button" data-logout>Sign out</button>
        `;
    } else {
        actions.innerHTML = `
            <a href="../login.html">Sign in</a>
            <a href="../signup.html" class="action-primary">Join GLAMORA</a>
        `;
    }

    const activePage = currentPage;
    document.querySelectorAll("[data-page-link]").forEach(link => {
        if (link.dataset.pageLink === activePage) {
            link.setAttribute("aria-current", "page");
        }
    });

    const logout = document.querySelector("[data-logout]");
    if (logout) {
        logout.addEventListener("click", () => {
            sessionStorage.removeItem(GLAMORA_SESSION_KEY);
            localStorage.removeItem(GLAMORA_SESSION_KEY);
            window.location.href = "../index.html";
        });
    }
}

function requireUser() {
    const user = getCurrentUser();
    if (!user) {
        const returnPath = `pages/${currentPage}.html${window.location.search}`;
        window.location.href = `../login.html?next=${encodeURIComponent(returnPath)}`;
        return null;
    }
    return user;
}

function renderServices() {
    const grid = document.getElementById("serviceGrid");
    if (!grid) return;

    grid.innerHTML = services.map(service => `
        <article class="card service-card">
            <div class="service-icon" aria-hidden="true">${service.icon}</div>
            <h2>${escapeHtml(service.name)}</h2>
            <p>${escapeHtml(service.description)}</p>
            <div class="service-meta">
                <span>${formatPrice(service.price)}</span>
                <span>${service.duration} min</span>
            </div>
            <a class="button-secondary" href="booking.html?service=${encodeURIComponent(service.id)}">Book this service ↗</a>
        </article>
    `).join("");
}

function setupBooking(user) {
    const form = document.getElementById("bookingForm");
    if (!form) return;

    const serviceSelect = document.getElementById("bookingService");
    const dateInput = document.getElementById("bookingDate");
    const stylistSelect = document.getElementById("bookingStylist");
    const timeSelect = document.getElementById("bookingTime");
    const selectedService = new URLSearchParams(window.location.search).get("service");
    const selectedStyle = new URLSearchParams(window.location.search).get("style");
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const tomorrow = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const today = new Date();
    dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    dateInput.value = tomorrow;

    serviceSelect.innerHTML = `<option value="">Choose a service</option>` +
        services.map(service => `<option value="${service.id}">${escapeHtml(service.name)}</option>`).join("");
    if (getService(selectedService)) serviceSelect.value = selectedService;
    if (selectedStyle) {
        const styleNotes = document.getElementById("bookingNotes");
        const styleNames = {
            classic: "The considered classic",
            bob: "Modern bob",
            pixie: "Textured pixie",
            fade: "Taper fade",
            layers: "Soft layered look",
            curls: "Defined curls",
            balayage: "Soft balayage",
            gloss: "Gloss and tone",
            boldcolor: "Bold color refresh",
            beardshape: "Defined beard shape",
            beardfade: "Beard fade",
            fullbeard: "Full beard refine"
        };
        if (styleNames[selectedStyle]) {
            styleNotes.value = `Desired style: ${styleNames[selectedStyle]}`;
        }
    }

    stylistSelect.innerHTML = stylists.map((stylist, index) =>
        `<option value="${index === 0 ? "any" : escapeHtml(stylist)}">${escapeHtml(stylist)}</option>`
    ).join("");

    const updateSummary = () => {
        const service = getService(serviceSelect.value);
        document.getElementById("summaryService").textContent = service ? service.name : "Not selected";
        document.getElementById("summaryDuration").textContent = service ? `${service.duration} minutes` : "—";
        document.getElementById("summaryPrice").textContent = service ? formatPrice(service.price) : "—";
        document.getElementById("summaryStylist").textContent = displayNameForStylist(stylistSelect.value);
    };

    const refreshTimeSlots = () => {
        const selectedTime = timeSelect.value;
        const currentTime = new Date();
        const todayString = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, "0")}-${String(currentTime.getDate()).padStart(2, "0")}`;
        const currentTimeString = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
        const appointments = getAppointments();

        timeSelect.innerHTML = `<option value="">Choose a time</option>` +
            timeSlots.map(time => {
                const hasPassed = dateInput.value === todayString && time <= currentTimeString;
                const isBooked = appointments.some(appointment =>
                    appointment.status !== "cancelled" &&
                    appointment.date === dateInput.value &&
                    appointment.time === time &&
                    (stylistSelect.value === "any" || appointment.stylist === "any" || appointment.stylist === stylistSelect.value)
                );
                const disabled = hasPassed || isBooked;
                const label = hasPassed ? " — Passed" : isBooked ? " — Booked" : "";
                return `<option value="${time}"${disabled ? " disabled" : ""}>${time}${label}</option>`;
            }).join("");

        if (timeSlots.includes(selectedTime) && !timeSelect.querySelector(`option[value="${selectedTime}"]`).disabled) {
            timeSelect.value = selectedTime;
        }
    };

    serviceSelect.addEventListener("change", updateSummary);
    dateInput.addEventListener("change", refreshTimeSlots);
    stylistSelect.addEventListener("change", () => {
        updateSummary();
        refreshTimeSlots();
    });
    updateSummary();
    refreshTimeSlots();

    form.addEventListener("submit", event => {
        event.preventDefault();
        const message = document.getElementById("bookingMessage");
        const service = getService(serviceSelect.value);
        const selectedDate = dateInput.value;
        const selectedTime = timeSelect.value;
        const selectedStylist = stylistSelect.value;

        if (!service || !selectedDate || !selectedTime) {
            setMessage(message, "Choose a service, date, and time to continue.", true);
            return;
        }

        if (selectedDate < dateInput.min) {
            setMessage(message, "Please choose today or a future date.", true);
            return;
        }

        const appointments = getAppointments();
        const slotTaken = appointments.some(appointment =>
            appointment.status !== "cancelled" &&
            appointment.date === selectedDate &&
            appointment.time === selectedTime &&
            (selectedStylist === "any" || appointment.stylist === "any" || appointment.stylist === selectedStylist)
        );

        if (slotTaken) {
            setMessage(message, "That time is already booked. Please choose another slot.", true);
            return;
        }

        try {
            appointments.push({
                id: createId(),
                userId: user.id,
                serviceId: service.id,
                date: selectedDate,
                time: selectedTime,
                stylist: selectedStylist,
                notes: document.getElementById("bookingNotes").value.trim(),
                status: "confirmed",
                createdAt: new Date().toISOString()
            });
            saveAppointments(appointments);
            window.location.href = "appointments.html?booked=1";
        } catch (error) {
            console.error("Could not save this demo appointment:", error);
            setMessage(message, "The appointment could not be saved in this browser.", true);
        }
    });
}

function getUserAppointments(user) {
    return getAppointments()
        .filter(appointment => appointment.userId === user.id)
        .sort((first, second) =>
            `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`)
        );
}

function appointmentCard(appointment, showCancel) {
    const service = getService(appointment.serviceId);
    const cancelled = appointment.status === "cancelled";
    const serviceName = service ? service.name : "Salon appointment";
    const price = service ? formatPrice(service.price) : "";

    return `
        <article class="card appointment-card">
            <div>
                <h3>${escapeHtml(serviceName)}</h3>
                <div class="appointment-details">
                    <span>${formatDate(appointment.date)} · ${escapeHtml(appointment.time)}</span>
                    <span>${escapeHtml(displayNameForStylist(appointment.stylist))}</span>
                    <span>${price}</span>
                    <span class="status${cancelled ? " cancelled" : ""}">${cancelled ? "Cancelled" : "Confirmed"}</span>
                </div>
                ${appointment.notes ? `<p class="field-hint">Note: ${escapeHtml(appointment.notes)}</p>` : ""}
            </div>
            ${showCancel && !cancelled ? `
                <div class="appointment-actions">
                    <button class="button button-danger" type="button" data-cancel="${escapeHtml(appointment.id)}">Cancel booking</button>
                </div>
            ` : ""}
        </article>
    `;
}

function renderAppointments(user, target, showCancel, appointments) {
    const list = document.getElementById(target);
    if (!list) return;

    if (appointments.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <h2>Your next great look is waiting.</h2>
                <p>You don't have any appointments yet. Choose a service and we'll take it from there.</p>
                <a class="button" href="services.html">Explore services ↗</a>
            </div>
        `;
        return;
    }

    const visibleAppointments = showCancel
        ? appointments
        : appointments.filter(appointment => appointment.status !== "cancelled");
    if (visibleAppointments.length === 0) {
        list.innerHTML = `<div class="empty-state"><h2>No upcoming appointments.</h2><p>Your cancelled bookings will remain available in your appointment history.</p><a class="button" href="services.html">Explore services ↗</a></div>`;
        return;
    }

    list.innerHTML = visibleAppointments.map(appointment =>
        appointmentCard(appointment, showCancel)
    ).join("");

    list.querySelectorAll("[data-cancel]").forEach(button => {
        button.addEventListener("click", () => {
            const appointmentsNow = getAppointments();
            const selected = appointmentsNow.find(item =>
                item.id === button.dataset.cancel && item.userId === user.id
            );
            if (!selected || selected.status === "cancelled") return;
            if (!window.confirm("Cancel this appointment?")) return;

            selected.status = "cancelled";
            try {
                saveAppointments(appointmentsNow);
                initializePage();
            } catch (error) {
                console.error("Could not cancel this demo appointment:", error);
                window.alert("The appointment could not be updated in this browser.");
            }
        });
    });
}

function setupAppointments(user, appointments) {
    const notice = document.getElementById("appointmentsNotice");
    if (new URLSearchParams(window.location.search).has("booked")) {
        setMessage(notice, "Your appointment is confirmed in this browser.", false);
    }
    renderAppointments(user, "appointmentsList", true, appointments);
}

function setupDashboard(user, appointments) {
    document.getElementById("welcomeName").textContent = user.name.split(" ")[0];
    document.getElementById("appointmentCount").textContent =
        appointments.filter(appointment => appointment.status !== "cancelled").length;
    document.getElementById("completedCount").textContent =
        appointments.filter(appointment => appointment.status === "completed").length;
    const nextAppointment = appointments.find(appointment =>
        appointment.status === "confirmed" && appointment.date >= new Date().toISOString().slice(0, 10)
    );
    document.getElementById("nextAppointment").textContent =
        nextAppointment ? formatDate(nextAppointment.date) : "—";
    renderAppointments(user, "recentAppointments", false, appointments.slice(0, 3));

    const profileForm = document.getElementById("profileForm");
    document.getElementById("profileName").value = user.name;
    document.getElementById("profilePhone").value = user.phone || "";
    profileForm.addEventListener("submit", event => {
        event.preventDefault();
        const message = document.getElementById("profileMessage");
        const name = document.getElementById("profileName").value.trim();
        const phone = document.getElementById("profilePhone").value.trim();
        if (!name || !/^\d{10}$/.test(phone)) {
            setMessage(message, "Enter your name and a valid 10-digit phone number.", true);
            return;
        }

        try {
            const users = readStorage(GLAMORA_USERS_KEY, []);
            const account = users.find(item => item.id === user.id);
            if (!account) {
                setMessage(message, "This demo account could not be found in this browser.", true);
                return;
            }

            account.name = name;
            account.phone = phone;
            localStorage.setItem(GLAMORA_USERS_KEY, JSON.stringify(users));

            const updatedUser = { ...user, name, phone };
            const persistentSession = localStorage.getItem(GLAMORA_SESSION_KEY);
            const sessionTarget = persistentSession ? localStorage : sessionStorage;
            sessionTarget.setItem(GLAMORA_SESSION_KEY, JSON.stringify(updatedUser));
            setMessage(message, "Your profile has been updated.", false);
            document.getElementById("welcomeName").textContent = name.split(" ")[0];
            setupHeader();
        } catch (error) {
            console.error("Could not update the demo profile:", error);
            setMessage(message, "Your profile could not be saved in this browser.", true);
        }
    });
}

function initializePage() {
    setupHeader();
    renderServices();

    if (["booking", "appointments", "dashboard"].includes(currentPage)) {
        const user = requireUser();
        if (!user) return;
        let appointments;
        try {
            appointments = getUserAppointments(user);
        } catch (error) {
            console.error("Could not load demo appointments:", error);
            const message = document.getElementById("bookingMessage") ||
                document.getElementById("appointmentsNotice");
            setMessage(message, "Saved data could not be read. Please refresh or clear this site's demo data.", true);
            return;
        }

        if (currentPage === "booking") setupBooking(user);
        if (currentPage === "appointments") setupAppointments(user, appointments);
        if (currentPage === "dashboard") setupDashboard(user, appointments);
    }
}

initializePage();
