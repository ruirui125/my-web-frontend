// 配置
const CONFIG = {
    PAGINATION: {
        PAGE_SIZE: 24
    },
    R2_BASE_URL: "https://pub-9080df1990a64ae1b863768bfcb203b9.r2.dev/background-music/",
    DOWNLOAD_LIMIT: {
        MAX_PER_MINUTE: 10,  // 每分钟最大下载数
        COOLDOWN_TIME: 180000  // 冷却时间（毫秒）- 3分钟
    }
};

// 全局变量
let audioData = [];
let filteredData = [];
let currentPage = 1;
let currentCategory = 'all';
let currentSubCategory = 'all';
let currentSearchTerm = '';
let currentAudio = null;
let availableTags = [];

// 下载限流相关变量
let downloadCount = 0;
let downloadTimestamps = [];
let downloadLimitReached = false;
let downloadLimitTimer = null;

// 初始化时检查本地存储中的限制状态
function checkDownloadLimitStatus() {
    const limitData = localStorage.getItem('downloadLimitData');
    if (limitData) {
        const data = JSON.parse(limitData);
        
        // 检查限制是否仍然有效
        if (data.expiryTime > Date.now()) {
            // 恢复限制状态
            downloadLimitReached = true;
            downloadTimestamps = data.timestamps;
            
            // 设置新的定时器
            const remainingTime = data.expiryTime - Date.now();
            downloadLimitTimer = setTimeout(() => {
                downloadLimitReached = false;
                downloadTimestamps = [];
                localStorage.removeItem('downloadLimitData');
                showNotification('info', '您现在可以继续下载音频文件');
            }, remainingTime);
        } else {
            // 限制已过期，清除存储
            localStorage.removeItem('downloadLimitData');
        }
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    checkDownloadLimitStatus();
    initializeEventListeners();
    loadAudioData();
});

function initializeEventListeners() {
    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    searchButton.addEventListener('click', searchAudio);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchAudio();
        }
    });

    // 分类筛选
    const categoryButtons = document.querySelectorAll('.category-button');
    categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 更新按钮状态
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 更新当前分类
            currentCategory = this.dataset.category;
            currentPage = 1;
            
            // 重置二级分类
            currentSubCategory = 'all';
            const subCategoryButtons = document.querySelectorAll('.sub-category-button');
            subCategoryButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector('.sub-category-button[data-subcategory="all"]').classList.add('active');
            
            // 重新过滤和渲染数据
            filterAndRenderAudio();
        });
    });
    
    // 二级分类筛选
    const subCategoryButtons = document.querySelectorAll('.sub-category-button');
    subCategoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 更新按钮状态
            subCategoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 更新当前二级分类
            currentSubCategory = this.dataset.subcategory;
            currentPage = 1;
            
            // 重新过滤和渲染数据
            filterAndRenderAudio();
        });
    });

    // 分页控件
    document.getElementById('first-page').addEventListener('click', () => goToPage(1));
    document.getElementById('prev-page').addEventListener('click', () => {
        // 如果当前是第一页，则循环到最后一页
        if (currentPage === 1) {
            const totalPages = Math.ceil(filteredData.length / CONFIG.PAGINATION.PAGE_SIZE);
            goToPage(totalPages);
        } else {
            goToPage(currentPage - 1);
        }
    });
    document.getElementById('next-page').addEventListener('click', () => {
        // 如果当前是最后一页，则循环到第一页
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
    
    // 页码输入跳转
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
        
        // 更新页码输入框
        document.getElementById('page-input').value = currentPage;
    }
}

