const cameraVideo = document.getElementById("cameraVideo");
const cameraStage = document.querySelector(".camera-stage");
const startCameraButton = document.getElementById("startCamera");
const stopCameraButton = document.getElementById("stopCamera");
const captureCameraButton = document.getElementById("captureCamera");
const switchCameraButton = document.getElementById("switchCamera");
const discardCaptureButton = document.getElementById("discardCapture");
const downloadCaptureLink = document.getElementById("downloadCapture");
const capturePreview = document.getElementById("capturePreview");
const captureCanvas = document.getElementById("captureCanvas");
const cameraCapture = document.getElementById("cameraCapture");
const cameraLookOverlay = document.getElementById("cameraLookOverlay");
const cameraLookLabel = document.getElementById("cameraLookLabel");
const cameraFaceCanvas = document.getElementById("cameraFaceCanvas");
const cameraMessage = document.getElementById("cameraMessage");
let cameraStream;
let facingMode = "user";
let faceDetector = null;
let faceTrackingFrame = 0;
let detectedFace = null;
let activeHairEffect = "none";
let activeBeardEffect = "none";

const styleDirections = {
    classic: {
        title: "The considered classic",
        description: "A clean, versatile shape with a neat finish—easy to make your own.",
        serviceId: "haircut",
        serviceName: "Signature Haircut"
    },
    color: {
        title: "A fresh color story",
        description: "Subtle dimension and a polished finish for a refreshed take on your look.",
        serviceId: "color",
        serviceName: "Hair Color"
    },
    beard: {
        title: "Defined and detailed",
        description: "Thoughtful shaping and precise grooming to bring your features into focus.",
        serviceId: "beard",
        serviceName: "Beard Styling"
    },
    skin: {
        title: "A little reset",
        description: "A restorative facial ritual for a calm, refreshed feeling.",
        serviceId: "skin",
        serviceName: "Signature Facial"
    }
};

const hairstyleStyles = [
    { id: "classic", name: "The considered classic", category: "medium", categoryLabel: "Medium", description: "Clean lines and a versatile polished shape.", serviceId: "haircut", serviceName: "Signature Haircut", icon: "◒" },
    { id: "bob", name: "Modern bob", category: "medium", categoryLabel: "Medium", description: "A sharp, balanced bob with easy movement.", serviceId: "haircut", serviceName: "Signature Haircut", icon: "▰" },
    { id: "pixie", name: "Textured pixie", category: "short", categoryLabel: "Short", description: "A short, layered cut with soft texture.", serviceId: "haircut", serviceName: "Signature Haircut", icon: "✦" },
    { id: "fade", name: "Taper fade", category: "short", categoryLabel: "Short", description: "A precise fade that keeps natural length on top.", serviceId: "haircut", serviceName: "Signature Haircut", icon: "▥" },
    { id: "layers", name: "Soft layered look", category: "long", categoryLabel: "Long", description: "Face-framing layers with natural volume.", serviceId: "haircut", serviceName: "Signature Haircut", icon: "≋" },
    { id: "curls", name: "Defined curls", category: "medium", categoryLabel: "Medium", description: "A curl-friendly shape with shape and bounce.", serviceId: "haircut", serviceName: "Signature Haircut", icon: "◌" },
    { id: "balayage", name: "Soft balayage", category: "color", categoryLabel: "Color", description: "Dimensional, hand-painted lightness with a natural finish.", serviceId: "color", serviceName: "Hair Color", icon: "◈" },
    { id: "gloss", name: "Gloss and tone", category: "color", categoryLabel: "Color", description: "Rich tone and shine for an even, polished result.", serviceId: "color", serviceName: "Hair Color", icon: "✧" },
    { id: "boldcolor", name: "Bold color refresh", category: "color", categoryLabel: "Color", description: "A statement color planned around your skin tone.", serviceId: "color", serviceName: "Hair Color", icon: "◆" },
    { id: "beardshape", name: "Defined beard shape", category: "beard", categoryLabel: "Beard", description: "Clean cheek and neckline definition with balanced length.", serviceId: "beard", serviceName: "Beard Styling", icon: "◇" },
    { id: "beardfade", name: "Beard fade", category: "beard", categoryLabel: "Beard", description: "A smooth blend from beard to skin or sideburn.", serviceId: "beard", serviceName: "Beard Styling", icon: "▤" },
    { id: "fullbeard", name: "Full beard refine", category: "beard", categoryLabel: "Beard", description: "Length kept natural with precise edge detailing.", serviceId: "beard", serviceName: "Beard Styling", icon: "⬡" }
];

