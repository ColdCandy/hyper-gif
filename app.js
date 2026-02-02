/**
 * Hyper-GIF デモプレイヤー
 * Agentic Vision による自律制御シミュレーション
 */

class HyperGIFAgent {
    constructor(deviceProfile) {
        this.device = deviceProfile;
        this.bandwidth = 100;
        this.currentLayer = 'L1';
        this.upscalerActive = false;
        this.logEntries = [];
    }

    selectStrategy(bandwidth) {
        const hasVVCDec = this.device.vvcSupport;
        const hasGPU = this.device.gpuTier >= 3;

        if (bandwidth >= 500 && hasVVCDec && hasGPU) {
            return { layer: 'L2', quality: '4K HDR', fps: 120, bitrate: '50 Mbps', codec: 'VVC' };
        } else if (bandwidth >= 100 && hasGPU) {
            return { layer: 'L2', quality: '1440p', fps: 60, bitrate: '15 Mbps', codec: 'AV1 Ultra' };
        } else if (bandwidth >= 50) {
            return { layer: 'L1+', quality: '1080p', fps: 60, bitrate: '8 Mbps', codec: 'AV1 + AI' };
        } else if (bandwidth >= 10) {
            return { layer: 'L1', quality: '720p', fps: 30, bitrate: '2.5 Mbps', codec: 'AV1' };
        } else {
            return { layer: 'L1', quality: '480p', fps: 24, bitrate: '0.8 Mbps', codec: 'AV1 Low' };
        }
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('ja-JP');
        this.logEntries.unshift({ timestamp, message, type });
        if (this.logEntries.length > 20) this.logEntries.pop();
    }
}

// デバイスプロファイル
const deviceProfiles = {
    mobile: { name: 'iPhone 15 Pro', gpuTier: 2, vvcSupport: false },
    tablet: { name: 'iPad Pro M2', gpuTier: 2, vvcSupport: false },
    laptop: { name: 'RTX 4060 Laptop', gpuTier: 3, vvcSupport: true },
    desktop: { name: 'High Performance Desktop', gpuTier: 4, vvcSupport: true }
};

// --- グローバルステート ---
let agent = new HyperGIFAgent(deviceProfiles.desktop);
let animationId = null;
let isPlaying = false;
let uploadedImage = null;
let isProcessing = false;
let processingProgress = 0;

const canvas = document.getElementById('demo-canvas');
const ctx = canvas.getContext('2d');

// --- 描画ロジック ---

function drawFrame(strategy) {
    const time = Date.now() / 1000;

    // 1. 背景グラデーション
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (strategy.layer === 'L2') {
        gradient.addColorStop(0, '#1a0a2e');
        gradient.addColorStop(0.5, '#0f1a3d');
        gradient.addColorStop(1, '#0a1628');
    } else {
        gradient.addColorStop(0, '#12121a');
        gradient.addColorStop(1, '#0a0a0f');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. パーティクル
    const particleCount = strategy.layer === 'L2' ? 50 : 20;
    for (let i = 0; i < particleCount; i++) {
        const x = (Math.sin(time * 0.5 + i * 0.3) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(time * 0.3 + i * 0.5) * 0.5 + 0.5) * canvas.height;
        const size = strategy.layer === 'L2' ? 3 + Math.sin(time + i) * 2 : 2;
        const alpha = strategy.layer === 'L2' ? 0.8 : 0.4;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.fill();
    }

    // 3. アップロード画像の表示
    if (uploadedImage) {
        const s = Math.min(canvas.width / uploadedImage.width, canvas.height / uploadedImage.height) * 0.7;
        const w = uploadedImage.width * s;
        const h = uploadedImage.height * s;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;

        if (isProcessing) {
            drawProcessingOverlay(x, y, w, h);
        } else {
            drawEnhancedImage(uploadedImage, x, y, w, h, strategy);
        }
    } else {
        drawDefaultObject(time, strategy);
    }
}

function drawDefaultObject(time, strategy) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80 + Math.sin(time * 2) * 20;

    if (strategy.layer === 'L2') {
        const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2);
        glow.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const grad = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
    grad.addColorStop(0, '#a855f7');
    grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.font = 'bold 24px Inter';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('.HGIF', centerX, centerY + 8);
}

