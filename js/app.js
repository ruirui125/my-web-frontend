// 全局变量
let audioData = [];
let filteredData = [];
let currentPage = 1;
let currentCategory = 'all';
let currentSearchTerm = '';
let currentAudio = null;

// 下载限流相关变量 (这部分功能保持不变)
let downloadCount = 0;
let downloadTimestamps = [];
let downloadLimitReached = false;
let downloadLimitTimer = null;

// ==========================================================
// ==================== 主要修改区域开始 ====================
// ==========================================================

// 后端 API 的地址。注意：这是一个备用地址，首选是从 Vercel 环境变量中读取。
// ⚠️ 如果部署后不工作，请确保您在 Vercel 上设置了 VITE_API_URL 环境变量！
const BACKEND_API_BASE_URL = import.meta.env.VITE_API_URL || 'https://YOUR-BACKEND-URL.vercel.app';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    checkDownloadLimitStatus();
    initializeEventListeners();
    loadAudioData(); // 函数名不变，但内部实现已修改
});

async function loadAudioData() {
    try {
        showLoading(true);
        showStatus('', '');

        // 新的代码：从云端后端 API 获取数据
        const response = await fetch(`${BACKEND_API_BASE_URL}/api/tracks`);
        
        if (!response.ok) {
            throw new Error(`无法加载音频数据: ${response.status}`);
        }
        
        // 后端直接返回 JSON，我们不再需要手动解析 .txt 文件
        const tracks = await response.json();
        
        if (tracks && tracks.length > 0) {
            // 将从数据库获取的数据格式化为前端需要的格式
            audioData = tracks.map(track => ({
                id: track.id,
                filename: track.title, // 使用 title 作为 filename
                title: track.title.replace(/\.\w+$/, ''), // 移除扩展名
                category: '背景音乐', // 您可以未来在数据库中增加 category 字段
                url: track.audio_url
            }));
            console.log(`成功从 API 加载 ${audioData.length} 个音频文件`);
        } else {
            throw new Error("API 返回了空数据");
        }
        
        // 过滤和渲染数据
        filterAndRenderAudio();
        showLoading(false);
        
    } catch (error) {
        console.error('加载音频数据时出错:', error);
        showStatus('error', `加载音频数据时出错: ${error.message}。请检查后端服务是否正常，以及 Vercel 环境变量是否已正确设置。`);
        showLoading(false);
    }
}

// 移除了 parseAudioMappingFile 函数，因为不再需要它了

// ========================================================
// ==================== 主要修改区域结束 ====================
// ========================================================


// 其他所有函数 (initializeEventListeners, searchAudio, playAudio, etc.) 保持不变
// 为了简洁，这里省略，请保留您文件中这部分的原有代码
// For brevity, the rest of the functions are omitted here. 
// Please keep the original code for the other functions in your file.
// For completeness, here is the full code again:

const CONFIG = {
    PAGINATION: {
        PAGE_SIZE: 24
    },
    DOWNLOAD_LIMIT: {
        MAX_PER_MINUTE: 10,  // 每分钟最大下载数
        COOLDOWN_TIME: 180000  // 冷却时间（毫秒）- 3分钟
    }
};

function initializeEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    searchButton.addEventListener('click', searchAudio);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchAudio();
        }
    });

    const categoryButtons = document.querySelectorAll('.category-button');
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.category;
            currentPage = 1;
            filterAndRenderAudio();
        });
    });

    document.getElementById('first-page').addEventListener('click', () => goToPage(1));
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage === 1) {
            const totalPages = Math.ceil(filteredData.length / CONFIG.PAGINATION.PAGE_SIZE);
            goToPage(totalPages);
        } else {
            goToPage(currentPage - 1);
        }
    });
    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / CONFIG.PAGINATION.PAGE_SIZE);
        if (currentPage === totalPages) {
            goToPage(1);
        } else {
            goToPage(currentPage + 1);
        }
    });
    document.getElementById('last-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / CONFIG.PAGINATION.PAGE_SIZE);
        goToPage(totalPages);
    });
    
    document.getElementById('go-to-page').addEventListener('click', () => {
        const pageInput = document.getElementById('page-input');
        const pageNumber = parseInt(pageInput.value);
        if (!isNaN(pageNumber)) {
            goToPage(pageNumber);
        }
    });
    
    document.getElementById('page-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const pageNumber = parseInt(this.value);
            if (!isNaN(pageNumber)) {
                goToPage(pageNumber);
            }
        }
    });
}