function showCameraMessage(message, isError) {
    cameraMessage.textContent = message;
    cameraMessage.classList.toggle("error", Boolean(isError));
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    cameraVideo.srcObject = null;
    cameraStage.classList.remove("is-active");
    startCameraButton.disabled = false;
    stopCameraButton.disabled = true;
    captureCameraButton.disabled = true;
    switchCameraButton.disabled = true;
}

async function startCamera() {
    const mediaDevices = navigator.mediaDevices;
    let getUserMedia = mediaDevices?.getUserMedia?.bind(mediaDevices);
    if (!getUserMedia) {
        const legacyGetUserMedia = navigator.getUserMedia?.bind(navigator)
            || navigator.webkitGetUserMedia?.bind(navigator)
            || navigator.mozGetUserMedia?.bind(navigator);
        if (legacyGetUserMedia) {
            getUserMedia = constraints => new Promise((resolve, reject) => {
                legacyGetUserMedia(constraints, resolve, reject);
            });
        }
    }

    if (!getUserMedia) {
        showCameraMessage("This browser does not expose camera access. Open GLAMORA in a recent Chrome, Edge, Firefox, or Safari window.", true);
        return;
    }
    if (!window.isSecureContext) {
        showCameraMessage("Camera access requires HTTPS or localhost. Open GLAMORA from a secure local server or HTTPS.", true);
        return;
    }

    startCameraButton.disabled = true;
    showCameraMessage("Waiting for camera permission…", false);

    try {
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const cameraPermission = await navigator.permissions.query({ name: "camera" });
                if (cameraPermission.state === "denied") {
                    showCameraMessage("Camera access is blocked for this site. Open the browser's site controls, allow Camera, then click Start camera again.", true);
                    stopCamera();
                    return;
                }
            } catch (permissionError) {
                console.warn("Could not query camera permission:", permissionError);
            }
        }

        let devices = [];
        try {
            devices = await mediaDevices.enumerateDevices();
        } catch (enumerationError) {
            console.warn("Could not enumerate camera devices:", enumerationError);
        }
        const videoDevices = devices.filter(device => device.kind === "videoinput");
        const constraints = {
            audio: false,
            video: videoDevices.length
                ? { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }
                : { facingMode: { ideal: facingMode } }
        };

        try {
            cameraStream = await getUserMedia(constraints);
        } catch (constraintError) {
            if (constraintError.name !== "OverconstrainedError" && constraintError.name !== "ConstraintNotSatisfiedError") {
                throw constraintError;
            }
            cameraStream = await getUserMedia({ audio: false, video: true });
        }
        cameraVideo.srcObject = cameraStream;
        await cameraVideo.play();
        cameraStage.classList.add("is-active");
        stopCameraButton.disabled = false;
        captureCameraButton.disabled = false;
        switchCameraButton.disabled = false;
        cameraLookOverlay.classList.add("is-visible");
        startFaceTracking();
        showCameraMessage("Camera preview is active. The video stays in this page and is not saved or uploaded.", false);
    } catch (error) {
        console.error("Could not start the camera preview:", error);
        stopCamera();

        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            showCameraMessage("Camera permission was denied. Allow camera access in your browser settings or continue without it.", true);
        } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            showCameraMessage("No camera was found. You can still browse the style directions below.", true);
        } else {
            showCameraMessage("The camera could not start. Check that it is connected and not being used by another app.", true);
        }
    }
}

startCameraButton.addEventListener("click", startCamera);

