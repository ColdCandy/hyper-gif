/**
 * Hyper-GIF デモプレイヤー
 * Agentic Vision による自律制御シミュレーション
 */

/**
 * HyperGIFAgentクラス
 * 帯域幅やデバイス性能に基づいて再生戦略を決定し、ログを管理する
 */
class HyperGIFAgent {
    constructor(deviceProfile) {
        this.device = deviceProfile;
        this.bandwidth = 100;
        this.currentLayer = 'L1';
        this.upscalerActive = false;
        this.logEntries = [];
    }

    /**
     * 現在の環境に最適な再生戦略（レイヤー、品質、FPSなど）を返す
     */
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

    /**
     * ログを記録し、UIを更新するトリガーとなる
     */
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('ja-JP');
        this.logEntries.unshift({ timestamp, message, type });
        if (this.logEntries.length > 20) this.logEntries.pop();
        updateAgentLog(); // UI更新を直接呼ぶ
    }
}

// デバイスプロファイル定義
const deviceProfiles = {
    mobile: { name: 'iPhone 15 Pro', gpuTier: 2, vvcSupport: false },
    tablet: { name: 'iPad Pro M2', gpuTier: 2, vvcSupport: false },
    laptop: { name: 'RTX 4060 Laptop', gpuTier: 3, vvcSupport: true },
    desktop: { name: 'High Performance Desktop', gpuTier: 4, vvcSupport: true }
};

// --- グローバルステート管理 ---
const state = {
    agent: new HyperGIFAgent(deviceProfiles.desktop),
    animationId: null,
    isPlaying: false,
    uploadedImage: null,
    isProcessing: false,
    processingProgress: 0,
    canvas: null,
    ctx: null
};

/**
 * UIのログセクションを更新
 */
function updateAgentLog() {
    const logElement = document.getElementById('agent-log');
    if (!logElement) return;
    logElement.innerHTML = state.agent.logEntries.map(entry =>
        `<div class="log-entry ${entry.type}">[${entry.timestamp}] ${entry.message}</div>`
    ).join('');
}

/**
 * HUD（ヘッドアップディスプレイ）を更新
 */