function checkDownloadLimitStatus() {
    const limitData = localStorage.getItem('downloadLimitData');
    if (limitData) {
        const data = JSON.parse(limitData);
        if (data.expiryTime > Date.now()) {
            downloadLimitReached = true;
            downloadTimestamps = data.timestamps;
            const remainingTime = data.expiryTime - Date.now();
            downloadLimitTimer = setTimeout(() => {
                downloadLimitReached = false;
                downloadTimestamps = [];
                localStorage.removeItem('downloadLimitData');
                showNotification('info', '您现在可以继续下载音频文件');
            }, remainingTime);
        } else {
            localStorage.removeItem('downloadLimitData');
        }
    }
}

function searchAudio() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    currentSearchTerm = searchTerm;
    currentPage = 1;
    filterAndRenderAudio();
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredData.length / CONFIG.PAGINATION.PAGE_SIZE);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderAudioGrid();
        window.scrollTo(0, 0);
        document.getElementById('page-input').value = currentPage;
    }
}

function filterAndRenderAudio() {
    filteredData = audioData.filter(audio => {
        const categoryMatch = currentCategory === 'all' || audio.category === currentCategory;
        const searchMatch = !currentSearchTerm || 
            audio.title.toLowerCase().includes(currentSearchTerm) || 
            audio.filename.toLowerCase().includes(currentSearchTerm);
        return categoryMatch && searchMatch;
    });
    updatePagination();
    renderAudioGrid();
}

