// 점심 메뉴 투표 앱 스크립트 (구글 시트 읽기 & 실시간 쓰기 연동)

document.addEventListener('DOMContentLoaded', () => {
  // 1. 설정 및 상수
  const SPREADSHEET_ID = '1VnlP_HWFiANJWV4D17ecovgr2j9hzsdw50FtcCcA7E8';
  const STORAGE_KEY_WEBAPP = 'lunch_vote_webapp_url_v1';
  
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
  let isSubmitting = false;

  // DOM 요소 참조
  const menuCards = document.querySelectorAll('.menu-card');
  const voterNameInput = document.getElementById('voterName');
  const voteBtn = document.getElementById('voteBtn');
  const btnText = voteBtn.querySelector('.btn-text');
  const btnIcon = voteBtn.querySelector('.btn-icon');
  const totalVotesEl = document.getElementById('totalVotes');
  const resetBtn = document.getElementById('resetBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const syncStatus = document.getElementById('syncStatus');
  const syncText = document.getElementById('syncText');
  const toast = document.getElementById('toast');

  // 모달 요소 참조
  const configBtn = document.getElementById('configBtn');
  const configModal = document.getElementById('configModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const webAppUrlInput = document.getElementById('webAppUrlInput');

  let toastTimeout = null;

  // 저장된 Web App URL 불러오기
  let webAppUrl = localStorage.getItem(STORAGE_KEY_WEBAPP) || '';
  if (webAppUrlInput) {
    webAppUrlInput.value = webAppUrl;
  }

  // 2. 초기 구글 시트 데이터 로드
  fetchGoogleSheetVotes();

  // 3. 구글 시트 데이터 조회 함수 (JSONP 방식 - CORS 및 로컬 file:// 무관)
  function fetchGoogleSheetVotes(showSuccessToast = false) {
    if (isFetchingSheet) return;
    isFetchingSheet = true;

    setSyncStatus('loading', '구글 시트 데이터 동기화 중...');

    const callbackName = 'gvizCallback_' + Math.floor(Math.random() * 1000000);
    let timeoutTimer = null;

    timeoutTimer = setTimeout(() => {
      cleanup();
      setSyncStatus('error', '시트 응답 지연');
      isFetchingSheet = false;
    }, 8000);

    function cleanup() {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      delete window[callbackName];
      const existingScript = document.getElementById(callbackName);
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    }

    window[callbackName] = function (response) {
      cleanup();
      isFetchingSheet = false;

      try {
        if (!response || !response.table) {
          throw new Error('시트 응답 형식 오류');
        }

        parseSheetData(response.table);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSyncStatus('success', `시트 동기화 완료 (${timeStr})`);
        
        if (showSuccessToast) {
          showToast('✅ 구글 시트 최신 데이터를 불러왔습니다!');
        }
      } catch (err) {
        console.error('시트 파싱 오류:', err);
        setSyncStatus('error', '시트 데이터 처리 오류');
        updateResultsUI();
      }
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&_=${Date.now()}`;
    script.onerror = function () {
      cleanup();
      isFetchingSheet = false;
      setSyncStatus('error', '시트 연결 실패');
      updateResultsUI();
    };

    document.head.appendChild(script);
  }

  // 4. 구글 시트 데이터 파싱 로직
  function parseSheetData(table) {
    const newVotes = {
      bibimbap: 0,
      tonkatsu: 0,
      gukbap: 0,
      salad: 0
    };

    const rows = table.rows || [];
    let menuColIdx = 1; // 기본은 B열(menu)

    if (table.cols && table.cols.length > 0) {
      table.cols.forEach((col, idx) => {
        if (col.label && col.label.toLowerCase().includes('menu')) {
          menuColIdx = idx;
        }
      });
    }

    rows.forEach(row => {
      if (!row || !row.c) return;

      const firstCellVal = row.c[0] && row.c[0].v !== undefined ? String(row.c[0].v).toLowerCase().trim() : '';
      const menuCellVal = row.c[menuColIdx] && row.c[menuColIdx].v !== undefined ? String(row.c[menuColIdx].v).trim() : '';

      if (firstCellVal === 'timestamp' || menuCellVal.toLowerCase() === 'menu') {
        return; // 헤더 행 제외
      }

      if (!menuCellVal) return;

      const matchedId = matchMenuId(menuCellVal);
      if (matchedId && newVotes[matchedId] !== undefined) {
        newVotes[matchedId]++;
      }
    });

    votes = newVotes;
    updateResultsUI();
  }

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

  function setSyncStatus(state, message) {
    syncStatus.className = 'sync-status ' + state;
    syncText.textContent = message;
  }

  // 5. 결과 화면 갱신 함수 (0표 예외 처리 및 백분율 계산)
  function updateResultsUI() {
    const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);
    totalVotesEl.textContent = totalVotes.toLocaleString();

    let maxVotes = 0;
    if (totalVotes > 0) {
      maxVotes = Math.max(...Object.values(votes));
    }

    Object.keys(menuMeta).forEach(id => {
      const count = votes[id] || 0;
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

      const itemEl = document.getElementById(`result-${id}`);
      if (!itemEl) return;

      const countEl = itemEl.querySelector('.vote-count');
      const percentEl = itemEl.querySelector('.vote-percentage');
      const fillEl = itemEl.querySelector('.progress-bar-fill');
      const badgeEl = itemEl.querySelector('.leader-badge');

      countEl.textContent = `${count}표`;
      percentEl.textContent = `${percentage}%`;
      fillEl.style.width = `${percentage}%`;

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

  // 6. 메뉴 선택 이벤트
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
    if (isSubmitting) return;
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

  // 7. 투표하기 버튼 클릭 (구글 시트로 실시간 데이터 전송)
  voteBtn.addEventListener('click', async () => {
    if (!selectedMenuId || isSubmitting) return;

    const selectedItem = menuMeta[selectedMenuId];
    const voterName = (voterNameInput.value || '').trim() || '익명';

    // 만약 Apps Script 웹 앱 URL이 설정되지 않았다면 설정 모달 안내
    if (!webAppUrl) {
      openConfigModal();
      showToast('⚠️ 구글 시트에 저장하려면 웹 앱 URL 설정이 필요합니다.');
      return;
    }

    isSubmitting = true;
    voteBtn.disabled = true;
    btnText.textContent = '구글 시트로 저장 중...';
    btnIcon.textContent = '⏳';

    try {
      // 1) Google Apps Script 웹 앱으로 투표 데이터 POST 전송 (no-cors 모드)
      const payload = {
        menu: selectedItem.name,
        volter: voterName,
        timestamp: new Date().toISOString()
      };

      await fetch(webAppUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      // 로컬 즉시 반영
      votes[selectedMenuId] = (votes[selectedMenuId] || 0) + 1;
      updateResultsUI();

      showToast(`🎉 구글 시트에 [${selectedItem.name}] 투표가 저장되었습니다!`);

      // 2) 1.5초 후 구글 시트 원본 데이터를 다시 조회하여 최종 동기화
      setTimeout(() => {
        fetchGoogleSheetVotes(false);
      }, 1500);

    } catch (err) {
      console.warn('POST 실패, GET fallback 시도:', err);
      // Fallback: GET 방식으로 시트 전송 시도
      try {
        const getUrl = `${webAppUrl}?menu=${encodeURIComponent(selectedItem.name)}&volter=${encodeURIComponent(voterName)}&_=${Date.now()}`;
        const imgPing = new Image();
        imgPing.src = getUrl;

        votes[selectedMenuId] = (votes[selectedMenuId] || 0) + 1;
        updateResultsUI();
        showToast(`🎉 [${selectedItem.name}] 투표가 저장되었습니다!`);

        setTimeout(() => {
          fetchGoogleSheetVotes(false);
        }, 1500);
      } catch (fallbackErr) {
        console.error('투표 저장 최종 실패:', fallbackErr);
        showToast('❌ 구글 시트 저장 중 오류가 발생했습니다.');
      }
    } finally {
      isSubmitting = false;
      voteBtn.disabled = false;
      btnText.textContent = `'${selectedItem.name}'에 투표하기`;
      btnIcon.textContent = '🗳️';
    }
  });

  // 8. 설정 모달 관리
  function openConfigModal() {
    configModal.classList.remove('hidden');
    if (webAppUrlInput) {
      webAppUrlInput.focus();
    }
  }

  function closeConfigModal() {
    configModal.classList.add('hidden');
  }

  if (configBtn) configBtn.addEventListener('click', openConfigModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeConfigModal);

  // 모달 바깥 배경 클릭 시 닫기
  if (configModal) {
    configModal.addEventListener('click', (e) => {
      if (e.target === configModal) {
        closeConfigModal();
      }
    });
  }

  // 웹 앱 URL 저장 버튼
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
      const url = (webAppUrlInput.value || '').trim();
      if (!url) {
        showToast('⚠️ 웹 앱 URL을 입력해 주세요.');
        return;
      }

      if (!url.startsWith('https://script.google.com/macros/s/')) {
        showToast('⚠️ 올바른 Google Apps Script 웹 앱 URL 형식이 아닙니다.');
        return;
      }

      webAppUrl = url;
      localStorage.setItem(STORAGE_KEY_WEBAPP, url);
      closeConfigModal();
      showToast('✅ 웹 앱 연동 설정이 저장되었습니다!');
    });
  }

  // 9. '최신화' (새로고침) 버튼
  refreshBtn.addEventListener('click', () => {
    const icon = refreshBtn.querySelector('.refresh-icon');
    if (icon) icon.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      if (icon) icon.style.transform = '';
    }, 400);

    fetchGoogleSheetVotes(true);
  });

  // 10. 0표로 초기화 버튼
  resetBtn.addEventListener('click', () => {
    if (confirm('화면의 투표 결과를 모두 0표로 초기화하시겠습니까? (시트 원본 데이터는 지워지지 않습니다)')) {
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

      showToast('🔄 화면 결과가 0표로 초기화되었습니다.');
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
