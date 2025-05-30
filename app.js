// Global variables
let socket;
let robotIp = '';
let currentScreen = 'scanner-screen';
let pathCommands = [];
let isInfinityLoop = false;

// Screen navigation
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    // Show the requested screen
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;
}

// Manual IP entry
function manualConnect() {
    showScreen('manual-screen');
}

function processIpAndContinue() {
    const ip = document.getElementById("ip").value.trim();
    if (!ip) {
        alert("Please enter a valid IP address");
        return;
    }
    robotIp = ip;
    showScreen('mode-screen');
}

// Mode selection
function selectMode(mode) {
    if (mode === 'remote') {
        showScreen('remote-screen');
        send('M');
    } else if (mode === 'deskmate') {
        showScreen('deskmate-screen');
        send('D');
    } else if (mode === 'path') {
        showScreen('path-screen');
        send('P');
    }
}

// WebSocket connection
function connectToRobot() {
    if (!robotIp) {
        updateStatus('error', 'No IP address provided');
        return;
    }
    try {
        socket = new WebSocket(`ws://${robotIp}:81`);
        socket.onopen = () => {
            updateStatus('connected', 'Connected');
            send('C');
        };
        socket.onclose = () => {
            updateStatus('disconnected', 'Disconnected');
        };
        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            updateStatus('error', 'Connection Error');
        };
    } catch (error) {
        console.error('Connection Error:', error);
        updateStatus('error', 'Connection Error');
    }
}

function updateStatus(state, message) {
    const statusElement = document.getElementById('status-indicator');
    if (statusElement) {
        statusElement.className = 'status-indicator';
        if (state === 'connected') {
            statusElement.classList.add('connected');
        } else if (state === 'error') {
            statusElement.classList.add('error');
        }
        statusElement.innerHTML = `<i class="fas fa-circle"></i> ${message}`;
    }
}

// Remote control functions
function send(cmd) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(cmd);
    } else {
        updateStatus('error', 'Not Connected');
        setTimeout(() => connectToRobot(), 1000);
    }
}

function setupHoldButton(id, command) {
    const btn = document.getElementById(id);
    if (!btn) return;
    
    // Mouse events
    btn.addEventListener("mousedown", () => send(command));
    btn.addEventListener("mouseup", () => send('S'));
    btn.addEventListener("mouseleave", () => send('S'));
    
    // Touch events
    btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        send(command);
    });
    btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        send('S');
    });
}

// Path Mode Functions
function updateValueUnit() {
    const commandType = document.getElementById('command-type').value;
    const unitSpan = document.getElementById('value-unit');
    
    if (commandType.includes('move')) {
        unitSpan.textContent = 'seconds';
    } else if (commandType.includes('rotate')) {
        unitSpan.textContent = 'degrees';
    }
}

function addCommand() {
    const type = document.getElementById('command-type').value;
    const value = parseFloat(document.getElementById('command-value').value);
    
    if (!value || value <= 0) {
        alert('Please enter a valid positive value');
        return;
    }
    
    const command = { type, value };
    pathCommands.push(command);
    
    // Clear input
    document.getElementById('command-value').value = '';
    
    // Update display
    updateCommandList();
}

function removeCommand(index) {
    pathCommands.splice(index, 1);
    updateCommandList();
}

function updateCommandList() {
    const listElement = document.getElementById('command-list');
    
    if (pathCommands.length === 0) {
        listElement.innerHTML = '<div style="text-align: center; color: var(--gray); font-style: italic;">No commands added yet</div>';
        return;
    }
    
    let html = '';
    pathCommands.forEach((cmd, index) => {
        const unit = cmd.type.includes('move') ? 'sec' : 'Â°';
        const displayName = cmd.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        html += `
            <div class="command-item">
                <span>${index + 1}. ${displayName} - ${cmd.value}${unit}</span>
                <button onclick="removeCommand(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    listElement.innerHTML = html;
}

function toggleInfinity() {
    const btn = document.getElementById('infinity-btn');
    const loopInput = document.getElementById('loop-count');
    
    isInfinityLoop = !isInfinityLoop;
    
    if (isInfinityLoop) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-infinity"></i> Active';
        loopInput.disabled = true;
        loopInput.style.opacity = '0.5';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fas fa-infinity"></i> Infinity';
        loopInput.disabled = false;
        loopInput.style.opacity = '1';
    }
}

function clearCommands() {
    if (pathCommands.length === 0) return;
    
    if (confirm('Are you sure you want to clear all commands?')) {
        pathCommands = [];
        updateCommandList();
    }
}

function executePathSequence() {
    if (pathCommands.length === 0) {
        alert('Please add at least one command before executing');
        return;
    }
    
    const loops = isInfinityLoop ? "infinity" : parseInt(document.getElementById('loop-count').value);
    
    const payload = {
        commands: pathCommands,
        loops: loops
    };
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
        console.log('Sent path sequence:', payload);
        alert('Path sequence sent to robot!');
    } else {
        alert('Robot not connected. Please check connection.');
        updateStatus('error', 'Not Connected');
    }
}

// QR Code scanner - Original implementation preserved
function startScanner() {
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    let scanning = true;

    navigator.mediaDevices.getUserMedia({
        video: { 
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    }).then(function (stream) {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
        
        video.addEventListener('loadedmetadata', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            tick();
        });
    }).catch(function (err) {
        console.error("Error accessing camera:", err);
        document.getElementById("qr-reader-results").textContent = "Camera error. Please check permissions.";
    });

    function tick() {
        if (!scanning) return;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth"
            });

            if (code) {
                console.log("QR Code detected:", code.data);
                scanning = false;
                
                // Stop video stream
                if (video.srcObject) {
                    video.srcObject.getTracks().forEach(track => track.stop());
                }
                
                document.getElementById("qr-reader-results").textContent = `Successfully scanned: ${code.data}`;
                document.getElementById("ip").value = code.data.trim();
                robotIp = code.data.trim();
                
                // Connect to robot and proceed to mode selection
                connectToRobot();
                setTimeout(() => showScreen('mode-screen'), 1000);
                return;
            }
        }
        
        if (scanning) {
            requestAnimationFrame(tick);
        }
    }
}

function selectDeskMode(mode){
    const calmBtn=document.getElementById('desk-calm-mode');
    const normalBtn=document.getElementById('desk-normal-mode');
    if(mode=='calm'){
        calmBtn.style.borderColor ='blue';
        normalBtn.style.borderColor='#e9ecef';
        send('deskCalm');
    }else if(mode=='normal'){
        normalBtn.style.borderColor='blue';
        calmBtn.style.borderColor ='#e9ecef';
        send('deskNormal');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Setup control buttons after DOM is loaded
    setupHoldButton("forward", "F");
    setupHoldButton("backward", "B");
    setupHoldButton("left", "L");
    setupHoldButton("right", "R");
    
    // Add event listener for command type change
    const commandTypeSelect = document.getElementById('command-type');
    if (commandTypeSelect) {
        commandTypeSelect.addEventListener('change', updateValueUnit);
    }
    
    // Start scanner
    startScanner();
});