async function loadAudioData() {
    try {
        showLoading(true);
        showStatus('', '');

        // 从JSON文件中加载带标签的音乐数据
        const response = await fetch('/frontend/music_with_tags.json');
        if (!response.ok) {
            throw new Error(`无法加载音频数据: ${response.status} ${response.statusText}`);
        }
        
        const musicFiles = await response.json();
        
        if (musicFiles.length > 0) {
            audioData = musicFiles;
            console.log(`成功加载 ${audioData.length} 个音频文件`);
        } else {
            console.warn('未从JSON文件中解析到数据，使用硬编码的数据');
            // 使用硬编码的示例数据
            audioData = [
                { id: 1, filename: "1 129.mp3", title: "1 129", category: "背景音乐", tags: ["欢快", "常用BGM"], url: "https://pub-9080df1990a64ae1b863768bfcb203b9.r2.dev/background-music/1%20129.mp3" },
                { id: 2, filename: "1 50.mp3", title: "1 50", category: "背景音乐", tags: ["温馨轻松", "常用BGM"], url: "https://pub-9080df1990a64ae1b863768bfcb203b9.r2.dev/background-music/1%2050.mp3" },
                { id: 3, filename: "1.mp3", title: "1", category: "背景音乐", tags: ["其他"], url: "https://pub-9080df1990a64ae1b863768bfcb203b9.r2.dev/background-music/1.mp3" }
            ];
        }
        
        // 收集所有可用的标签
        collectAvailableTags();
        
        // 过滤和渲染数据
        filterAndRenderAudio();
        showLoading(false);
        
        // 初始化二级分类显示
        updateSubCategoryDisplay();
        
    } catch (error) {
        console.error('加载音频数据时出错:', error);
        showStatus('error', `加载音频数据时出错: ${error.message}`);
        showLoading(false);
    }
}