function renderAudioGrid() {
    const audioGrid = document.getElementById('audioGrid');
    audioGrid.innerHTML = '';
    
    if (filteredData.length === 0) {
        audioGrid.innerHTML = '<div class="empty-message">没有找到匹配的音频文件</div>';
        return;
    }
    
    const startIndex = (currentPage - 1) * CONFIG.PAGINATION.PAGE_SIZE;
    const endIndex = Math.min(startIndex + CONFIG.PAGINATION.PAGE_SIZE, filteredData.length);
    const currentPageData = filteredData.slice(startIndex, endIndex);
    
    currentPageData.forEach(audio => {
        const card = document.createElement('div');
        card.className = 'audio-card';
        card.dataset.id = audio.id;
        
        if (currentAudio && currentAudio.id === audio.id) {
            card.classList.add('active');
        }
        
        card.innerHTML = `
            <div class="audio-title">${audio.title}</div>
            <div class="audio-info">
                <div>分类: ${audio.category}</div>
            </div>
            <div class="audio-actions">
                <button class="play-button" title="播放">
                    <i class="fas fa-play"></i>
                </button>
                <button class="download-button" title="下载">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;
        
        card.addEventListener('click', () => playAudio(audio));
        audioGrid.appendChild(card);
    });
    
    document.querySelectorAll('.play-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = e.target.closest('.audio-card');
            const audioId = parseInt(card.dataset.id);
            const audio = filteredData.find(a => a.id === audioId);
            if (audio) {
                playAudio(audio);
            }
        });
    });
    
    document.querySelectorAll('.download-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = e.target.closest('.audio-card');
            const audioId = parseInt(card.dataset.id);
            const audio = filteredData.find(a => a.id === audioId);
            if (audio) {
                downloadAudio(audio);
            }
        });
    });
}

function playAudio(audio) {
    currentAudio = audio;
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = audio.url;
    audioPlayer.play();
    document.getElementById('current-audio-title').textContent = audio.title;
    const categoryElement = document.getElementById('current-audio-category');
    categoryElement.textContent = audio.category;
    categoryElement.style.display = 'inline-block';
    
    document.querySelectorAll('.audio-card').forEach(card => {
        if (parseInt(card.dataset.id) === audio.id) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

function downloadAudio(audio) {
    if (downloadLimitReached) {
        showDownloadLimitAlert();
        return;
    }
    
    const now = Date.now();
    downloadTimestamps = downloadTimestamps.filter(timestamp => now - timestamp < CONFIG.DOWNLOAD_LIMIT.COOLDOWN_TIME);
    
    if (downloadTimestamps.length >= CONFIG.DOWNLOAD_LIMIT.MAX_PER_MINUTE) {
        downloadLimitReached = true;
        const expiryTime = now + CONFIG.DOWNLOAD_LIMIT.COOLDOWN_TIME;
        localStorage.setItem('downloadLimitData', JSON.stringify({
            timestamps: downloadTimestamps,
            expiryTime: expiryTime
        }));
        showDownloadLimitAlert();
        downloadLimitTimer = setTimeout(() => {
            downloadLimitReached = false;
            downloadTimestamps = [];
            localStorage.removeItem('downloadLimitData');
            showNotification('info', '您现在可以继续下载音频文件');
        }, CONFIG.DOWNLOAD_LIMIT.COOLDOWN_TIME);
        return;
    }
    
    try {
        downloadTimestamps.push(now);
        const filename = audio.filename;
        
        fetch(audio.url) // 使用从API获取的完整URL
            .then(response => response.blob())
            .then(blob => {
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl);
                }, 100);
                showNotification('success', `正在下载: ${filename} (本分钟已下载 ${downloadTimestamps.length}/${CONFIG.DOWNLOAD_LIMIT.MAX_PER_MINUTE})`);
            })
            .catch(error => {
                console.error('下载失败:', error);
                showNotification('error', `下载失败: ${error.message}`);
            });
    } catch (error) {
        console.error('下载失败:', error);
        showNotification('error', `下载失败: ${error.message}`);
    }
}

function showDownloadLimitAlert() {
    const alertBox = document.createElement('div');
    alertBox.className = 'download-limit-alert';
    alertBox.innerHTML = `
        <div class="download-limit-content">
            <h3>下载频率过高</h3>
            <p>您在短时间内下载了过多音频文件。</p>
            <p>为了防止批量下载，系统已临时限制下载功能。</p>
            <p>请稍后再尝试下载。</p>
            <button id="close-alert">我知道了</button>
        </div>
    `;
    document.body.appendChild(alertBox);
    document.getElementById('close-alert').addEventListener('click', () => {
        document.body.removeChild(alertBox);
    });
    setTimeout(() => {
        if (document.body.contains(alertBox)) {
            document.body.removeChild(alertBox);
        }
    }, 5000);
}

function showNotification(type, message, duration = 3000) {
    const notification = document.getElementById('notification');
    notification.className = 'notification';
    notification.classList.add(type);
    notification.classList.add('show');
    notification.textContent = message;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

function updatePagination() {
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / CONFIG.PAGINATION.PAGE_SIZE);
    
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent = totalPages;
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('page-input').value = currentPage;
    document.getElementById('page-input').max = totalPages;
    
    document.getElementById('first-page').disabled = false;
    document.getElementById('prev-page').disabled = false;
    document.getElementById('next-page').disabled = false;
    document.getElementById('last-page').disabled = false;
    
    document.getElementById('pagination').style.display = totalItems > 0 ? 'flex' : 'none';
}

function showLoading(isLoading) {
    document.getElementById('loadingIndicator').style.display = isLoading ? 'block' : 'none';
}

function showStatus(type, message) {
    const statusElement = document.getElementById('statusMessage');
    
    if (!message) {
        statusElement.style.display = 'none';
        return;
    }
    
    statusElement.className = 'status';
    if (type) {
        statusElement.classList.add(type);
    }
    
    statusElement.textContent = message;
    statusElement.style.display = 'block';
}