stopCameraButton.addEventListener("click", () => {
    stopCamera();
    stopFaceTracking();
    cameraLookOverlay.classList.remove("is-visible");
    showCameraMessage("Camera preview is off.", false);
});

captureCameraButton.addEventListener("click", () => {
    if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) return;

    captureCanvas.width = cameraVideo.videoWidth;
    captureCanvas.height = cameraVideo.videoHeight;
    const context = captureCanvas.getContext("2d");

    if (facingMode === "user") {
        context.translate(captureCanvas.width, 0);
        context.scale(-1, 1);
    }
    context.drawImage(cameraVideo, 0, 0, captureCanvas.width, captureCanvas.height);

    const activeFilter = document.querySelector("[data-filter-effect].selected")?.dataset.filterEffect || "natural";
    if (activeFilter !== "natural") {
        context.globalCompositeOperation = "overlay";
        context.globalAlpha = activeFilter === "glam" ? 0.18 : 0.12;
        context.fillStyle = activeFilter === "golden" ? "#dca85e" : activeFilter === "glam" ? "#d8a3c4" : "#222";
        context.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
        context.globalCompositeOperation = "source-over";
        context.globalAlpha = 1;
    }

    if (detectedFace) {
        drawLiveFaceEffects(context, detectedFace, false);
    }

    const photo = captureCanvas.toDataURL("image/png");
    capturePreview.src = photo;
    downloadCaptureLink.href = photo;
    cameraCapture.hidden = false;
    showCameraMessage("Photo captured. It stays in this browser until you download or discard it.", false);
});

switchCameraButton.addEventListener("click", async () => {
    facingMode = facingMode === "user" ? "environment" : "user";
    cameraVideo.style.transform = facingMode === "user" ? "scaleX(-1)" : "none";
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
    await startCamera();
});

discardCaptureButton.addEventListener("click", () => {
    cameraCapture.hidden = true;
    capturePreview.removeAttribute("src");
    downloadCaptureLink.removeAttribute("href");
    showCameraMessage("Capture discarded.", false);
});

function setEffectSelection(groupSelector, button) {
    document.querySelectorAll(groupSelector).forEach(option => {
        const selected = option === button;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
    });
}

const cameraFilters = {
    natural: "none",
    golden: "sepia(.22) saturate(1.12) brightness(1.05)",
    glam: "contrast(1.05) saturate(1.22) brightness(1.08)",
    noir: "grayscale(1) contrast(1.12)"
};

document.querySelectorAll("[data-filter-effect]").forEach(button => {
    button.addEventListener("click", () => {
        setEffectSelection("[data-filter-effect]", button);
        cameraVideo.style.filter = cameraFilters[button.dataset.filterEffect] || "none";
    });
});

const hairColors = {
    none: "",
    black: "#17130f",
    brown: "#5a3824",
    blonde: "#d9bd75",
    pink: "#d985a1"
};

document.querySelectorAll("[data-hair-effect]").forEach(button => {
    button.addEventListener("click", () => {
        setEffectSelection("[data-hair-effect]", button);
        activeHairEffect = button.dataset.hairEffect;
    });
});

const beardShapes = {
    none: { opacity: 0, shape: "M24 59C27 78 36 91 50 94C64 91 73 78 76 59C70 68 62 72 50 73C38 72 30 68 24 59Z" },
    stubble: { opacity: 0.34, shape: "M26 60C29 69 37 75 50 77C63 75 71 69 74 60C70 70 62 77 50 79C38 77 30 70 26 60Z" },
    short: { opacity: 0.72, shape: "M24 58C28 73 36 84 50 88C64 84 72 73 76 58C69 67 62 71 50 72C38 71 31 67 24 58Z" },
    full: { opacity: 0.92, shape: "M22 57C25 79 35 92 50 96C65 92 75 79 78 57C70 66 62 70 50 72C38 70 30 66 22 57Z" }
};

document.querySelectorAll("[data-beard-effect]").forEach(button => {
    button.addEventListener("click", () => {
        setEffectSelection("[data-beard-effect]", button);
        activeBeardEffect = button.dataset.beardEffect;
    });
});

