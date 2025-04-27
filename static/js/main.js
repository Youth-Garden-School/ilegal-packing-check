document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const video = document.getElementById('videoElement');
    const canvas = document.getElementById('canvasOutput');
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('status');
    const counterEl = document.getElementById('counter');
    const fpsEl = document.getElementById('fps');
    const totalZonesEl = document.getElementById('totalZones');
    const occupiedZonesEl = document.getElementById('occupiedZones');
    const vehiclesDetectedEl = document.getElementById('vehiclesDetected');
    const detectionTimeEl = document.getElementById('detectionTime');
    const thresholdInput = document.getElementById('violationThreshold');
    const thresholdValueEl = document.getElementById('thresholdValue');
    const intervalInput = document.getElementById('detectionInterval');
    const intervalValueEl = document.getElementById('intervalValue');
    const zoneCounterEl = document.getElementById('zoneCounter');
    const zoneStatusListEl = document.getElementById('zoneStatusList');
    const cameraSelect = document.getElementById('cameraSelect');
    const cameraStatus = document.querySelector('.camera-status');
    const cameraPlaceholder = document.querySelector('.camera-placeholder');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const notificationToast = document.getElementById('notificationToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');

    // Initialize Chart.js for detection history
    const detectionHistoryCtx = document.getElementById('detectionHistoryChart').getContext('2d');
    let detectionHistoryChart;

    // Toast instance
    const toast = new bootstrap.Toast(notificationToast);

    // App state
    const state = {
        isDrawing: false,
        drawMode: false,
        detectMode: false,
        startX: 0,
        startY: 0,
        parkingZones: [],
        occupiedStatus: [],
        carDetections: [],
        detectionInterval: null,
        illegalParkingCount: 0,
        violationThreshold: 10,
        detectionIntervalMs: 1000,
        lastFrameTime: 0,
        frameCount: 0,
        fps: 0,
        lastFpsUpdate: 0,
        darkMode: false,
        detectionHistory: {
            labels: [],
            vehicles: [],
            illegals: []
        },
        lastDetectionTime: 0
    };

    // Camera stream
    let stream = null;

    // Initialize application
    function init() {
        initEventListeners();
        setupDetectionHistoryChart();
        checkDarkModePreference();
        checkCameraDevices();
        updateThreshold();
        updateInterval();
    }

    // Initialize chart
    function setupDetectionHistoryChart() {
        detectionHistoryChart = new Chart(detectionHistoryCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Vehicles Detected',
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4,
                        borderWidth: 2
                    },
                    {
                        label: 'Illegal Parking',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                animation: {
                    duration: 500
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
    }

    // Update detection history chart
    function updateDetectionHistoryChart() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Keep only last 10 data points
        if (state.detectionHistory.labels.length > 10) {
            state.detectionHistory.labels.shift();
            state.detectionHistory.vehicles.shift();
            state.detectionHistory.illegals.shift();
        }

        state.detectionHistory.labels.push(timeStr);
        state.detectionHistory.vehicles.push(state.carDetections.length);
        state.detectionHistory.illegals.push(state.illegalParkingCount);

        detectionHistoryChart.data.labels = state.detectionHistory.labels;
        detectionHistoryChart.data.datasets[0].data = state.detectionHistory.vehicles;
        detectionHistoryChart.data.datasets[1].data = state.detectionHistory.illegals;
        detectionHistoryChart.update();
    }

    // Check for dark mode preference
    function checkDarkModePreference() {
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode === 'true') {
            state.darkMode = true;
            darkModeToggle.checked = true;
            document.body.classList.add('dark-mode');
        }
    }

    // Toggle dark mode
    function toggleDarkMode() {
        state.darkMode = darkModeToggle.checked;
        if (state.darkMode) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }

        // Update chart colors if needed
        if (detectionHistoryChart) {
            updateChartTheme();
            detectionHistoryChart.update();
        }
    }

    // Update chart theme based on dark mode
    function updateChartTheme() {
        const textColor = state.darkMode ? '#ecf0f1' : '#2c3e50';
        const gridColor = state.darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        detectionHistoryChart.options.scales.x.ticks.color = textColor;
        detectionHistoryChart.options.scales.y.ticks.color = textColor;
        detectionHistoryChart.options.scales.x.grid.color = gridColor;
        detectionHistoryChart.options.scales.y.grid.color = gridColor;
    }

    // Check available camera devices
    function checkCameraDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.log("enumerateDevices not supported in this browser");
            return;
        }

        navigator.mediaDevices.enumerateDevices()
            .then(devices => {
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                populateCameraOptions(videoDevices);
            })
            .catch(error => {
                console.error("Error enumerating devices:", error);
            });
    }

    // Populate camera select options
    function populateCameraOptions(videoDevices) {
        // Clear existing options except default
        while (cameraSelect.options.length > 1) {
            cameraSelect.remove(1);
        }

        // Add detected cameras
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });
    }

    // Initialize event listeners
    function initEventListeners() {
        // Camera controls
        document.getElementById('startCamera').addEventListener('click', startCamera);
        document.getElementById('refreshCameras').addEventListener('click', checkCameraDevices);
        document.getElementById('drawMode').addEventListener('click', toggleDrawMode);
        document.getElementById('clearZones').addEventListener('click', clearZones);
        document.getElementById('saveZones').addEventListener('click', saveZones);
        document.getElementById('startDetection').addEventListener('click', startDetection);
        document.getElementById('stopDetection').addEventListener('click', stopDetection);
        darkModeToggle.addEventListener('change', toggleDarkMode);

        // Drawing events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDrawing);
        canvas.addEventListener('mouseleave', endDrawing);

        // Touch events for mobile
        canvas.addEventListener('touchstart', handleTouch);
        canvas.addEventListener('touchmove', handleTouchMove);
        canvas.addEventListener('touchend', handleTouchEnd);

        // Settings events
        thresholdInput.addEventListener('input', updateThreshold);
        intervalInput.addEventListener('input', updateInterval);
    }

    // Show notification toast
    function showNotification(title, message, type = 'info') {
        toastTitle.textContent = title;
        toastMessage.textContent = message;

        // Remove existing classes
        notificationToast.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'bg-info');

        // Add appropriate class
        switch (type) {
            case 'success':
                notificationToast.classList.add('bg-success');
                break;
            case 'error':
                notificationToast.classList.add('bg-danger');
                break;
            case 'warning':
                notificationToast.classList.add('bg-warning');
                break;
            default:
                notificationToast.classList.add('bg-info');
        }

        toast.show();
    }

    // Update status message with appropriate icon
    function updateStatus(message, type = 'info') {
        let icon = 'fas fa-info-circle';
        let alertClass = 'alert-info';

        switch (type) {
            case 'success':
                icon = 'fas fa-check-circle';
                alertClass = 'alert-success';
                break;
            case 'warning':
                icon = 'fas fa-exclamation-circle';
                alertClass = 'alert-warning';
                break;
            case 'error':
                icon = 'fas fa-times-circle';
                alertClass = 'alert-danger';
                break;
            case 'loading':
                icon = 'fas fa-spinner fa-spin';
                alertClass = 'alert-info';
                break;
        }

        statusEl.className = `alert ${alertClass}`;
        statusEl.innerHTML = `<i class="${icon} me-2"></i>${message}`;
    }

    // Start camera with optimal settings
    function startCamera() {
        updateStatus('Starting camera...', 'loading');

        if (stream) {
            // If stream exists, stop all tracks
            stream.getTracks().forEach(track => track.stop());
        }

        if (navigator.mediaDevices.getUserMedia) {
            // Get selected camera if available
            const selectedCamera = cameraSelect.value;

            // Try to get the best quality first, fallback to lower if needed
            const constraints = {
                audio: false,
                video: {
                    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            };

            navigator.mediaDevices.getUserMedia(constraints)
                .then(function (mediaStream) {
                    stream = mediaStream;
                    video.srcObject = mediaStream;

                    video.onloadedmetadata = () => {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        updateStatus('Camera ready', 'success');

                        // Update UI
                        video.classList.remove('d-none');
                        cameraPlaceholder.classList.add('d-none');
                        cameraStatus.textContent = 'Camera On';
                        cameraStatus.classList.remove('bg-secondary');
                        cameraStatus.classList.add('bg-success');

                        showNotification('Camera Started', 'Camera is now active and ready for detection.');

                        // Start animation frame for smoother rendering
                        requestAnimationFrame(updateFrame);
                    };
                })
                .catch(function (error) {
                    console.error("Error accessing camera:", error);
                    updateStatus(`Camera error: ${error.message}`, 'error');
                    showNotification('Camera Error', error.message, 'error');

                    // Try again with lower constraints if it fails
                    const lowerConstraints = {
                        audio: false,
                        video: {
                            deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                            facingMode: 'environment',
                            width: { ideal: 640 },
                            height: { ideal: 480 }
                        }
                    };

                    navigator.mediaDevices.getUserMedia(lowerConstraints)
                        .then(function (mediaStream) {
                            stream = mediaStream;
                            video.srcObject = mediaStream;

                            video.onloadedmetadata = () => {
                                canvas.width = video.videoWidth;
                                canvas.height = video.videoHeight;
                                updateStatus('Camera ready (low resolution)', 'warning');

                                // Update UI
                                video.classList.remove('d-none');
                                cameraPlaceholder.classList.add('d-none');
                                cameraStatus.textContent = 'Camera On (Low Res)';
                                cameraStatus.classList.remove('bg-secondary');
                                cameraStatus.classList.add('bg-warning');

                                showNotification('Camera Started', 'Camera is running in low resolution mode.', 'warning');

                                requestAnimationFrame(updateFrame);
                            };
                        })
                        .catch(function (error) {
                            updateStatus(`Cannot access camera: ${error.message}`, 'error');
                            showNotification('Camera Error', 'Cannot access camera. Please check permissions.', 'error');
                        });
                });
        } else {
            updateStatus('Media devices not supported on this browser', 'error');
            showNotification('Browser Error', 'Your browser does not support camera access.', 'error');
        }
    }

    // Toggle drawing mode
    function toggleDrawMode() {
        state.drawMode = !state.drawMode;

        if (state.drawMode) {
            document.getElementById('drawMode').innerHTML = '<i class="fas fa-pencil-alt me-2"></i>Drawing Mode: ON';
            document.getElementById('drawMode').classList.replace('btn-info', 'btn-success');
            canvas.classList.add('draw-mode');
            updateStatus('Drawing Mode: Draw parking zones on the video', 'info');
            zoneCounterEl.classList.remove('d-none');
        } else {
            document.getElementById('drawMode').innerHTML = '<i class="fas fa-pencil-alt me-2"></i>Draw Parking Zone';
            document.getElementById('drawMode').classList.replace('btn-success', 'btn-info');
            canvas.classList.remove('draw-mode');
            updateStatus('Ready', 'info');
        }
    }

    // Clear zones
    function clearZones() {
        if (state.parkingZones.length === 0) {
            updateStatus('No zones to clear', 'info');
            return;
        }

        state.parkingZones = [];
        state.occupiedStatus = [];
        state.illegalParkingCount = 0;

        counterEl.textContent = `Illegal parking: ${state.illegalParkingCount}`;
        totalZonesEl.textContent = '0';
        occupiedZonesEl.textContent = '0';
        zoneCounterEl.textContent = 'Zones: 0';
        zoneStatusListEl.innerHTML = '<div class="list-group-item d-flex justify-content-between align-items-center"><span>No zones defined</span></div>';

        updateStatus('All parking zones cleared', 'warning');
        showNotification('Zones Cleared', 'All parking zones have been removed.', 'warning');
    }

    // Save zones to server
    function saveZones() {
        if (state.parkingZones.length === 0) {
            updateStatus('No zones to save', 'warning');
            showNotification('Cannot Save', 'Please draw at least one parking zone first.', 'warning');
            return;
        }

        updateStatus('Saving zones...', 'loading');

        fetch('/save-coordinates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                coordinates: state.parkingZones,
                filename: 'mobile-camera-detect'
            }),
        })
            .then(response => response.json())
            .then(data => {
                updateStatus('Zones saved successfully', 'success');
                showNotification('Success', `${state.parkingZones.length} zones saved successfully.`, 'success');
                console.log('Zones saved:', data);
            })
            .catch(error => {
                console.error('Error saving zones:', error);
                updateStatus('Error saving zones', 'error');
                showNotification('Save Error', 'Could not save zones to server.', 'error');
            });
    }

    // Start detection
    function startDetection() {
        if (!video.srcObject) {
            updateStatus('Please start the camera first', 'warning');
            showNotification('Camera Required', 'Please start the camera before detection.', 'warning');
            return;
        }

        if (state.parkingZones.length === 0) {
            updateStatus('Please draw at least one parking zone first', 'warning');
            showNotification('Zones Required', 'Please draw at least one parking zone before starting detection.', 'warning');
            return;
        }

        state.detectMode = true;
        state.occupiedStatus = Array(state.parkingZones.length).fill().map(() => ({
            occupied: false,
            violationTime: 0,
            lastUpdated: Date.now()
        }));

        updateStatus('Detection running', 'success');
        showNotification('Detection Started', 'Illegal parking detection is now active.', 'success');

        // Start detection at regular intervals
        if (state.detectionInterval) {
            clearInterval(state.detectionInterval);
        }

        state.detectionInterval = setInterval(captureAndDetect, state.detectionIntervalMs);
        document.getElementById('startDetection').disabled = true;
        document.getElementById('stopDetection').disabled = false;

        // Initial detection
        captureAndDetect();
    }

    // Stop detection
    function stopDetection() {
        state.detectMode = false;

        if (state.detectionInterval) {
            clearInterval(state.detectionInterval);
            state.detectionInterval = null;
        }

        updateStatus('Detection stopped', 'warning');
        showNotification('Detection Stopped', 'Illegal parking detection has been stopped.', 'warning');

        document.getElementById('startDetection').disabled = false;
        document.getElementById('stopDetection').disabled = true;
    }

    // Mouse drawing functions
    function startDrawing(e) {
        if (!state.drawMode) return;
        state.isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        state.startX = e.clientX - rect.left;
        state.startY = e.clientY - rect.top;
    }

    function draw(e) {
        if (!state.isDrawing || !state.drawMode) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Draw preview of zone
        drawFrame();
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.strokeRect(state.startX, state.startY, x - state.startX, y - state.startY);
    }

    function endDrawing(e) {
        if (!state.isDrawing || !state.drawMode) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Ensure minimum size and correct orientation
        if (Math.abs(x - state.startX) > 20 && Math.abs(y - state.startY) > 20) {
            // Ensure coordinates are properly ordered (top-left to bottom-right)
            const x1 = Math.min(state.startX, x);
            const y1 = Math.min(state.startY, y);
            const x2 = Math.max(state.startX, x);
            const y2 = Math.max(state.startY, y);

            // Add the zone
            state.parkingZones.push([
                Math.round(x1),
                Math.round(y1),
                Math.round(x2),
                Math.round(y2)
            ]);

            state.occupiedStatus.push({
                occupied: false,
                violationTime: 0,
                lastUpdated: Date.now()
            });

            totalZonesEl.textContent = state.parkingZones.length;
            zoneCounterEl.textContent = `Zones: ${state.parkingZones.length}`;
            updateStatus(`Zone ${state.parkingZones.length} added`, 'success');
            updateZoneStatusList();
        }

        state.isDrawing = false;
        drawFrame();
    }

    // Touch events for mobile
    function handleTouch(e) {
        e.preventDefault();
        if (!state.drawMode) return;

        state.isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        state.startX = touch.clientX - rect.left;
        state.startY = touch.clientY - rect.top;
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (!state.isDrawing || !state.drawMode) return;

        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Draw preview of zone
        drawFrame();
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.strokeRect(state.startX, state.startY, x - state.startX, y - state.startY);
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        if (!state.isDrawing || !state.drawMode) return;

        const rect = canvas.getBoundingClientRect();
        const touch = e.changedTouches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Ensure minimum size and correct orientation
        if (Math.abs(x - state.startX) > 20 && Math.abs(y - state.startY) > 20) {
            // Ensure coordinates are properly ordered (top-left to bottom-right)
            const x1 = Math.min(state.startX, x);
            const y1 = Math.min(state.startY, y);
            const x2 = Math.max(state.startX, x);
            const y2 = Math.max(state.startY, y);

            // Add the zone
            state.parkingZones.push([
                Math.round(x1),
                Math.round(y1),
                Math.round(x2),
                Math.round(y2)
            ]);

            state.occupiedStatus.push({
                occupied: false,
                violationTime: 0,
                lastUpdated: Date.now()
            });

            totalZonesEl.textContent = state.parkingZones.length;
            zoneCounterEl.textContent = `Zones: ${state.parkingZones.length}`;
            updateStatus(`Zone ${state.parkingZones.length} added`, 'success');
            updateZoneStatusList();
        }

        state.isDrawing = false;
        drawFrame();
    }

    // Update zone status list in the UI
    function updateZoneStatusList() {
        if (state.parkingZones.length === 0) {
            zoneStatusListEl.innerHTML = '<div class="list-group-item d-flex justify-content-between align-items-center"><span>No zones defined</span></div>';
            return;
        }

        zoneStatusListEl.innerHTML = '';

        state.parkingZones.forEach((zone, index) => {
            const zoneStatus = state.occupiedStatus[index] || { occupied: false, violationTime: 0 };

            const listItem = document.createElement('div');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';

            const zoneName = document.createElement('span');
            zoneName.textContent = `Zone ${index + 1}`;

            const zoneStatusBadge = document.createElement('span');

            if (zoneStatus.occupied) {
                if (zoneStatus.violationTime > state.violationThreshold) {
                    zoneStatusBadge.className = 'badge bg-danger';
                    zoneStatusBadge.textContent = `Illegal: ${zoneStatus.violationTime}s`;
                    listItem.classList.add('list-group-item-danger');
                } else {
                    zoneStatusBadge.className = 'badge bg-warning text-dark';
                    zoneStatusBadge.textContent = `Occupied: ${zoneStatus.violationTime}s`;
                    listItem.classList.add('list-group-item-warning');
                }
            } else {
                zoneStatusBadge.className = 'badge bg-success';
                zoneStatusBadge.textContent = 'Available';
                listItem.classList.add('list-group-item-success');
            }

            listItem.appendChild(zoneName);
            listItem.appendChild(zoneStatusBadge);
            zoneStatusListEl.appendChild(listItem);
        });
    }

    // Update violation threshold
    function updateThreshold() {
        state.violationThreshold = parseInt(thresholdInput.value);
        thresholdValueEl.textContent = `${state.violationThreshold}s`;
    }

    // Update detection interval
    function updateInterval() {
        state.detectionIntervalMs = parseInt(intervalInput.value);
        intervalValueEl.textContent = `${state.detectionIntervalMs}ms`;

        // Update interval if detection is running
        if (state.detectMode && state.detectionInterval) {
            clearInterval(state.detectionInterval);
            state.detectionInterval = setInterval(captureAndDetect, state.detectionIntervalMs);
        }
    }

    // Capture frame and detect objects
    function captureAndDetect() {
        if (!state.detectMode) return;

        const startTime = performance.now();

        // Create a temporary canvas to capture the current frame
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

        // Get the image data as base64 (with compression to reduce bandwidth)
        const imageData = tempCanvas.toDataURL('image/jpeg', 0.7);

        // Send to server for detection
        fetch('/detect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageData,
                parkingZones: state.parkingZones
            }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const endTime = performance.now();
                    state.lastDetectionTime = Math.round(endTime - startTime);
                    detectionTimeEl.textContent = `${state.lastDetectionTime}ms`;

                    // Update car detections
                    state.carDetections = data.detections;
                    vehiclesDetectedEl.textContent = state.carDetections.length;

                    let occupiedCount = 0;

                    // Update parking status
                    data.parkingStatus.forEach((status, i) => {
                        if (!state.occupiedStatus[i]) {
                            state.occupiedStatus[i] = {
                                occupied: false,
                                violationTime: 0,
                                lastUpdated: Date.now()
                            };
                        }

                        if (status.occupied) {
                            occupiedCount++;
                            if (state.occupiedStatus[i].occupied) {
                                state.occupiedStatus[i].violationTime += 1;
                            } else {
                                state.occupiedStatus[i].occupied = true;
                                state.occupiedStatus[i].violationTime = 0;
                            }
                        } else {
                            state.occupiedStatus[i].occupied = false;
                            state.occupiedStatus[i].violationTime = 0;
                        }

                        state.occupiedStatus[i].lastUpdated = Date.now();
                    });

                    occupiedZonesEl.textContent = occupiedCount;

                    // Count illegal parking
                    let currentIllegalCount = 0;
                    state.occupiedStatus.forEach((status, index) => {
                        if (status.occupied && status.violationTime > state.violationThreshold) {
                            currentIllegalCount++;

                            // If this is a new violation, notify
                            if (status.violationTime === state.violationThreshold + 1) {
                                showNotification(
                                    'Illegal Parking Detected',
                                    `Zone ${index + 1} has illegal parking detected.`,
                                    'error'
                                );
                            }
                        }
                    });

                    if (currentIllegalCount !== state.illegalParkingCount) {
                        state.illegalParkingCount = currentIllegalCount;
                        counterEl.textContent = `Illegal parking: ${state.illegalParkingCount}`;

                        // Add animation if there's illegal parking
                        if (currentIllegalCount > 0) {
                            counterEl.classList.add('illegal-parking-alert');
                        } else {
                            counterEl.classList.remove('illegal-parking-alert');
                        }
                    }

                    // Update UI
                    updateZoneStatusList();
                    updateDetectionHistoryChart();
                }
            })
            .catch(error => {
                console.error('Error in detection:', error);
                updateStatus('Detection error. Retrying...', 'error');
            });
    }

    // Calculate and update FPS
    function updateFps() {
        const now = performance.now();
        state.frameCount++;

        // Update FPS every 500ms
        if (now - state.lastFpsUpdate > 500) {
            state.fps = Math.round((state.frameCount * 1000) / (now - state.lastFpsUpdate));
            fpsEl.textContent = `FPS: ${state.fps}`;
            state.lastFpsUpdate = now;
            state.frameCount = 0;
        }
    }

    // Draw the current frame with all zones and detections
    function drawFrame() {
        if (!video.videoWidth) return;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw all parking zones
        state.parkingZones.forEach((zone, index) => {
            const [x1, y1, x2, y2] = zone;

            // Green for available, red for occupied/violation
            if (state.occupiedStatus[index] && state.occupiedStatus[index].occupied) {
                if (state.occupiedStatus[index].violationTime > state.violationThreshold) {
                    // Violation zone - red
                    ctx.strokeStyle = '#e74c3c';
                    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
                    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

                    // Draw violation time
                    ctx.font = 'bold 14px Poppins, sans-serif';
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    ctx.strokeText('ILLEGAL PARKING', x1 + 5, y1 + 20);
                    ctx.fillText('ILLEGAL PARKING', x1 + 5, y1 + 20);
                    ctx.strokeText(`${state.occupiedStatus[index].violationTime}s`, x1 + 5, y1 + 40);
                    ctx.fillText(`${state.occupiedStatus[index].violationTime}s`, x1 + 5, y1 + 40);

                    // Add visual pulsing effect to the zone
                    const pulseScale = 1 + Math.sin(Date.now() / 300) * 0.05;
                    const centerX = (x1 + x2) / 2;
                    const centerY = (y1 + y2) / 2;
                    const width = (x2 - x1) * pulseScale;
                    const height = (y2 - y1) * pulseScale;

                    ctx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        centerX - width / 2,
                        centerY - height / 2,
                        width,
                        height
                    );

                } else {
                    // Occupied but not violation yet - yellow
                    ctx.strokeStyle = '#f39c12';
                    ctx.fillStyle = 'rgba(243, 156, 18, 0.2)';
                    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

                    // Show occupied countdown
                    ctx.font = 'bold 14px Poppins, sans-serif';
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 2;
                    ctx.strokeText(`${state.occupiedStatus[index].violationTime}s / ${state.violationThreshold}s`, x1 + 5, y1 + 20);
                    ctx.fillText(`${state.occupiedStatus[index].violationTime}s / ${state.violationThreshold}s`, x1 + 5, y1 + 20);
                }
            } else {
                // Available - green
                ctx.strokeStyle = '#27ae60';
                ctx.fillStyle = 'rgba(39, 174, 96, 0.1)';
                ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

                // Show available text
                ctx.font = 'bold 14px Poppins, sans-serif';
                ctx.fillStyle = 'white';
                ctx.fillText('AVAILABLE', x1 + 5, y1 + 20);
            }

            // Draw zone rectangle
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

            // Show zone number
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Poppins, sans-serif';

            // Create background for zone number for better visibility
            const zoneText = `Zone ${index + 1}`;
            const textWidth = ctx.measureText(zoneText).width;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x1 + 5, y2 - 20, textWidth + 10, 20);

            ctx.fillStyle = 'white';
            ctx.fillText(zoneText, x1 + 10, y2 - 5);
        });

        // Draw all car detections
        if (state.detectMode && state.carDetections.length > 0) {
            state.carDetections.forEach(detection => {
                const { x1, y1, x2, y2, conf, class: cls } = detection;

                // Draw bounding box with different colors based on vehicle type
                let color;
                switch (cls) {
                    case 2: color = '#3498db'; break; // Car - blue
                    case 5: color = '#f39c12'; break; // Bus - orange
                    case 7: color = '#9b59b6'; break; // Truck - purple
                    default: color = '#ffffff'; break;
                }

                // Draw semi-transparent box
                ctx.fillStyle = `${color}33`;
                ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

                // Draw border with dashed line
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                ctx.setLineDash([]);

                // Add corner brackets for modern look
                const cornerSize = Math.min(15, (x2 - x1) / 4, (y2 - y1) / 4);
                ctx.beginPath();

                // Top-left corner
                ctx.moveTo(x1, y1 + cornerSize);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x1 + cornerSize, y1);

                // Top-right corner
                ctx.moveTo(x2 - cornerSize, y1);
                ctx.lineTo(x2, y1);
                ctx.lineTo(x2, y1 + cornerSize);

                // Bottom-right corner
                ctx.moveTo(x2, y2 - cornerSize);
                ctx.lineTo(x2, y2);
                ctx.lineTo(x2 - cornerSize, y2);

                // Bottom-left corner
                ctx.moveTo(x1 + cornerSize, y2);
                ctx.lineTo(x1, y2);
                ctx.lineTo(x1, y2 - cornerSize);

                ctx.lineWidth = 3;
                ctx.strokeStyle = color;
                ctx.stroke();

                // Draw semi-transparent background for label
                const label = getVehicleLabel(cls);
                const confidence = Math.round(conf * 100);
                const text = `${label} ${confidence}%`;
                const textWidth = ctx.measureText(text).width;

                ctx.fillStyle = `${color}dd`;
                ctx.fillRect(x1, y1 - 24, textWidth + 20, 24);

                // Add a small triangle pointer
                ctx.beginPath();
                ctx.moveTo(x1 + 10, y1);
                ctx.lineTo(x1 + 20, y1);
                ctx.lineTo(x1 + 15, y1 + 5);
                ctx.closePath();
                ctx.fillStyle = `${color}dd`;
                ctx.fill();

                // Draw label
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px Poppins, sans-serif';
                ctx.fillText(text, x1 + 10, y1 - 7);
            });
        }
    }

    // Update frame (called by requestAnimationFrame for smooth updates)
    function updateFrame() {
        drawFrame();
        updateFps();
        requestAnimationFrame(updateFrame);
    }

    // Get vehicle label from class ID
    function getVehicleLabel(classId) {
        switch (classId) {
            case 2: return 'Car';
            case 5: return 'Bus';
            case 7: return 'Truck';
            default: return 'Vehicle';
        }
    }

    // Initialize on page load
    init();
});