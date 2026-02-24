// ==========================
// ELEMENTS
// ==========================
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const captureBtn = document.getElementById("captureBtn");
const addPersonBtn = document.getElementById("addPersonBtn");
const downloadBtn = document.getElementById("downloadBtn");
const switchBtn = document.getElementById("switchBtn");

const countdown = document.getElementById("countdown");
const loadingOverlay = document.getElementById("loadingOverlay");

// ==========================
// STATE
// ==========================
let stream = null;
let useFrontCamera = true;
let cameraStarted = false;

let backgroundImageData = null;
let peopleLayers = [];

let processing = false;
let aiProcessing = false;

// ==========================
// MEDIAPIPE SETUP
// ==========================
const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
});

selfieSegmentation.setOptions({
    modelSelection: 1
});

selfieSegmentation.onResults(handleResults);

// ==========================
// POPUP
// ==========================
function showPopup(message) {
    document.getElementById("popupMessage").innerText = message;
    document.getElementById("customPopup").classList.remove("hidden");
}

function closePopup() {
    document.getElementById("customPopup").classList.add("hidden");
}

// ==========================
// LOADING
// ==========================
function showLoading() {
    loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
    loadingOverlay.classList.add("hidden");
}

// ==========================
// COUNTDOWN
// ==========================
function startCountdown(seconds) {
    return new Promise(resolve => {
        countdown.style.display = "block";
        let counter = seconds;

        const interval = setInterval(() => {
            countdown.innerText = counter;
            counter--;

            if (counter < 0) {
                clearInterval(interval);
                countdown.style.display = "none";
                resolve();
            }
        }, 1000);
    });
}

// ==========================
// CAMERA
// ==========================
async function startCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: useFrontCamera ? "user" : "environment" }
    });

    video.srcObject = stream;
    cameraStarted = true;
}

switchBtn.addEventListener("click", async () => {
    useFrontCamera = !useFrontCamera;
    await startCamera();
});

// ==========================
// CAPTURE BUTTON
// ==========================
captureBtn.addEventListener("click", async () => {

    if (processing) return;

    if (!cameraStarted) {
        await startCamera();
        captureBtn.innerText = "Lock Background";
        return;
    }

    processing = true;

    await startCountdown(3);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    // LOCK BACKGROUND
    if (!backgroundImageData) {
        backgroundImageData = canvas.toDataURL("image/png");
        renderPreview();
        showPopup("Background locked. Now add people.");
        captureBtn.innerText = "Add Person";
        processing = false;
        return;
    }

    addPerson();
});

// ==========================
// ADD PERSON (FIXED VERSION)
// ==========================
async function addPerson() {

    if (aiProcessing) return;

    aiProcessing = true;
    showLoading();

    try {

        // Create static canvas frame
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d");

        tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 🔥 SEND CANVAS DIRECTLY (NO IMAGE OBJECT)
        await selfieSegmentation.send({ image: tempCanvas });

    } catch (err) {
        console.error(err);
        hideLoading();
        aiProcessing = false;
        processing = false;
        showPopup("AI failed. Try again.");
    }
}

// ==========================
// HANDLE RESULTS (SAFE)
// ==========================
function handleResults(results) {

    if (!results || !results.segmentationMask) {
        hideLoading();
        aiProcessing = false;
        processing = false;
        showPopup("Segmentation failed.");
        return;
    }

    const personCanvas = document.createElement("canvas");
    personCanvas.width = canvas.width;
    personCanvas.height = canvas.height;
    const personCtx = personCanvas.getContext("2d");

    // Draw mask
    personCtx.drawImage(results.segmentationMask, 0, 0);

    // Feather edges
    personCtx.filter = "blur(2px)";
    personCtx.drawImage(personCanvas, 0, 0);
    personCtx.filter = "none";

    // Keep only person
    personCtx.globalCompositeOperation = "source-in";
    personCtx.drawImage(results.image, 0, 0);

    peopleLayers.push(personCanvas.toDataURL("image/png"));

    renderPreview();

    hideLoading();
    aiProcessing = false;
    processing = false;

    showPopup("Person added successfully!");
}

// ==========================
// RENDER PREVIEW
// ==========================
function renderPreview() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!backgroundImageData) return;

    const bg = new Image();
    bg.src = backgroundImageData;

    bg.onload = () => {
        ctx.drawImage(bg, 0, 0);

        peopleLayers.forEach(layer => {
            const img = new Image();
            img.src = layer;
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
        });
    };
}

// ==========================
// DOWNLOAD
// ==========================
downloadBtn.addEventListener("click", () => {

    if (!backgroundImageData) {
        showPopup("Nothing to download.");
        return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "ScattoGo_Pro_Final.png";
    link.click();
});