function updateHUD(strategy) {
    const elements = {
        'current-layer': strategy.layer,
        'current-quality': strategy.quality,
        'current-fps': strategy.fps
    };
    for (const [id, val] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
}

// --- 描画エンジン ---

/**
 * Canvasにフレームを描画するメイン関数
 */
function drawFrame(strategy) {
    if (!state.ctx || !state.canvas) return;
    const { ctx, canvas } = state;
    const time = Date.now() / 1000;

    // 1. 背景の描画
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

    // 2. モーションパーティクル
    const particleCount = strategy.layer === 'L2' ? 50 : 20;
    ctx.save();
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
    ctx.restore();

    // 3. コンテンツ（画像または独自オブジェクト）の描画
    if (state.uploadedImage) {
        const s = Math.min(canvas.width / state.uploadedImage.width, canvas.height / state.uploadedImage.height) * 0.7;
        const w = state.uploadedImage.width * s;
        const h = state.uploadedImage.height * s;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;

        if (state.isProcessing) {
            drawProcessingOverlay(ctx, canvas, x, y, w, h);
        } else {
            drawEnhancedImage(ctx, state.uploadedImage, x, y, w, h, strategy);
        }
    } else {
        drawDefaultObject(ctx, canvas, time, strategy);
    }
}

/**
 * デフォルトのHGIFロゴアニメーションを描画
 */
function drawDefaultObject(ctx, canvas, time, strategy) {
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

/**
 * AI解析中のオーバーレイ効果
 */
function drawProcessingOverlay(ctx, canvas, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width * 0.5;
    const barHeight = 8;
    const barX = (canvas.width - barWidth) / 2;
    const barY = canvas.height / 2;

    // プログレス背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // プログレスバー
    const grad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    grad.addColorStop(0, '#a855f7');
    grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barWidth * (state.processingProgress / 100), barHeight);

    ctx.font = 'bold 16px Inter';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('HGIF AI PROCESSING...', canvas.width / 2, barY - 25);
    ctx.restore();
}

/**
 * AIアップスケーリング/HDR効果を適用した画像の描画
 */
function drawEnhancedImage(ctx, img, x, y, w, h, strategy) {
    ctx.save();
    if (strategy.layer === 'L2') {
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
        ctx.filter = 'contrast(1.2) saturate(1.4) brightness(1.1)';
        ctx.drawImage(img, x, y, w, h);
    } else {
        ctx.filter = 'contrast(1.0) grayscale(0.2)';
        ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();

    // 品質ラベル
    ctx.fillStyle = strategy.layer === 'L2' ? '#a855f7' : '#71717a';
    ctx.font = 'bold 12px JetBrains Mono';
    ctx.textAlign = 'right';
    ctx.fillText(strategy.layer === 'L2' ? '● HIGH-FIDELITY HGIF' : '○ STANDARD L1', x + w - 10, y + h - 10);
}

/**
 * メインループ
 */
function animate() {
    const strategy = state.agent.selectStrategy(state.agent.bandwidth);
    drawFrame(strategy);
    updateHUD(strategy);
    if (state.isPlaying) {
        state.animationId = requestAnimationFrame(animate);
    }
}

// --- 初期化 & イベントリスナー ---

document.addEventListener('DOMContentLoaded', () => {
    // Canvas初期化
    state.canvas = document.getElementById('demo-canvas');
    if (state.canvas) state.ctx = state.canvas.getContext('2d');

    const bandwidthSlider = document.getElementById('bandwidth-slider');
    const bandwidthValue = document.getElementById('bandwidth-value');
    const autoModeSwitch = document.getElementById('auto-mode');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('gif-upload');
    const downloadBtn = document.getElementById('download-btn');
    const deviceSelect = document.getElementById('device-select');

    // 帯域幅の変更
    bandwidthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.agent.bandwidth = val;
        bandwidthValue.textContent = val;
        state.agent.log(`帯域幅変更: ${val} Mbps`, 'decision');
    });

    // オートモード（シミュレーション）
    let autoInterval = null;
    const toggleAuto = (isAuto) => {
        bandwidthSlider.disabled = isAuto;
        if (isAuto) {
            state.agent.log('Auto AI Control: ON', 'info');
            autoInterval = setInterval(() => {
                const noise = Math.sin(Date.now() / 2000) * 150;
                state.agent.bandwidth = Math.round(Math.max(1, Math.min(1000, 150 + noise + Math.random() * 50)));
                bandwidthSlider.value = state.agent.bandwidth;
                bandwidthValue.textContent = state.agent.bandwidth;
            }, 1000);
        } else {
            state.agent.log('Auto AI Control: OFF', 'info');
            if (autoInterval) clearInterval(autoInterval);
        }
    };
    autoModeSwitch.addEventListener('change', (e) => toggleAuto(e.target.checked));
    if (autoModeSwitch.checked) toggleAuto(true);

    // デバイスプロファイルの変更
    if (deviceSelect) {
        deviceSelect.addEventListener('change', (e) => {
            state.agent.device = deviceProfiles[e.target.value];
            state.agent.log(`デバイスプロファイル変更: ${state.agent.device.name}`, 'info');
        });
    }

    // プリセットボタン
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.dataset.bandwidth);
            autoModeSwitch.checked = false;
            toggleAuto(false);
            state.agent.bandwidth = val;
            bandwidthSlider.value = val;
            bandwidthValue.textContent = val;
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.agent.log(`プリセット選択: ${btn.textContent}`, 'decision');
        });
    });

    // 画像アップロード
    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) {
            state.agent.log('エラー: 非対応のファイル形式です', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                state.uploadedImage = img;
                state.isProcessing = true;
                state.processingProgress = 0;
                if (downloadBtn) downloadBtn.disabled = true;

                state.agent.log('HGIF次世代変換エンジン: 起動', 'decision');

                const interval = setInterval(() => {
                    state.processingProgress += 2;
                    if (state.processingProgress >= 100) {
                        clearInterval(interval);
                        state.isProcessing = false;
                        if (downloadBtn) downloadBtn.disabled = false;
                        state.agent.log('AIアップスケーリング完了: 最高画質で再生中', 'decision');
                    }
                }, 30);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    if (dropZone) {
        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && !e.target.closest('.player-hud')) {
                fileInput.click();
            }
        });

        ['dragenter', 'dragover'].forEach(n => dropZone.addEventListener(n, e => {
            e.preventDefault();
            dropZone.style.borderColor = '#a855f7';
        }));

        ['dragleave', 'drop'].forEach(n => dropZone.addEventListener(n, e => {
            e.preventDefault();
            dropZone.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }));

        dropZone.addEventListener('drop', (e) => {
            handleFile(e.dataTransfer.files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    }

    // ダウンロード
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!state.uploadedImage) return;
            const link = document.createElement('a');
            link.download = 'processed_image.hgif';
            const cap = document.createElement('canvas');
            cap.width = state.uploadedImage.width;
            cap.height = state.uploadedImage.height;
            const cctx = cap.getContext('2d');
            cctx.filter = 'contrast(1.2) saturate(1.4) brightness(1.1)';
            cctx.drawImage(state.uploadedImage, 0, 0);
            link.href = cap.toDataURL('image/png');
            link.click();
            state.agent.log('HGIF形式でファイルを書き出しました', 'info');
        });
    }

    // 起動
    state.isPlaying = true;
    animate();
});