function drawProcessingOverlay(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width * 0.6;
    const barHeight = 6;
    const barX = (canvas.width - barWidth) / 2;
    const barY = canvas.height / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const grad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    grad.addColorStop(0, '#a855f7');
    grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barWidth * (processingProgress / 100), barHeight);

    ctx.font = 'bold 16px Inter';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('HGIF AI PROCESSING...', canvas.width / 2, barY - 30);
    ctx.restore();
}

function drawEnhancedImage(img, x, y, w, h, strategy) {
    ctx.save();
    if (strategy.layer === 'L2') {
        ctx.shadowBlur = 30;
        ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
        ctx.filter = 'contrast(1.2) saturate(1.4) brightness(1.1)';
        ctx.drawImage(img, x, y, w, h);
    } else {
        ctx.filter = 'contrast(1.0) grayscale(0.2)';
        ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();

    ctx.fillStyle = strategy.layer === 'L2' ? '#a855f7' : '#71717a';
    ctx.font = 'bold 12px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(strategy.layer === 'L2' ? '● HIGH-FIDELITY HGIF' : '○ STANDARD L1', x + w - 10, y + h - 10);
}

// --- UI制御 ---

function updateHUD(strategy) {
    document.getElementById('current-layer').textContent = strategy.layer;
    document.getElementById('current-quality').textContent = strategy.quality;
    document.getElementById('current-fps').textContent = strategy.fps;
}

function updateAgentLog() {
    const logElement = document.getElementById('agent-log');
    if (!logElement) return;
    logElement.innerHTML = agent.logEntries.map(entry =>
        `<div class="log-entry ${entry.type}">[${entry.timestamp}] ${entry.message}</div>`
    ).join('');
}

function animate() {
    const strategy = agent.selectStrategy(agent.bandwidth);
    drawFrame(strategy);
    updateHUD(strategy);
    if (isPlaying) {
        animationId = requestAnimationFrame(animate);
    }
}

function startPlayback() {
    isPlaying = true;
    animate();
}

// --- 初期化 & イベントリスナー ---

document.addEventListener('DOMContentLoaded', () => {
    const bandwidthSlider = document.getElementById('bandwidth-slider');
    const bandwidthValue = document.getElementById('bandwidth-value');
    const autoModeSwitch = document.getElementById('auto-mode');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('gif-upload');
    const downloadBtn = document.getElementById('download-btn');

    // スライダー
    bandwidthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        agent.bandwidth = val;
        bandwidthValue.textContent = val;
        const strategy = agent.selectStrategy(val);
        agent.log(`帯域幅変更: ${val} Mbps`, 'decision');
        updateAgentLog();
    });

    // オートモード
    let autoInterval = null;
    autoModeSwitch.addEventListener('change', (e) => {
        const isAuto = e.target.checked;
        bandwidthSlider.disabled = isAuto;
        if (isAuto) {
            agent.log('Auto AI Control: ON', 'info');
            autoInterval = setInterval(() => {
                const noise = Math.sin(Date.now() / 2000) * 100;
                agent.bandwidth = Math.round(Math.max(1, Math.min(1000, 100 + noise + Math.random() * 50)));
                bandwidthSlider.value = agent.bandwidth;
                bandwidthValue.textContent = agent.bandwidth;
                updateAgentLog();
            }, 1000);
        } else {
            agent.log('Auto AI Control: OFF', 'info');
            clearInterval(autoInterval);
        }
        updateAgentLog();
    });

    // ファイル処理
    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                uploadedImage = img;
                isProcessing = true;
                processingProgress = 0;
                agent.log('HGIF次世代変換エンジン: 起動', 'decision');

                const interval = setInterval(() => {
                    processingProgress += 5;
                    if (processingProgress >= 100) {
                        clearInterval(interval);
                        isProcessing = false;
                        agent.log('HGIF 実行完了', 'decision');
                        updateAgentLog();
                    }
                }, 50);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

    // ダウンロード
    downloadBtn.addEventListener('click', () => {
        if (!uploadedImage) return;
        const link = document.createElement('a');
        link.download = 'processed_image.hgif';
        const cap = document.createElement('canvas');
        cap.width = uploadedImage.width;
        cap.height = uploadedImage.height;
        const cctx = cap.getContext('2d');
        cctx.filter = 'contrast(1.2) saturate(1.4) brightness(1.1)';
        cctx.drawImage(uploadedImage, 0, 0);
        link.href = cap.toDataURL('image/png');
        link.click();
        agent.log('ファイルを書き出しました', 'info');
        updateAgentLog();
    });

    // 起動
    startPlayback();
});
