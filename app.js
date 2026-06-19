// NEO IPTV Player 애플리케이션 스크립트

document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 캐싱
    const video = document.getElementById('video');
    const playlistSelect = document.getElementById('playlist-select');
    const customUrlContainer = document.getElementById('custom-url-container');
    const customUrlInput = document.getElementById('custom-url-input');
    const customUrlBtn = document.getElementById('custom-url-btn');
    const searchInput = document.getElementById('search-input');
    const channelList = document.getElementById('channel-list');
    const channelCount = document.getElementById('channel-count');
    
    // 모바일 드로어 제어 요소
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // 플레이어 오버레이 요소
    const playerOverlay = document.getElementById('player-overlay');
    const overlayIcon = document.getElementById('overlay-icon');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMessage = document.getElementById('overlay-message');

    // 활성 채널 상세 정보 요소
    const activeLogoContainer = document.getElementById('active-logo-container');
    const activeChannelName = document.getElementById('active-channel-name');
    const activeChannelUrl = document.getElementById('active-channel-url');
    const activeTags = document.getElementById('active-tags');
    const refreshStreamBtn = document.getElementById('refresh-stream-btn');
    const copyUrlBtn = document.getElementById('copy-url-btn');

    let channels = []; // 파싱된 전체 채널 배열
    let currentChannel = null; // 현재 재생 중인 채널 객체
    let hlsInstance = null; // Hls.js 인스턴스

    // 초기 플레이리스트 로드
    loadPlaylist(playlistSelect.value);

    // 이벤트 리스너 등록
    playlistSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customUrlContainer.classList.remove('hidden');
        } else {
            customUrlContainer.classList.add('hidden');
            loadPlaylist(e.target.value);
        }
    });

    customUrlBtn.addEventListener('click', () => {
        const url = customUrlInput.value.trim();
        if (url) {
            loadPlaylist(url);
        } else {
            alert('올바른 M3U 플레이리스트 주소를 입력해 주세요.');
        }
    });

    searchInput.addEventListener('input', () => {
        filterChannels(searchInput.value.trim());
    });

    refreshStreamBtn.addEventListener('click', () => {
        if (currentChannel) {
            playChannel(currentChannel);
        }
    });

    copyUrlBtn.addEventListener('click', () => {
        if (currentChannel) {
            navigator.clipboard.writeText(currentChannel.url)
                .then(() => alert('스트리밍 주소가 클립보드에 복사되었습니다.'))
                .catch(() => alert('주소 복사에 실패했습니다.'));
        } else {
            alert('복사할 채널이 선택되지 않았습니다.');
        }
    });

    // 모바일 드로어 열기/닫기 이벤트
    sidebarToggleBtn.addEventListener('click', openSidebar);
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }

    // M3U 플레이리스트 로딩 및 파싱 함수
    async function loadPlaylist(url) {
        showLoadingState();
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP 에러! 상태코드: ${response.status}`);
            }
            const text = await response.text();
            channels = parseM3U(text);
            renderChannels(channels);
            
            if (channels.length > 0) {
                showOverlay('fa-circle-play', '채널 로드 완료', '보고 싶은 채널을 목록에서 선택해 주세요.');
            } else {
                showOverlay('fa-triangle-exclamation', '채널 없음', '플레이리스트 파일 내부에서 올바른 채널을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('플레이리스트 로드 오류:', error);
            showOverlay('fa-triangle-exclamation', '로딩 실패', `플레이리스트를 가져오는 중 오류가 발생했습니다.<br>${error.message}<br><br>CORS 제한 문제일 수 있으므로 로컬 파일 또는 CORS가 허용된 URL을 사용해 보세요.`);
            channelList.innerHTML = `<div class="no-channels"><i class="fa-solid fa-triangle-exclamation"></i> 플레이리스트 로드에 실패했습니다.</div>`;
            channelCount.textContent = '0';
        }
    }

    // 채널 로딩 상태 표시
    function showLoadingState() {
        channelList.innerHTML = `
            <div class="loading-channels">
                <i class="fa-solid fa-spinner fa-spin"></i> 채널 목록을 파싱하는 중...
            </div>
        `;
        channelCount.textContent = '0';
        showOverlay('fa-spinner fa-spin', '로딩 중', '플레이리스트 데이터를 불러오고 있습니다...');
    }

    // 플레이어 오버레이 제어 함수
    function showOverlay(iconClass, title, message) {
        playerOverlay.classList.remove('hidden');
        overlayIcon.className = `fa-solid ${iconClass}`;
        overlayTitle.innerHTML = title;
        overlayMessage.innerHTML = message;
    }

    // 모바일 지원을 위한 동적 안내 업데이트
    if (window.innerWidth <= 868) {
        document.getElementById('overlay-message').textContent = '상단 메뉴 버튼을 눌러 채널을 선택하면 재생이 시작됩니다.';
    }

    function hideOverlay() {
        playerOverlay.classList.add('hidden');
    }

    // 간단하고 성능이 우수한 M3U 파서 구현
    function parseM3U(m3uText) {
        const list = [];
        const lines = m3uText.split(/\r?\n/);
        
        let currentInfo = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                // 채널 정보 파싱
                currentInfo = {
                    name: '이름 없는 채널',
                    logo: '',
                    category: '기타',
                    country: 'UN',
                    url: ''
                };

                // 로고 및 추가 속성 정규식 매칭
                const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
                if (logoMatch) currentInfo.logo = logoMatch[1];

                const groupMatch = line.match(/group-title="([^"]+)"/i);
                if (groupMatch) currentInfo.category = groupMatch[1];

                // 채널 이름 추출 (쉼표 뒤의 텍스트)
                const commaIndex = line.indexOf(',');
                if (commaIndex !== -1) {
                    currentInfo.name = line.substring(commaIndex + 1).trim();
                }
            } else if (line && !line.startsWith('#')) {
                // 스트림 URL
                if (currentInfo) {
                    currentInfo.url = line;
                    list.push(currentInfo);
                    currentInfo = null;
                }
            }
        }
        return list;
    }

    // 채널 목록을 화면에 렌더링
    function renderChannels(channelArray) {
        channelList.innerHTML = '';
        channelCount.textContent = channelArray.length;

        if (channelArray.length === 0) {
            channelList.innerHTML = `<div class="no-channels"><i class="fa-solid fa-magnifying-glass"></i> 검색 결과가 없습니다.</div>`;
            return;
        }

        channelArray.forEach((channel, index) => {
            const card = document.createElement('div');
            card.className = 'channel-card';
            if (currentChannel && currentChannel.url === channel.url) {
                card.classList.add('active');
            }

            // 로고 이미지 설정 (이미지가 없을 시 기본 아이콘 대체)
            let logoHTML = `<i class="fa-solid fa-tv"></i>`;
            if (channel.logo) {
                logoHTML = `<img src="${channel.logo}" alt="${channel.name}" onerror="this.outerHTML='<i class=\'fa-solid fa-tv\'></i>'">`;
            }

            card.innerHTML = `
                <div class="channel-logo">
                    ${logoHTML}
                </div>
                <div class="channel-info">
                    <div class="channel-name">${escapeHTML(channel.name)}</div>
                    <div class="channel-meta">
                        <span class="channel-badge">${escapeHTML(channel.category)}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                // 활성화 스타일 클래스 변경
                document.querySelectorAll('.channel-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                // 모바일 환경일 경우, 채널 클릭 시 사이드바를 자동으로 닫음
                if (window.innerWidth <= 868) {
                    closeSidebar();
                }
                
                playChannel(channel);
            });

            channelList.appendChild(card);
        });
    }

    // 실시간 채널 필터링
    function filterChannels(keyword) {
        if (!keyword) {
            renderChannels(channels);
            return;
        }
        const filtered = channels.filter(c => 
            c.name.toLowerCase().includes(keyword.toLowerCase()) || 
            c.category.toLowerCase().includes(keyword.toLowerCase())
        );
        renderChannels(filtered);
    }

    // HTML 이스케이프 함수
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // 실제 비디오 채널 재생 컨트롤러
    function playChannel(channel) {
        currentChannel = channel;
        hideOverlay();

        // 현재 재생 중인 채널 정보 갱신
        activeChannelName.textContent = channel.name;
        activeChannelUrl.textContent = channel.url;
        
        let logoHTML = `<i class="fa-solid fa-tv"></i>`;
        if (channel.logo) {
            logoHTML = `<img src="${channel.logo}" alt="${channel.name}" onerror="this.outerHTML='<i class=\'fa-solid fa-tv\'></i>'">`;
        }
        activeLogoContainer.innerHTML = logoHTML;
        
        activeTags.innerHTML = `
            <span class="tag-badge" style="background: var(--primary-gradient)">${escapeHTML(channel.category)}</span>
            <span class="tag-badge" style="background: rgba(255,255,255,0.1); color: var(--text-secondary)">LIVE</span>
        `;

        // 이전 Hls 인스턴스가 존재하면 정리
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        // HLS 스트리밍 (.m3u8) 재생 지원 로직
        if (channel.url.includes('.m3u8') || channel.url.includes('.m3u')) {
            if (Hls.isSupported()) {
                hlsInstance = new Hls({
                    maxMaxBufferLength: 10,
                    enableWorker: true,
                    lowLatencyMode: true
                });
                hlsInstance.loadSource(channel.url);
                hlsInstance.attachMedia(video);
                
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(e => console.log("자동재생 대기:", e));
                });

                hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error('네트워크 에러 발생, 복구 시도...');
                                hlsInstance.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error('미디어 에러 발생, 복구 시도...');
                                hlsInstance.recoverMediaError();
                                break;
                            default:
                                handlePlaybackError('재생 오류 발생', '비디오 스트림 재생 중 치명적인 문제가 발생했습니다. 스트림 주소가 만료되었거나, CORS 제한 또는 브라우저 비호환 문제일 수 있습니다.');
                                break;
                        }
                    }
                });
            }
            // iOS와 같은 native HLS 지원 브라우저 대응
            else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = channel.url;
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(e => console.log("자동재생 대기:", e));
                });
            } else {
                handlePlaybackError('지원되지 않는 브라우저', '이 브라우저는 HLS 스트리밍 재생을 지원하지 않습니다. Chrome, Firefox, Safari 등의 브라우저를 이용해 주세요.');
            }
        } else {
            // 일반 MP4 등 기타 비디오 스트림 재생
            video.src = channel.url;
            video.play().catch(e => {
                console.error("일반 비디오 재생 오류:", e);
                handlePlaybackError('재생 불가', '선택한 미디어 형식을 직접 재생할 수 없습니다.');
            });
        }
    }

    // 재생 오류 시 레이아웃 처리
    function handlePlaybackError(title, msg) {
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
        video.src = '';
        showOverlay('fa-triangle-exclamation', title, msg);
    }
});