function parseAudioMappingFile(text) {
    const musicFiles = [];
    const lines = text.split('\n');
    
    let currentIndex = 0;
    let currentTitle = '';
    let currentUrl = '';
    
    // 定义风格映射规则（根据文件名关键词判断风格）
    const styleKeywords = {
        '抖音大V': ['抖音', '大V', 'tiktok', 'douyin', 'viral', 'trend', 'popular'],
        '推文热曲': ['推文', '热曲', '热门', 'hot', 'trending', 'hit', 'popular', 'famous'],
        '温馨轻松': ['温馨', '轻松', '舒缓', '放松', 'relax', 'calm', 'peaceful', 'gentle', 'soft', 'warm', 'chill', 'lofi', 'ambient', 'piano'],
        '热血战斗': ['热血', '战斗', '激烈', '燃', 'epic', 'battle', 'fight', 'action', 'intense', 'power', 'energy', 'rock', 'metal', 'strong'],
        '国风': ['国风', '中国风', '古风', 'chinese', 'traditional', 'oriental', 'eastern', 'ancient', 'folk'],
        '欢快': ['欢快', '欢乐', '快乐', '喜悦', 'happy', 'joy', 'cheerful', 'upbeat', 'fun', 'positive', 'bright', 'dance', 'pop'],
        '爱情': ['爱情', '浪漫', '爱', '情', 'love', 'romantic', 'romance', 'heart', 'passion', 'sweet'],
        '悲伤': ['悲伤', '伤感', '忧伤', '悲', 'sad', 'sorrow', 'melancholy', 'emotional', 'tear', 'blue', 'depression', 'lonely'],
        '悬疑恐怖': ['悬疑', '恐怖', '惊悚', 'horror', 'scary', 'suspense', 'thriller', 'mystery', 'dark', 'tense', 'creepy', 'spooky'],
        '常用BGM': ['BGM', '背景', '常用', 'background', 'music', 'soundtrack', 'theme', 'score', 'instrumental']
    };
    
    // 根据文件名判断风格
    function determineStyle(filename) {
        const lowerFilename = filename.toLowerCase();
        
        // 尝试从文件名中匹配关键词
        for (const [style, keywords] of Object.entries(styleKeywords)) {
            for (const keyword of keywords) {
                if (lowerFilename.includes(keyword.toLowerCase())) {
                    return style;
                }
            }
        }
        
        // 使用更复杂的启发式规则进行判断
        
        // 检查是否包含音乐类型指示词
        if (/\b(edm|dubstep|trap|house|techno|electro)\b/.test(lowerFilename)) {
            return '热血战斗';
        }
        
        if (/\b(jazz|blues|soul)\b/.test(lowerFilename)) {
            return '温馨轻松';
        }
        
        if (/\b(rock|metal|punk|hard)\b/.test(lowerFilename)) {
            return '热血战斗';
        }
        
        if (/\b(pop|dance|disco)\b/.test(lowerFilename)) {
            return '欢快';
        }
        
        if (/\b(ballad|acoustic)\b/.test(lowerFilename)) {
            return '爱情';
        }
        
        // 检查文件名长度和特征
        if (lowerFilename.length < 10) {
            // 短文件名通常是常用BGM
            return '常用BGM';
        }
        
        // 检查是否包含数字（可能是抖音热门编号）
        if (/\d{3,}/.test(lowerFilename)) {
            return '抖音大V';
        }
        
        // 默认风格
        return '其他';
    }
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 跳过空行和注释
        if (!line || line.startsWith('#') || line.startsWith('## ') || line.startsWith('- ')) {
            continue;
        }
        
        // 检查是否是音频文件行（以数字开头）
        const match = line.match(/^(\d+)\.\s+(.+)$/);
        if (match) {
            // 如果已经有一个完整的条目，先保存它
            if (currentTitle && currentUrl) {
                const style = determineStyle(currentTitle);
                musicFiles.push({
                    id: currentIndex,
                    filename: currentTitle,
                    title: currentTitle.replace(/\.\w+$/, ''), // 移除扩展名
                    category: '背景音乐',
                    subCategory: style,
                    url: currentUrl
                });
            }
            
            currentIndex = parseInt(match[1]);
            currentTitle = match[2];
            currentUrl = '';
            continue;
        }
        
        // 检查是否是URL行
        if (line.startsWith('http') || line.trim().startsWith('http')) {
            currentUrl = line.trim();
            
            // 添加到音频文件列表
            if (currentTitle && currentUrl) {
                const style = determineStyle(currentTitle);
                musicFiles.push({
                    id: currentIndex,
                    filename: currentTitle,
                    title: currentTitle.replace(/\.\w+$/, ''), // 移除扩展名
                    category: '背景音乐',
                    subCategory: style,
                    url: currentUrl
                });
                
                // 重置
                currentTitle = '';
                currentUrl = '';
            }
        }
    }
    
    // 处理最后一个条目
    if (currentTitle && currentUrl) {
        const style = determineStyle(currentTitle);
        musicFiles.push({
            id: currentIndex,
            filename: currentTitle,
            title: currentTitle.replace(/\.\w+$/, ''), // 移除扩展名
            category: '背景音乐',
            subCategory: style,
            url: currentUrl
        });
    }
    
    return musicFiles;
}

// 初始化时收集所有可用的标签
function collectAvailableTags() {
    const tagSet = new Set();
    audioData.forEach(audio => {
        if (audio.tags && Array.isArray(audio.tags)) {
            audio.tags.forEach(tag => tagSet.add(tag));
        }
    });
    availableTags = Array.from(tagSet).sort();
    
    // 更新UI中的标签按钮
    updateTagButtons();
}

// 更新标签按钮
function updateTagButtons() {
    const subCategoryFilters = document.querySelector('.sub-category-filters');
    if (!subCategoryFilters) return;
    
    // 清空现有按钮
    subCategoryFilters.innerHTML = '';
    
    // 添加"全部风格"按钮
    const allButton = document.createElement('button');
    allButton.className = 'sub-category-button' + (currentSubCategory === 'all' ? ' active' : '');
    allButton.dataset.subcategory = 'all';
    allButton.textContent = '全部风格';
    allButton.addEventListener('click', function() {
        document.querySelectorAll('.sub-category-button').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        currentSubCategory = 'all';
        currentPage = 1;
        filterAndRenderAudio();
    });
    subCategoryFilters.appendChild(allButton);
    
    // 添加每个标签的按钮
    availableTags.forEach(tag => {
        const button = document.createElement('button');
        button.className = 'sub-category-button' + (currentSubCategory === tag ? ' active' : '');
        button.dataset.subcategory = tag;
        button.textContent = tag;
        button.addEventListener('click', function() {
            document.querySelectorAll('.sub-category-button').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentSubCategory = tag;
            currentPage = 1;
            filterAndRenderAudio();
        });
        subCategoryFilters.appendChild(button);
    });
}

