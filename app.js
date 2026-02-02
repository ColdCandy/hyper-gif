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

    // Auto Mode 制御ロジック
    const autoModeSwitch = document.getElementById('auto-mode');
    let autoInterval = null;

    const startAutoMode = () => {
        if (autoInterval) clearInterval(autoInterval);
        autoInterval = setInterval(() => {
            if (!autoModeSwitch.checked) {
                clearInterval(autoInterval);
                return;
            }

            // 擬似的な回線変動シミュレーション
            const noise = Math.sin(Date.now() / 2000) * 100;
            const newBandwidth = Math.max(1, Math.min(1000, 100 + noise + Math.random() * 50));

            agent.bandwidth = Math.round(newBandwidth);
            bandwidthSlider.value = agent.bandwidth;
            bandwidthValue.textContent = agent.bandwidth;

            const strategy = agent.selectStrategy(agent.bandwidth);
            // ログが多すぎないように戦略が変わった時だけ記録
            if (agent.currentLayer !== strategy.layer) {
                agent.currentLayer = strategy.layer;
                agent.log(`Auto Control: 回線変動検知 → ${strategy.layer}に最適化`, 'decision');
                updateAgentLog();
            }
        }, 1000);
    };

    autoModeSwitch.addEventListener('change', (e) => {
        const isAuto = e.target.checked;
        bandwidthSlider.disabled = isAuto;
        document.querySelectorAll('.preset-btn').forEach(btn => btn.disabled = isAuto);

        if (isAuto) {
            agent.log('Auto AI Control: ON (自律制御モード)', 'info');
            startAutoMode();
        } else {
            agent.log('Auto AI Control: OFF (マニュアルモード)', 'info');
            if (autoInterval) clearInterval(autoInterval);
        }
        updateAgentLog();
    });

    // 初期化時にオートモードなら開始
    if (autoModeSwitch.checked) startAutoMode();

    // GIFアップロード機能
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('gif-upload');
    let uploadedImage = null;
    let isProcessing = false;
    let processingProgress = 0;

    const handleFile = (file) => {
        if (file && file.type === 'image/gif') {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    uploadedImage = img;
                    isProcessing = true;
                    processingProgress = 0;
                    dropZone.classList.add('has-file');

                    agent.log('GIFファイルを読み込みました', 'info');
                    agent.log('HGIF AI解析エンジンを起動中...', 'decision');

                    // 処理中シミュレーション（プログレス）
                    const downloadBtn = document.getElementById('download-btn');
                    downloadBtn.disabled = true;

                    const processInterval = setInterval(() => {
                        processingProgress += 5;
                        if (processingProgress >= 100) {
                            clearInterval(processInterval);
                            isProcessing = false;
                            downloadBtn.disabled = false; // ダウンロード可能にする
                            agent.log('AIアップスケーリング完了: 4K相当', 'info');
                            agent.log('10bit HDR色彩情報を再構築しました', 'info');
                            agent.log('HGIF 実行中 - 次世代品質で再生しています', 'decision');
                            updateAgentLog();
                        }
                    }, 100);

                    const uploadText = dropZone.querySelector('.upload-text');
                    if (uploadText) uploadText.textContent = '別のファイルを処理';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else if (file) {
            agent.log('エラー: GIFファイルを選択してください', 'error');
            updateAgentLog();
        }
    };

    if (dropZone && fileInput) {
        // クリックでファイル選択
        dropZone.addEventListener('click', (e) => {
            // HUDなどの子要素クリック時は反応させない
            if (e.target.closest('.player-hud')) return;
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            handleFile(e.target.files[0]);
        });

        // ドラッグ＆ドロップ
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            handleFile(file);
        }, false);
    }

    // drawFrameをラップして『実行』ロジックを組み込む
    const originalDrawFrame = drawFrame;
    drawFrame = (strategy) => {
        originalDrawFrame(strategy);

        if (uploadedImage) {
            const s = Math.min(canvas.width / uploadedImage.width, canvas.height / uploadedImage.height) * 0.7;
            const w = uploadedImage.width * s;
            const h = uploadedImage.height * s;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;

            if (isProcessing) {
                // 解析中アニメーション
                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(x, y, w, h);

                // プログレスバー
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 50, y + h / 2, w - 100, 10);
                ctx.fillStyle = '#a855f7';
                ctx.fillRect(x + 50, y + h / 2, (w - 100) * (processingProgress / 100), 10);

                // スキャンライン
                const scanY = y + (Math.sin(Date.now() / 200) * 0.5 + 0.5) * h;
                ctx.beginPath();
                ctx.moveTo(x, scanY);
                ctx.lineTo(x + w, scanY);
                ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.font = '14px Inter';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.fillText('AI ANALYZING: ' + processingProgress + '%', canvas.width / 2, y + h / 2 - 20);
                ctx.restore();
            } else {
                // 実行中の描画（品質に応じて加工）
                ctx.save();

                if (strategy.layer === 'L2') {
                    // 次世代品質 (VVC/HDRシミュレーション)
                    ctx.shadowBlur = 30;
                    ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';

                    // 色彩を強調（オーバーレイ的な効果）
                    ctx.filter = 'contrast(1.2) saturate(1.4) brightness(1.1)';
                    ctx.drawImage(uploadedImage, x, y, w, h);

                    // HDRゴースト効果（微細なズレで解像感向上を演出）
                    ctx.globalAlpha = 0.1;
                    ctx.filter = 'blur(10px)';
                    ctx.drawImage(uploadedImage, x, y, w, h);
                } else {
                    // 通常品質 (L1)
                    ctx.filter = 'contrast(1.0) grayscale(0.2)';
                    ctx.drawImage(uploadedImage, x, y, w, h);
                }

                ctx.restore();

                // UIラベル
                ctx.fillStyle = strategy.layer === 'L2' ? '#a855f7' : '#71717a';
                ctx.font = 'bold 12px JetBrains Mono';
                ctx.textAlign = 'right';
                ctx.fillText(strategy.layer === 'L2' ? '● HIGH-FIDELITY HGIF' : '○ STANDARD L1', x + w - 10, y + h - 10);
            }
        }
        // ダウンロード機能の実行
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (!uploadedImage) return;

                // ファイル保存用のリンクを作成
                const link = document.createElement('a');
                link.download = 'processed_image.hgif';

                // 一時的にキャプチャ用のCanvasを作成（背景を抜いた画像単体にするため）
                const captureCanvas = document.createElement('canvas');
                captureCanvas.width = uploadedImage.width;
                captureCanvas.height = uploadedImage.height;
                const cctx = captureCanvas.getContext('2d');

                // L2（高品質）エフェクトを適用して描画
                cctx.filter = 'contrast(1.2) saturate(1.4) brightness(1.1)';
                cctx.drawImage(uploadedImage, 0, 0);

                link.href = captureCanvas.toDataURL('image/png'); // 中身は高品質PNGだが拡張子をhgifに
                link.click();

                agent.log('HGIF形式でファイルを書き出しました', 'info');
                updateAgentLog();
            });
        }
    });
