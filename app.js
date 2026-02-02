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

// 初期化
let agent = new HyperGIFAgent(deviceProfiles.desktop);
let animationId = null;
let isPlaying = false;
let currentTime = 0;

// Canvas描画
const canvas = document.getElementById('demo-canvas');
const ctx = canvas.getContext('2d');

function drawFrame(strategy) {
    const time = Date.now() / 1000;

    // 背景グラデーション（品質に応じて変化）
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

    // パーティクルシステム
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

    // 中央のアニメーションオブジェ
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80 + Math.sin(time * 2) * 20;

    // グロー効果（L2のみ）
    if (strategy.layer === 'L2') {
        const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2);
        glowGradient.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
        glowGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.1)');
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // メインの円
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const circleGradient = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
    circleGradient.addColorStop(0, '#a855f7');
    circleGradient.addColorStop(0.5, '#3b82f6');
    circleGradient.addColorStop(1, '#06b6d4');
    ctx.fillStyle = circleGradient;
    ctx.fill();

    // 回転するリング
    const ringCount = strategy.layer === 'L2' ? 3 : 1;
    for (let r = 0; r < ringCount; r++) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(time * (0.5 + r * 0.3));
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 - r * 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 30 + r * 20, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.restore();
    }

    // テキスト表示
    ctx.font = 'bold 24px Inter';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('.HGIF', centerX, centerY + 8);

    ctx.font = '12px Inter';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(strategy.quality + ' @ ' + strategy.fps + 'fps', centerX, centerY + 30);
}

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

function stopPlayback() {
    isPlaying = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
}

// イベントリスナー設定
document.addEventListener('DOMContentLoaded', () => {
    // 帯域幅スライダー
    const bandwidthSlider = document.getElementById('bandwidth-slider');
    const bandwidthValue = document.getElementById('bandwidth-value');

    bandwidthSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        agent.bandwidth = value;
        bandwidthValue.textContent = value;

        const strategy = agent.selectStrategy(value);
        agent.log(`帯域幅変更: ${value} Mbps → ${strategy.layer} (${strategy.codec})`, 'decision');
        updateAgentLog();

        // プリセットボタンの更新
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    });

    // プリセットボタン
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const bandwidth = parseInt(btn.dataset.bandwidth);
            agent.bandwidth = bandwidth;
            bandwidthSlider.value = bandwidth;
            bandwidthValue.textContent = bandwidth;

            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const strategy = agent.selectStrategy(bandwidth);
            agent.log(`プリセット選択: ${btn.textContent.split('\n')[0]} → ${strategy.layer}`, 'decision');
            updateAgentLog();
        });
    });

    // デバイス選択
    const deviceSelect = document.getElementById('device-select');
    if (deviceSelect) {
        deviceSelect.addEventListener('change', (e) => {
            agent.device = deviceProfiles[e.target.value];
            const strategy = agent.selectStrategy(agent.bandwidth);
            agent.log(`デバイス変更: ${agent.device.name}`, 'info');
            agent.log(`再評価: ${strategy.layer} (${strategy.codec})`, 'decision');
            updateAgentLog();
        });
    }

    // 初期描画開始
    agent.log('Hyper-GIF Agent 初期化完了', 'info');
    agent.log('Environment Observer: アクティブ', 'info');
    startPlayback();

    // スムーススクロール
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // GIFアップロード機能
    const uploadTrigger = document.getElementById('upload-trigger');
    const fileInput = document.getElementById('gif-upload');
    let uploadedImage = null;

    if (uploadTrigger && fileInput) {
        uploadTrigger.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'image/gif') {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        uploadedImage = img;
                        agent.log('GIFファイルを読み込みました', 'info');
                        agent.log('HGIF最適化プロセスを開始します...', 'decision');

                        const uploadText = uploadTrigger.querySelector('.upload-text');
                        if (uploadText) uploadText.textContent = '別のGIFをアップロード';
                        uploadTrigger.style.background = 'rgba(0,0,0,0.1)';

                        setTimeout(() => {
                            agent.log('AIレイヤー生成完了 (Core/Enhance)', 'info');
                            agent.log('デプロイ準備完了', 'decision');
                            updateAgentLog();
                        }, 1500);
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // drawFrameをラップしてアップロード画像を表示できるようにする
    const originalDrawFrame = drawFrame;
    drawFrame = (strategy) => {
        originalDrawFrame(strategy);

        if (uploadedImage) {
            const s = Math.min(canvas.width / uploadedImage.width, canvas.height / uploadedImage.height) * 0.6;
            const w = uploadedImage.width * s;
            const h = uploadedImage.height * s;

            ctx.save();
            ctx.shadowBlur = strategy.layer === 'L2' ? 20 : 5;
            ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
            ctx.drawImage(uploadedImage, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            ctx.restore();
        }
    };
});