const lookGrid = document.getElementById("lookGrid");
const styleSearch = document.getElementById("styleSearch");
const styleCount = document.getElementById("styleCount");
let activeStyleFilter = "all";

function selectStyle(style) {
    document.querySelectorAll("[data-look]").forEach(option => {
        const selected = option.dataset.look === style.id;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
    });

    document.getElementById("lookName").textContent = style.name;
    document.getElementById("lookDescription").textContent = style.description;
    document.getElementById("lookService").textContent = style.serviceName;
    document.getElementById("bookLook").href = `booking.html?service=${encodeURIComponent(style.serviceId)}&style=${encodeURIComponent(style.id)}`;
    document.getElementById("bookLook").textContent = `Book ${style.serviceName} ↗`;
    cameraLookLabel.textContent = style.name;
}

function renderStyles() {
    if (!lookGrid) return;
    const query = styleSearch ? styleSearch.value.trim().toLowerCase() : "";
    const visibleStyles = hairstyleStyles.filter(style => {
        const matchesFilter = activeStyleFilter === "all" || style.category === activeStyleFilter;
        const matchesQuery = !query || `${style.name} ${style.categoryLabel} ${style.description}`.toLowerCase().includes(query);
        return matchesFilter && matchesQuery;
    });

    styleCount.textContent = `${visibleStyles.length} ${visibleStyles.length === 1 ? "style" : "styles"} available`;
    if (!visibleStyles.length) {
        lookGrid.innerHTML = `<div class="empty-state style-empty"><h2>No matching styles.</h2><p>Try another filter or search for fade, bob, curls, or beard.</p></div>`;
        return;
    }

    lookGrid.innerHTML = visibleStyles.map((style, index) => `
        <button class="card look-option${style.id === "classic" ? " selected" : ""}" type="button" data-look="${style.id}" aria-pressed="${style.id === "classic"}">
            <span class="look-symbol" aria-hidden="true">${style.icon}</span>
            <span class="look-number">${String(index + 1).padStart(2, "0")} · ${style.categoryLabel}</span>
            <strong>${style.name}</strong>
            <span>${style.description}</span>
        </button>
    `).join("");

    lookGrid.querySelectorAll("[data-look]").forEach(button => {
        button.addEventListener("click", () => {
            const style = hairstyleStyles.find(item => item.id === button.dataset.look);
            if (style) selectStyle(style);
        });
    });
}

document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
        activeStyleFilter = button.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach(filter => {
            const selected = filter === button;
            filter.classList.toggle("selected", selected);
            filter.setAttribute("aria-pressed", String(selected));
        });
        renderStyles();
    });
});

if (styleSearch) styleSearch.addEventListener("input", renderStyles);
renderStyles();

