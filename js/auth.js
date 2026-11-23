const USERS_KEY = "glamoraUsers";
const SESSION_KEY = "glamoraSession";
const PASSWORD_ITERATIONS = 120000;

function showMessage(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("error", isError);
}

function readUsers() {
    const savedUsers = localStorage.getItem(USERS_KEY);
    if (!savedUsers) return [];
    let users;
    try {
        users = JSON.parse(savedUsers);
    } catch (error) {
        throw new Error("Saved account data is invalid.");
    }
    if (!Array.isArray(users)) throw new Error("Saved account data is invalid.");
    return users;
}

function createUserId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const bytes = window.crypto.getRandomValues(new Uint16Array(8));
        return Array.from(bytes, value => value.toString(16).padStart(4, "0")).join("-");
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function setSubmitting(form, submitting) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = submitting;
    button.setAttribute("aria-busy", submitting ? "true" : "false");
}

function base64FromBytes(bytes) {
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
}

async function hashPassword(password, saltBytes) {
    if (!window.crypto || !window.crypto.subtle) {
        const salt = saltBytes || (window.crypto && typeof window.crypto.getRandomValues === "function"
            ? window.crypto.getRandomValues(new Uint8Array(16))
            : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)));
        let hash = 2166136261;
        const value = new Uint8Array(salt.length + new TextEncoder().encode(password).length);
        value.set(salt, 0);
        value.set(new TextEncoder().encode(password), salt.length);
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value[index];
            hash = Math.imul(hash, 16777619);
        }
        return {
            salt: base64FromBytes(salt),
            hash: (hash >>> 0).toString(16).padStart(8, "0")
        };
    }

    const salt = saltBytes || window.crypto.getRandomValues(new Uint8Array(16));
    const key = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const hash = await window.crypto.subtle.deriveBits({
        name: "PBKDF2",
        salt,
        iterations: PASSWORD_ITERATIONS,
        hash: "SHA-256"
    }, key, 256);

    return {
        salt: base64FromBytes(salt),
        hash: base64FromBytes(new Uint8Array(hash))
    };
}

function constantTimeMatch(first, second) {
    if (first.length !== second.length) return false;
    let difference = 0;
    for (let index = 0; index < first.length; index += 1) {
        difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
    }
    return difference === 0;
}

function showStorageError(element, error, action) {
    console.error(`Could not ${action}:`, error);
    showMessage(element, "This browser could not save or read your account. Check browser storage and try again.", true);
}

function getPostLoginPath() {
    const requestedPath = new URLSearchParams(window.location.search).get("next") || "";
    if (/^pages\/booking\.html(?:\?service=(?:haircut|color|beard|skin)(?:&style=(?:classic|bob|pixie|fade|layers|curls|balayage|gloss|boldcolor|beardshape|beardfade|fullbeard))?)?$/.test(requestedPath)) {
        return requestedPath;
    }
    if (["pages/appointments.html", "pages/dashboard.html"].includes(requestedPath)) {
        return requestedPath;
    }
    return "pages/dashboard.html";
}

function setupPasswordToggle(buttonId, inputId) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    if (!button || !input) return;

    button.addEventListener("click", () => {
        const hidden = input.type === "password";
        input.type = hidden ? "text" : "password";
        button.textContent = hidden ? "HIDE" : "SHOW";
        button.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
    });
}

setupPasswordToggle("togglePassword", "password");
setupPasswordToggle("toggleSignupPassword", "signupPassword");

const signupForm = document.getElementById("signupForm");
if (signupForm) {
    signupForm.addEventListener("submit", async event => {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("signupEmail").value.trim().toLowerCase();
        const phone = document.getElementById("phone").value.trim();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const message = document.getElementById("signupMessage");

        if (!name || !email || !phone || !password) {
            showMessage(message, "Please complete all fields.", true);
            return;
        }
        if (!/^\d{10}$/.test(phone)) {
            showMessage(message, "Enter a valid 10-digit phone number.", true);
            return;
        }
        if (password.length < 8) {
            showMessage(message, "Password must contain at least 8 characters.", true);
            return;
        }
        if (password !== confirmPassword) {
            showMessage(message, "Passwords do not match.", true);
            return;
        }

        setSubmitting(signupForm, true);
        try {
            const users = readUsers();
            if (users.some(user => user.email === email)) {
                showMessage(message, "This email is already registered in this browser.", true);
                return;
            }

            const passwordRecord = await hashPassword(password);
            const user = {
                id: createUserId(),
                name,
                email,
                phone,
                passwordSalt: passwordRecord.salt,
                passwordHash: passwordRecord.hash
            };
            users.push(user);
            localStorage.setItem(USERS_KEY, JSON.stringify(users));

            const session = { id: user.id, name: user.name, email: user.email, phone: user.phone };
            localStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
            showMessage(message, "Account created. Welcome to GLAMORA!");
            window.setTimeout(() => {
                window.location.href = "pages/dashboard.html";
            }, 500);
        } catch (error) {
            showStorageError(message, error, "create your account");
        } finally {
            setSubmitting(signupForm, false);
        }
    });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();
        setSubmitting(loginForm, true);

        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        const message = document.getElementById("loginMessage");

        try {
            const users = readUsers();
            const user = users.find(account => account.email === email);
            if (!user || !user.passwordSalt || !user.passwordHash) {
                showMessage(message, "No matching demo account was found. Create an account to continue.", true);
                setSubmitting(loginForm, false);
                return;
            }

            const salt = Uint8Array.from(atob(user.passwordSalt), character => character.charCodeAt(0));
            const passwordRecord = await hashPassword(password, salt);
            if (!constantTimeMatch(passwordRecord.hash, user.passwordHash)) {
                showMessage(message, "Email or password is incorrect.", true);
                setSubmitting(loginForm, false);
                return;
            }

            const session = { id: user.id, name: user.name, email: user.email, phone: user.phone };
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_KEY);
            const remember = document.getElementById("remember").checked;
            (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
            showMessage(message, "Signed in. Welcome back!");
            window.setTimeout(() => {
                window.location.href = getPostLoginPath();
            }, 500);
        } catch (error) {
            showStorageError(message, error, "sign in");
        } finally {
            setSubmitting(loginForm, false);
        }
    });
}

const forgotPassword = document.getElementById("forgotPassword");
if (forgotPassword) {
    forgotPassword.addEventListener("click", event => {
        event.preventDefault();
        showMessage(
            document.getElementById("loginMessage"),
            "Password recovery needs a verified email service and is not available in this local demo."
        );
    });
}
