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
    modelSelection: 1,
    smoothSegmentation: true
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
        video: {
            facingMode: useFrontCamera ? "user" : "environment"
        }
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

    // FIRST CAPTURE → BACKGROUND LOCK
    if (!backgroundImageData) {
        backgroundImageData = canvas.toDataURL("image/png");
        renderPreview();
        showPopup("Background locked! Now add people.");
        captureBtn.innerText = "Add Person";
        processing = false;
        return;
    }

    // AFTER BACKGROUND LOCK → ADD PERSON
    addPersonFromCurrentFrame();
});

// ==========================
// ADD PERSON BUTTON
// ==========================
addPersonBtn.addEventListener("click", () => {
    if (!backgroundImageData) {
        showPopup("Please lock background first.");
        return;
    }
    addPersonFromCurrentFrame();
});

// ==========================
// ADD PERSON LOGIC
// ==========================
async function addPersonFromCurrentFrame() {

    if (aiProcessing) return;

    showLoading();
    aiProcessing = true;

    // Capture static frame
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(video, 0, 0);

    const secondImage = new Image();
    secondImage.src = tempCanvas.toDataURL("image/png");

    secondImage.onload = async () => {
        await selfieSegmentation.send({ image: secondImage });
    };
}

// ==========================
// HANDLE AI RESULTS
// ==========================
function handleResults(results) {

    const personCanvas = document.createElement("canvas");
    personCanvas.width = canvas.width;
    personCanvas.height = canvas.height;
    const personCtx = personCanvas.getContext("2d");

    // Draw mask
    personCtx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);

    // Keep only person
    personCtx.globalCompositeOperation = "source-in";
    personCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // Slight brightness match
    personCtx.filter = "brightness(1.05) contrast(1.05)";
    personCtx.drawImage(personCanvas, 0, 0);
    personCtx.filter = "none";

    peopleLayers.push(personCanvas.toDataURL("image/png"));

    renderPreview();

    hideLoading();
    aiProcessing = false;
    processing = false;

    showPopup("Person added! You can add more.");
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
// DOWNLOAD FINAL
// ==========================
downloadBtn.addEventListener("click", () => {

    if (!backgroundImageData) {
        showPopup("Nothing to download yet.");
        return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "ScattoGo_Pro_Final.png";
    link.click();
});

// ==========================
// RESET
// ==========================
function resetApp() {
    backgroundImageData = null;
    peopleLayers = [];
    processing = false;
    aiProcessing = false;
    cameraStarted = false;
    captureBtn.innerText = "Start Camera";

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