async function startFaceTracking() {
    if (typeof FaceMesh !== "undefined") {
        try {
            const faceMesh = new FaceMesh({
                locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: false,
                minDetectionConfidence: 0.55,
                minTrackingConfidence: 0.55
            });
            faceMesh.onResults(results => {
                const landmarks = results.multiFaceLandmarks?.[0];
                if (!landmarks) {
                    detectedFace = null;
                    return;
                }
                const xs = landmarks.map(point => point.x);
                const ys = landmarks.map(point => point.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                detectedFace = {
                    x: minX * cameraFaceCanvas.width,
                    y: minY * cameraFaceCanvas.height,
                    width: (maxX - minX) * cameraFaceCanvas.width,
                    height: (maxY - minY) * cameraFaceCanvas.height
                };
            });

            async function trackMesh() {
                if (!cameraStream || cameraVideo.readyState < 2) {
                    faceTrackingFrame = window.requestAnimationFrame(trackMesh);
                    return;
                }
                cameraFaceCanvas.width = cameraVideo.videoWidth;
                cameraFaceCanvas.height = cameraVideo.videoHeight;
                const canvasContext = cameraFaceCanvas.getContext("2d");
                canvasContext.clearRect(0, 0, cameraFaceCanvas.width, cameraFaceCanvas.height);
                await faceMesh.send({ image: cameraVideo });
                if (detectedFace) drawLiveFaceEffects(canvasContext, detectedFace);
                faceTrackingFrame = window.requestAnimationFrame(trackMesh);
            }

            trackMesh();
            showCameraMessage("Camera preview is active with live face tracking.", false);
            return;
        } catch (error) {
            console.warn("MediaPipe face tracking could not start:", error);
        }
    }

    if (!("FaceDetector" in window)) {
        showCameraMessage("Live preview is active. Automatic face alignment is available in browsers with Face Detection support.", false);
        return;
    }

    try {
        faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    } catch (error) {
        console.warn("Face Detection could not start:", error);
        return;
    }

    const canvasContext = cameraFaceCanvas.getContext("2d");

    async function trackFace() {
        if (!cameraStream || cameraVideo.readyState < 2) {
            faceTrackingFrame = window.requestAnimationFrame(trackFace);
            return;
        }

        cameraFaceCanvas.width = cameraVideo.videoWidth;
        cameraFaceCanvas.height = cameraVideo.videoHeight;
        canvasContext.clearRect(0, 0, cameraFaceCanvas.width, cameraFaceCanvas.height);

        try {
            const faces = await faceDetector.detect(cameraVideo);
            detectedFace = faces[0]?.boundingBox || null;
        } catch (error) {
            detectedFace = null;
        }

        if (detectedFace) {
            drawLiveFaceEffects(canvasContext, detectedFace);
        }
        faceTrackingFrame = window.requestAnimationFrame(trackFace);
    }

    trackFace();
}

function stopFaceTracking() {
    if (faceTrackingFrame) {
        window.cancelAnimationFrame(faceTrackingFrame);
        faceTrackingFrame = 0;
    }
    detectedFace = null;
    if (cameraFaceCanvas) {
        cameraFaceCanvas.getContext("2d").clearRect(0, 0, cameraFaceCanvas.width, cameraFaceCanvas.height);
    }
}

function drawLiveFaceEffects(context, box, mirrorBox = true) {
    let x = box.x;
    if (mirrorBox && facingMode === "user") {
        x = cameraFaceCanvas.width - box.x - box.width;
    }
    const y = box.y;
    const width = box.width;
    const height = box.height;

    if (activeHairEffect !== "none" && hairColors[activeHairEffect]) {
        context.save();
        context.globalAlpha = 0.72;
        context.fillStyle = hairColors[activeHairEffect];
        context.beginPath();
        context.moveTo(x - width * 0.04, y + height * 0.27);
        context.quadraticCurveTo(x - width * 0.02, y - height * 0.18, x + width * 0.5, y - height * 0.23);
        context.quadraticCurveTo(x + width * 1.02, y - height * 0.18, x + width * 1.04, y + height * 0.27);
        context.quadraticCurveTo(x + width * 0.68, y + height * 0.02, x + width * 0.5, y);
        context.quadraticCurveTo(x + width * 0.32, y + height * 0.02, x - width * 0.04, y + height * 0.27);
        context.fill();
        context.restore();
    }

    if (activeBeardEffect !== "none") {
        const opacity = beardShapes[activeBeardEffect].opacity;
        context.save();
        context.globalAlpha = opacity;
        context.fillStyle = "#3a2419";
        context.beginPath();
        context.moveTo(x + width * 0.22, y + height * 0.61);
        context.quadraticCurveTo(x + width * 0.25, y + height * 1.02, x + width * 0.5, y + height * 1.12);
        context.quadraticCurveTo(x + width * 0.75, y + height * 1.02, x + width * 0.78, y + height * 0.61);
        context.quadraticCurveTo(x + width * 0.68, y + height * 0.79, x + width * 0.5, y + height * 0.82);
        context.quadraticCurveTo(x + width * 0.32, y + height * 0.79, x + width * 0.22, y + height * 0.61);
        context.fill();
        context.restore();
    }
}

window.addEventListener("pagehide", stopCamera);