function filterAndRenderAudio() {
    // 根据分类、标签和搜索词过滤数据
    filteredData = audioData.filter(audio => {
        // 分类过滤
        const categoryMatch = currentCategory === 'all' || audio.category === currentCategory;
        
        // 标签过滤（支持多标签）
        const tagMatch = currentSubCategory === 'all' || 
            (audio.tags && Array.isArray(audio.tags) && audio.tags.includes(currentSubCategory));
        
        // 搜索词过滤
        const searchMatch = !currentSearchTerm || 
            audio.title.toLowerCase().includes(currentSearchTerm) || 
            audio.filename.toLowerCase().includes(currentSearchTerm);
        
        return categoryMatch && tagMatch && searchMatch;
    });
    
    // 更新分页信息
    updatePagination();
    
    // 渲染音频网格
    renderAudioGrid();
    
    // 更新二级分类显示
    updateSubCategoryDisplay();
}

// 更新二级分类显示
function updateSubCategoryDisplay() {
    // 只有当主分类是"背景音乐"时才显示二级分类
    const subCategoryContainer = document.getElementById('subCategoryContainer');
    if (currentCategory === '背景音乐' || currentCategory === 'all') {
        subCategoryContainer.style.display = 'block';
    } else {
        subCategoryContainer.style.display = 'none';
    }
}

