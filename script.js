// 점심 메뉴 투표 앱 스크립트 (구글 시트 실시간 연동)

document.addEventListener('DOMContentLoaded', () => {
  // 1. 설정 및 상수
  const SPREADSHEET_ID = '1VnlP_HWFiANJWV4D17ecovgr2j9hzsdw50FtcCcA7E8';
  
  const menuMeta = {
    bibimbap: { name: '비빔밥', emoji: '🍚', keywords: ['비빔밥', 'bibimbap'] },
    tonkatsu: { name: '돈까스', emoji: '🍱', keywords: ['돈까스', '돈가스', '돈카츠', 'tonkatsu'] },
    gukbap: { name: '국밥', emoji: '🍲', keywords: ['국밥', '순대국', '돼지국밥', 'gukbap'] },
    salad: { name: '샐러드', emoji: '🥗', keywords: ['샐러드', 'salad'] }
  };

  // 투표 집계 데이터 (기본값: 데이터가 없거나 초기 상태일 때 무조건 0표)
  let votes = {
    bibimbap: 0,
    tonkatsu: 0,
    gukbap: 0,
    salad: 0
  };

  let selectedMenuId = null;
  let isFetchingSheet = false;

  // DOM 요소 참조
  const menuCards = document.querySelectorAll('.menu-card');
  const voteBtn = document.getElementById('voteBtn');
  const btnText = voteBtn.querySelector('.btn-text');
  const btnIcon = voteBtn.querySelector('.btn-icon');
  const totalVotesEl = document.getElementById('totalVotes');
  const resetBtn = document.getElementById('resetBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const syncStatus = document.getElementById('syncStatus');
  const syncText = document.getElementById('syncText');
  const toast = document.getElementById('toast');

  let toastTimeout = null;

  // 2. 초기 구글 시트 데이터 로드
  fetchGoogleSheetVotes();

  // 3. 구글 시트 데이터 조회 함수 (JSONP 기반 - CORS 제한 및 file:// 프로토콜 완벽 지원)
  function fetchGoogleSheetVotes() {
    if (isFetchingSheet) return;
    isFetchingSheet = true;

    setSyncStatus('loading', '구글 시트 데이터 동기화 중...');

    // 고유 콜백 함수명 생성
    const callbackName = 'gvizCallback_' + Math.floor(Math.random() * 1000000);
    let timeoutTimer = null;

    // 타임아웃 처리 (8초)
    timeoutTimer = setTimeout(() => {
      cleanup();
      setSyncStatus('error', '시트 응답 지연 (로컬 데이터 유지)');
      isFetchingSheet = false;
      showToast('⚠️ 구글 시트 연결 지연으로 이전 데이터를 표시합니다.');
    }, 8000);

    function cleanup() {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      delete window[callbackName];
      const existingScript = document.getElementById(callbackName);
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    }

    // 전역 콜백 등록
    window[callbackName] = function (response) {
      cleanup();
      isFetchingSheet = false;

      try {
        if (!response || !response.table) {
          throw new Error('시트 응답 형식 오류');
        }

        // 시트 데이터 파싱 및 집계
        parseSheetData(response.table);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSyncStatus('success', `시트 동기화 완료 (${timeStr})`);
        showToast('✅ 구글 시트 최신 데이터를 불러왔습니다!');
      } catch (err) {
        console.error('시트 파싱 오류:', err);
        setSyncStatus('error', '시트 데이터 처리 오류');
        // 파싱 오류 시에도 0표 기준 화면 업데이트
        updateResultsUI();
      }
    };

    // 스크립트 태그 생성 및 삽입
    const script = document.createElement('script');
    script.id = callbackName;
    script.src = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&_=${Date.now()}`;
    script.onerror = function () {
      cleanup();
      isFetchingSheet = false;
      setSyncStatus('error', '시트 연결 실패');
      updateResultsUI();
      showToast('❌ 구글 시트를 불러오지 못했습니다.');
    };

    document.head.appendChild(script);
  }

  // 4. 구글 시트 데이터 파싱 로직
  function parseSheetData(table) {
    // 득표 데이터가 없다면 모든 메뉴 0표로 초기화
    const newVotes = {
      bibimbap: 0,
      tonkatsu: 0,
      gukbap: 0,
      salad: 0
    };

    const rows = table.rows || [];
    let validVoteCount = 0;

    // 컬럼 인덱스 확인
    // 보통 cols: [ {id: "A", label: "timestamp"}, {id: "B", label: "menu"}, {id: "C", label: "volter"} ]
    let menuColIdx = 1; // 기본은 2번째 열(B열)

    if (table.cols && table.cols.length > 0) {
      table.cols.forEach((col, idx) => {
        if (col.label && col.label.toLowerCase().includes('menu')) {
          menuColIdx = idx;
        }
      });
    }

    // 각 행 데이터 순회
    rows.forEach(row => {
      if (!row || !row.c) return;

      // 헤더 행 여부 확인 (예: 첫 행에 timestamp, menu 등이 값으로 들어간 경우 스킵)
      const firstCellVal = row.c[0] && row.c[0].v !== undefined ? String(row.c[0].v).toLowerCase().trim() : '';
      const menuCellVal = row.c[menuColIdx] && row.c[menuColIdx].v !== undefined ? String(row.c[menuColIdx].v).trim() : '';

      if (firstCellVal === 'timestamp' || menuCellVal.toLowerCase() === 'menu') {
        return; // 헤더 행 제외
      }

      if (!menuCellVal) return;

      // 메뉴명 정규화
      const matchedId = matchMenuId(menuCellVal);
      if (matchedId && newVotes[matchedId] !== undefined) {
        newVotes[matchedId]++;
        validVoteCount++;
      }
    });

    votes = newVotes;
    updateResultsUI();
  }

  // 메뉴 텍스트를 고유 ID(bibimbap, tonkatsu, gukbap, salad)로 매칭
  function matchMenuId(rawText) {
    if (!rawText) return null;
    const clean = String(rawText).trim().toLowerCase().replace(/\s+/g, '');

    for (const [id, meta] of Object.entries(menuMeta)) {
      for (const kw of meta.keywords) {
        if (clean.includes(kw)) {
          return id;
        }
      }
    }
    return null;
  }

  // 5. 동기화 상태 표시 헬퍼
  function setSyncStatus(state, message) {
    syncStatus.className = 'sync-status ' + state;
    syncText.textContent = message;
  }

  // 6. 결과 화면 갱신 함수 (0표 처리 및 백분율 계산)
  function updateResultsUI() {
    // 총 득표수 계산
    const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);
    totalVotesEl.textContent = totalVotes.toLocaleString();

    // 1위 최다 득표수 계산 (1표 이상일 때만 유효, 0표일 때는 1등 표시 안 함)
    let maxVotes = 0;
    if (totalVotes > 0) {
      maxVotes = Math.max(...Object.values(votes));
    }

    // 각 메뉴별 통계 갱신
    Object.keys(menuMeta).forEach(id => {
      const count = votes[id] || 0; // 데이터가 없다면 0표
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

      const itemEl = document.getElementById(`result-${id}`);
      if (!itemEl) return;

      const countEl = itemEl.querySelector('.vote-count');
      const percentEl = itemEl.querySelector('.vote-percentage');
      const fillEl = itemEl.querySelector('.progress-bar-fill');
      const badgeEl = itemEl.querySelector('.leader-badge');

      // 득표수 & 백분율 표시 (0표일 때 0표, 0%로 명시)
      countEl.textContent = `${count}표`;
      percentEl.textContent = `${percentage}%`;
      fillEl.style.width = `${percentage}%`;

      // 1위 뱃지 (1표 이상이면서 최다 득표인 경우에만 표시)
      const isLeader = totalVotes > 0 && count === maxVotes && count > 0;
      if (isLeader) {
        badgeEl.classList.remove('hidden');
        itemEl.classList.add('highlight');
      } else {
        badgeEl.classList.add('hidden');
        itemEl.classList.remove('highlight');
      }
    });
  }

  // 7. 메뉴 카드 선택 이벤트
  menuCards.forEach(card => {
    card.addEventListener('click', () => {
      selectMenu(card.dataset.id);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMenu(card.dataset.id);
      }
    });
  });

  function selectMenu(menuId) {
    selectedMenuId = menuId;

    menuCards.forEach(card => {
      const isSelected = card.dataset.id === menuId;
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    voteBtn.disabled = false;
    const item = menuMeta[menuId];
    btnText.textContent = `'${item.name}'에 투표하기`;
    btnIcon.textContent = '🗳️';
  }

  // 8. 투표하기 버튼 클릭
  voteBtn.addEventListener('click', () => {
    if (!selectedMenuId) return;

    votes[selectedMenuId] = (votes[selectedMenuId] || 0) + 1;
    updateResultsUI();

    const selectedItem = menuMeta[selectedMenuId];
    showToast(`🎉 ${selectedItem.emoji} '${selectedItem.name}'에 1표가 추가되었습니다!`);

    voteBtn.style.transform = 'scale(0.97)';
    setTimeout(() => {
      voteBtn.style.transform = '';
    }, 150);
  });

  // 9. '최신화' (새로고침) 버튼
  refreshBtn.addEventListener('click', () => {
    const icon = refreshBtn.querySelector('.refresh-icon');
    if (icon) icon.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      if (icon) icon.style.transform = '';
    }, 400);

    fetchGoogleSheetVotes();
  });

  // 10. 0표로 초기화 버튼
  resetBtn.addEventListener('click', () => {
    if (confirm('투표 결과를 모두 0표로 초기화하시겠습니까?')) {
      votes = {
        bibimbap: 0,
        tonkatsu: 0,
        gukbap: 0,
        salad: 0
      };
      updateResultsUI();

      selectedMenuId = null;
      menuCards.forEach(card => {
        card.classList.remove('selected');
        card.setAttribute('aria-checked', 'false');
      });
      voteBtn.disabled = true;
      btnText.textContent = '메뉴를 선택해 주세요';
      btnIcon.textContent = '👉';

      showToast('🔄 모든 메뉴가 0표로 초기화되었습니다.');
    }
  });

  // 11. 토스트 알림 헬퍼
  function showToast(message) {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toast.textContent = message;
    toast.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }
});