function renderAudioGrid() {
    const audioGrid = document.getElementById('audioGrid');
    audioGrid.innerHTML = '';
    
    if (filteredData.length === 0) {
        audioGrid.innerHTML = '<div class="empty-message">没有找到匹配的音频文件</div>';
        return;
    }
    
    // 计算当前页的数据
    const startIndex = (currentPage - 1) * CONFIG.PAGINATION.PAGE_SIZE;
    const endIndex = Math.min(startIndex + CONFIG.PAGINATION.PAGE_SIZE, filteredData.length);
    const currentPageData = filteredData.slice(startIndex, endIndex);
    
    // 渲染每个音频卡片
    currentPageData.forEach(audio => {
        const card = document.createElement('div');
        card.className = 'audio-card';
        card.dataset.id = audio.id;
        
        // 如果是当前播放的音频，添加active类
        if (currentAudio && currentAudio.id === audio.id) {
            card.classList.add('active');
        }
        
        card.innerHTML = `
            <div class="audio-title">${audio.title}</div>
            <div class="audio-info">
                <div>分类: ${audio.category}</div>
                ${audio.tags && audio.tags.length > 0 ? 
                    `<div class="tag-container">风格: ${audio.tags.map(tag => 
                        `<span class="sub-category-tag" data-tag="${tag}">${tag}</span>`
                    ).join(' ')}</div>` : 
                    ''}
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
        
        // 添加点击事件
        card.addEventListener('click', () => playAudio(audio));
        
        // 添加到网格
        audioGrid.appendChild(card);
    });
    
    // 添加播放按钮点击事件
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
    
    // 添加下载按钮点击事件
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
    
    // 添加标签点击事件
    document.querySelectorAll('.sub-category-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            e.stopPropagation();
            const tagName = e.target.dataset.tag;
            if (tagName) {
                // 更新当前二级分类
                currentSubCategory = tagName;
                currentPage = 1;
                
                // 更新按钮状态
                document.querySelectorAll('.sub-category-button').forEach(btn => {
                    if (btn.dataset.subcategory === tagName) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
                // 重新过滤和渲染数据
                filterAndRenderAudio();
                
                // 滚动到顶部
                window.scrollTo(0, 0);
            }
        });
    });
}

function playAudio(audio) {
    // 更新当前播放的音频
    currentAudio = audio;
    
    // 更新播放器
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = audio.url;
    audioPlayer.play();
    
    // 更新播放器信息
    document.getElementById('current-audio-title').textContent = audio.title;
    const categoryElement = document.getElementById('current-audio-category');
    categoryElement.textContent = audio.category;
    categoryElement.style.display = 'inline-block';
    
    // 更新音频卡片的active状态
    document.querySelectorAll('.audio-card').forEach(card => {
        if (parseInt(card.dataset.id) === audio.id) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

function downloadAudio(audio) {
    // 检查是否达到下载限制
    if (downloadLimitReached) {
        showDownloadLimitAlert();
        return;
    }
    
    // 检查下载次数
    const now = Date.now();
    
    // 移除过期的下载记录
    downloadTimestamps = downloadTimestamps.filter(timestamp => now - timestamp < CONFIG.DOWNLOAD_LIMIT.COOLDOWN_TIME);
    
    // 检查是否超过限制
    if (downloadTimestamps.length >= CONFIG.DOWNLOAD_LIMIT.MAX_PER_MINUTE) {
        // 设置限制标志
        downloadLimitReached = true;
        
        // 计算限制过期时间
        const expiryTime = now + CONFIG.DOWNLOAD_LIMIT.COOLDOWN_TIME;
        
        // 保存限制状态到本地存储
        localStorage.setItem('downloadLimitData', JSON.stringify({
            timestamps: downloadTimestamps,
            expiryTime: expiryTime
        }));
        
        // 显示限制提示
        showDownloadLimitAlert();
        
        // 设置定时器，冷却时间后解除限制
        downloadLimitTimer = setTimeout(() => {
            downloadLimitReached = false;
            downloadTimestamps = [];
            localStorage.removeItem('downloadLimitData');
            showNotification('info', '您现在可以继续下载音频文件');
        }, CONFIG.DOWNLOAD_LIMIT.COOLDOWN_TIME);
        
        return;
    }
    
    try {
        // 记录本次下载
        downloadTimestamps.push(now);
        
        // 从URL中提取文件名
        const filename = audio.filename;
        
        // 直接使用R2存储URL
        const r2Url = `https://pub-9080df1990a64ae1b863768bfcb203b9.r2.dev/background-music/${encodeURIComponent(filename)}`;
        
        // 使用Fetch API下载文件
        fetch(r2Url)
            .then(response => response.blob())
            .then(blob => {
                // 创建Blob URL
                const blobUrl = window.URL.createObjectURL(blob);
                
                // 创建一个临时的a元素
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename; // 设置下载的文件名
                a.style.display = 'none';
                
                // 添加到文档中
                document.body.appendChild(a);
                
                // 模拟点击
                a.click();
                
                // 短暂延迟后移除
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl); // 释放Blob URL
                }, 100);
                
                // 显示下载提示
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

// 显示下载限制提示
function showDownloadLimitAlert() {
    // 创建弹窗
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
    
    // 添加到文档
    document.body.appendChild(alertBox);
    
    // 添加关闭按钮事件
    document.getElementById('close-alert').addEventListener('click', () => {
        document.body.removeChild(alertBox);
    });
    
    // 自动关闭
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
    
    // 自动隐藏
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

function updatePagination() {
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / CONFIG.PAGINATION.PAGE_SIZE);
    
    // 更新分页信息
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent = totalPages;
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('page-input').value = currentPage;
    document.getElementById('page-input').max = totalPages;
    
    // 更新按钮状态 - 移除禁用状态，让所有按钮始终可点击
    document.getElementById('first-page').disabled = false;
    document.getElementById('prev-page').disabled = false;
    document.getElementById('next-page').disabled = false;
    document.getElementById('last-page').disabled = false;
    
    // 显示或隐藏分页控件
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